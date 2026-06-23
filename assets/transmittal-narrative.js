/* Walton County FY 2027 Budget — Transmittal Letter narrative renderer.
   Loads the letter body from the "trasmittal leter" and "letter values"
   Google Sheet tabs (published CSV) and renders it into the Transmittal
   Letter page. Mirrors the self-contained fetch+parse pattern used by
   assets/census-narratives.js: no Supabase queries, no raw budget data,
   just two published-sheet CSVs and placeholder substitution. */
(function () {
  "use strict";

  // Same published workbook used throughout assets/budget-data.js, just two
  // additional tabs: "trasmittal leter" (gid 1029770788) and
  // "letter values" (gid 1116334987). Tab names are intentionally spelled
  // exactly as they appear in the sheet.
  const TRANSMITTAL_LETTER_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=1029770788&single=true&output=csv";
  const LETTER_VALUES_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=1116334987&single=true&output=csv";

  const LOADING_HTML = '<p class="wc-transmittal-letter-status">Loading transmittal letter…</p>';
  const EMPTY_HTML = '<p class="wc-transmittal-letter-status">The transmittal letter is not currently available.</p>';
  const ERROR_HTML = '<p class="wc-transmittal-letter-status">The transmittal letter could not be loaded.</p>';

  // Sections that are structural bookends of the letter (greeting / sign-off)
  // rather than a named topic, so they never get an auto-generated heading.
  const HEADINGLESS_SECTIONS = new Set(["opening", "closing"]);

  function isDebugMode() {
    try {
      return new URLSearchParams(window.location.search).get("debugNarrative") === "1";
    } catch (e) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode() || !window.console || !console.log) return;
    console.log.apply(console, ["[TransmittalNarrative]"].concat(Array.prototype.slice.call(arguments)));
  }

  function debugWarn() {
    if (!isDebugMode() || !window.console || !console.warn) return;
    console.warn.apply(console, ["[TransmittalNarrative]"].concat(Array.prototype.slice.call(arguments)));
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Minimal CSV parser (handles quoted fields/commas), mirroring the one in
  // assets/census-narratives.js and assets/budget-data.js. Kept
  // self-contained so this module has no load-order dependency on either.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const src = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else {
          field += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];

    const headers = rows[0].map((h) => h.trim());
    return rows
      .slice(1)
      .filter((r) => r.some((cell) => String(cell || "").trim() !== ""))
      .map((r) => {
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ""; });
        return obj;
      });
  }

  function fetchCSV(url) {
    return fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed with status " + res.status);
        return res.text();
      })
      .then(parseCSV);
  }

  function isActiveRow(row) {
    return String((row && row.active) || "").trim().toUpperCase() === "TRUE";
  }

  // key -> resolved display string (display_value, falling back to value).
  function buildValuesLookup(valueRows) {
    const lookup = new Map();
    (valueRows || []).forEach((row) => {
      const key = String((row && row.key) || "").trim();
      if (!key) return;
      const display = String((row && row.display_value) || "").trim();
      const raw = String((row && row.value) || "").trim();
      lookup.set(key, display || raw);
    });
    return lookup;
  }

  // Replaces {{KEY}} tokens with their resolved value. An unmatched key is
  // left visible in the text (per spec) -- missingKeys just collects it so
  // it can be surfaced in the debug log.
  function applyPlaceholders(text, valuesLookup, missingKeys) {
    return String(text || "").replace(/\{\{(\w+)\}\}/g, function (match, key) {
      if (valuesLookup.has(key)) return valuesLookup.get(key);
      missingKeys.add(key);
      return match;
    });
  }

  function normalizeSection(value) {
    return String(value || "").trim().toLowerCase();
  }

  // Renders one run of consecutive same-content_type rows. Bullets collapse
  // into a single <ul>; signature lines collapse into a single block joined
  // with <br> (e.g. name + title); everything else renders one tag per row.
  function renderGroup(group, valuesLookup, missingKeys) {
    const texts = group.rows.map((row) => applyPlaceholders(row.narrative_text, valuesLookup, missingKeys));
    switch (group.type) {
      case "bullet":
        return "<ul>" + texts.map((t) => "<li>" + escapeHtml(t) + "</li>").join("") + "</ul>";
      case "signature":
        return '<p class="wc-transmittal-signature">' + texts.map((t) => escapeHtml(t)).join("<br>") + "</p>";
      case "salutation":
        return texts.map((t) => '<p class="wc-transmittal-salutation">' + escapeHtml(t) + "</p>").join("");
      case "section_heading":
        return texts.map((t) => "<h3>" + escapeHtml(t) + "</h3>").join("");
      case "paragraph":
      default:
        return texts.map((t) => "<p>" + escapeHtml(t) + "</p>").join("");
    }
  }

  function renderSection(sectionName, rows, valuesLookup, missingKeys) {
    // Only bullet/signature runs collapse into one group; every other
    // content_type renders one tag per row (so consecutive paragraphs stay
    // as separate <p> tags rather than merging together).
    const groups = [];
    rows.forEach((row) => {
      const last = groups[groups.length - 1];
      const collapsible = row.content_type === "bullet" || row.content_type === "signature";
      if (collapsible && last && last.type === row.content_type) {
        last.rows.push(row);
      } else {
        groups.push({ type: row.content_type, rows: [row] });
      }
    });

    const normalized = normalizeSection(sectionName);
    const hasExplicitHeading = groups.some((g) => g.type === "section_heading");
    const showAutoHeading = normalized && !HEADINGLESS_SECTIONS.has(normalized) && !hasExplicitHeading;
    const headingHtml = showAutoHeading ? "<h3>" + escapeHtml(sectionName) + "</h3>" : "";

    return headingHtml + groups.map((g) => renderGroup(g, valuesLookup, missingKeys)).join("");
  }

  // Groups active rows by section (in the order each section first appears),
  // sorts each section's rows by sort_order, then renders section by section.
  function renderLetter(container, sheetRows, valuesLookup) {
    const missingKeys = new Set();
    const activeRows = (sheetRows || []).filter(isActiveRow);

    if (!activeRows.length) {
      container.innerHTML = EMPTY_HTML;
      return { sectionCount: 0, missingKeys: missingKeys, activeRowCount: 0 };
    }

    const sectionOrder = [];
    const sectionRows = new Map();
    activeRows.forEach((row) => {
      const section = row.section || "";
      if (!sectionRows.has(section)) {
        sectionRows.set(section, []);
        sectionOrder.push(section);
      }
      sectionRows.get(section).push(row);
    });
    sectionRows.forEach((rows) => {
      rows.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    });

    const html = sectionOrder
      .map((section) => renderSection(section, sectionRows.get(section), valuesLookup, missingKeys))
      .join("");

    container.innerHTML = html;
    return { sectionCount: sectionOrder.length, missingKeys: missingKeys, activeRowCount: activeRows.length };
  }

  function initTransmittalLetter() {
    const container = document.getElementById("wc-transmittal-letter-body");
    if (!container) return;

    container.innerHTML = LOADING_HTML;

    Promise.allSettled([fetchCSV(TRANSMITTAL_LETTER_CSV_URL), fetchCSV(LETTER_VALUES_CSV_URL)])
      .then(([letterResult, valuesResult]) => {
        debugLog("transmittal letter sheet URL:", TRANSMITTAL_LETTER_CSV_URL);
        debugLog("letter values sheet URL:", LETTER_VALUES_CSV_URL);

        if (letterResult.status !== "fulfilled") {
          console.error("TransmittalNarrative: failed to load the transmittal letter sheet", letterResult.reason);
          container.innerHTML = ERROR_HTML;
          return;
        }

        const sheetRows = letterResult.value || [];
        if (valuesResult.status !== "fulfilled") {
          console.error("TransmittalNarrative: failed to load the letter values sheet", valuesResult.reason);
        }
        const valueRows = valuesResult.status === "fulfilled" ? valuesResult.value : [];
        const valuesLookup = buildValuesLookup(valueRows);

        const result = renderLetter(container, sheetRows, valuesLookup);

        debugLog("transmittal rows loaded:", sheetRows.length);
        debugLog("active rows rendered:", result.activeRowCount);
        debugLog("placeholder keys loaded:", Array.from(valuesLookup.keys()));
        debugLog("final rendered section count:", result.sectionCount);
        if (result.missingKeys.size) {
          debugWarn("missing placeholder keys:", Array.from(result.missingKeys));
        } else {
          debugLog("missing placeholder keys: none");
        }
      })
      .catch((err) => {
        console.error("TransmittalNarrative: unexpected error rendering the transmittal letter", err);
        container.innerHTML = ERROR_HTML;
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTransmittalLetter);
  } else {
    initTransmittalLetter();
  }

  window.WCTransmittalNarrative = {
    initTransmittalLetter
  };
})();
