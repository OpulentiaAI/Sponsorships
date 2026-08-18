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

Four blocks, in order.

1. **Their activation.** One or two sentences. Dated, sourced.
2. **The festival.** Name, dates, venue, market. Facts from the packet.
3. **Who is on site.** The audience block, verbatim from the packet — ages, region, household income.
4. **One action.** Fifteen minutes, on the sender's own scheduling link.

What stays out:

- **Any attendance number.** The client gave two figures that do not reconcile and that measure different things. A number a sponsor can puncture in one question costs more than the number was worth.
- **Any availability claim.** The offer sheet shows the deck's own rate card and may highlight one tier verbatim — that is the client's published price, not ours. Which tiers remain open is unknown, so nothing implies a tier is available or scarce.
- **Superlatives about the festival.** The first edition earns its record in September; a track record claimed before then invites the one check that finds it missing.
- **Any implication the sponsor already knows us, or that someone referred us.**

## House voice

Plain, specific, short. The client's own sample outreach is the register to match: it introduces the event, states the offer, and asks for fifteen minutes. It does not perform enthusiasm.

- Second person. Their name, their activation, their category.
- One idea per sentence.
- Numbers over adjectives, but only numbers the packet supports.
- No em dashes, no "excited to," no "I hope this finds you well," no "reaching out."
- Subject and preview text written last, together, and the preview extends the subject rather than repeating it.

Full word-level rules are in `writing-quality.md`, and both swap tables are vendored beside it.

## Sending

Nothing sends. `send_state` is `draft_only_not_sent` and `sender_authority` is `unconfirmed` until the client names the sending account and the approval rule.

This is not caution for its own sake. The pitch is signed by the client, from the client's company, to a real decision maker. An unapproved send in that shape is the client's reputation, not ours.
