#!/usr/bin/env node
/**
 * run_calls.mjs — spend the provider budget on the fields the dossier is missing, and
 * nothing else.
 *
 *   node scripts/run_calls.mjs --domain <bare-domain> --company "<name>" \
 *     [--lead <activation-page-url>] [--category "<client list category>"] \
 *     [--have <field,field>] [--linkedin-url <url>] \
 *     [--include <id|keyword,...> --reason "<why>"] [--all --reason "<why>"] [--dry-run]
 *
 * The catalog below is the plan. Every method, path, and parameter name is fixed here so
 * no one has to derive them at run time — that derivation is where the 400s come from
 * (`/web/naics` takes `input`, not `domain`, while `/web/styleguide` takes `domain`).
 *
 * Every call also names the dossier field it fills and the condition that makes it worth
 * its credits. A call that fills no required field is opt-in and needs a stated reason.
 * The full catalog is 90 credits per target; a discovered row with a dated lead, a
 * category, and an address in its brand record needs 11 of them. The rest was buying
 * receipts nobody opened. `references/enrichment-contract.md` carries the reasoning.
 *
 * Two waves, because the second depends on the first: `/brand/retrieve` answers
 * category_fit and regional_presence for most targets, and the calls that would have
 * answered them again are skipped once it does.
 *
 * Writes one receipt per executed call to artifacts/receipts/, plus
 * artifacts/calls-summary.json — status, credits, receipt path, and every skip with its
 * reason. Read the summary, not the receipts.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
await import("./campaign.mjs"); // loads .env

const BASE = "https://api.context.dev/v1";
const OUT = "artifacts";

function args(argv) {
  // A flag's value runs until the next --flag. npm strips the quotes from
  // `npm run calls -- --company "Sun Cruiser"`, so the two tokens must rejoin here —
  // silently keeping only "Sun" was how a multi-word company lost its name.
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") { a.dryRun = true; continue; }
    if (argv[i] === "--all") { a.all = true; continue; }
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const parts = [];
    while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) parts.push(argv[++i]);
    a[key] = parts.join(" ");
  }
  return a;
}

/**
 * The catalog.
 *
 * `fills`  the dossier field this call answers, or null when it answers none.
 * `lane`   core     — the run has no dossier without it.
 *          need     — runs only while `fills` is unanswered.
 *          opt_in   — fills no required field. Off unless asked for, with a reason.
 * `when`   the condition, read against what is already known.
 *
 * Bare domain everywhere — no scheme, no www.
 */
