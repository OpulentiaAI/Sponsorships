#!/usr/bin/env node
/**
 * brief.mjs — the one-call working brief.
 *
 *   npm run brief
 *
 * Prepares artifacts/ and prints the rules, campaign, and next command. Do not open
 * references/ at session start: text read then sits in the prefix and is re-read
 * every later turn. Open a reference only when its trigger in SKILL.md fires.
 */
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  SKILL_ROOT, WORKSPACE_ROOT, OPULENT_SKILL_DIR, artifactsDir, campaignDir,
  sender, readJson, nodeScript,
} from "./campaign.mjs";

mkdirSync(artifactsDir(), { recursive: true });

let campaign;
try {
  campaign = campaignDir();
} catch (err) {
  console.log(`WORKING BRIEF — package incomplete

SKILL ROOT     ${SKILL_ROOT}
WORKSPACE CWD  ${WORKSPACE_ROOT}
${err instanceof Error ? err.message : String(err)}

This file is not the runnable package (GitHub install mirrors SKILL.md only).
Clone into the Opulent skill scan path, then re-run this brief from the workspace cwd:

  git clone https://github.com/OpulentiaAI/Sponsorships.git ${OPULENT_SKILL_DIR}
  node ${OPULENT_SKILL_DIR}/scripts/brief.mjs

Do not cd into the skill. Artifacts must land in the workspace.`);
  process.exit(2);
}

const festival = readJson(`${campaign.dir}/festival-packet.json`);
const agency = sender();
const keyPresent = Boolean(process.env.CONTEXT_DEV_API_KEY);
const sourcesPresent = existsSync(resolve(campaign.dir, "sources"));
const localClone = WORKSPACE_ROOT === SKILL_ROOT;

const attendance = festival.attendance?.state === "disputed"
  ? "disputed — omit every attendance number from drafts"
  : String(festival.attendance?.state ?? "unknown");

console.log(`WORKING BRIEF — ${new Date().toISOString().slice(0, 10)}

SKILL ROOT     ${SKILL_ROOT}
WORKSPACE CWD  ${WORKSPACE_ROOT}
ARTIFACTS      ${artifactsDir()}
DECK SOURCES   ${sourcesPresent ? "present" : "missing — clone the GitHub package, not the mirrored SKILL.md"}
OPULENT PATH   ${OPULENT_SKILL_DIR}

Stay at WORKSPACE CWD. Do not cd into SKILL ROOT. Invoke with
skill_manage(action="invoke", slug="opulent-sponsor-context-showcase").
Shell tool is bash_run with full literal paths — not ~, $HOME, or npm run from the
workspace package.json.

CAMPAIGN       ${campaign.key}
  property     ${festival.event_name ?? campaign.key}
  attendance   ${attendance}
  sender       ${agency.name ?? "unconfirmed"} (${agency.authority_state ?? "unconfirmed"})
  context.dev  ${keyPresent ? "key present" : "blocked_missing_credentials — continue, do not substitute"}

DO NOT READ references/ YET. Open one file only when its SKILL.md trigger fires.

NEXT
  ${nodeScript("discover_sponsors.mjs", "--mass")}
  ${nodeScript("research.mjs", "--target <id>")}
  write judgement into ${artifactsDir()}/dossier.json from ${artifactsDir()}/signal.json
  ${nodeScript("deliver.mjs")}
${localClone ? `
Local clone shortcut (only when cwd is this skill): npm run discover -- --mass
` : ""}
EVIDENCE
  Every fact carries a source URL and when it was seen. No source, no claim.
  Absence is unknown, never guessed. false only after dated evidence.
  Resolve a person only after exact LinkedIn profile retrieval. Search hits are candidates.
  One employer hop only. Do not copy the old sponsor's activation onto the new employer.
  Identity: reject a row without a bare domain. Do not search a name into an identity.
  A blocked target has no draft. A Markdown message that passes delivery is ready_to_send.

CREDENTIALS
  Never pause or block for authentication. Continue every available step end to end.
  Record missing credentials or transport and state them only in the final message_user
  and the single AgentMail delivery report.

DELIVERY
  Send a validated message through the campaign owner's connected Gmail when a recipient route exists.
  Otherwise continue, then attach ${artifactsDir()}/packet.json and pitch.md on the final message_user.
  One durable side-effect owner performs Gmail authorization and sends across all agents.

SCRATCHPAD
  For mass discovery or a multi-target run, document_manage(action="read") at start,
  create once if absent, append at each phase boundary.`);
