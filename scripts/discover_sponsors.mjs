#!/usr/bin/env node
/**
 * Discovery has two routes.
 *
 * Manual evidence capture (kept for a single difficult page):
 *   --list | --event <key> | --check <key> | --emit <key>
 *
 * Mass routing (the default discovery workflow):
 *   --mass [--similarity high|exact] [--include-national] [--as-of YYYY-MM-DD] [--dry-run]
 *   --route <raw-event-results.json> [--as-of YYYY-MM-DD]
 *
 * Mass routing fans out over every high-similarity event, extracts dated sponsor
 * activations, keeps only categories represented in the client competitor profile,
 * searches the open web for same-company LinkedIn profiles using the activation
 * spokesperson's title, ranks those result titles, and calls /people/retrieve only on
 * the nearest exact profile URL. Web search discovers candidates; people/retrieve
 * resolves one. The two claims never collapse into one another.
 */
import {
  appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import { campaignDir } from "./campaign.mjs";
import {
  destinationInstitutionFromProfile, exactLinkedinProfile, routeDiscovery,
  selectComparableEvents, slug, titleSimilarity, verifyResolvedProfile,
} from "./discovery-routing.mjs";

const campaign = campaignDir();
const universe = JSON.parse(readFileSync(resolve(campaign.dir, "comparable-events.json"), "utf8"));
const profilePath = resolve(campaign.dir, "sponsor-competitor-profile.json");
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(`--${flag}`);
const val = (flag, fallback = null) => {
  const i = argv.indexOf(`--${flag}`);
  return i === -1 ? fallback : argv[i + 1];
};

const BASE = "https://api.context.dev/v1";
const DIR = resolve("artifacts/discovery");
const OUT = resolve("artifacts/discovered.csv");
const MASS_PLAN = resolve(DIR, "mass-plan.json");
const MASS_RESULTS = resolve(DIR, "mass-results.json");
const MASS_RAW = resolve(DIR, "mass-raw.json");
const MASS_SUMMARY = resolve(DIR, "mass-summary.json");
const HEADER = [
  "company", "category", "domain", "region_fit", "activation_lead", "activation_lead_source",
  "origin", "parent_company", "source_sponsor", "source_sponsor_domain",
  "source_sponsorship_title", "source_sponsorship_date", "source_sponsorship_url",
  "sponsorship_title", "sponsorship_date", "role_exemplar_name", "role_exemplar_title",
  "role_exemplar_source", "person_candidate_name", "person_candidate_title",
  "person_candidate_linkedin_url", "person_candidate_source", "person_match_score",
  "person_identification_state", "note",
].join(",");

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const asOf = val("as-of", new Date().toISOString().slice(0, 10));
if (!isoDate.test(asOf) || Number.isNaN(new Date(`${asOf}T00:00:00Z`).valueOf())) {
  console.error(`--as-of must be YYYY-MM-DD — got ${asOf}`);
  process.exit(2);
}
const windowStart = new Date(new Date(`${asOf}T23:59:59Z`).valueOf() - 365 * 86_400_000)
  .toISOString().slice(0, 10);
const csv = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function readProfile() {
  if (!existsSync(profilePath)) {
    throw new Error(`${profilePath} not found — the mass route needs the client category and title profile`);
  }
  return JSON.parse(readFileSync(profilePath, "utf8"));
}

function emitInstitutions(routed, { replace = false } = {}) {
  mkdirSync(dirname(OUT), { recursive: true });
  if (replace || !existsSync(OUT)) writeFileSync(OUT, HEADER + "\n");
  let existing = readFileSync(OUT, "utf8").toLowerCase();
  let added = 0;
  let skipped = 0;
  const institutions = [
    ...(routed.qualifying ?? []).filter((institution) =>
      institution.emission_state !== "replaced_by_person_destination"
      && !String(institution.emission_state ?? "").startsWith("withheld_")),
    ...(routed.person_destinations ?? []).filter((institution) => institution.emission_state === "ready"),
  ];
  for (const institution of institutions) {
    const isDestination = institution.origin === "person_destination";
    const activation = isDestination
      ? institution.source_activation ?? {}
      : institution.activations?.[0] ?? {};
    const exemplar = institution.role_exemplars?.[0] ?? {};
    const identification = institution.person_identification ?? {};
    const person = identification.resolved_profile ?? identification.nearest_title_comparator ?? {};
    const duplicateKey = institution.domain
      ? `,${String(institution.domain).toLowerCase()},`
      : `\n${csv(institution.company).toLowerCase()},`;
    if (existing.includes(duplicateKey)) { skipped++; continue; }
    const note = [
      isDestination
        ? `PERSON DESTINATION: ${institution.person_transfer?.full_name} moved from ${institution.source_sponsor?.company} to ${institution.company}.`
        : `DISCOVERED via ${activation.event?.key ?? "mass-discovery"} (${activation.event?.tier ?? "unknown tier"}).`,
      activation.evidence_quote ? `Quote: ${activation.evidence_quote}` : null,
      `Person route: ${identification.state ?? "not_started"}.`,
      isDestination ? "The source activation is provenance for the person route, not evidence that the destination sponsored that property." : null,
    ].filter(Boolean).join(" ");
    const line = [
      institution.company,
      institution.category,
      institution.domain,
      isDestination ? "" : activation.event?.location ?? "",
      isDestination
        ? `${institution.person_transfer?.full_name} moved from ${institution.source_sponsor?.company} to ${institution.company} as ${institution.person_transfer?.current_title ?? "title unknown"}`
        : `Sponsor of ${activation.event?.name ?? "comparable event"}, ${activation.sponsorship_date ?? "date unknown"}`,
      isDestination ? institution.person_transfer?.source_url : activation.source_url,
      institution.origin ?? "discovered",
      institution.parent_companies?.join(" | "),
      institution.source_sponsor?.company,
      institution.source_sponsor?.domain,
      isDestination ? activation.sponsorship_title : "",
      isDestination ? activation.sponsorship_date : "",
      isDestination ? activation.source_url : "",
      isDestination ? "" : activation.sponsorship_title,
      isDestination ? "" : activation.sponsorship_date,
      isDestination ? institution.person_transfer?.full_name : exemplar.name,
      isDestination ? institution.person_transfer?.current_title : exemplar.title,
      isDestination ? institution.person_transfer?.source_url : exemplar.source_url,
      person.full_name ?? person.name,
      person.current_title ?? person.title,
      person.linkedin_url,
      person.source_url ?? person.linkedin_url,
      person.title_match_score ?? identification.title_match_score,
      identification.state,
      note,
    ].map(csv).join(",") + "\n";
    appendFileSync(OUT, line);
    existing += line.toLowerCase();
    added++;
  }
  return { added, skipped, path: "artifacts/discovered.csv" };
}

// ---- list -----------------------------------------------------------------
if (has("list")) {
  console.log(`ICP: ${universe.icp.audience} · ${universe.icp.format} · ${universe.icp.market}`);
  console.log(`Window: rolling past year at execution time (campaign note: ${universe.icp.window})\n`);
  for (const [tier, why] of Object.entries(universe.tiers)) {
    console.log(`${tier} — ${why}`);
    for (const event of universe.events.filter((candidate) => candidate.tier === tier)) {
      console.log(`  ${event.key.padEnd(28)} ${event.name} · ${event.edition} · ${event.location}`);
      console.log(`  ${"".padEnd(28)} ${event.sponsor_source}`);
      console.log(`  ${"".padEnd(28)} ${event.verification}${event.note ? `\n  ${"".padEnd(28)} ${event.note}` : ""}`);
    }
    console.log();
  }
  process.exit(0);
}

// ---- provider schemas ------------------------------------------------------
const SPONSOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sponsors: {
      type: "array",
      description: "Every sponsor or official partner supported by a page dated within the requested window.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          company: { type: ["string", "null"], description: "Sponsor brand or institution as printed." },
          category: { type: ["string", "null"], description: "Product or institution category stated or directly supported by the page." },
          domain: { type: ["string", "null"], description: "Sponsor's bare first-party domain only when linked or explicitly supported." },
          parent_company: { type: ["string", "null"], description: "Named parent company only when the source supports the relationship." },
          sponsorship_title: { type: ["string", "null"], description: "Exact property title such as official vodka, presenting sponsor, or community partner." },
          sponsorship_date: { type: ["string", "null"], description: "ISO date or month for this sponsorship. Do not return a year alone." },
          spokesperson_name: { type: ["string", "null"], description: "Named sponsor-side person quoted about the activation." },
          spokesperson_title: { type: ["string", "null"], description: "That person's title exactly as printed." },
          linkedin_url: { type: ["string", "null"], description: "Exact LinkedIn /in/ URL only if the page links it." },
          quote: { type: ["string", "null"], description: "Short verbatim evidence tying the sponsor to the property and date." },
          source_url: { type: ["string", "null"], description: "Exact page supporting these fields." },
        },
        required: ["company", "category", "domain", "parent_company", "sponsorship_title", "sponsorship_date", "spokesperson_name", "spokesperson_title", "linkedin_url", "quote", "source_url"],
      },
    },
  },
  required: ["sponsors"],
};

