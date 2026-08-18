const DAY_MS = 86_400_000;

const ROLE_FAMILIES = {
  partnerships: ["partnership", "partnerships", "sponsor", "sponsorship", "alliances"],
  experiential: ["experiential", "activation", "activations", "events", "event"],
  field_trade: ["field", "trade", "shopper", "regional", "market"],
  community: ["community", "outreach", "relations", "giving", "impact"],
  brand: ["brand", "consumer", "integrated"],
  marketing: ["marketing", "growth", "communications"],
};

const LEVELS = [
  ["chief", "cmo", "president"],
  ["svp", "senior vice president"],
  ["vp", "vice president"],
  ["head"],
  ["director"],
  ["manager"],
  ["lead"],
  ["coordinator", "specialist"],
];

export const exactLinkedinProfile = (value) =>
  /^https:\/\/(?:(?:www|[a-z]{2,3})\.)?linkedin\.com\/in\/[a-z0-9_%.-]+\/?(?:[?#].*)?$/i.test(String(value ?? ""));

export const slug = (value) => String(value ?? "").toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function words(value) {
  return new Set(String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/).filter((word) => word.length > 2 && !["and", "the", "senior", "global"].includes(word)));
}

function intersectionSize(a, b) {
  let count = 0;
  for (const value of a) if (b.has(value)) count++;
  return count;
}

function roleFamilies(title) {
  const tokens = words(title);
  return new Set(Object.entries(ROLE_FAMILIES)
    .filter(([, aliases]) => aliases.some((alias) => tokens.has(alias)))
    .map(([family]) => family));
}

function titleLevel(title) {
  const normalized = String(title ?? "").toLowerCase();
  return LEVELS.findIndex((aliases) => aliases.some((alias) => normalized.includes(alias)));
}

export function titleSimilarity(exemplar, candidate) {
  const left = words(exemplar);
  const right = words(candidate);
  if (!left.size || !right.size) return 0;
  const union = new Set([...left, ...right]);
  const tokenScore = intersectionSize(left, right) / union.size;

  const leftFamilies = roleFamilies(exemplar);
  const rightFamilies = roleFamilies(candidate);
  const familyUnion = new Set([...leftFamilies, ...rightFamilies]);
  const familyScore = familyUnion.size
    ? intersectionSize(leftFamilies, rightFamilies) / familyUnion.size
    : 0;

  const leftLevel = titleLevel(exemplar);
  const rightLevel = titleLevel(candidate);
  const levelScore = leftLevel === -1 || rightLevel === -1
    ? 0
    : Math.max(0, 1 - Math.abs(leftLevel - rightLevel) / 4);

  return Number((tokenScore * 0.5 + familyScore * 0.35 + levelScore * 0.15).toFixed(3));
}

export function rankPersonCandidates(exemplarTitle, candidates = []) {
  return candidates
    .filter((candidate) => candidate?.name && candidate?.title && candidate?.source_url)
    .map((candidate) => ({
      ...candidate,
      linkedin_url: exactLinkedinProfile(candidate.linkedin_url) ? candidate.linkedin_url : null,
      title_match_score: titleSimilarity(exemplarTitle, candidate.title),
    }))
    .sort((a, b) => b.title_match_score - a.title_match_score
      || Number(Boolean(b.linkedin_url)) - Number(Boolean(a.linkedin_url))
      || String(a.name).localeCompare(String(b.name)));
}

export function companyNameMatch(expected, observed) {
  const stop = new Set(["the", "inc", "llc", "company", "co", "corporation", "group", "brands"]);
  const tokens = (value) => new Set(slug(value).split("-").filter((token) => token && !stop.has(token)));
  const left = tokens(expected);
  const right = tokens(observed);
  if (!left.size || !right.size) return false;
  return [...left].some((token) => right.has(token));
}

export function personNameMatch(expected, observed) {
  if (!expected || !observed) return false;
  const tokens = (value) => slug(value).split("-").filter(Boolean);
  const left = tokens(expected);
  const right = tokens(observed);
  if (!left.length || !right.length) return false;
  if (left.join("-") === right.join("-")) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = new Set(left.length <= right.length ? right : left);
  return shorter.every((token) => longer.has(token))
    && longer.has(shorter[shorter.length - 1]);
}

function bareDomain(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  const host = text.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host) ? host : null;
}

