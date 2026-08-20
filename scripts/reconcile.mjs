#!/usr/bin/env node
/**
 * reconcile.mjs — prove a derived dataset came from the raw extraction it claims.
 *
 *   node scripts/reconcile.mjs [--raw artifacts/discovery/mass-raw.json]
 *                              [--results artifacts/discovery/mass-results.json]
 *                              [--csv artifacts/discovered.csv]
 *                              [--report <run-report.json>] [--report-md <run-report.md>]
 *                              [--rows <n>] [--as-of YYYY-MM-DD]
 *
 * The failure this exists for: a run that reports N verified rows, assembled by a script
 * that never opened the provider's raw output. The rows look complete, the report reads
 * clean, and nothing in it traces to a page anyone read. A second signature travels with
 * it — the Markdown says 19 and the JSON says 20, because two derivations of a dataset
 * that has no source cannot agree.
 *
 * Run this before reporting a discovery or verification pass as complete.
 *
 * Rules, each named in the output:
 *   raw-missing      no raw provider capture to reconcile against
 *   derived-stale    a derived artifact is older than the raw it claims to come from
 *   derived-drift    re-routing the raw does not reproduce the stored results
 *   row-untraced     an emitted row cites a URL that appears in no provider artifact
 *   claim-untraced   a report record claims verified with no traceable source
 *   count-conflict   two artifacts of the same run state different counts
 *   row-accounting   --rows N was given and the ledger does not account for N rows
 *
 * Exit 0 clean · 1 findings · 2 nothing to reconcile.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { routeDiscovery, slug } from "./discovery-routing.mjs";
import { campaignDir, parseCsv } from "./campaign.mjs";

const arg = (name, dflt = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : process.argv[i + 1];
};
const findings = [];
const fail = (rule, detail) => findings.push({ rule, detail });
const notes = [];

const rawPath = resolve(arg("raw", "artifacts/discovery/mass-raw.json"));
const resultsPath = resolve(arg("results", "artifacts/discovery/mass-results.json"));
const csvPath = resolve(arg("csv", "artifacts/discovered.csv"));
const reportPath = arg("report") ? resolve(arg("report")) : null;
const reportMdPath = arg("report-md") ? resolve(arg("report-md")) : null;
const expectedRows = arg("rows") ? Number(arg("rows")) : null;

if (!existsSync(rawPath)) {
  console.error(`reconcile: ${rawPath} not found.`);
  console.error("  There is nothing to reconcile against. A derived dataset with no raw provider");
  console.error("  capture is not evidence, however complete it looks. Run the extraction first,");
  console.error("  or point --raw at the capture this dataset was built from.");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(rawPath, "utf8"));
const eventResults = raw.event_results ?? raw;
if (!Array.isArray(eventResults) || eventResults.length === 0) {
  fail("raw-missing", `${rawPath} holds no event_results — nothing was extracted`);
}

/* ---- the evidence corpus: every URL any provider artifact actually carries ---- */
const urlPattern = /https?:\/\/[^\s"'<>)\\]+/g;
const corpus = new Set();
const corpusFiles = [];
const harvest = (file) => {
  try {
    for (const url of readFileSync(file, "utf8").match(urlPattern) ?? []) corpus.add(url.replace(/[.,;]+$/, ""));
    corpusFiles.push(file);
  } catch { /* unreadable files are not evidence */ }
};
harvest(rawPath);
for (const dir of ["artifacts/discovery", "artifacts/receipts"]) {
  const full = resolve(dir);
  if (!existsSync(full)) continue;
  for (const name of readdirSync(full)) {
    if (!name.endsWith(".json")) continue;
    const file = resolve(full, name);
    if (file === resultsPath) continue;      // derived output cannot vouch for itself
    harvest(file);
  }
}
const traced = (url) => {
  const clean = String(url ?? "").trim().replace(/[.,;]+$/, "");
  if (!clean.startsWith("http")) return false;
  if (corpus.has(clean)) return true;
  return [...corpus].some((known) => known.startsWith(clean) || clean.startsWith(known));
};
notes.push(`evidence corpus: ${corpus.size} URL(s) across ${corpusFiles.length} provider artifact(s)`);

/* ---- the derived results reproduce from the raw ---- */
let stored = null;
if (existsSync(resultsPath)) {
  stored = JSON.parse(readFileSync(resultsPath, "utf8"));
  if (statSync(resultsPath).mtimeMs < statSync(rawPath).mtimeMs) {
    fail("derived-stale", `${resultsPath} is older than ${rawPath}; it was not regenerated from this capture`);
  }
  const profilePath = resolve(campaignDir().dir, "sponsor-competitor-profile.json");
  if (existsSync(profilePath) && Array.isArray(eventResults)) {
    const asOf = arg("as-of", raw.as_of ?? stored.as_of ?? new Date().toISOString().slice(0, 10));
    const rederived = routeDiscovery(eventResults, JSON.parse(readFileSync(profilePath, "utf8")), { asOf });
    const key = (institution) => (institution.domain
      ? String(institution.domain).toLowerCase()
      : `name:${slug(institution.company)}`);
    const storedKeys = new Set((stored.qualifying ?? []).map(key));
    const freshKeys = new Set((rederived.qualifying ?? []).map(key));
    for (const k of freshKeys) if (!storedKeys.has(k)) fail("derived-drift", `${k} is in the raw capture and missing from the stored results`);
    for (const k of storedKeys) if (!freshKeys.has(k)) fail("derived-drift", `${k} is in the stored results and derives from nothing in the raw capture`);
    for (const [name, value] of Object.entries(rederived.counts ?? {})) {
      const was = stored.counts?.[name];
      if (was !== undefined && was !== value) fail("count-conflict", `counts.${name}: results say ${was}, the raw capture yields ${value}`);
    }
    notes.push(`re-derived from raw: ${rederived.counts?.qualifying_institutions ?? 0} qualifying institution(s)`);
  }
  const declared = stored.counts?.qualifying_institutions;
  if (declared !== undefined && declared !== (stored.qualifying ?? []).length) {
    fail("count-conflict", `${resultsPath}: counts say ${declared}, the qualifying array holds ${(stored.qualifying ?? []).length}`);
  }
}

/* ---- every emitted row cites something a provider returned ---- */
let csvRows = [];
if (existsSync(csvPath)) {
  csvRows = parseCsv(readFileSync(csvPath, "utf8"));
  for (const row of csvRows) {
    const cited = Object.entries(row)
      .filter(([name]) => /source|url/i.test(name))
      .flatMap(([, value]) => String(value ?? "").match(urlPattern) ?? []);
    const label = row.company || "(unnamed row)";
    if (!cited.length) { fail("row-untraced", `${label}: cites no source URL at all`); continue; }
    if (!cited.some(traced)) fail("row-untraced", `${label}: cites ${cited[0]}, which appears in no provider artifact`);
  }
  notes.push(`${csvPath}: ${csvRows.length} row(s)`);
}

/* ---- a report's claims trace, and its own counts agree ---- */
let reportRecords = null;
if (reportPath && existsSync(reportPath)) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const arrays = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      if (node.length && node.every((entry) => entry && typeof entry === "object")) arrays.push({ path, node });
      return;
    }
    if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(report, "");
  const biggest = arrays.sort((a, b) => b.node.length - a.node.length)[0];
  if (biggest) {
    reportRecords = biggest.node.length;
    notes.push(`${reportPath}: ${reportRecords} record(s) at ${biggest.path || "(root)"}`);
    for (const record of biggest.node) {
      const values = Object.entries(record);
      const claimsVerified = values.some(([k, v]) =>
        /state|status|verification|verified|confidence/i.test(k) && /verified|confirmed|valid/i.test(String(v)));
      const cited = values
        .filter(([k]) => /source|url|evidence|citation/i.test(k))
        .flatMap(([, v]) => String(v ?? "").match(urlPattern) ?? []);
      const label = record.company ?? record.name ?? record.id ?? record.email ?? JSON.stringify(record).slice(0, 40);
      if (claimsVerified && !cited.length) fail("claim-untraced", `${label}: claims verified and cites no source`);
      else if (claimsVerified && !cited.some(traced)) fail("claim-untraced", `${label}: claims verified, and ${cited[0]} appears in no provider artifact`);
    }
    for (const [k, v] of Object.entries(report)) {
      if (typeof v === "number" && /total|count|rows|records|verified/i.test(k) && v !== reportRecords) {
        fail("count-conflict", `${reportPath}: ${k} says ${v}, the record array holds ${reportRecords}`);
      }
    }
  }
}

