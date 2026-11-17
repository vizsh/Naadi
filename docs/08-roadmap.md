# 08 · Roadmap

Status of every planned piece, kept current with the code.

## Built

| Area | What exists | Where |
|---|---|---|
| Model | seeded shed, bearing physics, envelope spectrum, Page–Hinkley, growth fit, Monte Carlo, rupees with scenarios, Bayes over rules | [`src/lib/model`](../src/lib/model) |
| Model checks | invariants, the numbers the docs quote, replay consistency and a small calibration study (`npm run test:model`) | [`scripts/check-model.ts`](../scripts/check-model.ts) |
| Replay as of any card | change point, growth fit, Monte Carlo, evidence and ranking recomputed from cards 1 to k only | [`replay.ts`](../src/lib/model/replay.ts) |
| Live Lab sessions | each learned normal and its time-stamped cards kept in IndexedDB; resume a session without learning again | [`sessions.ts`](../src/lib/lab/sessions.ts), [`SavedSessions`](../src/components/lab/SavedSessions.tsx) |
| Offline and storage | a service worker caches every page and its assets on first visit (network-first pages, cache-first assets, the narrator never cached); the owner's decision, what-ifs, language and a decision log persist in localStorage; the header reports the real state; installable via the web-app manifest; `scripts/check-offline.mjs` proves it | [`public/sw.js`](../public/sw.js), [`Offline.tsx`](../src/components/shell/Offline.tsx), [`store.ts`](../src/lib/store.ts) |
| Calibrated forecast | fit from the first card clear of the normal band, √3 on the fit's error for smoothing, ±15% prior, and a curvature term used only when significant (z > 2), all tuned by the study | [`forecast`](../src/lib/model/shed.ts), [docs/11](11-model-card.md) |
| Landing page | a fortnight in one scroll: Loom 03's punched-card record (a row per six hours, eight channels, the degradation trace on a log scale) is pinned on the left, opens fully punched and replays from card 1; nine chapters (the card, normal, the change caught, the spectrum, the forecast, the causes, the rupees, the agents, the owner) are computed as of the row being read; doors, QR code to the Lab | [`/`](../src/components/home/Overview.tsx), [`RecordColumn`](../src/components/home/RecordColumn.tsx) |
| Setups | a bar under the header picks the kind of shed (powerloom shed, flour mill or pump house, each with its own machines, hero, bearing, motor speed, costs, voice note and camera views), the hero's fault (six, each with its channel order, spectral family, evidence, part and price), wear (slow to speeding up), power (scheduled, reliable, unscheduled cuts), floor noise and seed; every page rebuilds from it; the setup is kept in the address bar and on the device; every fault is checked to diagnose as itself | [`setup.ts`](../src/lib/model/setup.ts), [`Setup.tsx`](../src/components/shell/Setup.tsx), [docs/13](13-setups.md) |
| Shed floor | card record (9 × 56 + 48 ahead), 3D twin, chains, floor paint, camera presets, replay scrub with a data track, readout, decision panel | [`/floor`](../src/app/floor/page.tsx) |
| 3D inspection | x-ray motor, bearing with orbiting balls and a flashing spall, exploded motor with labels | [`engine.ts`](../src/lib/twin/engine.ts) |
| Case files | Loom 03's full physics case; honest records for the other eight machines | [`/machine/[id]`](../src/app/machine/[id]/page.tsx) |
| Replay in the case file | a sticky replay bar: the spectrum grows out of the floor, the spall grows, the chain blanks ahead, the forecast is the one made that day with what happened next drawn faint, the causes rank as they did then; costs stay priced at card 56 | [`CaseFile`](../src/components/case/CaseFile.tsx) |
| Agent console | seven distinct 3D agents joined by the roster's handoffs; a punched card travels each handoff, the acting agent rises, a printed tape types each call with what it read and returned on the run's clock; the owner's gate with Approve; what-ifs, plan-change banner, outbox, owner note | [`/agents`](../src/components/agents/AgentConsole.tsx), [`agents3d/engine.ts`](../src/lib/agents3d/engine.ts) |
| Filled views | *Every machine, now* tiles under the floor's shed; the Live Lab explains its three steps, its score and its eight hole positions before a sensor starts | [`MachineGrid`](../src/components/floor/MachineGrid.tsx), [`LiveLab`](../src/components/lab/LiveLab.tsx) |
| Live Lab | microphone or synthesised fan as a live sensor; 21 features, Ledoit–Wolf, Mahalanobis, own-normal threshold, cards every 2 s, waterfall, *what changed*; motion sensor on phones | [`/lab`](../src/components/lab/LiveLab.tsx), [docs/10](10-live-lab.md) |
| Lab → shed | the Lab session becomes a tenth machine: a fan on the floor with its own live chain, floor paint and readout, a row under the card record (1 card = 2 s), a Live chip with Stop in the header | [`LiveBand`](../src/components/floor/LiveBand.tsx), [`engine.ts`](../src/lib/twin/engine.ts) |
| Model card | a simulation study run in the browser: warning time, P10–P90 calibration, false alarms, rupees under the repair policy, with switches for accelerating wear, the prior and the first version's forecast | [`/model`](../src/components/model/ModelCard.tsx), [docs/11](11-model-card.md) |
| Narrator | Claude phrases the owner's note from server-computed facts; a checker refuses any number not in the facts; template when there is no key | [`/api/narrate`](../src/app/api/narrate/route.ts), [docs/12](12-narrator.md) |
| Rulebook | ten fault rules with signature spectra, sounds, punched channels, evidence weights, actions and sources | [`/rulebook`](../src/components/rulebook/Rulebook.tsx) |
| Sound | healthy, now, demodulated bearing sounds; a sound for every rule | [`synth.ts`](../src/lib/audio/synth.ts), [`rulebook.ts`](../src/lib/rulebook.ts) |
| Owner decision | approve, not now, undo; drafts held until approval, everywhere the decision appears | [`DecisionActions`](../src/components/decide/DecisionActions.tsx) |
| Languages | English, हिंदी, मराठी (machine-drafted) | [`i18n.ts`](../src/lib/i18n.ts) |