function eventOperation(event) {
  return {
    id: `event-${event.key}`,
    phase: "event_sponsor_extraction",
    event_key: event.key,
    capability: "dated comparable-event sponsor extraction",
    method: "POST",
    path: "/web/extract",
    credits_planned: 10,
    body: {
      url: event.sponsor_source,
      schema: SPONSOR_SCHEMA,
      instructions: `Find every sponsor or official partner of ${event.name} supported from ${windowStart} through ${asOf}. Follow relevant sponsor, partner, newsroom, and activation pages. Preserve the exact sponsorship property title, ISO date or month, sponsor-side quoted person's name and title, exact profile URL when linked, a short quote, and its source URL. Return null when unsupported.`,
      maxPages: 20,
      maxDepth: 3,
      factCheck: true,
      timeoutMS: 180000,
    },
  };
}

function searchOperation(institution, profile) {
  const exemplar = institution.role_exemplars?.[0];
  if (!exemplar?.title) return null;
  const roleTerms = (profile.role_priority ?? []).map((role) => `"${role}"`).join(" OR ");
  const organizationTerms = [institution.company, ...(institution.parent_companies ?? [])]
    .map((name) => `"${name}"`).join(" OR ");
  return {
    id: `people-search-${slug(institution.company)}`,
    phase: "title_to_profile_search",
    sponsor_key: institution.domain?.toLowerCase() ?? `name:${slug(institution.company)}`,
    capability: "general web search for same-company title comparators",
    method: "POST",
    path: "/web/search",
    credits_planned: 1,
    body: {
      query: `site:linkedin.com/in (${organizationTerms}) ("${exemplar.title}"${roleTerms ? ` OR ${roleTerms}` : ""})`,
      numResults: 10,
    },
    exemplar,
  };
}

