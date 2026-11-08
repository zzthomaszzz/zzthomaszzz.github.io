import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const FONT_URL = './fonts/type.json';
const RED = 0xcc001e;
const BLACK = 0x0e0e0e;
const WHITE = 0xf0f4f5;
const GROUND = 0x161616;
const WHEEL = 0x222222;

const is_small = window.matchMedia('(max-width: 720px)').matches;
const MAX_PIXEL_RATIO = is_small ? 1 : 1.5;
const FIXED_STEP = 1 / 60;

//Car tuning
const max_force = 700;
const max_speed = 17;
const max_steer = 0.55;
const brake_force = 18;
const chassis_mass = 220;
const near_radius = 11;
const spawn = new CANNON.Vec3(0, 1.2, 6);

const STATIONS = [
  { id: 'p-xchess', label: 'XChess', sign: 'XCHESS', num: '01', x: -26, z: -38 },
  { id: 'p-shotcaller', label: 'SHOTCALLER', sign: 'SHOTCALLER', num: '02', x: 26, z: -38 },
  { id: 'p-eazee', label: 'EAZEE AI outreach tool', sign: 'EAZEE AI', num: '03', x: -26, z: -70 },
  { id: 'p-gloryday', label: 'GloryDay', sign: 'GLORYDAY', num: '04', x: 26, z: -70 },
  { id: 'p-quiz', label: 'Weekly Quiz App', sign: 'QUIZ APP', num: '05', x: -26, z: -102 },
  { id: 'p-modifier', label: 'Modifier Chess', sign: 'MODIFIER CHESS', num: '06', x: 26, z: -102 },
  { id: 'p-extraction', label: 'Extraction', sign: 'EXTRACTION', num: '07', x: -26, z: -134 },
  { id: 'p-wordshurtme', label: 'WordsHurtMe', sign: 'WORDSHURTME', num: '08', x: 26, z: -134 },
  { id: 'contact', label: 'Contact', sign: 'CONTACT', num: '', x: 0, z: -168 },
  { id: 'skills', label: 'Skills', sign: 'SKILLS', num: '', x: -30, z: -6 },
  { id: 'about', label: 'About', sign: 'ABOUT', num: '', x: 30, z: -6 },
];

const TRAIL_ORDER = ['skills', 'about', 'p-xchess', 'p-shotcaller', 'p-gloryday', 'p-eazee', 'p-quiz', 'p-modifier', 'p-wordshurtme', 'p-extraction', 'contact'];

function load_font() {
  return new Promise((resolve, reject) => {
    new FontLoader().load(FONT_URL, resolve, undefined, reject);
  });
}

function create_renderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !is_small, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setClearColor(BLACK, 1);
  renderer.shadowMap.enabled = !is_small;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

function create_lights(scene) {
  scene.add(new THREE.HemisphereLight(WHITE, BLACK, 0.55));
  const sun = new THREE.DirectionalLight(WHITE, 1.7);
  sun.position.set(18, 36, 14);
  sun.castShadow = !is_small;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

function create_world() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.5;
  world.defaultContactMaterial.restitution = 0.05;
  const ground_rotation = new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0);
  const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), quaternion: ground_rotation });
  world.addBody(ground);
  return world;
}

function create_ground(scene, world) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(600, 150, 0x1f1f1f, 0x1a1a1a);
  grid.position.y = 0.01;
  scene.add(grid);

  const wall_material = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 1 });
  const bounds = [
    { x: 0, z: 40, w: 160, d: 2 },
    { x: 0, z: -200, w: 160, d: 2 },
    { x: 80, z: -80, w: 2, d: 242 },
    { x: -80, z: -80, w: 2, d: 242 },
  ];
  bounds.forEach((b) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1.2, b.d), wall_material);
    mesh.position.set(b.x, 0.6, b.z);
    mesh.castShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(b.w / 2, 0.6, b.d / 2)),
      position: new CANNON.Vec3(b.x, 0.6, b.z),
    });
    world.addBody(body);
  });
}

