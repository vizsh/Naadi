// NAADI preview: the shed in 3D, standing on the same point paper as the page.
// Machines are drawn as matte forms with faint ink edges (a technical drawing),
// each with its punched-card chain hanging above it and status painted into the
// floor cells around its footprint. No glow, no bloom: colour only for watch/act.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as M from './model.js';

const PAPER = 0xf3f4ef;
const COL = {
  frame: 0x59626a, body: 0x7b858d, steel: 0xb8bec3, motor: 0x46525c, cloth: 0xece9df, yarn: 0xd8d3c6,
  belt: 0x2a2c2e, chakki: 0x68717a, stone: 0xa39e94, grain: 0xbfae86, sack: 0xeeede6, enamel: 0x55635b,
  pipe: 0x9aa1a6, plinth: 0xd4d5ce, column: 0x8b949b, wood: 0x7b6448, figure: 0x8e989e,
  card: 0x6e7b86, watch: 0xd99a00, act: 0xc8372a, off: 0xcdd1ca, hole: 0x1b1d20, ink: 0x17191c,
};
const CHAIN = 12; // cards shown hanging (3 days)

export function createShed(host, { model, onSelect, onHover, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(PAPER, 1);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER, 30, 72);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 4;
  controls.maxDistance = 42;
  controls.screenSpacePanning = true;

  // light: an overcast skylight from the north-light roof, one soft sun for form
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d9d0, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(7, 15, 9);
  sun.target.position.set(1.5, 0, -0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 1, far: 45 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ------------------------------------------------------ materials
  const mats = new Map();
  const mat = (c, o = {}) => {
    const key = c + JSON.stringify(o);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.04, ...o }));
    return mats.get(key);
  };
  const steel = () => mat(COL.steel, { roughness: 0.4, metalness: 0.6 });
  const edgeMat = new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.17, depthWrite: false });
  const edgeSel = new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.92, depthWrite: false });
  const mesh = (geo, material) => {
    const m = new THREE.Mesh(geo, typeof material === 'number' ? mat(material) : material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (w, h, d, c) => mesh(new THREE.BoxGeometry(w, h, d), c);
  const cylX = (r, len, c, seg = 28) => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateZ(Math.PI / 2);
    return mesh(g, c);
  };

  // ------------------------------------------------------ the paper floor
  const floorTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 1024; // 8 m × 8 m: 32 cells of 0.25 m, bold every 2 m
    const g = c.getContext('2d');
    g.fillStyle = '#F3F4EF';
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i <= 32; i++) {
      const p = i * 32;
      const bold = i % 8 === 0;
      g.fillStyle = bold ? 'rgba(64,108,98,.34)' : 'rgba(64,108,98,.16)';
      const w = bold ? 3 : 1.5;
      g.fillRect(p - w / 2, 0, w, 1024);
      g.fillRect(0, p - w / 2, 1024, w);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(12, 12);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  })();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), new THREE.MeshBasicMaterial({ map: floorTex, toneMapped: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  scene.add(floor);
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), new THREE.ShadowMaterial({ color: 0x1d2b27, opacity: 0.2 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.set(1.5, 0.002, -0.5);
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // shed structure: columns and a low back wall give scale without a roof in the way
  for (const x of [-8.4, -1.6, 5.2, 12]) {
    const c = box(0.24, 4.8, 0.24, COL.column);
    c.position.set(x, 2.4, -5.1);
    scene.add(c);
    addEdges(c, edgeMat);
  }
  const wall = box(22, 0.9, 0.14, 0xe1e3dd);
  wall.position.set(1.8, 0.45, -5.35);
  scene.add(wall);

  // ------------------------------------------------------ machine builders
  function addEdges(obj, material, list) {
    obj.traverse((o) => {
      if (!o.isMesh || o.userData.noEdges) return;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), material);
      e.raycast = () => {};
      o.add(e);
      if (list) list.push(e);
    });
  }

  function beltBetween(group, x, p1, r1, p2, r2, width = 0.02) {
    // two external tangents between pulleys in the y–z plane at a given x
    const dz = p2[0] - p1[0], dy = p2[1] - p1[1];
    const d = Math.hypot(dz, dy), phi = Math.atan2(dy, dz), a = Math.acos((r1 - r2) / d);
    for (const s of [1, -1]) {
      const th = phi + s * a;
      const t1 = [p1[0] + r1 * Math.cos(th), p1[1] + r1 * Math.sin(th)];
      const t2 = [p2[0] + r2 * Math.cos(th), p2[1] + r2 * Math.sin(th)];
      const len = Math.hypot(t2[0] - t1[0], t2[1] - t1[1]);
      const b = box(width, 0.012, len, COL.belt);
      b.position.set(x, (t1[1] + t2[1]) / 2, (t1[0] + t2[0]) / 2);
      b.rotation.x = Math.atan2(-(t2[1] - t1[1]), t2[0] - t1[0]);
      b.userData.noEdges = true;
      group.add(b);
    }
  }

  function spokedWheel(r, c) {
    const w = new THREE.Group();
    const rim = new THREE.TorusGeometry(r, 0.024, 8, 44);
    rim.rotateY(Math.PI / 2);
    w.add(mesh(rim, c));
    for (let i = 0; i < 4; i++) {
      const s = box(0.03, r * 2, 0.024, c);
      s.rotation.x = (i * Math.PI) / 4;
      w.add(s);
    }
    w.add(cylX(0.05, 0.08, c, 16));
    return w;
  }

  function motor(len = 0.34, r = 0.15) {
    const g = new THREE.Group();
    const base = box(len * 0.9, 0.04, r * 2.2, COL.frame);
    base.position.y = 0.02;
    const body = cylX(r, len, COL.motor, 32);
    body.position.y = r + 0.05;
    for (const x of [-len * 0.3, 0, len * 0.3]) {
      const band = cylX(r + 0.008, 0.012, COL.motor, 32);
      band.position.set(x, r + 0.05, 0);
      band.userData.noEdges = true;
      g.add(band);
    }
    const bell = cylX(r * 0.86, 0.04, COL.motor, 28);
    bell.position.set(-len / 2 - 0.02, r + 0.05, 0);
    const cowl = cylX(r * 0.96, 0.1, 0x5a6670, 28);
    cowl.position.set(len / 2 + 0.05, r + 0.05, 0);
    const tb = box(0.1, 0.07, 0.12, COL.motor);
    tb.position.set(0, 2 * r + 0.07, 0);
    const shaft = cylX(0.02, 0.12, steel(), 12);
    shaft.position.set(-len / 2 - 0.09, r + 0.05, 0);
    g.add(base, body, bell, cowl, tb, shaft);
    g.userData.axisY = r + 0.05;
    g.userData.deX = -len / 2 - 0.15;
    return g;
  }

  function buildLoom(phase) {
    const g = new THREE.Group();
    const anim = { phase, rate: 2.4 };
    const shape = new THREE.Shape();
    shape.moveTo(-0.8, 0);
    shape.lineTo(0.8, 0);
    shape.lineTo(0.8, 0.1);
    shape.lineTo(0.62, 0.1);
    shape.lineTo(0.68, 0.96);
    shape.lineTo(0.5, 1.02);
    shape.lineTo(-0.52, 1.2);
    shape.lineTo(-0.7, 1.16);
    shape.lineTo(-0.64, 0.1);
    shape.lineTo(-0.8, 0.1);
    shape.lineTo(-0.8, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0.52, 0.34, 0.25, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false, curveSegments: 24 });
    fg.rotateY(-Math.PI / 2);
    fg.translate(0.04, 0, 0);
    for (const sx of [-1.45, 1.45]) {
      const f = mesh(fg, COL.frame);
      f.position.x = sx;
      g.add(f);
    }
    const breast = box(2.84, 0.07, 0.12, COL.body);
    breast.position.set(0, 0.99, 0.6);
    const rest = cylX(0.045, 2.84, steel(), 18);
    rest.position.set(0, 1.18, -0.6);
    const beam = cylX(0.21, 2.6, COL.yarn, 36);
    beam.position.set(0, 0.52, -0.5);
    g.add(breast, rest, beam);
    for (const sx of [-1.32, 1.32]) {
      const fl = cylX(0.3, 0.03, steel(), 36);
      fl.position.set(sx, 0.52, -0.5);
      g.add(fl);
    }
    const roller = cylX(0.12, 2.6, COL.cloth, 32);
    roller.position.set(0, 0.44, 0.48);
    const cloth = box(2.6, 0.008, 0.27, COL.cloth);
    cloth.position.set(0, 0.985, 0.465);
    cloth.userData.noEdges = true;
    g.add(roller, cloth);
    // heddle frames
    const heddle = (z) => {
      const h = new THREE.Group();
      for (const y of [0.16, -0.16]) {
        const b = box(2.7, 0.03, 0.025, COL.body);
        b.position.y = y;
        h.add(b);
      }
      for (const x of [-1.35, 1.35]) {
        const s = box(0.03, 0.35, 0.025, COL.body);
        s.position.x = x;
        h.add(s);
      }
      h.position.set(0, 1.04, z);
      return h;
    };
    anim.hA = heddle(0.02);
    anim.hB = heddle(0.1);
    g.add(anim.hA, anim.hB);
    // warp: each thread runs back rest → heddle eye → fell of the cloth
    const N = 110;
    const pos = new Float32Array(N * 4 * 3);
    for (let i = 0; i < N; i++) {
      const x = -1.28 + (2.56 * i) / (N - 1);
      const z = i % 2 ? 0.1 : 0.02;
      pos.set([x, 1.225, -0.6, x, 1.04, z, x, 1.04, z, x, 0.99, 0.33], i * 12);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    anim.warp = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xcfc9ba }));
    anim.warpN = N;
    g.add(anim.warp);
    // sley: swords, race board, reed and the shuttle swing about a low pivot
    const sley = new THREE.Group();
    sley.position.set(0, 0.3, 0.26);
    for (const x of [-1.2, 1.2]) {
      const s = box(0.04, 0.7, 0.04, COL.body);
      s.position.set(x, 0.35, 0);
      sley.add(s);
    }
    const race = box(2.9, 0.03, 0.12, COL.body);
    race.position.set(0, 0.68, -0.02);
    const reed = box(2.7, 0.13, 0.015, mat(COL.steel, { roughness: 0.4, metalness: 0.6, transparent: true, opacity: 0.55 }));
    reed.position.set(0, 0.76, -0.07);
    sley.add(race, reed);
    for (const x of [-1.52, 1.52]) {
      const sb = box(0.3, 0.1, 0.14, COL.frame);
      sb.position.set(x, 0.73, -0.02);
      sley.add(sb);
    }
    anim.shuttle = box(0.28, 0.035, 0.05, COL.wood);
    anim.shuttle.position.set(-1.4, 0.71, -0.02);
    sley.add(anim.shuttle);
    anim.sley = sley;
    g.add(sley);
    // drive: crank pulley, motor, V-belt
    anim.wheel = spokedWheel(0.26, COL.frame);
    anim.wheel.position.set(1.62, 0.58, 0.12);
    g.add(anim.wheel);
    const mo = motor();
    mo.position.set(1.62 - mo.userData.deX + 0.03, 0, -0.38);
    g.add(mo);
    const pulley = cylX(0.065, 0.05, steel(), 20);
    pulley.position.set(1.62, mo.userData.axisY, -0.38);
    g.add(pulley);
    beltBetween(g, 1.62, [-0.38, mo.userData.axisY], 0.065, [0.12, 0.58], 0.26);
    g.userData.anim = anim;
    return g;
  }

  function buildChakki() {
    const g = new THREE.Group();
    const base = box(1.3, 0.55, 0.8, COL.chakki);
    base.position.y = 0.275;
    const plate = box(1.36, 0.04, 0.86, COL.frame);
    plate.position.y = 0.57;
    const casing = cylX(0.42, 0.38, COL.chakki, 40);
    casing.position.set(0, 0.98, 0);
    const face = cylX(0.37, 0.02, COL.stone, 40);
    face.position.set(-0.2, 0.98, 0);
    const throat = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 16), COL.frame);
    throat.position.set(0, 1.44, 0);
    const hopperGeo = new THREE.CylinderGeometry(0.4, 0.08, 0.5, 4, 1, true);
    hopperGeo.rotateY(Math.PI / 4);
    const hopper = mesh(hopperGeo, mat(COL.body, { side: THREE.DoubleSide }));
    hopper.position.set(0, 1.76, 0);
    const grainGeo = new THREE.CylinderGeometry(0.33, 0.08, 0.36, 4, 1);
    grainGeo.rotateY(Math.PI / 4);
    const grain = mesh(grainGeo, COL.grain);
    grain.position.set(0, 1.7, 0);
    grain.userData.noEdges = true;
    const spout = box(0.12, 0.07, 0.42, COL.frame);
    spout.position.set(0, 0.7, 0.52);
    spout.rotation.x = 0.55;
    const sack = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.52, 24), COL.sack);
    sack.position.set(0, 0.26, 0.86);
    g.add(base, plate, casing, face, throat, hopper, grain, spout, sack);
    const anim = { phase: 0 };
    anim.wheel = spokedWheel(0.3, COL.frame);
    anim.wheel.position.set(0.72, 0.98, 0);
    g.add(anim.wheel);
    const mo = motor(0.4, 0.17);
    mo.position.set(0.72 - mo.userData.deX + 0.03, 0, -0.95);
    g.add(mo);
    const pulley = cylX(0.08, 0.08, steel(), 20);
    pulley.position.set(0.72, mo.userData.axisY, -0.95);
    g.add(pulley);
    beltBetween(g, 0.72, [-0.95, mo.userData.axisY], 0.08, [0, 0.98], 0.3, 0.07);
    g.userData.anim = anim;
    return g;
  }

  function buildPump() {
    const g = new THREE.Group();
    const plinth = box(1.2, 0.16, 0.56, COL.plinth);
    plinth.position.y = 0.08;
    const plate = box(1.06, 0.03, 0.42, COL.enamel);
    plate.position.y = 0.175;
    g.add(plinth, plate);
    const mo = motor(0.4, 0.15);
    mo.position.set(-0.28, 0.16, 0);
    g.add(mo);
    const ay = 0.16 + mo.userData.axisY;
    const coupling = cylX(0.075, 0.08, steel(), 20);
    coupling.position.set(0.02, ay, 0);
    const volute = cylX(0.21, 0.16, COL.enamel, 36);
    volute.position.set(0.2, ay, 0);
    const lipGeo = new THREE.TorusGeometry(0.2, 0.035, 10, 36);
    lipGeo.rotateY(Math.PI / 2);
    const lip = mesh(lipGeo, COL.enamel);
    lip.position.set(0.2, ay, 0);
    lip.userData.noEdges = true;
    g.add(coupling, volute, lip);
    const pipe = (pts, r) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.1);
      const m = mesh(new THREE.TubeGeometry(curve, 64, r, 14, false), COL.pipe);
      m.userData.noEdges = true;
      return m;
    };
    g.add(pipe([[0.28, ay, 0], [0.5, ay, 0], [0.6, ay - 0.08, 0], [0.62, 0.12, 0], [0.62, -0.3, 0]], 0.06));
    g.add(pipe([[0.2, ay + 0.2, 0], [0.2, 1.3, 0], [0.2, 1.62, -0.12], [0.2, 1.68, -0.5], [0.2, 1.68, -2.4]], 0.05));
    const valve = box(0.13, 0.13, 0.13, COL.enamel);
    valve.position.set(0.2, 0.9, 0);
    const stem = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), steel());
    stem.rotation.x = Math.PI / 2;
    stem.position.set(0.2, 0.9, 0.14);
    const hw = mesh(new THREE.TorusGeometry(0.07, 0.01, 8, 28), COL.frame);
    hw.position.set(0.2, 0.9, 0.22);
    g.add(valve, stem, hw);
    g.userData.anim = { phase: 0 };
    return g;
  }

  // ------------------------------------------------------ place the shed
  const machines = new Map();
  const pickables = [];
  const rng = M.mulberry32(42);
  for (const def of model.machines) {
    const g = def.kind === 'loom' ? buildLoom(rng() * 10) : def.kind === 'chakki' ? buildChakki() : buildPump();
    g.position.set(...def.pos);
    g.userData.mid = def.id;
    scene.add(g);
    const edges = [];
    addEdges(g, edgeMat, edges);
    g.traverse((o) => { if (o.isMesh) { o.userData.mid = def.id; pickables.push(o); } });
    const bb = new THREE.Box3().setFromObject(g);
    machines.set(def.id, { def, group: g, edges, bb, center: bb.getCenter(new THREE.Vector3()) });
  }

  // a weaver beside Loom 03, for scale
  const fig = new THREE.Group();
  const limb = (r, len, x, y, z, rz = 0) => {
    const l = mesh(new THREE.CapsuleGeometry(r, len, 4, 10), COL.motor);
    l.position.set(x, y, z);
    l.rotation.z = rz;
    l.userData.noEdges = true;
    fig.add(l);
  };
  limb(0.075, 0.62, -0.1, 0.4, 0);
  limb(0.075, 0.62, 0.1, 0.4, 0);
  limb(0.17, 0.42, 0, 1.08, 0);
  limb(0.055, 0.5, -0.26, 1.02, 0.02, 0.12);
  limb(0.055, 0.5, 0.26, 1.02, 0.02, -0.12);
  const head = mesh(new THREE.SphereGeometry(0.11, 20, 14), COL.motor);
  head.position.y = 1.6;
  head.userData.noEdges = true;
  fig.add(head);
  fig.position.set(3.9, 0, 2.45);
  fig.rotation.y = -0.5;
  scene.add(fig);

  // ------------------------------------------------------ floor paint
  const cellGeo = new THREE.PlaneGeometry(0.21, 0.21);
  cellGeo.rotateX(-Math.PI / 2);
  const ringCells = [];
  for (const [id, m] of machines) {
    const snap = (v, f) => f(v / 0.25) * 0.25;
    const x0 = snap(m.bb.min.x - 0.2, Math.floor), x1 = snap(m.bb.max.x + 0.2, Math.ceil);
    const z0 = snap(m.bb.min.z - 0.2, Math.floor), z1 = snap(m.bb.max.z + 0.2, Math.ceil);
    const nx = Math.round((x1 - x0) / 0.25), nz = Math.round((z1 - z0) / 0.25);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
        const corner = (i < 3 || i > nx - 4) && (j < 3 || j > nz - 4) && (i === 0 || i === nx - 1 || j === 0 || j === nz - 1);
        ringCells.push({ id, x: x0 + (i + 0.5) * 0.25, z: z0 + (j + 0.5) * 0.25, corner });
      }
    }
    m.foot = { x0, x1, z0, z1 };
  }
  const ring = new THREE.InstancedMesh(cellGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), ringCells.length);
  ring.renderOrder = 1;
  ring.raycast = () => {};
  scene.add(ring);

  // machine numbers painted on the floor in front of each footprint
  const paintNumber = (def, foot) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(23,25,28,.82)';
    g.textBaseline = 'alphabetic';
    g.font = '700 168px "Anek Latin", system-ui, sans-serif';
    g.fillText(def.tag, 8, 176);
    g.font = '600 46px "Anek Latin", system-ui, sans-serif';
    g.fillText(def.kind === 'loom' ? 'LOOM' : def.kind === 'chakki' ? 'CHAKKI' : 'PUMP', 14, 236);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(foot.x0 + 0.62, 0.004, foot.z1 + 0.42);
    plane.renderOrder = 2;
    plane.raycast = () => {};
    scene.add(plane);
  };

  // ------------------------------------------------------ card chains
  const cardGeo = new THREE.BoxGeometry(1.04, 0.1, 0.008);
  const cards = new THREE.InstancedMesh(cardGeo, new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }), machines.size * CHAIN);
  cards.castShadow = true;
  cards.raycast = () => {};
  const holeGeo = new THREE.CircleGeometry(0.027, 18);
  const holes = new THREE.InstancedMesh(holeGeo, new THREE.MeshBasicMaterial({ color: COL.hole }), machines.size * CHAIN * 8);
  holes.raycast = () => {};
  scene.add(cards, holes);
  const cardMats = [], holeMats = [];
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmp = new THREE.Object3D();
  [...machines.values()].forEach((m, mi) => {
    const top = 3.7, cx = m.center.x, cz = m.center.z - 0.05;
    const rod = cylX(0.014, 1.2, steel(), 10);
    rod.position.set(cx, top + 0.07, cz);
    rod.userData.noEdges = true;
    scene.add(rod);
    const lace = [];
    for (let j = 0; j < CHAIN; j++) {
      // fan-folded like a jacquard chain, leaning back so the punched faces read from above
      tmp.position.set(cx, top - j * 0.094, cz + (j % 2 ? 0.014 : -0.014));
      tmp.rotation.set((j % 2 ? 0.24 : -0.24) - 0.32, 0, 0);
      tmp.updateMatrix();
      cardMats.push(tmp.matrix.clone());
      lace.push(new THREE.Vector3(0.49, 0, 0).applyMatrix4(tmp.matrix));
      for (let h = 0; h < 8; h++) {
        const hm = new THREE.Matrix4().makeTranslation(-0.385 + h * 0.11, 0, 0.0045);
        holeMats.push(tmp.matrix.clone().multiply(hm));
      }
    }
    for (const side of [1, -1]) {
      const pts = lace.map((p) => new THREE.Vector3(cx + (p.x - cx) * side, p.y, p.z));
      pts.unshift(new THREE.Vector3(pts[0].x, top + 0.05, cz));
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.5 }));
      l.raycast = () => {};
      scene.add(l);
    }
    paintNumber(m.def, m.foot);
  });

  // ------------------------------------------------------ state → paint
  const colorOf = { normal: COL.card, watch: COL.watch, act: COL.act, off: COL.off };
  const c3 = new THREE.Color();
  let index = M.N_PAST - 1;
  let selected = null;
  function paint() {
    [...machines.values()].forEach((m, mi) => {
      const src = model.byId[m.def.id];
      for (let j = 0; j < CHAIN; j++) {
        const slot = mi * CHAIN + j;
        const k = index - (CHAIN - 1) + j;
        if (k < 0) {
          cards.setMatrixAt(slot, zero);
          for (let h = 0; h < 8; h++) holes.setMatrixAt(slot * 8 + h, zero);
          continue;
        }
        const c = src.cards[k];
        cards.setMatrixAt(slot, cardMats[slot]);
        cards.setColorAt(slot, c3.setHex(colorOf[c.off ? 'off' : c.state]));
        for (let h = 0; h < 8; h++) holes.setMatrixAt(slot * 8 + h, c.holes[h] ? holeMats[slot * 8 + h] : zero);
      }
    });
    cards.instanceMatrix.needsUpdate = true;
    if (cards.instanceColor) cards.instanceColor.needsUpdate = true;
    holes.instanceMatrix.needsUpdate = true;
    ringCells.forEach((rc, i) => {
      const src = model.byId[rc.id];
      const c = src.cards[index];
      const st = c.off ? [...src.cards.slice(0, index + 1)].reverse().find((x) => !x.off)?.state || 'normal' : c.state;
      const sel = rc.id === selected;
      let show = st === 'watch' || st === 'act';
      let hex = st === 'act' ? COL.act : COL.watch;
      if (sel && rc.corner) { show = true; hex = COL.ink; }
      tmp.position.set(rc.x, 0.006, rc.z);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.setScalar(show ? 1 : 0);
      tmp.updateMatrix();
      ring.setMatrixAt(i, tmp.matrix);
      ring.setColorAt(i, c3.setHex(hex));
    });
    ring.instanceMatrix.needsUpdate = true;
    if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
    for (const [id, m] of machines) for (const e of m.edges) e.material = id === selected ? edgeSel : edgeMat;
  }

  // ------------------------------------------------------ camera
  const VIEWS = {
    shed: { pos: [-6.0, 11.2, 15.8], target: [2.0, 0.8, -0.4] },
    looms: { pos: [-1.0, 5.4, 10.8], target: [-1.2, 1.0, -0.4] },
    utilities: { pos: [13.6, 6.4, 8.6], target: [8.2, 0.9, -0.2] },
  };
  camera.position.set(...VIEWS.shed.pos);
  controls.target.set(...VIEWS.shed.target);
  let fly = null;
  function flyTo(pos, target) {
    fly = { t0: performance.now(), dur: reducedMotion ? 0 : 380, p0: camera.position.clone(), q0: controls.target.clone(), p1: new THREE.Vector3(...pos), q1: new THREE.Vector3(...target) };
  }
  function focusMachine(id) {
    const m = machines.get(id);
    if (!m) return;
    const t = m.center.clone();
    t.y = 0.9;
    const dir = camera.position.clone().sub(controls.target).normalize();
    const p = t.clone().add(dir.multiplyScalar(8.2));
    p.y = Math.max(p.y, 4.2);
    flyTo(p.toArray(), t.toArray());
  }

  // ------------------------------------------------------ picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null, hoverId = null;
  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.mid : null;
  };
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const id = pick(e);
    if (id) onSelect(id);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    const id = pick(e);
    if (id !== hoverId) {
      hoverId = id;
      renderer.domElement.style.cursor = id ? 'pointer' : '';
    }
    onHover(id, e);
  });
  renderer.domElement.addEventListener('pointerleave', () => { hoverId = null; onHover(null); });

  // ------------------------------------------------------ loop
  const v3 = new THREE.Vector3();
  function animate(time) {
    const t = time / 1000;
    if (!reducedMotion) {
      for (const m of machines.values()) {
        const a = m.group.userData.anim;
        if (!a) continue;
        if (a.wheel) a.wheel.rotation.x = -(t + a.phase) * (m.def.kind === 'loom' ? 2 * Math.PI * a.rate : 5);
        if (!a.sley) continue;
        const picks = (t + a.phase) * a.rate;
        const shed = 0.055 * Math.sin(Math.PI * picks);
        a.hA.position.y = 1.04 + shed;
        a.hB.position.y = 1.04 - shed;
        a.sley.rotation.x = 0.1 * Math.cos(2 * Math.PI * picks);
        const frac = picks % 1;
        const s = Math.min(1, Math.max(0, (frac - 0.22) / 0.5));
        const dir = Math.floor(picks) % 2 ? 1 : -1;
        a.shuttle.position.x = dir * (-1.4 + 2.8 * s);
        const p = a.warp.geometry.attributes.position.array;
        for (let i = 0; i < a.warpN; i++) {
          const y = 1.04 + (i % 2 ? -shed : shed);
          p[i * 12 + 4] = y;
          p[i * 12 + 7] = y;
        }
        a.warp.geometry.attributes.position.needsUpdate = true;
      }
    }
    if (fly) {
      const k = fly.dur ? Math.min(1, (performance.now() - fly.t0) / fly.dur) : 1;
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      controls.target.lerpVectors(fly.q0, fly.q1, k);
      if (k >= 1) fly = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }

  let lastW = 0, lastH = 0;
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    lastW = w;
    lastH = h;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    camera.fov = w < 640 ? 40 : 30;
    camera.updateProjectionMatrix();
  }
  let running = false;
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) animate(performance.now()); // a resize clears the canvas; never leave it blank
  });
  ro.observe(host);
  resize();
  paint();
  const api = {
    start() { if (!running) { running = true; renderer.setAnimationLoop(animate); } },
    stop() { running = false; renderer.setAnimationLoop(null); },
    setIndex(k) { index = k; paint(); },
    // debugging aid: draw one frame without the animation loop (background tabs)
    renderOnce(time = 1200) { resize(); fly = null; animate(time); },
    select(id, { focus = true } = {}) { selected = id; paint(); if (focus && id) focusMachine(id); },
    view(name) { const v = VIEWS[name]; if (v) flyTo(v.pos, v.target); },
    screenOf(id) {
      const m = machines.get(id);
      if (!m) return null;
      v3.set(m.center.x, m.bb.max.y + 0.25, m.center.z).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: ((v3.x + 1) / 2) * r.width, y: ((1 - v3.y) / 2) * r.height };
    },
  };
  const io = new IntersectionObserver(([e]) => (e.isIntersecting ? api.start() : api.stop()));
  io.observe(host);
  return api;
}
