import * as THREE from 'three';
import { EARTH_RADIUS, MapType } from '../consts/earth';
import { latLongToCartesian } from './latLongToCartesian';
import { getMapTileUrl } from './mapTiles';
import {
  elevationTileFor,
  HeightTile,
  loadHeightTileCached,
  sampleTileElevation,
  TileCoord,
  tileXToLongitude,
  tileYToLatitude,
} from './terrainTiles';

const TILE_SEGMENTS = 24;
// Hysteresis band for subdivision: subdivide (stream higher-res children) once
// the camera is within SUBDIVIDE_IN tile-diagonals, and only collapse back to
// the coarser tile when it retreats beyond SUBDIVIDE_OUT. The gap between the
// two thresholds stops tiles flip-flopping between resolutions while the camera
// hovers near the boundary. These same multiples define the CDLOD morph band:
// a tile is drawn at full detail within SUBDIVIDE_IN diagonals and morphs
// continuously toward its parent's coarser shape out to SUBDIVIDE_OUT, where it
// collapses — so its edge already matches the parent before the swap and there
// is no popping or cracking.
const SUBDIVIDE_IN = 1.8;
const SUBDIVIDE_OUT = 2.6;
// A tile is loaded (and kept resident) when its bounding sphere — inflated by
// this margin — intersects the view frustum. The margin pre-loads a thin ring
// of tiles just outside the visible area so panning/rotating a little never
// pops, while tiles well outside the view are never streamed. Kept small so the
// working set stays comfortably under the cache budget. Visibility itself uses
// the un-inflated sphere.
const LOAD_MARGIN = 1.15;
// Loaded tiles stay cached (kept in memory, just hidden when off-screen) so
// panning/rotating back to a previous view is instant and never reloads. This
// budget must comfortably exceed the in-view working set, otherwise every
// off-screen tile is evicted each cycle and re-fetched on the way back (the
// "reload on pan" symptom). Least-recently-used tiles are evicted past it; root
// tiles are never evicted.
const TILE_CACHE_BUDGET = 1200;
const EVICT_INTERVAL_TICKS = 60;
// Maximum number of new tile loads kicked off per update (frame). New loads are
// prioritised coarsest-then-nearest, so the most useful tiles arrive first and
// the rest defer to later frames. Every level on a path is requested in parallel
// (not gated on the parent loading first), so this caps the burst when zooming.
const MAX_LOADS_PER_UPDATE = 24;
// Deepest zoom the free Terrarium elevation dataset is sampled at. Display
// tiles beyond this reuse a sub-region of their nearest ancestor elevation tile,
// so geometry keeps streaming with imagery without extra elevation fetches.
const ELEVATION_MAX_ZOOM = 13;

/** The elevation tile (and its coords) a node samples its heights from. */
interface NodeElevation {
  tile: HeightTile | null;
  ex: number;
  ey: number;
  ez: number;
}

/** Shared every frame with all terrain materials for CDLOD distance morphing. */
type CameraUniform = { value: THREE.Vector3 };

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
 * Builds a CDLOD-morphing material: a standard PBR terrain material whose
 * vertices are interpolated, in the vertex shader, between their full-detail
 * position and a `morphTarget` position lying on the coarser (parent) lattice.
 * The blend factor rises with camera distance across the tile's morph band, so
 * a tile smoothly converges to its parent's shape before it is swapped out —
 * giving a continuous, crack-free, pop-free surface across LOD boundaries.
 */
const createTerrainMaterial = (
  texture: THREE.Texture | null,
  morphStart: number,
  morphEnd: number,
  cameraUniform: CameraUniform,
): THREE.MeshStandardMaterial => {
  const material = new THREE.MeshStandardMaterial({
    map: texture ?? undefined,
    color: texture ? 0xffffff : 0x808080,
    roughness: 1,
    metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCameraPosition = cameraUniform;
    shader.uniforms.uMorphStart = { value: morphStart };
    shader.uniforms.uMorphEnd = { value: morphEnd };
    shader.vertexShader =
      'attribute vec3 cdlodTarget;\n' +
      'uniform vec3 uCameraPosition;\n' +
      'uniform float uMorphStart;\n' +
      'uniform float uMorphEnd;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        [
          'float _camDist = distance(position, uCameraPosition);',
          'float _morph = clamp((_camDist - uMorphStart) / max(uMorphEnd - uMorphStart, 1.0), 0.0, 1.0);',
          'vec3 transformed = mix(position, cdlodTarget, _morph);',
        ].join('\n'),
      );
  };

  return material;
};

