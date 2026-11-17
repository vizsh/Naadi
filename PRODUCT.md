# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) on Vercel, confirmed by the user. React Three Fiber for the 3D twin and the Vercel AI SDK for agents, per `../IDEATION.md`. Design previews made before the app is scaffolded live as standalone HTML under `design/`.

## Users

- **Primary: owners** of small powerloom sheds, flour mills (chakkis) and pump-set or machine-shop units. They run second-hand or ageing machines, double as the maintenance department, and judge machine health by sound and feel. The owner approves every action, and the decision to stop production is always theirs.
- **Secondary:**
  - **Workers** on the floor who notice early signs and report them by voice or photo, often in Marathi or Hindi.
  - **Local technicians and mechanics** who plan their week across many factories.
  - **Spare-part dealers** who stock bearings, belts and similar parts.
- **Demo audience:** HackKumbh Nagpur judges (Track 4.3, Agentic AI). They open a Vercel link on a laptop and on their own phone, with a few minutes to spare.

## Product Purpose

NAADI predicts breakdowns on unmonitored, ageing machines from weeks of normal running, with no labelled fault data. For each problem it:

1. explains the likely fault from physics,
2. estimates the time left before failure,
3. prices the decision in rupees, and
4. has agents line up the technician, the part and the repair window, all for the owner to approve.

**Demo success:** a judge watches a fault emerge, understands why NAADI believes it, sees the rupee trade-off, approves a repair, and sees it reach the technician and the dealer. Then the judge sees it work live on a phone held against a running fan.

## Positioning

NAADI delivers industrial-grade condition monitoring, normally sold to large plants, on a ₹1,500 clip-on kit or a phone, and it works offline first.

- **Physics-first diagnosis:** bearing defect frequencies are computed from the bearing number, and vibration severity is judged against ISO zones. This sits alongside unsupervised learning per machine and per operating regime.
- **Agents never do arithmetic.** Every recommendation cites rulebook IDs and shows a rupee comparison.
- **Repairs go into idle windows,** including scheduled power cuts.

## Operating Context

- **Floors:** powerloom clusters (Ichalkaranji, Bhiwandi, Malegaon, Vidarbha), flour mills and pump sets. Power and phone signal are patchy, and load-shedding runs on a schedule.
- **Demo floor:** one powerloom shed with six looms, one flour chakki and two pump sets. The first case file is the drive-end bearing (6205-2RS) on the Loom 03 motor.
- **Planned views:**
  - floor twin
  - machine case file
  - agent console
  - time machine (replay of a real run-to-failure)
  - live lab (phone as sensor)
  - worker capture
  - technician week
  - dealer demand
  - rulebook
  - model card
- **Languages:** English, Hindi, Marathi.

## Capabilities and Constraints

- **Learning:** unsupervised only, with baselines per machine and per operating regime.
- **Offline:** inference runs in the browser or at the edge, data is stored locally, and alerts fall back to SMS or WhatsApp.
- **Owner approval:** every outward action (messages, bookings, stopping a machine) is approved by the owner. Agents only prepare drafts.
- **Hardware may be simulated with recorded signals:** replays of public datasets (NASA IMS, CWRU, MIMII), a physics-based simulator for looms and chakkis, and a live mode using the phone's microphone and accelerometer.
- **The LLM** plans, explains, translates and drafts. All numbers come from deterministic code. A fallback planner that needs no API key keeps the demo working offline.
- **Undecided:**
  - LLM provider and key
  - whether ESP32 hardware is shown live
  - team size and available hours

## Brand Commitments

- **Name:** NAADI ("pulse"), the working name from ideation.
- **Binding constraint from the user:** the frontend must not look like AI-generated, glowy UI. It should read as a top-tier, ship-ready product with high-end visuals and a strong wow factor.
- **Reference images:** the user supplied images of industrial digital-twin HMIs (realvirtual WEB / Mauser, Nextspace, GE Predix, NVIDIA Omniverse DTC). They are context, not templates, and the user invited going beyond them. realvirtual WEB is AGPL-3.0, so no code is reused.

## Evidence on Hand

- The HackKumbh 4.3 problem statement and `../IDEATION.md`.
- **Not yet available:** no field data, customers, pilots, testimonials or measured results exist yet, and the public datasets have not been downloaded.
- **Labelling rule:** every factory name, person, price and reading in a preview is synthetic and must be labelled as demo data.
- **Metrics:** model metrics may be shown only once they have actually been computed.

## Product Principles

1. **Physics before black boxes:** every diagnosis shows its evidence and its rule citations.
2. **The owner decides;** agents prepare.
3. **Every recommendation is priced in rupees,** with the risk stated.
4. **Works on a bad day:** offline, on low power, with patchy signal.
5. **Real data where it exists,** labelled synthetic where it doesn't.

## Accessibility & Inclusion

- Text must be Devanagari-ready for Hindi and Marathi.
- The worker capture flow must work for low-literacy users, with large touch targets and voice input.
- Status is never shown by colour alone; it always pairs an icon with a label.
- Contrast stays readable under shed lighting and on projectors.
- The UI respects reduced-motion settings.
