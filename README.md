# opulent-sponsor-context-showcase

A skill for Opulent, built for Trifecta Marketing, Bob Dittrich's sponsorship sales agency. It searches every event that closely matches the campaign, maps the sponsors that fit Bob's category profile, and keeps only sponsorship evidence from the past year. It uses the quoted sponsorship owner's title to find comparable people at each sponsor. It resolves a person only after it retrieves an exact LinkedIn profile. Nocturnal Valley is the sample campaign. Everything about that property lives under `references/campaigns/nocturnal-valley/` and can be replaced for another engagement.

This repository is the skill package: `SKILL.md` at the root, then `references/` and `scripts/` only. `references/knowledge/agency/` carries Trifecta's identity and register, including Bob's own two cold emails preserved verbatim in `writing-samples.md`, and `references/campaigns/nocturnal-valley/` carries that property's decks bit-for-bit with their claims extracted and cited, because outreach authors from them. It gathers no third-party data at rest — run artifacts stay out of git, and the templates are empty on purpose.

## What it does

The discovery run starts with the campaign's event profile. It covers prior events at the same venue, events with the same format and region, and events in the same market. National events are optional.

For each event, the run extracts sponsor name, sponsor category, sponsorship property title, sponsorship date, source, quote, and the named sponsor employee and title when the page supplies them. The run then checks the category against Bob's approved profile and checks the date against a rolling 365 day window.

For each match, the run searches the public web for LinkedIn profiles at the same company. The query uses the cited employee title and the sponsor company. Search results are candidates. The run ranks the listed titles and checks up to three exact profiles. It selects the closest profile that still works at the sponsor and still has a matching role. If that person left, the run resolves the current employer and adds that institution instead. It follows one employer hop only. The source sponsor and event activation remain provenance for the move. They are not treated as sponsorship evidence for the new employer.

## Run it

**Opulent runtime.** Keep cwd at `/opulent/workspace`. Do not `cd` into the skill. GitHub `skill_manage(action="install")` mirrors `SKILL.md` only; clone the package into the skill scan path if `scripts/` is missing, then:

```bash
git clone https://github.com/OpulentiaAI/Sponsorships.git \
  /opulent/workspace/.agents/skills/opulent-sponsor-context-showcase
node /opulent/workspace/.agents/skills/opulent-sponsor-context-showcase/scripts/brief.mjs
```

Start by reading the relevant communication knowledge entries. The brief prints the remaining `node <skill>/scripts/…` commands. Attach `/opulent/workspace/artifacts/` files on `message_user`. Put `CONTEXT_DEV_API_KEY` in Opulent Secrets, never in chat.

**Local clone** (this directory is the cwd):

```bash
npm run brief                    # workspace, knowledge, and campaign rules
npm run discover -- --mass       # all high similarity events, then title and person routing
# add --include-national to include national electronic music events
npm run research -- --target <id>    # gate + 12 concurrent calls + deck read + assemble
#   fill artifacts/signal.json, write judgement into artifacts/dossier.json
npm run deliver                      # assemble + draft + lint + attach + validate
npm test                             # contract tests
```

Retrieval needs `CONTEXT_DEV_API_KEY` server-side. Without it the run still validates, plans, and prices — and reports the retrieval stage as `blocked_missing_credentials` rather than substituting for it.

## Mass discovery

`npm run discover -- --mass` runs four passes.

1. It extracts every supported sponsor from all high similarity events. Each result must include a cited sponsorship title and a month or date inside the past year.
2. It keeps sponsors whose category matches `sponsor-competitor-profile.json`. That file reflects Bob's August 11 list and his request to include vodka and tequila.
3. It uses the cited sponsorship owner's title in a general web search. It ranks exact LinkedIn profile results by title similarity. It checks up to three ranked profiles and selects the best current match.
4. If the retrieved person left the sponsor, it resolves the person's current employer by name with `/brand/retrieve`. The old sponsor row is withheld. The current employer enters `artifacts/discovered.csv` after its canonical domain resolves. The route stops after this one move.

The command writes the full result to `artifacts/discovery/mass-results.json`. It writes accepted sponsor rows and person destination rows to `artifacts/discovered.csv`. The ordinary domain, compliance, and client exclusion gates still apply. A person destination keeps the prior sponsorship in named source fields. Its activation fields stay empty until separate evidence shows that the new employer sponsored an event.

Without `CONTEXT_DEV_API_KEY`, the command writes `artifacts/discovery/mass-plan.json` and records `blocked_missing_credentials`. It does not claim that any search or profile call ran.

## Raw discovery, and what counts as raw

Six mechanisms produce evidence, and each writes a raw capture the derived files are rebuilt from.

