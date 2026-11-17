---
name: NAADI
description: Machine pulse intelligence for small factories, recorded as a punched-card chain on point paper.
colors:
  point-paper: "#f3f4ef"
  painted-cell: "#f9faf6"
  paper-step: "#e9ece4"
  card-slot: "#e2e6dd"
  hairline: "#c9cfc6"
  ink: "#17191c"
  ink-secondary: "#41474e"
  ink-muted: "#656b72"
  pressboard: "#6e7b86"
  pressboard-deep: "#56626c"
  baseline-grey: "#80837b"
  grid-ink: "#406c62"
  safe-green: "#1f8a55"
  watch-amber: "#d99a00"
  act-vermilion: "#c8372a"
typography:
  headline:
    fontFamily: "Anek Latin, Anek Devanagari, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  decision:
    fontFamily: "Anek Latin, Anek Devanagari, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.32
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Anek Latin, Anek Devanagari, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Anek Latin, Anek Devanagari, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Anek Latin, Anek Devanagari, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.4
  measure:
    fontFamily: "Martian Mono, ui-monospace, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 450
    lineHeight: 1.4
    fontFeature: "tnum"
    fontVariation: "'wdth' 87.5"
  devanagari:
    fontFamily: "Anek Devanagari, Anek Latin, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  none: "0px"
  sm: "2px"
spacing:
  cell: "8px"
  gutter: "16px"
  region: "24px"
  block: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.painted-cell}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#2c3035"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-step}"
  segment-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.painted-cell}"
    padding: "7px 10px 6px"
  chip-demo:
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    padding: "4px 6px 3px"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "#d6dad3"
    rounded: "{rounded.sm}"
    padding: "9px 11px"
  region:
    backgroundColor: "{colors.painted-cell}"
    rounded: "{rounded.none}"
    padding: "24px"
---

# Design System: NAADI

## Overview

**Creative North Star: "Naksha · The Card Chain"**

NAADI records a shed the way a jacquard loom records a pattern: on point paper, as a chain of punched cards. Every machine keeps one card per six hours, and a hole marks a channel that left its learned normal. The interface is not a gauge cluster. It is a drawdown you read like a weave: blank cards where nothing happened, holes where something did, poster paint only where the owner must watch or act.

The page is a single sheet of naksha point paper: a cool off-white ground with a teal-grey fine grid every 8px and a bold line every 64px. Content sits in painted cells (the grid hidden) separated by gutters where the grid shows through. The 3D shed stands on the same paper: an unlit point-paper floor, matte machines drawn with faint ink edges like a technical illustration, punched-card chains hanging above every machine, and status painted into the floor cells around a footprint. Density is high and quiet, with every number carrying a unit. Motion indexes like a jacquard cylinder, card by card.

The user ruled out the AI-generated, glowy look: no neon, no glow, no purple gradients. The category's dark HUD dashboard is the anti-reference.

**Key Characteristics:**
- Point paper is the only container; regions are painted cells, never boxed cards.
- Colour carries meaning only: amber for watch, vermilion for act, each with its ISO shape and a label.
- The punched-card record (drawdown, chain, scrub strip) is the primary data form.
- Analyst-grade charts drawn on data-aligned point paper; ink marks, hairline grid.
- Stepped, indexed motion; no easing curves.
- Bilingual by construction: Anek Latin with Anek Devanagari for Hindi and Marathi.

## Colors

A restrained, paper-and-ink palette: cool neutrals, slate pressboard, and two poster paints held back for status.

