import * as THREE from 'three';
import { MapType } from '../consts/earth';
import { latLongToCartesian } from './latLongToCartesian';
import { getMapTileUrl } from './mapTiles';
import {
  HeightField,
  sampleHeightField,
  TileCoord,
  tileXToLongitude,
  tileYToLatitude,
} from './terrainTiles';

const TILE_SEGMENTS = 24;
// Hysteresis band for subdivision: subdivide (stream higher-res children) once
// the camera is within SUBDIVIDE_IN tile-diagonals, and only collapse back to
// the coarser tile when it retreats beyond SUBDIVIDE_OUT. The gap between the
// two thresholds stops tiles flip-flopping between resolutions — and flashing —
// while the camera hovers near the boundary.
const SUBDIVIDE_IN = 2.5;
const SUBDIVIDE_OUT = 3.5;
// A tile is loaded (and kept resident) when within this many of its diagonals
// of the camera, regardless of which way the camera faces. This keeps a sphere
// of tiles around the camera cached so rotating in place never reloads — only
// the view frustum decides what is actually drawn, not what is loaded.
const LOAD_FACTOR = 4;
// Loaded tiles stay cached (kept in memory, just hidden when off-screen) so
// panning/rotating back to a previous view is instant and never reloads. Only
// when more than this many tiles are resident are the least-recently-used ones
// evicted to bound GPU memory. Root tiles are never evicted.
const TILE_CACHE_BUDGET = 800;
const EVICT_INTERVAL_TICKS = 60;

const loadTexture = (url: string): Promise<THREE.Texture | null> =>
  new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  });

/**
 * Builds a displaced terrain mesh for a single tile, draped with its imagery
 * and lifted onto elevation sampled from the shared height field. All tiles
 * sample the same continuous field, so neighbouring LOD levels share edge
 * elevations and stay (visually) crack-free.
 */
