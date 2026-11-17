// Live Lab engine: the microphone (or a synthesised fan) as a real sensor.
// Per frame (about 20 per second): 16 log-spaced band energies, level, crest factor,
// kurtosis, spectral flatness and centroid. "Learn normal" fits a mean and a Ledoit–Wolf
// shrunk covariance; every later frame gets a Mahalanobis distance against a threshold
// taken from the device's own normal. A card is punched every two seconds.
// Audio is analysed in memory and never leaves the device.

export const BANDS = 16;
const F_LO = 60, F_HI = 8000;
export const CHANNELS = ['Level', 'Impulse', 'Low', 'Low-mid', 'Mid', 'High', 'Tonality', 'Brightness'] as const;
export type LabPhase = 'idle' | 'listening' | 'learning' | 'watching';
export type CardState = 'normal' | 'watch' | 'act';
export interface LabCard { id: number; holes: boolean[]; state: CardState; dMean: number }
export interface Snapshot {
  phase: LabPhase; source: 'mic' | 'demo' | null; learnProgress: number;
  d2: number; threshold: number; history: number[]; cards: LabCard[];
  changed: { lo: number; hi: number; db: number }[]; fault: boolean; level: number; motion: { rms: number; hz: number } | null;
  error: string | null;
}

const FRAME_MS = 50, CARD_FRAMES = 40, LEARN_FRAMES = 400, HISTORY = 240;

