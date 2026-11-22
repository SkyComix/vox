import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// ==========================================
// 1. AUDIO SYNTHESIZER (Web Audio API - Zero external audio files needed)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playShot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Punchy low-end thump
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    // Crisp noise crack
    const bufferSize = this.ctx.sampleRate * 0.09;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.4, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now);
  }

  playHit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.05);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playReload() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.45].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 320 : 520, now + offset);
      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.08);
    });
  }

  playEmpty() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }
}

const sfx = new SoundFX();

// ==========================================
// 2. SCENE, RENDERER & LIGHTING SETUP
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1522);
scene.fog = new THREE.FogExp2(0x0d1522, 0.014);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

// Lighting
const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.85);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
dirLight.position.set(35, 60, 30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 5;
dirLight.shadow.camera.far = 160;
const d = 55;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// ==========================================
// 3. TACTICAL ARENA & OBSTACLES (WITH COLLISION BOXES)
// ==========================================
const colliders = []; // Array of THREE.Box3 for physics & bullet blocking

function buildArena() {
  // Tactical Grid Floor
  const floorGeo = new THREE.PlaneGeometry(140, 140);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x182232,
    roughness: 0.85,
    metalness: 0.15
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(140, 70, 0x38bdf8, 0x26354d);
  grid.position.y = 0.02;
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  scene.add(grid);

  // Perimeter Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.3 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.5 });

  const createBox = (w, h, d, x, y, z, mat = wallMat, hasAccent = false) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    if (hasAccent) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.15, d + 0.06), accentMat);
      strip.position.set(x, y + h * 0.35, z);
      scene.add(strip);
    }

    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push(box);
    return mesh;
  };

  // Outer Arena Boundaries
  createBox(140, 8, 2, 0, 4, -70);
  createBox(140, 8, 2, 0, 4, 70);
  createBox(2, 8, 140, -70, 4, 0);
  createBox(2, 8, 140, 70, 4, 0);

  // Tactical Cover Blocks & Pillars
  const covers = [
    [6, 2.4, 2, 0, 1.2, -14, true],
    [6, 2.4, 2, 0, 1.2, 14, true],
    [2, 2.4, 6, -14, 1.2, 0, true],
    [2, 2.4, 6, 14, 1.2, 0, true],
    [4, 5, 4, -22, 2.5, -22, true],
    [4, 5, 4, 22, 2.5, -22, true],
    [4, 5, 4, -22, 2.5, 22, true],
    [4, 5, 4, 22, 2.5, 22, true],
    [8, 1.6, 2.5, -32, 0.8, 0, false],
    [8, 1.6, 2.5, 32, 0.8, 0, false],
    [2.5, 1.6, 8, 0, 0.8, -32, false],
    [2.5, 1.6, 8, 0, 0.8, 32, false],
    [5, 3.5, 5, -42, 1.75, -35, true],
    [5, 3.5, 5, 42, 1.75, 35, true],
  ];

  covers.forEach(([w, h, d, x, y, z, acc]) => createBox(w, h, d, x, y, z, wallMat, acc));
}

buildArena();

// ==========================================
// 4. THIRD-PERSON CHARACTER & RIFLE_ASSAULT_EAST.FBX
// ==========================================
const player = {
  group: new THREE.Group(),
  bodyGroup: new THREE.Group(),
  rightArm: null,
  leftArm: null,
  leftLeg: null,
  rightLeg: null,
  weaponSocket: new THREE.Group(),
  muzzlePoint: new THREE.Object3D(),
  position: new THREE.Vector3(0, 0, 24),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0.15,
  onGround: true,
  hp: 100,
  maxHp: 100,
  stamina: 100,
  isAiming: false,
  shoulderSide: 1, // 1 = right shoulder, -1 = left shoulder
  ammoMag: 30,
  magSize: 30,
  ammoReserve: 150,
  isReloading: false,
  fireCooldown: 0,
  walkTime: 0,
  recoilOffset: 0
};

