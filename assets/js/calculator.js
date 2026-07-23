/* ==========================================================================
   {{BRAND_NAME}} - calculator.js
   DEWA savings calculator. Vanilla JS, no dependencies, no persistence.
   Mounts into every element with [data-calc]. Two modes: Home | Business.

   ALL tariff/pricing constants live ONLY in CONFIG below.
   Verify against dewa.gov.ae at deploy; update here only.
   ========================================================================== */

const CONFIG = {
  // DEWA residential electricity slabs, fils per kWh (100 fils = 1 AED)
  residentialSlabs: [
    { upTo: 2000, fils: 23, name: "Green band" },   // 0–2,000 kWh/month
    { upTo: 4000, fils: 28, name: "Yellow band" },  // 2,001–4,000
    { upTo: 6000, fils: 32, name: "Orange band" },  // 4,001–6,000
    { upTo: Infinity, fils: 38, name: "Red band" }  // 6,001+
  ],
  // DEWA commercial slabs, fils per kWh
  commercialSlabs: [
    { upTo: 10000, fils: 23, name: "Standard rate" },
    { upTo: Infinity, fils: 38, name: "High-consumption rate" }
  ],
  fuelSurchargeFils: 6,        // variable monthly; conservative-recent value
  sunYieldKWhPerKWpYear: 1900, // Dubai top-end specific yield (optimistic)
  ppaDiscount: 0.25,           // PPA rate = 25% below customer's blended DEWA rate
  capexPerKWpResidential: 3000,// AED per kWp installed (turnkey, optimistic)
  capexPerKWpCommercial: 2400, // AED per kWp installed (scale pricing)
  systemLifeYears: 25,
  tariffEscalation: 0.02,      // assumed annual DEWA cost drift for lifetime figures
  commercialKWhPerSqFtYear: 28,// Dubai air-conditioned premises consumption proxy
  commercialRoofKWpPerSqFt: 1 / 90 // roof-limited sizing check for warehouses
};

/* Residential monthly consumption lookup (kWh) - optimistic, AC-driven Dubai
   usage. Rows: bedrooms. null = combination not offered (apartments cap at 4BR). */
const HOME_KWH = {
  apartment:  { 2: 1100, 3: 1500, 4: 1900, 5: null, 6: null, 7: null },
  townhouse:  { 2: 1500, 3: 1900, 4: 2400, 5: 3000, 6: 3600, 7: 4200 },
  villa:      { 2: 1900, 3: 2400, 4: 3000, 5: 3800, 6: 4600, 7: 5500 }
};

/* --------------------------------------------------------------------------
   Band engine
   --------------------------------------------------------------------------
   Worked-example check (run mentally or in console - must hold before deploy):
     billAED(3000, CONFIG.residentialSlabs)
       = 2000×0.23 + 1000×0.28 + 3000×0.06  = 460 + 280 + 180 = AED 920/month
     4-bed detached villa → 3,000 kWh/mo → 36,000 kWh/yr
       system  = 36000 / 1900              ≈ 18.9 kWp
       capex   = 18.9 × 3000               ≈ AED 57,000 (rounded to 1,000)
       saving  = 920 × 12                  = AED 11,040/yr
       payback = 56842 / 11040             ≈ 5.1–5.2 years
       PPA     = 920 × 0.25                = AED 230/month saved, AED 0 down
   -------------------------------------------------------------------------- */

/** Monthly bill in AED for a consumption walked cumulatively through slabs,
    plus the fuel surcharge on every kWh. */
function billAED(kWh, slabs) {
  let remaining = kWh;
  let prevCap = 0;
  let fils = 0;
  for (const slab of slabs) {
    if (remaining <= 0) break;
    const slabWidth = slab.upTo - prevCap;
    const inSlab = Math.min(remaining, slabWidth);
    fils += inSlab * slab.fils;
    remaining -= inSlab;
    prevCap = slab.upTo;
  }
  fils += kWh * CONFIG.fuelSurchargeFils;
  return fils / 100;
}

/** Marginal saving: solar wipes out the MOST EXPENSIVE kWh first, so the
    saving is the difference between the full bill and the bill with the
    offset removed - top band down. */
