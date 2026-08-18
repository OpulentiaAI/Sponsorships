# Dashboard brief

The dashboard is the argument. It has to make the method legible — that the entity was fixed before retrieval, that every field carries a source, and that nothing unproven is styled as proven.

## Visual direction and licensing

An original implementation informed by the public Opulent GTM Intelligence report app's visual direction. That repository published no license when checked on 2026-08-05, so nothing is copied from its source; the debt is aesthetic. The language: warm near-black field, paper-white type, electric accents, a visible dither texture, narrow uppercase metadata against large editorial names.

## Two layers, in this order

**Decision layer.** What a reader acts on, in plain language, matching the shipped page top to bottom:

1. **Masthead** — wordmark, `LIST → DOSSIER → PITCH`, source-mode badge. `contextdev_live` reads as live only when calls executed; `dry_run` and `blocked_missing_credentials` read as exactly those words.
2. **Scope strip** — rows in, draftable past both gates, calls ledgered, open gates unresolved.
3. **Sponsor card** — company, category, domain, exclusion state, fit band with its counter-evidence, then all ten required fields, each rendered as its own state. An `unknown` field shows its reason, so "we looked and found nothing" stays distinguishable from "we never looked."
4. **Refused rows** — every rejected target with its reason. This section is the credibility of the rest.
5. **Open gates** — the missing inputs that block a step, each with what would resolve it and which step it unblocks.
6. **Withheld** — the disputed attendance figure, both client claims side by side with their dates.

**Audit layer**, beneath: the operation ledger — capability, endpoint, status, receipt presence per call — and the truth strip restating the executed-requires-receipt rule.

## Rules that hold everywhere

- `proposed`, `blocked`, and `failed` get distinct treatment, not a softer shade of green.
- A gate state renders beside the brand it gates. A sponsor's logo next to a festival they have not agreed to sponsor is the most likely misreading of this page, and the card layout is the defence.
- List variance is shown, not reconciled. Where the client list and the public record disagree, both appear.
- Zero states are honest: an empty packet renders the empty template's own words.
- Data comes from `artifacts/packet.json`, falling back to the empty template, read **per request** rather than per build — a run that lands after the build shows up on refresh. The page renders what the run produced and neither invents nor summarises past it.

## Accessibility

WCAG-friendly contrast, status never carried by color alone, visible focus outlines, 360px width without horizontal scrolling, `prefers-reduced-motion` respected.

## What the demo is proving

In order: a client list became resolved entities, entities became evidence, evidence became structure, and structure became a page — with every step attributable and every gap named. The open gates belong on that page: a demonstration that hides what it could not answer reads as finished work rather than as the bounded pass it is.
