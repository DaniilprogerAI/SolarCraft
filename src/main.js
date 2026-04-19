import * as THREE from 'three';
import { World, CHUNK, SEA_LEVEL } from './world.js';
import { Player } from './player.js';
import { Hotbar } from './ui.js';
import { AIR, BLOCKS, LANTERN, SOLAR } from './blocks.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfad9a3);
scene.fog = new THREE.Fog(0xfad9a3, 70, 220);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.1,
  500,
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Lighting ---------------------------------------------------------------
// Warm late-afternoon solarpunk atmosphere: amber sun, soft sky + ground
// hemisphere, and subtle ambient fill.

const hemi = new THREE.HemisphereLight(0xf6d59a, 0x3e5a3c, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0c8, 1.35);
sun.position.set(40, 80, 30);
scene.add(sun);

const ambient = new THREE.AmbientLight(0x8aa697, 0.25);
scene.add(ambient);

// ---- World ------------------------------------------------------------------

const world = new World(scene, { radius: 5, seed: 20250419 });

const loadingEl = document.getElementById('loading');
const startEl = document.getElementById('start');
const startBtn = document.getElementById('startBtn');

function generate() {
  return new Promise((resolve) => {
    // Run generation in microtask chunks to keep the button responsive.
    setTimeout(() => {
      world.generate((p) => {
        loadingEl.textContent = `Generating terrain… ${Math.round(p * 100)}%`;
      });
      loadingEl.textContent = 'Meshing chunks…';
      // Mesh all chunks immediately before first frame.
      let passes = 0;
      while (true) {
        let dirtyCount = 0;
        for (const c of world.chunks.values()) if (c.dirty) dirtyCount++;
        if (dirtyCount === 0) break;
        world.rebuildDirtyChunks(50);
        passes++;
        if (passes > 2000) break;
      }
      loadingEl.textContent = 'Ready.';
      resolve();
    }, 30);
  });
}

// ---- Player -----------------------------------------------------------------

const player = new Player(camera, world, renderer.domElement);

// ---- Hotbar -----------------------------------------------------------------

const hotbarEl = document.getElementById('hotbar');
const hotbar = new Hotbar(hotbarEl);

// Selection highlight outline (the block the player is targeting).
const highlightGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
const highlightEdges = new THREE.EdgesGeometry(highlightGeo);
const highlight = new THREE.LineSegments(
  highlightEdges,
  new THREE.LineBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.85 }),
);
highlight.visible = false;
scene.add(highlight);

// ---- Dynamic lanterns -------------------------------------------------------
// A couple of point lights near spawn lanterns for atmospheric glow.
function addLanternLights() {
  const positions = [
    [-2, 0, -2],
    [2, 0, -2],
    [-2, 0, 2],
    [2, 0, 2],
  ];
  // Place them at the same y as the lanterns we built above ground height.
  for (let y = 63; y >= 0; y--) {
    if (world.getBlock(-2, y, -2) === LANTERN) {
      for (const [dx, _dy, dz] of positions) {
        const light = new THREE.PointLight(0xffc27a, 1.1, 14, 1.8);
        light.position.set(dx + 0.5, y + 0.5, dz + 0.5);
        scene.add(light);
      }
      break;
    }
  }
}

// ---- Targeting --------------------------------------------------------------

function currentRay() {
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return { origin, dir };
}

function updateHighlight() {
  const { origin, dir } = currentRay();
  const hit = world.raycast(origin, dir, 6);
  if (hit.hit) {
    highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    highlight.visible = true;
  } else {
    highlight.visible = false;
  }
}

function handleClick(button) {
  const { origin, dir } = currentRay();
  const hit = world.raycast(origin, dir, 6);
  if (!hit.hit) return;
  if (button === 0) {
    // Break
    world.setBlock(hit.x, hit.y, hit.z, AIR);
  } else if (button === 2) {
    // Place
    const px = hit.x + hit.nx;
    const py = hit.y + hit.ny;
    const pz = hit.z + hit.nz;
    if (world.getBlock(px, py, pz) !== AIR) return;
    // Avoid placing inside the player's bounding box.
    const pxMin = px,
      pxMax = px + 1;
    const pyMin = py,
      pyMax = py + 1;
    const pzMin = pz,
      pzMax = pz + 1;
    const feet = player.position;
    const mnx = feet.x - 0.3,
      mxx = feet.x + 0.3;
    const mny = feet.y,
      mxy = feet.y + 1.7;
    const mnz = feet.z - 0.3,
      mxz = feet.z + 0.3;
    const overlap =
      mxx > pxMin &&
      mnx < pxMax &&
      mxy > pyMin &&
      mny < pyMax &&
      mxz > pzMin &&
      mnz < pzMax;
    if (overlap) return;
    world.setBlock(px, py, pz, hotbar.currentBlock());
  }
}

renderer.domElement.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  handleClick(e.button);
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

// Hotbar keys & wheel.
document.addEventListener('keydown', (e) => {
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= 9) hotbar.select(n - 1);
  }
});
document.addEventListener('wheel', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  hotbar.cycle(e.deltaY > 0 ? 1 : -1);
});

// ---- FPS meter --------------------------------------------------------------

const fpsEl = document.getElementById('fps');
let fpsAccum = 0;
let fpsFrames = 0;
let fpsLastTime = performance.now();

// ---- Main loop --------------------------------------------------------------

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  player.update(dt);
  updateHighlight();

  // Amortized chunk rebuilds in case something gets marked dirty.
  world.rebuildDirtyChunks(4);

  // Subtle sun drift so shadows feel alive (no actual shadow map to keep
  // things light, but the sun colour shifts slightly with time).
  const t = now * 0.00004;
  sun.position.set(
    Math.cos(t) * 80,
    70 + Math.sin(t * 0.5) * 15,
    Math.sin(t) * 80,
  );

  renderer.render(scene, camera);

  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`;
    fpsAccum = 0;
    fpsFrames = 0;
  }

  requestAnimationFrame(loop);
}

// ---- Kickoff ----------------------------------------------------------------

(async function init() {
  await generate();
  player.spawnAt(0, 6); // south of the atrium so it's visible
  player.yaw = 0;
  player.pitch = -0.15;
  addLanternLights();

  startBtn.disabled = false;
  startBtn.addEventListener('click', () => {
    startEl.classList.add('hidden');
    document.getElementById('hud').style.display = '';
    document.getElementById('fps').style.display = '';
    document.getElementById('crosshair').style.display = '';
    document.getElementById('hotbar').style.display = '';
    renderer.domElement.requestPointerLock();
    setTimeout(() => startEl.remove(), 500);
  });

  requestAnimationFrame(loop);
})();
