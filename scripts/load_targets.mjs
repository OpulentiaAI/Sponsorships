#!/usr/bin/env node
/**
 * load_targets.mjs — turn a client target list into a validated sponsor cohort.
 *
 *   node scripts/load_targets.mjs targets/<file>.csv \
 *     [--exclusions targets/exclusions.csv] [--out artifacts/cohort.json]
 *
 * Accepts the column shape a client list actually arrives in:
 *   company, category, domain, region_fit, activation_lead, activation_lead_source,
 *   sponsorship_title, sponsorship_date, role_exemplar_name, role_exemplar_title,
 *   parent_company, person_candidate_name, person_candidate_title,
 *   person_candidate_linkedin_url, source_sponsor, source_sponsorship_title, note
 *
 * `activation_lead` is a research lead, not evidence. It records that someone saw this
 * company sponsoring a named event, so step 3 knows where to look. It never satisfies
 * `activation_history`, which requires a page read in this run, dated and quoted. A lead
 * that turns out to be stale, or to describe a parent company rather than the brand, is
 * exactly the thing step 3 exists to catch.
 *
 * Two gates, in this order.
 *
 * Compliance first. A banned category is settled without knowing which legal entity the
 * client meant, so those rows are admitted for research and marked undraftable rather
 * than sent back for a domain that would change nothing.
 *
 * Identity second. A row without an exact bare domain is REJECTED, never resolved by
 * search. "Anheuser-Busch or its St. Louis distributor" names two companies with two
 * sponsorship desks and two answers. Guessing which one costs a real pitch sent to the
 * wrong desk, and the client is the only party who knows which they meant.
 *
 * The exclusion file is a second gate and it fails loud. Where the client named a
 * rule but never supplied its contents — the sponsors already in motion, the category
 * conflicts — every target is marked `unverified_against_rule`. That is not a
 * technicality. Pitching a sponsor who is already mid-negotiation with the client is
 * the single most expensive mistake this workflow can make.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

import { campaignDir } from "./campaign.mjs";

const campaign = campaignDir();
const rest = process.argv.slice(2);
// The positional file is any token that is not a flag and not a flag's value.
const VALUED = new Set(["--exclusions", "--out", "--campaign"]);
const fileArg = rest.find((a, i, all) => !a.startsWith("--") && !VALUED.has(all[i - 1]));
const file = fileArg ?? `${campaign.dir}/targets.csv`;
const flag = (n, d) => { const i = rest.indexOf(`--${n}`); return i === -1 ? d : rest[i + 1]; };
const outPath = flag("out", null);
const exclPath = flag("exclusions", `${campaign.dir}/exclusions.csv`);


/** Bare domain: no scheme, no www, no path. One dot minimum. */
const BARE_DOMAIN = /^(?!www\.)(?!https?:)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const LINKEDIN_PROFILE = /^https:\/\/(?:(?:www|[a-z]{2,3})\.)?linkedin\.com\/in\/[a-z0-9_%.-]+\/?([?#].*)?$/i;

/**
 * A character scanner, not a regex.
 *
 * The regex this replaces dropped every field on any row beginning with an empty cell —
 * `,already_in_motion,"…"` parsed as five empty strings — which silently disabled the
 * exclusion rules it was reading. A gate that fails open is worse than no gate, and a
 * leading empty column is ordinary in a client's CSV.
 */
function splitRow(line) {
  const cells = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = splitRow(head).map((c) => c.trim().toLowerCase());
  return lines.filter(Boolean).map((line) => {
    const cells = splitRow(line);
    const row = {};
    cols.forEach((c, i) => { row[c] = (cells[i] ?? "").trim(); });
    return row;
  });
}

const slug = (s) => String(s || "").toLowerCase().normalize("NFKD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ---- exclusion rules -------------------------------------------------------
const rules = existsSync(exclPath) ? parseCsv(readFileSync(exclPath, "utf8")) : [];
const categoryBans = rules.filter((r) => r.scope === "compliance" && r.pattern);
// A client_decision hold blocks drafting for one company until the client resolves a
// question only they can answer — e.g. a subsidiary whose parent is also on the list.
const companyHolds = rules.filter((r) => r.scope === "client_decision" && r.pattern);
const unsuppliedRules = rules.filter((r) => !r.pattern && r.supplied_by === "unsupplied");

// ---- targets ---------------------------------------------------------------
// Discovered rows ride the same gates as the client's own list — no separate class of
// citizen. artifacts/discovered.csv is folded in automatically when it exists, each row
// tagged with its origin so the packet can say where a target came from.
const files = [[file, "client_list"]];
if (existsSync("artifacts/discovered.csv")) files.push(["artifacts/discovered.csv", "discovered"]);
const rows = files.flatMap(([f, origin]) =>
  parseCsv(readFileSync(f, "utf8")).map((r) => ({ ...r, origin: r.origin || origin })));
const accepted = [];
const rejected = [];

for (const [i, row] of rows.entries()) {
  const company = row.company || "";
  const domain = (row.domain || "").toLowerCase();

  // Compliance runs before identity. A banned category is settled without knowing which
  // legal entity the client meant, and reporting "no domain" on a row that could never be
  // drafted anyway sends someone to find a domain that changes nothing.
  const ban = categoryBans.find((r) => r.pattern === row.category);
  const hold = companyHolds.find((r) => slug(company) === slug(r.pattern));

  const problems = [];
  if (!company) problems.push("no company name");
  if (!ban) {
    if (!domain) problems.push("no domain — supply the exact bare domain of the entity you mean");
    else if (!BARE_DOMAIN.test(domain)) problems.push(`domain is not bare, e.g. example.com — got ${domain}`);
  }
  if (row.person_candidate_linkedin_url && !LINKEDIN_PROFILE.test(row.person_candidate_linkedin_url)) {
    problems.push(`person candidate is not an exact LinkedIn profile URL — got ${row.person_candidate_linkedin_url}`);
  }

  if (problems.length) {
    rejected.push({ row: i + 2, company: company || "(unnamed)", category: row.category || null, problems });
    continue;
  }

  accepted.push({
    id: slug(company),
    company,
    category: row.category || null,
    domain: domain || null,
    region_fit: row.region_fit || null,
    activation_lead: row.activation_lead || null,
    activation_lead_source: row.activation_lead_source || null,
    sponsorship_title: row.sponsorship_title || null,
    sponsorship_date: row.sponsorship_date || null,
    parent_company: row.parent_company || null,
    source_sponsor: row.source_sponsor || null,
    source_sponsor_domain: row.source_sponsor_domain || null,
    source_sponsorship_title: row.source_sponsorship_title || null,
    source_sponsorship_date: row.source_sponsorship_date || null,
    source_sponsorship_url: row.source_sponsorship_url || null,
    role_exemplar_name: row.role_exemplar_name || null,
    role_exemplar_title: row.role_exemplar_title || null,
    role_exemplar_source: row.role_exemplar_source || null,
    person_candidate_name: row.person_candidate_name || null,
    person_candidate_title: row.person_candidate_title || null,
    decision_maker_url: row.person_candidate_linkedin_url || null,
    person_candidate_source: row.person_candidate_source || null,
    person_match_score: row.person_match_score ? Number(row.person_match_score) : null,
    person_identification_state: row.person_identification_state || null,
    note: row.note || null,
    origin: row.origin || "client_list",
    draft_gate: ban ? "blocked_compliance" : hold ? "blocked_client_decision" : "open",
    draft_gate_reason: ban ? ban.reason : hold ? hold.reason : null,
    draft_gate_source: ban ? ban.supplied_by : hold ? hold.supplied_by : null,
    exclusion_check: unsuppliedRules.length ? "unverified_against_rule" : "clear",
    exclusion_check_reason: unsuppliedRules.map((r) => r.reason),
  });
}

const seen = new Set();
const deduped = accepted.filter((t) => {
  const key = t.domain ?? `name:${t.id}`;
  return !seen.has(key) && seen.add(key);
});

const summary = {
  file,
  exclusions_file: existsSync(exclPath) ? exclPath : null,
  rows: rows.length,
  accepted: deduped.length,
  duplicates: accepted.length - deduped.length,
  rejected: rejected.length,
  draftable: deduped.filter((t) => t.draft_gate === "open").length,
  with_activation_lead: deduped.filter((t) => t.activation_lead).length,
  discovered: deduped.filter((t) => t.origin !== "client_list").length,
  person_destinations: deduped.filter((t) => t.origin === "person_destination").length,
  blocked_compliance: deduped.filter((t) => t.draft_gate === "blocked_compliance").length,
  blocked_client_decision: deduped.filter((t) => t.draft_gate === "blocked_client_decision").length,
  unverified_against_rule: deduped.filter((t) => t.exclusion_check === "unverified_against_rule").length,
  open_rules: unsuppliedRules.map((r) => r.reason),
  targets: deduped,
  blocked: rejected,
};

if (outPath) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, JSON.stringify(summary, null, 2) + "\n"); }

if (files.length > 1) console.log(`sources:     ${files.map(([f]) => f).join(" + ")}`);
console.log(`rows:        ${rows.length}`);
console.log(`accepted:    ${deduped.length}`);
console.log(`duplicates:  ${accepted.length - deduped.length}`);
console.log(`rejected:    ${rejected.length}`);
console.log(`draftable:   ${summary.draftable}  (${summary.blocked_compliance} blocked on compliance)`);
console.log(`leads:       ${summary.with_activation_lead} carry a prior-activation lead to verify in step 3`);
for (const r of rejected) {
  console.log(`  row ${r.row}  ${r.company}${r.category ? ` (${r.category})` : ""} — ${r.problems.join("; ")}`);
}
const banned = deduped.filter((t) => t.draft_gate === "blocked_compliance");
if (banned.length) {
  console.log(`\nblocked on compliance, researchable but not draftable:`);
  for (const b of banned) console.log(`  ${b.company} (${b.category}) — ${b.draft_gate_source}`);
}
const held = deduped.filter((t) => t.draft_gate === "blocked_client_decision");
if (held.length) {
  console.log(`\nheld for a client decision, researchable but not draftable:`);
  for (const b of held) console.log(`  ${b.company} — ${b.draft_gate_reason}`);
}
if (unsuppliedRules.length) {
  console.log(`\n${deduped.length} target(s) marked unverified_against_rule:`);
  for (const r of unsuppliedRules) console.log(`  - ${r.reason}`);
}
if (rejected.length) {
  console.log(`\n${rejected.length} target(s) cannot enter the cohort without an exact bare domain.`);
}
process.exit(0);
