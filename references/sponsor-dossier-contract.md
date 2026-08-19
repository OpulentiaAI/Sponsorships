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
| `contact_route` | A sourced recipient route or connected email channel | A concrete destination is available; otherwise it stays `unknown` |
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

`outreach.reason_to_engage` needs `reason_source_url`. Before drafting, `outreach.send_state` is `pending_draft`. A Markdown message that passes delivery is `ready_to_send`, with `review_state: not_required` and `sender_authority: authorized`.

`outreach.package_named` is a rate-card tier verbatim, or null. The rate card is the deck's own (slide 7) and may be shown and named; availability was never supplied and is never implied. The validator checks the tier name on the sponsor record and on every derived message.

`outreach.personal_note` is the sponsor-specific opening in Bob's voice, written in the first person, and may not copy `reason_to_engage` verbatim. `outreach.fit_point` is one relevant audience or category sentence chosen for this sponsor. `outreach.activation_idea` is one concrete thing this sponsor could own onsite, named from the campaign's zones, elements, or tiers. All three are required before delivery, and all three are sponsor-specific: a draft that would read the same for another target on the list has not written them.

A draft writes `draft_markdown_path` and `draft_gmail_html_path` into the dossier, and the packet derives `messages[]` from them. Markdown is the authored record. The small inline-styled HTML file is the Gmail transport body. The authorship and evidence contract applies to both.

## What the validator refuses

Structure, in every mode:

- A required field missing, or present with no `state`.
- `confidence: Verified` with no `source_url`.
- A negative value on an activity field without `state: retrieved`.
- A draft path or subject line on any blocked target.
- A named package that is not a rate-card tier, on the sponsor or in a message.
- `already_in_motion_state` set to anything but `clear` or `unverified_against_rule` — and `clear` only once the client's exclusion gate is resolved.
- A Markdown message whose `send_state` is not `ready_to_send`, whose `review_state` is not `not_required`, or whose sender authority is not `authorized`.
- An `executed` operation with no receipt.
- A disputed attendance figure inside a drafted message.
- A bearer token or API key anywhere in the packet.

The full gather, in default mode (`--partial` skips only this block):

- An open target with `fit.band` or `fit.rationale` unwritten.
- A `strong` or `plausible` band without its evidence rule met, or without counter-evidence.
- Missing `reason_to_engage`, `reason_source_url`, `personal_note`, `fit_point`, `activation_idea`, `subject`, or `preview_text`.
- No Markdown draft or Gmail HTML body attached, or a draft path pointing at a file that does not exist.
