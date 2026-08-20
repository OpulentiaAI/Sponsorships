# Enrichment contract

What we buy from a provider, and what has to be true before we buy it.

The rule is one sentence: **a call runs when a required field is unanswered and this call
is the cheapest thing that answers it.** Everything below is that sentence applied.

## Why this file exists

The plan used to run twelve Context.dev calls per target, ninety credits, unconditionally.
An audit of what the downstream files actually read found that `assemble.mjs` opens six of
the twelve responses, and only two of them feed a required field: `/brand/retrieve` and
`/people/retrieve`. The other eighty credits per target bought receipts nothing opened.

That is the failure mode this contract prevents, and it is worth naming precisely because
it does not look like a failure. Every call returned 200. Every receipt was written. The
run reported complete. It was thorough, and most of the thoroughness was spent on nothing.

## The ten required fields are the demand

The dossier's `required_fields` are the only thing a call can be *for*. A call that fills
none of them is decoration until someone states why this target needs it.

| Field | Cheapest answer | The call, when that answer is missing |
| --- | --- | --- |
| `category_fit` | the client list's own category, or `industries.eic` from `/brand/retrieve` | `/web/naics` (10) |
| `activation_history` | the row's `activation_lead_source` from discovery | `/web/search`, sponsorship query (10) |
| `audience_overlap` | their front page | `/web/scrape/markdown` (1), then `/web/crawl` (8) only if the page did not say |
| `regional_presence` | `brand.address` from `/brand/retrieve` | `/web/search`, market query (10) |
| `budget_signal` | the scale claim in the activation page already being read | `/web/search`, experiential query (10) |
| `decision_maker` | an exact profile URL already on the row | `/people/retrieve` (20) |
| `decision_maker_title` | the same retrieved profile | none of its own |
| `contact_route` | the retrieved profile or the brand record | none of its own |
| `compliance_flags` | the campaign's `exclusions.csv` | none; this is a client fact, never a purchase |
| `changes_since_last` | the prior accepted run | none; this is our own record |

Four of the ten are never a purchase. Two more are usually already answered by the row the
discovery lane produced. That is the shape of the saving.

## Three lanes

`scripts/run_calls.mjs` carries the catalog, and every entry names its lane, the field it
fills, and the condition that makes it worth its credits.

**core** — the run has no dossier without it. `/brand/retrieve`, 10 credits, always. It is
also what decides the rest of the plan, which is why the runner works in two waves rather
than one burst: the address it returns answers `regional_presence`, and the `industries.eic`
it returns answers `category_fit`, so the calls that would have answered those again never
go out.

**need** — runs only while its field is unanswered. `/web/naics`, `/web/scrape/markdown`,
the three `/web/search` queries, `/people/retrieve`. Each skip is recorded with its reason
in `artifacts/calls-summary.json` and carried into the packet's operation ledger as
`skipped_not_needed`. A skip is a decision, so it carries a reason the way an execution
carries a receipt.

**opt_in** — fills no required field. `/web/sic`, `/web/scrape/sitemap`, `/web/crawl`,
`/web/screenshot`, `/web/styleguide`, `/web/fonts`. Off unless named in `--include`, and
`--include` without `--reason` exits 2. "Completeness" is not a reason. A reason names what
this target's dossier will do with the answer.

## What it costs now

| Row | Plan | Credits |
| --- | --- | --- |
| Full catalog, the old unconditional plan | 12 calls | 90 |
| Blind client-list row: no lead, no category | 6 calls | 51 |
| Discovered row: lead and category on the row | 3 calls | 21 |
| The same row once `/brand/retrieve` returns an address | 2 calls | 11 |
| Any of the above, plus a resolved person | +1 call | +20 |

Twenty-five targets at 90 credits is 2,250. The same twenty-five through this contract, most
of them carrying a lead from discovery, land near 400.

## When Monid activates

Monid is the second lane and the rule for reaching it is narrower than the rule for
Context.dev, because the catalog is unbounded and browsing it is the expensive habit.

All four have to hold:

1. **A named required field is still unanswered** after the core and need lanes have run.
   Not "more context would be nice" — a field with a `state` that is not `retrieved`.
2. **Context.dev cannot answer it**, or answered it with a gate: `/people/retrieve` returning
   402, an endpoint absent from the plan, a surface Context does not cover.
3. **`monid discover` returns an endpoint for that field.** An empty catalog answer is a
   recorded finding and the end of the attempt. It is never a reason to improvise a scraper.
4. **`monid inspect` before `monid run`.** Parameter guessing is the Monid equivalent of
   hand-building a Context.dev request, and it is how a run spends credits on a 400.

What that rules out: running `monid discover` to see what exists, enriching a field Context
already answered because a second source would be "stronger", and pulling a social audience
for a target whose fit band is already settled. One provider per fact, and the one already
planned goes first.

`monid balance` before and after, every `BLOCKED` run surfaced verbatim, every executed run
appended to `artifacts/monid-runs.json` with its receipt. No runId and receipt, no `executed`.

## What is never enriched

- **A blocked target.** Compliance and client-decision holds settle a row before any spend.
  `load_targets.mjs` settles a compliance block without a domain for exactly this reason.
- **A field the client already supplied.** The list's category is an input, not a question.
- **A fact already in the packet.** The festival's own audience, dates, and rate card come
  from the deck; no provider is asked to confirm the client's own material.
- **A field that changes nothing.** If `strong` and `plausible` both lead to the same next
  action for this target, the call that would separate them is not worth its credits.
- **Anything to make a run look thorough.** Thoroughness is measured in answered fields, not
  in executed calls, and the two came apart badly enough once to produce this file.

## Reading the ledger

`artifacts/calls-summary.json` states `catalog_credits`, `planned_credits`, `credits_spent`,
`credits_saved`, and every skip with its reason. The packet's `scope` carries the same
figures. When a reviewer asks why a field is `unknown`, the answer is in the skip reason
beside it, and "we did not look" is a legitimate answer with a stated cost.
