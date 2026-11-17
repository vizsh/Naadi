# NAADI — Machine Pulse Intelligence for Small Factories
### Ideation & Build Blueprint · HackKumbh Nagpur · Track 4.3 (Agentic AI)

> *A vaidya reads your pulse by touch. The mill owner reads his machine the same way, by sound and feel. Naadi reads it the same way he does, using physics, statistics and agents, and leaves the decision with him.*

---

## 0. The one-line pitch

**Naadi turns a ₹1,500 clip-on sensor (or simply a phone) into an industrial-grade digital twin for a powerloom, flour mill or pump set.** It learns what *healthy* sounds and feels like from a couple of weeks of normal running, with no fault labels needed. It notices drift, works out the most likely fault from physics, estimates how long is left, and prices the decision in rupees. A team of agents then lines up the technician, the spare part and the repair window. **The owner always approves.**

The reference images show what big companies get (Mauser/realvirtual, GE Predix, Nextspace). Our angle is to bring that same experience to a 6-loom shed in Ichalkaranji or a chakki in Nagpur, and to make it work offline.

---

## 1. Reading the problem properly (what judges will grade against)

| Constraint in the brief | What it forces in our design |
|---|---|
| No labelled fault data | **Unsupervised only.** Learn "normal" per machine and per operating state, and score deviation. Use physics (bearing defect frequencies, ISO severity zones) for diagnosis, because physics needs no labels. |
| Weeks of normal running on *ageing* machines | Baselines must be **per-machine** (no global "healthy" exists for a 20-year-old loom), **regime-aware** (idle / light / full load) and **slowly adaptive**. They must not adapt so much that they absorb real degradation. |
| Must keep working offline | Feature extraction and detection run **on the edge or in the browser**. The cloud is optional. PWA plus IndexedDB, with SMS/WhatsApp fallback for alerts. |
| Decision to stop rests with owner | Agents **recommend and prepare**. They never act without approval. Every recommendation shows its evidence, its rule citations and a ₹ trade-off. |
| Hardware may be simulated with recorded signals | Replay **real public datasets** (NASA IMS, CWRU, MIMII) plus a **physics-based signal simulator** for looms and mills. Add a **live phone-sensor mode** for the demo. |
| Stakeholders: technicians, part dealers, OEMs, workers | Four role views: **Owner, Worker, Technician, Dealer**. Workers become a sensor: their voice notes are evidence. |
| "Following the money: a technician who knew…" | A **technician week planner** that ranks jobs across many factories by risk × value and routes them. This is the business model. |

**Field questions → product features** (show this mapping on a slide, because it proves we listened):

1. *Last failure, downtime, cost?* → Onboarding interview captures it and seeds the **Weibull prior** and the **₹ cost model**.
2. *What did workers notice?* → **Worker voice/photo capture** feeds in as Bayesian evidence.
3. *Time to find technician + part?* → **Lead-time model** used in the scheduler (part lead time and technician availability).
4. *Idle windows?* → **Idle-window calendar** (shifts, Sundays, *scheduled power cuts*). The optimiser places repairs there.
5. *Power and signal on floor?* → Offline-first edge, store-and-forward, SMS fallback, battery and supercap logging.
6. *Record of past repairs?* → **Digital maintenance log** (the CMMS-lite), which also becomes training context.

---

## 2. What the best existing solutions do (and what we borrow)

