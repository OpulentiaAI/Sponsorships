# Bob's writing samples

The client's own cold outreach, supplied by him, preserved as received. This is the
register every sponsor email is written in. Read it before drafting, alongside
`trifecta-profile.md`.

These are samples, not templates. Copying one produces a generic email to a specific
person, which is the failure the discovery lane exists to avoid. What transfers is the
voice, the order of the moves, and the size of each move.

## Provenance

Supplied by Robert "Bob" Dittrich, Trifecta Marketing, received 2026-08-19. Scrubbed by
the client before sending: the recipient brand is replaced with `[Brand]` and the
activation options with a bracketed list. Nothing else is edited.

One character is reconstructed: sample 1 arrived with its opening `I` clipped in transit
(`’m working on securing sponsors…`). The `I` is restored. Every other character in both
samples, including the em dash, the en dashes, the line breaks, and the signature block,
is his.

## Sample 1

```
I’m working on securing sponsors for Nocturnal Valley, a new three-night music, arts and camping festival taking place September 24–26 at Astral Valley Art Park, approximately 45 minutes south of St. Louis.
Nocturnal Valley will bring a highly engaged electronic-music audience together for three stages, camping, wellness programming, art and community experiences.
Rather than a standard logo sponsorship, I see an opportunity for [Brand] to own a useful part of the attendee experience—such as [the hydration station/campground charging hub/recovery area/VIP lounge].
Would you have 15 minutes next week to discuss the audience, available assets and a concept tailored to [Brand]?
--
Bob Dittrich
773.706.4860
Book a :30 min meeting with me
https://calendly.com/robertdittrich48/30min
```

## Sample 2

```
I’m reaching out on behalf of Nocturnal Valley, a new three-day music, arts and camping festival taking place September 24–26 at Astral Valley Art Park, just outside St. Louis.
The festival will bring together a highly engaged electronic-music audience for three stages, immersive art, wellness programming, camping and community experiences. The lineup includes Daily Bread, G Jones, PEEKABOO, Skream, Caspa and more.
I believe [Brand] could be a strong fit, particularly through an experiential activation that enhances the attendee experience rather than simply providing logo exposure.
Would you have 15 minutes this week to learn more? I’d be happy to send the sponsorship deck and share a few activation ideas tailored to [Brand].
--
Bob Dittrich
773.706.4860
Book a :30 min meeting with me
https://calendly.com/robertdittrich48/30min
```

## What the samples teach

**He writes in the first person, and he says what he is doing.** "I'm working on
securing sponsors for Nocturnal Valley." "I see an opportunity." "I believe." No passive
construction, no institutional voice, no third-person description of a partnership
opportunity. A sentence that could have been written by a company rather than by a man
is the wrong register.

**The property arrives in one sentence, with the specifics attached.** Name, what it is,
when, where, and how far from the city the reader knows. Both samples do this in a
single sentence and never return to it.

**The audience is described, not sold.** "A highly engaged electronic-music audience"
plus what they are there for. No adjectives about the festival itself, no superlatives,
no attendance claim in either sample.

**The activation idea is the pitch.** Both samples make the same move: not a logo, a
part of the weekend the brand can own. Sample 1 names candidate assets. Sample 2 frames
it as experiential rather than logo exposure. This is the sentence that makes the email
about the recipient rather than about the festival, and it is the move most often
missing from a generated draft.

**The ask is small, specific, and singular.** Fifteen minutes, a named window, one
question mark, then the link. He offers to send the deck rather than attaching it.

**He signs as a person.** Name, direct line, a labeled scheduling link. No company
boilerplate, no receipt footer, no unsubscribe paragraph, no legal block.

**Length.** Four short paragraphs. Both samples are under 120 words before the
signature. A draft that runs longer is carrying something these do not.

## What does not transfer

The samples are the client's own writing, preserved intact. They are not lint-exempt
source material to copy from, and three things in them do not survive into a draft:

- **"Reaching out"** opens sample 2 and sits on the agency banned list in
  `banned-phrases.json`. His own sentence, still not ours to repeat.
- **The em dash** in sample 1 (`experience—such as`) and the en dashes in the dates.
  Drafts use a comma, a period, or "to". `scripts/lint_pitch.mjs` fails on an em dash.
- **The lineup** in sample 2. Neither deck names an artist, so the packet cannot source
  Daily Bread, G Jones, PEEKABOO, Skream, or Caspa. A draft claims no lineup until a
  campaign file supplies one. This is the clearest case in the repository of a client's
  own sentence outrunning the client's own evidence.

Two more differences are deliberate rather than accidental:

- **The ask.** The samples ask for fifteen minutes next week. The current close is "Are
  you open to a quick call?" followed by the verified link, which asks the same thing
  without promising a length the calendar link does not hold. The register is his; the
  wording is settled.
- **The bracketed asset list.** Sample 1 offers the reader four options because it is a
  template with no research behind it. A draft from this skill has a dossier, so it
  names one idea chosen for this sponsor instead of a menu.