function personOperations(institution) {
  const limit = Math.max(1, Number(process.env.PERSON_CANDIDATE_LIMIT ?? 3));
  return (institution.person_identification?.candidates ?? [])
    .filter((candidate) => candidate.title_match_score >= 0.35 && exactLinkedinProfile(candidate.linkedin_url))
    .slice(0, limit)
    .map((candidate, index) => ({
      id: `person-${slug(institution.company)}-${String(index + 1).padStart(2, "0")}`,
      phase: "exact_profile_resolution",
      sponsor_key: institution.domain?.toLowerCase() ?? `name:${slug(institution.company)}`,
      capability: "resolve a ranked title comparator's exact profile",
      method: "POST",
      path: "/people/retrieve",
      credits_planned: 20,
      body: { identifiers: { linkedinUrl: candidate.linkedin_url } },
      exemplar_title: institution.person_identification.exemplar_title,
      candidate,
    }));
}

const RETRYABLE = (status) => status === 408 || status === 429 || status >= 500;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function callContext(operation, key) {
  const url = new URL(BASE + operation.path);
  const started = Date.now();
  let response;
  let bodyText = "";
  let retried = false;
  try {
    for (;;) {
      response = await fetch(url, {
        method: operation.method,
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(operation.body),
      });
      bodyText = await response.text();
      if (!response.ok && RETRYABLE(response.status) && !retried) {
        retried = true;
        const after = Math.min(Number(response.headers.get("retry-after")) * 1000 || 2000, 30000);
        await sleep(after);
        continue;
      }
      break;
    }
  } catch (error) {
    return { ...operation, status: "failed", http_status: null, error: error.message, response: null, receipt: null };
  }
  let parsed = null;
  try { parsed = JSON.parse(bodyText); } catch { parsed = bodyText.slice(0, 20000); }
  const receiptPath = resolve(DIR, "receipts", `${operation.id}.json`);
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, JSON.stringify({
    id: operation.id,
    phase: operation.phase,
    method: operation.method,
    endpoint: BASE + operation.path,
    request: operation.body,
    http_status: response.status,
    latency_ms: Date.now() - started,
    response: parsed,
    completed_at: new Date().toISOString(),
  }, null, 2) + "\n");
  return {
    ...operation,
    status: response.ok ? "executed" : "failed",
    http_status: response.status,
    latency_ms: Date.now() - started,
    credits: parsed?.key_metadata?.credits_consumed ?? null,
    response: parsed,
    receipt: `artifacts/discovery/receipts/${operation.id}.json`,
  };
}