function catalog({ domain, company, linkedinUrl }) {
  const calls = [
    // The discriminant is "by_domain", not "domain". A live 400 in August 2026 named the
    // whole union: by_domain | by_name | by_email | by_ticker | by_direct_url | by_transaction.
    { id: "01-brand", capability: "sponsor resolve", method: "POST", path: "/brand/retrieve",
      body: { type: "by_domain", domain }, credits: 10,
      lane: "core", fills: "identity", when: () => true,
      why: "Everything downstream keys off it: the company name, category_fit from industries.eic, and regional_presence from the address." },

    // input, NOT domain. This is the single most common 400 in this plan.
    { id: "02-naics", capability: "NAICS codes", method: "GET", path: "/web/naics",
      query: { input: domain, maxResults: 5 }, credits: 10,
      lane: "need", fills: "category_fit",
      when: (ctx) => !ctx.have.has("category_fit"),
      skipReason: () => "the client list or industries.eic already assigns a category, and category is the weakest fit input there is",
      why: "Only when neither the client list nor industries.eic assigns a category. Category is the weakest fit input; paying twice for it is worse." },

    { id: "06-markdown", capability: "page read", method: "GET", path: "/web/scrape/markdown",
      query: { url: `https://${domain}` }, credits: 1,
      lane: "need", fills: "audience_overlap",
      when: (ctx) => !ctx.have.has("audience_overlap"),
      skipReason: () => "a stated audience is already on file for this target",
      why: "One credit for the page that states what they sell and to whom, which is where a stated audience comes from. Cached is correct: freshness does not change who they sell to." },

    // freshness is an enum — last_24_hours | last_week | last_month | last_year — and a
    // bare "year" returns 400. A sponsorship two years stale is not evidence of a budget now.
    { id: "10-activation", capability: "activation history", method: "POST", path: "/web/search",
      body: { query: `"${company}" sponsor OR sponsorship music festival 2026`, freshness: "last_year" }, credits: 10,
      lane: "need", fills: "activation_history",
      when: (ctx) => !ctx.lead && !ctx.have.has("activation_history"),
      skipReason: (ctx) => (ctx.lead ? `discovery already handed this row a dated page: ${ctx.lead}` : "the activation is already retrieved"),
      why: "Finds the dated page the pitch opens on. Skipped when discovery already handed the row a lead: search cannot improve on a page we already have." },

    { id: "11-experiential", capability: "experiential spend", method: "POST", path: "/web/search",
      body: { query: `"${company}" brand activation experiential marketing event`, freshness: "last_year" }, credits: 10,
      lane: "need", fills: "budget_signal",
      when: (ctx) => !ctx.lead && !ctx.have.has("budget_signal"),
      skipReason: (ctx) => (ctx.lead ? "the scale claim comes from reading the row's lead, not from a second search" : "a scale band is already on file"),
      why: "A second angle on scale when the row is blind. With a lead in hand the scale claim comes from reading that page." },

    { id: "12-market", capability: "regional presence", method: "POST", path: "/web/search",
      body: { query: `"${company}" St. Louis OR Missouri OR Midwest 2026`, freshness: "last_year" }, credits: 10,
      lane: "need", fills: "regional_presence",
      when: (ctx) => !ctx.have.has("regional_presence"),
      skipReason: () => "/brand/retrieve returned an address, which already places them",
      why: "Only when /brand/retrieve returned no address. An address already places them; a search that re-finds it buys nothing." },

    { id: "03-sic", capability: "SIC codes", method: "GET", path: "/web/sic",
      query: { input: domain, type: "latest_sec", maxResults: 5 }, credits: 10,
      lane: "opt_in", fills: null,
      why: "SEC-linked codes. Nothing in the dossier contract reads them; ask for it when a filing-level identity is the actual question." },

    { id: "04-sitemap", capability: "sitemap", method: "GET", path: "/web/scrape/sitemap",
      query: { domain, maxLinks: 200 }, credits: 1,
      lane: "opt_in", fills: null,
      why: "Path discovery before a crawl. Worth one credit only when the crawl is happening." },

    { id: "05-crawl", capability: "bounded crawl", method: "POST", path: "/web/crawl",
      body: { url: `https://${domain}`, maxPages: 8, maxDepth: 2, followSubdomains: false }, credits: 8,
      lane: "opt_in", fills: null,
      why: "Eight pages of their own site. Reach for it only when the front page did not state an audience and the statement plausibly lives deeper." },

    // domain XOR directUrl on these three. viewport is an object, not a string.
    { id: "07-screenshot", capability: "screenshot", method: "GET", path: "/web/screenshot",
      query: { domain, fullScreenshot: true, handleCookiePopup: true }, credits: 5,
      lane: "opt_in", fills: null,
      why: "Dossier decoration. No gate, no band, and no sentence of the pitch turns on it." },

    { id: "08-styleguide", capability: "styleguide", method: "GET", path: "/web/styleguide",
      query: { domain }, credits: 10,
      lane: "opt_in", fills: null,
      why: "The sponsor's palette and type. Decoration here; the campaign's own tokens come from the deck in extract_brand.mjs." },

    { id: "09-fonts", capability: "fonts", method: "GET", path: "/web/fonts",
      query: { domain }, credits: 5,
      lane: "opt_in", fills: null,
      why: "A subset of the styleguide. If the styleguide already ran, this is the same answer bought twice." },
  ];

  // Only with an exact profile URL. General search can discover the candidate URL,
  // but this call is the step that resolves the person.
  if (linkedinUrl) {
    calls.push({ id: "13-decision-maker", capability: "decision maker profile", method: "POST",
      path: "/people/retrieve", body: { identifiers: { linkedinUrl } }, credits: null,
      lane: "need", fills: "decision_maker",
      when: (ctx) => !ctx.have.has("decision_maker"),
      skipReason: () => "the person is already resolved",
      why: "The one call that resolves a person, and only from an exact profile URL." });
  }
  return calls;
}

const a = args(process.argv.slice(2));
if (!a.domain || !a.company) {
  console.error('usage: node scripts/run_calls.mjs --domain <bare-domain> --company "<name>" [--lead <url>] [--category "<name>"] [--have <fields>] [--linkedin-url <url>] [--include <ids> --reason "<why>"] [--dry-run]');
  process.exit(2);
}
if (/^https?:|^www\./.test(a.domain)) {
  console.error(`--domain must be bare, e.g. example.com — got ${a.domain}`);
  process.exit(2);
}
if (a.linkedinUrl && !/^https:\/\/(?:(?:www|[a-z]{2,3})\.)?linkedin\.com\/in\//i.test(a.linkedinUrl)) {
  console.error(`--linkedin-url must be an exact profile URL — got ${a.linkedinUrl}`);
  process.exit(2);
}

