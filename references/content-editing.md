# Content editing

The drafting discipline: how to ground a draft before writing it, and how to edit it in
passes afterwards. This is judgment work. `lint_pitch.mjs` checks the half a machine can
check, and everything in this file is the half it cannot.

Adapted from the `content-marketer` subagent's working method and its `content-editing`
skill in
[vercel-labs/marketing-team-eve-template](https://github.com/vercel-labs/marketing-team-eve-template/tree/main/agent/subagents/content-marketer),
scoped to one sponsor email.

## Load this before

- Writing `outreach.personal_note`, `fit_point`, `activation_idea`, `subject`, or
  `preview_text`
- The read-through after `npm run email` and before the send

## Ground the draft before writing it

Read these in this order, every run, before the first sentence:

1. The stored knowledge entries for this campaign, sponsor, and any prior thread. Past
   outreach and replies change what this email should say.
2. `knowledge/agency/writing-samples.md` — Bob's own two emails, verbatim.
3. `knowledge/agency/trifecta-profile.md` — who he is and the four moves he makes.
4. `sponsor-fit-and-outreach.md` — how the reason and the pitch are built.
5. `email-style.md` and `email-adaptation.md` — the inbox constraints and the five moves.
6. `writing-quality.md` — the word-level rules.

Three habits matter more than the reading order:

- **Load the guidance before drafting, not after something reads wrong.** A draft written
  from memory of these files and corrected afterwards keeps the shape it was born with.
- **When the dossier is too thin to write from, say so instead of inventing.** An email
  whose reason to engage is a category guess is worse than a target left undrafted, and
  the fit bands exist to make that call for you.
- **Carry the caveats forward.** A field that arrived hedged, dated, or scoped to one
  market keeps its qualifier in the sentence. Flattening a hedge between the dossier and
  the draft is the single easiest mistake in this pass.

## Edit in passes

Re-reading a draft looking for everything at once finds nothing. Each pass below asks
one question. After a pass, check you have not broken an earlier one.

1. **Does it make sense?** One idea per sentence. Every pronoun has one obvious
   referent. No sentence needs the dossier open beside it to parse. Fix structure before
   wording.
2. **Does it sound like Bob?** One register from the greeting to the signature. The
   place it slips is the middle, where a draft drifts into brochure language between the
   opening and the ask. Check it against the samples, not against your own defaults.
3. **Does the reader care?** Ask what this recipient gets from each sentence. A festival
   detail with no consequence for their brand fails this pass: connect it or cut it.
   "It is context" usually means it is too long.
4. **Is it proven?** Every claim traces to the dossier, the campaign's `deck-facts.md`,
   or the packet. Mark anything that traces to none of them. You are finding them here,
   not verifying them: flag what needs a source rather than softening it into vagueness.
5. **Is it specific?** "A great audience" becomes the age band and the region the packet
   supports. "Festival experience" becomes a named zone. If the specific is not
   available, drop the claim rather than keeping the vague version.

Then the mechanical pass: break sentences over about 25 words, replace passive voice
where there is a real actor, cut hedges ("just", "simply", "really"), and check each
paragraph opens on its own point.

## The three checks the lint will not make

- **Does the first line sound like a person talking?** Read it aloud on its own. A
  dossier field with an inference bolted on the end fails: "818 Tequila ran its fourth
  annual 818 Outpost during Coachella 2026, which made me think 818 may be open to
  another thoughtful festival experience" is a research finding read back at its subject.
  The fix is the first person and a reason he is writing: "I saw 818 ran its fourth
  Outpost at Coachella this year, so I wanted to put a Midwest festival in front of you."
- **Would this email read differently for a different sponsor?** Swap the company name
  for another on the list. If nothing else would have to change, the draft is a template
  and the fit point and activation idea have not done their work.
- **Does the activation idea name something real?** It comes from the deck's own zones
  and elements and connects to what this brand actually sells. A concept nobody could
  picture is not an idea.

## Before the draft is sent

- [ ] The knowledge entries were read before drafting, not after
- [ ] The opening is first person and would survive being read aloud
- [ ] The property appears once, in one sentence
- [ ] The fit point is this sponsor's, not the list's
- [ ] The activation idea names a zone or element from the deck
- [ ] One ask, one link, one signature
- [ ] Every claim traces to the dossier or the campaign files
- [ ] No hedge was flattened between the dossier and the draft
- [ ] Subject and preview read as a pair, at truncation length
- [ ] `npm run email` exits 0, and nothing it flagged was worked around