async function pool(operations, key, concurrency = 3) {
  const output = new Array(operations.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, operations.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= operations.length) return;
      output[index] = await callContext(operations[index], key);
      const result = output[index];
      console.log(`  ${result.id.padEnd(40)} ${String(result.http_status ?? "ERR").padEnd(4)} ${result.latency_ms ?? 0}ms`);
    }
  }));
  return output;
}

function extractData(response) {
  return response?.data?.data ?? response?.data ?? response?.result?.data ?? response ?? {};
}

function searchResultObjects(response) {
  const found = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    const url = value.url ?? value.link ?? value.href;
    if (exactLinkedinProfile(url) && !seen.has(url)) { seen.add(url); found.push(value); }
    for (const child of Object.values(value)) visit(child);
  };
  visit(response);
  return found;
}

function candidateFromSearchResult(result, exemplarTitle) {
  const linkedinUrl = result.url ?? result.link ?? result.href;
  if (!exactLinkedinProfile(linkedinUrl)) return null;
  const rawTitle = String(result.title ?? result.name ?? "").replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
  const segments = rawTitle.split(/\s+[\-–—|]\s+/).map((part) => part.trim()).filter(Boolean);
  const name = segments[0] ?? null;
  const snippet = String(result.description ?? result.snippet ?? result.text ?? "").trim();
  const listedTitle = segments.slice(1).join(" - ") || snippet || exemplarTitle;
  return {
    name,
    title: listedTitle,
    linkedin_url: linkedinUrl,
    source_url: linkedinUrl,
    search_result_title: rawTitle,
    search_result_snippet: snippet,
    candidate_kind: "general_web_search_result",
  };
}

function sponsorKey(record) {
  const domain = record.domain ?? record.company_domain;
  const company = record.company ?? record.sponsor_company;
  return domain ? String(domain).toLowerCase() : `name:${slug(company)}`;
}

function rawEventResults(eventCalls) {
  return eventCalls.map((call) => {
    const event = universe.events.find((candidate) => candidate.key === call.event_key);
    const data = call.status === "executed" ? extractData(call.response) : {};
    return { event, sponsors: Array.isArray(data.sponsors) ? data.sponsors : [], operation_id: call.id };
  });
}

function attachSearchCandidates(eventResults, searchCalls) {
  const bySponsor = new Map();
  for (const call of searchCalls) {
    const candidates = call.status === "executed"
      ? searchResultObjects(call.response).map((result) => candidateFromSearchResult(result, call.exemplar.title)).filter(Boolean)
      : [];
    bySponsor.set(call.sponsor_key, candidates);
  }
  for (const eventResult of eventResults) {
    for (const sponsor of eventResult.sponsors ?? []) {
      const candidates = bySponsor.get(sponsorKey(sponsor)) ?? [];
      sponsor.person_candidates = [...(sponsor.person_candidates ?? []), ...candidates];
    }
  }
}

function personFromResponse(response) {
  const data = extractData(response);
  return data.person ?? data;
}

function finalizeProfileChecks(institution, checked, { allFailed = false } = {}) {
  institution.person_identification.profiles_checked = checked;
  const resolved = checked.filter((profile) => profile.state === "verified_match")
    .sort((a, b) => b.title_match_score - a.title_match_score)[0];
  if (resolved) {
    institution.person_identification.resolved_profile = resolved;
    institution.person_identification.title_match_score = resolved.title_match_score;
    institution.person_identification.nearest_title_comparator = {
      ...(institution.person_identification.candidates.find((candidate) => candidate.linkedin_url === resolved.linkedin_url) ?? {}),
      title_match_score: resolved.title_match_score,
    };
    institution.person_identification.state = "resolved_nearest_title_comparator";
    return;
  }

  const departed = checked.find((profile) => profile.state === "retrieved_match_unconfirmed"
    && profile.identity_match !== false
    && profile.company_match === false
    && profile.current_company
    && exactLinkedinProfile(profile.linkedin_url));
  if (departed) {
    institution.person_identification.departed_profile = departed;
    institution.person_identification.state = "person_departed_follow_current_employer";
    institution.emission_state = "withheld_departed_person_destination_unresolved";
  } else if (allFailed) {
    institution.person_identification.state = "profile_retrieval_failed";
  } else {
    institution.person_identification.state = "profiles_retrieved_match_unconfirmed";
  }
}

