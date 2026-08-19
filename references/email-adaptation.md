# Email adaptation

Turning the dossier and the deck into an email. The dossier is written to be complete;
the email is written to be read in a second by someone who did not ask for it. This file
covers what to keep, what to cut, and what the email has to add that neither source
holds.

Adapted from the `email-adaptation` skill in
[vercel-labs/marketing-team-eve-template](https://github.com/vercel-labs/marketing-team-eve-template/tree/main/agent/subagents/email/skills/email-adaptation),
scoped to sponsorship outreach.

## Load this before

- Turning `artifacts/dossier.json` into `outreach.personal_note`, `fit_point`, and
  `activation_idea`
- Deciding whether a deck fact belongs in the email or stays in the dossier
- Any follow-up message after the first touch

## A deck answers a question nobody asked yet

The deck exists to be walked through by someone who already agreed to look. It builds an
argument across nine slides, in a promotional register, for a reader who has committed
attention. The email interrupts a stranger.

So the deck's job is to be complete and the email's job is to earn fifteen minutes.
Almost nothing survives the trip intact, and the pieces that do survive get rewritten in
the sender's register on the way. `references/campaigns/<key>/banned-phrases.json` exists
because the deck's own best sentences are the email's worst ones.

## Decide the email's job before you cut anything

1. **What is the one action?** A short call, booked through the link. Not a deck
   download, not a forward, not a reply with questions. One.
2. **What does this reader already know?** Nothing about us. They know their own brand,
   their own last activation, and their own category. That is the ground the email
   stands on, which is why the first line is theirs and not ours.
3. **What happens if they do nothing?** Nothing. There is no deadline we can honestly
   state, and the packet holds availability unknown. An email with no real urgency has
   to be worth reading on relevance alone, so the relevance has to be real.

## The five moves

The pitch is five moves in a fixed order. Each is one or two sentences, and each has a
field behind it in the dossier.

| Move | Field | What it does |
| --- | --- | --- |
| 1. Their world | `outreach.personal_note` | Opens on what they did, in the first person, and says why that made him write |
| 2. The property | campaign packet | Name, what it is, when, where, one sentence |
| 3. Why them | `outreach.fit_point` | The audience or category overlap that is theirs and not everyone's |
| 4. The idea | `outreach.activation_idea` | One concrete thing they could own onsite, named from the deck's zones |
| 5. The ask | sender identity | Are you open to a quick call, then the link, then his name |

Move 4 is the one a generated draft usually drops, and it is the move both of Bob's
samples make. Without it the email describes a festival and asks for a call. With it the
email is about the recipient.

## What to cut

Cutting for email is not proportional trimming. Whole categories go.

- **Setup and background.** The history of the property, the promoter's tenth year, the
  six pillars. If the reader wants the story they will ask on the call.
- **Anything hedged at length.** Nuance survives on a page and dies in a preview pane. A
  claim that needs three sentences of qualification is either stated plainly or dropped.
- **Supporting arguments after the first.** The deck makes the partner case four ways.
  The email makes it once.
- **Inventories.** Six zones, five tiers, six audience interests. Name the one that
  belongs to this sponsor and leave the rest in the dossier.
- **The evidence apparatus.** Source URLs, observation dates, confidence bands, field
  states. They are how we know the sentence is true; they are not part of the sentence.

What survives: the dated thing they did, the property in one line, the overlap that is
theirs, one idea, one ask.

## What to add

Adaptation is not only subtraction. The email needs three things neither the deck nor
the dossier holds.

- **A reason it arrived now.** Their activation, in his words, connected to why he is
  writing this week. Unexplained mail reads as bulk.
- **Subject and preview text**, written as a pair. See `email-style.md`.
- **A person.** The deck has no author. The email is signed, and it reads as though one
  man wrote it to one person, because he did.

## Keep the source honest

The dossier's fields carry their evidence state, and compression is where that gets
lost.

- **Do not harden a hedge.** "Sampled at one comparable festival in June" does not
  become "sponsors festivals nationwide." This is the easiest error to make between
  dossier and draft, and the one a recipient can puncture in a single reply.
- **Do not invent a specific to tighten a sentence.** A number, a date, a venue, or a
  lineup that is not in the packet does not enter the email because it would read
  better. Sample 2 in `knowledge/agency/writing-samples.md` names five artists the decks
  do not; that sentence is preserved as his and cannot be reproduced by us.
- **Do not upgrade the offer.** Naming a tier is allowed, implying it is available is
  not, and `lint_pitch.mjs` checks any dollar figure against the rate card.
- **When you cut something load-bearing, say so** in the run's record rather than
  quietly shipping a different pitch than the evidence supports.

## The follow-up is a different email

A second touch is not the first one resent. It carries one new thing, it is shorter than
the first, and it does not repeat the pitch. If nothing has changed and there is nothing
new to say, the honest move is not to send it.
