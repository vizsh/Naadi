---
version: 1
slug: "design-preview-index-html"
primary_target: "design/preview/index.html"
related_targets: []
---

Scope: standalone design preview of NAADI's two core Operate views, Shed floor (the 3D twin) and the Loom 03 case file, built before the Next.js app is scaffolded. Visitor mode: Operate.

Audience and job: a shed owner checking which machine needs attention and approving a priced repair; HackKumbh judges evaluating on a laptop or projector and on a phone.
Task: read the shed's health at a glance, find Loom 03, understand why NAADI believes it is an outer-race fault, compare repair windows in rupees, approve.
Proof and content: synthetic demo readings, people and prices, labelled as demo data; the physics is computed live in the page (6205 bearing geometry gives BPFO/BPFI/BSF/FTF, Monte Carlo time-to-failure, expected cost per repair window, Bayesian posterior from rulebook likelihood ratios).
Constraints: nothing glowy or AI-generic; status never colour-only (shape + label); Devanagari-ready; respects reduced motion; readable on a projector.

Memorable moment: scrub time and watch Loom 03's card chain punch itself card by card, until the shed's drawdown shows the fault before anyone heard it.
Signature interactions: the stepped card-index time scrub on the floor; one shaft-speed control in the case file that slides every bearing-fault cursor and the bearing drawing at once.
Unresolved: Hindi and Marathi strings are machine-drafted and need a native speaker's review; real dataset numbers replace the synthetic ones in the app.

## Direction contract

THESIS: The shed's health reads as a punched-card record, not a gauge cluster: every machine keeps a chain of six-hour cards, one hole for each channel that left its learned normal. It refuses the dark neon twin dashboard with donut KPIs and glowing rings.

OWN-WORLD: Naksha point paper (cool off-white ground, teal-grey fine grid, every eighth line bold) is the only container; regions are painted paper cells separated by grid gutters, never boxed cards. Slate pressboard cards, ink holes, and amber or vermilion poster paint used only for watch and act. Anek Latin and Anek Devanagari for words, Martian Mono only for measurements. Motion is stepped (two-frame index), never eased.

STORY: The owner sees one loom's chain darkening, learns from physics they can check that it is the motor bearing's outer race, sees that running to failure costs about ₹21,000 against about ₹1,300 in Thursday's power cut, and approves.

FIRST VIEWPORT: Top band: the shed drawdown, nine machine rows by 56 cards, followed by blank forecast cards. Left two-thirds: the 3D shed standing on a point-paper floor, with a card chain above each machine and Loom 03's floor cells painted vermilion. Right column: the next decision priced in rupees with Approve as the primary action, then the diagnosis with rule IDs. Bottom: the card-index time scrub.

FORM: Naksha · The Card Chain, position 5 of the ordered grounded list, assigned by the roll; seed key 88214040.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
