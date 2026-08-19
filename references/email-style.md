# Email style

How the sponsor email works as mail, rather than as prose. `writing-quality.md` carries
the word-level rules and `knowledge/agency/trifecta-profile.md` carries the sender's
register; this file only adds what is specific to landing in an inbox.

Adapted from the `email-style` skill in
[vercel-labs/marketing-team-eve-template](https://github.com/vercel-labs/marketing-team-eve-template/tree/main/agent/subagents/email/skills/email-style),
scoped to one cold email to one sponsorship decision-maker.

## Load this before

- Writing `outreach.subject` and `outreach.preview_text`
- Reviewing a draft before delivery
- Deciding whether a sentence earns its place in the body

## The email gets one second first

It arrives uninvited, in a stack of other mail, and gets a second of attention before
someone decides to read or delete. Write for that second, then for the body.

- **One email, one job.** The job is a fifteen-minute conversation. Anything that
  competes with it goes: a second link, a deck offer that is not the ask, a request to
  forward it to the right person. Two calls to action means most readers take neither.
- **Front-load.** The first line of the body is read far more than the second paragraph.
  It carries the reason this arrived for this reader. A warm-up sentence spends the most
  valuable line in the email on nothing.
- **Short paragraphs, one to three sentences.** More white space than a page would need,
  because the column is narrower and the attention is thinner.
- **Write to one person.** "You", their brand, their activation. A message that reads as
  a broadcast gets treated like one.
- **No fake urgency and no fake scarcity.** The packet holds availability unknown, so
  nothing implies a tier is going. A real deadline stated plainly would be fine; we do
  not have one to state.
- **No manufactured personalization.** A merge field wrapped around a generic sentence
  reads worse than no personalization. The dated activation is the personalization.
- **Link text carries its own meaning.** "Book a time" says where it goes. "Click here"
  does not, and a screen reader announces link text out of context.
- **No images.** Nothing in this email needs one, the Outlook desktop clients still
  block them, and an image is one more thing that can arrive as an empty box.

## Subject and preview text

They are one unit and they are the only copy most recipients will ever see. Write them
last, together, once you know what the mail actually says. `render_email.mjs` fails
without both, and `lint_pitch.mjs` fails when the preview repeats the subject.

- **Front-load the subject.** Put the real message in the first 35 to 40 characters,
  which is what survives truncation on a phone. Sources disagree on the ideal length and
  agree on front-loading, so follow the part they agree on.
- **The preview extends the subject.** It never repeats it and never restates the first
  line of the body. Use it for the second most interesting thing in the email.
- **Never leave the preview unset.** The client fills the gap with whatever the HTML
  starts with, which here would be the greeting.
- **Specific beats clever.** A subject that says what is inside outperforms one that
  hints at it, and it keeps its promise, which is what protects the next send.

For this skill, the pair that works is the sponsor's name plus the property in the
subject, and the market and month in the preview: `818 Tequila at Nocturnal Valley` /
`Three nights near St. Louis in September`. Do not put the ask in either.

## The Gmail body

The Markdown draft is the authored record. `pitch.gmail.html` is the transport body, and
it is deliberately plain: one container, system sans-serif, inline styles, one styled
link, no tables, no images, no tracking. Gmail clips above 102 KB of HTML; this body is
under 2 KB, which is the point. Every paragraph in the Markdown appears as one paragraph
in the HTML, in the same order, with the same words.

Nothing in the mail exists only in the HTML. If a sentence cannot survive as plain text,
it is not carrying its meaning in words.

## What does not belong in this email

Enforced by `lint_pitch.mjs`, and worth knowing as judgment rather than as a rule that
gets tripped:

- Source URLs, field labels, stage inventories, the full rate card, draft headings.
- Any attendance figure, from any source.
- "You are receiving this because", an opt-out paragraph, or any receipt footer. This is
  one person writing to one person about a specific thing they did, and a bulk-mail
  footer contradicts that in a single line.
- A second ask, a second link, or a P.S. that reopens the pitch.

## Before the draft goes out

- Read the subject and preview together, at truncation length, as a row in an inbox.
- Read the first line on its own. Does it earn the second?
- Find the single call to action. If you cannot, the email does not have one.
- Read the whole thing aloud. Bob is a person with thirty years of this behind him; the
  draft either sounds like him or it does not.
- Run `npm run email`, which lints. Treat what it flags as writing to fix.
