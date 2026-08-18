#!/usr/bin/env node
/**
 * extract_brand.mjs — campaign deck (+ optional site styleguide) -> artifacts/brand-tokens.json.
 *
 *   node scripts/extract_brand.mjs [--deck references/campaigns/<key>/sources/<deck>.pptx] [--domain <event-domain>]
 *
 * The pitch template is the sender's stationery and carries no event brand of its own.
 * Each campaign's identity is extracted from that campaign's artifacts into tokens, and
 * the template consumes tokens — so the same file pitches a purple night festival this
 * month and a beach one next, and neither leaves residue in the other.
 *
 * Deck first, site second. The deck is the client's own artifact, so its palette is
 * ground truth for the campaign; when CONTEXT_DEV_API_KEY and --domain are present the
 * site styleguide and fonts fill whatever the deck left empty, and both sources are
 * recorded. Every chosen value carries the evidence it was chosen from (occurrence
 * counts per hex, typeface counts), because a wrong token is corrected by re-reading
 * the evidence rather than by taste.
 *
 * Zero dependencies: a minimal zip reader (central directory + inflateRawSync) is all
 * a PPTX needs.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { inflateRawSync } from "node:zlib";

import { campaignDir } from "./campaign.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };

// ---- minimal zip ------------------------------------------------------------
function zipEntries(buf) {
  // EOCD: scan the tail for the signature, then walk the central directory.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip: no end-of-central-directory");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    entries.set(name, { method, csize, local });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return {
    read(name) {
      const e = entries.get(name);
      if (!e) return null;
      const nameLen = buf.readUInt16LE(e.local + 26);
      const extraLen = buf.readUInt16LE(e.local + 28);
      const start = e.local + 30 + nameLen + extraLen;
      const raw = buf.subarray(start, start + e.csize);
      return e.method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    },
    names: [...entries.keys()],
  };
}

// ---- color math (just enough to rank) ----------------------------------------
const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luma = (hex) => { const [r, g, b] = rgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const sat = (hex) => { const [r, g, b] = rgb(hex); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const hue = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};

// ---- deck extraction ----------------------------------------------------------
function fromDeck(deckPath) {
  const zip = zipEntries(readFileSync(deckPath));
  const slideNames = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const colorCounts = {};
  const faceCounts = {};
  for (const n of slideNames) {
    const xml = zip.read(n).toString("utf8");
    for (const m of xml.matchAll(/srgbClr val="([0-9A-Fa-f]{6})"/g)) {
      const hex = m[1].toUpperCase();
      colorCounts[hex] = (colorCounts[hex] ?? 0) + 1;
    }
    for (const m of xml.matchAll(/typeface="([^"+][^"]*)"/g)) {
      faceCounts[m[1]] = (faceCounts[m[1]] ?? 0) + 1;
    }
  }
  const media = zip.names.filter((n) => n.startsWith("ppt/media/")).map((n) => n.replace("ppt/media/", ""));

  const ranked = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const saturated = ranked.filter((h) => sat(h) > 0.35 && luma(h) > 0.08 && luma(h) < 0.92);
  const darks = ranked.filter((h) => luma(h) < 0.16);
  const lights = ranked.filter((h) => luma(h) > 0.84);
  const tints = ranked.filter((h) => luma(h) >= 0.7 && luma(h) <= 0.92 && sat(h) > 0.04 && sat(h) < 0.4);

  const accent = saturated[0] ?? null;
  // The second accent is the next saturated color at a genuinely different hue,
  // so a purple deck with four purples still yields purple + orange, not two purples.
  const accent2 = saturated.find((h) => accent && Math.abs(hue(h) - hue(accent)) > 40) ?? null;

  // "Proxima Nova Th" is the Thin cut of Proxima Nova, not a family. Strip trailing
  // weight tokens so the tokens name families a font stack can actually reference.
  const WEIGHTS = /\s+(Th|Thin|Hairline|Lt|Light|Rg|Regular|Md|Medium|Sb|Semi[Bb]old|Bd|Bold|Blk|Black|Hv|Heavy|Cond|Condensed)$/;
  const family = (f) => { let s = f; while (WEIGHTS.test(s)) s = s.replace(WEIGHTS, ""); return s; };
  const familyCounts = {};
  for (const [f, n] of Object.entries(faceCounts)) familyCounts[family(f)] = (familyCounts[family(f)] ?? 0) + n;
  const faces = Object.entries(familyCounts).sort((a, b) => b[1] - a[1]).map(([f]) => f);
  return {
    source: { kind: "deck", file: basename(deckPath), slides: slideNames.length },
    palette: {
      field: darks[0] ? `#${darks[0]}` : null,
      paper: lights[0] ? `#${lights[0]}` : null,
      panel: tints[0] ? `#${tints[0]}` : null,
      accent: accent ? `#${accent}` : null,
      accent2: accent2 ? `#${accent2}` : null,
    },
    type: { display: faces[0] ?? null, body: faces[1] ?? null },
    media,
    evidence: {
      color_counts: Object.fromEntries(Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)),
      typeface_counts: faceCounts,
    },
  };
}

// ---- optional site styleguide --------------------------------------------------
async function fromSite(domain, key) {
  const get = async (path) => {
    const url = new URL(`https://api.context.dev/v1${path}`);
    url.searchParams.set("domain", domain);
    const res = await fetch(url, { headers: { authorization: `Bearer ${key}` } });
    return res.ok ? res.json() : null;
  };
  const styleguide = await get("/web/styleguide");
  const fonts = await get("/web/fonts");
  if (!styleguide && !fonts) return null;
  return { source: { kind: "site", domain }, styleguide: styleguide?.styleguide ?? null, fonts: fonts?.fonts ?? null };
}

// ---- main -----------------------------------------------------------------------
const deckArg = arg("deck", null);
const domain = arg("domain", null);
let deckPath = deckArg;
if (!deckPath) {
  const dir = resolve(campaignDir().dir, "sources");
  const candidates = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".pptx")) : [];
  if (candidates.length === 1) deckPath = resolve(dir, candidates[0]);
  else if (candidates.length > 1) {
    console.error(`campaign sources holds ${candidates.length} decks — pass --deck to pick one:`);
    for (const c of candidates) console.error(`  --deck ${resolve(dir, c)}`);
    process.exit(2);
  }
}
if (!deckPath || !existsSync(resolve(deckPath))) {
  console.error("usage: node scripts/extract_brand.mjs [--deck <file>.pptx] [--domain <event-domain>]");
  console.error(`No deck found. The campaign's deck lives in ${campaignDir().dir}/sources/.`);
  process.exit(2);
}

const tokens = fromDeck(resolve(deckPath));
tokens.extracted_at = new Date().toISOString();

const key = process.env.CONTEXT_DEV_API_KEY;
if (domain && key) {
  const site = await fromSite(domain, key);
  if (site) {
    tokens.site = site;
    // The deck is the campaign artifact, so it wins; the site fills gaps only.
    tokens.type.display ??= site.fonts?.[0]?.family ?? null;
  }
} else if (domain) {
  tokens.site = { source: { kind: "site", domain }, status: "blocked_missing_credentials" };
}

mkdirSync(resolve("artifacts"), { recursive: true });
writeFileSync(resolve("artifacts/brand-tokens.json"), JSON.stringify(tokens, null, 2) + "\n");
console.log(`artifacts/brand-tokens.json  ·  ${tokens.source.file}`);
console.log(`  field ${tokens.palette.field ?? "—"} · paper ${tokens.palette.paper ?? "—"} · panel ${tokens.palette.panel ?? "—"}`);
console.log(`  accent ${tokens.palette.accent ?? "—"} · accent2 ${tokens.palette.accent2 ?? "—"}`);
console.log(`  display "${tokens.type.display ?? "—"}" · body "${tokens.type.body ?? "—"}"`);
console.log(`  media: ${tokens.media.length} file(s) in the deck — pick a hosted hero from these, never hotlink`);
