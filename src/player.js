// First-person player with pointer-lock controls and AABB voxel collision.

import * as THREE from 'three';
import { BLOCKS, AIR } from './blocks.js';
import { WORLD_HEIGHT } from './world.js';

const PLAYER_HALF = 0.3; // half-width in X/Z
const PLAYER_FEET_TO_EYE = 1.6;
const PLAYER_HEAD_ABOVE_EYE = 0.1; // top of head above eye
const PLAYER_HEIGHT = PLAYER_FEET_TO_EYE + PLAYER_HEAD_ABOVE_EYE; // 1.7
const GRAVITY = 28;
const JUMP_SPEED = 9.2;
const WALK_SPEED = 5.4;
const RUN_SPEED = 8.5;
const FLY_SPEED = 11.5;
const FLY_FAST = 22;

export class Player {
  constructor(camera, world, domElement) {
    this.camera = camera;
    this.world = world;
    this.dom = domElement;

    this.yaw = 0;
    this.pitch = 0;
    this.position = new THREE.Vector3(0.5, 0, 0.5); // feet position
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.flying = false;
    this.sneaking = false;
    this.running = false;

    this.keys = new Set();
    this._setupInput();
  }

  // Spawn at the highest non-air column over (x, z).
  spawnAt(x, z) {
    const w = this.world;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const id = w.getBlock(x, y, z);
      if (id !== AIR) {
        this.position.set(x + 0.5, y + 1.01, z + 0.5);
        return;
      }
    }
    this.position.set(x + 0.5, 30, z + 0.5);
  }

  _setupInput() {
    const onKeyDown = (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyF') {
        this.flying = !this.flying;
        this.velocity.set(0, 0, 0);
      }
    };
    const onKeyUp = (e) => this.keys.delete(e.code);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.dom) return;
      const sens = 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      const lim = Math.PI / 2 - 0.01;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;
    });
  }

  get forward() {
    const f = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw),
    );
    return f;
  }
  get right() {
    return new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw),
    );
  }

  update(dt) {
    this.sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.running = this.keys.has('ControlLeft') || this.keys.has('ControlRight');

    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.add(this.forward);
    if (this.keys.has('KeyS')) move.sub(this.forward);
    if (this.keys.has('KeyD')) move.add(this.right);
    if (this.keys.has('KeyA')) move.sub(this.right);
    if (move.lengthSq() > 0) move.normalize();

    if (this.flying) {
      const speed = this.running ? FLY_FAST : FLY_SPEED;
      this.velocity.x = move.x * speed;
      this.velocity.z = move.z * speed;
      let vy = 0;
      if (this.keys.has('Space')) vy += speed;
      if (this.sneaking) vy -= speed;
      this.velocity.y = vy;
    } else {
      const speed = this.running ? RUN_SPEED : WALK_SPEED;
      this.velocity.x = move.x * speed;
      this.velocity.z = move.z * speed;
      // gravity
      this.velocity.y -= GRAVITY * dt;
      if (this.velocity.y < -55) this.velocity.y = -55;
      if (this.keys.has('Space') && this.onGround) {
        this.velocity.y = JUMP_SPEED;
        this.onGround = false;
      }
    }

    // Integrate with collision per-axis.
    const dx = this.velocity.x * dt;
    const dy = this.velocity.y * dt;
    const dz = this.velocity.z * dt;
    this._moveAxis('x', dx);
    this.onGround = false;
    this._moveAxis('y', dy);
    this._moveAxis('z', dz);

    // Clamp to world Y.
    if (this.position.y < -20) {
      this.spawnAt(0, 0);
      this.velocity.set(0, 0, 0);
    }

    // Update camera.
    const eye = this.position.clone();
    eye.y += PLAYER_FEET_TO_EYE;
    this.camera.position.copy(eye);
    const dir = new THREE.Vector3(
      Math.cos(this.pitch) * Math.sin(this.yaw) * -1,
      Math.sin(this.pitch),
      Math.cos(this.pitch) * Math.cos(this.yaw) * -1,
    );
    this.camera.lookAt(eye.clone().add(dir));
  }

  _moveAxis(axis, delta) {
    if (delta === 0) return;
    const sign = Math.sign(delta);
    let remaining = Math.abs(delta);
    const maxStep = 0.2;
    while (remaining > 0) {
      const step = Math.min(remaining, maxStep);
      remaining -= step;
      const next = this.position.clone();
      next[axis] += step * sign;
      if (this._collidesAt(next)) {
        if (axis === 'y') {
          if (sign < 0) {
            this.onGround = true;
          }
          this.velocity.y = 0;
        } else {
          this.velocity[axis] = 0;
        }
        return;
      }
      this.position[axis] = next[axis];
    }
  }

  _collidesAt(pos) {
    const minX = pos.x - PLAYER_HALF;
    const maxX = pos.x + PLAYER_HALF;
    const minY = pos.y;
    const maxY = pos.y + PLAYER_HEIGHT;
    const minZ = pos.z - PLAYER_HALF;
    const maxZ = pos.z + PLAYER_HALF;
    const fx0 = Math.floor(minX),
      fx1 = Math.floor(maxX - 0.0001);
    const fy0 = Math.floor(minY),
      fy1 = Math.floor(maxY - 0.0001);
    const fz0 = Math.floor(minZ),
      fz1 = Math.floor(maxZ - 0.0001);
    for (let x = fx0; x <= fx1; x++) {
      for (let y = fy0; y <= fy1; y++) {
        for (let z = fz0; z <= fz1; z++) {
          const id = this.world.getBlock(x, y, z);
          if (id === AIR) continue;
          const def = BLOCKS[id];
          if (def && def.solid) return true;
        }
      }
    }
    return false;
  }
}
