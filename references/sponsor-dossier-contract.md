# Sponsor dossier contract

The field envelope, the ten required fields, and the rules `scripts/validate_packet.mjs` enforces.

## The envelope

Every field in `required_fields` carries the same six keys:

```json
{
  "value": null,
  "state": "pending_retrieval",
  "confidence": "Unknown",
  "source": null,
  "source_url": null,
  "observed_at": null
}
```

`state` is one of `pending_retrieval`, `retrieved`, `unknown`, `baseline`. A field that ended `unknown` carries a `reason` alongside, saying what would have to be true for it to resolve.

`confidence` is `Verified`, `Estimated`, or `Unknown`. `Verified` without a `source_url` fails validation.

## The ten

| Field | Filled from | Resolves when |
| --- | --- | --- |
| `category_fit` | Client list + `/brand/retrieve` | Always; the client list supplies a floor |
| `activation_history` | The signal brief, only when `reason_eligible` | A dated, quoted activation page is read |
| `audience_overlap` | The company's own stated audience | Their site or media kit names an audience |
| `regional_presence` | `/brand/retrieve` address, `/web/search` | An address or named market is retrieved |
| `budget_signal` | Dated activation at a known scale | A page states or implies a spend band |
| `decision_maker` | `/people/retrieve` | An exact profile URL is supplied by the client or found in a cited public search result, and profile retrieval verifies it |
| `decision_maker_title` | `/people/retrieve` | Depends on `decision_maker` |
| `contact_route` | A verification provider | Never, in showcase mode. Stays `null` |
| `compliance_flags` | the campaign's `exclusions.csv` | Always; empty is a real answer |
| `changes_since_last` | A prior accepted run | Second run onward |

All ten appear whatever the outcome. A field missing from the packet is worse than one present and `unknown`: the reader cannot tell "we looked and found nothing" from "we never looked."

`discovery_route` records the sponsorship title and date, the cited role exemplar, the nearest title comparator from general search, and the profile resolution state. A search result can fill this extension as a candidate. It cannot fill `decision_maker` until `/people/retrieve` succeeds.

When a retrieved person now works elsewhere, `discovery_route.origin` is `person_destination`. The source sponsor, source sponsorship title, date, and URL stay in the `source_*` fields. They explain why the person was followed. They do not fill `activation_history` for the current employer. That field still needs separate dated and quoted evidence about the current employer.

## Gates

`gates.draft_gate` is `open`, `blocked_compliance`, or `blocked_client_decision`. Blocked targets may be researched and may appear in the packet. They may not carry a subject line or a draft path, and the email step refuses them.

The two blocks answer different questions. Compliance blocks a category the client's own email flagged (cannabis: age and activation limits, undraftable until the client states the rule). A client-decision hold blocks one company until the client answers a question only they can (NUTRL, until the Anheuser-Busch entry point is picked). Alcohol categories are draftable: the client's list included them without restriction, and their age-gating is an activation-form note, not a draft ban — the distinction the cannabis email drew.

`gates.exclusion_check` is `clear` or `unverified_against_rule`. It is `unverified_against_rule` for every target while the client's exclusion list and the three sponsors already in motion remain unsupplied. The validator will not accept any other value.

This is the field most likely to be quietly flipped to `clear` to make a run look finished. Pitching a sponsor already mid-negotiation with the client is the most expensive mistake available here, and it is invisible from our side.

## Fit

`fit.band` is `strong`, `plausible`, `category_only`, or `blocked`. `fit.rationale` states the case. `fit.counter_evidence` states the case against, and a band with an empty counter-evidence field has not been examined.

Bands and their requirements are in `sponsor-fit-and-outreach.md`.

## Outreach

`outreach.reason_to_engage` needs `reason_source_url`. `outreach.send_state` is always `draft_only_not_sent`. `outreach.sender_authority` is `unconfirmed` until the client names the sending account.

`outreach.package_named` is a rate-card tier verbatim, or null. The rate card is the deck's own (slide 7) and may be shown and named; availability was never supplied and is never implied. The validator checks the tier name on the sponsor record and on every derived message.

A rendered draft writes `draft_html_path` and `draft_text_path` into the dossier, and the packet derives `messages[]` from them — one artifact carries the whole run.

## What the validator refuses

Structure, in every mode:

- A required field missing, or present with no `state`.
- `confidence: Verified` with no `source_url`.
- A negative value on an activity field without `state: retrieved`.
- `contact_route` with a non-null value.
- A draft path or subject line on any blocked target.
- A named package that is not a rate-card tier, on the sponsor or in a message.
- `already_in_motion_state` set to anything but `clear` or `unverified_against_rule` — and `clear` only once the client's exclusion gate is resolved.
- `send_state` other than `draft_only_not_sent`.
- An `executed` operation with no receipt.
- A disputed attendance figure inside a drafted message.
- A bearer token or API key anywhere in the packet.

The full gather, in default mode (`--partial` skips only this block):

- An open target with `fit.band` or `fit.rationale` unwritten.
- A `strong` or `plausible` band without its evidence rule met, or without counter-evidence.
- Missing `reason_to_engage`, `reason_source_url`, `subject`, or `preview_text`.
- No rendered draft attached, or draft paths pointing at files that do not exist.
