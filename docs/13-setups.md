# 13 · Setups: the same maths, a different fortnight

The setup bar under the header changes the shed before any page is built. You can pick the kind of shed, what fault its hero machine develops, how fast it wears, how the power behaves and how noisy the floor is, or draw another random fortnight. Every page is rebuilt from that choice: the floor, the case file, the agents, the landing story, the rulebook evidence and the rupees. The demo is no longer one recorded story. It is a generator, and the detector, forecast and Bayes are read from whatever it produces.

**Everything here is synthetic.** A setup changes the data. It never changes the maths.

## The choices

| Choice | Options | What it changes |
|---|---|---|
| **Shed** | powerloom shed, flour mill, pump house | the machines and floor plan, the hero machine NAADI follows, its motor speed and drive-end bearing, the hourly cost of downtime, who leaves the voice note, and the 3D camera views (see below) |
| **Loom 03's fault** | bearing outer race, bearing inner race, unbalance, misalignment, lubrication starvation, looseness | which channels leave normal and in what order, the envelope spectrum's signature, the evidence, the leading cause, the part, its price and labour, the action and the drafts |
| **Wear** | slow, typical, fast, speeding up | the growth rate *b* of the degradation index; *speeding up* adds a curvature term *a* in ln d, so the forecast's curvature term has something to find |
| **Power** | scheduled cuts, reliable, unscheduled cuts | whether Thursday's 14:00 cut exists as free repair time; *unscheduled* blanks roughly 7% of cards at random (seeded), which the scorer skips |
| **Floor** | quiet, noisy | the false-hole rate (0.6% → 2%) and the noise on every channel's score |
| **Another fortnight** | a new random seed | the onset card (3.5–6.5 days in), the growth rate (±15%) and each channel's centre card jitter, so two fortnights of the same fault differ |

**Back to the demo** restores the default: the powerloom shed, outer-race defect, typical wear, scheduled cuts, quiet floor, seed 20261117. With the default setup, every number in the README and the demo script is reproduced exactly (88.6%, P50 6.6 days, Thursday at ₹1,280).

## The sheds

| Shed | Place (synthetic) | Machines | Hero | Motor | Drive-end bearing | Margin + wages per hour | Voice note |
|---|---|---|---|---|---|---|---|
| Powerloom shed | Shed 2 · Ichalkaranji | 6 looms, a chakki, 2 pumps | Loom 03 | 2 hp, 4-pole, 1,436 rpm | 6205-2RS, 9 balls, ₹380 | ₹700 + ₹250 | Sunita K., weaver |
| Flour mill | Girni 1 · Amravati | 6 chakkis, a water pump | Chakki 3 | 7.5 hp, 4-pole, 1,452 rpm | 6308-2RS, 8 balls, ₹720 | ₹450 + ₹180 | Ramesh P., miller |
| Pump house | Lift scheme 3 · Yavatmal | 8 monoblock pumps | Pump 3 | 5 hp, 2-pole, 2,904 rpm | 6206-2RS, 9 balls, ₹450 | ₹600 + ₹120 | Vitthal D., pump operator |

The bearing's geometry sets the defect frequencies, so the same fault lands somewhere else on each shed's spectrum: BPFO is 85.8 Hz on the loom, 74.3 Hz on the chakki and 172.6 Hz on the pump. The case file, the bearing section, the inspect view in 3D, the fault wording ("eight balls cross a spall… 3.072 times a turn"), the part, its price and the dealer's message all follow. Each other shed draws its own fortnight from the same seed, so the timeline differs too (P50 6.6, 8.5 and 4.6 days at the default seed). The other machines that need watching differ by shed: a slipping belt and a cavitating pump in the loom shed and the mill; a cavitating pump and a cracked rotor bar in the pump house.

Every machine of every shed has a case-file page. If you change the shed while a case file is open, it moves to the new shed's hero. A link to a machine that isn't in the active shed says so and points to the hero.

## Each fault's fingerprint