function create_car(scene, world) {
  const chassis_body = new CANNON.Body({ mass: chassis_mass });
  chassis_body.addShape(new CANNON.Box(new CANNON.Vec3(1.1, 0.35, 2.1)), new CANNON.Vec3(0, 0.1, 0));
  chassis_body.position.copy(spawn);
  chassis_body.angularDamping = 0.6;
  chassis_body.allowSleep = false;

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody: chassis_body,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  });

  const wheel_options = {
    radius: 0.5,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: 38,
    suspensionRestLength: 0.35,
    frictionSlip: 2.2,
    dampingRelaxation: 2.6,
    dampingCompression: 4.6,
    maxSuspensionForce: 100000,
    rollInfluence: 0.02,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(),
    maxSuspensionTravel: 0.3,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
  };

  [[-1.05, 0, 1.35], [1.05, 0, 1.35], [-1.05, 0, -1.35], [1.05, 0, -1.35]].forEach(([x, y, z]) => {
    wheel_options.chassisConnectionPointLocal = new CANNON.Vec3(x, y, z);
    vehicle.addWheel(wheel_options);
  });
  vehicle.addToWorld(world);

  const car = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.45, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: WHEEL, roughness: 0.9 });
  const light = new THREE.MeshStandardMaterial({ color: WHITE, emissive: WHITE, emissiveIntensity: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 4.2), red);
  body.position.y = 0.1;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 1.9), dark);
  cabin.position.set(0, 0.7, 0.1);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.5), dark);
  spoiler.position.set(0, 0.75, 1.9);
  [-0.7, 0.7].forEach((x) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), light);
    lamp.position.set(x, 0.2, -2.1);
    car.add(lamp);
  });
  [body, cabin, spoiler].forEach((m) => { m.castShadow = true; m.receiveShadow = true; car.add(m); });
  scene.add(car);

  const wheel_geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.45, 14);
  wheel_geometry.rotateZ(Math.PI / 2);
  const wheels = vehicle.wheelInfos.map(() => {
    const mesh = new THREE.Mesh(wheel_geometry, dark);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  });

  return { chassis_body, vehicle, car, wheels };
}

function create_word(scene, world, font, options) {
  const { text, size, depth, x, z, mass, color } = options;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const gap = size * 0.16;
  const glyphs = [];
  let total = 0;
  for (const ch of text) {
    if (ch === ' ') {
      glyphs.push(null);
      total += size * 0.45 + gap;
      continue;
    }
    const geometry = new TextGeometry(ch, { font, size, depth, curveSegments: 3, bevelEnabled: false });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const w = bb.max.x - bb.min.x;
    const h = bb.max.y - bb.min.y;
    geometry.translate(-(bb.min.x + w / 2), -(bb.min.y + h / 2), -depth / 2);
    glyphs.push({ geometry, w, h });
    total += w + gap;
  }
  total -= gap;

  let cursor = x - total / 2;
  const pieces = [];
  glyphs.forEach((glyph) => {
    if (!glyph) {
      cursor += size * 0.45 + gap;
      return;
    }
    const mesh = new THREE.Mesh(glyph.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(glyph.w / 2, glyph.h / 2, depth / 2)),
      position: new CANNON.Vec3(cursor + glyph.w / 2, glyph.h / 2 + 0.02, z),
      allowSleep: true,
      sleepSpeedLimit: 0.3,
      sleepTimeLimit: 0.8,
      angularDamping: 0.3,
      linearDamping: 0.05,
    });
    world.addBody(body);
    pieces.push({ mesh, body });
    cursor += glyph.w + gap;
  });
  return pieces;
}

function create_floor_text(scene, font, text, size, x, z) {
  const geometry = new TextGeometry(text, { font, size, depth: 0.02, curveSegments: 3, bevelEnabled: false });
  geometry.computeBoundingBox();
  const w = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
  geometry.translate(-w / 2, 0, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: RED }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.03, z);
  scene.add(mesh);
}

function create_pillar(scene, world, x, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), new THREE.MeshStandardMaterial({ color: RED, roughness: 0.6 }));
  mesh.position.set(x, 4.5, z);
  mesh.castShadow = true;
  scene.add(mesh);
  const body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(0.25, 4.5, 0.25)),
    position: new CANNON.Vec3(x, 4.5, z),
  });
  world.addBody(body);
}

function create_trail(scene) {
  const points = [];
  const by_id = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
  let previous = { x: 0, z: -4 };
  TRAIL_ORDER.forEach((id) => {
    const next = by_id[id];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.hypot(dx, dz);
    const steps = Math.floor(length / 3);
    for (let i = 1; i < steps; i++) {
      points.push([previous.x + (dx * i) / steps, previous.z + (dz * i) / steps]);
    }
    previous = next;
  });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), new THREE.MeshBasicMaterial({ color: RED }), points.length);
  const matrix = new THREE.Matrix4();
  points.forEach(([x, z], i) => {
    matrix.makeTranslation(x, 0.03, z);
    mesh.setMatrixAt(i, matrix);
  });
  scene.add(mesh);
}

function create_stations(scene, world, font) {
  const pieces = [];
  pieces.push(...create_word(scene, world, font, { text: 'THOMAS', size: 4, depth: 1, x: 0, z: -16, mass: 3, color: WHITE }));
  pieces.push(...create_word(scene, world, font, { text: 'NGUYEN', size: 4, depth: 1, x: 0, z: -22, mass: 3, color: RED }));
  STATIONS.forEach((station) => {
    const is_section = station.num === '';
    pieces.push(...create_word(scene, world, font, {
      text: station.sign,
      size: is_section ? 1.6 : 2,
      depth: 0.6,
      x: station.x,
      z: station.z,
      mass: 1.5,
      color: WHITE,
    }));
    if (station.num) create_floor_text(scene, font, station.num, 2.4, station.x, station.z + 7);
    create_pillar(scene, world, station.x, station.z - 3);
  });
  create_trail(scene);
  return pieces;
}