function attachResolvedProfiles(routed, personCalls) {
  const bySponsor = new Map();
  for (const call of personCalls) {
    if (!bySponsor.has(call.sponsor_key)) bySponsor.set(call.sponsor_key, []);
    bySponsor.get(call.sponsor_key).push(call);
  }
  for (const institution of routed.qualifying ?? []) {
    const key = institution.domain?.toLowerCase() ?? `name:${slug(institution.company)}`;
    const calls = bySponsor.get(key) ?? [];
    if (!calls.length) continue;
    const checked = [];
    for (const call of calls) {
      if (call.status !== "executed") {
        checked.push({
          linkedin_url: call.candidate?.linkedin_url ?? null,
          state: "retrieval_failed",
          receipt: call.receipt,
        });
        continue;
      }
      const person = personFromResponse(call.response);
      const fullName = person?.profile?.fullName ?? person?.fullName ?? person?.name ?? null;
      const experience = person?.experience?.[0] ?? person?.profile?.experience?.[0] ?? {};
      const currentTitle = experience.title ?? person?.headline ?? person?.profile?.headline ?? null;
      const currentCompany = experience.companyName ?? experience.company?.name
        ?? experience.company?.title ?? experience.company ?? null;
      checked.push({
        ...verifyResolvedProfile({
          institution_company: institution.company,
          exemplar_title: institution.person_identification.exemplar_title,
          full_name: fullName,
          current_title: currentTitle,
          current_company: currentCompany,
          linkedin_url: call.candidate.linkedin_url,
          organization_aliases: institution.parent_companies,
          expected_name: call.candidate.name,
        }),
        linkedin_url: call.candidate.linkedin_url,
        source_url: call.candidate.linkedin_url,
        receipt: call.receipt,
      });
    }
    finalizeProfileChecks(institution, checked, {
      allFailed: calls.every((call) => call.status !== "executed"),
    });
  }
}

function destinationBrandOperations(routed) {
  return (routed.qualifying ?? []).flatMap((institution) => {
    const profileCheck = institution.person_identification?.departed_profile;
    const name = String(profileCheck?.current_company ?? "").trim();
    if (name.length < 3 || name.length > 30) return [];
    return [{
      id: `destination-brand-${slug(institution.company)}-${slug(name)}`,
      phase: "departed_person_current_employer_resolution",
      sponsor_key: institution.domain?.toLowerCase() ?? `name:${slug(institution.company)}`,
      current_company: name,
      capability: "resolve the departed person's current employer by name",
      method: "POST",
      path: "/brand/retrieve",
      credits_planned: 10,
      body: { type: "by_name", name, country_gl: "us" },
      profile_check: profileCheck,
    }];
  });
}

function brandFromResponse(response) {
  const data = extractData(response);
  return data?.brand ?? data;
}

function attachDestinationInstitutions(routed, brandCalls) {
  const callsBySponsor = new Map(brandCalls.map((call) => [call.sponsor_key, call]));
  const destinations = new Map();
  const review = [];
  for (const institution of routed.qualifying ?? []) {
    const profileCheck = institution.person_identification?.departed_profile;
    if (!profileCheck) continue;
    const key = institution.domain?.toLowerCase() ?? `name:${slug(institution.company)}`;
    const call = callsBySponsor.get(key);
    const destination = call?.status === "executed"
      ? destinationInstitutionFromProfile({
        source_institution: institution,
        profile_check: profileCheck,
        resolved_brand: brandFromResponse(call.response),
      })
      : null;
    if (!destination) {
      review.push({
        source_sponsor: institution.company,
        person: profileCheck.full_name,
        current_company: profileCheck.current_company,
        linkedin_url: profileCheck.linkedin_url,
        reason: call
          ? call.status === "executed" ? "brand_resolution_mismatch_or_missing_domain" : "brand_resolution_failed"
          : "company_name_outside_brand_lookup_contract",
        receipt: call?.receipt ?? null,
      });
      continue;
    }

    institution.emission_state = "replaced_by_person_destination";
    institution.person_identification.state = "followed_departed_person_to_current_employer";
    institution.person_identification.destination_institution = {
      company: destination.company,
      domain: destination.domain,
      state: "added_to_target_list",
    };
    if (!destinations.has(destination.domain)) destinations.set(destination.domain, destination);
  }
  routed.person_destinations = [...destinations.values()].sort((a, b) => a.company.localeCompare(b.company));
  routed.destination_review = review;
  routed.counts.person_destinations = routed.person_destinations.length;
  routed.counts.destination_review = review.length;
  routed.counts.withheld_source_institutions = (routed.qualifying ?? [])
    .filter((institution) => String(institution.emission_state ?? "").startsWith("withheld_")).length;
}

