import { existsSync, readFileSync } from "node:fs";

// The page reads artifacts/packet.json per request rather than per build, so a run that
// lands after `next build` still shows up when served. A prerendered snapshot silently
// pinned to whatever the packet held at build time.
export const dynamic = "force-dynamic";
import { resolve } from "node:path";
import { SponsorCard } from "../components/sponsor-card";

/**
 * The run's packet if there is one, the empty template otherwise.
 *
 * Walk toward SKILL.md so this works when cwd is scripts/dashboard (cloned package)
 * or a parent Opulent workspace that holds artifacts/.
 */
function loadPacket() {
  const seen = new Set();
  const candidates = [];
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const packet = resolve(dir, "artifacts/packet.json");
    if (!seen.has(packet)) {
      seen.add(packet);
      candidates.push(packet);
    }
    if (existsSync(resolve(dir, "SKILL.md"))) {
      candidates.push(resolve(dir, "references/templates/packet.template.json"));
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
  }
  return {};
}

/**
 * The run dashboard.
 *
 * It reads the packet the run produces. Shipped, it reads the empty template, so the
 * page renders its own empty states rather than a demonstration built from data nobody
 * gathered. Point it at the filled packet and the same sections populate.
 *
 * Layering follows references/dashboard-brief.md: the decision layer first, the audit
 * layer collapsed beneath it. Nothing proposed or blocked is ever styled as verified.
 */
