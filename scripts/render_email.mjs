#!/usr/bin/env node
/**
 * render_email.mjs — write a Gmail-ready Markdown sponsor draft.
 *
 * The filename remains stable for existing operators. The output is Markdown, not
 * React Email or HTML. Authorship, evidence, compliance, and send-state gates remain.
 *
 * The body is built once as an ordered list of paragraphs, then rendered twice, so the
 * authored Markdown and the Gmail HTML carry the same words in the same blocks.
 * The shape follows Bob's own outreach in references/knowledge/agency/writing-samples.md:
 * their world, the property in one sentence, why them plus one idea, the offer, one ask.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : process.argv[i + 1];
};
const read = async (p) => JSON.parse(await readFile(resolve(p), "utf8"));

const dossierPath = resolve(arg("dossier", "artifacts/dossier.json"));
const dossier = await read(dossierPath);
const { campaignDir, sender } = await import("./campaign.mjs");
const festival = await read(arg("festival", `${campaignDir().dir}/festival-packet.json`));
const agencySender = sender();

function humanDates(startIso, endIso) {
  if (!startIso) return null;
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const [sy, sm, sd] = String(startIso).split("-").map(Number);
  const [ey, em, ed] = String(endIso ?? startIso).split("-").map(Number);
  if (sy === ey && sm === em) return `${months[sm - 1]} ${sd} to ${ed}, ${sy}`;
  return `${months[sm - 1]} ${sd} to ${months[em - 1]} ${ed}, ${ey}`;
}

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const lowerFirst = (value) => (value ? value[0].toLowerCase() + value.slice(1) : value);

if (String(dossier.gates?.draft_gate ?? "").startsWith("blocked")) {
  console.error(`Refusing to draft: ${dossier.company} is ${dossier.gates.draft_gate}.`);
  console.error(`  ${dossier.gates.draft_gate_reason}`);
  process.exit(4);
}

const reason = dossier.outreach?.reason_to_engage ?? null;
const reasonUrl = dossier.outreach?.reason_source_url ?? null;
const personalNote = dossier.outreach?.personal_note ?? null;
if (reason && !reasonUrl) {
  console.error("Refusing to draft: reason_to_engage has no reason_source_url.");
  process.exit(4);
}
if (dossier.required_fields?.activation_history?.state !== "retrieved") {
  console.error("Refusing to draft: activation_history is not retrieved.");
  console.error(`  ${dossier.required_fields?.activation_history?.reason ?? "No dated activation signal."}`);
  process.exit(4);
}
if (personalNote && reason && personalNote.trim() === reason.trim()) {
  console.error("Refusing to draft: personal_note copies the research finding verbatim.");
  console.error("  Rewrite it in the sender's voice after reading the stored communication entries.");
  process.exit(4);
}

const dm = dossier.required_fields?.decision_maker;
const firstName = dm?.state === "retrieved" ? String(dm.value ?? "").split(" ")[0] || null : null;
const greetingName = firstName ?? `${dossier.company} team`;
const rateCard = festival.packages?.rate_card ?? [];
const named = dossier.outreach?.package_named ?? null;
const highlightTier = named && rateCard.some((t) => named.toLowerCase().includes(t.tier.toLowerCase()))
  ? rateCard.find((t) => named.toLowerCase().includes(t.tier.toLowerCase())).tier
  : null;

// The property sentence is the client's own, from his outreach samples: what it is,
// when, where, and how far from the city the reader knows.
const festivalName = festival.event_name ?? null;
const festivalDates = humanDates(festival.dates?.start, festival.dates?.end);
const festivalVenue = festival.venue?.name ?? null;
const festivalMarket = festival.venue?.market ?? null;
const descriptor = festival.positioning?.descriptor ?? null;
const placeNote = festival.venue?.distance_note
  ? lowerFirst(festival.venue.distance_note)
  : festivalMarket ? `near ${festivalMarket}` : null;
const propertyLine = festivalName && festivalDates && festivalVenue && placeNote
  ? (descriptor
    ? `I'm working on securing sponsors for ${festivalName}, ${descriptor} taking place ${festivalDates} at ${festivalVenue}, ${placeNote}.`
    : `I'm working on securing sponsors for ${festivalName}, which takes place ${festivalDates} at ${festivalVenue}, ${placeNote}.`)
  : null;

const props = {
  greetingName,
  companyName: dossier.company ?? null,
  personalNote,
  reasonSourceUrl: reasonUrl ?? null,
  festivalName,
  festivalDates,
  festivalVenue,
  festivalMarket,
  propertyLine,
  fitPoint: dossier.outreach?.fit_point ?? null,
  activationIdea: dossier.outreach?.activation_idea ?? null,
  highlightTier,
  callUrl: agencySender.calendly ?? null,
  senderName: agencySender.name ?? null,
  senderCompany: agencySender.company ?? null,
  senderPhone: agencySender.phone ?? null,
  previewText: dossier.outreach?.preview_text ?? null,
};

const missing = ["companyName", "festivalName", "personalNote", "propertyLine", "fitPoint",
  "activationIdea", "callUrl", "previewText", "senderName", "senderCompany"]
  .filter((k) => !props[k]);
if (!dossier.outreach?.subject) missing.push("subject");
if (missing.length) {
  console.error(`Cannot write draft: ${missing.join(", ")} not populated. Complete the judgement pass.`);
  process.exit(2);
}

// One ordered body, rendered twice. A paragraph here is a paragraph in both files.
const offer = props.highlightTier
  ? `We can shape the ${props.highlightTier} package around your goals and how you want ${props.companyName} to show up onsite.`
  : `We can shape a package around your goals and how you want ${props.companyName} to show up onsite.`;
const signature = [props.senderName, props.senderCompany, props.senderPhone].filter(Boolean);

const blocks = [
  `Hi ${props.greetingName},`,
  `${props.personalNote} ${props.propertyLine}`,
  `${props.fitPoint} ${props.activationIdea}`,
  offer,
  { ask: "Are you open to a quick call?", label: "Book a time.", url: props.callUrl },
  { signature },
];

const markdown = blocks.map((block) => {
  if (typeof block === "string") return block;
  if (block.ask) return `${block.ask} [${block.label}](${block.url})`;
  return block.signature.join("\n");
}).join("\n\n") + "\n";

const gmailHtml = [
  '<div style="max-width:600px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#202124;">',
  ...blocks.map((block) => {
    if (typeof block === "string") return `<p style="margin:0 0 18px 0;">${escapeHtml(block)}</p>`;
    if (block.ask) {
      return `<p style="margin:22px 0;">${escapeHtml(block.ask)} `
        + `<a href="${escapeHtml(block.url)}" style="color:#1a73e8;text-decoration:underline;">${escapeHtml(block.label)}</a></p>`;
    }
    return `<p style="margin:0 0 18px 0;">${block.signature.map(escapeHtml).join("<br>")}</p>`;
  }),
  "</div>",
].join("\n");

await mkdir(resolve("artifacts"), { recursive: true });
await writeFile(resolve("artifacts/pitch.md"), markdown);
await writeFile(resolve("artifacts/pitch.gmail.html"), gmailHtml);
await writeFile(resolve("artifacts/pitch.props.json"), JSON.stringify({
  props, subject: dossier.outreach?.subject ?? null, review_state: "not_required",
  send_state: "ready_to_send", sender_authority: agencySender.authority_state ?? "authorized",
  attendance_omitted: festival.attendance?.state === "disputed",
  transport: "campaign_owner_connected_gmail",
}, null, 2) + "\n");

const updated = JSON.parse(await readFile(dossierPath, "utf8"));
updated.outreach = {
  ...updated.outreach, draft_markdown_path: "artifacts/pitch.md",
  draft_gmail_html_path: "artifacts/pitch.gmail.html",
  review_state: "not_required", send_state: "ready_to_send",
  sender_authority: agencySender.authority_state ?? "authorized",
};
await writeFile(dossierPath, JSON.stringify(updated, null, 2) + "\n");

if (process.env.ORCHESTRATED === "1") {
  console.log("Markdown draft path written to the dossier; deliver will attach it");
} else {
  try {
    execFileSync("node", [resolve(import.meta.dirname, "assemble.mjs")], { stdio: "pipe" });
    console.log("packet refreshed: Markdown draft attached to sponsors[0] and messages[]");
  } catch (err) {
    console.error(`packet refresh failed: ${err.message} — run npm run assemble by hand`);
  }
}

console.log(`artifacts/pitch.md          ${markdown.length} bytes`);
console.log(`artifacts/pitch.gmail.html  ${gmailHtml.length} bytes`);
console.log(`subject: ${dossier.outreach?.subject ?? "(unset)"}`);
console.log("review_state: not_required · send_state: ready_to_send");
console.log(highlightTier ? `offer: ${highlightTier}, shaped to sponsor goals` : "offer: package shaped to sponsor goals");

/* ---- voice check ------------------------------------------------------------
 * Notes, not gates. lint_pitch.mjs owns what a machine can decide; these are the
 * judgment calls the coordinator makes before sending, printed where they will be
 * read. Nothing here changes the exit code.
 */