function attachProvidedProfileChecks(routed, profileChecks = []) {
  const bySponsor = new Map();
  for (const item of profileChecks) {
    if (!bySponsor.has(item.sponsor_key)) bySponsor.set(item.sponsor_key, []);
    bySponsor.get(item.sponsor_key).push(item.profile_check ?? item);
  }
  for (const institution of routed.qualifying ?? []) {
    const key = institution.domain?.toLowerCase() ?? `name:${slug(institution.company)}`;
    const checked = bySponsor.get(key);
    if (checked?.length) finalizeProfileChecks(institution, checked);
  }
}

async function runMass() {
  const profile = readProfile();
  const similarity = val("similarity", "high");
  if (!new Set(["high", "exact"]).has(similarity)) {
    console.error(`--similarity must be high or exact — got ${similarity}`);
    process.exit(2);
  }
  const maxEventsRaw = Number(val("max-events", "Infinity"));
  const events = selectComparableEvents(universe, {
    similarity,
    includeNational: has("include-national"),
    maxEvents: Number.isFinite(maxEventsRaw) ? maxEventsRaw : Infinity,
  });
  const eventOperations = events.map(eventOperation);
  mkdirSync(DIR, { recursive: true });
  const key = process.env.CONTEXT_DEV_API_KEY;
  const blockedReason = has("dry-run") ? "dry_run" : !key ? "blocked_missing_credentials" : null;
  const plan = {
    schema_version: "2.0.0",
    status: blockedReason ?? "ready",
    campaign: campaign.key,
    as_of: asOf,
    window_start: windowStart,
    similarity,
    include_national: has("include-national"),
    profile_id: profile.profile_id,
    selected_events: events.map((event) => ({ key: event.key, name: event.name, tier: event.tier, source: event.sponsor_source })),
    event_operations: eventOperations,
    dynamic_route: [
      "filter to cited sponsor records dated inside the rolling past year",
      "match categories against the client competitor profile",
      "general web search using sponsor company plus the cited sponsorship owner's title",
      "rank exact LinkedIn /in/ results by title similarity",
      "check up to three ranked exact profile URLs and select the nearest current company and title match",
      "when that person left, resolve the current employer by name and add that institution instead",
      "keep the old sponsor activation only as person-route provenance and stop after one employer hop",
    ],
    planned_event_credits: eventOperations.reduce((sum, operation) => sum + operation.credits_planned, 0),
    planned_dynamic_credits: "1 search + up to 60 profile retrieval credits per qualifying institution, plus 10 credits when a departed person's current employer needs brand resolution",
  };
  writeFileSync(MASS_PLAN, JSON.stringify(plan, null, 2) + "\n");
  if (blockedReason) {
    writeFileSync(MASS_SUMMARY, JSON.stringify({ ...plan, operations: eventOperations.map((operation) => ({ ...operation, status: blockedReason, receipt: null })) }, null, 2) + "\n");
    console.log(`${blockedReason}: planned ${events.length} high-similarity event extracts (${plan.planned_event_credits} credits before person routing)`);
    console.log("artifacts/discovery/mass-plan.json");
    process.exit(0);
  }

  console.log(`event pass: ${events.length} high-similarity events`);
  const eventCalls = await pool(eventOperations, key, Number(process.env.DISCOVERY_CONCURRENCY ?? 3));
  const eventResults = rawEventResults(eventCalls);
  writeFileSync(MASS_RAW, JSON.stringify({ as_of: asOf, event_results: eventResults }, null, 2) + "\n");

  let routed = routeDiscovery(eventResults, profile, { asOf });
  const searchOperations = routed.qualifying.map((institution) => searchOperation(institution, profile)).filter(Boolean);
  console.log(`\ntitle search pass: ${searchOperations.length} qualifying institutions`);
  const searchCalls = await pool(searchOperations, key, Number(process.env.DISCOVERY_CONCURRENCY ?? 3));
  attachSearchCandidates(eventResults, searchCalls);

  routed = routeDiscovery(eventResults, profile, { asOf });
  const profileOperations = routed.qualifying.flatMap(personOperations);
  console.log(`\nprofile pass: ${profileOperations.length} exact LinkedIn candidates`);
  const personCalls = await pool(profileOperations, key, Number(process.env.DISCOVERY_CONCURRENCY ?? 3));
  attachResolvedProfiles(routed, personCalls);

  const destinationOperations = destinationBrandOperations(routed);
  console.log(`\ndestination pass: ${destinationOperations.length} departed-person employer lookup(s)`);
  const destinationCalls = await pool(destinationOperations, key, Number(process.env.DISCOVERY_CONCURRENCY ?? 3));
  attachDestinationInstitutions(routed, destinationCalls);

  routed.source_mode = "contextdev_live";
  routed.events = events.map((event) => ({ key: event.key, name: event.name, tier: event.tier }));
  routed.operation_ledger = [...eventCalls, ...searchCalls, ...personCalls, ...destinationCalls].map((call) => ({
    id: call.id, phase: call.phase, capability: call.capability, endpoint: `${BASE}${call.path}`,
    status: call.status, http_status: call.http_status, credits: call.credits,
    receipt: call.receipt, write_policy: "artifact_only_no_send",
  }));
  writeFileSync(MASS_RESULTS, JSON.stringify(routed, null, 2) + "\n");
  const emitted = emitInstitutions(routed, { replace: has("replace") });
  writeFileSync(MASS_SUMMARY, JSON.stringify({
    status: "complete", counts: routed.counts, emitted,
    credits_spent: [...eventCalls, ...searchCalls, ...personCalls, ...destinationCalls]
      .reduce((sum, call) => sum + (Number(call.credits) || 0), 0),
    operations: routed.operation_ledger,
  }, null, 2) + "\n");
  console.log(`\n${routed.counts.qualifying_institutions} qualifying institution(s) · ${emitted.added} emitted · ${emitted.skipped} skipped`);
  console.log("artifacts/discovery/mass-results.json");
}

