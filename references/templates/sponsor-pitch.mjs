/**
 * Sponsor pitch — React Email, zero-build ESM, brand-token driven.
 *
 * Pure createElement, no JSX, so `node` renders it directly through
 * @react-email/render — the ESM pattern react-email-esm demonstrates
 * (github.com/kodermax/react-email-esm). Editing this file and re-running
 * `npm run email` is the whole customization loop; there is no compile step.
 *
 * This file is the sender's stationery, and it carries no event brand of its
 * own. The event's identity arrives as `brand` tokens extracted per campaign
 * from that campaign's artifacts (scripts/extract_brand.mjs): palette and
 * type from the client's own deck, optionally topped up from the event site.
 * With no tokens it falls back to a neutral night scheme, so the template is
 * presentable alone and branded the moment a campaign supplies evidence.
 *
 * Every content prop is filled from the run, never written from imagination:
 *   personalNote / reasonSourceUrl <- the dossier, in the sender's register
 *   offerSheet / highlightTier     <- the deck's own rate card, verbatim
 *   event facts                    <- fixtures/festival-packet.json
 * A prop with no evidence behind it is omitted and its section does not
 * render. There is deliberately no attendance prop: the packet holds that
 * figure disputed, so the template gives it nowhere to go.
 */
import { createElement as h } from "react";
import {
  Body, Column, Container, Head, Hr, Html, Img, Link,
  Preview, Row, Section, Text,
} from "@react-email/components";

// ---- brand resolution --------------------------------------------------------

/** Neutral night scheme: what the stationery looks like before a campaign brands it. */
const NEUTRAL = {
  palette: {
    field: "#0a0a0f",   // page ground
    paper: "#f4f1ea",   // primary type on dark
    panel: "#15151e",   // info-block ground
    accent: "#b7ff2e",  // one accent: CTA, highlights
    accent2: "#9b9ba6", // secondary: ranges, kickers stay quiet
  },
  type: { display: null, body: null },
};

const luma = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
/** Ink that survives on a given ground. */
const inkOn = (bg) => (luma(bg) > 0.55 ? "#1c1c22" : "#f4f1ea");
const mutedOn = (bg) => (luma(bg) > 0.55 ? "#55555f" : "#9b9ba6");
/** A hairline that reads on the ground it sits on. */
const lineOn = (bg) => (luma(bg) > 0.55 ? "#00000022" : "#ffffff22");

