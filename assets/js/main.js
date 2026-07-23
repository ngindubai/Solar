/* ==========================================================================
   {{BRAND_NAME}} — main.js
   Navigation, sticky CTA, form validation, scroll reveals, and the
   signature journey-line animation: two thick lines run off the hero as
   you scroll, one leading to Free Solar (PPA), the other to Buy Solar,
   then merging and flowing on to the calculator.
   Vanilla JS. No dependencies. Everything degrades gracefully.
   ========================================================================== */

(function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------
     Mobile navigation
     ------------------------------------------------------------------ */
  var navToggle = document.querySelector(".nav-toggle");
  var siteNav = document.getElementById("site-nav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      var open = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.textContent = open ? "Close" : "Menu";
    });
  }

  /* ------------------------------------------------------------------
     Sticky mobile CTA bar
     ------------------------------------------------------------------ */
  var stickyCta = document.querySelector(".sticky-cta");
  if (stickyCta) {
    var ctaShown = false;
    var onScrollCta = function () {
      var shouldShow = window.scrollY > 420;
      if (shouldShow !== ctaShown) {
        ctaShown = shouldShow;
        stickyCta.classList.toggle("is-shown", shouldShow);
      }
    };
    window.addEventListener("scroll", onScrollCta, { passive: true });
    onScrollCta();
  }

  /* ------------------------------------------------------------------
     Hero form "more detail" expander
     ------------------------------------------------------------------ */
  document.querySelectorAll("[data-form-expand]").forEach(function (btn) {
    var target = document.getElementById(btn.getAttribute("aria-controls"));
    if (!target) return;
    btn.addEventListener("click", function () {
      var isHidden = target.hasAttribute("hidden");
      if (isHidden) {
        target.removeAttribute("hidden");
      } else {
        target.setAttribute("hidden", "");
      }
      btn.setAttribute("aria-expanded", String(isHidden));
      btn.textContent = isHidden
        ? "Hide extra detail"
        : "Add detail (optional)";
    });
  });

  /* ------------------------------------------------------------------
     Client-side form validation with inline messages
     ------------------------------------------------------------------ */
  function wireFormValidation(scope) {
    (scope || document).querySelectorAll("form[action*='formsubmit']").forEach(function (form) {
      if (form.dataset.validated) return;
      form.dataset.validated = "true";
      form.setAttribute("novalidate", "");
      form.addEventListener("submit", function (e) {
        var valid = true;
        form.querySelectorAll("[required]").forEach(function (input) {
          var field = input.closest(".field");
          var ok = input.checkValidity();
          if (field) field.classList.toggle("is-invalid", !ok);
          if (!ok) {
            valid = false;
          }
        });
        if (!valid) {
          e.preventDefault();
          var firstBad = form.querySelector(".field.is-invalid input, .field.is-invalid select, .field.is-invalid textarea");
          if (firstBad) firstBad.focus();
        }
      });
      form.querySelectorAll("[required]").forEach(function (input) {
        input.addEventListener("input", function () {
          var field = input.closest(".field");
          if (field && input.checkValidity()) field.classList.remove("is-invalid");
        });
      });
    });
  }
  window.wireFormValidation = wireFormValidation;
  wireFormValidation(document);

  /* ------------------------------------------------------------------
     Tariff figures rendered from CONFIG (single source of truth).
     Any element with data-tariff has its text kept in sync with the
     CONFIG object in /assets/js/calculator.js (loaded on pages that
     quote tariffs). Markup carries the same values for no-JS and SEO.
     ------------------------------------------------------------------ */
  function renderTariffs() {
    if (typeof CONFIG === "undefined") return;
    var map = {
      "res-1": CONFIG.residentialSlabs[0].fils,
      "res-2": CONFIG.residentialSlabs[1].fils,
      "res-3": CONFIG.residentialSlabs[2].fils,
      "res-4": CONFIG.residentialSlabs[3].fils,
      "com-1": CONFIG.commercialSlabs[0].fils,
      "com-2": CONFIG.commercialSlabs[1].fils,
      "fuel": CONFIG.fuelSurchargeFils,
      "yield": CONFIG.sunYieldKWhPerKWpYear,
      "ppa-discount": Math.round(CONFIG.ppaDiscount * 100),
      "capex-res": CONFIG.capexPerKWpResidential.toLocaleString("en-GB"),
      "capex-com": CONFIG.capexPerKWpCommercial.toLocaleString("en-GB"),
      "life": CONFIG.systemLifeYears
    };
    document.querySelectorAll("[data-tariff]").forEach(function (el) {
      var key = el.getAttribute("data-tariff");
      if (map[key] !== undefined) el.textContent = map[key];
    });
  }

  /* ------------------------------------------------------------------
     Scroll reveals
     ------------------------------------------------------------------ */
  function initReveals() {
    var targets = document.querySelectorAll(".reveal");
    if (!targets.length) return;
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     Journey lines — the fork
     ------------------------------------------------------------------
     A scope element [data-journey-scope] wraps the hero and the fork
     section. An SVG is laid over it. Path geometry is computed from the
     real positions of:
       [data-line-start]          bottom-centre of the hero content
       [data-path-target="free"]  the Free Solar (PPA) container
       [data-path-target="buy"]   the Buy Solar container
       [data-line-end]            where the merged line exits the section
     Five paths are drawn in sequence as the user scrolls:
       fork A + fork B  →  out A + out B (merge)  →  tail to the end.
     ------------------------------------------------------------------ */
  function initJourney() {
    var scope = document.querySelector("[data-journey-scope]");
    if (!scope) return;

    var svg = scope.querySelector(".journey-lines");
    var startEl = scope.querySelector("[data-line-start]");
    var freeEl = scope.querySelector('[data-path-target="free"]');
    var buyEl = scope.querySelector('[data-path-target="buy"]');
    var endEl = scope.querySelector("[data-line-end]");
    if (!svg || !startEl || !freeEl || !buyEl || !endEl) return;

    var paths = [];

    function rel(el) {
      var s = scope.getBoundingClientRect();
      var r = el.getBoundingClientRect();
      return {
        top: r.top - s.top,
        bottom: r.bottom - s.top,
        cx: r.left - s.left + r.width / 2,
        left: r.left - s.left,
        right: r.right - s.left
      };
    }

    function build() {
      var w = scope.offsetWidth;
      var h = scope.offsetHeight;
      svg.setAttribute("viewBox", "0 0 " + w + " " + h);
      svg.setAttribute("width", w);
      svg.setAttribute("height", h);
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      var start = rel(startEl);
      var free = rel(freeEl);
      var buy = rel(buyEl);
      var end = rel(endEl);
      var isStacked = free.top < buy.top - 40 && Math.abs(free.cx - buy.cx) < 60;

      var sx = start.cx;
      var sy = start.bottom + 8;
      var d = [];

      if (!isStacked) {
        /* Side-by-side: two curves that swing outward EARLY so they flank
           the centred intro text instead of crossing it, then drop
           vertically into each card. */
        var gap = 26;
        d.push(
          "M" + (sx - gap) + " " + sy +
          " C " + (sx - gap) + " " + (sy + 110) + ", " + free.cx + " " + (sy + 60) + ", " + free.cx + " " + (sy + 230) +
          " L " + free.cx + " " + (free.top - 2)
        );
        d.push(
          "M" + (sx + gap) + " " + sy +
          " C " + (sx + gap) + " " + (sy + 130) + ", " + buy.cx + " " + (sy + 80) + ", " + buy.cx + " " + (sy + 260) +
          " L " + buy.cx + " " + (buy.top - 2)
        );
        /* Out of each card, curving back to a shared centre line */
        var mergeY = Math.max(free.bottom, buy.bottom) + 100;
        var mx = w / 2;
        d.push(
          "M" + free.cx + " " + (free.bottom + 2) +
          " C " + free.cx + " " + (free.bottom + 100) + ", " + mx + " " + (mergeY - 100) + ", " + mx + " " + mergeY
        );
        d.push(
          "M" + buy.cx + " " + (buy.bottom + 2) +
          " C " + buy.cx + " " + (buy.bottom + 100) + ", " + mx + " " + (mergeY - 100) + ", " + mx + " " + mergeY
        );
        d.push("M" + mx + " " + mergeY + " L " + end.cx + " " + end.top);
      } else {
        /* Stacked (mobile): both lines swing into the page gutters early —
           clear of the centred text — then curve into their cards. Line A
           takes the left gutter into card one; line B takes the right
           gutter past card one and into card two. */
        var leftG = Math.max(6, free.left - 14);
        var rightG = Math.min(w - 6, buy.right + 14);
        var inA = { x: free.left + 46, y: free.top - 2 };
        var inB = { x: buy.right - 46, y: buy.top - 2 };
        d.push(
          "M" + (sx - 14) + " " + sy +
          " C " + (sx - 70) + " " + (sy + 60) + ", " + leftG + " " + (sy + 60) + ", " + leftG + " " + (sy + 170) +
          " L " + leftG + " " + (inA.y - 110) +
          " C " + leftG + " " + (inA.y - 40) + ", " + inA.x + " " + (inA.y - 70) + ", " + inA.x + " " + inA.y
        );
        d.push(
          "M" + (sx + 14) + " " + sy +
          " C " + (sx + 70) + " " + (sy + 60) + ", " + rightG + " " + (sy + 60) + ", " + rightG + " " + (sy + 170) +
          " L " + rightG + " " + (inB.y - 110) +
          " C " + rightG + " " + (inB.y - 40) + ", " + inB.x + " " + (inB.y - 70) + ", " + inB.x + " " + inB.y
        );
        var mergeY2 = buy.bottom + 80;
        d.push(
          "M" + inA.x + " " + (free.bottom + 2) +
          " C " + inA.x + " " + (free.bottom + 50) + ", " + leftG + " " + (free.bottom + 40) + ", " + leftG + " " + (free.bottom + 130) +
          " L " + leftG + " " + (buy.bottom - 40) +
          " C " + leftG + " " + (mergeY2 - 30) + ", " + (w / 2) + " " + (mergeY2 - 60) + ", " + (w / 2) + " " + mergeY2
        );
        d.push(
          "M" + inB.x + " " + (buy.bottom + 2) +
          " C " + inB.x + " " + (buy.bottom + 40) + ", " + (w / 2) + " " + (mergeY2 - 40) + ", " + (w / 2) + " " + mergeY2
        );
        d.push("M" + (w / 2) + " " + mergeY2 + " L " + end.cx + " " + end.top);
      }

      paths = d.map(function (def) {
        var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
        p.setAttribute("d", def);
        svg.appendChild(p);
        var len = p.getTotalLength();
        p.style.strokeDasharray = len + " " + len;
        p.style.strokeDashoffset = reducedMotion.matches ? 0 : len;
        return { el: p, len: len };
      });
    }

    /* Draw order: [0,1] fork · [2,3] merge · [4] tail.
       Each group maps to a slice of the overall scroll progress. */
    var groups = [
      { idx: [0, 1], from: 0.0, to: 0.55 },
      { idx: [2, 3], from: 0.55, to: 0.85 },
      { idx: [4], from: 0.85, to: 1.0 }
    ];

    var ticking = false;
    function drawFrame() {
      ticking = false;
      var rect = scope.getBoundingClientRect();
      var vh = window.innerHeight;
      /* Progress: 0 with the page unscrolled, 1 when the scope bottom
         sits comfortably above the fold — so the fork finishes drawing
         just as the second card settles into view. */
      var scopeTop = rect.top + window.scrollY;
      var denom = Math.max(200, scopeTop + rect.height - vh * 0.6);
      var p = window.scrollY / denom;
      p = Math.max(0, Math.min(1, p));

      groups.forEach(function (g) {
        var gp = (p - g.from) / (g.to - g.from);
        gp = Math.max(0, Math.min(1, gp));
        g.idx.forEach(function (i) {
          var path = paths[i];
          if (path) path.el.style.strokeDashoffset = path.len * (1 - gp);
        });
      });
    }

    function requestDraw() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(drawFrame);
      }
    }

    var resizeTimer;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        build();
        if (!reducedMotion.matches) drawFrame();
      }, 150);
    }

    build();
    if (reducedMotion.matches) return; /* lines render fully drawn */
    drawFrame();
    window.addEventListener("scroll", requestDraw, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("load", function () { build(); drawFrame(); });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function boot() {
    renderTariffs();
    initReveals();
    initJourney();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
