#!/usr/bin/env node
/**
 * research.mjs — everything that can happen before a person judges anything.
 *
 *   node scripts/research.mjs --target <id> [--linkedin-url <url>] [--campaign <key>]
 *
 * Replaces four separate commands (targets, calls, brand, signal) with one. That
 * consolidation is the point: each command the operator has to run is a round-trip,
 * and round-trips, not compute, were most of this workflow's wall clock. Local work
 * here totals under a second.
 *
 * What runs concurrently, and why it is safe: the target gate reads a CSV, brand
 * extraction reads a deck, and the provider plan hits the network. They share no
 * inputs and no outputs, so they run together and the stage costs what its slowest
 * member costs — the network — instead of their sum.
 *
 * Ends by assembling a first dossier, so the judgement pass has a file to write into.
 * That dossier is honest about being early: the activation signal is still unread, and
 * it says so in the field's own reason.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactPath, nodeScript } from "./campaign.mjs";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const t0 = Date.now();

const run = async (script, args = []) => {
  const { stdout, stderr } = await execFileAsync("node", [resolve(here, script), ...args], {
    cwd: process.cwd(), maxBuffer: 1024 * 1024 * 32,
  });
  return (stdout ?? "") + (stderr ?? "");
};
const step = (label, ms) => console.log(`  ${label.padEnd(22)} ${(ms / 1000).toFixed(1)}s`);

const campaign = arg("campaign", null);
const campaignArgs = campaign ? ["--campaign", campaign] : [];
const targetId = arg("target", null);

// ---- 1 · gate the list ------------------------------------------------------
const tGate = Date.now();
const gateOut = await run("load_targets.mjs", [...campaignArgs, "--out", "artifacts/cohort.json"]);
step("targets", Date.now() - tGate);

const cohort = JSON.parse(await readFile(resolve("artifacts/cohort.json"), "utf8"));
const target = targetId
  ? cohort.targets.find((t) => t.id === targetId)
  : cohort.targets.find((t) => t.draft_gate === "open");

if (!target) {
  console.log(gateOut);
  console.error(targetId
    ? `\nNo target "${targetId}" in the cohort. Draftable ids:\n  ${cohort.targets.filter((t) => t.draft_gate === "open").map((t) => t.id).join("\n  ")}`
    : "\nNo draftable target in the cohort.");
  process.exit(2);
}
if (target.draft_gate !== "open") {
  console.error(`\n${target.company} is ${target.draft_gate}: ${target.draft_gate_reason}`);
  console.error("Research is allowed on a blocked target; drafting is not. Re-run with --target <open id> to draft.");
}

console.log(`\nsubject: ${target.company} · ${target.domain} · ${target.origin}`);
console.log(`cohort:  ${cohort.accepted} accepted, ${cohort.draftable} draftable, ${cohort.rejected} rejected, ${cohort.discovered ?? 0} discovered\n`);

// ---- 2 · the network plan and the deck read, together -----------------------
// A caller override wins. Otherwise mass discovery may supply an exact profile URL that
// was found by the title-scoped general-search route. /people/retrieve still resolves
// only that exact URL; it never receives a title or a name search.
const linkedinUrl = arg("linkedin-url", target.decision_maker_url ?? null);
const tPar = Date.now();
const [callsOut, brandOut] = await Promise.all([
  (async () => {
    const s = Date.now();
    const out = await run("run_calls.mjs", [
      "--domain", target.domain, "--company", target.company,
      ...(linkedinUrl ? ["--linkedin-url", linkedinUrl] : []),
    ]);
    return { out, ms: Date.now() - s };
  })(),
  (async () => {
    const s = Date.now();
    try { return { out: await run("extract_brand.mjs", campaignArgs), ms: Date.now() - s }; }
    catch (err) { return { out: `brand extraction skipped: ${err.message}`, ms: Date.now() - s }; }
  })(),
]);
console.log(callsOut.out.trimEnd());
step("calls", callsOut.ms);
step("brand", brandOut.ms);
console.log(`  ${"both, concurrently".padEnd(22)} ${((Date.now() - tPar) / 1000).toFixed(1)}s\n`);

// ---- 3 · open the signal brief, with the lead prefilled ---------------------
const signalPath = resolve("artifacts/signal.json");
if (!existsSync(signalPath)) {
  await mkdir(resolve("artifacts"), { recursive: true });
  await writeFile(signalPath, JSON.stringify({
    _fill: "Read the page in a browser, then fill this. reason_eligible needs a date AND a quote.",
    signal_type: null, summary: null, quote: null, signal_date: null,
    event_named: null, scale_claim: null, activation_form: null,
    competitor_conflicts: [], conflict_checked: false,
    reason_eligible: false, reason_rank: null,
    source_url: target.activation_lead_source ?? null,
    observed_at: null, read_only: true,
  }, null, 2) + "\n");
}

// ---- 4 · first assemble, so the judgement pass has a file -------------------
const tAsm = Date.now();
await run("assemble.mjs", ["--target", target.id, ...campaignArgs]);
step("assemble", Date.now() - tAsm);

console.log(`\nresearch complete in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
console.log("Next, in one pass:");
console.log(`  1. Read the activation page${target.activation_lead ? ` — lead: ${target.activation_lead}` : ""}`);
console.log(`     ${target.activation_lead_source ?? "(no lead on this row; find a dated page)"}`);
console.log(`  2. Fill ${artifactPath("signal.json")} — a date and a verbatim quote, then reason_eligible: true`);
console.log(`  3. Write judgement into ${artifactPath("dossier.json")} — fit.band, fit.rationale,`);
console.log("     fit.counter_evidence, outreach.reason_to_engage + reason_source_url,");
console.log("     outreach.personal_note, fit_point, activation_idea, package_named, subject, preview_text");
console.log("     Read references/knowledge/agency/writing-samples.md first. It is the register.");
console.log(`  4. ${nodeScript("deliver.mjs")}`);