function resolveBrand(brand) {
  const p = { ...NEUTRAL.palette, ...(brand?.palette
    ? Object.fromEntries(Object.entries(brand.palette).filter(([, v]) => v)) : {}) };
  const t = { ...NEUTRAL.type, ...(brand?.type ?? {}) };
  const stackBody = t.body
    ? `'${t.body}', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const stackDisplay = t.display
    ? `'${t.display}', 'Arial Black', 'Helvetica Neue', Arial, sans-serif`
    : stackBody;
  return { p, stackBody, stackDisplay };
}

export function SponsorPitch({
  greetingName,
  companyName,
  personalNote,
  reasonSourceUrl,
  festivalName,
  festivalDates,
  festivalVenue,
  festivalMarket,
  distanceNote,
  stages = [],
  audienceLine,
  offerSheet = [],
  highlightTier,
  callUrl,
  senderName,
  senderCompany,
  optOutUrl,
  previewText,
  heroImageUrl,
  brand = null,
}) {
  const { p, stackBody, stackDisplay } = resolveBrand(brand);
  const card = p.field;
  const ink = inkOn(card);
  const muted = mutedOn(card);
  const line = lineOn(card);
  const panelInk = inkOn(p.panel);
  const panelMuted = mutedOn(p.panel);
  const ctaInk = inkOn(p.accent);

  const kicker = {
    fontFamily: stackDisplay, fontSize: "11px", letterSpacing: "2px",
    textTransform: "uppercase", color: muted, margin: "0",
  };
  const body = { fontFamily: stackBody, fontSize: "15px", lineHeight: "24px", color: ink, margin: "0 0 14px" };
  const small = { fontFamily: stackBody, fontSize: "12px", lineHeight: "18px", color: muted, margin: "0" };

  const offerRow = (tier, i) => {
    const hot = highlightTier && tier.tier.toLowerCase() === String(highlightTier).toLowerCase();
    return h(Section, {
      key: tier.tier,
      style: {
        borderLeft: `3px solid ${hot ? p.accent : line}`,
        backgroundColor: hot ? p.panel : "transparent",
        padding: "10px 14px",
        marginBottom: i === offerSheet.length - 1 ? "0" : "8px",
      },
    },
      h(Row, null,
        h(Column, null,
          h(Text, { style: { ...body, margin: "0", fontWeight: 600, fontSize: "14px", color: hot ? panelInk : ink } }, tier.tier),
          tier.includes?.length
            ? h(Text, { style: { ...small, marginTop: "2px", color: hot ? panelMuted : muted } },
                tier.includes.slice(0, 2).join(" · "))
            : null,
        ),
        h(Column, { style: { width: "110px", textAlign: "right", verticalAlign: "top" } },
          h(Text, {
            style: { ...body, margin: "0", fontSize: "14px", fontWeight: 700,
                     color: hot ? (luma(p.panel) > 0.55 ? p.accent : p.paper) : ink },
          }, tier.range),
        ),
      ),
    );
  };

  return h(Html, null,
    h(Head, null),
    h(Preview, null, previewText),
    h(Body, { style: { backgroundColor: p.field, margin: "0", padding: "24px 0" } },
      h(Container, { style: { backgroundColor: card, maxWidth: "600px", border: `1px solid ${line}` } },

        // Masthead: the event as a typographic block in its own display face.
        h(Section, { style: { padding: "26px 32px 20px", borderBottom: `1px solid ${line}` } },
          h(Text, { style: { ...kicker, color: p.accent2 !== NEUTRAL.palette.accent2 ? p.accent2 : muted } },
            `${festivalDates} · ${festivalMarket}`),
          h(Text, { style: {
            fontFamily: stackDisplay, fontSize: "30px", lineHeight: "34px", fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "1px", color: ink, margin: "6px 0 0",
          } }, festivalName),
        ),

        // An optional hosted hero: the campaign's own key art, supplied by the
        // operator from the deck's media list, never hotlinked from a third party.
        heroImageUrl
          ? h(Section, null,
              h(Img, { src: heroImageUrl, alt: `${festivalName} key art`, width: 600,
                       style: { display: "block", width: "100%" } }))
          : null,

        // The personal note opens in the recipient's world and carries the offer.
        h(Section, { style: { padding: "28px 32px 8px" } },
          h(Text, { style: body }, `${greetingName},`),
          h(Text, { style: body },
            personalNote,
            reasonSourceUrl
              ? h(Link, { href: reasonSourceUrl, style: { color: muted, fontSize: "12px" } }, " (source)")
              : null,
          ),
        ),

        // The event, briefly: three columns of fact on the panel ground.
        h(Section, { style: { padding: "8px 32px 24px" } },
          h(Section, { style: { backgroundColor: p.panel, border: `1px solid ${line}`, padding: "16px 18px" } },
            h(Row, null,
              h(Column, { style: { verticalAlign: "top" } },
                h(Text, { style: { ...kicker, color: panelMuted, marginBottom: "4px" } }, "When"),
                h(Text, { style: { ...body, margin: "0", fontSize: "13px", color: panelInk } }, festivalDates),
              ),
              h(Column, { style: { verticalAlign: "top" } },
                h(Text, { style: { ...kicker, color: panelMuted, marginBottom: "4px" } }, "Where"),
                h(Text, { style: { ...body, margin: "0", fontSize: "13px", color: panelInk } }, festivalVenue),
                distanceNote ? h(Text, { style: { ...small, color: panelMuted } }, distanceNote) : null,
              ),
              stages.length
                ? h(Column, { style: { verticalAlign: "top" } },
                    h(Text, { style: { ...kicker, color: panelMuted, marginBottom: "4px" } }, "Stages"),
                    h(Text, { style: { ...body, margin: "0", fontSize: "13px", color: panelInk } }, stages.join(" · ")),
                  )
                : null,
            ),
            audienceLine
              ? h(Text, { style: { ...small, color: panelMuted, marginTop: "12px" } }, audienceLine)
              : null,
          ),
        ),

        // Initial offer sheet: the deck's own rate card, nothing invented.
        offerSheet.length
          ? h(Section, { style: { padding: "0 32px 24px" } },
              h(Text, { style: { ...kicker, marginBottom: "10px" } }, "Initial offer sheet"),
              ...offerSheet.map(offerRow),
              h(Text, { style: { ...small, marginTop: "10px" } },
                "Ranges from the 2026 sponsorship deck. Every package adjusts to your goals."),
            )
          : null,

        // Exactly one ask.
        h(Section, { style: { padding: "0 32px 32px" } },
          h(Link, {
            href: callUrl,
            style: {
              display: "inline-block", backgroundColor: p.accent, color: ctaInk,
              fontFamily: stackDisplay, fontSize: "14px", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "1px",
              padding: "12px 22px", textDecoration: "none",
            },
          }, "Book fifteen minutes"),
        ),

        h(Hr, { style: { borderColor: line, margin: "0" } }),

        // A person signs it. The sender block stays typographic: Trifecta has no
        // verified public brand, and borrowed decoration here would be invention.
        h(Section, { style: { padding: "20px 32px 28px" } },
          h(Text, { style: { ...body, margin: "0", fontWeight: 600 } }, senderName),
          h(Text, { style: { ...small, marginTop: "2px" } }, senderCompany),
          h(Text, { style: { ...small, marginTop: "14px", maxWidth: "420px" } },
            `You are receiving this because ${companyName} sponsors events in this category. `,
            h(Link, { href: optOutUrl, style: { color: muted, textDecoration: "underline" } }, "Tell us to stop"),
            ".",
          ),
        ),
      ),
    ),
  );
}

// Placeholders for local preview only. Never a sample message, never sent.
SponsorPitch.PreviewProps = {
  greetingName: "FIRST_NAME_OR_COMPANY_TEAM",
  companyName: "COMPANY_NAME",
  personalNote: "ONE_DATED_ACTIVATION_AND_THE_OFFER_IN_THE_SENDER_REGISTER",
  reasonSourceUrl: "https://example.com/source",
  festivalName: "FESTIVAL_NAME",
  festivalDates: "FESTIVAL_DATES",
  festivalVenue: "FESTIVAL_VENUE",
  festivalMarket: "FESTIVAL_MARKET",
  distanceNote: "DISTANCE_NOTE",
  stages: ["STAGE_A", "STAGE_B", "STAGE_C"],
  audienceLine: "AUDIENCE_FROM_THE_FESTIVAL_PACKET",
  offerSheet: [{ tier: "TIER_NAME", range: "$0K", includes: ["INCLUDE_A"] }],
  highlightTier: null,
  callUrl: "https://example.com/book",
  senderName: "SENDER_FULL_NAME",
  senderCompany: "SENDER_COMPANY",
  optOutUrl: "https://example.com/opt-out",
  previewText: "PREVIEW_TEXT_EXTENDS_THE_SUBJECT",
  heroImageUrl: undefined,
  brand: null,
};

export default SponsorPitch;
