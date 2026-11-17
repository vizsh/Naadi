# NAADI documentation

This folder is the engineering and design record of NAADI. Read it in order the first time; after that, each document stands alone.

| # | Document | Read it when you want to know |
|---|---|---|
| 01 | [Problem and users](01-problem-and-users.md) | why this exists, for whom, and how every field question became a feature |
| 02 | [Architecture](02-architecture.md) | how the app is put together: routes, components, state, the engine, data flow |
| 03 | [From signal to decision](03-signal-to-decision.md) | every equation, from a vibration window to a repair window priced in rupees |
| 04 | [Agents](04-agents.md) | who the agents are, which tools they may call, and where the owner's gate sits |
| 05 | [The digital twin](05-digital-twin.md) | how the 3D shed is built, painted, inspected and kept fast |
| 06 | [Design system](06-design-system.md) | the naksha world: tokens, rules, components and the reasoning behind them |
| 07 | [Data and validation](07-data-and-validation.md) | how the demo data is made, which public datasets validate the method, and what we must still prove |
| 08 | [Roadmap](08-roadmap.md) | what is built today, what is next, what is later |
| 09 | [Demo script](09-demo-script.md) | the four-minute walkthrough for judges |
| 10 | [Live Lab](10-live-lab.md) | how a phone becomes a sensor, and how it joins the shed floor as a tenth machine |
| 11 | [Model card](11-model-card.md) | how far to trust the numbers: the simulation study, what it changed, where it breaks |
| 12 | [Narrator](12-narrator.md) | how Claude phrases the owner's note without touching a number |
| 13 | [Setups](13-setups.md) | choose Loom 03's fault, wear, power and floor, or draw another fortnight; every page rebuilds from it |
| — | [Ideation](IDEATION.md) | the research and ideation the project started from |

Conventions used throughout:

- **Built** means it exists in this repository and runs. **Next** means it is designed and being built. **Later** means it is designed but not scheduled.
- Every number quoted from the demo (85.8 Hz, 88.6%, ₹21,308 …) is computed by [`src/lib/model`](../src/lib/model) from the synthetic demo shed. If the model changes, the numbers change; the docs quote the current build.
- Diagrams are SVG (in [`assets/`](assets)) or Mermaid, drawn in the same point-paper language as the app.
