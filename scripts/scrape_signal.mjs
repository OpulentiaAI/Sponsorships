#!/usr/bin/env node
/**
 * scrape_signal.mjs — open the activation brief for a URL, then validate what you filled in.
 *
 *   node scripts/scrape_signal.mjs --url <page-url>   # writes the skeleton
 *   node scripts/scrape_signal.mjs --check            # validates artifacts/signal.json
 *
 * This is the dated hook the pitch opens on: a page showing this company sponsoring,
 * activating at, or sampling into an event. A newsroom post, a festival's sponsor page,
 * a case study, a press release.
 *
 * The read itself is yours: these pages are often JavaScript-rendered, so a browser
 * session does the looking. This script fixes the shape so nothing has to be guessed,
 * and refuses a brief whose claim is not visible on the page it cites.
 *
 * Undated is not a signal. A sponsorship with no date attached cannot tell you whether
 * this company has a live experiential budget or had one in 2019, and that difference is
 * the entire reason to open on it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const OUT = resolve("artifacts/signal.json");

if (process.argv.includes("--check")) {
  if (!existsSync(OUT)) { console.error("artifacts/signal.json not found. Run with --url first."); process.exit(2); }
  const s = JSON.parse(await readFile(OUT, "utf8"));
  const problems = [];

  for (const k of ["signal_type", "summary", "source_url", "observed_at"]) {
    if (!s[k]) problems.push(`${k} is empty`);
  }
  if (s.read_only !== true) problems.push("read_only must stay true — the page is read, never interacted with");

  if (!s.signal_date) {
    problems.push("signal_date is empty — an undated activation cannot carry the pitch. Set found_dated:false and pick another page, or accept it as context and leave reason_eligible false");
  }
  if (s.signal_date && !/^\d{4}(-\d{2}){0,2}$/.test(s.signal_date)) {
    problems.push(`signal_date must be ISO — got ${s.signal_date}`);
  }
  if (s.reason_eligible === true && !s.quote) {
    problems.push("reason_eligible is true but there is no quote — the pitch opens on the page's own words, not a paraphrase of them");
  }
  if (s.reason_eligible === true && !s.signal_date) {
    problems.push("reason_eligible is true but the signal is undated");
  }
  if (Array.isArray(s.competitor_conflicts) && s.competitor_conflicts.length && s.conflict_checked !== true) {
    problems.push("competitor_conflicts listed but conflict_checked is false");
  }

  if (problems.length) { for (const p of problems) console.error(`  ${p}`); process.exit(1); }
  console.log(`signal brief OK · ${s.signal_type} · ${s.signal_date} · eligible: ${s.reason_eligible}`);
  process.exit(0);
}

const url = arg("url");
if (!url) { console.error("usage: node scripts/scrape_signal.mjs --url <page-url> | --check"); process.exit(2); }

await mkdir(resolve("artifacts"), { recursive: true });
await writeFile(OUT, JSON.stringify({
  signal_type: null,
  summary: null,
  quote: null,
  signal_date: null,
  event_named: null,
  scale_claim: null,
  activation_form: null,
  competitor_conflicts: [],
  conflict_checked: false,
  reason_eligible: false,
  reason_rank: null,
  source_url: url,
  observed_at: null,
  read_only: true,
}, null, 2) + "\n");

console.log(`artifacts/signal.json opened for ${url}`);
console.log("Read the page in a browser session, fill the fields, set observed_at, then: npm run signal -- --check");
console.log("\nsignal_type is one of: festival_sponsorship, event_activation, product_sampling,");
console.log("                       venue_partnership, regional_expansion, category_campaign");