| Mechanism | Command | Raw capture it leaves |
| --- | --- | --- |
| Mass event extraction | `npm run discover -- --mass` | `artifacts/discovery/mass-raw.json`, one `/web/extract` result per comparable event, plus `mass-plan.json` and `mass-summary.json` |
| Replay routing | `npm run discover -- --route <raw.json>` | Re-derives `mass-results.json` and `discovered.csv` from a capture already on disk, spending nothing |
| Manual harvest | `npm run discover -- --event <key>` then `--check` / `--emit` | A per-event brief with quotes, dates, and source URLs; `--emit` refuses an invalid harvest |
| Per-company provider plan | `npm run calls -- --domain <d> --company "<c>"` | One receipt per call in `artifacts/receipts/`, indexed by `artifacts/calls-summary.json` |
| Dated activation brief | `npm run signal -- --url <page>` then `--check` | `artifacts/signal.json`, refused when undated or unquoted |
| Monid gap-fill | `monid discover → inspect → run` | `artifacts/receipts/monid-<slug>.json` plus a hand-appended `artifacts/monid-runs.json` |

`/web/extract` with `factCheck: true` is the only call that returns a citable `Verified` field and nulls what it cannot support. `/web/search` produces candidates, never resolutions: a search hit becomes a person only after `/people/retrieve` on an exact profile URL. Pages that need a login or render client-side are read through an authenticated browser session, and `scrape_signal.mjs` fixes the shape of what comes back so nothing is guessed.

`npm run reconcile` is the check over all of it. It re-derives the routed results from the raw capture, fails on drift, fails when a derived file is older than the capture it summarizes, traces every emitted row and every claimed verification to a URL that appears in a provider artifact, and refuses a report whose counts disagree with themselves or with the Markdown beside it. Pass `--rows <n>` and it accounts for the full target list. Run it before calling a discovery or verification pass complete.

## What it buys, and what it refuses to buy

A call runs when a required field is unanswered and that call is the cheapest thing that answers it. Nothing else runs.

The plan used to be twelve Context.dev calls per target, ninety credits, unconditionally. An audit of what the downstream files actually read found that `assemble.mjs` opens six of the twelve responses and only two of them feed a required field. The other eighty credits per target bought receipts nothing opened, and every call returned 200 while it happened. That is why this is a contract rather than a habit.

`scripts/run_calls.mjs` now carries a catalog where every entry names the field it fills and the condition that makes it worth its credits, in three lanes:

- **core** — `/brand/retrieve`, always. It also decides the rest: its address answers `regional_presence` and its `industries.eic` answers `category_fit`, so the runner works in two waves and nothing in the second pays for what the first returned.
- **need** — runs only while its field is unanswered. A dated lead from discovery stands in for the activation search; the client list's category stands in for NAICS. `research.mjs` passes both.
- **opt_in** — fills no required field. SIC, sitemap, crawl, screenshot, styleguide, fonts. Off unless `--include` names one, and `--include` without `--reason` exits 2. "Completeness" is not a reason.

| Row | Calls | Credits |
| --- | --- | --- |
| The old unconditional plan | 12 | 90 |
| Blind client-list row | 6 | 51 |
| Discovered row with a lead and a category | 3 | 21 |
| The same row once `/brand/retrieve` returns an address | 2 | 11 |

A skip is a decision, so it carries a reason the way an execution carries a receipt: both land in `artifacts/calls-summary.json` and in the packet's operation ledger as `skipped_not_needed`. When a reviewer asks why a field is `unknown`, the answer sits beside it, and "we did not look, here is what that saved" is a legitimate answer.

Monid activates on four conditions, all of them: a named required field still unanswered after the Context.dev lanes, no Context.dev answer or a gated one, `monid discover` returning an endpoint for that field, and `monid inspect` before `monid run`. Browsing the catalog to see what exists is the habit that rule exists to stop. `references/enrichment-contract.md` carries the whole thing.

## Two gates, and why they are gates

**Compliance.** The client's own email flagged age and compliance limits on the cannabis names. Those targets are admitted for research and refused at the draft step. `npm run email` exits 4 rather than warning, because a drafted pitch is one copy-paste away from a sent one.

**Identity.** A row without an exact bare domain is rejected, never resolved by search. *Anheuser-Busch or its St. Louis distributor* names two companies with two sponsorship desks; the client is the only party who knows which they meant.

A third rule exists and cannot yet be enforced. Three sponsors were described as already in motion and never named, so every target carries `exclusion_check: unverified_against_rule` and the validator refuses to accept `clear` while that gate is open. Pitching a sponsor who is already mid-negotiation with the client is the most expensive mistake available here, and it is invisible from our side.

## What is withheld, and why

**Attendance.** The client supplied two figures four days apart — "more than 20,000 across three days" and "about 7,500 per day" — which do not reconcile and do not measure the same thing. The field is `disputed`, carries both claims with their dates, and no attendance number appears in any draft. The email template has no attendance prop at all, so there is nowhere for one to go. A number a sponsor can puncture in one question costs more than the number was worth.

**Package availability.** The decks supply a full rate card — five tiers from Presenting Sponsor at $100K+ down to Sampling Partner at $10K–$25K, extracted with slide citations into the campaign's `deck-facts.md` — so a pitch may name a tier and its published range. What was never supplied is availability: which tiers remain open and what the three in-motion sponsors hold. A pitch therefore never implies a tier is available, and the validator fails any message naming a package that is not a rate-card tier.