| Product | What's great | What we take |
|---|---|---|
| **Augury** | Fuses vibration, magnetic and temperature data. Hundreds of engineered features. Human analysts validate AI calls. | Feature-rich multimodal fusion, plus a "**confidence + evidence**" diagnosis card. |
| **Tractian** | Cheap wireless sensor, auto-diagnosis, built-in CMMS, offline mobile work orders. | Bundle diagnosis with the work order. Mobile-first and offline. |
| **SKF @ptitude / Emerson AMS** | Analyst-grade spectra with **defect-frequency cursors**, envelope spectra and waterfalls. | Make our signal views look like *real analyst tools*, not generic dashboards. |
| **realvirtual WEB** (refs 1, 6, 9) | Browser 3D HMI on Three.js/React, a KPI strip, component popovers with BOM and documents, live alert stack, camera presets. | The **HUD grammar**: top KPI tiles with sparklines, right alert stack, left tool rail, bottom search, click-a-part popover. *It's AGPL, so we build our own on R3F and use it only as inspiration.* |
| **Nextspace / Equinor Echo** (refs 2, 8) | Tag-centric twins, document links, bookmarks/saved views. | **Bookmarks / camera stories** and a tag info panel. |
| **GE Predix** (ref 3) | Asset context + KPIs + "probability of fault" in one frame. | The **Probability-of-failure-in-N-days** headline number. |
| **NVIDIA Omniverse DTC** (ref 7) | Scenario hierarchy and KPI gauges vs targets. | **What-if scenarios**: "Run till failure" vs "Repair Sunday" side by side. |
| **DCASE Task 2 / MIMII** | The academic standard for *unsupervised* machine-sound anomaly detection. | Our acoustic detector design and our evaluation protocol. |

---

## 3. System architecture

```
┌──────────── EDGE (₹1.5k kit or a phone) ────────────┐
│ ESP32-S3 + ADXL345/MPU6050 (vib) + INMP441 (mic)   │
│ + SCT-013 current clamp + DS18B20 (temp)            │
│ On-device: windowing → FFT → features (RMS, kurtosis,│
│ crest, band energies, envelope peaks) every 10 s    │
│ Store-and-forward to SD/flash when offline          │
└────────────┬────────────────────────────────────────┘
             │ MQTT/WebSocket/BLE  (or: replay of recorded signals)
┌────────────▼──────── BROWSER / PWA (works offline) ─┐
│ Web Workers: DSP (FFT, Hilbert envelope, mel)       │
│ Detectors: Mahalanobis(LW) · IsolationForest ·      │
│            Autoencoder (onnxruntime-web, WASM)      │
│ Health Index fusion · CUSUM drift · RUL particle filt│
│ IndexedDB (Dexie) local store · Service worker cache│
│ R3F digital twin + analyst-grade signal views       │
└────────────┬────────────────────────────────────────┘
             │ when online
┌────────────▼──────── VERCEL (serverless) ───────────┐
│ Next.js route handlers · Vercel AI SDK agent loop   │
│ Tools = deterministic math (never LLM arithmetic)   │
│ Supabase (Postgres + Realtime broadcast) — optional │
│ Rulebook JSON (versioned, cited) · cost model       │
└──────────────────────────────────────────────────────┘
```

**Principle: the LLM never does the math.** All numbers come from deterministic, testable TypeScript/Python. The agents orchestrate, explain, translate into Hindi/Marathi, and draft messages. That's what makes it trustworthy and judge-proof.

---

## 4. The math (the "proper backing")

### 4.1 Signal processing (per 1 s window, Hann-windowed, 50% overlap)

**Time domain:** RMS, peak, peak-to-peak, crest factor `CF = peak/RMS`, kurtosis `κ = E[(x−μ)⁴]/σ⁴` (healthy ≈ 3; impulsive bearing faults → >4), skewness, shape and impulse factors.

**Frequency domain:** FFT magnitude, band energies at 1×, 2×, 3× shaft speed (`fr`), spectral centroid, spectral flatness, and spectral kurtosis (to choose the demodulation band).

**Velocity severity (ISO 10816-3 / 20816):** integrate acceleration → velocity RMS (10–1000 Hz) and classify into zones **A/B/C/D**. This is a **day-zero rule**: it is useful before any learning has happened.

**Envelope analysis (the real bearing detector):**
bandpass around the resonance (picked by kurtogram) → Hilbert transform `|x + jH{x}|` → FFT of the envelope → look for peaks at the bearing defect frequencies:

