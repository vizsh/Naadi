// The agents, in 3D. Seven roles stand on point paper as distinct objects, each shaped by its
// job, joined by the handoffs of the roster: the Sentinel's scanning post, the Diagnostician's
// lens, the weaver's voice note, the Prognostician's hourglass, Procurement's crate, the
// Planner's calendar, the Dispatcher's arrow and the owner's phone behind a gate. During a run
// a punched card travels the link each call uses, the acting agent rises on an ink plinth, and
// the gate stays shut until the owner approves. Matte forms, ink edges, no glow.
import * as THREE from 'three';

export type AgentId = 'SE' | 'DI' | 'WN' | 'PR' | 'PC' | 'PL' | 'DS' | 'OW';
export const AGENTS: { id: AgentId; name: string; pos: [number, number] }[] = [
  { id: 'SE', name: 'Sentinel', pos: [-3.3, -0.9] },
  { id: 'WN', name: 'Worker note', pos: [-3.1, 1.5] },
  { id: 'DI', name: 'Diagnostician', pos: [-1.5, 0.3] },
  { id: 'PR', name: 'Prognostician', pos: [0.1, -1.0] },
  { id: 'PC', name: 'Procurement', pos: [0.2, 1.6] },
  { id: 'PL', name: 'Planner', pos: [1.7, 0.3] },
  { id: 'DS', name: 'Dispatcher', pos: [2.9, -1.2] },
  { id: 'OW', name: 'Owner', pos: [4.7, 0.4] },
];
/** The roster's handoffs (docs/04): who passes work to whom. */
export const LINKS: [AgentId, AgentId][] = [
  ['SE', 'DI'], ['WN', 'DI'], ['DI', 'PR'], ['PR', 'PL'], ['PC', 'PL'], ['PL', 'DS'], ['PL', 'OW'], ['PC', 'OW'], ['DS', 'OW'],
];

export interface AgentAnchors {
  agents: Record<AgentId, { x: number; y: number }>;
  gate: { x: number; y: number };
}
export interface AgentsOptions { reducedMotion: boolean; onAnchors?: (a: AgentAnchors) => void }

const C = { ink: 0x17191c, body: 0x7b858d, frame: 0x59626a, steel: 0xb8bec3, slate: 0x6e7b86, plinth: 0xe2e6dd, paper: 0xf9faf6, card: 0x6e7b86 };
const GATE_X = 3.85;