function createFallbackRifle() {
  const gun = new THREE.Group();
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  const cyanTrim = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.72), darkMetal);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), darkMetal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, 0.48);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.12), darkMetal);
  mag.position.set(0, -0.14, 0.12);
  mag.rotation.x = 0.2;

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.14), cyanTrim);
  sight.position.set(0, 0.11, -0.05);

  gun.add(body, barrel, mag, sight);
  return gun;
}

function buildPlayerCharacter() {
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45, metalness: 0.3 });
  const darkSuit = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.8 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), armorMat);
  torso.position.y = 1.25;
  torso.castShadow = true;
  player.bodyGroup.add(torso);

  // Backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.2), darkSuit);
  pack.position.set(0, 1.3, -0.25);
  pack.castShadow = true;
  player.bodyGroup.add(pack);

  // Head & Tactical Helmet
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.38), armorMat);
  head.position.y = 1.88;
  head.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), visorMat);
  visor.position.set(0, 1.9, 0.18);
  player.bodyGroup.add(head, visor);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.22, 0.82, 0.24);
  player.leftLeg = new THREE.Mesh(legGeo, darkSuit);
  player.leftLeg.position.set(-0.17, 0.45, 0);
  player.leftLeg.castShadow = true;

  player.rightLeg = new THREE.Mesh(legGeo, darkSuit);
  player.rightLeg.position.set(0.17, 0.45, 0);
  player.rightLeg.castShadow = true;

  player.bodyGroup.add(player.leftLeg, player.rightLeg);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.18);
  player.leftArm = new THREE.Mesh(armGeo, darkSuit);
  player.leftArm.position.set(-0.42, 1.28, 0.15);
  player.leftArm.rotation.x = -Math.PI / 3;
  player.leftArm.rotation.z = -0.25;

  player.rightArm = new THREE.Mesh(armGeo, darkSuit);
  player.rightArm.position.set(0.42, 1.28, 0.15);
  player.rightArm.rotation.x = -Math.PI / 2.4;

  player.bodyGroup.add(player.leftArm, player.rightArm);

  // Weapon Socket attached to right hand area
  player.weaponSocket.position.set(0.38, 1.34, 0.38);
  player.muzzlePoint.position.set(0, 0.04, 0.72);
  player.weaponSocket.add(player.muzzlePoint);
  player.bodyGroup.add(player.weaponSocket);

  player.group.add(player.bodyGroup);
  player.group.position.copy(player.position);
  scene.add(player.group);

  // Load user's Rifle_Assault_East.fbx model
  const fbxStatus = document.getElementById('fbx-status');
  const loader = new FBXLoader();
  loader.load(
    './assets/Rifle_Assault_East.fbx',
    (fbx) => {
      // Auto-normalize scale & center of the imported FBX rifle
      const box = new THREE.Box3().setFromObject(fbx);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetLength = 0.95; // ~95 cm assault rifle
      const scaleFactor = targetLength / maxDim;
      fbx.scale.setScalar(scaleFactor);

      // Recompute bounds after scaling and align grip/center
      const scaledBox = new THREE.Box3().setFromObject(fbx);
      const center = new THREE.Vector3();
      scaledBox.getCenter(center);
      fbx.position.sub(center);
      fbx.position.z += 0.22;

      // Orient barrel along +Z forward direction if longest axis is X
      if (size.x > size.z) {
        fbx.rotation.y = Math.PI / 2;
      }

      fbx.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      player.weaponSocket.add(fbx);
      fbxStatus.textContent = '✓ Modelo 3D cargado: Rifle_Assault_East.fbx';
      fbxStatus.style.color = '#34d399';
      fbxStatus.style.borderColor = 'rgba(52, 211, 153, 0.4)';
    },
    undefined,
    (err) => {
      console.warn('No se pudo cargar Rifle_Assault_East.fbx (posible bloqueo file:// CORS). Usando modelo táctico integrado.', err);
      player.weaponSocket.add(createFallbackRifle());
      fbxStatus.textContent = 'Modelo integrado activo (abre con servidor HTTP local para cargar .fbx)';
      fbxStatus.style.color = '#fbbf24';
    }
  );
}