```
BPFO = (n/2)·fr·(1 − (d/D)·cosφ)        outer race
BPFI = (n/2)·fr·(1 + (d/D)·cosφ)        inner race
BSF  = (D/2d)·fr·(1 − ((d/D)·cosφ)²)    rolling element
FTF  = (fr/2)·(1 − (d/D)·cosφ)          cage
```
The owner types the bearing number printed on the housing (e.g. **6205-2RS**). A bundled lookup table gives `n, d, D, φ`, and the cursors appear on the spectrum automatically. This is the kind of detail that impresses judges, because it's physics, not a black box.

**Motor current signature analysis (MCSA):** broken rotor bars show sidebands at `fs·(1 ± 2s)`, where `s` = slip. That's cheap to get from a clamp meter.

**Acoustic:** log-mel spectrogram (64 mels, 1024 FFT), MFCC deltas. This is the DCASE-style front end.

### 4.2 Operating-regime discovery (unlabelled)
An old machine is not "one" machine: idle, half-load and full-load all look different. We fit a **Gaussian Mixture Model** (BIC-selected k) on `[current RMS, speed, band energy]` and score each window **against its own regime's baseline**. This kills most false alarms on day one.

### 4.3 Anomaly detectors (ensemble, all trained on healthy weeks only)
1. **Mahalanobis distance with Ledoit-Wolf shrinkage covariance.** It is robust with few samples. `D² = (x−μ)ᵀ Σ⁻¹ (x−μ)` follows ~χ²(p) under normality, so it gives a principled threshold.
2. **Isolation Forest.** Non-parametric and fast, and it handles odd feature distributions.
3. **Dense / 1D-conv Autoencoder** on log-mel patches. The reconstruction error is the score. Train it in PyTorch, export to ONNX, and run it in-browser via `onnxruntime-web`.

**Score calibration:** convert each score to a tail probability using **Extreme Value Theory (Peaks-Over-Threshold → Generalized Pareto)**. This lets us *set the false-alarm rate* directly (e.g. "≤ 1 false alert per machine per month"), which is a strong claim to make to judges.

**Fusion → Health Index:** `HI = 1 − Π(1 − pᵢ)^{wᵢ}` (weighted noisy-OR of calibrated anomaly probabilities), with values from 0 to 1.

### 4.4 Drift / change detection
**CUSUM** and **EWMA** control charts on HI detect *slow* degradation that point thresholds miss. **Page-Hinkley** finds the change point, which the UI marks as "degradation onset". The baseline uses slow exponential forgetting that is **frozen once drift is detected**, so the model doesn't learn the fault as normal.

### 4.5 Diagnosis without labels: Bayesian rule scoring
The **Rulebook** (§6) encodes fault signatures as likelihoods. For hypothesis `h` and evidence `e₁…eₖ` (spectral peaks, kurtosis, temperature, worker notes):

```
P(h | e) ∝ P(h) · Π P(eᵢ | h)
```
Priors come from machine class failure statistics (e.g. bearings ≈ 40–50% of rotating-machine failures) and are updated by this machine's repair log. A worker's note "khat-khat awaaz" (knocking sound) maps to an evidence term too. The output is a ranked fault list with **probabilities and the exact evidence behind each**.

### 4.6 Prognostics: Remaining Useful Life (RUL)
Degradation model (Gebraeel-style exponential): `HI(t) = φ + θ·exp(β·t + ε(t))`.
We fit and update it with a **particle filter** (~500 particles, runs in a worker), which gives a **full RUL distribution**, not a single number. The UI shows a **fan chart** (P10/P50/P90) and the headline: **"P(failure within 7 days) = 34%"**. A **Weibull prior** (from onboarding: "how long do bearings last on this loom?") is used before degradation data exists.