export class AgentsEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  private figures = new Map<AgentId, THREE.Group>();
  private plinths = new Map<AgentId, THREE.Mesh>();
  private links: { a: AgentId; b: AgentId; line: THREE.Line; mat: THREE.LineDashedMaterial }[] = [];
  private packet: THREE.Group;
  private ring: THREE.Mesh;
  private gateBar!: THREE.Mesh;
  private active: AgentId | null = null;
  private done = new Set<AgentId>();
  private travel: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private lift = new Map<AgentId, number>();
  private gateOpen = 1;
  private gateTarget = 1;
  private spin = 0;
  private running = false;
  private last = 0;
  private lastW = 0;
  private lastH = 0;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private disposed = false;
  private plinthMat = new THREE.MeshStandardMaterial({ color: C.plinth, roughness: 0.95 });
  private plinthOn = new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.9 });
  private plinthDone = new THREE.MeshStandardMaterial({ color: 0xc9cfc6, roughness: 0.95 });

  constructor(private host: HTMLElement, private opts: AgentsOptions) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(r.domElement);
    this.renderer = r;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d9d0, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(4, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 1, far: 30 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.ShadowMaterial({ color: 0x1d2b27, opacity: 0.16 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.receiveShadow = true;
    this.scene.add(catcher);

    for (const a of AGENTS) this.build(a.id, a.pos);
    this.buildLinks();
    this.buildGate();

    // the card that travels a link: a little punched card, slate with ink holes
    this.packet = new THREE.Group();
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.16), new THREE.MeshStandardMaterial({ color: C.card, roughness: 0.9 }));
    card.castShadow = true;
    this.packet.add(card);
    for (let i = 0; i < 4; i++) {
      const h = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), new THREE.MeshBasicMaterial({ color: C.ink }));
      h.rotation.x = -Math.PI / 2;
      h.position.set(-0.15 + i * 0.1, 0.007, 0);
      this.packet.add(h);
    }
    this.packet.visible = false;
    this.scene.add(this.packet);
    // the ring painted round the acting agent's plinth
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.68, 48), new THREE.MeshBasicMaterial({ color: C.ink }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.004;
    this.ring.visible = false;
    this.scene.add(this.ring);

    this.ro = new ResizeObserver(() => { this.resize(); if (!this.running) this.frame(performance.now()); });
    this.ro.observe(host);
    this.resize();
    this.io = new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop()));
    this.io.observe(host);
  }

  // ------------------------------------------------------------ public API
  /** The agent now acting, and who handed it the work (a card travels that link). */
  setActive(id: AgentId | null, from: AgentId | null = null) {
    if (id === this.active) return;
    if (this.active) this.done.add(this.active);
    this.active = id;
    if (id && from && from !== id) {
      const a = this.figures.get(from)!.position, b = this.figures.get(id)!.position;
      this.travel = { from: new THREE.Vector3(a.x, 0.95, a.z), to: new THREE.Vector3(b.x, 0.95, b.z), t: this.opts.reducedMotion ? 1 : 0 };
    } else this.travel = null;
    this.paintLinks(from, id);
  }
  /** Start over: no agent done, none acting. */
  reset() { this.done.clear(); this.active = null; this.travel = null; this.paintLinks(null, null); }
  setGate(open: boolean) { this.gateTarget = open ? 1 : 0; if (this.opts.reducedMotion) this.gateOpen = this.gateTarget; }
  start() { if (!this.running && !this.disposed) { this.running = true; this.last = performance.now(); this.renderer.setAnimationLoop(this.frame); } }
  stop() { this.running = false; this.renderer.setAnimationLoop(null); }
  dispose() {
    this.disposed = true;
    this.stop();
    this.ro.disconnect();
    this.io.disconnect();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mt = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mt)) mt.forEach((x) => x.dispose()); else mt?.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ------------------------------------------------------------ the figures
  private mat(c: number, o: THREE.MeshStandardMaterialParameters = {}) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0.05, ...o }); }
  private edged(m: THREE.Mesh) {
    m.castShadow = true;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.3 }));
    m.add(e);
    return m;
  }
  private build(id: AgentId, [x, z]: [number, number]) {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 1.0), this.plinthMat);
    plinth.position.set(x, 0.04, z);
    plinth.receiveShadow = true;
    this.scene.add(plinth);
    this.plinths.set(id, plinth);
    const g = new THREE.Group();
    g.position.set(x, 0.08, z);
    const body = this.mat(C.body), frame = this.mat(C.frame), steel = this.mat(C.steel, { roughness: 0.4, metalness: 0.6 });
    const add = (m: THREE.Mesh, px = 0, py = 0, pz = 0) => { m.position.set(px, py, pz); g.add(this.edged(m)); return m; };
    switch (id) {
      case 'SE': { // a scanning post: it reads every card
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.3, 20), frame), 0, 0.65);
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 10, 40), steel), 0, 1.1);
        ring.rotation.x = Math.PI / 2;
        ring.name = 'spin';
        add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.08), this.mat(C.ink)), 0, 1.35);
        break;
      }
      case 'DI': { // a lens on a stand: it looks inside
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 12), frame), 0, 0.3);
        const lens = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 48), frame), 0, 0.95);
        lens.rotation.y = 0.5;
        const glass = add(new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), this.mat(0xc6d6d1, { transparent: true, opacity: 0.55, side: THREE.DoubleSide })), 0, 0.95);
        glass.rotation.y = 0.5;
        add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), frame), 0, 0.03);
        break;
      }
      case 'WN': { // a voice note: a microphone capsule
        add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 6, 18), body), 0, 0.72);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 10), steel), 0, 0.28);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 24), frame), 0, 0.03);
        break;
      }
      case 'PR': { // an hourglass: time left
        add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 24), body), 0, 0.42).rotation.x = Math.PI;
        add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 24), body), 0, 0.92);
        for (const y of [0.14, 1.2]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 24), frame), 0, y);
        for (const a of [0, 2.1, 4.2]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.06, 8), steel), Math.cos(a) * 0.33, 0.67, Math.sin(a) * 0.33);
        break;
      }
      case 'PC': { // a parts crate: stock and lead times
        add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.56), this.mat(0x7b6448)), 0, 0.25);
        for (const y of [0.12, 0.38]) add(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.58), frame), 0, y);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 28), steel), 0, 0.54).rotation.x = 0;
        break;
      }
      case 'PL': { // a calendar: three stacked windows
        for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5), i === 1 ? this.mat(C.paper) : body), (i - 1) * 0.06, 0.08 + i * 0.16, (1 - i) * 0.05);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.5, 0.04), this.mat(C.paper)), 0, 0.7, -0.18).rotation.x = -0.2;
        break;
      }
      case 'DS': { // an arrow: a slot held for the technician
        const s = new THREE.Shape();
        s.moveTo(-0.38, -0.12); s.lineTo(0.08, -0.12); s.lineTo(0.08, -0.26); s.lineTo(0.4, 0); s.lineTo(0.08, 0.26); s.lineTo(0.08, 0.12); s.lineTo(-0.38, 0.12); s.closePath();
        const geo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false });
        geo.translate(0, 0, -0.07);
        add(new THREE.Mesh(geo, body), 0, 0.62).rotation.y = -0.4;
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 10), frame), 0, 0.3);
        break;
      }
      case 'OW': { // the owner's phone: the only place anything is sent from
        add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.92, 0.07), this.mat(C.ink)), 0, 0.56).rotation.y = -0.35;
        const screen = add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.78), this.mat(C.paper)), 0, 0.57);
        screen.rotation.y = -0.35;
        screen.position.add(new THREE.Vector3(Math.sin(-0.35) * 0.04, 0, Math.cos(-0.35) * 0.04));
        add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.24), frame), 0, 0.03);
        break;
      }
    }
    this.scene.add(g);
    this.figures.set(id, g);
    this.lift.set(id, 0);
  }

  private buildLinks() {
    for (const [a, b] of LINKS) {
      const pa = AGENTS.find((x) => x.id === a)!.pos, pb = AGENTS.find((x) => x.id === b)!.pos;
      // a cord on the floor, raised where it meets each plinth
      const pts = [new THREE.Vector3(pa[0], 0.09, pa[1]), new THREE.Vector3((pa[0] + pb[0]) / 2, 0.02, (pa[1] + pb[1]) / 2), new THREE.Vector3(pb[0], 0.09, pb[1])];
      const geo = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(pts[0], pts[1], pts[2]).getPoints(24));
      const mat = new THREE.LineDashedMaterial({ color: C.ink, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.35 });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      this.scene.add(line);
      this.links.push({ a, b, line, mat });
    }
  }
  private paintLinks(from: AgentId | null, to: AgentId | null) {
    for (const l of this.links) {
      const on = !!from && !!to && ((l.a === from && l.b === to) || (l.a === to && l.b === from));
      l.mat.opacity = on ? 1 : 0.32;
      l.mat.dashSize = on ? 1 : 0.12;
      l.mat.gapSize = on ? 0 : 0.08;
    }
  }
  private buildGate() {
    const frame = this.mat(C.frame);
    for (const z of [-0.9, 1.7]) {
      const post = this.edged(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), frame));
      post.position.set(GATE_X, 0.75, z);
      this.scene.add(post);
    }
    const lintel = this.edged(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.7), frame));
    lintel.position.set(GATE_X, 1.5, 0.4);
    this.scene.add(lintel);
    // the latch bar swings up to open
    const pivot = new THREE.Group();
    pivot.position.set(GATE_X, 0.6, -0.9);
    this.gateBar = this.edged(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.6), this.mat(C.ink)));
    this.gateBar.position.set(0, 0, 1.3);
    pivot.add(this.gateBar);
    pivot.name = 'gate';
    this.scene.add(pivot);
  }

  // ------------------------------------------------------------ layout and loop
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h || (w === this.lastW && h === this.lastH)) return;
    this.lastW = w;
    this.lastH = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    const aspect = w / h;
    this.camera.aspect = aspect;
    // frame the row of agents, from the Sentinel to the owner, whatever the aspect
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const d = Math.max(9.5, 6.3 / (half * aspect));
    const dir = new THREE.Vector3(0.08, 1.05, 1).normalize();
    this.camera.position.copy(dir.multiplyScalar(d)).add(new THREE.Vector3(0.7, 0, 0.3));
    this.camera.lookAt(0.7, 0.2, 0.3);
    this.camera.updateProjectionMatrix();
  }
  private anchors(): AgentAnchors {
    const proj = (v: THREE.Vector3) => { const s = v.project(this.camera); return { x: ((s.x + 1) / 2) * this.lastW, y: ((1 - s.y) / 2) * this.lastH }; };
    const agents = {} as AgentAnchors['agents'];
    for (const [id, g] of this.figures) agents[id] = proj(new THREE.Vector3(g.position.x, g.position.y + 1.55, g.position.z));
    return { agents, gate: proj(new THREE.Vector3(GATE_X, 0, 2.05)) };
  }
  private frame = (time: number) => {
    const dt = Math.min(0.05, Math.max(0, (time - this.last) / 1000));
    this.last = time;
    const rm = this.opts.reducedMotion;
    // the acting agent rises on an ink plinth; finished ones settle on grey
    for (const [id, g] of this.figures) {
      const want = id === this.active ? 0.22 : 0;
      const cur = this.lift.get(id)!;
      const nxt = rm ? want : cur + Math.sign(want - cur) * Math.min(Math.abs(want - cur), dt * 1.6);
      this.lift.set(id, nxt);
      g.position.y = 0.08 + nxt;
      this.plinths.get(id)!.material = id === this.active ? this.plinthOn : this.done.has(id) ? this.plinthDone : this.plinthMat;
    }
    const act = this.active ? this.figures.get(this.active)! : null;
    this.ring.visible = !!act;
    if (act) this.ring.position.set(act.position.x, 0.004, act.position.z);
    // the Sentinel's ring keeps scanning
    if (!rm) this.spin += dt * 1.4;
    this.figures.get('SE')!.getObjectByName('spin')!.rotation.z = this.spin;
    // the card travels the link in use, linearly, and stops hard
    if (this.travel) {
      this.travel.t = Math.min(1, this.travel.t + dt / 0.55);
      this.packet.visible = this.travel.t < 1;
      this.packet.position.lerpVectors(this.travel.from, this.travel.to, this.travel.t);
      this.packet.position.y += Math.sin(Math.PI * this.travel.t) * 0.35;
      this.packet.rotation.y = Math.atan2(this.travel.to.x - this.travel.from.x, this.travel.to.z - this.travel.from.z) + Math.PI / 2;
      if (this.travel.t >= 1) this.travel = null;
    } else this.packet.visible = false;
    // the gate's bar swings up when the owner approves
    this.gateOpen = rm ? this.gateTarget : this.gateOpen + Math.sign(this.gateTarget - this.gateOpen) * Math.min(Math.abs(this.gateTarget - this.gateOpen), dt * 2.5);
    this.scene.getObjectByName('gate')!.rotation.x = -this.gateOpen * 1.35;
    this.renderer.render(this.scene, this.camera);
    this.opts.onAnchors?.(this.anchors());
  };
}
