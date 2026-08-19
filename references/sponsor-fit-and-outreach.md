# Sponsor fit and outreach

How a target becomes a fit band, how a fit band becomes a reason, and how a reason becomes a pitch.

## Fit is a claim about them, not about us

The festival's qualities are constant across every target on the list. They cannot explain why this company. Anything in the fit rationale that would read identically for Liquid Death and Drury Hotels is not a rationale.

Five inputs, in the order they carry weight:

1. **Dated activation.** They sponsored, activated at, or sampled into an event, with a date inside the year. This is the only input strong enough to open a pitch on.
2. **Audience overlap, stated.** Their own site or media kit names an audience that intersects 24-34, Midwest, $60k-$140k. Their words, not an inference from the product.
3. **Regional presence.** An address, a store list, a distributor, a market they name. St. Louis beats Missouri beats Midwest beats national.
4. **Category fit.** The client's own list already assigns one. It is the weakest input, because it is the one the client could produce without us.
5. **Scale.** Evidence of what they spend, banded, never a guess.

## Bands

| Band | Requires |
| --- | --- |
| `strong` | Dated activation at a comparable event, plus regional presence or stated audience overlap |
| `plausible` | Dated activation anywhere, or stated overlap plus regional presence |
| `category_only` | Category fit and nothing dated. Research further before drafting |
| `blocked` | Compliance gate, or a competitor conflict the page itself names |

Every band carries counter-evidence, and the validator enforces these rules rather than trusting them: `strong` fails validation without a retrieved activation plus retrieved regional presence or stated audience overlap. A `strong` with nothing against it has not been examined. The most common counter-evidence here is a competitor already holding the category at a comparable festival — that is not a reason to stop, but it is a reason the first line has to change.

## The reason

One reason. Dated. Theirs.

Rank, and take the highest available:

1. Dated activation at a comparable event — a festival, a camping event, a music property.
2. Dated activation anywhere — a marathon, a food hall, a college tour.
3. Dated regional expansion into the market.
4. Category fit alone. This one does not clear the gate in step 5, and that is deliberate.

The reason goes in the recipient's world and stays there. It states what they did, when, and where it was read. It does not compliment them for doing it, and it does not tell them what it means about their brand — they know, and a stranger explaining their own strategy back to them is the tell that this was generated.

## The pitch

Five short moves, in order.

1. **Their activation.** One or two sentences in Bob's voice. Keep the source URL in the dossier rather than the email.
2. **The festival.** Name, dates, venue, and market in one sentence.
3. **One useful fit point.** Choose the audience or activation detail that helps this sponsor. Do not dump every field.
4. **The offer.** Shape a package around the sponsor's goals. Name one exact tier only when it helps.
5. **One action.** Ask, "Are you open to a quick call?" Follow it with the verified scheduling link.

What stays out:

- **Any attendance number.** The client gave two figures that do not reconcile and that measure different things. A number a sponsor can puncture in one question costs more than the number was worth.
- **Any availability claim.** The offer sheet shows the deck's own rate card and may highlight one tier verbatim — that is the client's published price, not ours. Which tiers remain open is unknown, so nothing implies a tier is available or scarce.
- **Superlatives about the festival.** The first edition earns its record in September; a track record claimed before then invites the one check that finds it missing.
- **Any implication the sponsor already knows us, or that someone referred us.**
- **Internal evidence formatting.** Source links, field labels, draft headings, stage inventories, and the full rate card stay in the dossier.
- **A generic receipt footer.** Do not add "You are receiving this because" or a stock reply-to-opt-out paragraph.

## House voice

Plain, specific, short. The client's own sample outreach is the register to match: it introduces the event, states the offer, and asks for a quick call. It does not perform enthusiasm.

- Second person. Their name, their activation, their category.
- One idea per sentence.
- Numbers over adjectives, but only numbers the packet supports.
- No em dashes, no "excited to," no "I hope this finds you well," no "reaching out."
- Subject and preview text written last, together, and the preview extends the subject rather than repeating it.

Full word-level rules are in `writing-quality.md`, and both swap tables are vendored beside it.

## Sending

Before drafting, `send_state` is `pending_draft`. A Markdown message that passes the automated delivery checks becomes `ready_to_send`, `review_state` becomes `not_required`, and `sender_authority` is `authorized`.

Send through the campaign owner's connected Gmail as soon as a recipient route is present. A missing route, credential, or transport is an operational limitation. It does not create a review, approval, or authentication pause. Continue all other work and report the obstacle only at the end through `message_user` and the single AgentMail report.
