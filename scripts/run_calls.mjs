#!/usr/bin/env node
/**
 * run_calls.mjs — execute the whole provider plan for one sponsor target in one command.
 *
 *   node scripts/run_calls.mjs --domain <bare-domain> --company "<name>" \
 *     [--linkedin-url <decision-maker-url>] [--dry-run]
 *
 * The call list below is the plan. Every method, path, and parameter name is fixed here
 * so no one has to derive them at run time — that derivation is where the 400s come from
 * (`/web/naics` takes `input`, not `domain`, while `/web/styleguide` takes `domain`).
 *
 * The order is deliberate. A sponsor target is a company first: the brand resolves, the
 * industry codes place it, the site says what it sells and to whom. The decision maker is
 * a later and narrower question. It only runs with an exact profile URL supplied by
 * the client or by the cited title-search route.
 *
 * Writes one receipt per call to artifacts/receipts/, plus artifacts/calls-summary.json —
 * a compact index of status, credits, and receipt path. Read the summary, not the receipts.
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
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const parts = [];
    while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) parts.push(argv[++i]);
    a[key] = parts.join(" ");
  }
  return a;
}

/** The plan. Bare domain everywhere — no scheme, no www. */
function plan({ domain, company, linkedinUrl }) {
  const calls = [
    // The discriminant is "by_domain", not "domain". A live 400 in August 2026 named the
    // whole union: by_domain | by_name | by_email | by_ticker | by_direct_url | by_transaction.
    { id: "01-brand", capability: "sponsor resolve", method: "POST", path: "/brand/retrieve",
      body: { type: "by_domain", domain }, credits: 10 },

    // input, NOT domain. This is the single most common 400 in this plan.
    { id: "02-naics", capability: "NAICS codes", method: "GET", path: "/web/naics",
      query: { input: domain, maxResults: 5 }, credits: 10 },
    { id: "03-sic", capability: "SIC codes", method: "GET", path: "/web/sic",
      query: { input: domain, type: "latest_sec", maxResults: 5 }, credits: 10 },

    { id: "04-sitemap", capability: "sitemap", method: "GET", path: "/web/scrape/sitemap",
      query: { domain, maxLinks: 200 }, credits: 1 },
    { id: "05-crawl", capability: "bounded crawl", method: "POST", path: "/web/crawl",
      body: { url: `https://${domain}`, maxPages: 8, maxDepth: 2, followSubdomains: false }, credits: 8 },
    // Cached is correct here: brand pages sit in the provider cache ~90 days, a cached
    // hit returns in under a second, and a forced-fresh read pays ~7s cold latency to
    // answer a question freshness does not change.
    { id: "06-markdown", capability: "page read", method: "GET", path: "/web/scrape/markdown",
      query: { url: `https://${domain}` }, credits: 1 },

    // domain XOR directUrl on these three. viewport is an object, not a string.
    { id: "07-screenshot", capability: "screenshot", method: "GET", path: "/web/screenshot",
      query: { domain, fullScreenshot: true, handleCookiePopup: true }, credits: 5 },
    { id: "08-styleguide", capability: "styleguide", method: "GET", path: "/web/styleguide",
      query: { domain }, credits: 10 },
    { id: "09-fonts", capability: "fonts", method: "GET", path: "/web/fonts",
      query: { domain }, credits: 5 },

    // The three signals sponsor fit actually turns on. Each is dated by `freshness`, which
    // is an enum — last_24_hours | last_week | last_month | last_year — and rejects a bare
    // "year" with a 400. A sponsorship two years stale is not evidence of a budget now.
    { id: "10-activation", capability: "activation history", method: "POST", path: "/web/search",
      body: { query: `"${company}" sponsor OR sponsorship music festival 2026`, freshness: "last_year" }, credits: 10 },
    { id: "11-experiential", capability: "experiential spend", method: "POST", path: "/web/search",
      body: { query: `"${company}" brand activation experiential marketing event`, freshness: "last_year" }, credits: 10 },
    { id: "12-market", capability: "regional presence", method: "POST", path: "/web/search",
      body: { query: `"${company}" St. Louis OR Missouri OR Midwest 2026`, freshness: "last_year" }, credits: 10 },
  ];

  // Only with an exact profile URL. General search can discover the candidate URL,
  // but this call is the step that resolves the person.
  if (linkedinUrl) {
    calls.push({ id: "13-decision-maker", capability: "decision maker profile", method: "POST",
      path: "/people/retrieve", body: { identifiers: { linkedinUrl } }, credits: null });
  }
  return calls;
}