buildPlayerCharacter();

// ==========================================
// 5. PROJECTILES, TRACERS & PARTICLES
// ==========================================
const bullets = [];
const particles = [];

const bulletGeo = new THREE.SphereGeometry(0.06, 6, 6);
const playerBulletMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

function spawnBullet(origin, direction, isEnemy = false, speed = 75) {
  const mesh = new THREE.Mesh(bulletGeo, isEnemy ? enemyBulletMat : playerBulletMat);
  mesh.position.copy(origin);

  // Add glowing trail stretch
  const trailGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6);
  trailGeo.rotateX(Math.PI / 2);
  const trail = new THREE.Mesh(trailGeo, isEnemy ? enemyBulletMat : playerBulletMat);
  trail.position.z = -0.6;
  mesh.add(trail);
  mesh.lookAt(origin.clone().add(direction));

  scene.add(mesh);
  bullets.push({
    mesh,
    velocity: direction.clone().multiplyScalar(speed),
    isEnemy,
    life: 1.8
  });
}

function spawnImpactParticles(pos, colorHex = 0x38bdf8, count = 8) {
  const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const mat = new THREE.MeshBasicMaterial({ color: colorHex });
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(pos);
    scene.add(p);
    particles.push({
      mesh: p,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 9,
        Math.random() * 6 + 1,
        (Math.random() - 0.5) * 9
      ),
      life: 0.35 + Math.random() * 0.25
    });
  }
}

// ==========================================
// 6. ENEMY AI & WAVE SYSTEM
// ==========================================
const enemies = [];
let currentWave = 1;
let score = 0;
let waveTransition = false;

function createEnemy(spawnPos, isHeavy = false) {
  const group = new THREE.Group();
  const bodyColor = isHeavy ? 0xdc2626 : 0xf97316;
  const mat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const scale = isHeavy ? 1.25 : 1.0;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.85, 0.38), mat);
  torso.position.y = 1.25;
  torso.castShadow = true;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), darkMat);
  head.position.y = 1.9;
  head.castShadow = true;

  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.05), eyeMat);
  eye.position.set(0, 1.9, 0.2);

  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), darkMat);
  lLeg.position.set(-0.18, 0.4, 0);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), darkMat);
  rLeg.position.set(0.18, 0.4, 0);

  // Floating Health Bar above enemy
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide })
  );
  hpBg.position.y = 2.4;

  const hpFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.07),
    new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
  );
  hpFill.position.set(0, 2.4, 0.01);

  group.add(torso, head, eye, lLeg, rLeg, hpBg, hpFill);
  group.scale.setScalar(scale);
  group.position.copy(spawnPos);
  scene.add(group);

  const maxHp = isHeavy ? 160 : 85;
  enemies.push({
    group,
    hpFill,
    hpBg,
    hp: maxHp,
    maxHp,
    speed: isHeavy ? 3.8 : 5.4,
    shootTimer: 1.0 + Math.random() * 1.5,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: 2 + Math.random() * 2,
    isHeavy
  });
}

function startWave(waveNum) {
  currentWave = waveNum;
  document.getElementById('hud-wave').textContent = currentWave;

  const banner = document.getElementById('wave-banner');
  banner.textContent = `OLEADA ${currentWave}`;
  banner.classList.remove('hidden');
  banner.style.animation = 'none';
  banner.offsetHeight; // trigger reflow
  banner.style.animation = null;

  const enemyCount = 3 + waveNum * 2;
  for (let i = 0; i < enemyCount; i++) {
    const angle = (i / enemyCount) * Math.PI * 2;
    const radius = 32 + Math.random() * 24;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const isHeavy = waveNum >= 2 && i % 3 === 0;
    createEnemy(new THREE.Vector3(x, 0, z), isHeavy);
  }
  updateHud();
}

