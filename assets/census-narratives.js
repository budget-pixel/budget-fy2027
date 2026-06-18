/* Walton County FY 2027 Budget — Census narrative renderer.
   Loads pre-computed Census Bureau figures from assets/census-data.json
   (produced offline by scripts/fetch-census-data.js via a scheduled GitHub
   Action — see .github/workflows/update-census-data.yml) and the Census
   Narratives Google Sheet, then fills the sheet's {{placeholder}} templates
   with those figures. The Census API is never called from the browser. */
(function () {
  "use strict";

  const CENSUS_DATA_JSON_URL = "../assets/census-data.json";
  const CENSUS_NARRATIVES_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=945636240&single=true&output=csv";
  // data.census.gov vizwidget geography code for Walton County, FL.
  const CENSUS_IFRAME_GEOGRAPHY = "050XX00US12131";

  // One block per row in the Census Narratives sheet. Each block pairs the
  // relevant data.census.gov visualization(s) with that row's narrative.
  // `fallback` is shown verbatim (no placeholder substitution) if either
  // census-data.json or the narrative sheet fails to load.
  const CENSUS_TOPIC_SECTIONS = [
    {
      sheetTitle: "population",
      title: "Age and Sex",
      iframes: [{ topic: "Age and Sex", height: 600 }],
      fallback: "Walton County has experienced significant population growth over the past decade, driven largely by new residents relocating from other parts of the United States. The county's age profile reflects its appeal as a retirement and vacation destination, with a median age that trends somewhat older than the state of Florida as a whole."
    },
    {
      sheetTitle: "Income",
      title: "Income and Earnings",
      iframes: [{ topic: "Income and Earnings", height: 300 }],
      fallback: "Household income in Walton County varies by household type, with married-couple families typically reporting higher earnings than the county's overall median. Compared to the rest of Florida and neighboring Okaloosa County, Walton County's household income figures reflect its mix of year-round residents and a strong tourism-driven local economy."
    },
    {
      sheetTitle: "Education",
      title: "Educational Attainment & School Enrollment",
      iframes: [
        { topic: "Educational Attainment", height: 350 },
        { topic: "School Enrollment", height: 300 }
      ],
      fallback: "A majority of Walton County residents age 25 and older have completed high school, with a meaningful share holding an associate, bachelor's, or graduate degree. School enrollment spans kindergarten through graduate study, reflecting the county's range of educational institutions and programs."
    },
    {
      sheetTitle: "Employment",
      title: "Class of Worker",
      iframes: [{ topic: "Class of Worker", height: 350 }],
      fallback: "Most working residents of Walton County are employed by private companies, with smaller shares self-employed, working for nonprofit organizations, or employed by local, state, or federal government. This employment mix is broadly similar to patterns seen statewide and in neighboring Okaloosa County."
    },
    {
      sheetTitle: "Housing",
      title: "Housing",
      iframes: [
        { topic: "Homeownership Rate", height: 500 },
        { topic: "Housing Units", height: 200 }
      ],
      fallback: "Walton County's housing stock spans a wide range of values, from entry-level homes to higher-end coastal properties. The county's homeownership rate and housing inventory reflect both its year-round resident population and its role as a popular vacation and second-home destination."
    },
    {
      sheetTitle: "Business and Economy",
      title: "Industry",
      iframes: [{ topic: "Industry", height: 700 }],
      fallback: "Walton County's economy is supported by a diverse mix of industries, including professional services, health care and education, retail, hospitality, and construction. This diversity helps the local economy remain resilient across different sectors and seasons."
    }
  ];

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sanitizeUrl(url) {
    const trimmed = String(url || "").trim();
    return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : "";
  }

  function normalizeTitle(value) {
    return String(value || "").trim().toLowerCase();
  }

  function splitIntoParagraphs(text) {
    if (!text) return [];
    const normalized = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return normalized
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  // Minimal CSV parser (handles quoted fields/commas), mirroring the one in
  // assets/budget-data.js. Kept self-contained so this module has no load
  // order dependency on budget-data.js.
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

  function fetchJSON(url) {
    return fetch(url, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error("Request failed with status " + res.status);
      return res.json();
    });
  }

  // Single pass over the template text: escapes plain text, converts
  // **bold** and [text](url) markdown, and substitutes {{placeholder}}
  // tokens with their value from `values` (or a visible warning if that
  // key has no data).
  function formatCensusNarrative(template, values) {
    const text = String(template === undefined || template === null ? "" : template);
    const pattern = /\*\*(.+?)\*\*|\[([^[\]]+)\]\(([^()\s]+)\)|\{\{(\w+)\}\}/gs;
    let result = "";
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      result += escapeHtml(text.slice(lastIndex, match.index));
      if (match[1] !== undefined) {
        result += "<strong>" + escapeHtml(match[1]) + "</strong>";
      } else if (match[4] !== undefined) {
        const key = match[4];
        const value = values ? values[key] : undefined;
        result += (value === undefined || value === null)
          ? '<span class="wc-census-missing" title="No Census value available for {{' + escapeHtml(key) + '}}">[data unavailable]</span>'
          : escapeHtml(String(value));
      } else {
        const linkText = escapeHtml(match[2]);
        const safeUrl = sanitizeUrl(match[3]);
        result += safeUrl
          ? '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + linkText + "</a>"
          : linkText;
      }
      lastIndex = pattern.lastIndex;
    }
    result += escapeHtml(text.slice(lastIndex));
    return result;
  }

  function renderIframeCards(iframes) {
    return iframes.map((f) =>
      '<div class="wc-census-iframe-card">' +
      '<p class="wc-census-iframe-label">' + escapeHtml(f.topic) + "</p>" +
      '<iframe src="https://data.census.gov/vizwidget?g=' + CENSUS_IFRAME_GEOGRAPHY +
      "&infoSection=" + encodeURIComponent(f.topic) + '" height="' + f.height + '" title="' + escapeHtml(f.topic) + '"></iframe>' +
      "</div>"
    ).join("");
  }

  function renderCensusSections(container, sections, narrativeRows, censusValues, metadata, dataLoadFailed) {
    const lastUpdatedLabel = metadata && metadata.lastUpdated ? metadata.lastUpdated : "unavailable";

    container.innerHTML = sections.map((section, index) => {
      const row = narrativeRows.find((r) => normalizeTitle(r.Title) === normalizeTitle(section.sheetTitle));
      const template = row && row["Narrative Template"];
      const useFallback = dataLoadFailed || !template;

      const narrativeHtml = useFallback
        ? splitIntoParagraphs(section.fallback).map((p) => "<p>" + escapeHtml(p) + "</p>").join("")
        : splitIntoParagraphs(template).map((p) => "<p>" + formatCensusNarrative(p, censusValues) + "</p>").join("");

      const sourceNote = useFallback
        ? '<p class="wc-census-source"><em>Source: U.S. Census Bureau. Narrative shown is a default summary; live figures are temporarily unavailable.</em></p>'
        : '<p class="wc-census-source"><em>Source: U.S. Census Bureau, ACS 5-Year Estimates. Data current as of ' + escapeHtml(lastUpdatedLabel) + ".</em></p>";

      const vizCardHtml =
        '<div class="wc-census-viz-card wc-census-card-stack">' + renderIframeCards(section.iframes) + "</div>";
      const narrativeCardHtml =
        '<div class="wc-census-narrative-card">' +
        "<h2>" + escapeHtml(section.title) + "</h2>" +
        narrativeHtml + sourceNote +
        "</div>";

      return (
        '<section class="wc-census-topic-block">' +
        narrativeCardHtml + vizCardHtml +
        "</section>"
      );
    }).join("");
  }

  function initCensusNarrativesPage() {
    const container = document.getElementById("census-statistics-section");
    if (!container) return;

    container.innerHTML = '<div class="wc-data-loading">Loading Census data...</div>';

    Promise.allSettled([fetchJSON(CENSUS_DATA_JSON_URL), fetchCSV(CENSUS_NARRATIVES_CSV_URL)])
      .then(([jsonResult, csvResult]) => {
        const dataLoadFailed = jsonResult.status !== "fulfilled";
        if (dataLoadFailed) console.error("CensusNarratives: failed to load census-data.json", jsonResult.reason);
        if (csvResult.status !== "fulfilled") console.error("CensusNarratives: failed to load Census Narratives sheet", csvResult.reason);

        const censusData = dataLoadFailed ? { metadata: {}, values: {} } : jsonResult.value;
        const narrativeRows = csvResult.status === "fulfilled" ? csvResult.value : [];

        renderCensusSections(container, CENSUS_TOPIC_SECTIONS, narrativeRows, censusData.values || {}, censusData.metadata || {}, dataLoadFailed);
      });
  }

  document.addEventListener("DOMContentLoaded", initCensusNarrativesPage);

  window.WCCensusNarratives = {
    initCensusNarrativesPage,
    formatCensusNarrative
  };
})();