export function verifyResolvedProfile({
  institution_company: institutionCompany,
  exemplar_title: exemplarTitle,
  full_name: fullName,
  current_title: currentTitle,
  current_company: currentCompany,
  linkedin_url: linkedinUrl,
  source_url: sourceUrl = linkedinUrl,
  organization_aliases: organizationAliases = [],
  expected_name: expectedName = null,
}) {
  const titleMatchScore = titleSimilarity(exemplarTitle, currentTitle);
  const organizationNames = [institutionCompany, ...organizationAliases].filter(Boolean);
  const employerMatch = organizationNames.some((name) => companyNameMatch(name, currentCompany));
  const titleNamesBrand = organizationNames.some((name) => companyNameMatch(name, currentTitle));
  const companyMatch = employerMatch || titleNamesBrand;
  const identityMatch = expectedName ? personNameMatch(expectedName, fullName) : Boolean(fullName);
  return {
    full_name: fullName ?? null,
    current_title: currentTitle ?? null,
    current_company: currentCompany ?? null,
    linkedin_url: exactLinkedinProfile(linkedinUrl) ? linkedinUrl : null,
    source_url: sourceUrl ?? null,
    title_match_score: titleMatchScore,
    identity_match: identityMatch,
    expected_name: expectedName,
    company_match: companyMatch,
    company_match_basis: employerMatch ? "current_employer" : titleNamesBrand ? "current_title_names_brand" : null,
    state: identityMatch && currentTitle && companyMatch && titleMatchScore >= 0.35
      ? "verified_match"
      : "retrieved_match_unconfirmed",
  };
}

function industryLabels(brand) {
  const values = brand?.industries?.eic;
  if (!Array.isArray(values)) return [];
  return [...new Set(values.flatMap((value) => {
    if (typeof value === "string") return [value];
    return [value?.subindustry, value?.industry].filter(Boolean);
  }))];
}

/**
 * Convert a confirmed job move into a one-hop institution lead.
 *
 * The old sponsor activation stays attached only as provenance for why this person was
 * followed. It is never copied into `activations`, because the destination employer has
 * not been shown to sponsor the source event. A canonical domain from brand retrieval is
 * required before the destination can enter the ordinary target list.
 */
export function destinationInstitutionFromProfile({
  source_institution: sourceInstitution,
  profile_check: profileCheck,
  resolved_brand: resolvedBrand,
}) {
  if (!sourceInstitution || !profileCheck || profileCheck.state !== "retrieved_match_unconfirmed") return null;
  if (profileCheck.company_match !== false || profileCheck.identity_match === false) return null;
  if (!profileCheck.current_company || !exactLinkedinProfile(profileCheck.linkedin_url)) return null;

  const domain = bareDomain(resolvedBrand?.domain);
  const company = resolvedBrand?.title ?? profileCheck.current_company;
  if (!domain || !companyNameMatch(profileCheck.current_company, company)) return null;

  const sourceActivation = sourceInstitution.activations?.[0] ?? null;
  const industries = industryLabels(resolvedBrand);
  return {
    origin: "person_destination",
    hop_count: 1,
    company,
    domain,
    category: industries[0] ?? "person transfer lead",
    category_evidence: industries,
    fit_state: "person_transfer_signal",
    parent_companies: [],
    activations: [],
    role_exemplars: [],
    source_sponsor: {
      company: sourceInstitution.company,
      domain: sourceInstitution.domain ?? null,
      category: sourceInstitution.category ?? null,
    },
    source_activation: sourceActivation,
    person_transfer: {
      full_name: profileCheck.full_name,
      previous_company: sourceInstitution.company,
      current_company: company,
      current_title: profileCheck.current_title,
      linkedin_url: profileCheck.linkedin_url,
      source_url: profileCheck.source_url ?? profileCheck.linkedin_url,
      state: "current_employer_resolved",
    },
    person_identification: {
      state: "followed_departed_person_to_current_employer",
      hop_count: 1,
      resolved_profile: profileCheck,
      profiles_checked: [profileCheck],
    },
    emission_state: "ready",
  };
}

