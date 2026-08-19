---
name: opulent-sponsor-context-showcase
description: |
  Sponsor discovery and outreach for festival campaigns. Maps sponsors across highly
  similar events, identifies sponsor people from public titles and exact profiles,
  follows departed people to current employers, qualifies target lists, and builds a
  sourced sponsor dossier and send-ready outreach. Use for festival sponsor discovery,
  sponsor person identification, comparable event research, sponsorship targeting,
  sponsor outreach, and sending a validated sponsor pitch.
when_to_use: >
  festival sponsor discovery, comparable event sponsor mapping, sponsorship targeting,
  sponsor person identification from a cited title, LinkedIn profile retrieval before
  outreach, sourced sponsor dossier, draft sponsor pitch, Trifecta / Nocturnal Valley
  campaign, including sending a validated draft without a separate review hold.
license: MIT
compatibility: >
  Node.js 20+. This directory is the skill package: SKILL.md at the root, references/
  and scripts/ only. Live discovery needs CONTEXT_DEV_API_KEY in the workspace env or
  Opulent Secrets — never in chat. Without it the run plans and records
  blocked_missing_credentials.
allowed-tools: Bash
metadata:
  author: opulent
  version: "0.4.0"
---

# Opulent sponsor context

This folder is the skill. Opulent GitHub import reads `SKILL.md` here. After a full
clone or copy it lives at
`/opulent/workspace/.agents/skills/opulent-sponsor-context-showcase/`.
`skill_manage(action="install")` mirrors this markdown only — it does not copy
`scripts/` or `references/`. Scripts load campaign data from this folder and write
`artifacts/` to the workspace cwd.

A campaign is one property under `references/campaigns/<key>/`. Nocturnal Valley is the
sample. When several campaigns exist, pass `--campaign <key>`.

## Opulent runtime

1. `skill_manage(action="invoke", slug="opulent-sponsor-context-showcase", purpose="festival sponsor discovery")`
2. If `scripts/brief.mjs` is missing next to this file, clone the package, then invoke again:
   `git clone https://github.com/OpulentiaAI/Sponsorships.git /opulent/workspace/.agents/skills/opulent-sponsor-context-showcase`
3. Keep the shell at `/opulent/workspace`. Do not `cd` into the skill. Artifacts belong in the workspace, not inside the installed package.
4. Run with `bash_run` and a full literal path (not `~`, `$HOME`, or `npm run` against the workspace `package.json`):
   `node /opulent/workspace/.agents/skills/opulent-sponsor-context-showcase/scripts/brief.mjs`
5. Follow the brief's NEXT lines. Do not open `references/` until a trigger below fires.
6. Never ask for `CONTEXT_DEV_API_KEY` in chat. If the brief reports it missing, one `message_user(block_on_user=true)` offering Opulent Secrets.
7. For mass discovery or a multi-target run: `document_manage(action="read")` at start, create once if absent, append at each phase.
8. After delivery passes, send through the campaign owner's connected email account when a recipient route is present. AgentMail is not a valid transport. If the owner's connected mailbox is unavailable, attach `/opulent/workspace/artifacts/packet.json`, `pitch.html`, and `pitch.txt` on `message_user` as send-ready files and record the transport blocker.

When this directory is the workspace itself, `npm run brief` is a local shortcut.

## 1. Discover sponsors and people

```bash
node /opulent/workspace/.agents/skills/opulent-sponsor-context-showcase/scripts/discover_sponsors.mjs --mass
```

Complete these checks in order:

1. Extract every cited sponsor activation from all selected comparable events.
2. Keep activations whose category matches the campaign profile and whose month or date falls inside the rolling past year.
3. Search the public web with the sponsor company and cited employee title. Treat exact LinkedIn profile URLs as candidates.
4. Retrieve up to three ranked profiles. Resolve a person only when the retrieved name, employer, and title function match.
5. When the name matches but the person left, resolve the current employer by name and add that institution instead. Keep the source sponsorship as route provenance. Stop after one employer hop.

The destination needs a canonical bare domain before it enters `artifacts/discovered.csv`. The source activation never becomes activation evidence for the destination employer.

Done means `artifacts/discovery/mass-results.json` records every checked state and `artifacts/discovered.csv` contains only rows that can enter the ordinary domain, compliance, and exclusion gates. A missing Context.dev key is done only as `blocked_missing_credentials` with a written plan.

