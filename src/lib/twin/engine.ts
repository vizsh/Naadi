// NAADI digital twin engine: the shed in 3D on the same point paper as the page.
// Imperative three.js wrapped by a React component, so the frame loop, instancing and
// disposal stay under direct control. Machines are matte forms with faint ink edges
// (a technical drawing); each carries a punched-card chain above it and paints its
// status into the floor cells around its footprint. No glow, no bloom.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { N_PAST, mulberry32, type State } from '@/lib/model/core';
import { defectFactors, TRUE_RPM } from '@/lib/model/physics';
import type { Machine } from '@/lib/model/shed';
import { activeFault } from '@/lib/model/setup';

const PAPER = 0xf3f4ef;
const COL = {
  frame: 0x59626a, body: 0x7b858d, steel: 0xb8bec3, motor: 0x46525c, cloth: 0xece9df, yarn: 0xd8d3c6,
  belt: 0x2a2c2e, chakki: 0x68717a, stone: 0xa39e94, grain: 0xbfae86, sack: 0xeeede6, enamel: 0x55635b,
  pipe: 0x9aa1a6, plinth: 0xd4d5ce, column: 0x8b949b, wood: 0x7b6448,
  card: 0x6e7b86, watch: 0xd99a00, act: 0xc8372a, off: 0xcdd1ca, hole: 0x1b1d20, ink: 0x17191c,
};
const CHAIN = 12; // cards hanging per machine (3 days)
const SLOW = 40; // bearing motion shown 40× slower than life
export type CameraView = 'shed' | 'looms' | 'utilities';
/** A card punched by the Live Lab (one every two seconds), shown on the tenth machine. */
export interface LiveCard { holes: boolean[]; state: 'normal' | 'watch' | 'act' }
/** Where the Live Lab's machine stands: a pedestal fan in the front aisle, by Loom 01. */
const LIVE_POS = new THREE.Vector3(-3.3, 0, 3.75);
export const LIVE_ID = 'LAB';

