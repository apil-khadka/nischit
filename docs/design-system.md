---
title: Nischit design system
description: Follow the component, theme, accessibility, and visual conventions used by the web application.
docType: reference
---

# Nischit design system

## Direction

Nischit will use [Astryx](https://astryx.atmeta.com/) as its component and theme foundation. The product should feel like a calm, approachable operations tool for laboratory teams: bright, clear, trustworthy, and easy to scan during receiving or QA work.

Use Astryx's **Butter** component foundation and apply the Nischit palette consistently across marketing and workspace screens. The app uses a neutral `#F6F7F9` canvas, white surfaces, and blue `#315DE8` actions. Do not create a parallel component library or replace Astryx primitives with ad-hoc buttons, inputs, cards, or tables.

The public marketing surface and workspace share the same canvas and accent. See [public site](public-site.md) for route and brand details. Status colors stay separate from the core palette and only indicate a clearly labeled state.

Astryx is currently beta and requires React 19 or later. Its documentation recommends building a custom theme from editable source, using per-category component imports, and using pre-built theme CSS for SSR applications such as Next.js.

References:

- [Astryx home](https://astryx.atmeta.com/)
- [Astryx getting started](https://astryx.atmeta.com/docs/getting-started)
- [Astryx theme system](https://astryx.atmeta.com/docs/theme)
- [Astryx components](https://astryx.atmeta.com/components)
- [Astryx CLI](https://astryx.atmeta.com/docs/cli)

## Installation and project setup

When the application is scaffolded:

```bash
pnpm add @astryxdesign/core @stylexjs/stylex @astryxdesign/theme-butter
pnpm add -D @astryxdesign/cli
pnpm exec astryx init --all
pnpm exec astryx theme add butter
```

Use the theme source as the starting point for `src/themes/nischit.ts`. Build the theme for production SSR:

```bash
pnpm exec astryx theme build src/themes/nischit.ts
```

The generated CSS and theme module must be deployed together. Use runtime theme injection during development if convenient, but use the built theme for the Next.js production path so component overrides are present on first paint.

## Nischit theme extension

The theme should extend Butter and override only the tokens and component rules that make Nischit feel like Nischit:

```tsx
import {defineTheme} from '@astryxdesign/core/theme';
import {butterTheme} from '@astryxdesign/theme-butter';

export const nischitTheme = defineTheme({
  name: 'nischit',
  extends: butterTheme,
  typography: {
    scale: {base: 16, ratio: 1.618},
    body: {family: 'Plus Jakarta Sans', fallbacks: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'},
    heading: {family: 'Plus Jakarta Sans', fallbacks: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'},
    code: {family: 'JetBrains Mono', fallbacks: 'monospace'},
  },
  tokens: {
    '--color-accent': ['#315DE8', '#315DE8'],
    '--color-background-body': ['#F6F7F9', '#F6F7F9'],
    '--color-background-surface': ['#FFFFFF', '#FFFFFF'],
  },
});
```

This snippet documents the current light palette; the app does not provide a separate dark palette. The exact token set should be generated and checked by Astryx rather than copied into individual components. Use semantic Astryx tokens such as `--color-background-body`, `--color-background-surface`, `--color-text-primary`, `--color-accent`, `--color-success`, `--color-warning`, and `--color-error`.

## Color balance

Keep the screen close to a 60–30–10 balance: neutral canvas for most of the view, white and muted surfaces for structure, and a small area of accent color for actions and state. Treat the percentages as a composition rule; do not add more colored panels just to hit an exact pixel count.

For Nischit:

| Proportion | Role | Astryx / Nischit application |
|---|---|---|
| 60% | Calm foundation | Neutral canvas `#F6F7F9` and dark text. Most screens should be quiet. |
| 30% | Supporting structure | White `#FFFFFF` surfaces and subtle neutral dividers, with muted blue surfaces only for selected or informational states. |
| 10% maximum | Attention and action | Nischit blue `#315DE8` for primary actions and selected navigation. Green, amber, and red are reserved for clearly labeled semantic statuses. |

Use status colors only for status:

| Meaning | Treatment | Required non-color cue |
|---|---|---|
| Accepted / healthy | Green surface, icon, and “Accepted” label | Check icon + text |
| Exception / review | Yellow or amber surface, icon, and “Review required” label | Warning icon + text |
| Rejected / blocked | Soft red surface, icon, and “Rejected” label | X/ban icon + text |
| Informational / verified | Blue surface, icon, and “Verified” label | Link/badge + text |

Do not use red and green as the only distinction. WCAG requires that color not be the only visual means of conveying information and requires a 4.5:1 contrast ratio for normal text at Level AA. [W3C Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [W3C Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

## Visual language

### Typography and scale

- **Plus Jakarta Sans:** all headings, labels, buttons, and body copy.
- **JetBrains Mono:** lot IDs, PO IDs, device IDs, hashes, transaction references, and code-like values only.
- Load only those two font families. Display headings use the same sans face as body text; do not introduce a separate serif or decorative font.
- Use a compact type scale of 12, 14, 16, 20, 26, and 42px. The larger steps follow the golden ratio. Public hero headings reach 42px on wide screens and reduce responsively on phones; workspace page titles use 26px. The wordmark may use 18px to retain brand hierarchy.
- Keep body text comfortable and plain. Avoid decorative type in the laboratory console.
- Use sentence case and action-oriented labels: “Accept shipment,” “Hold settlement,” “Add consumption,” “Quarantine lot.”

### Shape and spacing

Use a compact spacing scale that rounds golden-ratio steps to practical values:

- 4, 6, 10, 16, 26, and 42px spacing values;
- 8px control radius and 12px panel radius;
- 40px standard controls and 48px touch-first controls;
- 1px borders and neutral shadows used sparingly; no gradient backgrounds, decorative color glows, or text gradients.

For two-column layouts, give the primary reading area about 1.618 times the supporting area's width. Stack the columns at tablet widths and below.

Receiving screens should use larger touch targets and clear one-action rows. Dense QA and finance screens may use compact tables, but never compress the approval controls or exception reason field.

### Layout

- App shell with a calm top navigation and tenant/site switcher.
- Left navigation for desktop; bottom or compact navigation for mobile receiving.
- Responsive labeled rows for workspace queues; use tables where users need to compare several record fields side by side.
- Stepper/timeline for PO → shipment → receiving → QA → settlement.
- Banner for urgent exception or recall state.
- Drawer/dialog for secondary evidence and documents; keep the primary decision visible.
- One primary action per screen; secondary actions should not compete with it.

The application-level workflow is defined in [UI workflow research](ui-workflow-research.md). The default product screen is a role-aware operational shell and queue. User interfaces should reflect authenticated work and recorded state, not scripted outcomes or invented operational metrics.

## Component map

Use Astryx components by category entrypoint. The initial Nischit screen map is:

| Product need | Astryx primitives |
|---|---|
| Tenant/site navigation | App Shell, Top Nav, Side Nav, Select, Avatar |
| Workspace overview | App Shell, Card, responsive queue rows, labeled state, Empty State, Banner |
| Purchase order | Form Layout, Field, Text Input, Number Input, Date Input, Table, Stepper |
| Receiving | QR/scan wrapper, Button, Card, Number Input, Checkbox, Banner, Toast |
| Condition evidence | Card, Table, Chart wrapper, Dialog, Tooltip |
| QA exception queue | Table, Filter, Selector, Banner, Dialog, Text Area |
| Settlement | Card, Metadata List, Status Dot, Button, Toast, Link |
| Recall console | Search, Table, Banner, Stepper, Checkbox, Dialog |
| Verification report | Heading, Metadata List, Code, Citation, Table, Link |

Use `astryx component <Name>` and `astryx docs tokens` before inventing a new pattern. The CLI is part of the agent-ready design-system workflow and should be available to the coding assistant.

## Tenant branding

Tenant customization should extend the Nischit theme through a validated token allowlist, not arbitrary CSS. Tenants may customize:

- logo and organization name;
- accent color within contrast constraints;
- approved surface and neutral choices;
- density preference;
- locale, timezone, date and number formats;
- light/dark/system mode;
- site-specific display name.

Tenant customization must not override semantic meaning of success, warning, error, or verified states. If a tenant provides an accent color, the system must compute contrast and reject or adjust combinations that fail the accessibility gate. No tenant-supplied CSS, font URL, script, or component implementation is allowed.

## Motion and behavior

Motion should clarify state transitions rather than decorate the dashboard:

- short transitions for button, selection, and filter changes;
- medium transitions for drawer/dialog and timeline expansion;
- no looping ambient animations in operational views;
- respect `prefers-reduced-motion`;
- use a toast for completion, a banner for persistent risk, and inline text for field errors.

## Design acceptance checklist

- Astryx primitive used before custom markup.
- Semantic tokens used instead of raw colors in components.
- 60–30–10 hierarchy is visible without making the UI yellow or noisy.
- Two font families, one sans family for interface text and one mono family for identifiers.
- Main two-column layouts follow a 1.618:1 proportion and collapse cleanly on mobile.
- No gradients or decorative glows appear in the interface.
- Spacing and type sizes use the documented compact scales.
- Text contrast passes WCAG AA.
- Status has text/icon/pattern support, not color alone.
- Keyboard focus is visible.
- Receiving controls work at touch size.
- Empty and error states tell the user what to do next.
- Tenant branding cannot weaken isolation or status semantics.