/**
 * Builds a displaced terrain mesh for a single tile, draped with its imagery
 * and lifted onto elevation streamed for that tile's own LOD. Alongside each
 * full-detail vertex it stores a `morphTarget` — the position that vertex would
 * occupy on the parent's coarser lattice — which the material blends toward with
 * distance (CDLOD). Because the morph collapses a tile to exactly its parent's
 * geometry at the LOD-switch distance, neighbouring tiles meet seamlessly and no
 * skirts are needed.
 */
const buildTileMesh = (
  x: number,
  y: number,
  z: number,
  elevation: NodeElevation,
  texture: THREE.Texture | null,
  morphStart: number,
  morphEnd: number,
  cameraUniform: CameraUniform,
): THREE.Mesh => {
  const verts = TILE_SEGMENTS + 1;
  const { tile, ex, ey, ez } = elevation;

  const positions = new Float32Array(verts * verts * 3);
  const uvs = new Float32Array(verts * verts * 2);

  for (let j = 0; j < verts; j++) {
    const fracY = j / TILE_SEGMENTS;
    const latitude = tileYToLatitude(y + fracY, z);
    for (let i = 0; i < verts; i++) {
      const fracX = i / TILE_SEGMENTS;
      const longitude = tileXToLongitude(x + fracX, z);
      const elev = sampleTileElevation(tile, ex, ey, ez, latitude, longitude);
      const point = latLongToCartesian(latitude, longitude, elev);

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

  // Morph target: collapse odd-indexed vertices onto the even (coarser) lattice
  // by averaging their even neighbours, exactly mirroring how this tile merges
  // into its parent. Even vertices keep their own position.
  const morphTargets = new Float32Array(verts * verts * 3);
  const copyVertex = (target: number, source: number): void => {
    morphTargets[target] = positions[source];
    morphTargets[target + 1] = positions[source + 1];
    morphTargets[target + 2] = positions[source + 2];
  };
  const averageVertices = (target: number, a: number, b: number): void => {
    morphTargets[target] = (positions[a] + positions[b]) * 0.5;
    morphTargets[target + 1] = (positions[a + 1] + positions[b + 1]) * 0.5;
    morphTargets[target + 2] = (positions[a + 2] + positions[b + 2]) * 0.5;
  };
  const idx = (i: number, j: number): number => (j * verts + i) * 3;

  for (let j = 0; j < verts; j++) {
    for (let i = 0; i < verts; i++) {
      const t = idx(i, j);
      const iOdd = i % 2 === 1;
      const jOdd = j % 2 === 1;
      if (!iOdd && !jOdd) {
        copyVertex(t, t);
      } else if (iOdd && !jOdd) {
        averageVertices(t, idx(i - 1, j), idx(i + 1, j));
      } else if (!iOdd && jOdd) {
        averageVertices(t, idx(i, j - 1), idx(i, j + 1));
      } else {
        // Both odd: average of the four diagonal even neighbours.
        const tl = idx(i - 1, j - 1);
        const tr = idx(i + 1, j - 1);
        const bl = idx(i - 1, j + 1);
        const br = idx(i + 1, j + 1);
        morphTargets[t] = (positions[tl] + positions[tr] + positions[bl] + positions[br]) * 0.25;
        morphTargets[t + 1] =
          (positions[tl + 1] + positions[tr + 1] + positions[bl + 1] + positions[br + 1]) * 0.25;
        morphTargets[t + 2] =
          (positions[tl + 2] + positions[tr + 2] + positions[bl + 2] + positions[br + 2]) * 0.25;
      }
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < TILE_SEGMENTS; j++) {
    for (let i = 0; i < TILE_SEGMENTS; i++) {
      const a = j * verts + i;
      const b = a + 1;
      const c = a + verts;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('cdlodTarget', new THREE.BufferAttribute(morphTargets, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = createTerrainMaterial(texture, morphStart, morphEnd, cameraUniform);
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
  ) {
    const minLong = tileXToLongitude(x, z);
    const maxLong = tileXToLongitude(x + 1, z);
    const maxLat = tileYToLatitude(y, z);
    const minLat = tileYToLatitude(y + 1, z);
    const centerLat = (minLat + maxLat) / 2;
    const centerLong = (minLong + maxLong) / 2;

    // Elevation streams in per-tile asynchronously, so the cull sphere is sized
    // from the sea-level footprint and inflated generously to always enclose
    // the displaced geometry (terrain relief is bounded by the tile's own size).
    this.centerWorld = latLongToCartesian(centerLat, centerLong, 0);
    const corner = latLongToCartesian(maxLat, minLong, 0);
    const diagonal = this.centerWorld.distanceTo(corner) * 2;
    this.worldSize = diagonal;
    this.radius = diagonal + 300;
  }
}

export interface TerrainQuadtreeConfig {
  mapType: MapType;
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
  private readonly maxZoom: number;
  private readonly rootZoom: number;
  // Every node with a loaded mesh currently resident in memory, for LRU caching.
  private readonly residentNodes = new Set<TerrainNode>();

  private readonly frustum = new THREE.Frustum();
  private readonly projScreenMatrix = new THREE.Matrix4();
  private readonly cullSphere = new THREE.Sphere();
  // Camera world position shared with every tile material so the CDLOD vertex
  // shader can morph each vertex by its distance. Updated once per frame.
  private readonly cameraUniform: CameraUniform = { value: new THREE.Vector3() };
  // Tiles that want loading this frame, drained (priority-ordered, capped) at
  // the end of each update. Reused between frames to avoid per-frame allocation.
  private readonly pendingLoads: Array<{
    node: TerrainNode;
    z: number;
    distance: number;
  }> = [];

  private tick = 0;
  private disposed = false;

  constructor(config: TerrainQuadtreeConfig) {
    this.mapType = config.mapType;
    this.maxZoom = config.maxZoom;
    this.rootZoom = config.rootZoom;
    this.roots = config.rootTiles.map(
      ({ x, y }) => new TerrainNode(x, y, config.rootZoom),
    );
  }

  /** Streams/refines tiles for the current camera view. Call once per frame. */
  update(camera: THREE.Camera): void {
    if (this.disposed) {
      return;
    }
    this.tick++;
    this.cameraUniform.value.copy(camera.position);
    this.projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    this.pendingLoads.length = 0;
    for (const root of this.roots) {
      this.refine(root, camera.position);
    }
    this.flushLoads();

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
   * Selects the right LOD for a node and queues the tiles it needs. Returns
  /**
   * Selects the LOD for a node and queues the tiles it needs. Returns whether
   * this subtree is fully covered by loaded geometry, so a parent knows whether
   * it must keep showing itself as a fallback.
   *
   * No-blank refinement: every level along the path streams in parallel rather
   * than one level per round-trip, but a node keeps showing the finest geometry
   * it has loaded until *all* of its in-view children are ready — then it hides
   * and the children take over in the same frame. So zooming in never drops to a
   * blank: the current surface stays put (and sharpens progressively) until its
   * replacement is ready. Combined with the CDLOD vertex morph, swaps are
   * seamless.
   *
   * Loading is gated by the (margin-inflated) view frustum and a horizon test so
   * only tiles near the visible near-side of the globe stream in.
   */
  private refine(node: TerrainNode, cameraPosition: THREE.Vector3): boolean {
    node.lastUsedTick = this.tick;

    // Horizon cull: discard tiles on the far side of the globe. With a far plane
    // of ~1e9 the view cone passes through the planet and fans out enormously on
    // the far side, so frustum culling alone would pull in tiles a hemisphere
    // away. A surface point P (|P| = R, earth centred at origin) is on the
    // visible cap when dot(P, camera) >= R^2; relaxing the threshold by the
    // tile's radius keeps large/limb tiles whose near edge is still visible.
    // Off-view tiles count as "covered" (true) so a parent never shows a coarse
    // fallback just because some of its children lie outside the view.
    const horizonDot = node.centerWorld.dot(cameraPosition);
    const horizonThreshold = EARTH_RADIUS * (EARTH_RADIUS - node.radius);
    if (horizonDot < horizonThreshold) {
      if (node.mesh) {
        node.mesh.visible = false;
      }
      this.hideChildren(node);
      return true;
    }

    // Loading is gated by the frustum inflated by a margin so a thin ring of
    // tiles just outside the view pre-loads for smooth panning. Anything well
    // outside the view is neither drawn nor streamed.
    this.cullSphere.set(node.centerWorld, node.radius * LOAD_MARGIN);
    if (!this.frustum.intersectsSphere(this.cullSphere)) {
      if (node.mesh) {
        node.mesh.visible = false;
      }
      this.hideChildren(node);
      return true;
    }

    this.cullSphere.set(node.centerWorld, node.radius);
    const inFrustum = this.frustum.intersectsSphere(this.cullSphere);
    const distance = cameraPosition.distanceTo(node.centerWorld);

    // This node is a candidate to draw, so make sure it is (being) loaded; it
    // doubles as the fallback for its area until any finer children arrive.
    this.requestLoad(node, distance);

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

    // Leaf for now: nothing finer is wanted here, so just draw this level.
    if (!wantSubdivide) {
      this.hideChildren(node);
      if (node.mesh) {
        node.mesh.visible = node.loaded && inFrustum;
      }
      return node.loaded;
    }

    // Subdividing: descend and stream the children straight away, even if this
    // node hasn't loaded yet. Every level on the path is requested in parallel
    // (capped per frame), so the view jumps toward the target resolution instead
    // of climbing one level per network round-trip. Children render only once
    // *all* of them are ready, so we never show a half-built finer level over the
    // coarse fallback (which would z-fight); until then the finest already-loaded
    // ancestor stays visible.
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

    this.hideChildren(node);
    if (node.mesh) {
      node.mesh.visible = node.loaded && inFrustum;
    }
    return node.loaded;
  }

  /** Queues a tile to load this frame (deduplicated by the requested flag). */
  private requestLoad(node: TerrainNode, distance: number): void {
    if (node.requested) {
      return;
    }
    this.pendingLoads.push({ node, z: node.z, distance });
  }

  /**
   * Issues up to MAX_LOADS_PER_UPDATE queued loads, coarsest-then-nearest first,
   * so coverage appears quickly and the rest defer to later frames. Tiles left
   * unissued keep their requested flag clear and are simply re-queued next frame.
   */
  private flushLoads(): void {
    if (this.pendingLoads.length === 0) {
      return;
    }
    this.pendingLoads.sort((a, b) => a.z - b.z || a.distance - b.distance);
    const limit = Math.min(this.pendingLoads.length, MAX_LOADS_PER_UPDATE);
    for (let i = 0; i < limit; i++) {
      this.ensureLoaded(this.pendingLoads[i].node);
    }
    this.pendingLoads.length = 0;
  }

  private ensureChildren(node: TerrainNode): void {
    if (node.children) {
      return;
    }
    const z = node.z + 1;
    const bx = node.x * 2;
    const by = node.y * 2;
    node.children = [
      new TerrainNode(bx, by, z),
      new TerrainNode(bx + 1, by, z),
      new TerrainNode(bx, by + 1, z),
      new TerrainNode(bx + 1, by + 1, z),
    ];
  }

  private ensureLoaded(node: TerrainNode): void {
    if (node.requested) {
      return;
    }
    node.requested = true;
    const { ex, ey, ez } = elevationTileFor(
      node.x,
      node.y,
      node.z,
      ELEVATION_MAX_ZOOM,
    );
    const imageUrl = getMapTileUrl(this.mapType, node.x, node.y, node.z);
    Promise.all([
      loadHeightTileCached(ex, ey, ez),
      loadTexture(imageUrl),
    ]).then(([tile, texture]) => {
      if (this.disposed) {
        texture?.dispose();
        return;
      }
      const mesh = buildTileMesh(
        node.x,
        node.y,
        node.z,
        { tile, ex, ey, ez },
        texture,
        node.worldSize * SUBDIVIDE_IN,
        node.worldSize * SUBDIVIDE_OUT,
        this.cameraUniform,
      );
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
