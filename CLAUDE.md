# CLAUDE.md — Rules for building and editing this site

## Identity
Static lead-generation website for {{BRAND_NAME}}, a Dubai solar PV + battery
storage installer serving homeowners and businesses equally. Unit 20, Prime
Tower, Business Bay, Dubai. Contact is web forms + email only.

## Hard rules — never violate
1. NO PHONE NUMBER. Never add a phone number, tel: link, WhatsApp link or
   "call us" copy anywhere, including schema.org markup.
2. Lead forms POST to FormSubmit → garethsomers@outlook.com. Never change the
   endpoint, never add fields that collect more than name, email, and the
   fields already specified. Every form keeps its `_honey` honeypot and
   `_next` redirect to /thank-you/.
3. Dual audience parity: any change that adds residential-facing content must
   add or preserve the commercial equivalent, and vice versa.
4. Never fabricate: no invented testimonials, review counts, star ratings,
   client logos, certifications, project numbers, or team members. If proof
   is needed and none is supplied, use the calculator and factual DEWA/Shams
   Dubai information as the proof.
5. Savings figures are ESTIMATES. Any number produced by the calculator or
   quoted in copy must be near a disclaimer ("estimate, not a quote; final
   figures depend on a site survey and DEWA approval").
6. All tariff/pricing constants live ONLY in the `CONFIG` object at the top of
   /assets/js/calculator.js. Never hard-code a tariff anywhere else. Copy may
   describe bands qualitatively; exact fils/kWh values render from CONFIG.
7. UK/international English. Currency always "AED". Units: kWh, kWp, sq ft
   for commercial input, bedrooms for residential input.
8. No new dependencies. Vanilla HTML/CSS/JS only. No CDNs, no frameworks,
   no analytics snippets unless explicitly instructed (a commented
   placeholder block exists in each <head> for later).
9. Read SEO-RULES.md before creating or editing any page. It is binding.
10. New articles go in /knowledge-hub/<slug>/index.html cloned from
    /knowledge-hub/_TEMPLATE.html, and MUST be added to sitemap.xml and
    linked from /knowledge-hub/index.html in the same change.

## Voice & copy
- Confident, plain-spoken, numerate. Short sentences. No hype words
  ("revolutionary", "game-changing"), no exclamation marks in body copy.
- Lead with the reader's bill, not our technology.
- Every page ends with a CTA section. CTA verbs are specific:
  "Get my free savings estimate", "Check my roof", "See my payback" —
  never bare "Submit" or "Learn more" on primary CTAs.
- Explain PPA vs purchase wherever a first-time visitor might land.

## Design system (tokens live in assets/css/main.css)
- Respect existing CSS custom properties for colour, type scale and spacing.
  Do not introduce new hex values or font families; extend via tokens only.
- One primary CTA style sitewide; secondary/ghost style for the alternate
  route. Sticky mobile CTA bar appears on every page except /thank-you/.
- Accessibility floor: WCAG AA contrast, visible focus, labels on every
  input, prefers-reduced-motion respected, semantic landmarks.

## Consistency checklist for ANY edit
[ ] Header/nav/footer markup identical across all pages
[ ] Unique <title> (≤60 chars) and meta description (≤155 chars)
[ ] Exactly one <h1>; logical h2/h3 hierarchy
[ ] Canonical tag present and correct
[ ] Added/changed pages reflected in sitemap.xml (with lastmod)
[ ] Internal links root-relative and unbroken
[ ] No phone number introduced anywhere
[ ] Disclaimers intact next to any savings figure