const asked = String(a.include ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
if ((asked.length || a.all) && !a.reason) {
  console.error("--include and --all fill no required field, so they need --reason \"<why this target needs it>\".");
  console.error("  The reason is recorded in the summary. \"completeness\" is not one.");
  process.exit(2);
}

const all = catalog(a);
const catalogCredits = all.reduce((n, c) => n + (Number(c.credits) || 0), 0);
const optedIn = (call) => a.all || asked.includes(call.id) || asked.includes(call.capability.toLowerCase())
  || asked.some((name) => call.id.endsWith(name));

// What is already answered before a single call goes out. The client list's category and
// a lead from discovery are answers; they were paid for once already.
const have = new Set(String(a.have ?? "").split(",").map((s) => s.trim()).filter(Boolean));
if (a.category) have.add("category_fit");
if (a.lead) have.add("activation_history");
const ctx = { have, lead: a.lead ?? null, category: a.category ?? null, linkedinUrl: a.linkedinUrl ?? null };

const skips = [];
const skip = (call, reason) => skips.push({
  id: call.id, capability: call.capability, method: call.method, endpoint: call.path,
  fills: call.fills, lane: call.lane, credits: call.credits,
  status: "skipped_not_needed", skip_reason: reason, http_status: null, receipt: null,
});

function select(pool, context) {
  const chosen = [];
  for (const call of pool) {
    if (call.lane === "core") { chosen.push(call); continue; }
    if (call.lane === "opt_in") {
      if (optedIn(call)) chosen.push({ ...call, opt_in_reason: a.reason });
      else skip(call, `fills no required field; not requested. ${call.why}`);
      continue;
    }
    if (call.when(context)) chosen.push(call);
    else skip(call, `${call.fills} needs no call here: ${call.skipReason(context)}`);
  }
  return chosen;
}

const key = process.env.CONTEXT_DEV_API_KEY;
await mkdir(resolve(OUT, "receipts"), { recursive: true });

const line = (c, note = "") => `  ${c.id.padEnd(20)} ${String(c.method).padEnd(5)} ${String(c.path ?? c.endpoint).padEnd(26)} ${note}`;

if (a.dryRun || !key) {
  // Nothing has run, so regional_presence and any wave-2 answer are still unknown. The
  // plan shown is the ceiling; wave 2 shrinks it once /brand/retrieve returns.
  const planned = select(all, ctx);
  const plannedCredits = planned.reduce((n, c) => n + (Number(c.credits) || 0), 0);
  const reason = a.dryRun ? "dry_run" : "blocked_missing_credentials";
  const summary = [
    ...planned.map((c) => ({
      id: c.id, capability: c.capability, method: c.method, endpoint: c.path, fills: c.fills ?? null,
      lane: c.lane, credits: c.credits, status: reason, http_status: null, receipt: null,
      ...(c.opt_in_reason ? { opt_in_reason: c.opt_in_reason } : {}),
    })),
    ...skips,
  ];
  await writeFile(resolve(OUT, "calls-summary.json"), JSON.stringify({
    status: reason,
    subject: { domain: a.domain, company: a.company, linkedin_url: a.linkedinUrl ?? null,
               lead: ctx.lead, category: ctx.category, have: [...have] },
    catalog_credits: catalogCredits, planned_credits: plannedCredits,
    credits_saved: catalogCredits - plannedCredits,
    skipped: skips.length, calls: summary,
  }, null, 2) + "\n");
  console.log(`${reason}: ${planned.length} of ${all.length} calls planned, ${plannedCredits} of ${catalogCredits} credits, none executed`);
  for (const c of planned) console.log(line(c, c.fills ? `fills ${c.fills}` : "opt-in"));
  for (const s of skips) console.log(`  ${s.id.padEnd(20)} skipped — ${s.skip_reason}`);
  if (!a.linkedinUrl) console.log("\nno --linkedin-url: decision maker call omitted, not guessed");
  // A missing key is a recorded outcome, not a failure: every planned call is written to
  // the summary as blocked, which is exactly the report SKILL step 2 asks for. Exit 0 so
  // the pipeline continues to the signal step the way the docs say it does.
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// One retry on 408/429/5xx, honouring Retry-After, capped at 30s. Everything else is
// terminal on first sight: a 4xx is a fact about the request, and the plan records it.
const RETRYABLE = (s) => s === 408 || s === 429 || s >= 500;
const CONCURRENCY = Number(process.env.CALL_CONCURRENCY ?? 6);

async function runCall(c) {
  const url = new URL(BASE + c.path);
  for (const [k, v] of Object.entries(c.query ?? {})) url.searchParams.set(k, String(v));
  const started = Date.now();
  let res, bodyText, retried = false;
  try {
    for (;;) {
      res = await fetch(url, {
        method: c.method,
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        ...(c.body ? { body: JSON.stringify(c.body) } : {}),
      });
      if (!res.ok && RETRYABLE(res.status) && !retried) {
        retried = true;
        const after = Math.min(Number(res.headers.get("retry-after")) * 1000 || 2000, 30_000);
        console.log(`  ${c.id.padEnd(20)} ${res.status}, retrying once in ${after}ms`);
        await sleep(after);
        continue;
      }
      bodyText = await res.text();
      break;
    }
  } catch (err) {
    console.log(`  ${c.id.padEnd(20)} FAILED  ${err.message}`);
    return { id: c.id, capability: c.capability, method: c.method, endpoint: c.path, fills: c.fills ?? null,
             lane: c.lane, status: "failed", http_status: null, error: err.message, receipt: null };
  }
  let parsed = null;
  try { parsed = JSON.parse(bodyText); } catch { /* keep the text */ }
  const receipt = `${OUT}/receipts/${c.id}.json`;
  await writeFile(resolve(receipt), JSON.stringify({
    id: c.id, capability: c.capability, method: c.method, endpoint: BASE + c.path,
    fills: c.fills ?? null, lane: c.lane,
    request: { query: c.query ?? null, body: c.body ?? null },
    http_status: res.status,
    safe_headers: {
      "x-ratelimit-remaining": res.headers.get("x-ratelimit-remaining"),
      "x-ratelimit-reset": res.headers.get("x-ratelimit-reset"),
    },
    latency_ms: Date.now() - started,
    response: parsed ?? bodyText.slice(0, 20_000),
    completed_at: new Date().toISOString(),
  }, null, 2) + "\n");

  const credits = parsed?.key_metadata?.credits_consumed ?? null;
  console.log(`  ${c.id.padEnd(20)} ${String(res.status).padEnd(4)} ${credits ?? "-"} cr  ${Date.now() - started}ms`);
  return {
    id: c.id, capability: c.capability, method: c.method, endpoint: c.path, fills: c.fills ?? null,
    lane: c.lane, status: res.ok ? "executed" : "failed",
    http_status: res.status, credits, latency_ms: Date.now() - started, receipt,
    response: parsed, ...(c.opt_in_reason ? { opt_in_reason: c.opt_in_reason } : {}),
  };
}

// A fixed pool: each worker pulls the next index, so a slow call never blocks a free slot.
async function pool(calls) {
  const out = new Array(calls.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, calls.length) || 1 }, async () => {
    for (;;) {
      const i = next++;
      if (i >= calls.length) return;
      out[i] = await runCall(calls[i]);
    }
  }));
  return out;
}