function partialIsoRange(value) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(date.valueOf()) ? null : { start: date, end: date, precision: "day" };
  }
  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-").map(Number);
    if (month < 1 || month > 12) return null;
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 0)),
      precision: "month",
    };
  }
  if (/^\d{4}$/.test(text)) {
    const year = Number(text);
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year, 11, 31)),
      precision: "year",
    };
  }
  return null;
}

export function sponsorshipRecency(value, asOf = new Date()) {
  const end = new Date(`${new Date(asOf).toISOString().slice(0, 10)}T23:59:59Z`);
  const start = new Date(end.valueOf() - 365 * DAY_MS);
  const range = partialIsoRange(value);
  if (!range) return { state: "missing_or_invalid_date", within_past_year: false, window_start: start.toISOString().slice(0, 10), window_end: end.toISOString().slice(0, 10) };
  if (range.start > end) return { state: "future", within_past_year: false, precision: range.precision, window_start: start.toISOString().slice(0, 10), window_end: end.toISOString().slice(0, 10) };
  if (range.precision === "year" && !(range.start >= start && range.end <= end)) {
    return { state: "ambiguous_year_only", within_past_year: false, precision: range.precision, window_start: start.toISOString().slice(0, 10), window_end: end.toISOString().slice(0, 10) };
  }
  const within = range.end >= start && range.start <= end;
  return { state: within ? "within_past_year" : "outside_past_year", within_past_year: within, precision: range.precision, window_start: start.toISOString().slice(0, 10), window_end: end.toISOString().slice(0, 10) };
}

export function selectComparableEvents(universe, { similarity = "high", includeNational = false, maxEvents = Infinity } = {}) {
  const defaultTiers = similarity === "exact"
    ? new Set(["4_same_venue", "1_same_format_and_region"])
    : new Set(["4_same_venue", "1_same_format_and_region", "2_same_market"]);
  if (includeNational) defaultTiers.add("3_national_edm");
  const tierOrder = ["4_same_venue", "1_same_format_and_region", "2_same_market", "3_national_edm"];
  return [...(universe.events ?? [])]
    .filter((event) => defaultTiers.has(event.tier))
    .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))
    .slice(0, Number.isFinite(maxEvents) ? maxEvents : undefined);
}

function categoryMatch(category, profile) {
  const candidate = words(category);
  let best = null;
  for (const [id, aliases] of Object.entries(profile.category_aliases ?? {})) {
    const terms = [id, ...(aliases ?? [])];
    const matched = terms.find((term) => {
      const aliasWords = words(term);
      return aliasWords.size && [...aliasWords].every((word) => candidate.has(word));
    });
    if (matched) { best = { category_id: id, matched_alias: matched }; break; }
  }
  return best
    ? { state: "matched", ...best }
    : { state: "needs_review", category_id: null, matched_alias: null };
}

function normalizeSponsor(raw, event, asOf, profile) {
  const sponsorshipDate = raw.sponsorship_date ?? raw.activation_date ?? raw.announcement_date ?? null;
  const category = raw.category ?? raw.category_guess ?? null;
  const sourceUrl = raw.source_url ?? raw.page_url ?? event.sponsor_source ?? null;
  const people = Array.isArray(raw.person_candidates) ? [...raw.person_candidates] : [];
  // The quoted spokesperson supplies the exemplar title. They become a person
  // candidate only when the source also supplies an exact profile URL. Otherwise the
  // following general-search pass must find and cite the profile.
  if (raw.spokesperson_name && raw.spokesperson_title && exactLinkedinProfile(raw.linkedin_url)) {
    people.push({
      name: raw.spokesperson_name,
      title: raw.spokesperson_title,
      linkedin_url: raw.linkedin_url,
      source_url: sourceUrl,
      quote: raw.quote ?? raw.evidence_quote ?? null,
      candidate_kind: "activation_spokesperson",
    });
  }
  return {
    company: raw.company ?? raw.sponsor_company ?? null,
    domain: raw.domain ?? raw.company_domain ?? null,
    parent_company: raw.parent_company ?? null,
    category,
    profile_fit: categoryMatch(category, profile),
    event: { key: event.key, name: event.name, tier: event.tier, edition: event.edition, location: event.location },
    sponsorship_title: raw.sponsorship_title ?? raw.property_sponsored ?? null,
    sponsorship_date: sponsorshipDate,
    recency: sponsorshipRecency(sponsorshipDate, asOf),
    evidence_quote: raw.quote ?? raw.evidence_quote ?? null,
    source_url: sourceUrl,
    spokesperson_name: raw.spokesperson_name ?? null,
    spokesperson_title: raw.spokesperson_title ?? null,
    person_candidates: people,
  };
}