function marginalSavings(kWhConsumption, kWhOffset, slabs) {
  const offset = Math.min(kWhOffset, kWhConsumption);
  return billAED(kWhConsumption, slabs) - billAED(kWhConsumption - offset, slabs);
}

/** Which slab does the customer's LAST unit fall in? */
function bandFor(kWh, slabs) {
  let prevCap = 0;
  for (const slab of slabs) {
    if (kWh <= slab.upTo) return { ...slab, from: prevCap + 1 };
    prevCap = slab.upTo;
  }
  return slabs[slabs.length - 1];
}

/** Numerically invert billAED: given a monthly AED bill, find the kWh that
    produces it (binary search - the bill function is monotonic). */
function kWhFromBill(bill, slabs) {
  if (bill <= 0) return 0;
  let lo = 0;
  let hi = 200000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (billAED(mid, slabs) < bill) lo = mid; else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Sum of an annual saving escalated at CONFIG.tariffEscalation over the
    system life, compounding: S × Σ (1+e)^(y−1). */
function lifetimeSavings(annualSaving) {
  const e = CONFIG.tariffEscalation;
  let total = 0;
  for (let y = 0; y < CONFIG.systemLifeYears; y++) {
    total += annualSaving * Math.pow(1 + e, y);
  }
  return total;
}

/* --------------------------------------------------------------------------
   Formatting
   -------------------------------------------------------------------------- */
function aed(n) {
  return "AED " + Math.round(n).toLocaleString("en-GB");
}
function aedK(n) {
  return "AED " + (Math.round(n / 1000) * 1000).toLocaleString("en-GB");
}
function num(n) {
  return Math.round(n).toLocaleString("en-GB");
}

/* --------------------------------------------------------------------------
   Core estimate builders
   -------------------------------------------------------------------------- */
function estimateFromMonthlyKWh(kWhMonth, slabs, capexPerKWp, roofCapKWp) {
  const annualKWh = kWhMonth * 12;
  let systemKWp = annualKWh / CONFIG.sunYieldKWhPerKWpYear;
  let roofLimited = false;
  if (roofCapKWp && roofCapKWp < systemKWp) {
    systemKWp = roofCapKWp;
    roofLimited = true;
  }
  const solarKWhMonth = Math.min(
    kWhMonth,
    (systemKWp * CONFIG.sunYieldKWhPerKWpYear) / 12
  );

  const monthlyBill = billAED(kWhMonth, slabs);
  const monthlySaving = marginalSavings(kWhMonth, solarKWhMonth, slabs);
  const annualSaving = monthlySaving * 12;

  /* PPA maths - derivation:
       blendedDisplacedRate = monthlySaving / solarKWhMonth   (AED per solar kWh)
       ppaRate              = blendedDisplacedRate × (1 − ppaDiscount)
       monthlySavingPPA     = monthlySaving − solarKWhMonth × ppaRate
                            = monthlySaving − monthlySaving × (1 − ppaDiscount)
                            = monthlySaving × ppaDiscount
     The customer keeps exactly the discount share of what solar displaces. */
  const monthlySavingPPA = monthlySaving * CONFIG.ppaDiscount;

  const capex = systemKWp * capexPerKWp;
  const paybackYears = capex / annualSaving;

  return {
    kWhMonth,
    annualKWh,
    systemKWp,
    solarKWhMonth,
    roofLimited,
    monthlyBill,
    monthlySaving,
    annualSaving,
    monthlySavingPPA,
    annualSavingPPA: monthlySavingPPA * 12,
    lifetimePPA: lifetimeSavings(monthlySavingPPA * 12),
    capex,
    paybackYears,
    lifetimeBuyNet: lifetimeSavings(annualSaving) - capex,
    band: bandFor(kWhMonth, slabs)
  };
}

/* --------------------------------------------------------------------------
   UI
   -------------------------------------------------------------------------- */
const FORM_ENDPOINT = "https://formsubmit.co/garethsomers@outlook.com";

/** Options for the bill picker: 50-AED increments between min and max. */
function billOptionsHTML(min, max) {
  let out = '<option value="">Skip this and estimate from my details above</option>';
  for (let v = min; v <= max; v += 50) {
    out += '<option value="' + v + '">AED ' + v.toLocaleString("en-GB") + "</option>";
  }
  return out;
}

function calcMarkup(uid) {
  return `
  <div class="calc-head">
    <h3 id="${uid}-title">Estimate your solar savings</h3>
    <div class="mode-toggle" role="group" aria-label="Calculator mode">
      <button type="button" data-mode="home" aria-pressed="true">Home</button>
      <button type="button" data-mode="business" aria-pressed="false">Business</button>
    </div>
  </div>
  <div class="calc-body">
    <form data-calc-form novalidate>
      <div class="calc-inputs" data-panel="home">
        <div class="field">
          <label for="${uid}-ptype">Property type</label>
          <select id="${uid}-ptype" name="ptype">
            <option value="villa">Detached villa</option>
            <option value="townhouse">Townhouse / attached villa</option>
            <option value="apartment">Apartment</option>
          </select>
        </div>
        <div class="field">
          <label for="${uid}-beds">Bedrooms</label>
          <select id="${uid}-beds" name="beds">
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4" selected>4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7+</option>
          </select>
        </div>
        <div class="field field-full">
          <label for="${uid}-bill-h">Know your bill? Pick your average monthly DEWA bill <span class="muted">(optional)</span></label>
          <select id="${uid}-bill-h" name="billHome">${billOptionsHTML(200, 10000)}</select>
          <p class="hint">If you pick a bill we estimate from that instead of the property profile.</p>
        </div>
      </div>
      <div class="calc-inputs" data-panel="business" hidden>
        <div class="field">
          <label for="${uid}-btype">Premises type</label>
          <select id="${uid}-btype" name="btype">
            <option value="office">Office</option>
            <option value="retail">Retail</option>
            <option value="warehouse">Warehouse / industrial</option>
            <option value="other">Labour accommodation / other</option>
          </select>
        </div>
        <div class="field">
          <label for="${uid}-sqft">Air-conditioned floor area (sq ft)</label>
          <input id="${uid}-sqft" name="sqft" type="number" inputmode="numeric" min="500" max="2000000" step="100" value="10000">
        </div>
        <div class="field field-full">
          <label for="${uid}-bill-b">Know your bill? Pick your average monthly DEWA bill <span class="muted">(optional)</span></label>
          <select id="${uid}-bill-b" name="billBiz">${billOptionsHTML(500, 50000)}</select>
          <p class="hint">If you pick a bill we estimate from that instead of the floor area.</p>
        </div>
      </div>
      <p><button type="submit" class="btn btn-primary">See my savings</button></p>
    </form>

    <div class="calc-results" data-calc-results hidden aria-live="polite"></div>
  </div>`;
}

function bandCallout(est, isHome) {
  const bandLabel = isHome
    ? `DEWA’s <strong>${est.band.name} - ${est.band.fils} fils/kWh</strong>`
    : `DEWA’s <strong>${est.band.name} - ${est.band.fils} fils/kWh</strong> commercial slab`;
  return `
  <div class="calc-band-callout">
    <p>Your usage of about <strong>${num(est.kWhMonth)} kWh/month</strong> puts your top units in ${bandLabel}. That is exactly the power solar eliminates first.</p>
  </div>`;
}

function disclaimerHTML() {
  return `<div class="calc-note"><p><strong>These figures are estimates, not a quote.</strong> Final numbers depend on a free site survey, your actual consumption profile and DEWA approval under Shams Dubai. Tariff constants used here should be verified against dewa.gov.ae.</p></div>`;
}

function leadFormHTML(uid, summary) {
  return `
  <div class="form-card">
    <h3>Get this estimate verified with a free site survey</h3>
    <p class="form-note">Leave your details and an engineer will email your tailored figures. No calls; we work by email.</p>
    <form action="${FORM_ENDPOINT}" method="POST">
      <input type="hidden" name="_subject" value="New solar lead - Calculator estimate">
      <input type="hidden" name="_template" value="table">
      <input type="hidden" name="_captcha" value="false">
      <input type="hidden" name="_next" value="{{DOMAIN}}/thank-you/">
      <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">
      <input type="hidden" name="_summary" value="${summary.replace(/"/g, "&quot;")}">
      <div class="field">
        <label for="${uid}-lead-name">Name</label>
        <input id="${uid}-lead-name" name="name" type="text" required autocomplete="name">
        <p class="field-error">Please enter your name.</p>
      </div>
      <div class="field">
        <label for="${uid}-lead-email">Email</label>
        <input id="${uid}-lead-email" name="email" type="email" required autocomplete="email">
        <p class="field-error">Please enter a valid email address.</p>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Get my estimate verified</button>
    </form>
  </div>`;
}

function resultsHTML(uid, est, isHome) {
  const roofNote = est.roofLimited
    ? `<li><span>Sizing</span><span class="val">Roof-limited</span></li>`
    : "";
  const roofPara = est.roofLimited
    ? `<p class="hint">This system is roof-limited. Batteries and high-efficiency panels can close the gap. The survey will confirm usable roof area.</p>`
    : "";

  const summary = [
    `Mode: ${isHome ? "Home" : "Business"}`,
    `Consumption: ${num(est.kWhMonth)} kWh/month`,
    `Band: ${est.band.name} (${est.band.fils} fils/kWh)`,
    `Estimated bill: ${aed(est.monthlyBill)}/month`,
    `System size: ${est.systemKWp.toFixed(1)} kWp${est.roofLimited ? " (roof-limited)" : ""}`,
    `PPA: saves ${aed(est.monthlySavingPPA)}/month, AED 0 upfront, 25-yr saving ${aedK(est.lifetimePPA)}`,
    `Buy: price ${aedK(est.capex)}, saves ${aed(est.monthlySaving)}/month, payback ${est.paybackYears.toFixed(1)} yrs, 25-yr net ${aedK(est.lifetimeBuyNet)}`
  ].join(" | ");

  return `
  <h3 class="mb-4">Your two routes to a lower bill</h3>
  <div class="result-cards">
    <div class="result-card is-featured">
      <p class="result-tag">Card A: Free Solar (PPA)</p>
      <h4>AED 0 upfront</h4>
      <p class="result-figure">${aed(est.monthlySavingPPA)}<small>estimated saving per month, from day one</small></p>
      <ul class="result-lines">
        <li><span>Year-1 saving</span><span class="val">${aed(est.annualSavingPPA)}</span></li>
        <li><span>25-year saving</span><span class="val">${aedK(est.lifetimePPA)}</span></li>
        <li><span>Maintenance &amp; insurance</span><span class="val">Included</span></li>
        <li><span>Upfront cost</span><span class="val">AED 0</span></li>
      </ul>
    </div>
    <div class="result-card">
      <p class="result-tag">Card B: Buy your system</p>
      <h4>${est.systemKWp.toFixed(1)} kWp system</h4>
      <p class="result-figure">${aedK(est.capex)}<small>indicative turnkey price</small></p>
      <ul class="result-lines">
        <li><span>Monthly saving</span><span class="val">${aed(est.monthlySaving)}</span></li>
        <li><span>Simple payback</span><span class="val">≈ ${est.paybackYears.toFixed(1)} years</span></li>
        <li><span>25-year net saving</span><span class="val">${aedK(est.lifetimeBuyNet)}</span></li>
        ${roofNote}
      </ul>
      <p class="hint">You own the asset · adds property value · 25-year panel warranties typical.</p>
      ${roofPara}
    </div>
  </div>
  ${bandCallout(est, isHome)}
  ${disclaimerHTML()}
  ${leadFormHTML(uid, summary)}`;
}

function apartmentHTML(uid, kWhMonth, band, monthlyBill) {
  const summary = [
    "Mode: Home (apartment)",
    `Consumption: ${num(kWhMonth)} kWh/month`,
    `Band: ${band.name} (${band.fils} fils/kWh)`,
    `Estimated bill: ${aed(monthlyBill)}/month`,
    "Note: apartment - building-wide project advice requested"
  ].join(" | ");

  return `
  <h3 class="mb-4">Apartments work differently. Here is your picture</h3>
  <ul class="result-lines" style="max-width:26rem">
    <li><span>Estimated usage</span><span class="val">${num(kWhMonth)} kWh/month</span></li>
    <li><span>Your top band</span><span class="val">${band.name} · ${band.fils} fils/kWh</span></li>
    <li><span>Estimated bill</span><span class="val">${aed(monthlyBill)}/month</span></li>
  </ul>
  <div class="calc-note"><p>Apartment rooftops need building-owner approval; most of our apartment enquiries convert to a building-wide project. Leave your details and we will advise your options, including how to raise it with your owners association.</p></div>
  ${disclaimerHTML()}
  ${leadFormHTML(uid, summary)}`;
}

/* --------------------------------------------------------------------------
   Wiring
   -------------------------------------------------------------------------- */
let calcUid = 0;

function initCalc(root) {
  const uid = "calc" + (++calcUid);
  root.innerHTML = calcMarkup(uid);
  root.classList.add("calc");

  const form = root.querySelector("[data-calc-form]");
  const results = root.querySelector("[data-calc-results]");
  const toggles = root.querySelectorAll(".mode-toggle button");
  const panels = {
    home: root.querySelector('[data-panel="home"]'),
    business: root.querySelector('[data-panel="business"]')
  };
  let mode = "home";

  toggles.forEach(function (btn) {
    btn.addEventListener("click", function () {
      mode = btn.dataset.mode;
      toggles.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      panels.home.hidden = mode !== "home";
      panels.business.hidden = mode !== "business";
      results.hidden = true;
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (mode === "home") {
      const ptype = form.ptype.value;
      const beds = parseInt(form.beds.value, 10);
      const billInput = parseFloat(form.billHome.value);

      let kWhMonth;
      if (billInput > 0) {
        kWhMonth = kWhFromBill(billInput, CONFIG.residentialSlabs);
      } else {
        kWhMonth = HOME_KWH[ptype][beds];
        if (kWhMonth == null) {
          // Apartments cap at 4 bedrooms in the lookup; treat larger as 4BR.
          kWhMonth = HOME_KWH[ptype][4];
        }
      }

      if (ptype === "apartment") {
        const band = bandFor(kWhMonth, CONFIG.residentialSlabs);
        results.innerHTML = apartmentHTML(
          uid, kWhMonth, band, billAED(kWhMonth, CONFIG.residentialSlabs)
        );
      } else {
        const est = estimateFromMonthlyKWh(
          kWhMonth, CONFIG.residentialSlabs, CONFIG.capexPerKWpResidential, null
        );
        results.innerHTML = resultsHTML(uid, est, true);
      }
    } else {
      const btype = form.btype.value;
      const sqft = Math.max(500, parseFloat(form.sqft.value) || 0);
      const billInput = parseFloat(form.billBiz.value);

      let kWhMonth;
      // Warehouses: mostly unconditioned volume - halve the consumption proxy.
      const perSqFt = btype === "warehouse"
        ? CONFIG.commercialKWhPerSqFtYear / 2
        : CONFIG.commercialKWhPerSqFtYear;

      if (billInput > 0) {
        kWhMonth = kWhFromBill(billInput, CONFIG.commercialSlabs);
      } else {
        kWhMonth = (sqft * perSqFt) / 12;
      }

      // Warehouse roofs are big but finite: cap system size by roof area.
      const roofCap = btype === "warehouse"
        ? sqft * CONFIG.commercialRoofKWpPerSqFt
        : null;

      const est = estimateFromMonthlyKWh(
        kWhMonth, CONFIG.commercialSlabs, CONFIG.capexPerKWpCommercial, roofCap
      );
      results.innerHTML = resultsHTML(uid, est, false);
    }

    results.hidden = false;
    if (window.wireFormValidation) window.wireFormValidation(results);
    const heading = results.querySelector("h3");
    if (heading && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-calc]").forEach(initCalc);
});
