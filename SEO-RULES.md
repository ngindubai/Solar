# SEO-RULES.md — Binding SEO policy for {{BRAND_NAME}}
These rules implement Google Search Essentials, Google's spam policies, and
the helpful-content guidance. Automated publishing MUST comply. When in
doubt: would this page exist, in this form, if search engines didn't?

## People-first content (helpful content system)
1. Every article answers a real question a Dubai property owner or business
   asks, with specific, locally accurate information (DEWA bands, Shams
   Dubai process, Dubai climate). Generic "what is solar" filler is banned.
2. Demonstrate E-E-A-T: cite primary sources by name (DEWA, Dubai
   Electricity & Water Authority; Shams Dubai; UAE Net Zero 2050) in plain
   text; include a "Reviewed by the {{BRAND_NAME}} engineering team" byline
   and a visible last-updated date; never cite fabricated statistics —
   if a number can't be sourced or derived from CONFIG, don't publish it.
3. Each article must contain at least one element only we can provide:
   a worked AED example using the calculator's CONFIG constants, a
   band-by-band table, or a Dubai-specific checklist.

## Spam policies — automated publishing guardrails
4. SCALED CONTENT ABUSE: never mass-generate near-duplicate pages. Before
   publishing, confirm no existing article targets the same primary query;
   if one does, UPDATE it (and its lastmod) instead of adding a new page.
   Maximum publishing cadence: articles must be individually reviewed;
   volume never outranks usefulness.
5. DOORWAY PAGES: no location-permutation pages ("solar in Jumeirah",
   "solar in Arabian Ranches", …) that differ only by place name. Location
   content is allowed only when materially different (e.g. villa freehold
   vs apartment strata rules).
6. KEYWORD STUFFING: write naturally. A target phrase appears in title, h1,
   first 100 words, and thereafter only where natural. No hidden text, no
   white-on-white, no stuffed alt text, no comma keyword lists.
7. NO deceptive practices: no cloaking, no sneaky redirects, no auto-refresh,
   no misleading titles ("free" only where AED 0 upfront is literally true —
   which it is for PPA; say "AED 0 upfront" in metadata to stay precise).
8. LINKS: internal links use descriptive anchors (not "click here"). Any
   external link added by automation must be to a primary/authoritative
   source (.gov.ae, dewa.gov.ae, IRENA, manufacturer spec sheets) and use
   rel="noopener". Never sell, exchange or automate outbound links for
   ranking. Paid or affiliate links (if ever) get rel="sponsored".

## Structured data rules
9. Only mark up content visible on the page. Schema types allowed:
   Organization/LocalBusiness (sitewide), FAQPage (only where a real FAQ is
   rendered), Article (knowledge hub), BreadcrumbList, WebSite.
10. NEVER add Review, AggregateRating, or star markup — we have no collected
    reviews. Adding fake ratings is a Google structured-data violation.
11. LocalBusiness schema: name, url, address (Unit 20, Prime Tower, Business
    Bay, Dubai, AE), geo, areaServed, email. NO telephone property.

## Technical baseline (every page)
12. Unique title ≤60 chars, front-loaded; unique meta description ≤155 chars
    written as an answer + CTA.
13. One h1; heading order never skips levels; semantic <main>/<nav>/<footer>.
14. Self-referencing canonical; root-relative internal links; trailing-slash
    URLs; lowercase-hyphenated slugs, 3–6 words, no dates, no stop-words.
15. Every <img> has meaningful alt (or alt="" if decorative), width/height
    attributes, and loading="lazy" below the fold.
16. New/changed pages: update sitemap.xml <lastmod> same commit. robots.txt
    stays permissive (no crawl of /thank-you/ via noindex meta, not robots
    block — the page must remain reachable for the form redirect).
17. /thank-you/, /privacy-policy/, /terms/, 404: meta robots noindex,follow.
18. Core Web Vitals: no layout shift from late images (dimensions required),
    no blocking scripts (defer everything), CSS in one small file.

## Knowledge hub information architecture
19. Categories are fixed: Bills & Savings · Free Solar (PPA) · Buying Solar ·
    Battery Storage · Business Solar · Rules & DEWA. Every article gets
    exactly one category, a breadcrumb, and 2–4 contextual internal links to
    money pages (/free-solar-ppa/, /buy-solar/, /calculator/) with varied,
    descriptive anchors.
20. Every article ends with the standard CTA block (estimate form link +
    calculator link). No article is a dead end.