### Primary
- **Drafting Ink** (#17191c): all primary text, chart traces, punched holes, the primary button, the "now" line, selection contours in 3D, tooltips.

### Secondary
- **Slate Pressboard** (#6e7b86): the stock of a healthy card in the 3D chains and the fill of non-leading bars and posterior cells (as #aeb6bb in 2D). **Pressboard Deep** (#56626c) for its shaded faces.

### Tertiary
- **Watch Amber** (#d99a00): poster paint for watch-state cards, floor rings and threshold lines. Sub-3:1 on paper by nature; always paired with the triangle icon and a label.
- **Act Vermilion** (#c8372a): poster paint for act-state cards, floor rings, the BPFO cursor family, the bearing spall, the failure-window bracket and the act threshold.
- **Safe Green** (#1f8a55): confirmation only (an approved repair's check). Healthy machines are shown by absence of paint, not by green.

### Neutral
- **Point Paper** (#f3f4ef): the page ground and the 3D floor and sky.
- **Painted Cell** (#f9faf6): the fill of every content region; hides the grid.
- **Paper Step** (#e9ece4): hover wash, hatched-off cells, recessed notes.
- **Card Slot** (#e2e6dd): an unpunched card in 2D records and posterior cells that are off.
- **Hairline** (#c9cfc6): control outlines (segmented controls, draft cards).
- **Grid Ink** (#406c62): the point-paper lines, used only at 9% (fine), 20% (bold) and 28% (rules) opacity.
- **Ink Secondary** (#41474e) and **Ink Muted** (#656b72): secondary and tertiary text; muted still clears 4.5:1 on painted cells.
- **Baseline Grey** (#80837b): the healthy-baseline trace beside the ink trace.

### Named Rules
**The Two Paints Rule.** Amber and vermilion appear only where a machine must be watched or acted on, always with the triangle or circle and a word. They are never decoration and never a chart series.

**The Absence Rule.** Normal is unpainted. A healthy machine shows as a blank card and a quiet square outline, never as green.

## Typography

**Display Font:** Anek Latin (with Anek Devanagari, system-ui)
**Body Font:** Anek Latin (with Anek Devanagari, system-ui)
**Label/Mono Font:** Martian Mono at 87.5% width, tabular figures

**Character:** Anek is a multi-script family from an Indian foundry, so Latin and Devanagari sit at one weight and rhythm. Martian Mono is narrow and engineered; it appears only where something is measured.

### Hierarchy
- **Headline** (650, 28px, 1.15): the case-file title, one per view.
- **Decision** (600, 21px, 1.32, balanced): the sentence that states the recommended action; dates and places inside it go to 780.
- **Title** (650, 17px, 1.25): region headings.
- **Body** (400, 15px, 1.5): running text; sub-copy at 14px capped at 72ch.
- **Label** (500, 12.5px): legends, fine print, chart captions; row labels at 600.
- **Measure** (Martian Mono 450, 10.5–12px, tabular): axis ticks, readouts, rule IDs, tool calls.
- **Devanagari quote** (Anek Devanagari 600, 22px): a worker's own words, shown before the translation.

### Named Rules
**The Measurement Mono Rule.** Mono is for measurements, codes and tool calls. Never use it for prose, headings, or a "technical" mood.

**The No Kicker Rule.** Headings stand alone. Never put a small label above a heading.

## Layout

The grid is literal point paper: an 8px cell and a 64px block, with the page inset 24px (16px gutters between regions). Content regions are painted cells; the grid shows in the gutters only. The shed floor view runs a two-column grid: the card record spans the top; below it the 3D shed (fluid) sits beside a 400px decision column. The shed is sized to land in the first viewport (100svh minus 412px, between 440 and 760px), with the card-index scrub laid along its foot. The case file runs a fluid column beside a 420px column: spectrum and bearing; then the channel chain full-width; then wear forecast and costs beside ranked causes; then the agent trace full-width. Breakpoints: 1240px narrows the side column to 360px; 1080px stacks to one column; 720px moves the readout and scrub below the 3D view and lets card records scroll sideways with their machine labels fixed.

**The Exact Duration Rule.** One card is exactly six hours. Every time axis is laid in cards with a 2px gap, an extra 2px at midnight and a wider gap at now. The future is drawn as blank dashed cards, never as a continuation of the past.

## Elevation & Depth

Flat by default. Depth comes from paint, not shadow: a painted cell sits "above" the gridded paper because the grid disappears inside it. Only things that float over the 3D view carry a shadow, and always a soft, offset one.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 1px 0 rgba(64,108,98,.28), 0 10px 24px rgba(23,25,28,.08)`): the selected-machine readout over the shed.
- **Tooltip** (`box-shadow: 0 8px 20px rgba(23,25,28,.18)`): the ink tooltip.
- **Rule** (`box-shadow: 0 1px 0 rgba(64,108,98,.28)`): the header's bottom line and section rules; a bold point-paper line, not a border.

### Named Rules
**The Paint, Not Shadow Rule.** Separate regions with gutters of visible point paper. Never with drop shadows or bordered cards.

## Shapes

Square-cornered, like cut card stock. Regions, cards, cells and bars are square; buttons and the tooltip take a 2px radius; bar data-ends round by 2px at the value end only. Status uses ISO 3864 shapes: an outline square for normal, a filled triangle for watch, a filled circle for act, a struck circle for off. Points and holes are circles; nothing else is round.

## Components

### Buttons
- **Shape:** near-square (2px radius).
- **Primary:** Drafting Ink fill, Painted Cell text, 10px × 16px, 600 weight. One per decision ("Approve repair").
- **Hover / Focus:** a two-frame step to #2c3035; focus is a 2px ink outline at 2px offset.
- **Secondary:** transparent with a 1px inset ink outline; hover steps to Paper Step. Pressed toggles (sound, segments) invert to ink.
- **Quiet:** underlined 13px link-button for table toggles and undo.

### Chips
- **Style:** uppercase 11px label at 92% width, 1px inset muted outline, no fill ("Demo data").

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** Painted Cell on Point Paper.
- **Shadow Strategy:** none (see Elevation).
- **Border:** none; the paper gutter separates.
- **Internal Padding:** 24px (16px under 720px).

### Navigation
- **Style:** 14px 600 text tabs in the header; the current view is ink with a 2px ink underline flush to the header rule. Language is a segmented control (EN · हिं · मरा), the active segment inverted to ink.

### The Card Record (signature)
A drawdown on point paper: machines as rows, cards as columns. Slot = Card Slot; hole = ink dot sized by how many channels left normal (1, 2–3, 4+); watch and act paint the whole card; off is hatched at 45°; the future is dashed and blank, with the failure window drawn over it as a vermilion bracket (P10–P90, diamond at P50) and the repair window as an ink-outlined card that fills when approved. Labels stay fixed while the cards scroll.

### The Card Chain (signature, 3D)
Twelve fan-folded cards (three days) hang above each machine from a steel rod on lacing cord; healthy cards are slate pressboard, watch and act cards are painted, off cards are pale; holes are ink circles on the card face. The machine's footprint gets a ring of painted floor cells (0.21m cells, 0.04m gaps) for watch or act, and ink corner marks when selected.

### Posterior Cells
Each hypothesis shows twenty 8px cells (5% each) filled in ink for the leading cause and slate for the rest, with the rule ID in mono beneath.

## Do's and Don'ts

### Do:
- **Do** put every new view on the same point paper (8px cell, 64px block) and separate regions with gutters.
- **Do** draw time as cards: six hours per card, holes for departures, blank dashed cards for the future.
- **Do** pair Watch Amber with the triangle and Act Vermilion with the circle, plus a word, every time.
- **Do** keep charts on data-aligned point paper: fine lines every minor tick, bold every major, ink marks at 1.25–2px.
- **Do** show the formula or the rule ID behind any number the owner is asked to act on.
- **Do** label synthetic readings, people and prices as demo data.

### Don't:
- **Don't** use glow, neon, bloom, gradients or glass. The user ruled out the AI-generated, glowy look.
- **Don't** box content in rounded, shadowed cards or nest them.
- **Don't** colour healthy machines green or use amber and vermilion as series colours.
- **Don't** ease UI state changes; step them in two frames (90–120ms), and move the 3D camera linearly with a hard stop.
- **Don't** put a kicker or eyebrow above a heading, or use mono for prose.