export class LabEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private demo: { fan: AudioBufferSourceNode; knock: AudioBufferSourceNode; knockGain: GainNode } | null = null;
  private timer = 0;
  private freq = new Float32Array(0);
  private time = new Float32Array(0);
  private edges: number[] = [];
  private train: number[][] = [];
  private trainSpec: Float32Array | null = null;
  private trainCount = 0;
  private mu: number[] = [];
  private sd: number[] = [];
  private prec: number[][] = [];
  private cardBuf: { z: number[]; d2: number; bands: number[] }[] = [];
  private baseBands: number[] = [];
  private nextId = 1;
  private specView: Float32Array = new Float32Array(256);
  private motionBuf: number[] = [];
  private motionOn = false;
  snap: Snapshot = { phase: 'idle', source: null, learnProgress: 0, d2: 0, threshold: 0, history: [], cards: [], changed: [], fault: false, level: -100, motion: null, error: null };
  private listeners = new Set<() => void>();
  spectrumCanvas: HTMLCanvasElement | null = null;
  waterfallCanvas: HTMLCanvasElement | null = null;

  /** Give the engine the two canvases it draws into every frame. */
  attach(spectrum: HTMLCanvasElement | null, waterfall: HTMLCanvasElement | null) {
    this.spectrumCanvas = spectrum;
    this.waterfallCanvas = waterfall;
  }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.snap = { ...this.snap }; this.listeners.forEach((f) => f()); }

  async start(source: 'mic' | 'demo') {
    await this.stop();
    try {
      this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const an = this.ctx.createAnalyser();
      an.fftSize = 4096;
      an.smoothingTimeConstant = 0;
      an.minDecibels = -120;
      an.maxDecibels = 0;
      this.analyser = an;
      if (source === 'mic') {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        this.ctx.createMediaStreamSource(this.stream).connect(an);
      } else {
        this.demo = this.makeDemo(this.ctx, an);
      }
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      an.connect(mute).connect(this.ctx.destination);
      this.freq = new Float32Array(an.frequencyBinCount);
      this.time = new Float32Array(an.fftSize);
      this.edges = logEdges(this.ctx.sampleRate, an.fftSize);
      this.snap = { ...this.snap, phase: 'listening', source, error: null, fault: false, cards: [], history: [], changed: [], learnProgress: 0, d2: 0, threshold: 0 };
      this.timer = window.setInterval(() => this.tick(), FRAME_MS);
      this.emit();
    } catch (err) {
      this.snap = { ...this.snap, phase: 'idle', source: null, error: err instanceof Error ? err.message : String(err) };
      this.emit();
    }
  }

  async stop() {
    window.clearInterval(this.timer);
    this.timer = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.demo) { try { this.demo.fan.stop(); this.demo.knock.stop(); } catch { /* stopped */ } }
    this.demo = null;
    if (this.ctx) await this.ctx.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
  }

  learn() {
    if (!this.analyser) return;
    this.train = [];
    this.trainCount = 0;
    this.trainSpec = new Float32Array(this.specView.length);
    this.snap = { ...this.snap, phase: 'learning', learnProgress: 0, cards: [], history: [], changed: [] };
    this.emit();
  }

  setFault(on: boolean) {
    if (!this.demo || !this.ctx) return;
    this.demo.knockGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
    this.snap = { ...this.snap, fault: on };
    this.emit();
  }

  async enableMotion() {
    const DME = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (DME?.requestPermission) {
      const r = await DME.requestPermission().catch(() => 'denied');
      if (r !== 'granted') return false;
    }
    if (this.motionOn) return true;
    window.addEventListener('devicemotion', this.onMotion);
    this.motionOn = true;
    return true;
  }
  private onMotion = (e: DeviceMotionEvent) => {
    const a = e.acceleration ?? e.accelerationIncludingGravity;
    if (!a) return;
    this.motionBuf.push(Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0));
    if (this.motionBuf.length > 256) this.motionBuf.shift();
  };

  /** Stop listening and return to the idle state. */
  async reset() {
    await this.stop();
    this.snap = { phase: 'idle', source: null, learnProgress: 0, d2: 0, threshold: 0, history: [], cards: [], changed: [], fault: false, level: -100, motion: this.snap.motion, error: null };
    this.emit();
  }

  dispose() {
    void this.stop();
    if (this.motionOn) window.removeEventListener('devicemotion', this.onMotion);
    this.listeners.clear();
  }

  // ------------------------------------------------------------ per frame
  private tick() {
    const an = this.analyser;
    if (!an) return;
    an.getFloatFrequencyData(this.freq);
    an.getFloatTimeDomainData(this.time);
    const x = this.features();
    const sr = this.ctx!.sampleRate;
    // a log-frequency view of the spectrum for drawing
    const v = this.specView;
    for (let i = 0; i < v.length; i++) {
      const f = F_LO * Math.pow(F_HI / F_LO, i / (v.length - 1));
      const db = this.freq[Math.min(this.freq.length - 1, Math.round((f / sr) * an.fftSize))];
      v[i] = Number.isFinite(db) ? 0.6 * v[i] + 0.4 * db : v[i];
    }
    this.drawSpectrum();
    this.drawWaterfall();
    this.snap.level = x[BANDS];
    if (this.motionBuf.length >= 64) this.snap.motion = motionSummary(this.motionBuf);

    if (this.snap.phase === 'learning') {
      this.train.push(x);
      this.trainCount += 1;
      for (let i = 0; i < v.length; i++) this.trainSpec![i] += v[i];
      this.snap.learnProgress = this.trainCount / LEARN_FRAMES;
      if (this.trainCount >= LEARN_FRAMES) this.fit();
      this.emit();
      return;
    }
    if (this.snap.phase !== 'watching') { this.emit(); return; }
    const z = x.map((xi, i) => (xi - this.mu[i]) / this.sd[i]);
    const d2 = mahalanobis(z, this.prec);
    this.snap.d2 = d2;
    this.snap.history = [...this.snap.history.slice(-(HISTORY - 1)), d2];
    this.cardBuf.push({ z, d2, bands: x.slice(0, BANDS) });
    if (this.cardBuf.length >= CARD_FRAMES) this.punch();
    this.emit();
  }

  private features(): number[] {
    const an = this.analyser!;
    const bands: number[] = [];
    let geo = 0, ari = 0, num = 0, den = 0, n = 0;
    const sr = this.ctx!.sampleRate;
    for (let b = 0; b < BANDS; b++) {
      let s = 0, c = 0;
      for (let k = this.edges[b]; k < this.edges[b + 1]; k++) {
        const p = Math.pow(10, this.freq[k] / 10);
        s += p; c++;
        geo += Math.log(p + 1e-20); ari += p; n++;
        const f = (k * sr) / an.fftSize;
        num += f * p; den += p;
      }
      bands.push(10 * Math.log10(s / Math.max(1, c) + 1e-20));
    }
    let sum = 0, sum2 = 0, peak = 0;
    for (const t of this.time) { sum += t; sum2 += t * t; peak = Math.max(peak, Math.abs(t)); }
    const N = this.time.length, mean = sum / N, varr = Math.max(1e-12, sum2 / N - mean * mean);
    let m4 = 0;
    for (const t of this.time) m4 += (t - mean) ** 4;
    const rms = Math.sqrt(sum2 / N);
    const level = 20 * Math.log10(rms + 1e-9);
    const crest = peak / (rms + 1e-9);
    const kurt = m4 / N / (varr * varr);
    const flat = 10 * Math.log10(Math.exp(geo / Math.max(1, n)) / (ari / Math.max(1, n) + 1e-20) + 1e-20);
    const centroid = Math.log2((num / (den + 1e-20)) + 1);
    return [...bands, level, Math.log(crest), Math.log(kurt), flat, centroid];
  }

  private fit() {
    const X = this.train, n = X.length, p = X[0].length;
    this.mu = Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[j], 0) / n);
    this.sd = Array.from({ length: p }, (_, j) => Math.sqrt(X.reduce((s, r) => s + (r[j] - this.mu[j]) ** 2, 0) / (n - 1)) || 1e-3).map((s) => Math.max(s, 0.25));
    const Z = X.map((r) => r.map((v, j) => (v - this.mu[j]) / this.sd[j]));
    // sample correlation, then Ledoit–Wolf shrinkage toward the identity
    const S = Array.from({ length: p }, () => new Array<number>(p).fill(0));
    for (const z of Z) for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) S[i][j] += (z[i] * z[j]) / n;
    let num = 0, den = 0;
    for (const z of Z) for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) num += (z[i] * z[j] - S[i][j]) ** 2;
    num /= n * n;
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) den += (S[i][j] - (i === j ? 1 : 0)) ** 2;
    const alpha = Math.min(1, Math.max(0, num / Math.max(den, 1e-12)));
    const Sig = S.map((row, i) => row.map((v, j) => (1 - alpha) * v + (i === j ? alpha : 0)));
    this.prec = invertSPD(Sig);
    const d2s = Z.map((z) => mahalanobis(z, this.prec)).sort((a, b) => a - b);
    const q995 = d2s[Math.min(n - 1, Math.floor(0.995 * n))];
    this.snap.threshold = Math.max(1.25 * q995, p + 3 * Math.sqrt(2 * p));
    this.baseBands = Array.from({ length: BANDS }, (_, j) => this.mu[j]);
    const ts = this.trainSpec!;
    for (let i = 0; i < ts.length; i++) ts[i] /= this.trainCount;
    this.snap.phase = 'watching';
    this.snap.learnProgress = 1;
    this.cardBuf = [];
    this.lw = alpha;
  }
  lw = 0;

  private punch() {
    const buf = this.cardBuf;
    this.cardBuf = [];
    const groups: number[][] = [[BANDS], [BANDS + 1, BANDS + 2], [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15], [BANDS + 3], [BANDS + 4]];
    const holes = groups.map((g) => buf.filter((f) => g.some((j) => Math.abs(f.z[j]) > 3.5)).length / buf.length >= 0.3);
    const frac = buf.filter((f) => f.d2 > this.snap.threshold).length / buf.length;
    const state: CardState = frac >= 0.6 ? 'act' : frac >= 0.25 ? 'watch' : 'normal';
    const dMean = buf.reduce((s, f) => s + f.d2, 0) / buf.length;
    this.snap.cards = [...this.snap.cards.slice(-47), { id: this.nextId++, holes, state, dMean }];
    // what changed: the bands that moved most against the learned normal
    const now = Array.from({ length: BANDS }, (_, j) => buf.reduce((s, f) => s + f.bands[j], 0) / buf.length);
    const sr = this.ctx!.sampleRate, fft = this.analyser!.fftSize;
    this.snap.changed = now
      .map((v, j) => ({ lo: (this.edges[j] * sr) / fft, hi: (this.edges[j + 1] * sr) / fft, db: v - this.baseBands[j] }))
      .filter((c) => c.db > 3)
      .sort((a, b) => b.db - a.db)
      .slice(0, 3);
  }

  // ------------------------------------------------------------ drawing
  private drawSpectrum() {
    const cv = this.spectrumCanvas;
    if (!cv) return;
    const g = prepCanvas(cv);
    if (!g) return;
    const { c, w, h } = g;
    const y = (db: number) => h - ((Math.max(-110, Math.min(-20, db)) + 110) / 90) * h;
    c.strokeStyle = 'rgba(64,108,98,.12)';
    c.lineWidth = 1;
    for (const f of [100, 200, 500, 1000, 2000, 5000]) { const x = (Math.log(f / F_LO) / Math.log(F_HI / F_LO)) * w; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let d = -100; d <= -30; d += 10) { c.beginPath(); c.moveTo(0, y(d)); c.lineTo(w, y(d)); c.stroke(); }
    const v = this.specView;
    if (this.trainSpec && this.snap.phase === 'watching') {
      c.strokeStyle = '#80837B';
      c.lineWidth = 1.25;
      c.beginPath();
      for (let i = 0; i < v.length; i++) { const px = (i / (v.length - 1)) * w; const py = y(this.trainSpec[i]); if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke();
    }
    c.strokeStyle = '#17191C';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < v.length; i++) { const px = (i / (v.length - 1)) * w; const py = y(v[i]); if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
  }

  private drawWaterfall() {
    const cv = this.waterfallCanvas;
    if (!cv) return;
    const c = cv.getContext('2d');
    if (!c) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; c.fillStyle = '#F3F4EF'; c.fillRect(0, 0, W, H); }
    const col = 2 * dpr;
    c.drawImage(cv, -col, 0);
    const v = this.specView;
    for (let py = 0; py < H; py++) {
      const i = Math.round((1 - py / (H - 1)) * (v.length - 1));
      const t = Math.max(0, Math.min(1, (v[i] + 105) / 70));
      const shade = Math.round(243 - t * (243 - 23));
      c.fillStyle = `rgb(${shade},${Math.round(244 - t * (244 - 25))},${Math.round(239 - t * (239 - 28))})`;
      c.fillRect(W - col, py, col, 1);
    }
  }

  private makeDemo(ctx: AudioContext, dest: AudioNode) {
    const sr = ctx.sampleRate, len = sr * 4;
    const fanBuf = ctx.createBuffer(1, len, sr), knockBuf = ctx.createBuffer(1, len, sr);
    const fd = fanBuf.getChannelData(0), kd = knockBuf.getChannelData(0);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    let pink = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      pink = 0.97 * pink + 0.03 * rnd();
      fd[i] = 0.18 * Math.sin(2 * Math.PI * 100 * t) + 0.06 * Math.sin(2 * Math.PI * 200 * t) + 0.09 * Math.sin(2 * Math.PI * 120 * t) * (1 + 0.2 * Math.sin(2 * Math.PI * 24 * t)) + 0.35 * pink + 0.01 * rnd();
    }
    // the fault: a bearing knock at 86 Hz, each impact ringing near 3.2 kHz
    for (let t = 0.005; t < 4; t += 1 / 86) {
      const i0 = Math.floor(t * sr);
      for (let j = 0; j < sr * 0.004 && i0 + j < len; j++) kd[i0 + j] += 0.45 * Math.exp(-j / sr / 0.0006) * Math.sin(2 * Math.PI * 3200 * (j / sr));
    }
    const fan = ctx.createBufferSource(), knock = ctx.createBufferSource();
    fan.buffer = fanBuf; knock.buffer = knockBuf;
    fan.loop = knock.loop = true;
    const knockGain = ctx.createGain();
    knockGain.gain.value = 0;
    fan.connect(dest);
    knock.connect(knockGain).connect(dest);
    fan.start(); knock.start();
    return { fan, knock, knockGain };
  }
}