Each fault has a channel order (the logistic that raises each channel's hole probability over the fortnight) and a spectral family that the envelope spectrum is drawn from.

| Fault | Rule | Channels, in the order they leave normal | Spectrum | Part | ₹ part + labour |
|---|---|---|---|---|---|
| Bearing outer race | BRG-OR-01 | envelope, kurtosis, sound, velocity, temperature | BPFO and its harmonics | 6205-2RS bearing | 380 + 900 |
| Bearing inner race | BRG-IR-01 | envelope, kurtosis, sound, velocity, temperature | BPFI with 1× sidebands | 6205-2RS bearing | 380 + 900 |
| Unbalance | UNB-01 | 1×, velocity, sound, current | 1× shaft, little at the bearing tones | balance weights | 150 + 700 |
| Misalignment | ALN-02 | 2×, 1×, velocity, temperature | 2× beside 1× | shims, V-belt | 420 + 800 |
| Lubrication starvation | BRG-LUB-02 | temperature, sound, kurtosis, envelope | a broadband high-frequency rise, no tone | grease | 120 + 400 |
| Looseness | LSN-01 | 1×, 2×, kurtosis, velocity, sound | a ladder of shaft harmonics | bolts, mount pad | 260 + 600 |

## How the evidence follows

The replay reads the spectrum as of each card and turns what it sees into evidence, each with a likelihood ratio per hypothesis ([`decide.ts`](../src/lib/model/decide.ts)). The terms added for setups:

| Evidence | Seen when | Strongest for |
|---|---|---|
| `bpfiPk` | a peak at BPFI with sidebands one shaft speed either side | inner race (×9) |
| `x1up` | 1× well above its first week | unbalance (×8) |
| `x2up` | 2× risen against its first week | misalignment (×7) |
| `hf` | the high band rises with no tone standing out | lubrication (×7) |
| `harm` | four or more shaft harmonics out of the floor | looseness (×8) |
| `quiet` | no envelope peak at either bearing tone | argues against both bearing races (×0.15, ×0.2) |

The `quiet` term matters. Without it, unbalance and misalignment were ranked too weakly against the bearing faults, because the absence of a bearing tone was never counted as evidence.

## What each setup gives (measured, `npm run test:model`)

| Setup | Leading cause | Plan |
|---|---|---|
| default (outer race) | BRG-OR-01 · 88.6% | Thursday's cut · ₹1,280 |
| inner race | BRG-IR-01 · 78.2% | Thursday · ₹1,280 |
| unbalance | UNB-01 · 50.4% | Thursday · ₹850 |
| misalignment | ALN-02 · 57.1% | Thursday · ₹1,220 |
| lubrication | BRG-LUB-02 · 74.3% | Thursday · ₹520 |
| looseness | LSN-01 · 73.5% | Thursday · ₹860 |
| slow wear | Watch · P50 12.7 d | Thursday · ₹1,280 |
| fast wear | Act · P50 2.8 d | Thursday · ₹1,891 |
| speeding up | Act · P50 1.8 d | stop now · ₹5,080 |
| reliable power | Act · P50 6.6 d | Sunday · ₹1,871 |
| unscheduled cuts | Act · P50 6.9 d | Sunday · ₹1,651 |

Unbalance and misalignment lead with lower confidence than the bearing faults. That is honest: with only 1× and 2× to go on, the rulebook leaves real weight on the neighbouring causes, and the case file shows the runner-up.

## Shareable links

A setup lives in the address bar, so a link reproduces it on any device: `/machine/L03?fault=unb&wear=fast` opens the unbalance case with fast wear, and `/floor?shed=pumphouse&fault=lub` opens the pump house with starved grease. Only the choices that differ from the default are written. The setup is also kept on the device with the owner's decision; a link with setup parameters wins over what was saved. Changing the setup clears the decision, the replay position and the selected machine, because they belonged to another fortnight.

## How it is built

- [`sheds.ts`](../src/lib/model/sheds.ts): the three sheds, each with its machines, hero, bearing, speed, costs, voice note, camera views and fault wording.
- [`setup.ts`](../src/lib/model/setup.ts): the choices, the six faults (channel logistics, family, part, price, action, where, why), the active setup and the query codec.
- [`shed.ts`](../src/lib/model/shed.ts): `buildShed(setup)` draws Loom 03 from the fault's channels, the wear's *b* and *a*, the floor's noise and the seed's jitter; power decides which cards are off.
- [`physics.ts`](../src/lib/model/physics.ts): `envelopeSpectrum(seed, severity, family)` draws each family's signature; `readSpectrum` measures what the evidence rules need.
- [`replay.ts`](../src/lib/model/replay.ts), [`index.ts`](../src/lib/model/index.ts): caches keyed by the setup, so switching back is instant.
- [`Setup.tsx`](../src/components/shell/Setup.tsx): the bar, and `SetupScope`, which sets the active setup before render and remounts the page when it changes.
- Checks: `scripts/check-model.ts` asserts that every fault is diagnosed as itself, with a forecast and a feasible window, under every wear, power, floor and seed tried, and in every shed, where it also checks that the hero is the machine that degrades and that its speed is recovered from its own spectrum. `scripts/check-setups.mjs` drives a real browser through a shared link, a switch, the floor, back to the demo, a pump-house link and a switch to the mill from an open case file.

## Not yet

- The **Listen** sounds and the bearing section in the case file are still the bearing's; the non-bearing faults should get their own sound and drawing.
- There is no **healthy fortnight** (a setup where nothing fails and NAADI should stay quiet).
- A **Live Lab** session is not tied to a setup.
- A **machine shop** (lathes, a drill press, a compressor) needs its own 3D models first.
- Next phases: **money and sensor kit** (wage, output price, phone-only vs clip-on kit), and **a model card per setup**.