## Next

| Piece | What it adds |
|---|---|
| **Public data on the model card** | NASA IMS warning time and calibration, CWRU BPFO/BPFI confusion, MIMII AUC for the Live Lab's score; the rows are on `/model`, marked pending |
| **Earlier bends** | the curvature term is built but catches acceleration late (two thirds of accelerating failures still land before P10); next, a recent-window slope or a change point on the growth rate itself ([docs/11](11-model-card.md)) |
| **Setups: a machine shop** | lathes, a drill press and a compressor; needs their 3D models first |
| **Setups, phase 3: money and kit** | the owner's wage, output price and power tariff, and phone-only against the clip-on kit, so the rupees and the evidence change with them |
| **Setups, phase 4** | a healthy fortnight where NAADI should stay quiet; Listen sounds and drawings for the non-bearing faults; the model card run per setup |
| **Native review** | Hindi and Marathi strings, and the narrator's phrasing, checked by native speakers |
| **Narrator, live** | the route is built and checked without a key; a live run with a key, and the note on the floor's decision panel |

## Later

| Piece | Notes |
|---|---|
| Sync when signal returns | saved Live Lab sessions and the decision log sent to a shared store (the technician and dealer views) when the device is back online |
| ESP32 firmware | the same feature definitions on the edge, MQTT or BLE out |
| Technician week | jobs ranked by risk × rupees across sheds, routed on OpenFreeMap |
| Dealer demand | parts × weeks heat map from summed failure probabilities |
| Shared store | Supabase for technician and dealer views |
| Repair log | each repair updates the rulebook priors for that shed |

```mermaid
gantt
  title NAADI build plan
  dateFormat  YYYY-MM-DD
  axisFormat  %d %b
  section Built
  Design direction and preview          :done, d1, 2026-11-17, 1d
  App, model, floor, case files         :done, d2, 2026-11-17, 1d
  Live Lab, agents, overview, rulebook  :done, d3, 2026-11-17, 1d
  Replay, Lab to shed, model card, narrator :done, d4, 2026-11-17, 1d
  section Next
  Public data on the model card         :active, n1, 2026-11-18, 3d
  Earlier bends in the forecast         :n2, 2026-11-19, 2d
  Native review, narrator live          :n3, 2026-11-20, 2d
  section Later
  Live-card storage and ESP32 firmware  :l1, 2026-11-22, 5d
  Technician and dealer views           :l2, 2026-11-25, 5d
```