const a = args(process.argv.slice(2));
if (!a.domain || !a.company) {
  console.error('usage: node scripts/run_calls.mjs --domain <bare-domain> --company "<name>" [--linkedin-url <url>] [--dry-run]');
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

const calls = plan(a);
const plannedCredits = calls.reduce((n, c) => n + (Number(c.credits) || 0), 0);
const key = process.env.CONTEXT_DEV_API_KEY;
await mkdir(resolve(OUT, "receipts"), { recursive: true });

if (a.dryRun || !key) {
  const reason = a.dryRun ? "dry_run" : "blocked_missing_credentials";
  const summary = calls.map((c) => ({ ...c, status: reason, http_status: null, receipt: null }));
  await writeFile(resolve(OUT, "calls-summary.json"),
    JSON.stringify({ status: reason, subject: { domain: a.domain, company: a.company, linkedin_url: a.linkedinUrl ?? null }, planned_credits: plannedCredits, calls: summary }, null, 2) + "\n");
  console.log(`${reason}: ${calls.length} calls planned, ${plannedCredits} credits budgeted, none executed`);
  for (const c of calls) console.log(`  ${c.id.padEnd(20)} ${c.method.padEnd(5)} ${c.path}`);
  if (!a.linkedinUrl) console.log("\nno --linkedin-url: decision maker call omitted, not guessed");
  // A missing key is a recorded outcome, not a failure: every call is written to the
  // summary as blocked, which is exactly the report SKILL step 2 asks for. Exit 0 so
  // the pipeline continues to the signal step the way the docs say it does.
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// One retry on 408/429/5xx, honouring Retry-After, capped at 30s. Everything else is
// terminal on first sight: a 4xx is a fact about the request, and the plan records it.
const RETRYABLE = (s) => s === 408 || s === 429 || s >= 500;

/**
 * The twelve calls are independent of one another, so they run concurrently.
 * Sequential, this stage was twelve cold round-trips end to end — the single largest
 * block of wall clock in the whole workflow, and none of it was work. Concurrency is
 * capped so a burst does not manufacture the 429s the retry path then has to absorb.
 */
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
    return { ...c, status: "failed", http_status: null, error: err.message, receipt: null };
  }
  let parsed = null;
  try { parsed = JSON.parse(bodyText); } catch { /* keep the text */ }
  const receipt = `${OUT}/receipts/${c.id}.json`;
  await writeFile(resolve(receipt), JSON.stringify({
    id: c.id, capability: c.capability, method: c.method, endpoint: BASE + c.path,
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
    id: c.id, capability: c.capability, method: c.method, endpoint: c.path,
    status: res.ok ? "executed" : "failed",
    http_status: res.status, credits, latency_ms: Date.now() - started, receipt,
  };
}

// A fixed pool: each worker pulls the next index, so a slow call never blocks a free slot.
const wallStart = Date.now();
const summary = new Array(calls.length);
let next = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, calls.length) }, async () => {
  for (;;) {
    const i = next++;
    if (i >= calls.length) return;
    summary[i] = await runCall(calls[i]);
  }
}));

const spent = summary.reduce((n, s) => n + (Number(s.credits) || 0), 0);
const wallMs = Date.now() - wallStart;
const serialMs = summary.reduce((n, s) => n + (s.latency_ms || 0), 0);
await writeFile(resolve(OUT, "calls-summary.json"),
  JSON.stringify({ status: "complete", subject: { domain: a.domain, company: a.company, linkedin_url: a.linkedinUrl ?? null },
                   executed: summary.filter((s) => s.status === "executed").length,
                   failed: summary.filter((s) => s.status !== "executed").length,
                   planned_credits: plannedCredits, credits_spent: spent,
                   wall_ms: wallMs, serial_ms: serialMs, concurrency: CONCURRENCY,
                   calls: summary }, null, 2) + "\n");
console.log(`\n${(wallMs / 1000).toFixed(1)}s wall · ${(serialMs / 1000).toFixed(1)}s if run one at a time`);
console.log(`\nexecuted ${summary.filter((s) => s.status === "executed").length}/${calls.length} · ${spent} credits · ${OUT}/calls-summary.json`);
