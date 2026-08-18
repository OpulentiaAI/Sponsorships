/**
 * campaign.mjs — skill root, workspace cwd, campaign, and agency identity.
 *
 * Skill data lives next to SKILL.md. Run output lives in the workspace cwd.
 * Opulent installs this package under `/opulent/workspace/.agents/skills/<slug>/`
 * and runs with cwd `/opulent/workspace`; scripts must not assume they are the same
 * directory.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const WORKSPACE_ROOT = process.cwd();
export const OPULENT_SKILL_DIR =
  "/opulent/workspace/.agents/skills/opulent-sponsor-context-showcase";

/** Absolute `node <skill>/scripts/<file>` command. Do not `cd` into the skill. */
export const nodeScript = (file, extra = "") =>
  `node ${resolve(SKILL_ROOT, "scripts", file)}${extra ? ` ${extra}` : ""}`;

function loadEnv(dir) {
  const file = resolve(dir, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
loadEnv(WORKSPACE_ROOT);
if (WORKSPACE_ROOT !== SKILL_ROOT) loadEnv(SKILL_ROOT);

export const campaignsBase = () => resolve(SKILL_ROOT, "references/campaigns");
export const agencyDir = () => resolve(SKILL_ROOT, "references/knowledge/agency");
export const templatesDir = () => resolve(SKILL_ROOT, "references/templates");
export const artifactsDir = () => resolve(WORKSPACE_ROOT, "artifacts");
export const templatePath = (name) => resolve(templatesDir(), name);
export const artifactPath = (...parts) => resolve(artifactsDir(), ...parts);

export function campaignDir(argv = process.argv) {
  const i = argv.indexOf("--campaign");
  const asked = i !== -1 ? argv[i + 1] : process.env.CAMPAIGN;
  const base = campaignsBase();
  const keys = existsSync(base) ? readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name) : [];
  if (asked) {
    if (!keys.includes(asked)) throw new Error(`unknown campaign "${asked}" — have: ${keys.join(", ")}`);
    return { key: asked, dir: resolve(base, asked) };
  }
  if (keys.length === 1) return { key: keys[0], dir: resolve(base, keys[0]) };
  throw new Error(keys.length
    ? `several campaigns exist (${keys.join(", ")}) — pass --campaign <key> or set CAMPAIGN`
    : `no campaigns in ${base} — create references/campaigns/<key>/ per references/knowledge/agency/trifecta-profile.md`);
}

export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const sender = () => readJson(resolve(agencyDir(), "sender.json"));
