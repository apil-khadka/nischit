---
title: Nischit design system
description: Follow the component, theme, accessibility, and visual conventions used by the web application.
docType: reference
---

# Nischit design system

## Direction

Nischit will use [Astryx](https://astryx.atmeta.com/) as its component and theme foundation. The product should feel like a calm, approachable operations tool for laboratory teams: bright, clear, trustworthy, and easy to scan during receiving or QA work.

Use Astryx's **Butter** theme as the starting point, then extend it into a small Nischit theme. Butter is a strong fit because Astryx describes it as warm, creamy, friendly, and blue-accented. Do not create a parallel component library or replace Astryx primitives with ad-hoc buttons, inputs, cards, or tables.

The public marketing surface uses the same semantic foundation but a lighter canvas than the default Butter body. See [public site](public-site.md) for the route and brand treatment. The workspace remains Astryx-first and keeps status semantics separate from the marketing palette.

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
    scale: {base: 14, ratio: 1.25},
    body: {family: 'Outfit', fallbacks: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'},
    heading: {family: 'Outfit', fallbacks: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'},
    code: {family: 'JetBrains Mono', fallbacks: 'monospace'},
  },
  tokens: {
    '--color-accent': ['#225BFF', '#FDEE8C'],
    '--color-background-body': ['#FDFBE4', '#261A13'],
    '--color-background-surface': ['#FFFFFF', '#2E2117'],
  },
});
```

The exact token set should be generated and checked by Astryx rather than copied into individual components. Use semantic Astryx tokens such as `--color-background-body`, `--color-background-surface`, `--color-text-primary`, `--color-accent`, `--color-success`, `--color-warning`, and `--color-error`.

## The 60–30–10 color rule

The “golden rule” is treated as a composition guideline, not a pixel-counting requirement. Adobe describes the classic 60–30–10 rule as 60% dominant color, 30% secondary color, and 10% accent color. [Adobe color guidance](https://www.adobe.com/uk/creativecloud/design/discover/complementary-colors.html)

For Nischit:

| Proportion | Role | Astryx / Nischit application |
|---|---|---|
| 60% | Calm foundation | Butter body/surface tokens: warm light background, white cards, dark warm text. Most screens should be quiet. |
| 30% | Supporting structure | Muted cream, pale blue, and pale green surfaces for sections, cards, tables, timelines, and workflow states. |
| 10% | Attention and action | Astryx blue `#225BFF` for primary actions, links, selected navigation, and verified chain references. Use bright yellow/amber for warnings, not as the default CTA. |

Use status colors only for status:

| Meaning | Treatment | Required non-color cue |
|---|---|---|
| Accepted / healthy | Green surface, icon, and “Accepted” label | Check icon + text |
| Exception / review | Yellow or amber surface, icon, and “Review required” label | Warning icon + text |
| Rejected / blocked | Soft red surface, icon, and “Rejected” label | X/ban icon + text |
| Informational / verified | Blue surface, icon, and “Verified” label | Link/badge + text |

Do not use red and green as the only distinction. WCAG requires that color not be the only visual means of conveying information and requires a 4.5:1 contrast ratio for normal text at Level AA. [W3C Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [W3C Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

## Visual language

### Typography

- **Outfit:** all operational UI, headings, labels, and body copy.
- **JetBrains Mono:** lot IDs, PO IDs, device IDs, hashes, transaction references, and code-like values only.
- Keep body text comfortable and plain. Avoid decorative type in the laboratory console.
- Use sentence case and action-oriented labels: “Accept shipment,” “Hold settlement,” “Add consumption,” “Quarantine lot.”

### Shape and spacing

Use Astryx's token scale:

- 4px base spacing increments;
- 8px element radius;
- 12px container radius;
- 24px page radius only for larger shells or marketing surfaces;
- 40px standard controls and 48px touch-first controls;
- 1px borders with shadows used sparingly.

Receiving screens should use larger touch targets and clear one-action rows. Dense QA and finance screens may use compact tables, but never compress the approval controls or exception reason field.

### Layout

- App shell with a calm top navigation and tenant/site switcher.
- Left navigation for desktop; bottom or compact navigation for mobile receiving.
- Tables for lots, purchase orders, and audit events.
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
| Workspace overview | Card, Stat, Table, Status Dot, Banner |
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
- Text contrast passes WCAG AA.
- Status has text/icon/pattern support, not color alone.
- Keyboard focus is visible.
- Receiving controls work at touch size.
- Empty and error states tell the user what to do next.
- Tenant branding cannot weaken isolation or status semantics.