### 4.7 Decision economics: the owner's rupee view
```
C_unplanned = T_down·(margin/hr + idle_wages/hr) + part·(1+emergency_premium) + P(secondary damage)·C_secondary
C_planned(t) = part + labour + lost_output(t)          // ≈0 if t ∈ idle window
E[C(t)] = F(t)·C_unplanned + (1−F(t))·C_planned(t)     // F = RUL CDF
t* = argmin_t E[C(t)]   over candidate windows (Sundays, shift gaps, scheduled power cuts)
```
The output reads like this: **"Replace the 6205 bearing on Thursday 2–6 pm (MSEDCL scheduled outage). Expected saving ₹18,400 vs running to failure. Risk of failing before then: 9%."** Two buttons: *Approve* / *Not now*.

The power-cut idea is India-specific and memorable: **repairs scheduled into load-shedding hours lose zero output.**

### 4.8 Technician week optimisation (following the money)
Jobs across factories get `priority = P(fail in horizon) × C_unplanned`. Solve a small **VRP with time windows** (greedy insertion + 2-opt, in-browser) over real OSM roads (OSRM public demo, or straight-line fallback). The output is the technician's ranked, routed week, plus **parts to carry**. Dealers see an **aggregated demand forecast** across all factories (sum of failure probabilities × parts), so they stock 6205 bearings *before* the rush.

### 4.9 Validation (the credibility page — "Model Card")
| Dataset | What it proves | Metric we report |
|---|---|---|
| **NASA IMS** run-to-failure (bearings, 20 kHz, ~35 days) | Early warning | **Lead time**: days before failure that HI crossed threshold. False alarms during the healthy period. |
| **CWRU** bearing faults | Diagnosis correctness | Did envelope analysis + rulebook name the right fault (outer/inner/ball)? Confusion matrix, no training on faults. |
| **MIMII / DCASE Task 2** (pump, fan, valve, slider sounds) | Acoustic unsupervised detection | AUC / pAUC per machine type vs DCASE baseline. |
| **Physics simulator** (loom, chakki) | Generalisation to our target machines | Detection delay vs injected fault severity curve. |

Report **real numbers we computed**, including where we are weak. Honesty reads as competence.

---

## 5. The agentic layer

Built with **Vercel AI SDK** (tool calling + streaming UI). Each agent is a role with a narrow toolset. Tools are deterministic functions. The LLM plans, explains and drafts.

| Agent | Trigger | Tools | Output |
|---|---|---|---|
| **Sentinel** (not an LLM, pure code) | Every window | DSP, detectors, CUSUM | Health events |
| **Diagnostician** | HI drift / event | `getSpectrum`, `getEnvelopePeaks`, `queryRulebook`, `getWorkerNotes`, `bayesRank` | Ranked faults + evidence + rule IDs |
| **Prognostician** | Diagnosis confirmed | `fitRUL`, `weibullPrior` | RUL distribution |
| **Planner** | RUL available | `getIdleWindows`, `costModel`, `optimiseRepairTime` | Recommended window + ₹ comparison |
| **Procurement** | Plan approved | `partLookup`, `dealerStock`, `draftWhatsApp` | Part order draft (owner sends) |
| **Dispatcher** | Plan approved | `technicianSchedule`, `vrpSolve` | Technician booking draft |
| **Narrator** | Any | `translate`, `tts` | Hindi / Marathi / English voice + text summary for the owner |

**Visible reasoning ("Case File")**: every run renders as a timeline of thoughts → tool calls → results → cited rules → recommendation. The UI makes the agents' work inspectable.

**Human-in-the-loop gate**: anything outward-facing (message a dealer, book a technician, stop the machine) becomes an **approval card**. Nothing auto-executes. This matches the brief ("decision rests with owner").

**Offline / no-API-key mode**: a deterministic template planner produces the same case file without an LLM, so the demo never dies on bad Wi-Fi.

---

## 6. The Rulebook — "Naadi Shastra"

A versioned, cited JSON knowledge base that the agents *must* cite (rule IDs appear in every diagnosis):