const notes = [];
const company = String(props.companyName ?? "");
const zones = [
  ...(festival.format?.zones ?? []).map((s) => String(s)),
  ...(festival.format?.stages ?? []).map((s) => String(s)),
  ...(festival.format?.elements ?? []).map((s) => String(s)),
  ...rateCard.map((t) => String(t.tier)),
];
const opener = String(props.personalNote);
if (!/\b(I|I'm|I've|my|we|our)\b/.test(opener)) {
  notes.push("the opening has no first-person voice. Bob writes \"I saw\", \"I'm working on\", \"I think\".");
}
if (company && opener.trimStart().toLowerCase().startsWith(company.toLowerCase())) {
  notes.push(`the opening starts by describing ${company} to ${company}. Lead with what he saw and why he is writing.`);
}
const idea = String(props.activationIdea);
if (!zones.some((zone) => zone && idea.toLowerCase().includes(zone.toLowerCase()))) {
  notes.push("the activation idea names no zone, element, or tier from the deck. A concept nobody can picture is not an idea.");
}
if (company && !`${props.fitPoint} ${idea}`.includes(company)) {
  notes.push(`neither the fit point nor the idea names ${company}. Swap the company for another target: would the email change?`);
}
// The greeting and the signature are fixed; only the four body paragraphs are the writing.
const bodyWords = blocks
  .slice(1, -1)
  .map((block) => (typeof block === "string" ? block : block.ask))
  .join(" ")
  .replace(/https?:\/\/\S+/g, "")
  .trim().split(/\s+/).filter(Boolean).length;
if (bodyWords > 150) {
  notes.push(`${bodyWords} words of body. Both of Bob's samples run near 100, and lint fails above 190.`);
}

console.log("");
console.log("voice check (notes, not gates. references/content-editing.md carries the passes)");
for (const note of notes) console.log(`  · ${note}`);
console.log("  · read the first line aloud on its own. Does it sound like Bob, and does it earn the second?");
console.log("  · confirm knowledge/agency/writing-samples.md was read before this draft, not after.");