export async function create_game({ canvas, on_near }) {
  const font = await load_font();
  const renderer = create_renderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BLACK);
  scene.fog = new THREE.Fog(BLACK, 55, 130);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 220);
  const camera_offset = new THREE.Vector3(0, 15, 26);
  const look_target = new THREE.Vector3();

  const sun = create_lights(scene);
  const world = create_world();
  create_ground(scene, world);
  const { chassis_body, vehicle, car, wheels } = create_car(scene, world);
  const pieces = create_stations(scene, world, font);

  const keys = { forward: false, backward: false, left: false, right: false };
  let steer = 0;
  let is_paused = false;
  let flipped_for = 0;
  let current_near = null;

  function reset_car() {
    chassis_body.position.copy(spawn);
    chassis_body.velocity.setZero();
    chassis_body.angularVelocity.setZero();
    chassis_body.quaternion.set(0, 0, 0, 1);
    flipped_for = 0;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function set_key(name, is_down) {
    if (name in keys) keys[name] = is_down;
  }

  function on_key(event, is_down) {
    if (is_paused && is_down) return;
    switch (event.key) {
      case 'ArrowUp': case 'w': case 'W': keys.forward = is_down; break;
      case 'ArrowDown': case 's': case 'S': keys.backward = is_down; break;
      case 'ArrowLeft': case 'a': case 'A': keys.left = is_down; break;
      case 'ArrowRight': case 'd': case 'D': keys.right = is_down; break;
      case 'r': case 'R': if (is_down) reset_car(); return;
      default: return;
    }
    event.preventDefault();
  }

  function drive(dt) {
    const speed = chassis_body.velocity.length();
    const is_capped = speed > max_speed;
    const engine = keys.forward && !is_capped ? max_force : keys.backward ? -max_force * 0.6 : 0;
    const target_steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    steer += (target_steer * max_steer - steer) * Math.min(1, dt * 10);
    vehicle.applyEngineForce(engine, 2);
    vehicle.applyEngineForce(engine, 3);
    vehicle.setSteeringValue(steer, 0);
    vehicle.setSteeringValue(steer, 1);
    const is_coasting = !keys.forward && !keys.backward;
    const brake = is_coasting && speed > 0.2 ? brake_force * 0.25 : 0;
    for (let i = 0; i < 4; i++) vehicle.setBrake(brake, i);
  }

  function sync_visuals() {
    car.position.copy(chassis_body.position);
    car.quaternion.copy(chassis_body.quaternion);
    vehicle.wheelInfos.forEach((info, i) => {
      vehicle.updateWheelTransform(i);
      wheels[i].position.copy(info.worldTransform.position);
      wheels[i].quaternion.copy(info.worldTransform.quaternion);
    });
    pieces.forEach(({ mesh, body }) => {
      if (body.sleepState === CANNON.Body.SLEEPING) return;
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    });
  }

  function follow_camera(dt) {
    const target = new THREE.Vector3().copy(chassis_body.position).add(camera_offset);
    camera.position.lerp(target, Math.min(1, dt * 4));
    look_target.lerp(chassis_body.position, Math.min(1, dt * 6));
    camera.lookAt(look_target);
    sun.position.set(chassis_body.position.x + 18, 36, chassis_body.position.z + 14);
    sun.target.position.copy(chassis_body.position);
  }

  function check_flip(dt) {
    const up = new CANNON.Vec3(0, 1, 0);
    chassis_body.quaternion.vmult(up, up);
    flipped_for = up.y < 0.2 ? flipped_for + dt : 0;
    if (flipped_for > 2.5) reset_car();
  }

  function check_near() {
    const p = chassis_body.position;
    let best = null;
    let best_d = near_radius;
    STATIONS.forEach((station) => {
      const d = Math.hypot(station.x - p.x, station.z - p.z);
      if (d < best_d) { best = station; best_d = d; }
    });
    if (best !== current_near) {
      current_near = best;
      on_near(best);
    }
  }

  const clock = new THREE.Clock();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!is_paused) {
      drive(dt);
      world.step(FIXED_STEP, dt, 3);
      check_flip(dt);
      check_near();
    }
    sync_visuals();
    follow_camera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => on_key(event, true));
  window.addEventListener('keyup', (event) => on_key(event, false));
  window.addEventListener('blur', () => Object.keys(keys).forEach((k) => { keys[k] = false; }));

  camera.position.copy(chassis_body.position).add(camera_offset);
  look_target.copy(chassis_body.position);
  frame();

  return {
    set_key,
    set_paused(value) {
      is_paused = value;
      if (value) Object.keys(keys).forEach((k) => { keys[k] = false; });
    },
    reset: reset_car,
  };
}
