#!/usr/bin/env node
/**
 * deliver.mjs — everything after the judgement is written.
 *
 *   node scripts/deliver.mjs [--target <id>] [--campaign <key>] [--dashboard]
 *
 * Replaces four commands (assemble, email, lint, validate) with one, and stops the
 * pipeline from assembling the packet three times: once here to fold in the filled
 * signal, once after the Markdown and Gmail HTML bodies are written to attach them, and no more. render_email skips
 * its own re-assemble when this orchestrator is driving.
 *
 * The dashboard build is off the critical path. It is an optional run summary, not a step in
 * sourcing a sponsor, and a Next build costs more wall clock than everything else in
 * this file put together. `--dashboard` opts into it.
 *
 * Exit codes are the ones the individual steps already use, so a failure here reads
 * the same as a failure there: 4 is a refused draft, 1 is a rule breach.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILL_ROOT } from "./campaign.mjs";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const has = (n) => process.argv.includes(`--${n}`);
const t0 = Date.now();

const campaign = arg("campaign", null);
const campaignArgs = campaign ? ["--campaign", campaign] : [];
const targetArgs = arg("target", null) ? ["--target", arg("target", null)] : [];

async function run(script, args = [], env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync("node", [resolve(here, script), ...args], {
      cwd: process.cwd(), maxBuffer: 1024 * 1024 * 32, env: { ...process.env, ...env },
    });
    return { code: 0, out: (stdout ?? "") + (stderr ?? "") };
  } catch (err) {
    return { code: err.code ?? 1, out: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}
const step = (label, ms) => `  ${label.padEnd(22)} ${(ms / 1000).toFixed(1)}s`;

// ---- 1 · fold the filled signal into the dossier and packet -----------------
let s = Date.now();
const asm1 = await run("assemble.mjs", [...targetArgs, ...campaignArgs]);
if (asm1.code) { console.error(asm1.out); process.exit(asm1.code); }
console.log(asm1.out.trimEnd());
console.log(step("assemble", Date.now() - s));

// ---- 2 · write the Markdown and Gmail HTML bodies, then lint ----------------
s = Date.now();
const email = await run("render_email.mjs", campaignArgs, { ORCHESTRATED: "1" });
console.log(email.out.trimEnd());
if (email.code) {
  console.log(step("email", Date.now() - s));
  console.error(`\ndeliver stopped at the draft (exit ${email.code}). Nothing further ran.`);
  process.exit(email.code);
}
console.log(step("email", Date.now() - s));

s = Date.now();
const lint = await run("lint_pitch.mjs");
console.log(lint.out.trimEnd());
if (lint.code) { console.log(step("lint", Date.now() - s)); process.exit(lint.code); }
console.log(step("lint", Date.now() - s));

// ---- 3 · attach the draft to the packet, then check the whole thing --------
s = Date.now();
const asm2 = await run("assemble.mjs", [...targetArgs, ...campaignArgs]);
if (asm2.code) { console.error(asm2.out); process.exit(asm2.code); }
console.log(step("attach draft", Date.now() - s));

s = Date.now();
const valid = await run("validate_packet.mjs", ["artifacts/packet.json"]);
console.log(valid.out.trimEnd());
console.log(step("validate", Date.now() - s));
if (valid.code) process.exit(valid.code);

// ---- 4 · the optional run summary, only when asked -------------------------
if (has("dashboard")) {
  s = Date.now();
  const { stdout } = await execFileAsync("npm", ["--prefix", resolve(SKILL_ROOT, "scripts/dashboard"), "run", "build"], {
    cwd: process.cwd(), maxBuffer: 1024 * 1024 * 64,
  }).catch((e) => ({ stdout: e.stdout ?? String(e) }));
  console.log(stdout.trimEnd().split("\n").slice(-4).join("\n"));
  console.log(step("dashboard build", Date.now() - s));
}

const packet = JSON.parse(await readFile(resolve("artifacts/packet.json"), "utf8"));
const sponsor = packet.sponsors[0] ?? {};
console.log(`\ndeliver complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  ${sponsor.company} · fit ${sponsor.fit?.band ?? "unwritten"} · ${packet.messages?.length ?? 0} send-ready message`);
console.log(`  ${(packet.open_gates ?? []).filter((g) => g.state !== "resolved").length} open gates · ${(packet.unknowns ?? []).length} unknowns`);
if (!has("dashboard")) console.log("  dashboard: skipped (add --dashboard to build the run summary)");
console.log(`  send_state: ${sponsor.outreach?.send_state ?? "pending_draft"} · review_state: ${sponsor.outreach?.review_state ?? "not_required"}`);
console.log(`  fallback attachment: ${resolve("artifacts/packet.json")}`);
