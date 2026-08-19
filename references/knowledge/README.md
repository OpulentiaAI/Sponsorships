# Knowledge base

Two kinds of knowledge live in this repository, and the split is the identity of the skill.

**`references/knowledge/agency/` is Trifecta Marketing** — the client. Bob Dittrich's profile and register (`trifecta-profile.md`), the sending identity (`sender.json`), and the agency-wide banned phrases. This persists across every engagement: Trifecta sells sponsorship packages for ten to fifteen independent festivals, and the skill is their tool.

**`references/campaigns/<key>/` is one property being sold** — currently `nocturnal-valley`, the sample campaign. The property's decks bit-for-bit in `sources/` (checksums in the campaign's own files), the extracted claims (`deck-facts.md`), the campaign facts (`festival-packet.json`), the target list and exclusion rules, the discovery universe (`comparable-events.json`), and that deck's register bans. A new engagement is a new campaign directory and the same eight commands; the checklist is at the end of `agency/trifecta-profile.md`.

## The contract

1. A property fact in outreach traces to the campaign's `deck-facts.md` or to a dossier field. A fact in neither is not written.
2. Zone and tier names are the campaign deck's, verbatim.
3. The deck's promotional register stays in the deck; the email is written in the sender's register from `agency/trifecta-profile.md`. `scripts/lint_pitch.mjs` enforces both banned lists after every Markdown draft.
4. When the client revises a deck, the new file lands in the campaign's `sources/`, `deck-facts.md` is re-cited against it, and the diff between the two is itself a finding.
5. Nothing here is verified by us: agency and campaign files alike are client-supplied, preserved as received, and carry the same evidence envelope as everything else.