if (reportMdPath && existsSync(reportMdPath) && reportRecords !== null) {
  const tables = readFileSync(reportMdPath, "utf8").split(/\n\s*\n/)
    .map((block) => block.split(/\r?\n/).filter((line) => line.trim().startsWith("|")))
    .filter((lines) => lines.length > 2)
    .map((lines) => lines.filter((line) => !/^\|[\s:|-]+\|$/.test(line.trim())).length - 1);
  const biggest = Math.max(0, ...tables);
  if (biggest && biggest !== reportRecords) {
    fail("count-conflict", `${reportMdPath} tabulates ${biggest} row(s); ${reportPath} holds ${reportRecords}. One of them was not regenerated`);
  }
}

/* ---- account for every row the run was given ---- */
if (expectedRows !== null && Number.isFinite(expectedRows)) {
  const accounted = reportRecords ?? csvRows.length;
  if (accounted !== expectedRows) {
    fail("row-accounting", `the run was given ${expectedRows} row(s) and accounts for ${accounted}. Name the missing rows and their state; silence is not a state`);
  }
}

for (const note of notes) console.log(`  ${note}`);
if (findings.length) {
  console.error(`\nreconcile: ${findings.length} finding(s)`);
  for (const f of findings) console.error(`  ${f.rule.padEnd(16)} ${f.detail}`);
  console.error("\nA finding is a claim to downgrade or a file to regenerate, never a line to edit out.");
  process.exit(1);
}
console.log("\nreconcile: clean — every claim traces to a provider artifact and the counts agree");
