# 09 · Demo script (three minutes)

Open the deployed link on a laptop. Keep a phone and a table fan nearby for the live beat once the Live Lab ships.

| Time | Screen | Say | Do |
|---|---|---|---|
| 0:00 | `/floor` | "A powerloom shed in Ichalkaranji. Nine machines, each keeping a punched card every six hours. A hole means a signal left that machine's own normal; no fault labels needed." | Point at the card record; hover a Loom 03 card. |
| 0:20 | `/floor` | "Watch two weeks go by." | **Replay the fortnight.** Loom 03's chain turns amber, then vermilion; its floor paints red. |
| 0:40 | `/floor` | "The change was detected on card 24, three days before the sound channel picked anything up." | Select Loom 03; open its record and point at the change-point line. |
| 0:55 | `/floor` | "What is actually wrong? Look inside the motor." | Double-click Loom 03, **Explode**. "Nine balls pass a spall on the outer race 3.585 times per turn. That is 85.9 Hz." |
| 1:20 | `/machine/L03` | "And here is that frequency in the measured spectrum, with its harmonics." | Drag **Shaft speed** off and back: the cursors miss, then lock on. Press **Now, demodulated**. |
| 1:50 | `/machine/L03` | "Bayes over a cited rulebook: outer race, 88.6%. The weaver's voice note nudged it from 86.5%. Physics carries it." | Scroll to Ranked causes and the Marathi note. |
| 2:10 | `/machine/L03` | "Time to failure: P50 7.3 days. Running to failure costs ₹21,308. Thursday's scheduled power cut costs ₹1,280, because the loom is idle anyway." | Show the cost windows and the breakdown bill. |
| 2:30 | `/machine/L03` | "The agents have drafted the dealer's WhatsApp and held the technician. Nothing goes out until the owner says yes." | **Approve repair**; the trace adds the owner's step and the repair card fills in. |
| 2:45 | header | "All of it in Hindi or Marathi for the owner." | Switch to मरा. |
| 2:55 | close | "NAADI: the machine's pulse, read like the owner reads it, and turned into a decision the owner controls." | |

## Backup answers

| Question | Answer |
|---|---|
| "Is the data real?" | The shed is synthetic and labelled so; the maths runs live on it. Public datasets (NASA IMS, CWRU, MIMII) are the validation plan in docs/07. |
| "What if there is no internet?" | All the maths runs in the browser; the field build adds a service worker and an ESP32 that computes features on the device. |
| "Why not a neural network?" | It needs fault labels nobody has. Per-machine normal plus physics needs none, and every diagnosis can be checked with a calculator. |
| "Where is the agent?" | In the trace: seven roles, each calling deterministic tools, two outward drafts held at the owner's gate. The console with what-ifs shows them re-planning. |
