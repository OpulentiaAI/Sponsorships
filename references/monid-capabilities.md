# Monid: targeted discovery and enrichment

The second provider lane, alongside Context.dev. Monid (`monid` CLI, pinned 0.1.6) is a meta-catalog: hundreds of data endpoints behind one `discover → inspect → run` loop, spanning scraping, enrichment, social, product and company data, search, and monitoring. Context.dev stays the fixed plan for a known company; Monid is for the questions that plan cannot answer — targeted discovery of new sponsors by signal, and enrichment surfaces Context.dev lacks or gates.

## Setup, once

The CLI is installed and pinned. The key is the operator's step, never the agent's:

1. Generate at <https://app.monid.ai/access/api-keys>.
2. `monid keys add -k <key> -l main` — run this yourself; an agent never handles the key material.

Keyless, every Monid attempt is recorded `blocked_missing_credentials` and the run continues — the same contract as a keyless Context.dev plan.

## The loop, with receipts

```bash
monid balance                                   # state the budget before spending it
monid discover -q "<what you actually need>"    # find endpoints; never guess one
monid inspect -p <provider> -e <endpoint>       # read the schema; never guess parameters
monid run -p <provider> -e <endpoint> -i '{...}' -o artifacts/receipts/monid-<slug>.json
monid runs get -r <runId>                       # poll; fire-and-poll is the default
```

Every executed run is appended by hand to `artifacts/monid-runs.json`:

```json
[{ "run_id": "…", "capability": "…", "provider": "…", "endpoint": "/…",
   "status": "COMPLETED", "receipt": "artifacts/receipts/monid-<slug>.json",
   "credits_note": "from the run output", "observed_at": "…" }]
```

`npm run assemble` folds that file into the packet's operation ledger. Status mapping is fixed: `COMPLETED` → `executed` (receipt required, as everywhere), `BLOCKED` → `blocked_endpoint_access`, `FAILED`/`TIME_OUT` → `failed`, anything still `READY`/`RUNNING` at assemble time → `proposed`. A Monid result is evidence only through this path — no runId and receipt, no `executed`.

## Where it plugs in

| Stage | Question | First `discover` query to try |
| --- | --- | --- |
| 1b Discover | Sponsor lists and activation press the browser harvest missed | `festival sponsor list`, `press release search sponsorship` |
| 1b Discover | Brands spending on Midwest events by signal | `brand sponsorship signals`, `event marketing news search` |
| 2 Calls, gap-fill | Decision maker when Context.dev `/people/retrieve` is gated | `linkedin person profile by url` |
| 2 Calls, gap-fill | `audience_overlap` from the brand's own social audience | `instagram profile audience`, `tiktok brand profile` |
| 2 Calls, gap-fill | `budget_signal` scale from activation coverage | `news search brand activation` |

These are queries to run, not endpoints that exist — the catalog grows weekly and the LinkedIn surface was explicitly empty when checked (2026-08-13). `discover` first, and an empty catalog answer is a recorded finding, never a reason to improvise a scraper.

## Rules that do not bend here

- **Inspect before run.** Parameter guessing is the Monid equivalent of hand-building a Context.dev request.
- **The identity gate holds.** A Monid result never overrides the exact domain and exact profile URL rules. A cited search result may supply an exact profile candidate. The person remains unresolved until the selected profile is retrieved and checked.
- **Costs are stated.** `monid balance` before and after a session, conservative limits on first runs, and every `BLOCKED` run surfaced to the operator verbatim.
- **Monid supplements, never replaces.** Where Context.dev already answers (brand, codes, styleguide), the fixed plan stands — one provider per fact, the cheaper-and-already-planned one first.