export default function Home() {
  const packet = loadPacket();
  const sponsors = packet.sponsors ?? [];
  const excluded = packet.excluded ?? [];
  const operations = packet.context_operations ?? [];
  const messages = packet.messages ?? [];
  const scope = packet.scope ?? {};
  const gates = (packet.open_gates ?? []).filter((g: { state?: string }) => g.state !== "resolved");
  const festival = packet.festival ?? {};
  const empty = sponsors.length === 0;

  return (
    <main>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="site-header shell">
        <a className="wordmark" href="#top" aria-label="Opulent home">
          <span className="wordmark-mark">O/</span>
          <span>OPULENT SIGNAL ROOM</span>
        </a>
        <div className="header-meta">
          <span>LIST → DOSSIER → PITCH</span>
          <span className={packet.source_mode ? "live-dot live-success" : "live-dot"}>
            {packet.source_mode ?? "AWAITING RUN"}
          </span>
        </div>
      </header>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span>Context.dev</span> / sponsor sourcing</div>
        <h1>Evidence before<br /><em>enrichment.</em></h1>
        <div className="hero-deck">
          <p>
            {packet.objective ??
              "One sponsor target, taken as far as the evidence allows, with every field carrying the page it came from."}
          </p>
        </div>
        <div className="hero-rule dither-rule" aria-hidden="true" />
      </section>

      <section className="scope-strip shell" aria-label="Run scope">
        <div><span>01 / ROWS IN</span><strong>{scope.rows_in ?? "—"}</strong><small>client list</small></div>
        <div><span>02 / DRAFTABLE</span><strong>{scope.draftable ?? "—"}</strong><small>past both gates</small></div>
        <div><span>03 / CALLS</span><strong>{operations.length}</strong><small>ledgered</small></div>
        <div><span>04 / OPEN GATES</span><strong>{gates.length}</strong><small>unresolved</small></div>
      </section>

      {empty ? (
        <section className="profiles shell">
          <div className="section-heading profile-section-heading">
            <div><span className="kicker">No run yet</span><h2>This packet is empty.</h2></div>
            <p>
              Load the client list, choose a target, and fill the packet. Every section below
              renders from that file — the page states what it does not have rather than
              standing in for it.
            </p>
          </div>
        </section>
      ) : null}

      {sponsors.length ? (
        <section className="profiles shell">
          <div className="section-heading profile-section-heading">
            <div><span className="kicker">Sponsor</span><h2>One target, ten fields.</h2></div>
            <p>Each field shows its own state. Unknown is an answer, and it says what would resolve it.</p>
          </div>
          <div className="profile-grid">
            {sponsors.map((s: Parameters<typeof SponsorCard>[0]["sponsor"], i: number) => (
              <SponsorCard key={s.id ?? i} sponsor={s} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      {excluded.length ? (
        <section className="profiles shell">
          <div className="section-heading profile-section-heading">
            <div><span className="kicker">Refused at the gate</span><h2>{excluded.length} row(s) excluded.</h2></div>
            <p>Shown, not hidden. What the gate refused is part of what the gate is worth.</p>
          </div>
          <div className="ledger-list">
            {excluded.map((row: { company?: string; category?: string; reason?: string }, i: number) => (
              <article key={`${row.company}-${i}`}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div><strong>{row.company}</strong><code>{row.category}</code></div>
                <small>{row.reason}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {gates.length ? (
        <section className="profiles shell">
          <div className="section-heading profile-section-heading">
            <div><span className="kicker">Open gates</span><h2>{gates.length} unresolved.</h2></div>
            <p>
              What the run could not answer, and what would answer it. A demonstration that
              hides these reads as finished work rather than as the bounded pass it is.
            </p>
          </div>
          <div className="ledger-list">
            {gates.map((g: { gate?: string; state?: string; note?: string }, i: number) => (
              <article key={g.gate ?? i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div><strong>{g.gate}</strong><code>{g.state}</code></div>
                <small>{g.note}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {festival.attendance_state === "disputed" ? (
        <section className="profiles shell">
          <div className="section-heading profile-section-heading">
            <div><span className="kicker">Withheld</span><h2>Attendance is disputed.</h2></div>
            <p>
              Two client figures that do not reconcile and do not measure the same thing. No
              attendance number appears in any draft until the client states one.
            </p>
          </div>
          <div className="ledger-list">
            {(festival.attendance_claims ?? []).map((c: { value?: string; source?: string; source_date?: string }, i: number) => (
              <article key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div><strong>{c.value}</strong><code>{c.source}</code></div>
                <small>{c.source_date}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {messages.length ? (
        <section className="profiles shell">
          <div className="section-heading profile-section-heading">
            <div><span className="kicker">Drafted outreach</span><h2>{messages.length} message(s), unsent.</h2></div>
            <p>Every claim traces to a dossier field. Automated checks show what passed and what was excluded.</p>
          </div>
        </section>
      ) : null}

      <section className="operation-ledger shell">
        <div className="section-number">02</div>
        <div className="ledger-main">
          <span className="kicker">Operation ledger</span>
          <h2>Every call, its status, its receipt.</h2>
          {operations.length === 0 ? (
            <p>No operations recorded yet.</p>
          ) : (
            <div className="ledger-list">
              {operations.map((op: { sponsor_id?: string; capability?: string; endpoint?: string; status?: string; receipt?: unknown }, i: number) => (
                <article key={`${op.capability}-${i}`}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div><strong>{op.capability}</strong><code>{op.endpoint}</code></div>
                  <span className={`status ${op.status === "executed" ? "status-executed" : "status-blocked"}`}>
                    {op.status ?? "proposed"}
                  </span>
                  <small>{op.receipt ? "Receipt saved" : "No receipt"}</small>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="truth-strip">
        <div className="shell truth-inner">
          <span>TRUTHFUL DEFAULT</span>
          <p>
            A call is executed only with an HTTP response and a stored receipt. Everything else
            reads as proposed, blocked, or failed — never as a softer shade of success.
          </p>
        </div>
      </section>

      <footer className="shell">
        <div><span className="wordmark-mark">O/</span><strong>OPULENT</strong></div>
        <p>Sponsor sourcing showcase · Evidence-safe by construction</p>
        <p>{packet.generated_at ? `Generated ${String(packet.generated_at).slice(0, 10)}` : "Not yet generated"}</p>
      </footer>
    </main>
  );
}