// ==========================================
// 7. INPUT HANDLING & POINTER LOCK
// ==========================================
const keys = {};
let isPlaying = false;
let isGameOver = false;
let mouseDown = false;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!isPlaying) return;

  if (e.code === 'KeyR') triggerReload();
  if (e.code === 'KeyC') player.shoulderSide *= -1;
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('mousedown', (e) => {
  if (!isPlaying) return;
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) player.isAiming = true;
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) player.isAiming = false;
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('mousemove', (e) => {
  if (!isPlaying || document.pointerLockElement !== renderer.domElement) return;
  const sensitivity = player.isAiming ? 0.0014 : 0.0024;
  player.yaw -= e.movementX * sensitivity;
  player.pitch += e.movementY * sensitivity;
  player.pitch = Math.max(-0.65, Math.min(0.85, player.pitch));
});

const startBtn = document.getElementById('start-btn');
const overlayScreen = document.getElementById('overlay-screen');
const hud = document.getElementById('hud');

startBtn.addEventListener('click', () => {
  sfx.init();
  if (isGameOver) {
    resetGame();
  }
  renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === renderer.domElement) {
    isPlaying = true;
    overlayScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    if (enemies.length === 0 && !waveTransition) {
      startWave(currentWave);
    }
  } else {
    isPlaying = false;
    mouseDown = false;
    player.isAiming = false;
    if (!isGameOver) {
      document.getElementById('screen-title').textContent = 'JUEGO EN PAUSA';
      document.getElementById('screen-subtitle').textContent = 'Haz clic en continuar para volver al combate.';
      startBtn.textContent = 'CONTINUAR';
      overlayScreen.classList.remove('hidden');
    }
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==========================================
// 8. COMBAT, RELOAD & HUD UPDATES
// ==========================================
function triggerReload() {
  if (player.isReloading || player.ammoMag === player.magSize || player.ammoReserve <= 0) return;
  player.isReloading = true;
  document.getElementById('reload-msg').classList.remove('hidden');
  sfx.playReload();

  setTimeout(() => {
    const needed = player.magSize - player.ammoMag;
    const toLoad = Math.min(needed, player.ammoReserve);
    player.ammoMag += toLoad;
    player.ammoReserve -= toLoad;
    player.isReloading = false;
    document.getElementById('reload-msg').classList.add('hidden');
    updateHud();
  }, 1150);
}

function getAimTargetPoint() {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  // Check enemies first
  const enemyMeshes = enemies.map((e) => e.group);
  const enemyHits = raycaster.intersectObjects(enemyMeshes, true);
  if (enemyHits.length > 0) {
    return enemyHits[0].point;
  }

  // Otherwise fallback point 80m ahead of camera
  const target = new THREE.Vector3();
  raycaster.ray.at(80, target);
  return target;
}

function shootPlayerWeapon() {
  if (player.isReloading || player.fireCooldown > 0) return;
  if (player.ammoMag <= 0) {
    sfx.playEmpty();
    player.fireCooldown = 0.25;
    triggerReload();
    return;
  }

  player.ammoMag--;
  player.fireCooldown = 0.115; // ~520 RPM automatic fire
  player.recoilOffset = 0.08;
  sfx.playShot();
  updateHud();

  // Muzzle world position
  const muzzleWorld = new THREE.Vector3();
  player.muzzlePoint.getWorldPosition(muzzleWorld);

  // Aim precisely toward center screen crosshair target
  const aimPoint = getAimTargetPoint();
  const spread = player.isAiming ? 0.004 : 0.016;
  const dir = aimPoint.sub(muzzleWorld).normalize();
  dir.x += (Math.random() - 0.5) * spread;
  dir.y += (Math.random() - 0.5) * spread;
  dir.z += (Math.random() - 0.5) * spread;
  dir.normalize();

  spawnBullet(muzzleWorld, dir, false, 95);
  spawnImpactParticles(muzzleWorld, 0xfbbf24, 3);

  // Expand crosshair briefly
  animateCrosshairSpread(14);
}

function animateCrosshairSpread(px) {
  const top = document.querySelector('.ch-top');
  const bottom = document.querySelector('.ch-bottom');
  const left = document.querySelector('.ch-left');
  const right = document.querySelector('.ch-right');
  top.style.transform = `translateY(-${px - 8}px)`;
  bottom.style.transform = `translateY(${px - 8}px)`;
  left.style.transform = `translateX(-${px - 8}px)`;
  right.style.transform = `translateX(${px - 8}px)`;
  setTimeout(() => {
    top.style.transform = '';
    bottom.style.transform = '';
    left.style.transform = '';
    right.style.transform = '';
  }, 80);
}

function showHitmarker() {
  const hm = document.getElementById('hitmarker');
  hm.classList.remove('hidden');
  sfx.playHit();
  setTimeout(() => hm.classList.add('hidden'), 110);
}

function damagePlayer(amount) {
  if (isGameOver) return;
  player.hp = Math.max(0, player.hp - amount);
  updateHud();

  const vig = document.getElementById('damage-vignette');
  vig.style.boxShadow = 'inset 0 0 110px rgba(239, 68, 68, 0.75)';
  setTimeout(() => {
    vig.style.boxShadow = 'inset 0 0 90px rgba(239, 68, 68, 0)';
  }, 220);

  if (player.hp <= 0) {
    isGameOver = true;
    document.exitPointerLock();
    document.getElementById('screen-title').textContent = 'MISIÓN FALLIDA';
    document.getElementById('screen-subtitle').textContent = `Sobreviviste hasta la Oleada ${currentWave} con ${score} puntos.`;
    startBtn.textContent = 'REINTENTAR';
    overlayScreen.classList.remove('hidden');
    hud.classList.add('hidden');
  }
}

function resetGame() {
  isGameOver = false;
  player.hp = 100;
  player.stamina = 100;
  player.ammoMag = 30;
  player.ammoReserve = 150;
  player.isReloading = false;
  player.position.set(0, 0, 24);
  player.yaw = 0;
  player.pitch = 0.15;
  score = 0;
  currentWave = 1;

  enemies.forEach((e) => scene.remove(e.group));
  enemies.length = 0;
  bullets.forEach((b) => scene.remove(b.mesh));
  bullets.length = 0;

  document.getElementById('reload-msg').classList.add('hidden');
  updateHud();
  startWave(1);
}

function updateHud() {
  document.getElementById('hp-text').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  document.getElementById('hp-bar').style.width = `${(player.hp / player.maxHp) * 100}%`;
  document.getElementById('stamina-text').textContent = `${Math.round(player.stamina)}%`;
  document.getElementById('stamina-bar').style.width = `${player.stamina}%`;
  document.getElementById('ammo-mag').textContent = player.ammoMag;
  document.getElementById('ammo-reserve').textContent = player.ammoReserve;
  document.getElementById('hud-enemies').textContent = enemies.length;
  document.getElementById('hud-score').textContent = score;
}

// ==========================================
// 9. COLLISION HELPER
// ==========================================
function resolveHorizontalCollisions(pos, radius = 0.55) {
  const playerBox = new THREE.Box3(
    new THREE.Vector3(pos.x - radius, pos.y + 0.1, pos.z - radius),
    new THREE.Vector3(pos.x + radius, pos.y + 1.9, pos.z + radius)
  );

  for (const box of colliders) {
    if (playerBox.intersectsBox(box)) {
      const overlapX1 = playerBox.max.x - box.min.x;
      const overlapX2 = box.max.x - playerBox.min.x;
      const overlapZ1 = playerBox.max.z - box.min.z;
      const overlapZ2 = box.max.z - playerBox.min.z;

      const minOverlapX = Math.min(overlapX1, overlapX2);
      const minOverlapZ = Math.min(overlapZ1, overlapZ2);

      if (minOverlapX < minOverlapZ) {
        pos.x += overlapX1 < overlapX2 ? -overlapX1 : overlapX2;
      } else {
        pos.z += overlapZ1 < overlapZ2 ? -overlapZ1 : overlapZ2;
      }
      playerBox.set(
        new THREE.Vector3(pos.x - radius, pos.y + 0.1, pos.z - radius),
        new THREE.Vector3(pos.x + radius, pos.y + 1.9, pos.z + radius)
      );
    }
  }
}

// ==========================================
// 10. MAIN GAME LOOP
// ==========================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (isPlaying && !isGameOver) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateParticles(dt);
  }

  renderer.render(scene, camera);
}

