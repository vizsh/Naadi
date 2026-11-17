// The jacquard reading head, in 3D. A chain of punched cards rises through the head; the card
// on the prism's front face is read by eight needles, one per hole position. Needles over a
// hole pass through; the rest are pushed back. The prism turns a quarter for every card, as
// on a loom. The landing page feeds Loom 03's fortnight through it on scroll; the agent
// console feeds the run's tool calls through it, with the owner's latch across the chain.
// Matte forms with faint ink edges, like the shed. No glow, no bloom.
import * as THREE from 'three';

export type CardPaint = 'normal' | 'watch' | 'act' | 'off' | 'blank' | 'ink' | 'paper';
export interface ReaderCard { holes: boolean[]; paint: CardPaint; /** an ink frame around the card (a booked repair) */ frame?: boolean }
export interface ReaderAnchors {
  /** where each needle meets the head, in CSS pixels of the canvas */
  needles: { x: number; y: number }[];
  /** the right end of the head, for the readout */
  head: { x: number; y: number };
  /** the latch handle while the latch is down */
  latch: { x: number; y: number } | null;
  /** the card being read, or null while the chain is moving */
  reading: number | null;
}
export interface ReaderOptions {
  cards: ReaderCard[];
  reducedMotion: boolean;
  /** cards per second the chain feeds at; long jumps go faster so they finish in about a second */
  speed?: number;
  onAnchors?: (a: ReaderAnchors) => void;
}

const COL = {
  frame: 0x59626a, steel: 0xb8bec3, prism: 0x7b858d, ink: 0x17191c, hole: 0x1b1d20,
  normal: 0x6e7b86, watch: 0xd99a00, act: 0xc8372a, off: 0xcdd1ca, blank: 0xdfe3da, paper: 0xf3f4ef,
};
const PAINT: Record<CardPaint, number> = { normal: COL.normal, watch: COL.watch, act: COL.act, off: COL.off, blank: COL.blank, ink: COL.ink, paper: COL.paper };
const W = 1.6, H = 0.24, T = 0.012, PITCH = 0.27, HOLES = 8, HOLE_R = 0.042, MAX = 96, SHOWN = 10;
const holeX = (i: number) => -0.595 + i * 0.17;
const CARD_Z = 0.18;