// ------------------------------------------------------------ helpers
function logEdges(sr: number, fft: number): number[] {
  const bins = fft / 2;
  const out: number[] = [];
  for (let b = 0; b <= BANDS; b++) {
    const f = F_LO * Math.pow(F_HI / F_LO, b / BANDS);
    out.push(Math.min(bins - 1, Math.max(1, Math.round((f / sr) * fft))));
  }
  for (let b = 1; b < out.length; b++) if (out[b] <= out[b - 1]) out[b] = out[b - 1] + 1;
  return out;
}
function mahalanobis(z: number[], P: number[][]): number {
  let s = 0;
  for (let i = 0; i < z.length; i++) { let r = 0; for (let j = 0; j < z.length; j++) r += P[i][j] * z[j]; s += z[i] * r; }
  return s;
}
/** Inverse of a symmetric positive-definite matrix via Cholesky. */
function invertSPD(A: number[][]): number[][] {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j];
    for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-9)) : s / L[j][j];
  }
  const Li = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    Li[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j++) { let s = 0; for (let k = j; k < i; k++) s -= L[i][k] * Li[k][j]; Li[i][j] = s / L[i][i]; }
  }
  const out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let k = Math.max(i, j); k < n; k++) s += Li[k][i] * Li[k][j]; out[i][j] = s; }
  return out;
}
function motionSummary(buf: number[]) {
  const n = buf.length, mean = buf.reduce((s, v) => s + v, 0) / n;
  const x = buf.map((v) => v - mean);
  const rms = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / n);
  // dominant frequency by a plain DFT at ~60 Hz sampling
  let best = 0, hz = 0;
  for (let k = 1; k < n / 2; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { re += x[i] * Math.cos((2 * Math.PI * k * i) / n); im -= x[i] * Math.sin((2 * Math.PI * k * i) / n); }
    const p = re * re + im * im;
    if (p > best) { best = p; hz = (k * 60) / n; }
  }
  return { rms, hz };
}
function prepCanvas(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d');
  if (!c) return null;
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, r.width, r.height);
  return { c, w: r.width, h: r.height };
}
