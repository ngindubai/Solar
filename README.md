# {{BRAND_NAME}} — Dubai Solar & Battery Storage Website

Static lead-generation site. No build step, no dependencies — plain HTML,
one stylesheet, two small vanilla JS files, plus one PHP file (`lead.php`)
that delivers the forms. Drop the repo root onto any host with PHP
(Hostinger) and go live.

## Deploy checklist (the only manual steps)

1. **Replace the two tokens** everywhere (find-and-replace across all files):
   - `{{BRAND_NAME}}` → the trading name of the business
   - `{{DOMAIN}}` → the production origin, e.g. `https://example.ae`
     (no trailing slash — it is used as a prefix in canonicals, sitemap,
     schema and OG tags). The replace also sets the brand in `lead.php`.
2. **Export the OG image**: render `assets/img/og-default.svg` to
   `assets/img/og-default.png` (1200×630). Meta tags already reference the
   `.png`.
3. **Lead delivery (`/lead.php`)**: every form posts to `lead.php` at the
   repo root, which emails the lead to `garethsomers@outlook.com` with the
   host's PHP `mail()`, logs it outside the web root (`../solar-leads/`)
   and redirects to `/thank-you/` only after the email was accepted. At
   launch, change `from` in `LEAD_CONFIG` (top of `lead.php`) from the
   temporary `noreply@firswoodproperties.ae` to `noreply@` the site's own
   domain; that domain needs a DMARC policy of `p=none` (or no DMARC record)
   and must be on Gareth's Outlook Safe senders list. Then send one test
   from each form (homepage, contact, calculator). Needs PHP hosting
   (Hostinger has it); a pure static host cannot run it.
4. Update `sitemap.xml` `<lastmod>` dates if you edit pages.
5. Cache-busting: `main.css`, `calculator.js` and `main.js` are linked
   with a `?v=N` version query (currently `?v=3`). Hosts and browsers
   cache these files for days, so after editing any of the three, bump
   the number in every page's `<link>`/`<script>` tag (find-and-replace
   `?v=3` to `?v=4`). Skipping this makes visitors keep the old file and
   is the usual reason a change "did not show up" after deploy.

## Editing rules

Read `CLAUDE.md` (agent/editing rules) and `SEO-RULES.md` (binding SEO
policy) before changing anything. Highlights:

- **No phone numbers anywhere.** Contact is web forms + email only.
- All tariff/pricing constants live only in the `CONFIG` object at the top
  of `assets/js/calculator.js`. Pages that quote tariffs wrap them in
  `<span data-tariff="…">` so they re-render from CONFIG.
- Savings figures always sit near the estimates disclaimer.

## Adding knowledge-hub articles (automated SEO programme)

1. Clone `/knowledge-hub/_TEMPLATE.html` to
   `/knowledge-hub/<slug>/index.html` and replace every `[[TOKEN]]` —
   the template's comments document each one.
2. In the same change: add the URL to `sitemap.xml` (with `<lastmod>`)
   and link the article from `/knowledge-hub/index.html`.
3. Categories are fixed; slugs are lowercase-hyphenated, 3–6 words.
4. `SEO-RULES.md` is binding — especially the scaled-content and doorway
   page rules.

## Structure

- `index.html` — homepage: hero lead form, scroll-driven journey fork
  (Free Solar vs Buy), DEWA band meter, embedded calculator, FAQ.
- `/free-solar-ppa/`, `/buy-solar/` — money pages (mirror-structured).
- `/homeowners/`, `/business/` — audience pages (equal depth).
- `/battery-storage/`, `/calculator/`, `/knowledge-hub/` (+10 articles),
  `/about/`, `/contact/`, `/thank-you/`, `/privacy-policy/`, `/terms/`,
  `404.html`.
- `assets/css/main.css` — all design tokens as CSS custom properties.
- `assets/js/main.js` — nav, sticky CTA, reveals, journey-line animation.
- `assets/js/calculator.js` — CONFIG + band engine + calculator UI.
- `lead.php` — same-origin lead handler every form posts to.

## Notes

- The scroll animation (two lines forking off the hero) is drawn from real
  DOM positions at runtime and respects `prefers-reduced-motion` (lines
  render fully drawn, nothing moves).
- 404: most static hosts pick up root `404.html` automatically; on
  Hostinger/Apache it is wired via `.htaccess` (`ErrorDocument 404 /404.html`).
- Arabic (`/ar/`) mirror is out of scope for this pass; the folder-per-page
  IA supports adding one later without restructuring.