if (has("mass")) {
  await runMass();
  process.exit(0);
}

// Route a previously captured raw provider artifact. This is also the scenario-test
// entry point: the source pages are fetched live, while routing remains deterministic.
if (val("route")) {
  const inputPath = resolve(val("route"));
  const raw = JSON.parse(readFileSync(inputPath, "utf8"));
  const routed = routeDiscovery(raw.event_results ?? raw, readProfile(), { asOf });
  attachProvidedProfileChecks(routed, raw.profile_checks ?? []);
  attachDestinationInstitutions(routed, raw.destination_brand_calls ?? []);
  routed.source_mode = "provided_live_capture";
  mkdirSync(DIR, { recursive: true });
  writeFileSync(MASS_RESULTS, JSON.stringify(routed, null, 2) + "\n");
  const emitted = emitInstitutions(routed, { replace: has("replace") });
  console.log(`routed ${routed.counts.observed} sponsor record(s) · ${routed.counts.qualifying_institutions} qualifying institution(s)`);
  console.log(`${emitted.path} · +${emitted.added}, ${emitted.skipped} skipped`);
  process.exit(0);
}

// ---- manual event capture --------------------------------------------------
const key = val("event") ?? val("check") ?? val("emit");
const event = universe.events.find((candidate) => candidate.key === key);
if (!event) {
  console.error("usage: discover_sponsors --mass [options] | --route <raw.json> | --list | --event <key> | --check <key> | --emit <key>");
  if (key) console.error(`unknown event key: ${key} — run --list for the universe`);
  process.exit(2);
}
const briefPath = resolve(DIR, `${key}.json`);

if (has("event")) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(briefPath, JSON.stringify({
    event: { key: event.key, name: event.name, edition: event.edition, location: event.location, tier: event.tier },
    sponsor_source: event.sponsor_source,
    verification_note: event.verification,
    edition_confirmed: null,
    list_dated: null,
    observed_at: null,
    read_only: true,
    sponsors_observed: [{
      company: null,
      category_guess: null,
      sponsorship_title: null,
      sponsorship_date: null,
      evidence_quote: null,
      evidence_date: null,
      source_url: event.sponsor_source,
      spokesperson_name: null,
      spokesperson_title: null,
      linkedin_url: null,
      person_candidates: [],
      domain: null,
      parent_company: null,
      domain_confirmed: false,
      confirmation_url: null,
      ambiguity_note: null,
      already_on_list: false,
    }],
  }, null, 2) + "\n");
  console.log(`${briefPath} opened for ${event.name}.`);
  console.log("Fill every observed sponsor, its exact property title and date, the quoted sponsor-side owner and title, then: --check " + key);
  process.exit(0);
}

