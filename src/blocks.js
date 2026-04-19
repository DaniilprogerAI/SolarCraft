// Block palette for the solarpunk voxel world.
//
// Each block defines six per-face colors (or a single color used for all
// faces), plus a handful of gameplay flags. Faces order: +x, -x, +y, -y, +z, -z.

import * as THREE from 'three';

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const WOOD = 4;
export const LEAVES = 5;
export const GLASS = 6;
export const SOLAR = 7;
export const LANTERN = 8;
export const FLOWERS = 9;
export const TERRACOTTA = 10;
export const WATER = 11;
export const SAND = 12;
export const MOSS = 13;
export const PLANKS = 14;

function hex(c) {
  return new THREE.Color(c);
}

// Faces: +X (east), -X (west), +Y (top), -Y (bottom), +Z (south), -Z (north).
function sameFaces(c) {
  const col = hex(c);
  return [col, col, col, col, col, col];
}

function topSidesBottom(top, side, bottom) {
  const t = hex(top),
    s = hex(side),
    b = hex(bottom);
  return [s, s, t, b, s, s];
}

export const BLOCKS = {
  [GRASS]: {
    name: 'Lush Grass',
    faces: topSidesBottom(0x8fd26b, 0x6f8f4a, 0x6b4a2e),
    solid: true,
  },
  [DIRT]: {
    name: 'Dirt',
    faces: sameFaces(0x6b4a2e),
    solid: true,
  },
  [STONE]: {
    name: 'Warm Stone',
    faces: sameFaces(0xa7a094),
    solid: true,
  },
  [WOOD]: {
    name: 'Oak Log',
    faces: (() => {
      const side = hex(0x8b6a3f);
      const end = hex(0xc89a5d);
      return [side, side, end, end, side, side];
    })(),
    solid: true,
  },
  [PLANKS]: {
    name: 'Planks',
    faces: sameFaces(0xc59a63),
    solid: true,
  },
  [LEAVES]: {
    name: 'Canopy Leaves',
    faces: sameFaces(0x4fa861),
    solid: true,
    transparent: true,
    opacity: 0.94,
  },
  [GLASS]: {
    name: 'Tinted Glass',
    faces: sameFaces(0xa7e8d6),
    solid: true,
    transparent: true,
    opacity: 0.35,
  },
  [SOLAR]: {
    name: 'Solar Panel',
    faces: (() => {
      const side = hex(0x1a2a44);
      const top = hex(0x2e5aa6); // bluish panel face
      const bottom = hex(0x141a24);
      return [side, side, top, bottom, side, side];
    })(),
    solid: true,
    emissive: 0x1e3a6a,
    emissiveIntensity: 0.35,
  },
  [LANTERN]: {
    name: 'Glow Lantern',
    faces: sameFaces(0xffd27a),
    solid: true,
    emissive: 0xffb347,
    emissiveIntensity: 1.2,
  },
  [FLOWERS]: {
    name: 'Wildflowers',
    faces: topSidesBottom(0xc9e49b, 0x8fb36a, 0x6b4a2e),
    solid: true,
  },
  [TERRACOTTA]: {
    name: 'Terracotta',
    faces: sameFaces(0xc9663a),
    solid: true,
  },
  [WATER]: {
    name: 'Water',
    faces: sameFaces(0x3a8fb0),
    solid: false,
    transparent: true,
    opacity: 0.55,
  },
  [SAND]: {
    name: 'Sand',
    faces: sameFaces(0xe6cf92),
    solid: true,
  },
  [MOSS]: {
    name: 'Moss',
    faces: sameFaces(0x4f7a3a),
    solid: true,
  },
};

// Default hotbar order.
export const HOTBAR = [
  GRASS,
  LEAVES,
  WOOD,
  PLANKS,
  TERRACOTTA,
  GLASS,
  SOLAR,
  LANTERN,
  FLOWERS,
];

export function isSolid(id) {
  if (id === AIR) return false;
  const b = BLOCKS[id];
  return !!(b && b.solid);
}

// For meshing: treat transparent blocks as "not fully opaque" so we still draw
// faces between two different transparent blocks.
export function isOpaque(id) {
  if (id === AIR) return false;
  const b = BLOCKS[id];
  return !!(b && !b.transparent);
}