**Sending.** Drafting starts from `pending_draft`. A message that passes the automated delivery checks becomes `ready_to_send` with `review_state: not_required`. The workflow sends `artifacts/pitch.gmail.html` through the campaign owner's connected Gmail account. `artifacts/pitch.md` remains the authored record. After every send attempt, the workflow appends the result to the relevant knowledge entry without changing earlier content. Missing transport or recipient details are operational limitations, not review holds.

## How the email is written

The pitch is Bob's, in five moves: what he saw the sponsor do and why he is writing, the property in one sentence in his own words, why this sponsor and this audience, one concrete thing they could own onsite, then one ask and the verified scheduling link. `outreach.personal_note`, `fit_point`, and `activation_idea` carry moves one, three, and four, and all three are required and specific to the sponsor. An email that would read the same for another name on the list is not finished.

Two of Bob's own cold emails are stored exactly as he supplied them in `references/knowledge/agency/writing-samples.md`, and a contract test holds their bytes so a later editing pass cannot quietly normalize his punctuation. They set the register and they are not a source to copy from: "reaching out" opens one of them and is still on the agency banned list, the em dash in the other still fails lint, and the artists one of them names appear in no deck and cannot be claimed. The file marks each where it appears.

Four references carry the craft, three of them adapted from the subagent skills in [vercel-labs/marketing-team-eve-template](https://github.com/vercel-labs/marketing-team-eve-template): `writing-quality.md` for the word-level rules, `email-style.md` for how the mail reads in an inbox, `email-adaptation.md` for what survives the trip from deck to email, and `content-editing.md` for the grounding before drafting and the passes before the send.

The split between machine and judgment is deliberate. `scripts/lint_pitch.mjs` enforces the banned lists, the em-dash ban, the no-attendance rule, the single ask, tier fidelity, and the length ceiling. Everything about the register is the coordinator's call, made before drafting and again before sending against the checks in SKILL.md. `render_email.mjs` prints a short voice check after each draft: notes to act on, never a gate.

## The ten required fields

Every sponsor carries all ten, whatever the outcome: category fit, activation history, audience overlap, regional presence, budget signal, decision maker, decision maker title, contact route, compliance flags, and changes since last. Each ships with its own state, so a gap always says which kind of gap it is — the envelope rules are in `references/sponsor-dossier-contract.md`.

## Layout

```
SKILL.md                          discoverable agent entrypoint (this directory is the skill)
references/                       disclosed contracts plus campaign, agency, and templates
  writing, dossier, evidence md   load on the trigger named in SKILL.md
  email-style.md                  subject and preview, front-loading, one ask
  email-adaptation.md             what survives the trip from deck to email
  content-editing.md              ground the draft, then edit it in passes
  knowledge/agency/               Trifecta Marketing: profile, register, sender.json, house bans
    writing-samples.md            Bob's own two cold emails, stored exactly as supplied
  campaigns/nocturnal-valley/     the sample campaign, swappable per engagement
    sources/                      the property's decks, bit-for-bit, checksummed
    deck-facts.md                 every deck claim with its slide citation
    festival-packet.json          the property being sold; client-supplied, not verified
    client-targets-25.csv         the original client-supplied list, kept unchanged
    targets.csv                   the 25 client targets plus seven approved additions
    exclusions.csv                the campaign's rule gates
    comparable-events.json        the discovery universe, tiered by the deck's own ICP
    sponsor-competitor-profile.json Bob's approved sponsor categories and person rule
  templates/                      dossier and packet templates
deliveries/                       authored output kept by the campaign owner; no script reads it
  nocturnal-valley-2026-08-20/    75-row send package: manifest.json plus one Markdown record per row
scripts/                          executable workflow, contract tests, optional dashboard
  reconcile.mjs                   derived output must regenerate from the raw capture
  run_calls.mjs                   the enrichment catalog: every call names the field it fills
```

## What it will not do

- Guess a company domain or turn a name search into an identity.
- Treat a LinkedIn search result as a resolved person before profile retrieval.
- Copy an old employer's sponsorship onto the person's current employer.
- Follow a person through more than one employer move.
- Put a disputed number, an unsupplied package, or an undated claim in a message.
- Mark a target clear of a rule whose contents nobody has.
- Assemble a result set from a script that never read the raw provider output, or report a row as verified when nothing on disk carries its source.
- Spend a credit on a field that is already answered, on a blocked target, or on a call whose response nothing downstream reads.
- Print a credential, a credential prefix, or the metadata around one.
- Send sponsor messages through AgentMail.

## Sources

The festival facts, the target list, and the exclusion flag come from the client's own materials: a 15-page sponsorship deck, a 9-slide revision, a 25-company list, his own cold outreach emails (preserved verbatim in `references/knowledge/agency/writing-samples.md`), and the meeting note. The original list is preserved separately in `references/campaigns/nocturnal-valley/client-targets-25.csv`; the working `targets.csv` adds seven approved vodka and tequila targets. Each field in the campaign's `festival-packet.json` names which one it came from.

Client-supplied is not verified. It carries the same envelope as anything else.
