import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, realpathSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  destinationInstitutionFromProfile, rankPersonCandidates, routeDiscovery,
  selectComparableEvents, sponsorshipRecency, verifyResolvedProfile,
} from "./discovery-routing.mjs";
import { SKILL_ROOT, templatePath, agencyDir } from "./campaign.mjs";

const dossierTemplate = JSON.parse(await readFile(templatePath("sponsor-dossier.template.json"), "utf8"));
const packetTemplate = JSON.parse(await readFile(templatePath("packet.template.json"), "utf8"));
const festival = JSON.parse(await readFile(resolve(SKILL_ROOT, "references/campaigns/nocturnal-valley/festival-packet.json"), "utf8"));
const agencySender = JSON.parse(await readFile(resolve(agencyDir(), "sender.json"), "utf8"));
const skillDir = SKILL_ROOT;
const scriptDir = resolve(SKILL_ROOT, "scripts");
const nestedSkillPath = resolve(skillDir, "SKILL.md");
const nestedSkill = await readFile(nestedSkillPath, "utf8");

const REQUIRED_FIELDS = [
  "category_fit", "activation_history", "audience_overlap", "regional_presence",
  "budget_signal", "decision_maker", "decision_maker_title", "contact_route",
  "compliance_flags", "changes_since_last",
];

const run = (script, args, opts = {}) =>
  execFileSync("node", [script, ...args], { encoding: "utf8", ...opts });

/* ---------------- templates ---------------- */

test("the skill has one discoverable root and only references and scripts beneath it", () => {
  assert.equal(existsSync(resolve("SKILL.md")), true);
  const children = readdirSync(skillDir, { withFileTypes: true });
  const ignore = new Set(["node_modules", "artifacts"]);
  assert.deepEqual(
    children.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !ignore.has(entry.name)).map((entry) => entry.name).sort(),
    ["references", "scripts"],
  );
  assert.ok(children.some((entry) => entry.isFile() && entry.name === "SKILL.md"));
  assert.ok(existsSync(resolve(skillDir, "references/campaigns")));
  assert.ok(existsSync(resolve(skillDir, "references/knowledge")));
  assert.ok(existsSync(resolve(skillDir, "references/templates")));
  assert.ok(readdirSync(resolve(skillDir, "scripts"), { withFileTypes: true }).some((entry) => entry.isFile() && entry.name.endsWith(".mjs")));
  assert.match(nestedSkill, /^---\nname: opulent-sponsor-context-showcase\ndescription: \|\n/);
  assert.match(nestedSkill, /Sponsor discovery and outreach for festival campaigns\./);
  assert.match(nestedSkill, /\nlicense: MIT\ncompatibility:/);
  assert.match(nestedSkill, /\nmetadata:\n  author: opulent\n  version: "0\.4\.0"\n---\n/);
  assert.doesNotMatch(nestedSkill, /disable-model-invocation:/);
  for (const file of [
    "contextdev-capabilities.md", "dashboard-brief.md", "evidence-policy.md",
    "monid-capabilities.md", "scenarios.jsonl", "sponsor-dossier-contract.md",
    "sponsor-fit-and-outreach.md", "writing-quality.md",
  ]) assert.equal(existsSync(resolve(skillDir, "references", file)), true, `${file} is missing`);
  assert.equal(existsSync(resolve(scriptDir, "brief.mjs")), true);
});

test("the original 25-company client list is preserved exactly in the working targets", () => {
  const campaign = resolve(skillDir, "references/campaigns/nocturnal-valley");
  const clientRows = readFileSync(resolve(campaign, "client-targets-25.csv"), "utf8").trim().split(/\r?\n/);
  const workingRows = readFileSync(resolve(campaign, "targets.csv"), "utf8").trim().split(/\r?\n/);
  assert.equal(clientRows.length - 1, 25);
  assert.deepEqual(clientRows, workingRows.slice(0, 26));
  assert.equal(new Set(clientRows.slice(1).map((row) => row.split(",", 1)[0])).size, 25);
});

test("scripts pin skill data to SKILL.md and artifacts to the workspace cwd", async () => {
  const src = await readFile(resolve(scriptDir, "campaign.mjs"), "utf8");
  assert.match(src, /export const SKILL_ROOT/);
  assert.match(src, /WORKSPACE_ROOT = process\.cwd\(\)/);
  assert.match(src, /references\/campaigns/);
  assert.match(src, /export const nodeScript/);
  assert.doesNotMatch(src, /\.\.\/\.\.\/\.\./);
  const research = await readFile(resolve(scriptDir, "research.mjs"), "utf8");
  assert.match(research, /resolve\(here, "\.\."\)/);
  assert.doesNotMatch(research, /resolve\(here, "\.\.\/\.\.\/\.\."\)/);
});

