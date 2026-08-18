# Evidence policy

What may be claimed, from what, and where a claim stops.

## Three different claims

Keep them apart. Collapsing them is the failure this policy exists to prevent.

1. **Identity claim** — the supplied domain and the retrieved brand refer to the same company the client meant.
2. **Attribute claim** — a specific field (category, address, industry codes, description) is what the retrieved record says it is, on the date it was read.
3. **Activity claim** — a dated public signal shows this company sponsoring, activating, or expanding inside the recency window.

An identity claim never implies an activity claim. A company that sells an energy drink has not thereby sponsored a festival. A parent company's activation is not a subsidiary's, and a distributor's is not a brand's.

## Identity

- Only an **exact bare domain** enters the run. A company name is not an identity: "Head Change" names several unrelated businesses, and "Anheuser-Busch or its St. Louis distributor" names two entities with two sponsorship desks.
- A decision maker enters only on an **exact LinkedIn profile URL**. A name and a company is not an identity, and the wrong match here sends a real pitch to the wrong desk.
- Where the client list and the public record disagree — a different legal name, a different market — record the variance and keep both sides in the record. The divergence itself is a finding.
- Confidence is stated per subject: `high`, `medium`, or `low`. A `low` confidence without a recorded variance is a validation failure, not a judgement call.

## Attributes

- Every field carries its source, source URL, and observation date. A field with `confidence: Verified` and no URL is invalid.
- Verbatim beats paraphrase for headline and summary text. Paraphrase is where drift starts.
- Absence is a finding. `unknown` is a real answer and is always preferable to an inference presented as a fact.

## Activity

- `activation_history`, `budget_signal`, and every other activity field require a **dated** signal inside the recency window.
- Absence downgrades to `unknown`. It never implies `false`. A company with no findable sponsorship has not been shown to lack a sponsorship budget.
- Company size is not evidence of activity. Neither is category, revenue, or the fact that competitors sponsor.
- Only a dated activation can carry the reason to engage; an undated one is context, because it cannot separate a live budget from one that closed in 2019.

## Contact data

- Contact values come only from a verification provider, never from inference or pattern.
- A pattern-derived address is `candidate` and stays out of every downstream artifact until verification promotes it.
- Contact values live in the private run record. The published artifact carries the state, not the value.

## Client-supplied facts

The festival packet is client-supplied, and client-supplied is not verified. It carries the same envelope as anything else.

Where two client figures conflict, the field is `disputed` and carries both claims with their dates. It stays disputed until the client states one figure, and outreach draws only on settled fields. The attendance figure is the live example: "more than 20,000 across three days" and "about 7,500 per day" came from the same client four days apart and measure different things.

Where a required input was named and never delivered — the sponsorship inventory, the category rules, the sponsors already in motion — the dependent field is `unsupplied` and every downstream claim that would have used it is withheld. A target is published as clear of a rule only once the rule's contents are in hand.

## Access

- Public pages only. Nothing behind a login, a CAPTCHA, a paywall, or an email gate.
- An interstitial or challenge ends that read, reported as `blocked` with what was observed. The block itself is the finding.
- The activation page is read as-is — navigation and reading only, the page left exactly as found.

## Claims about companies and people

- An activation is company-level. It says nothing about any individual there — not that they authorised it, ran it, or would authorise another.
- Appearing on a client target list is not interest, intent, or any prior relationship. The list came from a language model and a person's judgement, and neither is contact.
- Relationship language is precise or absent. A cold pitch says it is cold by saying nothing that implies otherwise.

## Operation status

A call is `executed` only with an HTTP response **and** a stored receipt. Otherwise it is `proposed`, `blocked_missing_credentials`, `blocked_endpoint_access`, or `failed` — in that vocabulary, precisely. Fallback work is never described as the capability it replaced, and a proposed operation is never rendered as a completed one.

A drafted message is described as exactly that: drafted, awaiting a named approver.

## Publication

Anything published carries only what the evidence supports. Where a target's own material is used — a logo, palette, screenshot, or description — it is used to present that company inside our own working artifact, not to imply their participation in, sponsorship of, or endorsement of the festival.

A dashboard showing a sponsor's brand next to a festival they have not agreed to sponsor is the most likely way this run gets misread. The fit band and the gate state are shown on the same card for that reason.