function updatePlayer(dt) {
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.recoilOffset > 0) player.recoilOffset = Math.max(0, player.recoilOffset - dt * 0.6);

  if (mouseDown) {
    shootPlayerWeapon();
  }

  // Movement vectors relative to camera yaw
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

  const moveDir = new THREE.Vector3();
  if (keys['KeyW']) moveDir.add(forward);
  if (keys['KeyS']) moveDir.sub(forward);
  if (keys['KeyD']) moveDir.add(right);
  if (keys['KeyA']) moveDir.sub(right);

  const isMoving = moveDir.lengthSq() > 0;
  if (isMoving) moveDir.normalize();

  // Sprint & Stamina
  const wantsSprint = keys['ShiftLeft'] && isMoving && !player.isAiming && player.stamina > 5;
  if (wantsSprint) {
    player.stamina = Math.max(0, player.stamina - 28 * dt);
  } else {
    player.stamina = Math.min(100, player.stamina + 18 * dt);
  }

  const speed = player.isAiming ? 4.2 : wantsSprint ? 10.5 : 6.8;
  player.position.addScaledVector(moveDir, speed * dt);

  // Jump & Gravity
  if (keys['Space'] && player.onGround) {
    player.velocity.y = 7.8;
    player.onGround = false;
  }
  player.velocity.y -= 20 * dt;
  player.position.y += player.velocity.y * dt;

  if (player.position.y <= 0) {
    player.position.y = 0;
    player.velocity.y = 0;
    player.onGround = true;
  }

  resolveHorizontalCollisions(player.position);
  player.group.position.copy(player.position);

  // Character faces camera aim direction smoothly
  player.group.rotation.y = player.yaw + Math.PI;

  // Procedural limb & weapon animation
  if (isMoving && player.onGround) {
    player.walkTime += dt * (wantsSprint ? 14 : 9);
    player.leftLeg.rotation.x = Math.sin(player.walkTime) * 0.55;
    player.rightLeg.rotation.x = -Math.sin(player.walkTime) * 0.55;
  } else {
    player.leftLeg.rotation.x *= 0.85;
    player.rightLeg.rotation.x *= 0.85;
  }

  // Weapon aim pitch & recoil kick
  player.weaponSocket.rotation.x = player.pitch - player.recoilOffset;
  player.weaponSocket.position.z = 0.38 - player.recoilOffset * 0.4;

  // Over-the-shoulder Third-Person Camera
  const targetFov = player.isAiming ? 46 : 65;
  camera.fov += (targetFov - camera.fov) * 12 * dt;
  camera.updateProjectionMatrix();

  const camDist = player.isAiming ? 2.1 : 3.6;
  const shoulderOffset = (player.isAiming ? 0.65 : 0.85) * player.shoulderSide;
  const camHeight = player.isAiming ? 1.72 : 1.85;

  const pivot = player.position.clone().add(new THREE.Vector3(0, camHeight, 0));
  const rightVec = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  pivot.addScaledVector(rightVec, shoulderOffset);

  const camOffset = new THREE.Vector3(
    Math.sin(player.yaw) * Math.cos(player.pitch) * camDist,
    Math.sin(player.pitch) * camDist,
    Math.cos(player.yaw) * Math.cos(player.pitch) * camDist
  );

  const desiredCamPos = pivot.clone().add(camOffset);
  camera.position.lerp(desiredCamPos, 18 * dt);

  const lookTarget = pivot.clone().add(
    new THREE.Vector3(
      -Math.sin(player.yaw) * Math.cos(player.pitch) * 15,
      -Math.sin(player.pitch) * 15,
      -Math.cos(player.yaw) * Math.cos(player.pitch) * 15
    )
  );
  camera.lookAt(lookTarget);

  updateHud();
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const toPlayer = player.position.clone().sub(e.group.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const dir = toPlayer.normalize();

    // Rotate enemy toward player & billboard health bar
    e.group.lookAt(player.position.x, e.group.position.y, player.position.z);
    e.hpBg.lookAt(camera.position);
    e.hpFill.lookAt(camera.position);

    // Tactical strafe & advance behavior
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeDir *= -1;
      e.strafeTimer = 1.5 + Math.random() * 2;
    }

    const strafeVec = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(e.strafeDir * 0.55);
    const moveVec = new THREE.Vector3();

    if (dist > 13) {
      moveVec.add(dir).add(strafeVec);
    } else if (dist < 7) {
      moveVec.sub(dir).add(strafeVec);
    } else {
      moveVec.add(strafeVec);
    }

    if (moveVec.lengthSq() > 0) {
      moveVec.normalize();
      e.group.position.addScaledVector(moveVec, e.speed * dt);
      resolveHorizontalCollisions(e.group.position, 0.6);
    }

    // Enemy Shooting
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 48) {
      e.shootTimer = e.isHeavy ? 1.1 : 1.45;
      const origin = e.group.position.clone().add(new THREE.Vector3(0, 1.45, 0));
      const target = player.position.clone().add(new THREE.Vector3(0, 1.25, 0));
      const shotDir = target.sub(origin).normalize();
      shotDir.x += (Math.random() - 0.5) * 0.09;
      shotDir.y += (Math.random() - 0.5) * 0.06;
      shotDir.z += (Math.random() - 0.5) * 0.09;
      shotDir.normalize();

      spawnBullet(origin, shotDir, true, 38);
    }
  }

  // Wave Clear Check
  if (enemies.length === 0 && !waveTransition) {
    waveTransition = true;
    // Reward ammo & partial health between waves
    player.ammoReserve += 60;
    player.hp = Math.min(player.maxHp, player.hp + 25);
    updateHud();

    setTimeout(() => {
      waveTransition = false;
      if (!isGameOver) startWave(currentWave + 1);
    }, 2200);
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }

    const step = b.velocity.clone().multiplyScalar(dt);
    b.mesh.position.add(step);

    // Check Arena Wall / Cover Collisions
    let hitWall = false;
    for (const box of colliders) {
      if (box.containsPoint(b.mesh.position)) {
        hitWall = true;
        break;
      }
    }
    if (hitWall || b.mesh.position.y <= 0) {
      spawnImpactParticles(b.mesh.position, b.isEnemy ? 0xf43f5e : 0x38bdf8, 5);
      scene.remove(b.mesh);
      bullets.splice(i, 1);
      continue;
    }

    // Hit Detection
    if (b.isEnemy) {
      const playerCenter = player.position.clone().add(new THREE.Vector3(0, 1.15, 0));
      if (b.mesh.position.distanceTo(playerCenter) < 0.72) {
        damagePlayer(10);
        spawnImpactParticles(b.mesh.position, 0xef4444, 6);
        scene.remove(b.mesh);
        bullets.splice(i, 1);
      }
    } else {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const enemyCenter = e.group.position.clone().add(new THREE.Vector3(0, 1.25, 0));
        const hitRadius = e.isHeavy ? 1.05 : 0.85;

        if (b.mesh.position.distanceTo(enemyCenter) < hitRadius) {
          const dmg = 28;
          e.hp -= dmg;
          showHitmarker();
          spawnImpactParticles(b.mesh.position, 0xfbbf24, 7);

          const ratio = Math.max(0, e.hp / e.maxHp);
          e.hpFill.scale.x = ratio;

          if (e.hp <= 0) {
            spawnImpactParticles(enemyCenter, 0xf97316, 18);
            scene.remove(e.group);
            enemies.splice(j, 1);
            score += e.isHeavy ? 250 : 100;
            updateHud();
          }

          scene.remove(b.mesh);
          bullets.splice(i, 1);
          break;
        }
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vel.y -= 18 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.setScalar(p.life * 2);
  }
}

animate();