Use `--event`, `--check`, and `--emit` for one difficult sponsor page.

## 2. Research one accepted target

```bash
node /opulent/workspace/.agents/skills/opulent-sponsor-context-showcase/scripts/research.mjs --target <id>
```

Research runs the target gates, company calls, brand extraction, and first dossier assembly. A decision-maker call receives an exact profile URL only. General search results remain candidates until retrieval succeeds.

Done means the cohort counts are printed, every call has a terminal state, brand tokens exist, and the first dossier is assembled.

## 3. Write the judgement

Read `artifacts/signal.json` and `artifacts/dossier.json`.

- Fill the signal from one dated activation page with a quote and source URL.
- Write `fit.band`, `rationale`, and `counter_evidence` from retrieved evidence.
- Write one dated `outreach.reason_to_engage` with its source URL.
- Write the personal note in Trifecta's register.
- Name a rate-card tier verbatim or leave it empty. Treat availability as unknown.
- Write the subject and preview text last.

Done means the signal is eligible and the judgement fields are complete at the strength of the evidence.

## 4. Deliver send-ready outreach

```bash
node /opulent/workspace/.agents/skills/opulent-sponsor-context-showcase/scripts/deliver.mjs
```

Add `--dashboard` when the optional run summary is useful.

Delivery assembles the dossier, renders the draft, lints the prose, attaches the draft to the packet, and validates the full contract.

Done means lint exits 0, full validation exits 0, and the rendered message appears in `packet.messages[]` with `send_state: ready_to_send` and `review_state: not_required`. Send it through the campaign owner's connected email account without pausing for review. If no recipient route or owner-connected mailbox is available, attach the packet and pitch files on `message_user` and name that operational limitation.

## 5. Email the user a deliverability report

After all sponsor send attempts in the run, query the email provider for every returned message ID. Record the strongest status each provider proves: `accepted_by_provider`, `delivered`, `bounced`, `failed`, or `unknown_after_send`. Provider acceptance is not inbox delivery.

Send the user exactly one consolidated email with the subject `Sponsorship outreach delivery report`. Use the campaign owner's connected email account as the only transport; AgentMail is not a valid transport. Keep the report separate from sponsor messages and include one row per send attempt with:

- sponsor and recipient;
- send timestamp, provider, and message ID;
- the verified delivery status and when it was checked;
- every blocker with its next action, or `No blockers reported`.

Done means exactly one report email covers every send attempt in the run and the report itself has a provider message ID or receipt from the owner's connected mailbox. If that mailbox is unavailable, record `report_blocked_owner_email_unavailable`; if its send fails, retry once and record `report_email_failed` with the provider error. Notify the user through `message_user` in either blocked case. The sponsor sends remain complete; the reporting step remains blocked until the single consolidated email succeeds through the owner's connected mailbox.

## Invariants

- Write run output under the workspace `artifacts/`. Keep `references/` unchanged during a run.
- Record an HTTP response and receipt before setting `executed`.
- Use `unknown` for absence. Use `false` only after dated evidence supports it.
- A blocked target has no draft.
- A greeting name comes from a retrieved and matched profile.
- Attendance stays out of every draft because the supplied figures conflict.
- Property claims come from the dossier, the campaign facts, or Trifecta's source material.
- The rendered template is the deliverable. Fix a failed render instead of replacing it with handwritten output.
- A rendered message that passes delivery is ready to send. No separate review or approval step applies.
- Sponsor messages and the consolidated status report use the campaign owner's connected mailbox. AgentMail is excluded.
- Each run sends one consolidated deliverability report to the user from the campaign owner's connected mailbox.

## References

Open only the branch needed for the current step. Paths are relative to this skill file.

| Trigger | Reference |
| --- | --- |
| Write outreach prose | `references/knowledge/agency/trifecta-profile.md` and `references/writing-quality.md` |
| Cite a property fact or rate-card tier | `references/campaigns/<key>/deck-facts.md` |
| Change a provider call | `references/contextdev-capabilities.md` |
| Use Monid for discovery or gap filling | `references/monid-capabilities.md` |
| Change field shape or validation | `references/sponsor-dossier-contract.md` |
| Judge fit or build the pitch | `references/sponsor-fit-and-outreach.md` |
| Check a claim boundary | `references/evidence-policy.md` |
| Change the dashboard | `references/dashboard-brief.md` |
| Change discovery routing or tests | `references/scenarios.jsonl` |
