# opulent-sponsor-context-showcase

A skill for Opulent, built for Trifecta Marketing, Bob Dittrich's sponsorship sales agency. It searches every event that closely matches the campaign, maps the sponsors that fit Bob's category profile, and keeps only sponsorship evidence from the past year. It uses the quoted sponsorship owner's title to find comparable people at each sponsor. It resolves a person only after it retrieves an exact LinkedIn profile. Nocturnal Valley is the sample campaign. Everything about that property lives under `references/campaigns/nocturnal-valley/` and can be replaced for another engagement.

This repository is the skill package: `SKILL.md` at the root, then `references/` and `scripts/` only. `references/knowledge/agency/` carries Trifecta's identity and register, and `references/campaigns/nocturnal-valley/` carries that property's decks bit-for-bit with their claims extracted and cited, because outreach authors from them. It gathers no third-party data at rest — run artifacts stay out of git, and the templates are empty on purpose.

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

## Two gates, and why they are gates

**Compliance.** The client's own email flagged age and compliance limits on the cannabis names. Those targets are admitted for research and refused at the draft step. `npm run email` exits 4 rather than warning, because a drafted pitch is one copy-paste away from a sent one.

**Identity.** A row without an exact bare domain is rejected, never resolved by search. *Anheuser-Busch or its St. Louis distributor* names two companies with two sponsorship desks; the client is the only party who knows which they meant.

A third rule exists and cannot yet be enforced. Three sponsors were described as already in motion and never named, so every target carries `exclusion_check: unverified_against_rule` and the validator refuses to accept `clear` while that gate is open. Pitching a sponsor who is already mid-negotiation with the client is the most expensive mistake available here, and it is invisible from our side.

## What is withheld, and why

**Attendance.** The client supplied two figures four days apart — "more than 20,000 across three days" and "about 7,500 per day" — which do not reconcile and do not measure the same thing. The field is `disputed`, carries both claims with their dates, and no attendance number appears in any draft. The email template has no attendance prop at all, so there is nowhere for one to go. A number a sponsor can puncture in one question costs more than the number was worth.

**Package availability.** The decks supply a full rate card — five tiers from Presenting Sponsor at $100K+ down to Sampling Partner at $10K–$25K, extracted with slide citations into the campaign's `deck-facts.md` — so a pitch may name a tier and its published range. What was never supplied is availability: which tiers remain open and what the three in-motion sponsors hold. A pitch therefore never implies a tier is available, and the validator fails any message naming a package that is not a rate-card tier.

**Sending.** Drafting starts from `pending_draft`. A message that passes the automated delivery checks becomes `ready_to_send` with `review_state: not_required`. The workflow sends `artifacts/pitch.gmail.html` through the campaign owner's connected Gmail account. `artifacts/pitch.md` remains the authored record. After every send attempt, the workflow appends the result to the relevant knowledge entry without changing earlier content. Missing transport or recipient details are operational limitations, not review holds.

## The ten required fields

Every sponsor carries all ten, whatever the outcome: category fit, activation history, audience overlap, regional presence, budget signal, decision maker, decision maker title, contact route, compliance flags, and changes since last. Each ships with its own state, so a gap always says which kind of gap it is — the envelope rules are in `references/sponsor-dossier-contract.md`.

## Layout

```
SKILL.md                          discoverable agent entrypoint (this directory is the skill)
references/                       disclosed contracts plus campaign, agency, and templates
  writing, dossier, evidence md   load on the trigger named in SKILL.md
  knowledge/agency/               Trifecta Marketing: profile, register, sender.json, house bans
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
scripts/                          executable workflow, contract tests, optional dashboard
```

## What it will not do

- Guess a company domain or turn a name search into an identity.
- Treat a LinkedIn search result as a resolved person before profile retrieval.
- Copy an old employer's sponsorship onto the person's current employer.
- Follow a person through more than one employer move.
- Put a disputed number, an unsupplied package, or an undated claim in a message.
- Mark a target clear of a rule whose contents nobody has.
- Send sponsor messages through AgentMail.

## Sources

The festival facts, the target list, and the exclusion flag come from the client's own materials: a 15-page sponsorship deck, a 9-slide revision, a 25-company list, a sample outreach email, and the meeting note. The original list is preserved separately in `references/campaigns/nocturnal-valley/client-targets-25.csv`; the working `targets.csv` adds seven approved vodka and tequila targets. Each field in the campaign's `festival-packet.json` names which one it came from.

Client-supplied is not verified. It carries the same envelope as anything else.
