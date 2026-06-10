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
// two thresholds stops tiles flip-flopping between resolutions — and flashing —
// while the camera hovers near the boundary. Smaller SUBDIVIDE_IN concentrates
// detail nearer the camera, so far fewer tiles are streamed for a given view.
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
// the rest defer to later frames. This caps requests-per-second and, combined
// with only ever loading roots + leaves, keeps the total bounded and convergent.
const MAX_LOADS_PER_UPDATE = 16;
// Deepest zoom the free Terrarium elevation dataset is sampled at. Display
// tiles beyond this reuse a sub-region of their nearest ancestor elevation tile,
// so geometry keeps streaming with imagery without extra elevation fetches.
const ELEVATION_MAX_ZOOM = 13;
// Each tile drops a short vertical "skirt" around its edges to fill the hairline
// cracks where neighbouring tiles meet at different elevation LODs. Kept very
// shallow so it stays tucked behind the surface as a thin filler rather than
// reading as a dark wall; scales gently with tile size.
const SKIRT_DEPTH_FRACTION = 0.006;
const SKIRT_DEPTH_MIN = 3;
const SKIRT_DEPTH_MAX = 150;

/** The elevation tile (and its coords) a node samples its heights from. */
interface NodeElevation {
  tile: HeightTile | null;
  ex: number;
  ey: number;
  ez: number;
}

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

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Builds a displaced terrain mesh for a single tile, draped with its imagery
 * and lifted onto elevation streamed for that tile's own LOD. A vertical skirt
 * is added around the edges so seams between tiles at differing elevation
 * resolutions are hidden rather than showing through to the base sphere.
 */
const buildTileMesh = (
  x: number,
  y: number,
  z: number,
  elevation: NodeElevation,
  texture: THREE.Texture | null,
): THREE.Mesh => {
  const verts = TILE_SEGMENTS + 1;
  const { tile, ex, ey, ez } = elevation;

  const positions: number[] = [];
  const uvs: number[] = [];
  // Retained per grid vertex so the skirt ring can be dropped from the edges.
  const gridLat: number[] = [];
  const gridLong: number[] = [];
  const gridElev: number[] = [];

  for (let j = 0; j < verts; j++) {
    const fracY = j / TILE_SEGMENTS;
    const latitude = tileYToLatitude(y + fracY, z);
    for (let i = 0; i < verts; i++) {
      const fracX = i / TILE_SEGMENTS;
      const longitude = tileXToLongitude(x + fracX, z);
      const elev = sampleTileElevation(tile, ex, ey, ez, latitude, longitude);
      const point = latLongToCartesian(latitude, longitude, elev);

      positions.push(point.x, point.y, point.z);
      // Tile row 0 is the northern edge; with flipY textures that maps to v = 1.
      uvs.push(fracX, 1 - fracY);
      gridLat.push(latitude);
      gridLong.push(longitude);
      gridElev.push(elev);
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

  // Skirt depth scales gently with the tile's world size (its diagonal).
  const first = latLongToCartesian(gridLat[0], gridLong[0], gridElev[0]);
  const lastIndex = verts * verts - 1;
  const last = latLongToCartesian(
    gridLat[lastIndex],
    gridLong[lastIndex],
    gridElev[lastIndex],
  );
  const skirtDepth = clamp(
    first.distanceTo(last) * SKIRT_DEPTH_FRACTION,
    SKIRT_DEPTH_MIN,
    SKIRT_DEPTH_MAX,
  );

  // Each skirt vertex is paired with the surface vertex it hangs from, so its
  // normal can later be copied from that vertex. Without this the vertical walls
  // get sideways normals and shade as dark lines, producing a visible grid.
  const skirtPairs: Array<[skirt: number, top: number]> = [];

  const addSkirtEdge = (gridIndexAt: (k: number) => number): void => {
    let prevTop = -1;
    let prevBottom = -1;
    for (let k = 0; k < verts; k++) {
      const gi = gridIndexAt(k);
      const dropped = latLongToCartesian(
        gridLat[gi],
        gridLong[gi],
        gridElev[gi] - skirtDepth,
      );
      const bottom = positions.length / 3;
      positions.push(dropped.x, dropped.y, dropped.z);
      uvs.push(uvs[gi * 2], uvs[gi * 2 + 1]);
      skirtPairs.push([bottom, gi]);
      if (k > 0) {
        indices.push(prevTop, prevBottom, gi, gi, prevBottom, bottom);
      }
      prevTop = gi;
      prevBottom = bottom;
    }
  };

  addSkirtEdge((k) => k); // North edge (top row).
  addSkirtEdge((k) => TILE_SEGMENTS * verts + k); // South edge (bottom row).
  addSkirtEdge((k) => k * verts); // West edge (left column).
  addSkirtEdge((k) => k * verts + TILE_SEGMENTS); // East edge (right column).

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array(uvs), 2),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Make skirts shade like the surface edge they descend from, so they blend in
  // as crack fillers rather than appearing as dark vertical walls.
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
  for (const [skirt, top] of skirtPairs) {
    normals.setXYZ(skirt, normals.getX(top), normals.getY(top), normals.getZ(top));
  }
  normals.needsUpdate = true;

  const material = new THREE.MeshStandardMaterial({
    map: texture ?? undefined,
    color: texture ? 0xffffff : 0x808080,
    roughness: 1,
    metalness: 0,
    // Skirts are seen edge-on from either side, so render both faces.
    side: THREE.DoubleSide,
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
   * whether this subtree is fully covered by loaded leaf geometry (so a parent
   * knows it can hide its coarse fallback).
   *
   * To keep request counts low, only two kinds of tile are ever loaded: roots
   * (a cheap, always-available coarse fallback) and the chosen-LOD leaves that
   * are actually drawn. The intermediate zoom levels between them are traversed
   * for LOD selection but never fetched — while leaves stream in, the coarse
   * root shows through underneath, then hides once its leaves have arrived.
   *
   * Loading is gated by the (margin-inflated) view frustum and a horizon test
   * so only tiles near the visible near-side of the globe stream in.
   */
  private refine(node: TerrainNode, cameraPosition: THREE.Vector3): boolean {
    node.lastUsedTick = this.tick;

    // Horizon cull: discard tiles on the far side of the globe. With a far plane
    // of ~1e9 the view cone passes through the planet and fans out enormously on
    // the far side, so frustum culling alone would pull in tiles a hemisphere
    // away. A surface point P (|P| = R, earth centred at origin) is on the
    // visible cap when dot(P, camera) >= R^2; relaxing the threshold by the
    // tile's radius keeps large/limb tiles whose near edge is still visible.
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
    const isRoot = node.z === this.rootZoom;

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
      if (isRoot) {
        // Keep the root loaded as the global coarse fallback, shown only where
        // its finer leaves have not yet arrived.
        this.requestLoad(node, distance);
        if (node.mesh) {
          node.mesh.visible = node.loaded && inFrustum && !allCovered;
        }
      } else if (node.mesh) {
        // Intermediate levels are traversed but never drawn or fetched.
        node.mesh.visible = false;
      }
      return allCovered;
    }

    // Chosen LOD leaf: the resolution actually drawn for this area.
    this.requestLoad(node, distance);
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