test("SKILL.md teaches Opulent runtime: invoke, clone if scripts missing, no cd, bash_run paths", () => {
  assert.match(nestedSkill, /skill_manage\(action="invoke", slug="opulent-sponsor-context-showcase"/);
  assert.match(nestedSkill, /Do not `cd` into the skill/);
  assert.match(nestedSkill, /bash_run/);
  assert.match(nestedSkill, /node \/opulent\/workspace\/\.agents\/skills\/opulent-sponsor-context-showcase\/scripts\/brief\.mjs/);
  assert.match(nestedSkill, /git clone https:\/\/github\.com\/OpulentiaAI\/Sponsorships\.git/);
  assert.match(nestedSkill, /message_user\(block_on_user=true\)/);
  assert.match(nestedSkill, /document_manage\(action="read"\)/);
  assert.doesNotMatch(nestedSkill, /npm run brief\n/);
});

test("SKILL.md requires one consolidated receipt-backed user update through AgentMail", () => {
  assert.match(nestedSkill, /## 5\. Update the user through AgentMail/);
  assert.match(nestedSkill, /After all sponsor send attempts in the run, query the email provider for every returned message ID/);
  assert.match(nestedSkill, /Provider acceptance is not inbox delivery/);
  assert.match(nestedSkill, /exactly one consolidated AgentMail email with the subject `Sponsorship outreach delivery report`/);
  assert.match(nestedSkill, /include one row per send attempt/);
  assert.match(nestedSkill, /every blocker with its next action, or `No blockers reported`/);
  assert.match(nestedSkill, /exactly one report email covers every send attempt in the run/);
  assert.match(nestedSkill, /AgentMail returns a message ID or receipt/);
  assert.match(nestedSkill, /record `report_blocked_agentmail_unavailable`/);
  assert.match(nestedSkill, /retry once and record `report_email_failed`/);
  assert.match(nestedSkill, /Sponsor messages use the campaign owner's connected mailbox\. AgentMail is excluded from sponsor delivery/);
  assert.match(nestedSkill, /one consolidated deliverability report to the user through AgentMail/);
});

test("brief from a foreign cwd prints node SKILL_ROOT/scripts commands and does not cd", () => {
  const dir = mkdtempSync(join(tmpdir(), "brief-cwd-"));
  const canonicalDir = realpathSync(dir);
  const out = run(resolve(scriptDir, "brief.mjs"), [], { cwd: dir });
  assert.match(out, new RegExp(`SKILL ROOT\\s+${skillDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(out, new RegExp(`WORKSPACE CWD\\s+${canonicalDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(out, new RegExp(`node ${resolve(scriptDir, "discover_sponsors.mjs").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} --mass`));
  assert.match(out, /Stay at WORKSPACE CWD\. Do not cd into SKILL ROOT\./);
  assert.doesNotMatch(out, /NEXT\n\s+npm run discover/);
  assert.equal(existsSync(join(dir, "artifacts")), true);
  assert.equal(existsSync(resolve(skillDir, "artifacts", "packet.json")), false);
});

test("the dossier template declares all ten required fields", () => {
  for (const name of REQUIRED_FIELDS) {
    assert.ok(dossierTemplate.required_fields[name], `missing ${name}`);
    assert.equal(dossierTemplate.required_fields[name].state, "pending_retrieval");
  }
  assert.equal(Object.keys(dossierTemplate.required_fields).length, REQUIRED_FIELDS.length);
});

test("every template field carries the six-key envelope", () => {
  for (const [name, f] of Object.entries(dossierTemplate.required_fields)) {
    for (const key of ["value", "state", "confidence", "source", "source_url", "observed_at"]) {
      assert.ok(key in f, `${name} is missing ${key}`);
    }
  }
});

test("the template starts pending draft with no review requirement", () => {
  assert.equal(dossierTemplate.outreach.send_state, "pending_draft");
  assert.equal(dossierTemplate.outreach.review_state, "not_required");
  assert.equal(dossierTemplate.outreach.sender_authority, "authorized");
  assert.equal(dossierTemplate.outreach.subject, null);
  assert.equal(dossierTemplate.operation.write_policy, "artifact_only_no_send");
});

test("the packet template is empty and carries an open_gates slot", () => {
  assert.equal(packetTemplate.sponsors.length, 0);
  assert.equal(packetTemplate.messages.length, 0);
  assert.ok(Array.isArray(packetTemplate.open_gates));
});

/* ---------------- the festival packet ---------------- */

test("attendance is disputed and carries both client claims", () => {
  assert.equal(festival.attendance.state, "disputed");
  assert.equal(festival.attendance.value, null);
  assert.ok(festival.attendance.claims.length >= 2);
  for (const c of festival.attendance.claims) assert.ok(c.source && c.source_date);
});

test("the rate card is supplied with slide citations; availability is not", () => {
  assert.equal(festival.packages.rate_card_state, "supplied");
  assert.equal(festival.packages.rate_card.length, 5);
  for (const tier of festival.packages.rate_card) {
    assert.ok(tier.tier && tier.range && tier.source, `${tier.tier}: incomplete`);
  }
  assert.equal(festival.packages.inventory, null);
  assert.equal(festival.packages.inventory_state, "unsupplied");
});

/* ---------------- brand extraction ---------------- */

test("brand tokens come from the deck's own slide evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-"));
  run(resolve(scriptDir, "extract_brand.mjs"),
    ["--deck", resolve(SKILL_ROOT, "references/campaigns/nocturnal-valley/sources/nocturnal-valley-deck-draft-2.pptx")], { cwd: dir });
  const tokens = JSON.parse(readFileSync(join(dir, "artifacts/brand-tokens.json"), "utf8"));
  assert.equal(tokens.palette.accent, "#5B2D8E");   // the deck's dominant saturated color
  assert.equal(tokens.palette.accent2, "#C15A27");  // next saturated color at a distinct hue
  assert.equal(tokens.type.display, "Cubano");
  assert.equal(tokens.type.body, "Proxima Nova");   // "Proxima Nova Th" is a weight, not a family
  assert.ok(tokens.evidence.color_counts["5B2D8E"] >= 30, "evidence counts travel with the choice");
});

/* ---------------- the call runner ---------------- */

test("npm strips quotes; a multi-word company survives anyway", () => {
  const dir = mkdtempSync(join(tmpdir(), "calls-"));
  run(resolve(scriptDir, "run_calls.mjs"),
    ["--domain", "acme.com", "--company", "Sun", "Cruiser", "--dry-run"], { cwd: dir });
  const summary = JSON.parse(readFileSync(join(dir, "artifacts/calls-summary.json"), "utf8"));
  assert.equal(summary.subject.company, "Sun Cruiser");
});

test("a missing key records blocked and exits 0, so the run continues", () => {
  const dir = mkdtempSync(join(tmpdir(), "calls-"));
  run(resolve(scriptDir, "run_calls.mjs"),
    ["--domain", "acme.com", "--company", "Acme"],
    { cwd: dir, env: { ...process.env, CONTEXT_DEV_API_KEY: "" } });
  const summary = JSON.parse(readFileSync(join(dir, "artifacts/calls-summary.json"), "utf8"));
  assert.equal(summary.status, "blocked_missing_credentials");
  assert.equal(summary.planned_credits, 90);
});

/* ---------------- the voice lint ---------------- */

function lintPitch(text, subject, preview) {
  const dir = mkdtempSync(join(tmpdir(), "pitch-"));
  writeFileSync(join(dir, "pitch.txt"), text);
  writeFileSync(join(dir, "pitch.props.json"),
    JSON.stringify({ subject, props: { previewText: preview } }));
  try {
    run(resolve(scriptDir, "lint_pitch.mjs"), [dir], { stdio: "pipe" });
    return { code: 0, out: "" };
  } catch (err) {
    return { code: err.status, out: String(err.stderr) };
  }
}

const CLEAN_PITCH = [
  "Alex,",
  "Liquid Death sampled at Electric Forest in June per the festival's sponsor page.",
  "Nocturnal Valley runs September 24 to 26 at Astral Valley Art Park near St. Louis.",
  "The Sampling Partner tier runs $10K-$25K and covers multi-day product sampling.",
  "Book fifteen minutes",
].join("\n");

test("a clean pitch in the sender's register lints clean", () => {
  const r = lintPitch(CLEAN_PITCH, "Sampling at Nocturnal Valley", "Three nights near St. Louis in September");
  assert.equal(r.code, 0);
});

test("deck register and disputed figures are caught by name", () => {
  const bad = "I hope this finds you well. An immersive festival with 20,000 attendees awaits.\nBook fifteen minutes";
  const r = lintPitch(bad, "s", "p");
  assert.equal(r.code, 1);
  assert.match(r.out, /banned-phrase/);
  assert.match(r.out, /immersive/);
  assert.match(r.out, /attendance/);
});

test("a dollar figure outside the rate card is caught", () => {
  const bad = CLEAN_PITCH.replace("$10K-$25K", "$12K-$30K");
  const r = lintPitch(bad, "s", "p");
  assert.equal(r.code, 1);
  assert.match(r.out, /tier-fidelity/);
});

test("sender authority permits validated outreach without review, and the sender is the agency's", () => {
  assert.equal(agencySender.authority_state, "authorized");
  assert.equal(agencySender.company, "Trifecta Marketing");
  assert.ok(!("sender" in festival), "the campaign packet carries the property, never the sender");
});

/* ---------------- the target loader ---------------- */

function cohortFrom(targetsCsv, exclusionsCsv, discoveredCsv = null) {
  // Isolated cwd: the loader auto-folds artifacts/discovered.csv from wherever it runs,
  // so these fixtures must own their working directory or the repo's real run artifacts
  // leak into the counts.
  const dir = mkdtempSync(join(tmpdir(), "sponsor-"));
  const t = join(dir, "t.csv");
  const x = join(dir, "x.csv");
  const out = join(dir, "cohort.json");
  writeFileSync(t, targetsCsv);
  writeFileSync(x, exclusionsCsv);
  if (discoveredCsv) {
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    writeFileSync(join(dir, "artifacts/discovered.csv"), discoveredCsv);
  }
  run(resolve(scriptDir, "load_targets.mjs"), [t, "--exclusions", x, "--out", out], { cwd: dir });
  return JSON.parse(readFileSync(out, "utf8"));
}

const EXCLUSIONS = [
  "pattern,scope,reason,supplied_by,dated",
  ',already_in_motion,"Names never supplied.",unsupplied,',
  'cannabis,compliance,"Age and compliance limits.",client_email,2026-08-11',
].join("\n");

test("a rule row beginning with an empty cell still parses", () => {
  // The regex parser this replaced returned five empty strings here, which silently
  // disabled every unsupplied rule. A gate that fails open is worse than no gate.
  const cohort = cohortFrom(
    "company,category,domain,region_fit,note\nAcme,beer,acme.com,midwest,\n",
    EXCLUSIONS,
  );
  assert.equal(cohort.unverified_against_rule, 1);
  assert.equal(cohort.targets[0].exclusion_check, "unverified_against_rule");
});

test("a row without a bare domain is rejected, never resolved", () => {
  const cohort = cohortFrom(
    "company,category,domain,region_fit,note\nAcme,beer,,midwest,\nBeta,beer,https://beta.com,midwest,\n",
    EXCLUSIONS,
  );
  assert.equal(cohort.accepted, 0);
  assert.equal(cohort.rejected, 2);
  assert.match(cohort.blocked[1].problems[0], /not bare/);
});

test("a banned category is admitted for research and blocked from drafting", () => {
  const cohort = cohortFrom(
    "company,category,domain,region_fit,note\nGreen,cannabis,,missouri,\n",
    EXCLUSIONS,
  );
  // Compliance settles the row without a domain, so it is not sent back for one.
  assert.equal(cohort.accepted, 1);
  assert.equal(cohort.blocked_compliance, 1);
  assert.equal(cohort.targets[0].draft_gate, "blocked_compliance");
});

test("a client_decision hold blocks drafting without rejecting the row", () => {
  const cohort = cohortFrom(
    "company,category,domain,region_fit,note\nNUTRL,vodka_rtd,nutrlusa.com,national,\n",
    EXCLUSIONS + '\nNUTRL,client_decision,"Client picks the entry point first.",meeting_context,2026-08-13',
  );
  assert.equal(cohort.accepted, 1);
  assert.equal(cohort.draftable, 0);
  assert.equal(cohort.targets[0].draft_gate, "blocked_client_decision");
});

test("an activation lead is carried as a lead, never as evidence", () => {
  const cohort = cohortFrom(
    "company,category,domain,region_fit,activation_lead,activation_lead_source,note\n" +
    'Acme,vodka,acme.com,national,"Listed sponsor, Some Fest 2026",https://example.com/sponsors,\n',
    EXCLUSIONS,
  );
  const t0 = cohort.targets[0];
  assert.equal(t0.activation_lead, "Listed sponsor, Some Fest 2026");
  assert.equal(t0.activation_lead_source, "https://example.com/sponsors");
  assert.equal(cohort.with_activation_lead, 1);
  // The lead says where to look. Only step 3 can say what was found, and the loader
  // has no field in which to assert that it did.
  assert.ok(!("activation_history" in t0));
});

/* ---------------- the call plan ---------------- */

test("the plan omits the decision-maker call when no profile URL is supplied", () => {
  // Run from a scratch cwd: the script writes its dry-run summary beside itself.
  const out = run(resolve(scriptDir, "run_calls.mjs"),
    ["--domain", "acme.com", "--company", "Acme", "--dry-run"],
    { cwd: mkdtempSync(join(tmpdir(), "calls-")) });
  assert.ok(!out.includes("/people/retrieve"));
  assert.match(out, /decision maker call omitted, not guessed/);
});

test("the plan includes the decision-maker call when one is supplied", () => {
  const out = run(resolve(scriptDir, "run_calls.mjs"),
    ["--domain", "acme.com", "--company", "Acme",
     "--linkedin-url", "https://www.linkedin.com/in/example-person", "--dry-run"],
    { cwd: mkdtempSync(join(tmpdir(), "calls-")) });
  assert.match(out, /\/people\/retrieve/);
});

test("country LinkedIn profile URLs are accepted and carried into the call summary", () => {
  const dir = mkdtempSync(join(tmpdir(), "calls-"));
  run(resolve(scriptDir, "run_calls.mjs"),
    ["--domain", "acme.com", "--company", "Acme",
     "--linkedin-url", "https://uk.linkedin.com/in/example-person", "--dry-run"],
    { cwd: dir });
  const summary = JSON.parse(readFileSync(join(dir, "artifacts/calls-summary.json"), "utf8"));
  assert.equal(summary.subject.linkedin_url, "https://uk.linkedin.com/in/example-person");
  assert.ok(summary.calls.some((call) => call.path === "/people/retrieve"));
});

test("naics and sic take input, while styleguide takes domain", async () => {
  const src = await readFile(resolve(scriptDir, "run_calls.mjs"), "utf8");
  assert.match(src, /path: "\/web\/naics",\s*\n\s*query: \{ input:/);
  assert.match(src, /path: "\/web\/sic",\s*\n\s*query: \{ input:/);
  assert.match(src, /path: "\/web\/styleguide",\s*\n\s*query: \{ domain \}/);
});

test("a non-bare domain is refused before any call is planned", () => {
  assert.throws(() => run(resolve(scriptDir, "run_calls.mjs"),
    ["--domain", "https://acme.com", "--company", "Acme", "--dry-run"],
    { cwd: mkdtempSync(join(tmpdir(), "calls-")), stdio: "pipe" }));
});

test("a decision-maker URL that is not an exact profile is refused", () => {
  assert.throws(() => run(resolve(scriptDir, "run_calls.mjs"),
    ["--domain", "acme.com", "--company", "Acme",
     "--linkedin-url", "https://linkedin.com/company/acme", "--dry-run"],
    { cwd: mkdtempSync(join(tmpdir(), "calls-")), stdio: "pipe" }));
});

/* ---------------- the full gather ---------------- */

function packetWith(mutate) {
  const dossier = JSON.parse(JSON.stringify(dossierTemplate));
  dossier.id = "acme"; dossier.company = "Acme"; dossier.domain = "acme.com";
  dossier.gates = { draft_gate: "open", exclusion_check: "unverified_against_rule" };
  dossier.conflict_check = { already_in_motion_state: "unverified_against_rule" };
  const packet = {
    schema_version: "1.0.0", source_mode: "dry_run", sponsors: [dossier],
    context_operations: [
      { capability: "x", endpoint: "https://api.context.dev/v1/brand/retrieve",
        write_policy: "artifact_only_no_send", status: "dry_run" },
      { capability: "monid gap-fill", endpoint: "monid:someprovider/some/endpoint",
        write_policy: "artifact_only_no_send", status: "blocked_endpoint_access" },
    ],
    open_gates: [], messages: [],
    festival: { event_name: "Fest", rate_card: [{ tier: "Sampling Partner", range: "$10K-$25K" }] },
  };
  mutate?.(packet, dossier);
  const dir = mkdtempSync(join(tmpdir(), "gather-"));
  writeFileSync(join(dir, "packet.json"), JSON.stringify(packet));
  return { dir, file: join(dir, "packet.json") };
}

function validateRun(file, dir, flags = []) {
  try {
    run(resolve(scriptDir, "validate_packet.mjs"), [file, ...flags], { cwd: dir, stdio: "pipe" });
    return { code: 0, out: "" };
  } catch (err) {
    return { code: err.status, out: String(err.stderr) };
  }
}

test("an open target without judgement or draft fails the full gather, and passes --partial", () => {
  const { dir, file } = packetWith();
  const full = validateRun(file, dir);
  assert.equal(full.code, 1);
  assert.match(full.out, /fit\.band is unwritten/);
  assert.match(full.out, /no rendered draft attached/);
  assert.equal(validateRun(file, dir, ["--partial"]).code, 0);
});

function sendReadyPacket(reviewState = "not_required") {
  const result = packetWith((packet, dossier) => {
    dossier.fit = { band: "category_only", rationale: "Client-selected category fit.", counter_evidence: null };
    dossier.outreach = {
      ...dossier.outreach,
      reason_to_engage: "Acme sponsored a comparable event in July 2026.",
      reason_source_url: "https://example.com/acme-activation",
      subject: "Nocturnal Valley sponsorship",
      preview_text: "A September festival partnership in the St. Louis market.",
      draft_html_path: "pitch.html",
      draft_text_path: "pitch.txt",
      review_state: reviewState,
      send_state: "ready_to_send",
      sender_authority: "authorized",
    };
    packet.messages = [{
      sponsor_id: dossier.id,
      subject: dossier.outreach.subject,
      draft_html_path: "pitch.html",
      draft_text_path: "pitch.txt",
      review_state: reviewState,
      send_state: "ready_to_send",
    }];
  });
  writeFileSync(join(result.dir, "pitch.html"), "<p>Send-ready sponsor pitch</p>");
  writeFileSync(join(result.dir, "pitch.txt"), "Send-ready sponsor pitch");
  return result;
}

test("a rendered message passes full validation as ready_to_send with no review", () => {
  const { dir, file } = sendReadyPacket();
  assert.equal(validateRun(file, dir).code, 0);
});

test("a rendered message cannot retain a review hold", () => {
  const { dir, file } = sendReadyPacket("hold");
  const result = validateRun(file, dir);
  assert.equal(result.code, 1);
  assert.match(result.out, /must not carry a review hold/);
});

test("a strong band without its evidence is refused by name", () => {
  const { dir, file } = packetWith((packet, dossier) => {
    dossier.fit = { band: "strong", rationale: "r", counter_evidence: "c" };
  });
  const r = validateRun(file, dir);
  assert.equal(r.code, 1);
  assert.match(r.out, /strong requires retrieved activation_history/);
});

/* ---------------- discovery ---------------- */

const DISCOVER = resolve(scriptDir, "discover_sponsors.mjs");

function harvest(dir, fill) {
  run(DISCOVER, ["--event", "evolution-stl"], { cwd: dir });
  const briefPath = join(dir, "artifacts/discovery/evolution-stl.json");
  const brief = JSON.parse(readFileSync(briefPath, "utf8"));
  fill(brief);
  writeFileSync(briefPath, JSON.stringify(brief));
  return briefPath;
}

const GOOD_SPONSOR = {
  company: "World Wide Technology", category_guess: "technology",
  sponsorship_title: "Official Technology Partner", sponsorship_date: "2025-09",
  evidence_quote: "fixture quote", evidence_date: "2025-09",
  source_url: "https://evolutionfestival.com",
  domain: "wwt.com", domain_confirmed: true, confirmation_url: "https://www.wwt.com",
  ambiguity_note: null, already_on_list: false,
};

test("an unquoted or unconfirmed harvest is refused by name", () => {
  const dir = mkdtempSync(join(tmpdir(), "disc-"));
  harvest(dir, (b) => {
    b.edition_confirmed = true; b.list_dated = "2025-09"; b.observed_at = "2026-08-13";
    b.sponsors_observed = [{ ...GOOD_SPONSOR, evidence_quote: null, domain_confirmed: false }];
  });
  try {
    run(DISCOVER, ["--check", "evolution-stl"], { cwd: dir, stdio: "pipe" });
    assert.fail("check should have exited 1");
  } catch (err) {
    assert.match(String(err.stderr), /no evidence_quote/);
    assert.match(String(err.stderr), /domain set but domain_confirmed is false/);
  }
});

test("a clean harvest emits rows the loader accepts, with origin and lead attached", () => {
  const dir = mkdtempSync(join(tmpdir(), "disc-"));
  harvest(dir, (b) => {
    b.edition_confirmed = true; b.list_dated = "2025-09"; b.observed_at = "2026-08-13";
    b.sponsors_observed = [GOOD_SPONSOR];
  });
  run(DISCOVER, ["--emit", "evolution-stl"], { cwd: dir });
  const discovered = readFileSync(join(dir, "artifacts/discovered.csv"), "utf8");
  assert.match(discovered, /World Wide Technology/);

  const cohort = cohortFrom(
    "company,category,domain,region_fit,note\nAcme,beer,acme.com,midwest,\n",
    EXCLUSIONS,
    discovered,
  );
  assert.equal(cohort.accepted, 2);
  assert.equal(cohort.discovered, 1);
  const wwt = cohort.targets.find((t) => t.id === "world-wide-technology");
  assert.equal(wwt.origin, "discovered");
  assert.match(wwt.activation_lead, /Evolution Festival, 2025-09/);
});

test("emit skips a company already on the client list", () => {
  const dir = mkdtempSync(join(tmpdir(), "disc-"));
  harvest(dir, (b) => {
    b.edition_confirmed = true; b.list_dated = "2025-09"; b.observed_at = "2026-08-13";
    b.sponsors_observed = [{ ...GOOD_SPONSOR, company: "Sun Cruiser", already_on_list: true }];
  });
  const out = run(DISCOVER, ["--emit", "evolution-stl"], { cwd: dir });
  assert.match(out, /\+0 row\(s\), 1 skipped/);
});

test("mass discovery selects every high-similarity event and leaves national comps opt-in", () => {
  const selected = selectComparableEvents(JSON.parse(readFileSync(
    resolve(SKILL_ROOT, "references/campaigns/nocturnal-valley/comparable-events.json"), "utf8")));
  assert.equal(selected.length, 7);
  assert.ok(selected.some((event) => event.tier === "4_same_venue"));
  assert.ok(selected.some((event) => event.tier === "1_same_format_and_region"));
  assert.ok(selected.some((event) => event.tier === "2_same_market"));
  assert.ok(!selected.some((event) => event.tier === "3_national_edm"));
});

test("the rolling year requires a month or date instead of accepting an ambiguous year", () => {
  assert.equal(sponsorshipRecency("2025-09", "2026-08-18").state, "within_past_year");
  assert.equal(sponsorshipRecency("2025", "2026-08-18").state, "ambiguous_year_only");
  assert.equal(sponsorshipRecency("2024-06", "2026-08-18").state, "outside_past_year");
});

test("title comparison prefers the same sponsorship function over seniority alone", () => {
  const ranked = rankPersonCandidates("SVP, Brand Partnerships", [
    { name: "A", title: "Chief Financial Officer", source_url: "https://example.com/a" },
    { name: "B", title: "Director, Brand Partnerships", linkedin_url: "https://www.linkedin.com/in/b-person", source_url: "https://www.linkedin.com/in/b-person" },
  ]);
  assert.equal(ranked[0].name, "B");
  assert.ok(ranked[0].title_match_score >= 0.5);
});

test("profile verification refuses a title match when the person has left the sponsor", () => {
  const checked = verifyResolvedProfile({
    institution_company: "Patrón Tequila",
    exemplar_title: "Vice President of USA, Patrón Tequila",
    full_name: "D-J Hageman",
    current_title: "Global VP Beauty",
    current_company: "SharkNinja",
    linkedin_url: "https://www.linkedin.com/in/d-j-hageman-11093824",
  });
  assert.equal(checked.company_match, false);
  assert.equal(checked.state, "retrieved_match_unconfirmed");
});

test("a departed sponsor person becomes a one-hop current-employer institution", () => {
  const profileCheck = verifyResolvedProfile({
    institution_company: "Patrón Tequila",
    exemplar_title: "Vice President of USA, Patrón Tequila",
    expected_name: "D-J Hageman",
    full_name: "D-J Hageman",
    current_title: "Global VP Beauty",
    current_company: "SharkNinja",
    linkedin_url: "https://www.linkedin.com/in/d-j-hageman-11093824",
  });
  const destination = destinationInstitutionFromProfile({
    source_institution: {
      company: "Patrón Tequila", domain: "patrontequila.com", category: "tequila",
      activations: [{
        sponsorship_title: "Official Tequila Partner",
        sponsorship_date: "2026-01-15",
        source_url: "https://example.com/patron-activation",
      }],
    },
    profile_check: profileCheck,
    resolved_brand: {
      title: "SharkNinja", domain: "sharkninja.com",
      industries: { eic: [{ industry: "Consumer Products", subindustry: "Home Appliances" }] },
    },
  });
  assert.equal(destination.company, "SharkNinja");
  assert.equal(destination.domain, "sharkninja.com");
  assert.equal(destination.origin, "person_destination");
  assert.equal(destination.hop_count, 1);
  assert.deepEqual(destination.activations, [], "the old sponsor activation must not become destination activation evidence");
  assert.equal(destination.source_sponsor.company, "Patrón Tequila");
  assert.equal(destination.source_activation.sponsorship_title, "Official Tequila Partner");
});

test("a departed person is not added without a confirmed current-employer domain", () => {
  const profileCheck = verifyResolvedProfile({
    institution_company: "Patrón Tequila",
    exemplar_title: "Vice President of USA, Patrón Tequila",
    full_name: "D-J Hageman",
    current_title: "Global VP Beauty",
    current_company: "SharkNinja",
    linkedin_url: "https://www.linkedin.com/in/d-j-hageman-11093824",
  });
  assert.equal(destinationInstitutionFromProfile({
    source_institution: { company: "Patrón Tequila", activations: [] },
    profile_check: profileCheck,
    resolved_brand: { title: "SharkNinja", domain: null },
  }), null);
});

test("profile verification accepts a cited parent company employer", () => {
  const checked = verifyResolvedProfile({
    institution_company: "C4 Energy",
    organization_aliases: ["Nutrabolt"],
    exemplar_title: "SVP of Marketing",
    full_name: "Example Person",
    current_title: "SVP of Marketing",
    current_company: "Nutrabolt",
    linkedin_url: "https://www.linkedin.com/in/example-person",
  });
  assert.equal(checked.company_match_basis, "current_employer");
  assert.equal(checked.state, "verified_match");
});

test("mass routing filters by the client profile and recency, then lands on the nearest exact profile", () => {
  const profile = JSON.parse(readFileSync(
    resolve(SKILL_ROOT, "references/campaigns/nocturnal-valley/sponsor-competitor-profile.json"), "utf8"));
  const routed = routeDiscovery([{
    event: { key: "real-comp", name: "Comparable Festival", tier: "1_same_format_and_region", edition: "2026", location: "Midwest" },
    sponsors: [
      {
        company: "Example Energy", category: "energy drink", domain: "example.com",
        sponsorship_title: "Official Energy Partner", sponsorship_date: "2026-06",
        spokesperson_name: "Owner Example", spokesperson_title: "SVP, Brand Partnerships",
        quote: "Example Energy is the official energy partner.", source_url: "https://example.com/activation",
        person_candidates: [
          { name: "Finance Person", title: "Chief Financial Officer", linkedin_url: "https://www.linkedin.com/in/finance-person", source_url: "https://www.linkedin.com/in/finance-person" },
          { name: "Partner Person", title: "VP, Brand Partnerships", linkedin_url: "https://www.linkedin.com/in/partner-person", source_url: "https://www.linkedin.com/in/partner-person" },
        ],
      },
      {
        company: "Old Water", category: "water", domain: "old.example",
        sponsorship_title: "Water Partner", sponsorship_date: "2024-06",
        quote: "Old Water sponsored the event.", source_url: "https://old.example/activation",
      },
    ],
  }], profile, { asOf: "2026-08-18" });
  assert.equal(routed.counts.qualifying_institutions, 1);
  assert.equal(routed.qualifying[0].company, "Example Energy");
  assert.equal(routed.qualifying[0].person_identification.state, "profile_url_ready");
  assert.equal(routed.qualifying[0].person_identification.nearest_title_comparator.name, "Partner Person");
  assert.equal(routed.review[0].reason, "outside_past_year");
});

test("replay routing replaces the stale sponsor row with the person's current employer", () => {
  const dir = mkdtempSync(join(tmpdir(), "destination-route-"));
  const rawPath = join(dir, "raw.json");
  const profileCheck = verifyResolvedProfile({
    institution_company: "Patrón Tequila",
    exemplar_title: "Vice President of USA, Patrón Tequila",
    expected_name: "D-J Hageman",
    full_name: "D-J Hageman",
    current_title: "Global VP Beauty",
    current_company: "SharkNinja",
    linkedin_url: "https://www.linkedin.com/in/d-j-hageman-11093824",
  });
  writeFileSync(rawPath, JSON.stringify({
    event_results: [{
      event: { key: "grammys", name: "Grammy Awards", tier: "3_national_edm", location: "Los Angeles, CA" },
      sponsors: [{
        company: "Patrón Tequila", category: "tequila", domain: "patrontequila.com",
        sponsorship_title: "Official Tequila Partner", sponsorship_date: "2026-01-15",
        spokesperson_name: "D-J Hageman", spokesperson_title: "Vice President of USA, Patrón Tequila",
        quote: "Official Tequila Partner", source_url: "https://example.com/patron-activation",
        person_candidates: [{
          name: "D-J Hageman", title: "Vice President of USA, Patrón Tequila",
          linkedin_url: "https://www.linkedin.com/in/d-j-hageman-11093824",
          source_url: "https://www.linkedin.com/in/d-j-hageman-11093824",
        }],
      }],
    }],
    profile_checks: [{ sponsor_key: "patrontequila.com", profile_check: profileCheck }],
    destination_brand_calls: [{
      sponsor_key: "patrontequila.com", status: "executed",
      response: { brand: {
        title: "SharkNinja", domain: "sharkninja.com",
        industries: { eic: [{ industry: "Consumer Products", subindustry: "Home Appliances" }] },
      } },
    }],
  }));

  run(DISCOVER, ["--route", rawPath, "--as-of", "2026-08-18", "--replace"], { cwd: dir });
  const routed = JSON.parse(readFileSync(join(dir, "artifacts/discovery/mass-results.json"), "utf8"));
  assert.equal(routed.qualifying[0].emission_state, "replaced_by_person_destination");
  assert.equal(routed.person_destinations[0].company, "SharkNinja");
  assert.equal(routed.person_destinations[0].activations.length, 0);

  const csvLines = readFileSync(join(dir, "artifacts/discovered.csv"), "utf8").trim().split(/\r?\n/);
  assert.equal(csvLines.length, 2);
  assert.match(csvLines[1], /^SharkNinja,/);
  assert.match(csvLines[1], /person_destination/);
  assert.doesNotMatch(csvLines[1], /^Patrón Tequila,/);
});

test("the mass dry run writes event extraction plus general-search and profile-routing stages", () => {
  const dir = mkdtempSync(join(tmpdir(), "mass-"));
  const out = run(DISCOVER, ["--mass", "--dry-run", "--as-of", "2026-08-18"], { cwd: dir });
  assert.match(out, /planned 7 high-similarity event extracts/);
  const plan = JSON.parse(readFileSync(join(dir, "artifacts/discovery/mass-plan.json"), "utf8"));
  assert.equal(plan.window_start, "2025-08-18");
  assert.equal(plan.event_operations.length, 7);
  assert.equal(plan.event_operations[0].path, "/web/extract");
  assert.equal(plan.event_operations[0].body.factCheck, true);
  assert.ok(plan.dynamic_route.some((step) => step.includes("general web search")));
  assert.ok(plan.dynamic_route.some((step) => step.includes("exact profile URL")));
  assert.ok(plan.dynamic_route.some((step) => step.includes("current employer")));
});

/* ---------------- consolidation and concurrency ---------------- */

test("the call plan runs concurrently, not one at a time", async () => {
  const src = await readFile(resolve(scriptDir, "run_calls.mjs"), "utf8");
  // A fixed worker pool, not a for-await over the plan: twelve cold round-trips in
  // series was the largest block of wall clock in the workflow.
  assert.match(src, /Promise\.all\(Array\.from\(\{ length: Math\.min\(CONCURRENCY/);
  assert.ok(!/for \(const c of calls\) \{\s*\n\s*const url/.test(src), "the sequential loop is gone");
  assert.match(src, /wall_ms/, "the summary records wall clock against serial");
});

test("the single target path remains two commands after mass discovery", async () => {
  const pkg = JSON.parse(await readFile(resolve("package.json"), "utf8"));
  assert.equal(pkg.scripts.research, "node scripts/research.mjs");
  assert.equal(pkg.scripts.deliver, "node scripts/deliver.mjs");
  assert.equal(pkg.scripts.brief, "node scripts/brief.mjs");
  assert.ok(Object.values(pkg.scripts).every((command) => !command.includes("skills/opulent-sponsor-context-showcase")));
  assert.ok(Object.values(pkg.scripts).filter((command) => /\bnode\b/.test(command)).every((command) => /node(?: --test)? scripts\//.test(command)));
  // The dashboard build stays off deliver's default path: it is an optional run summary,
  // and a Next build costs more wall clock than every other stage combined.
  assert.ok(!pkg.scripts.deliver.includes("dashboard"));
});

test("render_email does not re-assemble when an orchestrator is driving", async () => {
  const src = await readFile(resolve(scriptDir, "render_email.mjs"), "utf8");
  assert.match(src, /process\.env\.ORCHESTRATED === "1"/);
});

test("the render packages are runtime dependencies, not dev tooling", async () => {
  const pkg = JSON.parse(await readFile(resolve("package.json"), "utf8"));
  // In devDependencies these were absent on every fresh clone, render_email exited 3,
  // and the operator typed the email out by hand. The rendered template is the output.
  for (const dep of ["@react-email/render", "@react-email/components", "react", "react-dom"]) {
    assert.ok(pkg.dependencies?.[dep], `${dep} must be a runtime dependency`);
    assert.ok(!pkg.devDependencies?.[dep], `${dep} must not be dev-only`);
  }
});

test("research installs the render packages, and the draft step retries", async () => {
  const research = await readFile(resolve(scriptDir, "research.mjs"), "utf8");
  const email = await readFile(resolve(scriptDir, "render_email.mjs"), "utf8");
  assert.match(research, /node_modules\/@react-email\/render/);
  assert.match(research, /npm", \["install"/);
  assert.match(email, /render dependencies absent, installing once/);
  assert.match(email, /Do not hand-write the email/);
});
