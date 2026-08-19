---
name: opulent-sponsor-context-showcase
description: |
  Sponsor discovery and outreach for festival campaigns. Maps sponsors across highly
  similar events, identifies sponsor people from public titles and exact profiles,
  follows departed people to current employers, qualifies target lists, and builds a
  sourced sponsor dossier and send-ready outreach. Use for festival sponsor discovery,
  sponsor person identification, comparable event research, sponsorship targeting,
  sponsor outreach, and sending a validated sponsor pitch.
license: MIT
allowed-tools: Bash
metadata:
  author: opulent
  version: "0.4.0"
---

# Opulent sponsor context

Requires Node.js 20+. This directory is the skill package: `SKILL.md` at the root,
with `references/` and `scripts/` only. Live discovery uses `CONTEXT_DEV_API_KEY` from
the workspace environment or Opulent Secrets, never chat. Without it, the run plans
and records `blocked_missing_credentials` while continuing every available step.

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
6. Never pause or block the run for authentication. Do not request an interactive Gmail or provider authorization checkpoint. Continue every available step end to end, record unavailable credentials or transport as operational blockers, and state those blockers only in the final `message_user` and the single AgentMail delivery report.
7. For mass discovery or a multi-target run: `document_manage(action="read")` at start, create once if absent, append at each phase.
8. After delivery passes, send through the campaign owner's connected Gmail account when a recipient route is present. AgentMail is not a valid sponsor transport. If Gmail is unavailable, continue the run, attach `/opulent/workspace/artifacts/packet.json` and `pitch.md` on the final `message_user` as send-ready files, and record the transport blocker there and in the single AgentMail report.
9. Use agent spawns judiciously and only for genuinely independent work that benefits from parallel execution. Assign one durable owner for Gmail authorization and send side effects; the root coordinates or waits instead of repeating delegated work. Before completion, merge every relevant result and file from spawned agents into the main run and verify the merged result. One user prompt may produce at most one Gmail authorization attempt and one send attempt per approved recipient across the full agent hierarchy.

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

Research runs the target gates, company calls, and first dossier assembly. A decision-maker call receives an exact profile URL only. General search results remain candidates until retrieval succeeds.

Done means the cohort counts are printed, every call has a terminal state, and the first dossier is assembled.

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

Delivery assembles the dossier, writes the Gmail-ready Markdown draft, lints the prose, attaches the draft to the packet, and validates the full contract. Markdown changes the file format only; every authorship, sourcing, voice, rate-card, subject, preview, and single-ask requirement still applies.

Done means lint exits 0, full validation exits 0, and the Markdown message appears in `packet.messages[]` with `send_state: ready_to_send` and `review_state: not_required`. Send it through the campaign owner's connected Gmail account without pausing for review or authentication. If no recipient route or connected Gmail account is available, continue all other work and name the operational limitation only in the final `message_user` and single AgentMail report.

## 5. Update the user through AgentMail

After all sponsor send attempts in the run, query the email provider for every returned message ID. Record the strongest status each provider proves: `accepted_by_provider`, `delivered`, `bounced`, `failed`, or `unknown_after_send`. Provider acceptance is not inbox delivery.

Send the user exactly one consolidated AgentMail email with the subject `Sponsorship outreach delivery report`. Keep the report separate from sponsor messages and include one row per send attempt with:

- sponsor and recipient;
- send timestamp, provider, and message ID;
- the verified delivery status and when it was checked;
- every blocker with its next action, or `No blockers reported`.

Done means exactly one report email covers every send attempt in the run and AgentMail returns a message ID or receipt for it. If AgentMail is unavailable, record `report_blocked_agentmail_unavailable`; if its send fails, retry once and record `report_email_failed` with the provider error. Do not pause for AgentMail authentication. Continue to the end and notify the user through the final `message_user` in either failed case. The sponsor sends remain complete and the report outcome remains recorded as unsuccessful until a later run can send the one consolidated email.

## Invariants

- Write run output under the workspace `artifacts/`. Keep `references/` unchanged during a run.
- Record an HTTP response and receipt before setting `executed`.
- Use `unknown` for absence. Use `false` only after dated evidence supports it.
- A blocked target has no draft.
- A greeting name comes from a retrieved and matched profile.
- Attendance stays out of every draft because the supplied figures conflict.
- Property claims come from the dossier, the campaign facts, or Trifecta's source material.
- The Gmail-ready Markdown draft is the deliverable. Preserve every authorship mandate even though React Email and HTML are not required.
- A Markdown message that passes delivery is ready to send. No separate review, approval, or authentication pause applies.
- Sponsor messages use the campaign owner's connected Gmail account. AgentMail is excluded from sponsor delivery.
- Each run sends one consolidated deliverability report to the user through AgentMail.
- Authentication and transport obstacles never stop unrelated work. State them only in the final `message_user` and the consolidated AgentMail report.
- One durable side-effect owner controls Gmail authorization and sending across the agent hierarchy, preventing duplicate checkpoints and send attempts.

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