const buildTileMesh = (
  x: number,
  y: number,
  z: number,
  field: HeightField,
  texture: THREE.Texture | null,
): THREE.Mesh => {
  const verts = TILE_SEGMENTS + 1;
  const positions = new Float32Array(verts * verts * 3);
  const uvs = new Float32Array(verts * verts * 2);

  for (let j = 0; j < verts; j++) {
    const fracY = j / TILE_SEGMENTS;
    const latitude = tileYToLatitude(y + fracY, z);
    for (let i = 0; i < verts; i++) {
      const fracX = i / TILE_SEGMENTS;
      const longitude = tileXToLongitude(x + fracX, z);
      const elevation = sampleHeightField(field, latitude, longitude);
      const point = latLongToCartesian(latitude, longitude, elevation);

      const vi = (j * verts + i) * 3;
      positions[vi] = point.x;
      positions[vi + 1] = point.y;
      positions[vi + 2] = point.z;

      const ui = (j * verts + i) * 2;
      uvs[ui] = fracX;
      // Tile row 0 is the northern edge; with flipY textures that maps to v = 1.
      uvs[ui + 1] = 1 - fracY;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < TILE_SEGMENTS; j++) {
    for (let i = 0; i < TILE_SEGMENTS; i++) {
      const a = j * verts + i;
      const b = j * verts + i + 1;
      const c = (j + 1) * verts + i;
      const d = (j + 1) * verts + i + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: texture ?? undefined,
    color: texture ? 0xffffff : 0x808080,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  return new THREE.Mesh(geometry, material);
};

class TerrainNode {
  mesh: THREE.Mesh | null = null;
  texture: THREE.Texture | null = null;
  requested = false;
  loaded = false;
  children: TerrainNode[] | null = null;
  lastUsedTick = 0;
  // Current hysteresis state: whether this tile is showing its higher-res
  // children rather than itself.
  subdivided = false;

  readonly centerWorld: THREE.Vector3;
  readonly radius: number;
  readonly worldSize: number;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
    field: HeightField,
  ) {
    const minLong = tileXToLongitude(x, z);
    const maxLong = tileXToLongitude(x + 1, z);
    const maxLat = tileYToLatitude(y, z);
    const minLat = tileYToLatitude(y + 1, z);
    const centerLat = (minLat + maxLat) / 2;
    const centerLong = (minLong + maxLong) / 2;
    const centerElev = sampleHeightField(field, centerLat, centerLong);

    this.centerWorld = latLongToCartesian(centerLat, centerLong, centerElev);
    const corner = latLongToCartesian(maxLat, minLong, centerElev);
    const diagonal = this.centerWorld.distanceTo(corner) * 2;
    this.worldSize = diagonal;
    // Inflate the cull sphere a little to allow for elevation within the tile.
    this.radius = diagonal * 0.6 + 100;
  }
}

export interface TerrainQuadtreeConfig {
  mapType: MapType;
  field: HeightField;
  rootZoom: number;
  rootTiles: TileCoord[];
  maxZoom: number;
}

/**
 * A screen-space-error quadtree that streams imagery + terrain tiles on demand:
 * only tiles inside the view frustum load, refining to higher resolution the
 * closer the camera is and falling back to a coarser parent until the finer
 * children have finished loading (progressive refinement, like Google Maps).
 */
export class TerrainQuadtree {
  readonly group = new THREE.Group();

  private readonly roots: TerrainNode[];
  private readonly mapType: MapType;
  private readonly field: HeightField;
  private readonly maxZoom: number;
  private readonly rootZoom: number;
  // Every node with a loaded mesh currently resident in memory, for LRU caching.
  private readonly residentNodes = new Set<TerrainNode>();

  private readonly frustum = new THREE.Frustum();
  private readonly projScreenMatrix = new THREE.Matrix4();
  private readonly cullSphere = new THREE.Sphere();

  private tick = 0;
  private disposed = false;

  constructor(config: TerrainQuadtreeConfig) {
    this.mapType = config.mapType;
    this.field = config.field;
    this.maxZoom = config.maxZoom;
    this.rootZoom = config.rootZoom;
    this.roots = config.rootTiles.map(
      ({ x, y }) => new TerrainNode(x, y, config.rootZoom, config.field),
    );
  }

  /** Streams/refines tiles for the current camera view. Call once per frame. */
  update(camera: THREE.Camera): void {
    if (this.disposed) {
      return;
    }
    this.tick++;
    this.projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    for (const root of this.roots) {
      this.refine(root, camera.position);
    }

    if (this.tick % EVICT_INTERVAL_TICKS === 0) {
      this.evictExcess();
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const root of this.roots) {
      this.disposeSubtree(root);
    }
    this.group.clear();
  }

  /**
   * Selects the right LOD for a node. Returns whether this subtree currently
   * covers its area with loaded geometry (so a parent knows it can hide).
   *
   * Loading is driven by distance, not the frustum: any tile within LOAD_FACTOR
   * diagonals of the camera is loaded and kept resident regardless of facing,
   * so rotating in place never reloads. The frustum only gates visibility.
   */
  private refine(node: TerrainNode, cameraPosition: THREE.Vector3): boolean {
    node.lastUsedTick = this.tick;
    this.cullSphere.set(node.centerWorld, node.radius);
    const inFrustum = this.frustum.intersectsSphere(this.cullSphere);
    const distance = cameraPosition.distanceTo(node.centerWorld);

    // Skip tiles that are neither visible nor near the camera: nothing to draw
    // or preload there.
    if (!inFrustum && distance > node.worldSize * LOAD_FACTOR) {
      if (node.mesh) {
        node.mesh.visible = false;
      }
      this.hideChildren(node);
      return true;
    }

    // Hysteresis: switch state only when crossing the inner/outer thresholds,
    // otherwise keep the current LOD to avoid flip-flopping near the boundary.
    let wantSubdivide = node.subdivided;
    if (node.z >= this.maxZoom) {
      wantSubdivide = false;
    } else if (distance < node.worldSize * SUBDIVIDE_IN) {
      wantSubdivide = true;
    } else if (distance > node.worldSize * SUBDIVIDE_OUT) {
      wantSubdivide = false;
    }
    node.subdivided = wantSubdivide;

    if (wantSubdivide) {
      this.ensureChildren(node);
      let allCovered = true;
      for (const child of node.children!) {
        if (!this.refine(child, cameraPosition)) {
          allCovered = false;
        }
      }
      if (allCovered) {
        if (node.mesh) {
          node.mesh.visible = false;
        }
        return true;
      }
      // Children not all ready: show this coarser tile as a fallback and hide
      // the partially loaded children to avoid overlapping geometry.
      this.ensureLoaded(node);
      this.hideChildren(node);
      if (node.mesh) {
        node.mesh.visible = node.loaded && inFrustum;
      }
      return node.loaded;
    }

    // Leaf at the desired LOD.
    this.ensureLoaded(node);
    this.hideChildren(node);
    if (node.mesh) {
      node.mesh.visible = node.loaded && inFrustum;
    }
    return node.loaded;
  }

  private ensureChildren(node: TerrainNode): void {
    if (node.children) {
      return;
    }
    const z = node.z + 1;
    const bx = node.x * 2;
    const by = node.y * 2;
    node.children = [
      new TerrainNode(bx, by, z, this.field),
      new TerrainNode(bx + 1, by, z, this.field),
      new TerrainNode(bx, by + 1, z, this.field),
      new TerrainNode(bx + 1, by + 1, z, this.field),
    ];
  }

  private ensureLoaded(node: TerrainNode): void {
    if (node.requested) {
      return;
    }
    node.requested = true;
    const url = getMapTileUrl(this.mapType, node.x, node.y, node.z);
    loadTexture(url).then((texture) => {
      if (this.disposed) {
        texture?.dispose();
        return;
      }
      const mesh = buildTileMesh(node.x, node.y, node.z, this.field, texture);
      mesh.visible = false;
      node.texture = texture;
      node.mesh = mesh;
      node.loaded = true;
      this.residentNodes.add(node);
      this.group.add(mesh);
    });
  }

  private hideChildren(node: TerrainNode): void {
    if (!node.children) {
      return;
    }
    for (const child of node.children) {
      if (child.mesh) {
        child.mesh.visible = false;
      }
      this.hideChildren(child);
    }
  }

  /**
   * Evicts least-recently-used resident tiles once the cache budget is
   * exceeded, so loaded tiles persist (and stay instantly available) until
   * memory pressure forces a release. Roots and tiles in use this frame are
   * never evicted.
   */
  private evictExcess(): void {
    if (this.residentNodes.size <= TILE_CACHE_BUDGET) {
      return;
    }
    const candidates = [...this.residentNodes]
      .filter((node) => node.z > this.rootZoom && node.lastUsedTick !== this.tick)
      .sort((a, b) => a.lastUsedTick - b.lastUsedTick);

    let excess = this.residentNodes.size - TILE_CACHE_BUDGET;
    for (const node of candidates) {
      if (excess <= 0) {
        break;
      }
      this.disposeMesh(node);
      excess--;
    }
  }

  private disposeSubtree(node: TerrainNode): void {
    if (node.children) {
      for (const child of node.children) {
        this.disposeSubtree(child);
      }
      node.children = null;
    }
    this.disposeMesh(node);
  }

  private disposeMesh(node: TerrainNode): void {
    if (node.mesh) {
      this.group.remove(node.mesh);
      node.mesh.geometry.dispose();
      (node.mesh.material as THREE.Material).dispose();
    }
    node.texture?.dispose();
    node.mesh = null;
    node.texture = null;
    node.loaded = false;
    node.requested = false;
    node.subdivided = false;
    this.residentNodes.delete(node);
  }
}
