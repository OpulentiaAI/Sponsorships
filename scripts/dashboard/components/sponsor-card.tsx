/**
 * The sponsor card. One target, its fit band, its gates, and its ten fields.
 *
 * Field states are rendered as themselves. A field that came back `unknown` shows as
 * unknown with the reason attached, because the reader has to be able to tell "we looked
 * and found nothing" from "we never looked" — and a card that renders both as a blank
 * cell removes exactly that distinction.
 *
 * The gate row sits next to the brand, deliberately. A sponsor's logo beside a festival
 * they have not agreed to sponsor is the most likely way this page gets misread.
 */

type Field = {
  value?: unknown;
  state?: string;
  confidence?: string;
  source_url?: string | null;
  reason?: string;
};

type Sponsor = {
  id?: string;
  company?: string;
  domain?: string;
  client_list?: { category?: string | null; region_fit?: string | null };
  gates?: { draft_gate?: string; draft_gate_reason?: string | null; exclusion_check?: string };
  fit?: { band?: string | null; rationale?: string | null; counter_evidence?: string | null };
  required_fields?: Record<string, Field>;
};

const FIELD_ORDER = [
  "category_fit", "activation_history", "audience_overlap", "regional_presence",
  "budget_signal", "decision_maker", "decision_maker_title", "contact_route",
  "compliance_flags", "changes_since_last",
];

const label = (k: string) => k.replace(/_/g, " ");

function stateClass(state?: string) {
  if (state === "retrieved") return "status status-executed";
  if (state === "baseline") return "status";
  return "status status-blocked";
}

export function SponsorCard({ sponsor, index }: { sponsor: Sponsor; index: number }) {
  const fields = sponsor.required_fields ?? {};
  const blocked = sponsor.gates?.draft_gate === "blocked_compliance";
  const retrieved = FIELD_ORDER.filter((k) => fields[k]?.state === "retrieved").length;

  return (
    <article className={`profile-card profile-${index + 1}`}>
      <div className="profile-topline">
        <span className="profile-index">S/{String(index + 1).padStart(2, "0")}</span>
        <span className={blocked ? "status status-blocked" : "status"}>
          {blocked ? "blocked · compliance" : sponsor.gates?.exclusion_check ?? "unchecked"}
        </span>
      </div>

      <div className="profile-heading">
        <div>
          <h3>{sponsor.company ?? "—"}</h3>
          <p>
            {sponsor.client_list?.category ?? "uncategorised"}
            {sponsor.domain ? ` · ${sponsor.domain}` : ""}
          </p>
        </div>
      </div>

      {sponsor.fit?.band ? (
        <p className="profile-summary">
          <strong>{sponsor.fit.band}</strong> — {sponsor.fit.rationale ?? "no rationale written"}
          {sponsor.fit.counter_evidence ? ` Against: ${sponsor.fit.counter_evidence}` : ""}
        </p>
      ) : (
        <p className="profile-summary">No fit band written yet. The scripts do not guess one.</p>
      )}

      {blocked ? (
        <p className="profile-summary">{sponsor.gates?.draft_gate_reason}</p>
      ) : null}

      <dl className="profile-facts">
        {FIELD_ORDER.map((key) => {
          const f = fields[key];
          const v = f?.value;
          const shown = v === null || v === undefined || (Array.isArray(v) && !v.length)
            ? (f?.state ?? "absent")
            : Array.isArray(v) ? v.join(", ") : String(v);
          return (
            <div key={key}>
              <dt>{label(key)}</dt>
              <dd>
                <span className={stateClass(f?.state)}>{shown}</span>
                {f?.state !== "retrieved" && f?.reason ? <small> {f.reason}</small> : null}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="profile-links">
        <span>{retrieved}/{FIELD_ORDER.length} retrieved</span>
        {sponsor.domain ? (
          <a href={`https://${sponsor.domain}`} target="_blank" rel="noreferrer">
            Site <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default SponsorCard;
