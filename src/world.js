// Chunked voxel world with terrain generation and per-chunk meshing.

import * as THREE from 'three';
import {
  AIR,
  GRASS,
  DIRT,
  STONE,
  WOOD,
  LEAVES,
  GLASS,
  SOLAR,
  LANTERN,
  FLOWERS,
  TERRACOTTA,
  WATER,
  SAND,
  MOSS,
  PLANKS,
  BLOCKS,
  isOpaque,
} from './blocks.js';
import { makeNoise } from './noise.js';

export const CHUNK = 16;
export const WORLD_HEIGHT = 64;
export const CHUNKS_Y = Math.ceil(WORLD_HEIGHT / CHUNK);
export const SEA_LEVEL = 20;

const FACES = [
  // +X (east)
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
  },
  // -X (west)
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  // +Y (top)
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  // -Y (bottom)
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  // +Z (south)
  {
    dir: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ],
  },
  // -Z (north)
  {
    dir: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
];

function chunkKey(cx, cy, cz) {
  return `${cx},${cy},${cz}`;
}

export class World {
  constructor(scene, { radius = 5, seed = 1337 } = {}) {
    this.scene = scene;
    this.radius = radius; // chunks in each horizontal direction from origin
    this.seed = seed;
    this.noise = makeNoise(seed);

    this.chunks = new Map(); // key -> { data: Uint8Array, mesh, transMesh, dirty }
    this.opaqueMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
    });
    this.transparentMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.root = new THREE.Group();
    this.root.name = 'world';
    scene.add(this.root);

    this.generated = false;
  }

  // Convert world coords to chunk + local coords.
  static toChunk(x, y, z) {
    return {
      cx: Math.floor(x / CHUNK),
      cy: Math.floor(y / CHUNK),
      cz: Math.floor(z / CHUNK),
      lx: ((x % CHUNK) + CHUNK) % CHUNK,
      ly: ((y % CHUNK) + CHUNK) % CHUNK,
      lz: ((z % CHUNK) + CHUNK) % CHUNK,
    };
  }

  getChunk(cx, cy, cz, create = false) {
    const key = chunkKey(cx, cy, cz);
    let c = this.chunks.get(key);
    if (!c && create) {
      c = { data: new Uint8Array(CHUNK * CHUNK * CHUNK), mesh: null, transMesh: null, dirty: true };
      this.chunks.set(key, c);
    }
    return c;
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const { cx, cy, cz, lx, ly, lz } = World.toChunk(x, y, z);
    const c = this.getChunk(cx, cy, cz, false);
    if (!c) return AIR;
    return c.data[lx + CHUNK * (ly + CHUNK * lz)];
  }

  setBlock(x, y, z, id, { markDirty = true } = {}) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const { cx, cy, cz, lx, ly, lz } = World.toChunk(x, y, z);
    const c = this.getChunk(cx, cy, cz, true);
    const idx = lx + CHUNK * (ly + CHUNK * lz);
    if (c.data[idx] === id) return;
    c.data[idx] = id;
    if (!markDirty) return;
    c.dirty = true;
    // Mark neighbor chunks dirty when on border.
    if (lx === 0) this._markDirty(cx - 1, cy, cz);
    if (lx === CHUNK - 1) this._markDirty(cx + 1, cy, cz);
    if (ly === 0) this._markDirty(cx, cy - 1, cz);
    if (ly === CHUNK - 1) this._markDirty(cx, cy + 1, cz);
    if (lz === 0) this._markDirty(cx, cy, cz - 1);
    if (lz === CHUNK - 1) this._markDirty(cx, cy, cz + 1);
  }

  _markDirty(cx, cy, cz) {
    const c = this.getChunk(cx, cy, cz, false);
    if (c) c.dirty = true;
  }

  // ---- Terrain generation -------------------------------------------------

  generate(onProgress) {
    const R = this.radius;
    const total = (2 * R + 1) * (2 * R + 1);
    let done = 0;
    const xMin = -R * CHUNK;
    const xMax = R * CHUNK + CHUNK - 1;
    const zMin = -R * CHUNK;
    const zMax = R * CHUNK + CHUNK - 1;

    // Columnwise generation for speed and simpler code.
    for (let cx = -R; cx <= R; cx++) {
      for (let cz = -R; cz <= R; cz++) {
        for (let cy = 0; cy < CHUNKS_Y; cy++) {
          this.getChunk(cx, cy, cz, true);
        }
      }
    }

    const trees = [];
    for (let x = xMin; x <= xMax; x++) {
      for (let z = zMin; z <= zMax; z++) {
        const h = this._heightAt(x, z);
        const biome = this._biomeAt(x, z);
        for (let y = 0; y <= h; y++) {
          let block = STONE;
          if (y === h) {
            if (h <= SEA_LEVEL) block = SAND;
            else if (biome > 0.62) block = MOSS;
            else block = GRASS;
          } else if (y > h - 4) {
            block = DIRT;
          }
          this.setBlock(x, y, z, block, { markDirty: false });
        }
        // Water up to sea level.
        if (h < SEA_LEVEL) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) {
            this.setBlock(x, y, z, WATER, { markDirty: false });
          }
        }
        // Flowers & surface decor on lush grass above sea level.
        if (h > SEA_LEVEL && h < WORLD_HEIGHT - 8) {
          const surface = h;
          const rnd = this._hash(x * 73856093 ^ z * 19349663);
          if (biome < 0.5 && rnd < 0.035) {
            this.setBlock(x, surface, z, FLOWERS, { markDirty: false });
          }
          // Sprinkle trees; collected and grown after so canopies don't get
          // clipped by the pass that sets leaves first.
          if (
            biome < 0.7 &&
            rnd > 0.97 &&
            h > SEA_LEVEL + 1 &&
            h < WORLD_HEIGHT - 12
          ) {
            trees.push([x, surface + 1, z]);
          }
        }
      }
      if (onProgress && x % 4 === 0) {
        onProgress((x - xMin) / (xMax - xMin));
      }
    }

    // Grow trees.
    for (const [tx, ty, tz] of trees) {
      this._growTree(tx, ty, tz);
    }

    // Place a few solarpunk landmarks near origin.
    this._buildLandmarks();

    // Mark all chunks dirty for meshing.
    for (const c of this.chunks.values()) c.dirty = true;
    this.generated = true;
    if (onProgress) onProgress(1);
  }

  _heightAt(x, z) {
    const n = this.noise;
    // Large rolling base plus finer detail.
    const base = n.fbm2D(x * 0.012, z * 0.012, 4, 2.1, 0.55);
    const detail = n.fbm2D(x * 0.05, z * 0.05, 3, 2.0, 0.5);
    const ridges = Math.pow(
      1 - Math.abs(n.fbm2D(x * 0.02 + 31, z * 0.02 - 17, 3, 2, 0.5) - 0.5) * 2,
      2,
    );
    const h = SEA_LEVEL + base * 20 + detail * 4 + ridges * 6 - 3;
    return Math.max(1, Math.min(WORLD_HEIGHT - 1, Math.floor(h)));
  }

  _biomeAt(x, z) {
    return this.noise.fbm2D(x * 0.008 + 101, z * 0.008 - 57, 3, 2, 0.5);
  }

  _hash(i) {
    let x = (i | 0) ^ 2147483647;
    x = (x ^ (x >>> 15)) * 0x2c1b3c6d;
    x = (x ^ (x >>> 12)) * 0x297a2d39;
    x = x ^ (x >>> 15);
    return ((x >>> 0) % 10000) / 10000;
  }

  _growTree(x, y, z) {
    const h = 4 + Math.floor(this._hash(x * 374761393 ^ z * 668265263) * 3);
    for (let dy = 0; dy < h; dy++) {
      this.setBlock(x, y + dy, z, WOOD, { markDirty: false });
    }
    const cy = y + h - 1;
    const r = 2;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dy = -1; dy <= 2; dy++) {
          const d2 = dx * dx + dz * dz + dy * dy;
          if (d2 > r * r + 1) continue;
          const tx = x + dx,
            ty = cy + dy,
            tz = z + dz;
          if (this.getBlock(tx, ty, tz) === AIR) {
            this.setBlock(tx, ty, tz, LEAVES, { markDirty: false });
          }
        }
      }
    }
    // Top tuft.
    this.setBlock(x, y + h + 1, z, LEAVES, { markDirty: false });
  }

  _buildLandmarks() {
    // A small terrace with a glass atrium, solar roof and lanterns to
    // immediately convey the solarpunk vibe near spawn.
    const findGround = (x, z) => {
      for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
        const b = this.getBlock(x, y, z);
        if (b !== AIR && b !== WATER && b !== LEAVES) return y;
      }
      return 0;
    };

    const cx = 0,
      cz = 0;
    const base = findGround(cx, cz);
    // Terrace floor 5x5 terracotta.
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        this.setBlock(cx + dx, base, cz + dz, TERRACOTTA, { markDirty: false });
      }
    }
    // Planks walls 1 high + glass corners.
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
          const mat =
            (Math.abs(dx) === 2 && Math.abs(dz) === 2) ||
            (dx === 0 && Math.abs(dz) === 2) ||
            (dz === 0 && Math.abs(dx) === 2)
              ? GLASS
              : PLANKS;
          this.setBlock(cx + dx, base + 1, cz + dz, mat, { markDirty: false });
          this.setBlock(cx + dx, base + 2, cz + dz, GLASS, { markDirty: false });
        }
      }
    }
    // Leave a doorway on the south side.
    this.setBlock(cx, base + 1, cz + 2, AIR, { markDirty: false });
    this.setBlock(cx, base + 2, cz + 2, AIR, { markDirty: false });
    // Solar roof (panels) 5x5.
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        this.setBlock(cx + dx, base + 3, cz + dz, SOLAR, { markDirty: false });
      }
    }
    // Lanterns hanging at four corners.
    this.setBlock(cx - 2, base + 3, cz - 2, LANTERN, { markDirty: false });
    this.setBlock(cx + 2, base + 3, cz - 2, LANTERN, { markDirty: false });
    this.setBlock(cx - 2, base + 3, cz + 2, LANTERN, { markDirty: false });
    this.setBlock(cx + 2, base + 3, cz + 2, LANTERN, { markDirty: false });
    // Flower bed outside the doorway.
    for (let dx = -2; dx <= 2; dx++) {
      this.setBlock(cx + dx, base + 1, cz + 4, FLOWERS, { markDirty: false });
    }
  }

  // ---- Meshing ------------------------------------------------------------

  rebuildDirtyChunks(budgetMs = 8) {
    const start = performance.now();
    for (const [key, c] of this.chunks) {
      if (!c.dirty) continue;
      this._buildChunkMesh(key, c);
      c.dirty = false;
      if (performance.now() - start > budgetMs) break;
    }
  }

  _buildChunkMesh(key, c) {
    const [cxs, cys, czs] = key.split(',');
    const cx = +cxs,
      cy = +cys,
      cz = +czs;

    // Two buffers: opaque + transparent.
    const op = { pos: [], norm: [], col: [], idx: [] };
    const tr = { pos: [], norm: [], col: [], idx: [] };

    for (let lx = 0; lx < CHUNK; lx++) {
      for (let ly = 0; ly < CHUNK; ly++) {
        for (let lz = 0; lz < CHUNK; lz++) {
          const id = c.data[lx + CHUNK * (ly + CHUNK * lz)];
          if (id === AIR) continue;
          const def = BLOCKS[id];
          if (!def) continue;
          const wx = cx * CHUNK + lx;
          const wy = cy * CHUNK + ly;
          const wz = cz * CHUNK + lz;
          const bucket = def.transparent ? tr : op;
          for (let f = 0; f < 6; f++) {
            const dir = FACES[f].dir;
            const nx = wx + dir[0],
              ny = wy + dir[1],
              nz = wz + dir[2];
            const nid = this.getBlock(nx, ny, nz);
            // Draw face if neighbor is not an opaque block, and (for
            // transparent blocks) not the same transparent block.
            if (isOpaque(nid)) continue;
            if (def.transparent && nid === id) continue;

            const faceColor = def.faces[f];
            const baseIdx = bucket.pos.length / 3;
            const corners = FACES[f].corners;
            for (let v = 0; v < 4; v++) {
              const [ox, oy, oz] = corners[v];
              bucket.pos.push(wx + ox, wy + oy, wz + oz);
              bucket.norm.push(dir[0], dir[1], dir[2]);
              // Slight AO-ish tint for bottom faces to add depth.
              let rMul = 1,
                gMul = 1,
                bMul = 1;
              if (f === 3) {
                rMul = gMul = bMul = 0.82;
              } else if (f === 1 || f === 5) {
                rMul = gMul = bMul = 0.92;
              } else if (f === 0 || f === 4) {
                rMul = gMul = bMul = 0.97;
              }
              // Emissive blocks: boost color.
              if (def.emissive !== undefined) {
                const boost = 1 + (def.emissiveIntensity ?? 0.6);
                rMul *= boost;
                gMul *= boost;
                bMul *= boost;
              }
              bucket.col.push(
                faceColor.r * rMul,
                faceColor.g * gMul,
                faceColor.b * bMul,
              );
            }
            bucket.idx.push(
              baseIdx,
              baseIdx + 1,
              baseIdx + 2,
              baseIdx,
              baseIdx + 2,
              baseIdx + 3,
            );
          }
        }
      }
    }

    const mkMesh = (data, material) => {
      if (data.pos.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(data.pos, 3),
      );
      geo.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(data.norm, 3),
      );
      geo.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      geo.setIndex(data.idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = true;
      return mesh;
    };

    // Dispose prior meshes.
    if (c.mesh) {
      this.root.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh = null;
    }
    if (c.transMesh) {
      this.root.remove(c.transMesh);
      c.transMesh.geometry.dispose();
      c.transMesh = null;
    }

    const opaqueMesh = mkMesh(op, this.opaqueMat);
    const transMesh = mkMesh(tr, this.transparentMat);
    if (opaqueMesh) {
      this.root.add(opaqueMesh);
      c.mesh = opaqueMesh;
    }
    if (transMesh) {
      transMesh.renderOrder = 2;
      this.root.add(transMesh);
      c.transMesh = transMesh;
    }
  }

  // ---- Voxel raycast (DDA) ------------------------------------------------
  //
  // Returns { hit:true, x,y,z, nx,ny,nz } for the first solid voxel within
  // maxDist from (origin) along (dir). nx,ny,nz is the unit normal of the
  // face that was crossed.
  raycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin.x),
      y = Math.floor(origin.y),
      z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x),
      stepY = Math.sign(dir.y),
      stepZ = Math.sign(dir.z);
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
    const nextBoundary = (o, step) =>
      step > 0 ? Math.floor(o) + 1 - o : o - Math.floor(o);
    let tMaxX = stepX !== 0 ? nextBoundary(origin.x, stepX) * tDeltaX : Infinity;
    let tMaxY = stepY !== 0 ? nextBoundary(origin.y, stepY) * tDeltaY : Infinity;
    let tMaxZ = stepZ !== 0 ? nextBoundary(origin.z, stepZ) * tDeltaZ : Infinity;

    let t = 0;
    let face = [0, 0, 0];
    while (t <= maxDist) {
      const id = this.getBlock(x, y, z);
      const def = BLOCKS[id];
      if (id !== AIR && def && def.solid) {
        return {
          hit: true,
          x,
          y,
          z,
          nx: face[0],
          ny: face[1],
          nz: face[2],
          t,
        };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        face = [0, -stepY, 0];
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        face = [0, 0, -stepZ];
      }
    }
    return { hit: false };
  }
}
