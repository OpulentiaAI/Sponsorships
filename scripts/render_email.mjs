#!/usr/bin/env node
/**
 * render_email.mjs — write a Gmail-ready Markdown sponsor draft.
 *
 * The filename remains stable for existing operators. The output is Markdown, not
 * React Email or HTML. Authorship, evidence, compliance, and send-state gates remain.
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

const props = {
  greetingName,
  companyName: dossier.company ?? null,
  personalNote,
  reasonSourceUrl: reasonUrl ?? null,
  festivalName: festival.event_name ?? null,
  festivalDates: humanDates(festival.dates?.start, festival.dates?.end),
  festivalVenue: festival.venue?.name ?? null,
  festivalMarket: festival.venue?.market ?? null,
  fitPoint: dossier.outreach?.fit_point ?? null,
  highlightTier,
  callUrl: agencySender.calendly ?? null,
  senderName: agencySender.name ?? null,
  senderCompany: agencySender.company ?? null,
  previewText: dossier.outreach?.preview_text ?? null,
};

const missing = ["companyName", "festivalName", "personalNote", "fitPoint", "callUrl", "previewText", "senderName", "senderCompany"]
  .filter((k) => !props[k]);
if (!dossier.outreach?.subject) missing.push("subject");
if (missing.length) {
  console.error(`Cannot write draft: ${missing.join(", ")} not populated. Complete the judgement pass.`);
  process.exit(2);
}

const lines = [
  `Hi ${props.greetingName},`, "",
  props.personalNote, "",
  `${props.festivalName} takes place ${props.festivalDates} at ${props.festivalVenue} near ${props.festivalMarket}.`,
  props.fitPoint, "",
  props.highlightTier
    ? `We can shape the ${props.highlightTier} package around your goals and how you want ${props.companyName} to show up onsite.`
    : `We can shape a package around your goals and how you want ${props.companyName} to show up onsite.`,
  "",
  `Are you open to a quick call? [Book a time.](${props.callUrl})`, "",
  props.senderName, props.senderCompany, "",
];
const markdown = lines.join("\n");

const paragraph = (value) => `<p style="margin:0 0 18px 0;">${escapeHtml(value)}</p>`;
const gmailHtml = [
  '<div style="max-width:600px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#202124;">',
  paragraph(`Hi ${props.greetingName},`),
  paragraph(props.personalNote),
  paragraph(`${props.festivalName} takes place ${props.festivalDates} at ${props.festivalVenue} near ${props.festivalMarket}.`),
  paragraph(props.fitPoint),
  paragraph(props.highlightTier
    ? `We can shape the ${props.highlightTier} package around your goals and how you want ${props.companyName} to show up onsite.`
    : `We can shape a package around your goals and how you want ${props.companyName} to show up onsite.`),
  `<p style="margin:22px 0;">Are you open to a quick call? <a href="${escapeHtml(props.callUrl)}" style="color:#1a73e8;text-decoration:underline;">Book a time.</a></p>`,
  `<p style="margin:0 0 18px 0;">${escapeHtml(props.senderName)}<br>${escapeHtml(props.senderCompany)}</p>`,
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