```jsonc
{
  "id": "BRG-OR-01",
  "machine": ["*"],
  "fault": "Bearing outer race defect",
  "evidence": [
    {"feature": "envelope_peak@BPFO", "op": ">", "value": "6dB over baseline", "lr": 8.0},
    {"feature": "kurtosis", "op": ">", "value": 4.0, "lr": 3.0},
    {"feature": "worker_note", "match": ["khat", "knocking", "ghis"], "lr": 1.8}
  ],
  "severity_progression": ["envelope only", "BPFO in raw spectrum", "harmonics + sidebands", "broadband noise floor rise"],
  "action": "Replace bearing; check lubrication & alignment",
  "parts": ["bearing by number"],
  "source": "ISO 13373-3; SKF Bearing damage guide"
}
```
Coverage: **unbalance** (1× radial), **misalignment** (2× axial, 1× phase), **mechanical looseness** (½× harmonics), **bearing** (BPFO/BPFI/BSF/FTF), **belt wear/slip** (belt frequency, sub-sync; very common on looms), **gear mesh wear** (GMF ± sidebands), **pump cavitation** (broadband HF + noise), **chakki stone wear** (load-current rise + grind-rate drop), **motor electrical** (2×line freq, rotor bar sidebands), **overheating** (temp − ambient > limit), and **ISO 10816 zone rules**.

There's a **Rulebook Explorer** page: searchable, with diagrams showing what each signature looks like on a spectrum (an animated example per rule).

---

## 7. Multimodal inputs

1. **Vibration** (accelerometer: kit, phone, or replayed dataset)
2. **Sound** (MEMS mic or phone mic; log-mel)
3. **Motor current** (clamp CT: load, MCSA)
4. **Temperature** (bearing housing)
5. **Human observation**: a worker taps "something's off", records a 10 s voice note in Hindi/Marathi ("aaj awaaz badal gayi hai"), and optionally snaps a photo (oil leak, belt fray). Speech → text → keyword/LLM extraction → rulebook evidence term.
6. **Maintenance log**: past repairs update priors.

**Phone-as-sensor (the demo hero):** the Web Audio API + DeviceMotion API (HTTPS on Vercel ✓) turn any phone into a sensor. **On stage: put a phone on a table fan, and the laptop dashboard shows the live spectrum, learns "normal" in 60 s, then tape a coin to one blade (unbalance). The 1× peak jumps, HI turns amber, and the Diagnostician says "Unbalance, 82%".** That's real, live and unfakeable, and it's the single best wow moment available to us.

---

## 8. Frontend: visual direction (high-end, NOT AI slop)

### 8.1 What to avoid
Purple/blue gradients, neon glows, glassmorphism everywhere, emoji icons, generic shadcn cards in a grid, fake random-number charts, rounded-2xl blobs, "AI ✨" sparkles, and dashboards with 40 meaningless numbers (like reference 4).

### 8.2 The direction: "Instrument-grade industrial"
Think **analyst software meets aerospace HMI**: dense, quiet, precise, with every pixel carrying a unit.

- **Palette:** graphite neutrals (`#0E0F11` → `#1A1C20` → `#2A2D33`), off-white text `#E8E6E1`. **Colour carries meaning only**, following ISO 3864 safety semantics: **green** healthy, **amber `#F2A900`** watch, **red `#E5484D`** act, and one cool **signal cyan** reserved for *live data traces*. No decorative colour.
- **Type:** **IBM Plex Sans** (UI) + **IBM Plex Mono** (all numerics, tabular-nums), which has industrial-engineering heritage. Optionally **Söhne-like "Inter Tight"** for display. Micro-labels in uppercase with +6% tracking, like the realvirtual tiles.
- **Structure:** 1 px hairline borders, 4 px radius max, 8 pt grid, real units everywhere (`mm/s RMS`, `Hz`, `°C`, `₹`).
- **Motion:** only for meaning: state changes, camera fly-to, data arriving. Easing `cubic-bezier(.2,.8,.2,1)`, 180–320 ms. No idle floating animations.
- **Sound design (distinctive):** *"Hear what Naadi hears."* Play back the machine's real recording, and play the **envelope-demodulated bearing fault so you can literally hear the knock emerge**. It's sonification, and nobody else will do this.

### 8.3 Screens

