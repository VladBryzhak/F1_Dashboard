# Design: F1 Dashboard

The locked system. Every Hallmark run reads this first and pages share it. Change it on purpose; the file is the rule.

## System
- Genre: modern-minimal (pages are data screens; the home page is the one composed page)
- Home page: the race-number hero (winner portrait over their car number, team-colour wash; the one place a gradient is allowed, by the owner's choice) with a podium timing board, championship card, next race and news, `client/src/pages/Home.css`
- Theme: Console (graphite), brand kept: Saira / Saira Condensed, F1 red
- Axes: dark/condensed-sans/brand-red · posture: restrained

## Tokens
`client/src/styles/tokens.css` is the source of truth. The roles:
```css
:root {
  --color-paper: oklch(15.5% 0.01 285);  --color-paper-2: oklch(19.5% 0.011 285);  --color-paper-3: oklch(12.5% 0.009 285);
  --color-ink: oklch(96% 0.005 285);  --color-ink-2: oklch(86% 0.008 285);  --color-muted: oklch(72% 0.012 285);
  --color-rule: oklch(29% 0.012 285);  --color-rule-2: oklch(40% 0.014 285);
  --color-accent: oklch(58% 0.235 29);  --color-accent-ink: oklch(98.5% 0.006 29);  --color-focus: oklch(66% 0.2 29);
  --color-cool: oklch(80% 0.11 235);  /* readings: gaps, dates, times */
  --font-display: 'Saira Condensed', 'Saira', system-ui, sans-serif;  --font-body: 'Saira', system-ui, Arial, sans-serif;
  --font-outlier: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace;  /* what was measured */
  --radius-card: 10px;  --radius-pill: 6px;  --rule-hair: 1px;  --shadow-card: none;
}
```
Spacing (`--space-*`), type (`--text-*`), durations and easing live in `tokens.css`. Older names (`--bg`, `--card`, `--text`, `--muted`, `--accent`) alias the roles for pages not yet redesigned.

## Meanings
- F1 red: the brand and the one primary action on a screen; the current selection (tabs, switches).
- Instrument blue (`--color-cool`): readings such as gaps, dates and times.
- Team colours: data, only as a swatch beside the driver or team they belong to; text never wears them.
- Monospace: positions, points, times, gaps, car numbers, codes; never a label, a head or a button.

## Surfaces
- Graphite in three steps: the ground, panels one step up (`--color-paper-2`), the deepest step (`--color-paper-3`) for bands, hover rows and the footer.
- Hairline panels (1px `--color-rule`, radius 10px), seams instead of nested cards; no gradients, glows or shadows on surfaces.

## Type
- Heads: Saira Condensed 800, uppercase, line-height 1.02 or more, no tracking.
- Labels, table heads, captions, nav: Saira, a step smaller, sentence case, untracked.

## Controls
- Primary: F1 red fill, `--color-accent-ink` text, 6px radius, 48px tall on pages (36 to 40px in data screens).
- Secondary: 1px `--color-rule-2` outline on `--color-paper-2`, same radius and height.
- Focus: 2px `--color-focus` outline, offset 2 to 3px, instant.

## Motion
- Character: still. Colour and border changes over 120 to 220ms; no reveals; the live dot pulses only without reduced motion.

## Exports
`client/src/styles/tokens.css` in this project.