export class ReaderEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  private cards: THREE.InstancedMesh;
  private holes: THREE.InstancedMesh;
  private frame: THREE.LineSegments;
  private prism: THREE.Group;
  private needles: THREE.Mesh[] = [];
  private latch: THREE.Group;
  private data: ReaderCard[] = [];
  private pos = 0;
  private target = 0;
  private needleOut: number[] = new Array(HOLES).fill(0);
  private latchOn = false;
  private latchLift = 1;
  private running = false;
  private lastFrame = 0;
  private lastW = 0;
  private lastH = 0;
  private dirty = true;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private disposed = false;
  private tmp = new THREE.Object3D();
  private c3 = new THREE.Color();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private holeOffset = Array.from({ length: HOLES }, (_, h) => new THREE.Matrix4().makeTranslation(holeX(h), 0, T / 2 + 0.0015));
  private m4 = new THREE.Matrix4();

  constructor(private host: HTMLElement, private opts: ReaderOptions) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    r.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(r.domElement);
    this.renderer = r;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd6d9d0, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.9);
    sun.position.set(3, 5, 6);
    this.scene.add(sun);

    const edge = new THREE.LineBasicMaterial({ color: COL.ink, transparent: true, opacity: 0.22, depthWrite: false });
    const mat = (c: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.05, ...o });
    const steel = mat(COL.steel, { roughness: 0.4, metalness: 0.6 });
    const withEdges = (m: THREE.Mesh) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), edge); m.add(e); return m; };

    // the frame: two cheeks, a griffe bar across the top, a needle board in front
    for (const sx of [-1, 1]) {
      const cheek = withEdges(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 1.12), mat(COL.frame)));
      cheek.position.set(sx * 0.98, 0, 0.25);
      this.scene.add(cheek);
    }
    const griffe = withEdges(new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.05, 0.06), mat(COL.frame)));
    griffe.position.set(0, 0.44, 0.62);
    const board = withEdges(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.14), mat(COL.prism)));
    board.position.set(0, 0, 0.7);
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.1, 16), steel);
    spindle.rotation.z = Math.PI / 2;
    this.scene.add(griffe, board, spindle);

    // the prism: a square block with a row of holes on every face, turning a quarter per card
    this.prism = new THREE.Group();
    const block = withEdges(new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.3, 0.3), mat(COL.prism)));
    this.prism.add(block);
    const pHole = new THREE.CircleGeometry(0.034, 16);
    const pMat = new THREE.MeshBasicMaterial({ color: COL.hole });
    for (let f = 0; f < 4; f++) {
      const face = new THREE.Group();
      face.rotation.x = (f * Math.PI) / 2;
      for (let i = 0; i < HOLES; i++) {
        const h = new THREE.Mesh(pHole, pMat);
        h.position.set(holeX(i), 0, 0.151);
        face.add(h);
      }
      this.prism.add(face);
    }
    this.scene.add(this.prism);

    // eight needles, one per hole position, sliding in the needle board
    const nGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.56, 10);
    nGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < HOLES; i++) {
      const n = new THREE.Mesh(nGeo, steel);
      n.position.set(holeX(i), 0, CARD_Z + 0.28 + 0.06);
      this.needles.push(n);
      this.scene.add(n);
    }

    // the chain: one instanced mesh of cards, one of holes
    this.cards = new THREE.InstancedMesh(new THREE.BoxGeometry(W, H, T), new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 }), MAX);
    this.holes = new THREE.InstancedMesh(new THREE.CircleGeometry(HOLE_R, 18), new THREE.MeshBasicMaterial({ color: COL.hole }), MAX * HOLES);
    this.cards.frustumCulled = this.holes.frustumCulled = false;
    this.scene.add(this.cards, this.holes);
    this.frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.02, H + 0.02, T + 0.004)), new THREE.LineBasicMaterial({ color: COL.ink }));
    this.frame.visible = false;
    this.scene.add(this.frame);

    // the owner's latch: an ink bar across the chain under the head, with a handle on the right
    this.latch = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.055, 0.055), mat(COL.ink));
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.07), mat(COL.ink));
    handle.position.set(1.06, 0.1, 0);
    this.latch.add(bar, handle);
    this.latch.position.set(0, -(PITCH * 0.62), CARD_Z + 0.05);
    this.latch.visible = false;
    this.scene.add(this.latch);

    this.setCards(opts.cards);
    this.ro = new ResizeObserver(() => { this.resize(); this.dirty = true; if (!this.running) this.frameFn(performance.now()); });
    this.ro.observe(host);
    this.resize();
    this.io = new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop()));
    this.io.observe(host);
  }

  // ------------------------------------------------------------ public API
  setCards(cards: ReaderCard[]) {
    this.data = cards.slice(0, MAX);
    for (let j = 0; j < MAX; j++) this.cards.setColorAt(j, this.c3.setHex(PAINT[this.data[j]?.paint ?? 'blank']));
    if (this.cards.instanceColor) this.cards.instanceColor.needsUpdate = true;
    this.dirty = true;
  }
  /** Feed the chain until card k is on the prism. */
  setIndex(k: number) {
    this.target = Math.max(0, Math.min(this.data.length - 1, Math.round(k)));
    if (this.opts.reducedMotion) this.pos = this.target;
    this.dirty = true;
  }
  /** Drop or lift the owner's latch across the chain. */
  setLatch(on: boolean) { this.latchOn = on; if (this.opts.reducedMotion) this.latchLift = on ? 0 : 1; this.dirty = true; }
  start() { if (!this.running && !this.disposed) { this.running = true; this.lastFrame = performance.now(); this.renderer.setAnimationLoop(this.frameFn); } }
  stop() { this.running = false; this.renderer.setAnimationLoop(null); }
  renderOnce() { this.resize(); this.dirty = true; this.frameFn(performance.now()); }
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

  // ------------------------------------------------------------ layout
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
    // keep the whole head (cheek to cheek, plus the latch handle) in frame whatever the aspect
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const d = Math.max(4.2, 1.32 / (half * aspect));
    const dir = new THREE.Vector3(0.36, 0.34, 1).normalize();
    this.camera.position.copy(dir.multiplyScalar(d)).add(new THREE.Vector3(0.06, 0, 0));
    this.camera.lookAt(0.06, 0, 0);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Where card j sits when the chain is at position p: read cards rise above, unread wait below. */
  private place(j: number, p: number) {
    const u = j - p;
    const t = this.tmp;
    if (Math.abs(u) > SHOWN) { return null; }
    const fold = Math.min(1, Math.max(0, Math.abs(u) - 0.55) / 0.6);
    const side = j % 2 ? 1 : -1;
    t.position.set(0, -u * PITCH, CARD_Z + fold * side * 0.02 - fold * 0.05);
    t.rotation.set(fold * side * 0.24, 0, 0);
    t.updateMatrix();
    return t.matrix;
  }

  private paint() {
    const p = this.pos;
    for (let j = 0; j < MAX; j++) {
      const m = j < this.data.length ? this.place(j, p) : null;
      if (!m) {
        this.cards.setMatrixAt(j, this.zero);
        for (let h = 0; h < HOLES; h++) this.holes.setMatrixAt(j * HOLES + h, this.zero);
        continue;
      }
      this.cards.setMatrixAt(j, m);
      const card = this.data[j];
      for (let h = 0; h < HOLES; h++) {
        this.holes.setMatrixAt(j * HOLES + h, card.holes[h] ? this.m4.multiplyMatrices(m, this.holeOffset[h]) : this.zero);
      }
      if (card.frame) { this.frame.visible = true; this.frame.matrixAutoUpdate = false; this.frame.matrix.copy(m); this.frame.matrixWorldNeedsUpdate = true; }
    }
    if (!this.data.some((c, j) => c.frame && Math.abs(j - p) <= SHOWN)) this.frame.visible = false;
    this.cards.instanceMatrix.needsUpdate = true;
    this.holes.instanceMatrix.needsUpdate = true;
  }

  private anchors(reading: number | null): ReaderAnchors {
    const rect = { w: this.lastW, h: this.lastH };
    const proj = (v: THREE.Vector3) => { const s = v.project(this.camera); return { x: ((s.x + 1) / 2) * rect.w, y: ((1 - s.y) / 2) * rect.h }; };
    return {
      needles: Array.from({ length: HOLES }, (_, i) => proj(new THREE.Vector3(holeX(i), 0.06, 0.78))),
      head: proj(new THREE.Vector3(1.02, 0.0, 0.25)),
      latch: this.latch.visible ? proj(new THREE.Vector3(1.06, this.latch.position.y + 0.12, this.latch.position.z)) : null,
      reading,
    };
  }

  // ------------------------------------------------------------ loop
  private frameFn = (time: number) => {
    const dt = Math.min(0.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    let moving = false;
    // linear travel with a hard stop, a quarter turn of the prism per card
    if (this.pos !== this.target) {
      const gap = this.target - this.pos;
      const v = Math.max(this.opts.speed ?? 7, Math.abs(gap) / 1.1);
      const step = v * dt;
      this.pos = Math.abs(gap) <= step ? this.target : this.pos + Math.sign(gap) * step;
      moving = true;
    }
    this.prism.rotation.x = -this.pos * (Math.PI / 2);
    // needles: retracted while the chain moves; on a still card, through the holes or pushed back
    const still = this.pos === this.target;
    const reading = still ? this.target : null;
    const card = reading !== null ? this.data[reading] : null;
    for (let i = 0; i < HOLES; i++) {
      const want = !card || card.paint === 'blank' ? 0.1 : card.holes[i] ? -0.07 : 0.09;
      const cur = this.needleOut[i];
      const nxt = this.opts.reducedMotion ? want : cur + Math.sign(want - cur) * Math.min(Math.abs(want - cur), dt * 2.2);
      if (nxt !== cur) moving = true;
      this.needleOut[i] = nxt;
      this.needles[i].position.z = CARD_Z + 0.28 + 0.06 + nxt;
    }
    // the latch swings down across the chain, or up out of the way
    const lw = this.latchOn ? 0 : 1;
    if (this.latchLift !== lw) {
      this.latchLift = this.opts.reducedMotion ? lw : this.latchLift + Math.sign(lw - this.latchLift) * Math.min(Math.abs(lw - this.latchLift), dt * 4);
      moving = true;
    }
    this.latch.visible = this.latchLift < 0.999;
    this.latch.rotation.x = -this.latchLift * 1.2;
    if (moving || this.dirty) {
      this.paint();
      this.renderer.render(this.scene, this.camera);
      this.opts.onAnchors?.(this.anchors(reading));
      this.dirty = moving;
    }
  };
}