const wallStart = Date.now();

// ---- wave 1: the call the rest of the plan is decided by ---------------------
const wave1 = all.filter((c) => c.lane === "core");
console.log(`wave 1 · ${wave1.length} call(s)`);
const results1 = await pool(wave1);

const brand = results1.find((r) => r.id === "01-brand" && r.status === "executed")?.response?.brand ?? null;
if (brand?.address) have.add("regional_presence");
if ((brand?.industries?.eic ?? []).length) have.add("category_fit");
if (brand?.address || (brand?.industries?.eic ?? []).length) {
  console.log(`  /brand/retrieve answered: ${[...have].join(", ")}`);
}

// ---- wave 2: only what is still unanswered -----------------------------------
const wave2 = select(all.filter((c) => c.lane !== "core"), ctx);
const plannedCredits = [...wave1, ...wave2].reduce((n, c) => n + (Number(c.credits) || 0), 0);
console.log(`\nwave 2 · ${wave2.length} call(s), ${skips.length} skipped`);
for (const s of skips) console.log(`  ${s.id.padEnd(20)} skipped — ${s.skip_reason}`);
const results2 = wave2.length ? await pool(wave2) : [];

const summary = [...results1, ...results2].map(({ response, ...rest }) => rest);
const spent = summary.reduce((n, s) => n + (Number(s.credits) || 0), 0);
const wallMs = Date.now() - wallStart;
const serialMs = summary.reduce((n, s) => n + (s.latency_ms || 0), 0);
await writeFile(resolve(OUT, "calls-summary.json"), JSON.stringify({
  status: "complete",
  subject: { domain: a.domain, company: a.company, linkedin_url: a.linkedinUrl ?? null,
             lead: ctx.lead, category: ctx.category, have: [...have] },
  executed: summary.filter((s) => s.status === "executed").length,
  failed: summary.filter((s) => s.status === "failed").length,
  skipped: skips.length,
  catalog_credits: catalogCredits, planned_credits: plannedCredits,
  credits_spent: spent, credits_saved: catalogCredits - plannedCredits,
  wall_ms: wallMs, serial_ms: serialMs, concurrency: CONCURRENCY,
  calls: [...summary, ...skips],
}, null, 2) + "\n");
console.log(`\n${(wallMs / 1000).toFixed(1)}s wall · ${(serialMs / 1000).toFixed(1)}s if run one at a time`);
console.log(`${spent} credit(s) spent · ${catalogCredits - plannedCredits} left unspent by not asking for what the dossier already has`);