export interface PartLabel { id: string; label: string; detail: string; x: number; y: number; visible: boolean }
export interface EngineOptions {
  machines: Machine[];
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

interface MotorRig {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  bell: THREE.Object3D; cowl: THREE.Object3D; box: THREE.Object3D;
  bearing: THREE.Group; balls: THREE.Group; spall: THREE.Mesh | null;
  home: Map<THREE.Object3D, THREE.Vector3>;
  deLocal: THREE.Vector3;
}
interface LoomAnim {
  phase: number; rate: number;
  hA?: THREE.Group; hB?: THREE.Group; sley?: THREE.Group; shuttle?: THREE.Mesh;
  warp?: THREE.LineSegments; warpN?: number; wheel?: THREE.Group;
}
interface Rig { def: Machine; group: THREE.Group; edges: THREE.LineSegments[]; bb: THREE.Box3; center: THREE.Vector3; foot: { x0: number; x1: number; z0: number; z1: number }; anim: LoomAnim; motor: MotorRig | null }
interface LiveRig { group: THREE.Group; edges: THREE.LineSegments[]; blades: THREE.Group; bb: THREE.Box3; center: THREE.Vector3; label: THREE.Mesh; chain: THREE.Object3D[]; slot0: number; on: boolean; cards: LiveCard[] }

export class ShedEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  private controls: OrbitControls;
  private rigs = new Map<string, Rig>();
  private live: LiveRig | null = null;
  private pickables: THREE.Object3D[] = [];
  private cards!: THREE.InstancedMesh;
  private holes!: THREE.InstancedMesh;
  private ring!: THREE.InstancedMesh;
  private ringCells: { id: string; x: number; z: number; corner: boolean }[] = [];
  private cardMats: THREE.Matrix4[] = [];
  private holeMats: THREE.Matrix4[] = [];
  private edgeMat = new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.17, depthWrite: false });
  private edgeSel = new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.92, depthWrite: false });
  private xray = new Map<number, THREE.MeshStandardMaterial>();
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private index = N_PAST - 1;
  private selected: string | null = null;
  private inspecting: string | null = null;
  private exploded = 0; // 0..1
  private explodeTarget = 0;
  private fly: { t0: number; dur: number; p0: THREE.Vector3; q0: THREE.Vector3; p1: THREE.Vector3; q1: THREE.Vector3 } | null = null;
  private running = false;
  private lastW = 0;
  private lastH = 0;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private shaftHz = TRUE_RPM / 60;
  private simT = 0;
  private lastFrame = 0;
  private lastPass: number[] = [];
  private flash = 0;
  private downAt: [number, number] | null = null;
  private hoverId: string | null = null;
  private disposed = false;

  constructor(private host: HTMLElement, private opts: EngineOptions) {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(PAPER, 1);
    r.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(r.domElement);
    this.renderer = r;

    this.scene.fog = new THREE.Fog(PAPER, 30, 72);
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.12, maxPolarAngle: Math.PI * 0.47, minDistance: 1.2, maxDistance: 42, screenSpacePanning: true });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d9d0, 1.25));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(7, 15, 9);
    sun.target.position.set(1.5, 0, -0.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 1, far: 45 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);

    this.buildFloor();
    this.buildStructure();
    this.buildMachines();
    this.buildLive();
    this.buildFigure();
    this.buildFloorPaint();
    this.buildChains();
    this.view('shed', true);
    this.paint();

    const el = r.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('dblclick', this.onDouble);

    this.ro = new ResizeObserver(() => {
      this.resize();
      if (!this.running) this.frame(performance.now());
    });
    this.ro.observe(host);
    this.resize();
    this.io = new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop()));
    this.io.observe(host);
  }

  // ------------------------------------------------------------ public API
  start() { if (!this.running && !this.disposed) { this.running = true; this.lastFrame = performance.now(); this.renderer.setAnimationLoop(this.frame); } }
  stop() { this.running = false; this.renderer.setAnimationLoop(null); }
  setIndex(k: number) { this.index = k; this.paint(); }
  /** Show or hide the Live Lab's machine: a fan whose chain is punched by the visitor's sensor. */
  setLive(on: boolean) {
    const L = this.live;
    if (!L || L.on === on) return;
    L.on = on;
    L.group.visible = L.label.visible = on;
    for (const o of L.chain) o.visible = on;
    if (!on && this.selected === LIVE_ID) this.selected = null;
    this.paint();
  }
  setLiveCards(cards: LiveCard[]) { if (this.live) { this.live.cards = cards; this.paint(); } }
  setShaftHz(hz: number) { this.shaftHz = hz; }
  select(id: string | null, focus = true) {
    this.selected = id;
    this.paint();
    if (focus && id && !this.inspecting) this.focusMachine(id);
  }
  view(name: CameraView, instant = false) {
    const V: Record<CameraView, [number[], number[]]> = {
      shed: [[-6.0, 11.2, 15.8], [2.0, 0.8, -0.4]],
      looms: [[-1.0, 5.4, 10.8], [-1.2, 1.0, -0.4]],
      utilities: [[13.6, 6.4, 8.6], [8.2, 0.9, -0.2]],
    };
    if (this.inspecting) this.inspect(null);
    const [p, t] = V[name];
    this.flyTo(new THREE.Vector3(...p), new THREE.Vector3(...t), instant);
  }
  /** X-ray a loom motor and reveal its drive-end bearing; null returns to the shed. */
  inspect(id: string | null) {
    const prev = this.inspecting ? this.rigs.get(this.inspecting) : null;
    if (prev?.motor) this.setXray(prev.motor, false);
    this.explodeTarget = 0;
    this.inspecting = null;
    if (!id) { this.paint(); return false; }
    const rig = this.rigs.get(id);
    if (!rig?.motor) return false;
    this.inspecting = id;
    this.selected = id;
    this.setXray(rig.motor, true);
    // look in from the open (non-drive) side and the aisle, through the x-rayed housing
    const de = rig.motor.group.localToWorld(rig.motor.deLocal.clone());
    this.flyTo(de.clone().add(new THREE.Vector3(0.62, 0.34, 0.78)), de.clone().add(new THREE.Vector3(0.1, 0, 0)));
    this.paint();
    return true;
  }
  explode(on: boolean) { if (this.inspecting) this.explodeTarget = on ? 1 : 0; }
  get isInspecting() { return this.inspecting; }
  canInspect(id: string) { return !!this.rigs.get(id)?.motor; }
  /** Screen positions of the motor's parts while inspecting, for HTML leader labels. */
  partLabels(): PartLabel[] {
    if (!this.inspecting) return [];
    const m = this.rigs.get(this.inspecting)?.motor;
    if (!m) return [];
    const rect = this.renderer.domElement.getBoundingClientRect();
    const project = (o: THREE.Object3D, off = new THREE.Vector3()) => {
      const v = o.getWorldPosition(new THREE.Vector3()).add(off).project(this.camera);
      return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height, visible: v.z < 1 };
    };
    const F = defectFactors();
    const items: PartLabel[] = [
      { id: 'bearing', label: '6205-2RS bearing', detail: `9 balls · BPFO ${(F.BPFO * this.shaftHz).toFixed(1)} Hz · ₹380`, ...project(m.bearing, new THREE.Vector3(0, 0.07, 0)) },
      { id: 'bell', label: 'Drive-end bell', detail: 'Bearing housing, cast iron', ...project(m.bell, new THREE.Vector3(0, -0.1, 0)) },
      { id: 'stator', label: 'Stator and rotor', detail: '2 hp, 4-pole, 1440 rpm', ...project(m.group, new THREE.Vector3(0, 0.36, 0)) },
      { id: 'cowl', label: 'Fan cowl', detail: 'Non-drive end, 6204 bearing', ...project(m.cowl, new THREE.Vector3(0, 0.1, 0)) },
    ];
    return this.exploded > 0.5 ? items : items.slice(0, 1);
  }
  screenOf(id: string) {
    const rig = id === LIVE_ID ? this.live : this.rigs.get(id);
    if (!rig) return null;
    const v = new THREE.Vector3(rig.center.x, rig.bb.max.y + 0.25, rig.center.z).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
  }
  /** Debug aid for background tabs: draw one frame without the loop. */
  renderOnce(time = 1200) { this.resize(); this.fly = null; this.frame(time); }

  dispose() {
    this.disposed = true;
    this.stop();
    this.ro.disconnect();
    this.io.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('dblclick', this.onDouble);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) {
        const map = (mat as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
        mat.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
    el.remove();
  }

  // ------------------------------------------------------------ materials and helpers
  private mat(c: number, o: THREE.MeshStandardMaterialParameters = {}) {
    const key = c + JSON.stringify(o);
    let m = this.mats.get(key);
    if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.04, ...o }); this.mats.set(key, m); }
    return m;
  }
  private steel() { return this.mat(COL.steel, { roughness: 0.4, metalness: 0.6 }); }
  private mesh(geo: THREE.BufferGeometry, m: number | THREE.Material) {
    const x = new THREE.Mesh(geo, typeof m === 'number' ? this.mat(m) : m);
    x.castShadow = true;
    x.receiveShadow = true;
    return x;
  }
  private box(w: number, h: number, d: number, c: number | THREE.Material) { return this.mesh(new THREE.BoxGeometry(w, h, d), c); }
  private cylX(r: number, len: number, c: number | THREE.Material, seg = 28) {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateZ(Math.PI / 2);
    return this.mesh(g, c);
  }
  private addEdges(obj: THREE.Object3D, material: THREE.LineBasicMaterial, list?: THREE.LineSegments[]) {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.noEdges) return;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), material);
      e.raycast = () => {};
      m.add(e);
      list?.push(e);
    });
  }

  // ------------------------------------------------------------ the world
  private buildFloor() {
    const c = document.createElement('canvas');
    c.width = c.height = 1024; // 8 m × 8 m: 32 cells of 0.25 m, bold every 2 m
    const g = c.getContext('2d')!;
    g.fillStyle = '#F3F4EF';
    g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i <= 32; i++) {
      const p = i * 32, bold = i % 8 === 0, w = bold ? 3 : 1.5;
      g.fillStyle = bold ? 'rgba(64,108,98,.34)' : 'rgba(64,108,98,.16)';
      g.fillRect(p - w / 2, 0, w, 1024);
      g.fillRect(0, p - w / 2, 1024, w);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(12, 12);
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), new THREE.ShadowMaterial({ color: 0x1d2b27, opacity: 0.2 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.set(1.5, 0.002, -0.5);
    catcher.receiveShadow = true;
    this.scene.add(catcher);
  }

  private buildStructure() {
    for (const x of [-8.4, -1.6, 5.2, 12]) {
      const c = this.box(0.24, 4.8, 0.24, COL.column);
      c.position.set(x, 2.4, -5.1);
      this.scene.add(c);
      this.addEdges(c, this.edgeMat);
    }
    const wall = this.box(22, 0.9, 0.14, 0xe1e3dd);
    wall.position.set(1.8, 0.45, -5.35);
    this.scene.add(wall);
  }

  private beltBetween(group: THREE.Group, x: number, p1: [number, number], r1: number, p2: [number, number], r2: number, width = 0.02) {
    const dz = p2[0] - p1[0], dy = p2[1] - p1[1];
    const d = Math.hypot(dz, dy), phi = Math.atan2(dy, dz), a = Math.acos((r1 - r2) / d);
    for (const s of [1, -1]) {
      const th = phi + s * a;
      const t1 = [p1[0] + r1 * Math.cos(th), p1[1] + r1 * Math.sin(th)];
      const t2 = [p2[0] + r2 * Math.cos(th), p2[1] + r2 * Math.sin(th)];
      const len = Math.hypot(t2[0] - t1[0], t2[1] - t1[1]);
      const b = this.box(width, 0.012, len, COL.belt);
      b.position.set(x, (t1[1] + t2[1]) / 2, (t1[0] + t2[0]) / 2);
      b.rotation.x = Math.atan2(-(t2[1] - t1[1]), t2[0] - t1[0]);
      b.userData.noEdges = true;
      group.add(b);
    }
  }

  private spokedWheel(r: number, c: number) {
    const w = new THREE.Group();
    const rim = new THREE.TorusGeometry(r, 0.024, 8, 44);
    rim.rotateY(Math.PI / 2);
    w.add(this.mesh(rim, c));
    for (let i = 0; i < 4; i++) {
      const s = this.box(0.03, r * 2, 0.024, c);
      s.rotation.x = (i * Math.PI) / 4;
      w.add(s);
    }
    w.add(this.cylX(0.05, 0.08, c, 16));
    return w;
  }

  /** A TEFC induction motor with its drive-end bearing modelled inside for x-ray inspection. */
  private motor(len = 0.34, r = 0.15, withSpall = false): MotorRig {
    const g = new THREE.Group();
    const axisY = r + 0.05;
    const meshes: THREE.Mesh[] = [];
    const add = (m: THREE.Mesh) => { g.add(m); meshes.push(m); return m; };
    const base = add(this.box(len * 0.9, 0.04, r * 2.2, COL.frame));
    base.position.y = 0.02;
    const body = add(this.cylX(r, len, COL.motor, 32));
    body.position.y = axisY;
    for (const x of [-len * 0.3, 0, len * 0.3]) {
      const band = add(this.cylX(r + 0.008, 0.012, COL.motor, 32));
      band.position.set(x, axisY, 0);
      band.userData.noEdges = true;
    }
    const bell = add(this.cylX(r * 0.86, 0.04, COL.motor, 28));
    bell.position.set(-len / 2 - 0.02, axisY, 0);
    const cowl = add(this.cylX(r * 0.96, 0.1, 0x5a6670, 28));
    cowl.position.set(len / 2 + 0.05, axisY, 0);
    const box = add(this.box(0.1, 0.07, 0.12, COL.motor));
    box.position.set(0, 2 * r + 0.07, 0);
    const shaft = this.cylX(0.02, 0.12, this.steel(), 12);
    shaft.position.set(-len / 2 - 0.09, axisY, 0);
    g.add(shaft);
    // the drive-end bearing: rings, cage of nine balls, and (on Loom 03) the spall
    const bearing = new THREE.Group();
    bearing.position.set(-len / 2 - 0.02, axisY, 0);
    bearing.visible = false;
    const pitch = 0.045, ball = 0.0095;
    const ring = (rad: number, tube: number) => {
      const t = new THREE.TorusGeometry(rad, tube, 10, 48);
      t.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(t, this.mat(COL.steel, { roughness: 0.35, metalness: 0.7 }));
      m.userData.noEdges = true;
      return m;
    };
    bearing.add(ring(pitch + ball + 0.005, 0.006), ring(pitch - ball - 0.005, 0.006));
    const balls = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(ball, 16, 12), this.mat(0xe6e8ea, { roughness: 0.25, metalness: 0.8 }));
      const a = (i / 9) * Math.PI * 2;
      s.position.set(0, Math.cos(a) * pitch, Math.sin(a) * pitch);
      balls.add(s);
    }
    bearing.add(balls);
    let spall: THREE.Mesh | null = null;
    if (withSpall) {
      spall = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.016), new THREE.MeshBasicMaterial({ color: COL.act }));
      spall.position.set(0, -(pitch + ball + 0.003), 0);
      bearing.add(spall);
    }
    g.add(bearing);
    const home = new Map<THREE.Object3D, THREE.Vector3>();
    for (const o of [bell, cowl, box, bearing]) home.set(o, o.position.clone());
    return { group: g, meshes, bell, cowl, box, bearing, balls, spall, home, deLocal: bearing.position.clone() };
  }

  private buildLoom(phase: number, withSpall: boolean) {
    const g = new THREE.Group();
    const anim: LoomAnim = { phase, rate: 2.4 };
    const shape = new THREE.Shape();
    shape.moveTo(-0.8, 0);
    for (const [x, y] of [[0.8, 0], [0.8, 0.1], [0.62, 0.1], [0.68, 0.96], [0.5, 1.02], [-0.52, 1.2], [-0.7, 1.16], [-0.64, 0.1], [-0.8, 0.1], [-0.8, 0]]) shape.lineTo(x, y);
    const hole = new THREE.Path();
    hole.absellipse(0, 0.52, 0.34, 0.25, 0, Math.PI * 2, true, 0);
    shape.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false, curveSegments: 24 });
    fg.rotateY(-Math.PI / 2);
    fg.translate(0.04, 0, 0);
    for (const sx of [-1.45, 1.45]) { const f = this.mesh(fg, COL.frame); f.position.x = sx; g.add(f); }
    const breast = this.box(2.84, 0.07, 0.12, COL.body);
    breast.position.set(0, 0.99, 0.6);
    const rest = this.cylX(0.045, 2.84, this.steel(), 18);
    rest.position.set(0, 1.18, -0.6);
    const beam = this.cylX(0.21, 2.6, COL.yarn, 36);
    beam.position.set(0, 0.52, -0.5);
    g.add(breast, rest, beam);
    for (const sx of [-1.32, 1.32]) { const fl = this.cylX(0.3, 0.03, this.steel(), 36); fl.position.set(sx, 0.52, -0.5); g.add(fl); }
    const roller = this.cylX(0.12, 2.6, COL.cloth, 32);
    roller.position.set(0, 0.44, 0.48);
    const cloth = this.box(2.6, 0.008, 0.27, COL.cloth);
    cloth.position.set(0, 0.985, 0.465);
    cloth.userData.noEdges = true;
    g.add(roller, cloth);
    const heddle = (z: number) => {
      const h = new THREE.Group();
      for (const y of [0.16, -0.16]) { const b = this.box(2.7, 0.03, 0.025, COL.body); b.position.y = y; h.add(b); }
      for (const x of [-1.35, 1.35]) { const s = this.box(0.03, 0.35, 0.025, COL.body); s.position.x = x; h.add(s); }
      h.position.set(0, 1.04, z);
      return h;
    };
    anim.hA = heddle(0.02);
    anim.hB = heddle(0.1);
    g.add(anim.hA, anim.hB);
    const N = 110;
    const pos = new Float32Array(N * 12);
    for (let i = 0; i < N; i++) {
      const x = -1.28 + (2.56 * i) / (N - 1), z = i % 2 ? 0.1 : 0.02;
      pos.set([x, 1.225, -0.6, x, 1.04, z, x, 1.04, z, x, 0.99, 0.33], i * 12);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    anim.warp = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0xcfc9ba }));
    anim.warpN = N;
    g.add(anim.warp);
    const sley = new THREE.Group();
    sley.position.set(0, 0.3, 0.26);
    for (const x of [-1.2, 1.2]) { const s = this.box(0.04, 0.7, 0.04, COL.body); s.position.set(x, 0.35, 0); sley.add(s); }
    const race = this.box(2.9, 0.03, 0.12, COL.body);
    race.position.set(0, 0.68, -0.02);
    const reed = this.box(2.7, 0.13, 0.015, this.mat(COL.steel, { roughness: 0.4, metalness: 0.6, transparent: true, opacity: 0.55 }));
    reed.position.set(0, 0.76, -0.07);
    sley.add(race, reed);
    for (const x of [-1.52, 1.52]) { const sb = this.box(0.3, 0.1, 0.14, COL.frame); sb.position.set(x, 0.73, -0.02); sley.add(sb); }
    anim.shuttle = this.box(0.28, 0.035, 0.05, COL.wood);
    anim.shuttle.position.set(-1.4, 0.71, -0.02);
    sley.add(anim.shuttle);
    anim.sley = sley;
    g.add(sley);
    anim.wheel = this.spokedWheel(0.26, COL.frame);
    anim.wheel.position.set(1.62, 0.58, 0.12);
    g.add(anim.wheel);
    const mo = this.motor(0.34, 0.15, withSpall);
    mo.group.position.set(1.62 + 0.17 + 0.15 + 0.03, 0, -0.38);
    g.add(mo.group);
    const pulley = this.cylX(0.065, 0.05, this.steel(), 20);
    pulley.position.set(1.62, 0.2, -0.38);
    g.add(pulley);
    this.beltBetween(g, 1.62, [-0.38, 0.2], 0.065, [0.12, 0.58], 0.26);
    return { group: g, anim, motor: mo };
  }

  private buildChakki() {
    const g = new THREE.Group();
    const base = this.box(1.3, 0.55, 0.8, COL.chakki);
    base.position.y = 0.275;
    const plate = this.box(1.36, 0.04, 0.86, COL.frame);
    plate.position.y = 0.57;
    const casing = this.cylX(0.42, 0.38, COL.chakki, 40);
    casing.position.set(0, 0.98, 0);
    const face = this.cylX(0.37, 0.02, COL.stone, 40);
    face.position.set(-0.2, 0.98, 0);
    const throat = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 16), COL.frame);
    throat.position.set(0, 1.44, 0);
    const hg = new THREE.CylinderGeometry(0.4, 0.08, 0.5, 4, 1, true);
    hg.rotateY(Math.PI / 4);
    const hopper = this.mesh(hg, this.mat(COL.body, { side: THREE.DoubleSide }));
    hopper.position.set(0, 1.76, 0);
    const gg = new THREE.CylinderGeometry(0.33, 0.08, 0.36, 4, 1);
    gg.rotateY(Math.PI / 4);
    const grain = this.mesh(gg, COL.grain);
    grain.position.set(0, 1.7, 0);
    grain.userData.noEdges = true;
    const spout = this.box(0.12, 0.07, 0.42, COL.frame);
    spout.position.set(0, 0.7, 0.52);
    spout.rotation.x = 0.55;
    const sack = this.mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.52, 24), COL.sack);
    sack.position.set(0, 0.26, 0.86);
    g.add(base, plate, casing, face, throat, hopper, grain, spout, sack);
    const anim: LoomAnim = { phase: 0, rate: 0 };
    anim.wheel = this.spokedWheel(0.3, COL.frame);
    anim.wheel.position.set(0.72, 0.98, 0);
    g.add(anim.wheel);
    const mo = this.motor(0.4, 0.17);
    mo.group.position.set(0.72 + 0.2 + 0.15 + 0.03, 0, -0.95);
    g.add(mo.group);
    const pulley = this.cylX(0.08, 0.08, this.steel(), 20);
    pulley.position.set(0.72, 0.22, -0.95);
    g.add(pulley);
    this.beltBetween(g, 0.72, [-0.95, 0.22], 0.08, [0, 0.98], 0.3, 0.07);
    return { group: g, anim };
  }

  private buildPump() {
    const g = new THREE.Group();
    const plinth = this.box(1.2, 0.16, 0.56, COL.plinth);
    plinth.position.y = 0.08;
    const plate = this.box(1.06, 0.03, 0.42, COL.enamel);
    plate.position.y = 0.175;
    g.add(plinth, plate);
    const mo = this.motor(0.4, 0.15);
    mo.group.position.set(-0.28, 0.16, 0);
    g.add(mo.group);
    const ay = 0.16 + 0.2;
    const coupling = this.cylX(0.075, 0.08, this.steel(), 20);
    coupling.position.set(0.02, ay, 0);
    const volute = this.cylX(0.21, 0.16, COL.enamel, 36);
    volute.position.set(0.2, ay, 0);
    const lg = new THREE.TorusGeometry(0.2, 0.035, 10, 36);
    lg.rotateY(Math.PI / 2);
    const lip = this.mesh(lg, COL.enamel);
    lip.position.set(0.2, ay, 0);
    lip.userData.noEdges = true;
    g.add(coupling, volute, lip);
    const pipe = (pts: number[][], r: number) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.1);
      const m = this.mesh(new THREE.TubeGeometry(curve, 64, r, 14, false), COL.pipe);
      m.userData.noEdges = true;
      return m;
    };
    g.add(pipe([[0.28, ay, 0], [0.5, ay, 0], [0.6, ay - 0.08, 0], [0.62, 0.12, 0], [0.62, -0.3, 0]], 0.06));
    g.add(pipe([[0.2, ay + 0.2, 0], [0.2, 1.3, 0], [0.2, 1.62, -0.12], [0.2, 1.68, -0.5], [0.2, 1.68, -2.4]], 0.05));
    const valve = this.box(0.13, 0.13, 0.13, COL.enamel);
    valve.position.set(0.2, 0.9, 0);
    const stem = this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), this.steel());
    stem.rotation.x = Math.PI / 2;
    stem.position.set(0.2, 0.9, 0.14);
    const hw = this.mesh(new THREE.TorusGeometry(0.07, 0.01, 8, 28), COL.frame);
    hw.position.set(0.2, 0.9, 0.22);
    g.add(valve, stem, hw);
    return { group: g, anim: { phase: 0, rate: 0 } as LoomAnim };
  }

  private buildMachines() {
    const rng = mulberry32(42);
    for (const def of this.opts.machines) {
      let built: { group: THREE.Group; anim: LoomAnim; motor?: MotorRig };
      if (def.kind === 'loom') built = this.buildLoom(rng() * 10, def.id === 'L03' && activeFault().bearing);
      else if (def.kind === 'chakki') built = this.buildChakki();
      else built = this.buildPump();
      const g = built.group;
      g.position.set(...def.pos);
      g.userData.mid = def.id;
      this.scene.add(g);
      const edges: THREE.LineSegments[] = [];
      this.addEdges(g, this.edgeMat, edges);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.userData.mid = def.id; this.pickables.push(o); } });
      const bb = new THREE.Box3().setFromObject(g);
      this.rigs.set(def.id, {
        def, group: g, edges, bb, center: bb.getCenter(new THREE.Vector3()),
        foot: { x0: 0, x1: 0, z0: 0, z1: 0 }, anim: built.anim, motor: built.motor ?? null,
      });
    }
  }

  /** A pedestal fan: the stand-in for whatever the visitor's phone is listening to. */
  private buildLive() {
    const g = new THREE.Group();
    const base = this.mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.05, 36), COL.motor);
    base.position.y = 0.025;
    const pole = this.mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.02, 14), this.steel());
    pole.position.y = 0.56;
    const knob = this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), COL.motor);
    knob.position.y = 0.9;
    const housing = this.mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.2, 28), COL.motor);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0, 1.12, -0.09);
    const head = new THREE.Group();
    head.position.set(0, 1.12, 0.05);
    const ringG = (z: number) => {
      const t = this.mesh(new THREE.TorusGeometry(0.25, 0.006, 8, 64), this.steel());
      t.position.z = z;
      t.userData.noEdges = true;
      return t;
    };
    head.add(ringG(0.05), ringG(-0.05));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const w = this.mesh(new THREE.BoxGeometry(0.003, 0.25, 0.003), this.steel());
      w.position.set(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0.05);
      w.rotation.z = a - Math.PI / 2;
      w.userData.noEdges = true;
      head.add(w);
    }
    const blades = new THREE.Group();
    const hub = this.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 24), COL.frame);
    hub.rotation.x = Math.PI / 2;
    blades.add(hub);
    for (let i = 0; i < 3; i++) {
      const bl = this.mesh(new THREE.BoxGeometry(0.1, 0.19, 0.006), this.mat(COL.body, { side: THREE.DoubleSide }));
      const a = (i / 3) * Math.PI * 2;
      bl.position.set(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0);
      bl.rotation.set(0, 0.35, a - Math.PI / 2);
      blades.add(bl);
    }
    head.add(blades);
    g.add(base, pole, knob, housing, head);
    g.position.copy(LIVE_POS);
    g.rotation.y = -0.2;
    g.visible = false;
    this.scene.add(g);
    const edges: THREE.LineSegments[] = [];
    this.addEdges(g, this.edgeMat, edges);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.userData.mid = LIVE_ID; this.pickables.push(o); } });
    g.visible = true;
    const bb = new THREE.Box3().setFromObject(g);
    g.visible = false;
    // the painted label, like the machine numbers, but LIVE
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const x = c.getContext('2d')!;
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-anek').trim() || 'system-ui';
    x.fillStyle = 'rgba(23,25,28,.82)';
    x.font = `700 150px ${family}, system-ui, sans-serif`;
    x.fillText('LIVE', 8, 166);
    x.font = `600 44px ${family}, system-ui, sans-serif`;
    x.fillText('YOUR SENSOR', 14, 234);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(LIVE_POS.x + 0.2, 0.004, LIVE_POS.z + 0.78);
    label.renderOrder = 2;
    label.raycast = () => {};
    label.visible = false;
    this.scene.add(label);
    this.live = { group: g, edges, blades, bb, center: bb.getCenter(new THREE.Vector3()), label, chain: [], slot0: 0, on: false, cards: [] };
  }

  private buildFigure() {
    const fig = new THREE.Group();
    const limb = (r: number, len: number, x: number, y: number, z: number, rz = 0) => {
      const l = this.mesh(new THREE.CapsuleGeometry(r, len, 4, 10), COL.motor);
      l.position.set(x, y, z);
      l.rotation.z = rz;
      fig.add(l);
    };
    limb(0.075, 0.62, -0.1, 0.4, 0);
    limb(0.075, 0.62, 0.1, 0.4, 0);
    limb(0.17, 0.42, 0, 1.08, 0);
    limb(0.055, 0.5, -0.26, 1.02, 0.02, 0.12);
    limb(0.055, 0.5, 0.26, 1.02, 0.02, -0.12);
    const head = this.mesh(new THREE.SphereGeometry(0.11, 20, 14), COL.motor);
    head.position.y = 1.6;
    fig.add(head);
    fig.position.set(3.9, 0, 2.45);
    fig.rotation.y = -0.5;
    this.scene.add(fig);
  }

  private buildFloorPaint() {
    const cellGeo = new THREE.PlaneGeometry(0.21, 0.21);
    cellGeo.rotateX(-Math.PI / 2);
    for (const [id, rig] of this.rigs) {
      const snap = (v: number, f: (n: number) => number) => f(v / 0.25) * 0.25;
      const x0 = snap(rig.bb.min.x - 0.2, Math.floor), x1 = snap(rig.bb.max.x + 0.2, Math.ceil);
      const z0 = snap(rig.bb.min.z - 0.2, Math.floor), z1 = snap(rig.bb.max.z + 0.2, Math.ceil);
      const nx = Math.round((x1 - x0) / 0.25), nz = Math.round((z1 - z0) / 0.25);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
        const corner = (i < 3 || i > nx - 4) && (j < 3 || j > nz - 4);
        this.ringCells.push({ id, x: x0 + (i + 0.5) * 0.25, z: z0 + (j + 0.5) * 0.25, corner });
      }
      rig.foot = { x0, x1, z0, z1 };
      this.paintNumber(rig);
    }
    if (this.live) {
      const snap = (v: number, f: (n: number) => number) => f(v / 0.25) * 0.25;
      const b = this.live.bb;
      const x0 = snap(b.min.x - 0.2, Math.floor), x1 = snap(b.max.x + 0.2, Math.ceil);
      const z0 = snap(b.min.z - 0.2, Math.floor), z1 = snap(b.max.z + 0.2, Math.ceil);
      const nx = Math.round((x1 - x0) / 0.25), nz = Math.round((z1 - z0) / 0.25);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;
        const corner = (i < 2 || i > nx - 3) && (j < 2 || j > nz - 3);
        this.ringCells.push({ id: LIVE_ID, x: x0 + (i + 0.5) * 0.25, z: z0 + (j + 0.5) * 0.25, corner });
      }
    }
    this.ring = new THREE.InstancedMesh(cellGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), this.ringCells.length);
    this.ring.renderOrder = 1;
    this.ring.raycast = () => {};
    this.scene.add(this.ring);
  }

  private paintNumber(rig: Rig) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d')!;
    const family = getComputedStyle(document.documentElement).getPropertyValue('--font-anek').trim() || 'system-ui';
    g.fillStyle = 'rgba(23,25,28,.82)';
    g.font = `700 168px ${family}, system-ui, sans-serif`;
    g.fillText(rig.def.tag, 8, 176);
    g.font = `600 46px ${family}, system-ui, sans-serif`;
    g.fillText(rig.def.kind.toUpperCase(), 14, 236);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(rig.foot.x0 + 0.62, 0.004, rig.foot.z1 + 0.42);
    plane.renderOrder = 2;
    plane.raycast = () => {};
    this.scene.add(plane);
  }

  private buildChains() {
    const n = this.rigs.size + (this.live ? 1 : 0);
    this.cards = new THREE.InstancedMesh(new THREE.BoxGeometry(1.04, 0.1, 0.008), new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }), n * CHAIN);
    this.cards.castShadow = true;
    this.cards.raycast = () => {};
    this.holes = new THREE.InstancedMesh(new THREE.CircleGeometry(0.027, 18), new THREE.MeshBasicMaterial({ color: COL.hole }), n * CHAIN * 8);
    this.holes.raycast = () => {};
    this.scene.add(this.cards, this.holes);
    const tmp = new THREE.Object3D();
    for (const rig of this.rigs.values()) {
      const top = 3.7, cx = rig.center.x, cz = rig.center.z - 0.05;
      const rod = this.cylX(0.014, 1.2, this.steel(), 10);
      rod.position.set(cx, top + 0.07, cz);
      rod.userData.noEdges = true;
      this.scene.add(rod);
      const lace: THREE.Vector3[] = [];
      for (let j = 0; j < CHAIN; j++) {
        // fan-folded like a jacquard chain, leaning back so the punched faces read from above
        tmp.position.set(cx, top - j * 0.094, cz + (j % 2 ? 0.014 : -0.014));
        tmp.rotation.set((j % 2 ? 0.24 : -0.24) - 0.32, 0, 0);
        tmp.updateMatrix();
        this.cardMats.push(tmp.matrix.clone());
        lace.push(new THREE.Vector3(0.49, 0, 0).applyMatrix4(tmp.matrix));
        for (let h = 0; h < 8; h++) this.holeMats.push(tmp.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-0.385 + h * 0.11, 0, 0.0045)));
      }
      for (const side of [1, -1]) {
        const pts = lace.map((p) => new THREE.Vector3(cx + (p.x - cx) * side, p.y, p.z));
        pts.unshift(new THREE.Vector3(pts[0].x, top + 0.07, cz));
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.5 }));
        l.raycast = () => {};
        this.scene.add(l);
      }
    }
    // the live chain hangs lower, over the fan, and fills from the bottom every two seconds
    if (this.live) {
      const L = this.live;
      L.slot0 = this.rigs.size * CHAIN;
      const top = 2.75, cx = L.center.x, cz = L.center.z;
      const rod = this.cylX(0.014, 1.2, this.steel(), 10);
      rod.position.set(cx, top + 0.07, cz);
      rod.userData.noEdges = true;
      rod.visible = false;
      this.scene.add(rod);
      L.chain.push(rod);
      const lace: THREE.Vector3[] = [];
      for (let j = 0; j < CHAIN; j++) {
        tmp.position.set(cx, top - j * 0.094, cz + (j % 2 ? 0.014 : -0.014));
        tmp.rotation.set((j % 2 ? 0.24 : -0.24) - 0.32, 0, 0);
        tmp.updateMatrix();
        this.cardMats.push(tmp.matrix.clone());
        lace.push(new THREE.Vector3(0.49, 0, 0).applyMatrix4(tmp.matrix));
        for (let h = 0; h < 8; h++) this.holeMats.push(tmp.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(-0.385 + h * 0.11, 0, 0.0045)));
      }
      for (const side of [1, -1]) {
        const pts = lace.map((p) => new THREE.Vector3(cx + (p.x - cx) * side, p.y, p.z));
        pts.unshift(new THREE.Vector3(pts[0].x, top + 0.07, cz));
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.5 }));
        l.raycast = () => {};
        l.visible = false;
        this.scene.add(l);
        L.chain.push(l);
      }
    }
  }

  // ------------------------------------------------------------ state → paint
  private paint() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const c3 = new THREE.Color();
    const colorOf: Record<State, number> = { normal: COL.card, watch: COL.watch, act: COL.act, off: COL.off };
    [...this.rigs.values()].forEach((rig, mi) => {
      for (let j = 0; j < CHAIN; j++) {
        const slot = mi * CHAIN + j;
        const k = this.index - (CHAIN - 1) + j;
        if (k < 0) {
          this.cards.setMatrixAt(slot, zero);
          for (let h = 0; h < 8; h++) this.holes.setMatrixAt(slot * 8 + h, zero);
          continue;
        }
        const c = rig.def.cards[k];
        this.cards.setMatrixAt(slot, this.cardMats[slot]);
        this.cards.setColorAt(slot, c3.setHex(colorOf[c.off ? 'off' : c.state]));
        for (let h = 0; h < 8; h++) this.holes.setMatrixAt(slot * 8 + h, c.holes[h] ? this.holeMats[slot * 8 + h] : zero);
      }
    });
    const L = this.live;
    if (L) {
      for (let j = 0; j < CHAIN; j++) {
        const slot = L.slot0 + j;
        const card = L.on ? L.cards[L.cards.length - CHAIN + j] : undefined;
        if (!card) {
          this.cards.setMatrixAt(slot, zero);
          for (let h = 0; h < 8; h++) this.holes.setMatrixAt(slot * 8 + h, zero);
          continue;
        }
        this.cards.setMatrixAt(slot, this.cardMats[slot]);
        this.cards.setColorAt(slot, c3.setHex(colorOf[card.state]));
        for (let h = 0; h < 8; h++) this.holes.setMatrixAt(slot * 8 + h, card.holes[h] ? this.holeMats[slot * 8 + h] : zero);
      }
    }
    this.cards.instanceMatrix.needsUpdate = true;
    if (this.cards.instanceColor) this.cards.instanceColor.needsUpdate = true;
    this.holes.instanceMatrix.needsUpdate = true;
    const tmp = new THREE.Object3D();
    this.ringCells.forEach((rc, i) => {
      let st: State = 'normal';
      if (rc.id === LIVE_ID) {
        st = L?.on ? L.cards[L.cards.length - 1]?.state ?? 'normal' : 'off';
      } else {
        const def = this.rigs.get(rc.id)!.def;
        const c = def.cards[this.index];
        st = c.off ? [...def.cards.slice(0, this.index + 1)].reverse().find((x) => !x.off)?.state ?? 'normal' : c.state;
      }
      let show = st === 'watch' || st === 'act';
      let hex = st === 'act' ? COL.act : COL.watch;
      if (rc.id === this.selected && rc.corner && st !== 'off') { show = true; hex = COL.ink; }
      tmp.position.set(rc.x, 0.006, rc.z);
      tmp.scale.setScalar(show ? 1 : 0);
      tmp.updateMatrix();
      this.ring.setMatrixAt(i, tmp.matrix);
      this.ring.setColorAt(i, c3.setHex(hex));
    });
    this.ring.instanceMatrix.needsUpdate = true;
    if (this.ring.instanceColor) this.ring.instanceColor.needsUpdate = true;
    for (const [id, rig] of this.rigs) for (const e of rig.edges) e.material = id === this.selected ? this.edgeSel : this.edgeMat;
    if (L) for (const e of L.edges) e.material = this.selected === LIVE_ID ? this.edgeSel : this.edgeMat;
  }

  private setXray(m: MotorRig, on: boolean) {
    for (const mesh of m.meshes) {
      if (on) {
        mesh.userData.mat0 = mesh.userData.mat0 ?? mesh.material;
        const src = mesh.userData.mat0 as THREE.MeshStandardMaterial;
        const key = src.color.getHex();
        let x = this.xray.get(key);
        if (!x) { x = new THREE.MeshStandardMaterial({ color: key, transparent: true, opacity: 0.13, depthWrite: false, roughness: 0.6 }); this.xray.set(key, x); }
        mesh.material = x;
        mesh.castShadow = false;
      } else if (mesh.userData.mat0) {
        mesh.material = mesh.userData.mat0;
        mesh.castShadow = true;
      }
    }
    m.bearing.visible = on;
    if (!on) for (const [o, p] of m.home) o.position.copy(p);
  }

  // ------------------------------------------------------------ camera
  private flyTo(p1: THREE.Vector3, q1: THREE.Vector3, instant = false) {
    const dur = instant || this.opts.reducedMotion ? 0 : 380;
    this.fly = { t0: performance.now(), dur, p0: this.camera.position.clone(), q0: this.controls.target.clone(), p1, q1 };
    if (dur === 0) { this.camera.position.copy(p1); this.controls.target.copy(q1); this.fly = null; }
  }
  private focusMachine(id: string) {
    const rig = id === LIVE_ID ? this.live : this.rigs.get(id);
    if (!rig) return;
    const t = rig.center.clone();
    t.y = 0.9;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const p = t.clone().add(dir.multiplyScalar(8.2));
    p.y = Math.max(p.y, 4.2);
    this.flyTo(p, t);
  }

  // ------------------------------------------------------------ input
  private ndc = new THREE.Vector2();
  private ray = new THREE.Raycaster();
  private pick(e: PointerEvent | MouseEvent): string | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObjects(this.pickables, false).find((h) => h.object.userData.mid !== LIVE_ID || this.live?.on);
    return hit ? (hit.object.userData.mid as string) : null;
  }
  private onDown = (e: PointerEvent) => { this.downAt = [e.clientX, e.clientY]; };
  private onUp = (e: PointerEvent) => {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 5) return;
    const id = this.pick(e);
    if (id) this.opts.onSelect(id);
  };
  private onMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const id = this.pick(e);
    if (id !== this.hoverId) { this.hoverId = id; this.renderer.domElement.style.cursor = id ? 'pointer' : ''; }
    this.opts.onHover(id);
  };
  private onLeave = () => { this.hoverId = null; this.opts.onHover(null); };
  private onDouble = (e: MouseEvent) => { const id = this.pick(e); if (id && this.canInspect(id)) { this.opts.onSelect(id); this.inspect(id); } };

  // ------------------------------------------------------------ loop
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h || (w === this.lastW && h === this.lastH)) return;
    this.lastW = w;
    this.lastH = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.fov = w < 640 ? 40 : 30;
    this.camera.updateProjectionMatrix();
  }

  private frame = (time: number) => {
    const t = time / 1000;
    const dt = Math.min(0.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    if (!this.opts.reducedMotion) {
      for (const rig of this.rigs.values()) {
        const a = rig.anim;
        if (a.wheel) a.wheel.rotation.x = -(t + a.phase) * (rig.def.kind === 'loom' ? 2 * Math.PI * a.rate : 5);
        if (!a.sley || !a.hA || !a.hB || !a.shuttle || !a.warp || !a.warpN) continue;
        const picks = (t + a.phase) * a.rate;
        const shed = 0.055 * Math.sin(Math.PI * picks);
        a.hA.position.y = 1.04 + shed;
        a.hB.position.y = 1.04 - shed;
        a.sley.rotation.x = 0.1 * Math.cos(2 * Math.PI * picks);
        const s = Math.min(1, Math.max(0, ((picks % 1) - 0.22) / 0.5));
        a.shuttle.position.x = (Math.floor(picks) % 2 ? 1 : -1) * (-1.4 + 2.8 * s);
        const p = a.warp.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < a.warpN; i++) { const y = 1.04 + (i % 2 ? -shed : shed); p[i * 12 + 4] = y; p[i * 12 + 7] = y; }
        a.warp.geometry.attributes.position.needsUpdate = true;
      }
    }
    if (this.live?.on && !this.opts.reducedMotion) this.live.blades.rotation.z -= dt * 2 * Math.PI * 3.2;
    // inspection: the cage turns at FTF, slowed 40×; each ball crossing the spall flashes it for two frames
    if (this.inspecting) {
      const m = this.rigs.get(this.inspecting)?.motor;
      if (m) {
        if (!this.opts.reducedMotion) this.simT += dt / SLOW;
        const F = defectFactors();
        const cage = 2 * Math.PI * F.FTF * this.shaftHz * this.simT;
        m.balls.rotation.x = cage;
        if (m.spall) {
          for (let i = 0; i < 9; i++) {
            const a = cage + (i / 9) * Math.PI * 2;
            const rel = ((((a - Math.PI) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
            if (this.lastPass[i] !== undefined && this.lastPass[i] < 0 && rel >= 0) this.flash = 2;
            this.lastPass[i] = rel;
          }
          (m.spall.material as THREE.MeshBasicMaterial).color.setHex(this.flash > 0 ? COL.ink : COL.act);
          m.spall.scale.setScalar(this.flash > 0 ? 1.6 : 1);
          if (this.flash > 0) this.flash -= 1;
        }
        // exploded view, linear travel with a hard stop
        const step = this.opts.reducedMotion ? 1 : dt / 0.38;
        this.exploded = this.explodeTarget > this.exploded ? Math.min(this.explodeTarget, this.exploded + step) : Math.max(this.explodeTarget, this.exploded - step);
        const off: [THREE.Object3D, THREE.Vector3][] = [
          [m.bell, new THREE.Vector3(-0.2, 0, 0)], [m.bearing, new THREE.Vector3(-0.11, 0, 0)],
          [m.cowl, new THREE.Vector3(0.2, 0, 0)], [m.box, new THREE.Vector3(0, 0.14, 0)],
        ];
        for (const [o, d] of off) o.position.copy(m.home.get(o)!).addScaledVector(d, this.exploded);
      }
    }
    if (this.fly) {
      const k = this.fly.dur ? Math.min(1, (performance.now() - this.fly.t0) / this.fly.dur) : 1;
      this.camera.position.lerpVectors(this.fly.p0, this.fly.p1, k);
      this.controls.target.lerpVectors(this.fly.q0, this.fly.q1, k);
      if (k >= 1) this.fly = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