function identificationFor(record) {
  const exemplarTitle = record.spokesperson_title;
  const ranked = rankPersonCandidates(exemplarTitle, record.person_candidates);
  const nearest = ranked[0] ?? null;
  if (!exemplarTitle) return { state: "no_role_exemplar", exemplar_title: null, nearest_title_comparator: null, candidates: ranked };
  if (!nearest) return { state: "no_public_candidate", exemplar_title: exemplarTitle, nearest_title_comparator: null, candidates: [] };
  const state = nearest.title_match_score < 0.35
    ? "weak_title_match"
    : nearest.linkedin_url
      ? "profile_url_ready"
      : "public_candidate_needs_profile_url";
  return { state, exemplar_title: exemplarTitle, nearest_title_comparator: nearest, candidates: ranked };
}

export function routeDiscovery(eventResults, profile, { asOf = new Date() } = {}) {
  const all = [];
  for (const result of eventResults ?? []) {
    const event = result.event ?? {};
    for (const sponsor of result.sponsors ?? []) all.push(normalizeSponsor(sponsor, event, asOf, profile));
  }

  const usable = all.filter((record) => record.company && record.source_url && record.evidence_quote);
  const qualifyingRecords = usable.filter((record) => record.profile_fit.state === "matched" && record.recency.within_past_year);
  const reviewRecords = usable.filter((record) => !qualifyingRecords.includes(record));
  const institutions = new Map();
  for (const record of qualifyingRecords) {
    const key = record.domain ? String(record.domain).toLowerCase() : `name:${slug(record.company)}`;
    if (!institutions.has(key)) {
      institutions.set(key, {
        company: record.company,
        domain: record.domain,
        parent_companies: record.parent_company ? [record.parent_company] : [],
        category: record.profile_fit.category_id,
        category_evidence: record.category,
        activations: [],
        role_exemplars: [],
        person_identification: null,
      });
    }
    const institution = institutions.get(key);
    if (record.parent_company && !institution.parent_companies.includes(record.parent_company)) {
      institution.parent_companies.push(record.parent_company);
    }
    institution.activations.push({
      event: record.event,
      sponsorship_title: record.sponsorship_title,
      sponsorship_date: record.sponsorship_date,
      evidence_quote: record.evidence_quote,
      source_url: record.source_url,
    });
    if (record.spokesperson_title) institution.role_exemplars.push({
      name: record.spokesperson_name,
      title: record.spokesperson_title,
      source_url: record.source_url,
      sponsorship_date: record.sponsorship_date,
      sponsorship_title: record.sponsorship_title,
      event: record.event,
    });
    const identification = identificationFor(record);
    const currentScore = institution.person_identification?.nearest_title_comparator?.title_match_score ?? -1;
    const nextScore = identification.nearest_title_comparator?.title_match_score ?? -1;
    if (!institution.person_identification || nextScore > currentScore) institution.person_identification = identification;
  }

  const qualifying = [...institutions.values()].map((institution) => ({
    ...institution,
    activations: institution.activations.sort((a, b) => String(b.sponsorship_date).localeCompare(String(a.sponsorship_date))),
    role_exemplars: institution.role_exemplars.sort((a, b) => String(b.sponsorship_date).localeCompare(String(a.sponsorship_date))),
  })).sort((a, b) => a.company.localeCompare(b.company));

  return {
    generated_at: new Date().toISOString(),
    as_of: new Date(asOf).toISOString().slice(0, 10),
    profile_id: profile.profile_id,
    counts: { observed: all.length, evidence_usable: usable.length, qualifying_institutions: qualifying.length, review_records: reviewRecords.length },
    qualifying,
    review: reviewRecords.map((record) => ({
      company: record.company,
      event: record.event,
      category: record.category,
      profile_fit: record.profile_fit,
      sponsorship_date: record.sponsorship_date,
      recency: record.recency,
      source_url: record.source_url,
      reason: record.profile_fit.state !== "matched" ? "category_not_mapped_to_client_profile" : record.recency.state,
    })),
    rejected_missing_evidence: all.length - usable.length,
  };
}