1. **Landing / story (scrollytelling)**: opens on a black screen with one live waveform and a machine hum. *"Your machine has been telling you for weeks."* Scroll reveals the 3D chakki assembling part by part (exploded view), then the three numbers that matter (downtime days, ₹ lost, lead time), then "Enter the floor". Restrained and cinematic.
2. **Floor Twin** (the reference-image experience): an isometric 3D shop floor (6 looms, 1 chakki, 2 pumps, 1 lathe). Top **KPI strip** with sparklines (fleet health, ₹ at risk this week, next repair window, uptime). Right **alert stack**. Left **tool rail**. Bottom **command search** ("loom 3", "all bearings", "what needs attention?"). Health shown as **ground decals and outline**, not glow. Machine parts **vibrate visibly** (vertex displacement ∝ RMS, exaggerated, toggleable). Click → camera flies in → **x-ray mode** isolates the failing bearing → part popover with bearing number, dealer price, lead time, *Order part* (draft).
3. **Machine Case File**: analyst-grade panels: **3D spectral waterfall** (WebGL), **envelope spectrum with BPFO/BPFI cursors + harmonics**, ISO 10816 severity gauge, HI timeline with change-point marker and **RUL fan chart**, a ranked diagnosis with evidence chips → rule IDs, and the **₹ decision card**.
4. **Agent Console**: streaming reasoning timeline with tool-call cards, rule citations and approval cards. A split view shows "Run to failure" vs "Recommended plan" scenario costs.
5. **Time Machine**: scrub through the **real NASA IMS 35-day run-to-failure**. The twin degrades as you drag, and markers show *"Naadi alerted here"* vs *"bearing failed here"*: a **lead time of X days on real data**. This is the credibility moment.
6. **Live Lab**: the phone-sensor pairing (QR code → phone streams via Supabase Realtime → laptop).
7. **Technician app (mobile)**: MapLibre + OpenFreeMap (free, no key) map of a Nagpur / Ichalkaranji cluster, the routed week, the parts-to-carry list, and one-tap "job done" that writes the repair log.
8. **Worker capture (mobile PWA)**: one giant button, *"Kuch gadbad hai"* (something's wrong), plus voice note, photo and a 10 s phone recording that's instantly compared to the baseline.
9. **Dealer view**: a demand forecast heatmap of parts × weeks.
10. **Rulebook Explorer + Model Card**: the trust pages.

### 8.4 3D specifics
- **React Three Fiber + drei + postprocessing**: N8AO ambient occlusion, a subtle outline on selection (like ref 1's blue wireframe highlight), and a soft studio HDRI from **Poly Haven (CC0)**.
- Models: build **procedurally / low-poly in Blender** (a loom, a chakki with stones, a centrifugal pump, motors, belts and pulleys), or use CC-BY Sketchfab models with attribution. Draco + KTX2 compression, `<Detailed>` LOD, `PerformanceMonitor` to degrade gracefully on judge laptops.
- **Exploded view** animation (BOM explosion like refs 1 and 6), **section/x-ray** shader, **camera bookmarks** (CAM 1/2/3), and first-person walk mode.

---

## 9. Tech stack (100% Vercel-deployable)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Native Vercel support, RSC, route handlers for agents |
| Styling | **Tailwind v4** + **Radix primitives** (shadcn as a base, fully re-skinned) | Fast to build, with our own design tokens |
| 3D | **three · @react-three/fiber · drei · postprocessing · camera-controls** | The best web 3D ecosystem |
| Motion | **motion** (framer) for UI, **GSAP ScrollTrigger** for the landing story | Precise choreography |
| Charts | **uPlot** (streaming, 60 fps), **custom WebGL** waterfall/spectrogram, **d3-scale/shape** for bespoke SVG | Analyst-grade and fast; avoids the generic Recharts look |
| DSP | Own TS FFT / Hilbert / mel in **Web Workers** via **Comlink** | Off main thread, unit-testable |
| ML (train) | Python: **scikit-learn, PyTorch, scipy**, notebooks in `/research` | Real training on real datasets |
| ML (serve) | **onnxruntime-web (WASM, WebGPU when present)** + TS Mahalanobis/IForest | In-browser inference = offline |
| Agents | **Vercel AI SDK** (`ai`), Claude Sonnet as default model, tool calling, streamed UI | Native streaming; deterministic fallback |
| Realtime | **Supabase Realtime** broadcast (phone → laptop); simulator runs client-side | Vercel functions can't hold WebSockets |
| Storage | **Dexie (IndexedDB)** local-first; **Supabase Postgres** sync (free tier) | Offline-first |
| PWA | **Serwist** service worker | Installable, offline |
| Maps | **MapLibre GL + OpenFreeMap** tiles | Free, no API key |
| i18n | **next-intl** (en / hi / mr) + Web Speech API for voice | Owners and workers in their own language |
| Fonts/icons | IBM Plex Sans/Mono, **Phosphor** or **Lucide** (thin weight) | Consistent and precise |
| Data | Pre-processed IMS/CWRU/MIMII → compact Float32 binaries / Parquet in `/public/data` (fetched on demand, < 50 MB total) | Real data, deploy-friendly |

**Edge firmware (optional but strong):** ESP32-S3 Arduino/ESP-IDF sketch that computes the same features as the TS code (shared spec) and publishes over MQTT/WebSocket. Even if it isn't shown live, it goes in the repo with a wiring diagram.

---

## 10. Repo layout

```
naadi/
├─ app/                      # Next.js routes: (marketing) / floor / machine/[id] / agents / lab / tech / worker / dealer / rulebook / model-card
├─ components/{hud,twin,charts,case-file,ui}/
├─ lib/
│  ├─ dsp/        fft.ts hilbert.ts mel.ts features.ts bearing.ts iso10816.ts
│  ├─ detect/     mahalanobis.ts iforest.ts autoencoder.ts evt.ts cusum.ts gmm.ts fusion.ts
│  ├─ prognosis/  particle-filter.ts weibull.ts
│  ├─ decide/     cost-model.ts scheduler.ts vrp.ts
│  ├─ rulebook/   rules.json bayes.ts
│  ├─ sim/        physics-sim.ts dataset-replay.ts
│  └─ agents/     tools.ts agents.ts fallback-planner.ts
├─ workers/       dsp.worker.ts detect.worker.ts
├─ public/data/   ims/ cwru/ mimii/ models/*.onnx  models/*.glb
├─ research/      notebooks: 01_ims_features, 02_cwru_envelope, 03_mimii_ae, 04_eval → exports + metrics.json
└─ firmware/      esp32 sketch + wiring.md
```

---

## 11. Demo script (3 minutes)

1. **0:00** Landing: the hum, the waveform, one line. "Enter the floor."
2. **0:20** Floor twin: everything green. Press **Time Machine ▶ ×10,000**. Loom 3's decal fades to amber and the alert slides in.
3. **0:45** Fly into Loom 3 → x-ray → bearing glows on outline. The envelope spectrum shows a peak right on the **BPFO cursor**. Click **🔊 hear it**: the knock is audible.
4. **1:10** A worker's voice note arrives (Marathi): *"khat-khat awaaz yetoy."* Diagnosis updates: **Outer race 71% → 88%**.
5. **1:30** Agent Console streams: RUL P50 = 9 days, P(fail ≤ 7 d) = 31%. Planner: *"Thursday 2–6 pm scheduled power cut: zero lost output. Saves ₹18,400."* **Owner taps Approve.** Procurement drafts a WhatsApp to the dealer for a 6205-2RS. Dispatcher slots Ramesh-bhau's Thursday.
6. **2:10** Switch to the technician's phone: his week has been re-routed and the bearing is on his carry list.
7. **2:25** **Live Lab**: phone on a table fan → learns normal → coin on a blade → *"Unbalance, 82%"*. **Live.**
8. **2:50** Model Card: "On NASA's real bearing failure we alerted **X days early** with Y false alarms." Close.

---

## 12. Build phases (priority order: wow first, but on a real core)

| Phase | Deliverable | Notes |
|---|---|---|
| **P0 — Foundations** | Design tokens, fonts, HUD shell, routing, dataset pre-processing notebooks | Lock the visual language before building screens |
| **P1 — Signal core** | DSP lib + workers + unit tests; IMS/CWRU replay; physics simulator | Everything downstream depends on this |
| **P2 — Floor Twin** | R3F floor, machines, decals, fly-to, x-ray, popovers, KPI strip, alerts | The biggest visual wow |
| **P3 — Detection & prognosis** | GMM regimes, Mahalanobis/IForest/AE, EVT, CUSUM, HI, particle-filter RUL; Model Card with real metrics | The credibility |
| **P4 — Agents & decisions** | Rulebook, Bayes ranking, cost model, scheduler, AI SDK agents, Case File UI, approvals, fallback planner | The "Agentic AI" track |
| **P5 — Mobile & live** | Phone sensor Live Lab, worker capture, technician map/VRP, i18n, PWA offline | The live demo moment |
| **P6 — Polish** | Landing scrollytelling, sound design, time machine, performance pass, accessibility | What separates top 3 from top 10 |

**Cut-lines if time runs out:** keep P1–P4 + Live Lab. Drop dealer view, firmware and the full VRP (fall back to a sorted list).

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| 3D slow on judge laptop | LOD, `PerformanceMonitor`, a 2D fallback floor plan, pre-baked lighting |
| No internet at venue | Everything runs client-side; deterministic agent fallback; PWA cached; local hotspot for phone demo |
| LLM latency or hallucination | Tools do all math; responses cite rule IDs; stream tokens; cache demo runs |
| "Your data is synthetic" | Lead with NASA IMS / CWRU / MIMII real results; synthetic only for loom/chakki and labelled as such |
| Phone sensor sampling too low (DeviceMotion ~60–100 Hz) | Use the **mic** (48 kHz) as the primary live channel; the accelerometer for low-freq unbalance only |
| AGPL contamination | Don't copy realvirtual code; inspiration only |

---

## 14. Open decisions for the team

1. Team size and hours available, which sets how deep P3/P6 go.
2. Any ESP32 + sensors on hand? (It changes whether firmware is demoed live.)
3. Primary hero machine: **powerloom** (Vidarbha/Ichalkaranji story) or **flour chakki** (universal)?
4. LLM provider/key (Anthropic is the default; the fallback planner covers no-key).

---

### Sources consulted
- realvirtual WEB (open-source Three.js/React 3D HMI, AGPL-3.0): [docs](https://realvirtual.io/doc/web/), [DEV write-up](https://dev.to/thomas_s_9e168f78d28ba60e/realvirtual-web-an-open-source-3d-hmi-for-industrial-digital-twins-in-the-browser-4ifn), [FAQ](https://realvirtual.io/en/faq/)
- Unsupervised bearing / machine-sound anomaly detection: [arXiv 2308.13352](https://arxiv.org/pdf/2308.13352), [TPA-AD arXiv 2606.04073](https://arxiv.org/pdf/2606.04073), [NASA IMS dataset](https://service.tib.eu/ldmservice/dataset/bibtex/nasa-ims-bearing-dataset), [MDPI Sensors 25/4/1185](https://mdpi.com/1424-8220/25/4/1185)
- In-browser inference: [ONNX Runtime Web + WebGPU (Microsoft)](https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/), [WebGPU browser support overview](https://dev.to/pockit_tools/running-llms-in-the-browser-webgpu-transformersjs-and-chromes-built-in-ai-explained-5g18)
- Commercial predictive maintenance: [Augury machine health](https://augury.com/machine-health/), [Tractian insights & diagnosis](https://tractian.com/en/solutions/condition-monitoring/insights-and-diagnosis), [Tractian multimodal comparison](https://tractian.com/en/blog/best-multimodal-ai-condition-monitoring-solutions)