if (!existsSync(briefPath)) {
  console.error(`${briefPath} not found. Run --event ${key} first.`);
  process.exit(2);
}
const brief = JSON.parse(readFileSync(briefPath, "utf8"));
const problems = [];
if (brief.edition_confirmed !== true) problems.push("edition_confirmed is not true");
if (!brief.list_dated) problems.push("list_dated is empty");
if (!brief.observed_at) problems.push("observed_at is empty");
const rows = (brief.sponsors_observed ?? []).filter((sponsor) => sponsor.company);
if (!rows.length) problems.push("sponsors_observed is empty");
for (const sponsor of rows) {
  const who = sponsor.company;
  if (!sponsor.sponsorship_title) problems.push(`${who}: no sponsorship_title`);
  if (!sponsor.sponsorship_date || !/^\d{4}(-\d{2}){1,2}$/.test(String(sponsor.sponsorship_date))) problems.push(`${who}: sponsorship_date must be ISO month or date, not a year alone`);
  if (!sponsor.evidence_quote) problems.push(`${who}: no evidence_quote`);
  if (!sponsor.evidence_date || !/^\d{4}(-\d{2}){1,2}$/.test(String(sponsor.evidence_date))) problems.push(`${who}: evidence_date must be ISO month or date`);
  if (!sponsor.source_url) problems.push(`${who}: no source_url`);
  if (sponsor.domain && sponsor.domain_confirmed !== true) problems.push(`${who}: domain set but domain_confirmed is false`);
  if (sponsor.domain_confirmed === true && !sponsor.confirmation_url) problems.push(`${who}: domain_confirmed without a confirmation_url`);
  if (sponsor.domain && /^https?:|^www\./.test(sponsor.domain)) problems.push(`${who}: domain must be bare — got ${sponsor.domain}`);
  if (!sponsor.domain && !sponsor.ambiguity_note) problems.push(`${who}: no domain and no ambiguity_note`);
}

if (has("check")) {
  if (problems.length) { for (const problem of problems) console.error(`  ${problem}`); process.exit(1); }
  console.log(`harvest OK · ${event.name} · ${rows.length} sponsor(s) observed · edition ${brief.list_dated}`);
  process.exit(0);
}

if (has("emit")) {
  if (problems.length) {
    console.error("refusing to emit an invalid harvest:");
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  if (!existsSync(OUT)) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, HEADER + "\n"); }
  const existing = readFileSync(OUT, "utf8").toLowerCase();
  let added = 0;
  let skipped = 0;
  for (const sponsor of rows) {
    if (sponsor.already_on_list || existing.includes(`\n${csv(sponsor.company).toLowerCase()},`)) { skipped++; continue; }
    const candidates = sponsor.person_candidates ?? [];
    const candidate = candidates[0] ?? {};
    appendFileSync(OUT, [
      sponsor.company, sponsor.category_guess, sponsor.domain, "",
      `Sponsor of ${event.name}, ${sponsor.sponsorship_date}`, sponsor.source_url,
      "discovered", sponsor.parent_company,
      "", "", "", "", "",
      sponsor.sponsorship_title, sponsor.sponsorship_date,
      sponsor.spokesperson_name, sponsor.spokesperson_title, sponsor.source_url,
      candidate.name, candidate.title, candidate.linkedin_url, candidate.source_url,
      sponsor.spokesperson_title && candidate.title ? titleSimilarity(sponsor.spokesperson_title, candidate.title) : "",
      candidate.linkedin_url ? "profile_url_ready" : "not_routed",
      `DISCOVERED via ${event.key} (${event.tier}). Quote: ${sponsor.evidence_quote}`,
    ].map(csv).join(",") + "\n");
    added++;
  }
  console.log(`artifacts/discovered.csv · +${added} row(s), ${skipped} skipped`);
  console.log("The loader folds this file in automatically: npm run targets");
  process.exit(0);
}
