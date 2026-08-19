# Trifecta Marketing

The client. Everything in `references/knowledge/agency/` is theirs and persists across every campaign; everything under `references/campaigns/` is one property they are selling and swaps out per engagement.

## Who they are

Robert "Bob" Dittrich, Trifecta Marketing. About thirty years of sponsorship sales, working with ten to fifteen independent electronic music festivals — which is why this skill is built to repeat: Nocturnal Valley is the sample campaign, not the identity. His stated method before this engagement: ChatGPT for brand ideas, then researching companies and contacts by hand on LinkedIn. That is the baseline the discovery lane exists to beat.

Contact identity, scheduling link, and send policy live in `sender.json` beside this file. A message that passes the automated delivery checks may be sent without a separate review or approval step.

## The sender's register

The pitch goes out under Bob's name, and his own cold outreach sets the register. Two of his
emails are preserved verbatim in `writing-samples.md` beside this file. Read them before every
draft; everything below is what they encode.

He writes in the first person and says what he is doing. He introduces the property in one
plain sentence with the specifics attached. He describes the audience without selling it. Then
the move that carries the pitch: not a logo, one useful part of the weekend the brand could
own. He asks for a short call and links to his calendar. He signs with his name and his direct
line.

No throat-clearing, no enthusiasm performed on the reader's behalf. Thirty years of sponsorship
sales sound like someone with nothing to prove, and the draft has to sound like him.

**Write in this register:**

- First person. "I saw", "I'm working on securing sponsors for", "I think". A sentence that
  could have been written by a company rather than by a man is the wrong register.
- Their name, their activation, their category — the email starts in the recipient's world, and
  the reason it opens on comes from the dossier with its date. A greeting name comes only from a
  retrieved profile; without one, open to the company's sponsorship team. An invented name is the
  one shortcut that turns an honest cold email into a dishonest one.
- One idea per sentence. Facts from the campaign's `deck-facts.md` or the dossier, nothing else.
- Zone and tier names verbatim from the campaign deck: a named slot at a named stage is
  checkable; "a great partnership opportunity" is not.
- One concrete activation idea, chosen for this sponsor. Both samples make this move and a
  generated draft usually drops it, which is what leaves an email describing a festival to
  someone who did not ask about one.
- The offer move is Bob's: fit the package to their goals, not sell them the biggest tier.
- One ask: "Are you open to a quick call?" Follow it with the verified Calendly link and sign as
  a person.

The samples are his writing, preserved as received, which means they are not a source to copy
from. "Reaching out" opens sample 2 and is still on the banned list. The em dash in sample 1
still fails lint. The five artists named in sample 2 appear in neither deck and cannot be
claimed by us. `writing-samples.md` marks each one where it appears.

## The machine-checkable half

`banned-phrases.json` beside this file holds the agency-wide bans — phrases that never appear in any pitch Trifecta signs. Each campaign adds its own `banned-phrases.json` for that deck's promotional register (correct in the brochure, banned in the email). `scripts/lint_pitch.mjs` enforces both lists plus the no-attendance rule, the em-dash ban, the single ask, and tier fidelity; `npm run email` runs it after every Markdown draft. Exit 1 is a finding, and editing the pitch to pass is the job.

Word-level swap tables: `references/writing-quality.md` and the two vendored lists beside it.
Inbox mechanics, the deck-to-email trip, and the editing passes: `references/email-style.md`,
`references/email-adaptation.md`, and `references/content-editing.md`.

## New campaign checklist

A new engagement is data, never code: create `references/campaigns/<key>/` with the property's deck(s) in `sources/`, `festival-packet.json` (facts with per-field sources; disputes stay disputed), `deck-facts.md` (claims cited to slides), `targets.csv` and `exclusions.csv` (the property's list and rules), `comparable-events.json` (the discovery universe for that property's ICP), and `banned-phrases.json` (that deck's register words). Then the same eight commands run unchanged.
