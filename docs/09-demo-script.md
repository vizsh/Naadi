# 09 · Demo script (four minutes)

Open the deployed link on a laptop. Keep a phone and a table fan nearby for the live beat (the overview page has a QR code to the Live Lab).

| Time | Screen | Say | Do |
|---|---|---|---|
| 0:00 | `/` | "Scroll: Loom 03's fortnight feeds through a jacquard reading head, card by card." | Scroll slowly past card 24 (the change is caught) and card 30 (the spectrum); stop at the rupees. |
| 0:15 | `/floor` | "A powerloom shed in Ichalkaranji. Nine machines, each keeping a punched card every six hours. A hole means a signal left that machine's own normal; no fault labels needed." | Point at the card record; hover a Loom 03 card. |
| 0:20 | `/floor` | "Watch two weeks go by." | **Replay the fortnight.** Loom 03's chain turns amber, then vermilion; its floor paints red. |
| 0:40 | `/floor` | "The change was detected on card 24, three days before the sound channel picked anything up." | Select Loom 03; open its record and point at the change-point line. |
| 0:55 | `/floor` | "What is actually wrong? Look inside the motor." | Double-click Loom 03, **Explode**. "Nine balls pass a spall on the outer race 3.585 times per turn. That is 85.9 Hz." |
| 1:20 | `/machine/L03` | "And here is that frequency in the measured spectrum, with its harmonics." | Drag **Shaft speed** off and back: the cursors miss, then lock on. Press **Now, demodulated**. |
| 1:50 | `/machine/L03` | "Bayes over a cited rulebook: outer race, 88.6%. The weaver's voice note nudged it from 86.5%. Physics carries it." | Scroll to Ranked causes and the Marathi note. |
| 2:00 | `/machine/L03` | "This is what NAADI knew on Wednesday the 11th." | Drag the replay under the case head to card 33: the spectrum shrinks, the chain blanks ahead, the forecast is the one made that day and the dotted line is what happened next. **Back to now.** |
| 2:15 | `/machine/L03` | "Time to failure: P50 6.6 days. Running to failure costs ₹21,308. Thursday's scheduled power cut costs ₹1,280, because the loom is idle anyway." | Show the cost windows and the breakdown bill. |
| 2:30 | `/machine/L03` | "The agents have drafted the dealer's WhatsApp and held the technician. Nothing goes out until the owner says yes." | **Approve repair**; the trace adds the owner's step and the repair card fills in. |
| 2:30 | `/agents` | "Seven agents, each with its own tools. Watch the work travel." | **Run the agents**; let the card cross from the Sentinel to the Diagnostician; finish at the gate and **Approve repair**. |
| 2:40 | `/agents` | "What if the power cut is cancelled? The agents re-plan: Sunday, ₹1,871. Same gate." | Switch off *Thursday's power cut*; read the banner. If a key is set, press **Phrase with Claude**: the note comes back in Marathi with every number checked. |
| 3:00 | `/model` | "How far to trust the forecast? We simulated 240 bearings to failure: 88% land inside P10 to P90, no false alarms in 480 machine-months. And here is where it breaks." | Switch on **Wear accelerates**: most failures now land before P10. |
| 3:25 | `/lab` on a phone | "And this is not a simulation: the phone learns this fan's normal in 20 seconds." | Learn normal, then touch the fan guard: holes punch, the distance crosses its threshold. |
| 3:40 | `/floor` | "It joins the shed as a tenth machine." | **Put it on the shed floor**, then **See it on the floor**: the fan, its chain, its own row in the record. |
| 3:50 | header | "All of it in Hindi or Marathi for the owner." | Switch to मरा. |
| 4:00 | close | "NAADI: the machine's pulse, read like the owner reads it, and turned into a decision the owner controls." | |

## Backup answers

| Question | Answer |
|---|---|
| "Is the data real?" | The shed is synthetic and labelled so; the maths runs live on it. The model card tests the pipeline on simulated run-to-failure bearings; public datasets (NASA IMS, CWRU, MIMII) are the next validation, listed there as pending. |
| "Did the LLM write those numbers?" | No. The narrator gets the computed facts and only phrases them; a checker refuses any phrasing with a number that is not in the facts. Without a key, a template writes the same note. |
| "What if there is no internet?" | All the maths runs in the browser; the field build adds a service worker and an ESP32 that computes features on the device. |
| "Why not a neural network?" | It needs fault labels nobody has. Per-machine normal plus physics needs none, and every diagnosis can be checked with a calculator. |
| "Where is the agent?" | In the trace: seven roles, each calling deterministic tools, two outward drafts held at the owner's gate. The console with what-ifs shows them re-planning. |
