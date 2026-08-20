# Nocturnal Valley private personalized draft package

This private package accounts for all 75 campaign rows: 72 authored drafts and 3 rows blocked because their sponsorship signal is outside the rolling one-year evidence window.

It contains personal names and must not be published or committed. 2 recipient names passed the campaign's person-evidence gate, 54 are unverified candidates retained for private review, and 19 remain unresolved after two searches. Candidate and missing-name drafts are not delivery-ready.

No message has been sent. Every row is also blocked until the campaign's three sponsors already in motion are supplied and checked against this batch.

## Routing

Every message file begins with its send route: `To:` (recipient address, verification status, source) and `From:` (the campaign owner's connected Gmail). 39 rows carry a monid-sourced unverified address, 36 carry none. No row is sendable until its blockers clear: the exclusion list, person verification where the greeting uses a candidate name, and a verified address.

## Contents

- `manifest.json` is the ordered 75-row index with recipient status, evidence, authoring state, and delivery blockers.
- `messages/` contains one Markdown record per queue row.
- `evidence/` contains the full available discovery checkpoint, raw source and provider receipts, final queue/audit outputs, and exact authoring inputs.
- Eligible rows with a known candidate use that person's first name. Missing-name rows retain `{{recipient_first_name}}` rather than inventing a contact.
- Personal content is limited to an established role when available and the sponsor's sourced activation. No personal interests or responsibilities were inferred.
