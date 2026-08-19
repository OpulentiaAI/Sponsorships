#!/usr/bin/env node
/**
 * lint_pitch.mjs — the machine-checkable half of the voice profile.
 *
 *   node scripts/lint_pitch.mjs [artifacts-dir]
 *
 * Runs after every draft (`npm run email` chains it). Checks pitch.md, the subject,
 * and the preview against the agency and campaign banned-phrases.json files and the rules the voice
 * profile states. Exit 1 is a finding; the fix is rewriting the pitch, never this file.
 *
 * Rules, each named in the output:
 *   banned-phrase     a phrase from the banned list appears
 *   em-dash           an em dash in pitch prose
 *   attendance        any attendance-shaped number (the packet holds the figure disputed)
 *   single-ask        the call-to-action line appears other than exactly once
 *   tier-fidelity     a dollar amount that matches no rate-card range
 *   subject-preview   subject or preview empty, or preview repeating the subject
 *   internal-copy     internal labels, raw evidence fields, or source links leak into the email
 *   length            the first-touch body exceeds 190 words
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artDir = resolve(process.cwd(), process.argv[2] ?? "artifacts");
const failures = [];
const fail = (rule, detail) => failures.push({ rule, detail });

const txtPath = resolve(artDir, "pitch.md");
const propsPath = resolve(artDir, "pitch.props.json");
if (!existsSync(txtPath) || !existsSync(propsPath)) {
  console.error(`lint_pitch: ${artDir} has no pitch.md / pitch.props.json. Write the draft first: npm run email`);
  process.exit(2);
}

const text = readFileSync(txtPath, "utf8");
const props = JSON.parse(readFileSync(propsPath, "utf8"));
const subject = props.subject ?? "";
const preview = props.props?.previewText ?? "";
const prose = [text, subject, preview].join("\n").toLowerCase();

// ---- banned phrases ---------------------------------------------------------
const { campaignDir, agencyDir } = await import("./campaign.mjs");
const house = JSON.parse(readFileSync(resolve(agencyDir(), "banned-phrases.json"), "utf8"));
const deck = JSON.parse(readFileSync(resolve(campaignDir().dir, "banned-phrases.json"), "utf8"));
for (const phrase of [...house.house, ...(deck.deck_register ?? [])]) {
  if (prose.includes(phrase.toLowerCase())) fail("banned-phrase", `"${phrase}"`);
}

// ---- em dash ----------------------------------------------------------------
if (/—/.test(text + subject + preview)) fail("em-dash", "use a period or a comma");

// ---- attendance -------------------------------------------------------------
// The packet holds attendance disputed, so no attendance-shaped claim survives:
// the known conflicting figures, or any "N,NNN attendees/admissions/fans" pattern.
if (/\b(20,?000|7,?500|22,?500)\b/.test(prose)) fail("attendance", "a disputed figure appears");
if (/\b\d{1,3},?\d{3}\s*(attendees|admissions|fans|people)\b/i.test(prose)) {
  fail("attendance", "an attendance-shaped claim appears");
}

// ---- single ask -------------------------------------------------------------
const asks = (text.match(/are you open to a quick call/gi) ?? []).length;
if (asks !== 1) fail("single-ask", `"Are you open to a quick call" appears ${asks} times; the pitch makes exactly one ask`);
const bookingLinks = (text.match(/\[Book a time\.\]\(https:\/\/calendly\.com\/[^)]+\)/gi) ?? []).length;
if (bookingLinks !== 1) fail("single-ask", `verified Calendly booking link appears ${bookingLinks} times; the pitch includes it once`);

// ---- recipient-facing copy -------------------------------------------------
for (const pattern of [
  /draft preview/i,
  /unsent\s*\/\s*draft for review/i,
  /initial offer sheet/i,
  /^stages:/im,
  /^primary audience:/im,
  /\[source\]\(/i,
  /you are receiving this because/i,
  /reply if you do not want further messages/i,
]) {
  if (pattern.test(text)) fail("internal-copy", `recipient-facing draft contains ${pattern}`);
}
const bodyWords = text
  .replace(/https?:\/\/\S+/g, "")
  .trim()
  .split(/\s+/)
  .filter(Boolean).length;
if (bodyWords > 190) fail("length", `${bodyWords} words; first-touch email must be 190 words or fewer`);

// ---- tier fidelity ----------------------------------------------------------
// Any dollar figure in the pitch must come from the packet: a rate-card range or the
// audience's household-income band. Everything else is an invented number.
const festival = JSON.parse(readFileSync(resolve(campaignDir().dir, "festival-packet.json"), "utf8"));
const tiers = festival.packages?.rate_card ?? [];
const income = String(festival.audience?.household_income ?? "");
const allowed = [...tiers.map((t) => String(t.range)), income]
  .flatMap((s) => s.match(/\$\d[\d,]*K?/gi) ?? [])
  .map((s) => s.toUpperCase().replace(/,000\b/, "K"));
for (const hit of text.match(/\$\d[\d,]*K?\+?/gi) ?? []) {
  const norm = hit.toUpperCase().replace(/,000\b/, "K").replace(/\+$/, "");
  if (!allowed.includes(norm)) {
    fail("tier-fidelity", `${hit} is neither a rate-card range nor the packet's audience band`);
  }
}

// ---- subject and preview ----------------------------------------------------
if (!subject) fail("subject-preview", "subject is empty");
if (!preview) fail("subject-preview", "preview is empty");
if (subject && preview && preview.trim().toLowerCase() === subject.trim().toLowerCase()) {
  fail("subject-preview", "preview repeats the subject; it extends it");
}

if (failures.length) {
  console.error(`lint_pitch: ${failures.length} violation(s)`);
  for (const f of failures) console.error(`  ${f.rule.padEnd(16)} ${f.detail}`);
  process.exit(1);
}
console.log("lint_pitch: clean");
