/* Walton County FY 2027 Budget — live Google Sheets data layer.
   Fetches, parses, and renders department + financial summary data from the
   published budget CSVs. Exposes window.WCBudgetData for reuse on any page. */
(function () {
  "use strict";

  const DATA_SOURCES = {
    expenditures: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=0&single=true&output=csv",
    revenues: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=1812049672&single=true&output=csv",
    staffing: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=676680519&single=true&output=csv",
    performanceMeasures: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=95242207&single=true&output=csv",
    machinery: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=203949583&single=true&output=csv",
    departmentNarratives: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=445845528&single=true&output=csv"
  };

  const LOADING_MESSAGE = "Loading budget data...";
  const ERROR_MESSAGE = "Budget data could not be loaded. Please try again later.";

  // The published sheets use department names that differ slightly between
  // tabs (and from this site's page titles). These aliases map a page's
  // normalized department name to the additional normalized Dept_Name
  // values it should also match across every dataset.
  const DEPT_ALIASES = {
    "sheriffs office": ["walton county sheriffs office", "sheriff"],
    "clerk of courts and county comptroller": ["clerk of court", "clerk of circuit court"],
    "engineering department": ["public works engineering services", "engineering services"],
    "environmental resources": ["environmental services"],
    "probation": ["probation services"],
    "purchasing": ["procurement"],
    "court technology and innovations": [
      "court technology court administration",
      "court technology public defender",
      "court technology state attorney",
      "court technology",
      "court innovations"
    ],
    "statutory and other agency funding": ["statutory and other agency fund"],
    "tourism beach operations": ["beach operations", "beach renourishment", "beach tram"],
    "tourism lifeguard services and beach safety": ["south walton fire lifeguard services"],
    "south walton fire and state control": ["south walton fire district", "state fire control"],
    "code compliance": ["code compliance beach", "code compliance street"],
    "libraries": ["county libraries"]
  };

  // Hover-tip copy for each budget category, shown via the same
  // "i" bubble treatment used on the site's static FY-history tables.
  const TYPE_TOOLTIPS = {
    "Personnel Services":
      "Covers employee compensation and benefits, including salaries, overtime, weekend and holiday pay, seasonal workers, FICA, Florida Retirement System (FRS) contributions, health insurance, workers’ compensation, life insurance, and paid leave buybacks.",
    "Operating Expenditures":
      "Covers the day-to-day costs of providing County services, including utilities, fuel, maintenance, professional services, software, office supplies, communications, training, and other routine operating expenses.",
    "Capital Outlay":
      "Covers major investments in long-term County assets, including vehicles, machinery and equipment, technology systems, buildings, facility improvements, roads, drainage, parks, and other infrastructure projects.",
    "Debt Service":
      "Covers principal and interest payments on County debt obligations, including bonds, loans, and other long-term financing arrangements.",
    "Grants and Aid":
      "Covers funding provided to other governments, agencies, and organizations through grants, aid payments, and other transfers in support of County program objectives.",
    "Other Uses":
      "Covers transfers, reserves, and other budgetary uses not classified as personnel, operating, capital, debt service, or grants and aid expenditures.",
    "General Government Taxes": "Ad valorem, tourist development, and other locally levied taxes.",
    "Intergovernmental Revenues": "Grants, shared revenues, and payments received from federal and state government sources.",
    "Charges for Services": "Fees charged for specific County services rendered to residents and businesses.",
    "Permits Fees and Special Assessments": "Revenue from permits, licenses, and special assessments.",
    "Miscellaneous Revenue": "Interest earnings, donations, and other revenue not classified elsewhere.",
    "Other Sources": "Transfers in, debt proceeds, and other non-recurring funding sources.",
    "Judgments, Fines and Forfeits": "Revenue from court judgments, fines, and forfeitures."
  };

  const PRIOR_YEARS_KEY = "wc_show_prior_years";

  const cache = {
    expenditures: [],
    revenues: [],
    staffing: [],
    performanceMeasures: [],
    machinery: [],
    departmentNarratives: [],
    errors: {}
  };
  let loadPromise = null;

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Splits a raw narrative cell's text into paragraphs. Google Sheets cells
  // can contain multiple paragraphs separated by blank lines (or multiple
  // consecutive line breaks); this normalizes line endings, splits on those
  // blank-line boundaries, trims each result, and drops empty entries while
  // preserving original order. Used for any long-form narrative field loaded
  // from Google Sheets (Statement of Function, mission statements, department
  // descriptions, budget highlights, etc.), not just one specific field.
  function splitIntoParagraphs(text) {
    if (!text) return [];
    const normalized = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return normalized
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  function ensureTooltipBubble() {
    let bubble = document.querySelector(".wc-budget-line-tooltip-bubble");
    if (!bubble) {
      bubble = document.createElement("div");
      bubble.className = "wc-budget-line-tooltip-bubble";
      bubble.setAttribute("role", "tooltip");
      document.body.appendChild(bubble);
    }
    return bubble;
  }

  function positionTooltip(anchor, bubble) {
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(300, Math.max(220, window.innerWidth - 32));
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
    let top = rect.bottom + 8;
    bubble.style.setProperty("width", width + "px", "important");
    bubble.style.setProperty("left", left + "px", "important");
    bubble.style.setProperty("top", top + "px", "important");
    if (top + bubble.offsetHeight > window.innerHeight - 16) {
      top = Math.max(16, rect.top - bubble.offsetHeight - 8);
      bubble.style.setProperty("top", top + "px", "important");
    }
  }

  function bindTooltipAnchors(container) {
    if (!container) return;
    container.querySelectorAll(".wc-budget-line-tooltip-anchor").forEach((anchor) => {
      if (anchor.getAttribute("data-wc-tooltip-bound") === "true") return;
      const show = () => {
        const bubble = ensureTooltipBubble();
        bubble.textContent = anchor.getAttribute("data-wc-tooltip") || "";
        bubble.classList.add("is-visible");
        positionTooltip(anchor, bubble);
      };
      const hide = () => {
        const bubble = document.querySelector(".wc-budget-line-tooltip-bubble");
        if (bubble) bubble.classList.remove("is-visible");
      };
      anchor.addEventListener("mouseenter", show);
      anchor.addEventListener("focus", show);
      anchor.addEventListener("mouseleave", hide);
      anchor.addEventListener("blur", hide);
      anchor.setAttribute("data-wc-tooltip-bound", "true");
    });
  }

  function categoryCellHtml(label, showTooltip) {
    const message = showTooltip === false ? null : TYPE_TOOLTIPS[label];
    const anchor = message
      ? '<button type="button" class="wc-budget-line-tooltip-anchor" aria-label="' +
        escapeHtml(label) + ' information" data-wc-tooltip="' + escapeHtml(message) + '">i</button>'
      : "";
    return '<td class="wc-budget-line-tooltip-cell">' + escapeHtml(label || "Other") + anchor + "</td>";
  }

  function toNumber(value) {
    if (value === null || value === undefined) return 0;
    let s = String(value).trim();
    if (!s || s === "-" || s === "–" || s.toUpperCase() === "N/A") return 0;
    let negative = false;
    if (/^\(.*\)$/.test(s)) {
      negative = true;
      s = s.slice(1, -1);
    }
    s = s.replace(/[$,%]/g, "").trim();
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return 0;
    return negative ? -n : n;
  }

  function formatCurrency(value, decimals) {
    const n = typeof value === "number" ? value : toNumber(value);
    const d = typeof decimals === "number" ? decimals : 0;
    const formatted = Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
    return (n < 0 ? "-$" : "$") + formatted;
  }

  function formatNumber(value, decimals) {
    const n = typeof value === "number" ? value : toNumber(value);
    const d = typeof decimals === "number" ? decimals : (n % 1 !== 0 ? 1 : 0);
    return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function uniqueSorted(values) {
    return Array.from(
      new Set(
        values
          .filter(Boolean)
          .map((v) => String(v).trim())
          .filter((v) => v && v.toUpperCase() !== "#N/A")
      )
    ).sort((a, b) => a.localeCompare(b));
  }

  // RFC4180-style CSV parser: handles quoted fields, embedded commas/newlines,
  // and escaped quotes ("").
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
          if (src[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
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
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    if (!rows.length) return [];

    const headers = rows[0].map((h) => h.trim());
    return rows
      .slice(1)
      .filter((r) => r.some((cell) => String(cell || "").trim() !== ""))
      .map((r) => {
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = r[idx] !== undefined ? r[idx] : "";
        });
        return obj;
      });
  }

  function normalizeDeptName(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function matchNames(deptName) {
    const norm = normalizeDeptName(deptName);
    const set = new Set([norm]);
    (DEPT_ALIASES[norm] || []).forEach((alias) => set.add(alias));
    return set;
  }

  function rowsByDeptName(rows, deptName) {
    if (!deptName) return [];
    const set = matchNames(deptName);
    return rows.filter((r) => set.has(normalizeDeptName(r.Dept_Name)));
  }

  function rowsByDeptCode(rows, deptCode) {
    if (!deptCode) return [];
    const code = String(deptCode).trim();
    return rows.filter((r) => String(r.Dept_Code || "").trim() === code);
  }

  function rowsForDepartment(rows, deptName, deptCode) {
    rows = rows || [];
    if (deptCode) {
      const byCode = rowsByDeptCode(rows, deptCode);
      if (byCode.length) return byCode;
    }
    return rowsByDeptName(rows, deptName);
  }

  function getDepartmentNameFromPage() {
    const explicit = document.querySelector("[data-department]");
    if (explicit && explicit.dataset.department && explicit.dataset.department.trim()) {
      return explicit.dataset.department.trim();
    }
    const h1 = document.querySelector("h1.page-title");
    return h1 ? h1.textContent.trim() : "";
  }

  function getDeptCodeFromPage() {
    const el = document.querySelector("[data-dept-code]");
    return el && el.dataset.deptCode ? el.dataset.deptCode.trim() : "";
  }

  function getDepartmentExpenses(deptName, deptCode) {
    return rowsForDepartment(cache.expenditures, deptName, deptCode);
  }
  function getDepartmentRevenues(deptName, deptCode) {
    return rowsForDepartment(cache.revenues, deptName, deptCode);
  }
  function getDepartmentStaffing(deptName, deptCode) {
    return rowsForDepartment(cache.staffing, deptName, deptCode);
  }
  function getDepartmentMachinery(deptName, deptCode) {
    return rowsForDepartment(cache.machinery, deptName, deptCode);
  }
  function getDepartmentPerformanceMeasures(deptName, deptCode) {
    return rowsForDepartment(cache.performanceMeasures, deptName, deptCode);
  }
  // Returns an array of narrative paragraphs. When the page's own name has a
  // direct row in the sheet, that row alone is authoritative. Otherwise (e.g.
  // a page like "Court Technology & Innovations" whose budget is split across
  // multiple differently-named rows in the sheet with no row of its own) all
  // distinct alias-matched narratives are combined.
  function getDepartmentNarrative(deptName, deptCode) {
    const rows = rowsForDepartment(cache.departmentNarratives, deptName, deptCode);
    const withText = rows.filter((r) => r.Narrative && r.Narrative.trim());
    if (!withText.length) return [];

    const norm = normalizeDeptName(deptName);
    const exact = withText.find((r) => normalizeDeptName(r.Dept_Name) === norm);
    if (exact) return splitIntoParagraphs(exact.Narrative);

    const seen = new Set();
    const paragraphs = [];
    withText.forEach((r) => {
      const text = r.Narrative.trim();
      if (!seen.has(text)) {
        seen.add(text);
        paragraphs.push(...splitIntoParagraphs(text));
      }
    });
    return paragraphs;
  }

  // ---- normalization of raw CSV rows into typed records ----

  function normalizeExpenditureRow(row) {
    return {
      Dept_Code: (row.Dept_Code || "").trim(),
      Dept_Name: (row.Dept_Name || "").trim(),
      Project_Code: (row.Project_Code || "").trim(),
      Project_Name: (row.Project_Name || "").trim(),
      Object_Code: (row.Object_Code || "").trim(),
      Object_Name: (row.Object_Name || "").trim(),
      Object_Type: (row.Object_Type || "").trim(),
      FY2020_Actual: toNumber(row.FY2020_Actual),
      FY2021_Actual: toNumber(row.FY2021_Actual),
      FY2022_Actual: toNumber(row.FY2022_Actual),
      FY2023_Actual: toNumber(row.FY2023_Actual),
      FY2024_Actual: toNumber(row.FY2024_Actual),
      FY2025_Actual: toNumber(row.FY2025_Actual),
      FY2026_Budget: toNumber(row.FY2026_Budget),
      FY2027_Proposed: toNumber(row.FY2027_Proposed)
    };
  }

  function normalizeRevenueRow(row) {
    return {
      Dept_Code: (row.Dept_Code || "").trim(),
      Dept_Name: (row.Dept_Name || "").trim(),
      Project_Name: (row.Project_Name || "").trim(),
      Revenue_Code: (row.Revenue_Code || "").trim(),
      Revenue_Name: (row.Revenue_Name || "").trim(),
      Revenue_Type: (row.Revenue_Type || "").trim(),
      FY2020_Actual: toNumber(row.FY2020_Actual),
      FY2021_Actual: toNumber(row.FY2021_Actual),
      FY2022_Actual: toNumber(row.FY2022_Actual),
      FY2023_Actual: toNumber(row.FY2023_Actual),
      FY2024_Actual: toNumber(row.FY2024_Actual),
      FY2025_Actual: toNumber(row.FY2025_Actual),
      FY2026_Budget: toNumber(row.FY2026_Budget),
      FY2027_Proposed: toNumber(row.FY2027_Proposed)
    };
  }

  function normalizeStaffingRow(row) {
    return {
      Dept_Code: (row.Dept_Code || "").trim(),
      Dept_Name: (row.Dept_Name || "").trim(),
      Position_Name: (row.Position_Name || "").trim(),
      2024: toNumber(row["2024"]),
      2025: toNumber(row["2025"]),
      2026: toNumber(row["2026"]),
      2027: toNumber(row["2027"])
    };
  }

  function normalizeMachineryRow(row) {
    return {
      Dept_Code: (row.Dept_Code || "").trim(),
      Dept_Name: (row.Dept_Name || "").trim(),
      Item_Description: (row.Item_Description || "").trim(),
      Amount: toNumber(row.Amount)
    };
  }

  function normalizePerformanceRow(row) {
    return {
      Dept_Code: (row.Dept_Code || "").trim(),
      Dept_Name: (row.Dept_Name || "").trim(),
      "Code Link": (row["Code Link"] || "").trim(),
      Goal: (row.Goal || "").trim(),
      Objective: (row.Objective || "").trim(),
      Measure: (row.Measure || "").trim(),
      Actual_2022: (row.Actual_2022 || "").trim(),
      Actual_2023: (row.Actual_2023 || "").trim(),
      Actual_2024: (row.Actual_2024 || "").trim(),
      Actual_2025: (row.Actual_2025 || "").trim(),
      Projected_2026: (row.Projected_2026 || "").trim(),
      Projected_2027: (row.Projected_2027 || "").trim()
    };
  }

  function normalizeNarrativeRow(row) {
    return {
      Dept_Name: (row.Dept_Name || "").trim(),
      Narrative: (row.Narrative || "").trim()
    };
  }

  function fetchCSV(url) {
    return fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed with status " + res.status);
        return res.text();
      })
      .then(parseCSV);
  }

  function loadBudgetData() {
    if (loadPromise) return loadPromise;

    const specs = [
      ["expenditures", DATA_SOURCES.expenditures, normalizeExpenditureRow],
      ["revenues", DATA_SOURCES.revenues, normalizeRevenueRow],
      ["staffing", DATA_SOURCES.staffing, normalizeStaffingRow],
      ["performanceMeasures", DATA_SOURCES.performanceMeasures, normalizePerformanceRow],
      ["machinery", DATA_SOURCES.machinery, normalizeMachineryRow],
      ["departmentNarratives", DATA_SOURCES.departmentNarratives, normalizeNarrativeRow]
    ];

    cache.datasetCount = specs.length;

    loadPromise = Promise.allSettled(
      specs.map((spec) => fetchCSV(spec[1]).then((rows) => rows.map(spec[2])))
    ).then((results) => {
      results.forEach((result, i) => {
        const key = specs[i][0];
        if (result.status === "fulfilled") {
          cache[key] = result.value;
        } else {
          cache[key] = [];
          cache.errors[key] = result.reason;
          console.error("WCBudgetData: failed to load " + key, result.reason);
        }
      });
      return cache;
    });

    return loadPromise;
  }

  // ---- rendering primitives ----

  function renderTable(options) {
    const columns = options.columns || [];
    const bodyRows = options.bodyRows || [];
    if (!bodyRows.length) return "";
    return (
      '<div class="wc-data-table-wrap">' +
      (options.caption ? '<p class="wc-table-label">' + escapeHtml(options.caption) + "</p>" : "") +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table">' +
      "<thead><tr>" +
      columns.map((c) => '<th class="' + (c.num ? "wc-num" : "") + '">' + escapeHtml(c.label) + "</th>").join("") +
      "</tr></thead>" +
      "<tbody>" + bodyRows.join("") + "</tbody>" +
      "</table>" +
      "</div>" +
      "</div>"
    );
  }

  function renderLedgerTable(opts) {
    const rows = opts.rows || [];
    if (!rows.length) return "";

    const isExpense = opts.kind === "expense";
    const codeField = isExpense ? "Object_Code" : "Revenue_Code";
    const nameField = isExpense ? "Object_Name" : "Revenue_Name";
    const typeField = isExpense ? "Object_Type" : "Revenue_Type";
    const codeLabel = isExpense ? "Object Code" : "Revenue Code";
    const nameLabel = isExpense ? "Object Name" : "Revenue Name";
    const typeLabel = isExpense ? "Object Type" : "Revenue Type";
    const showDept = opts.scope === "summary";

    const columns = []
      .concat(showDept ? [{ label: "Department" }] : [])
      .concat([{ label: typeLabel }, { label: codeLabel }, { label: nameLabel }, { label: "FY 2027 Proposed", num: true }]);
    const colCount = columns.length;

    const sorted = rows.slice().sort((a, b) => {
      if (showDept) {
        const d = (a.Dept_Name || "").localeCompare(b.Dept_Name || "");
        if (d) return d;
      }
      const t = (a[typeField] || "").localeCompare(b[typeField] || "");
      if (t) return t;
      return (a[nameField] || "").localeCompare(b[nameField] || "");
    });

    const bodyRows = [];
    let currentKey = null;
    let currentLabel = "";
    let groupTotal = 0;
    let grandTotal = 0;

    function flushGroup() {
      if (currentKey !== null) {
        bodyRows.push(
          '<tr class="wc-table-subtotal-row"><td colspan="' + (colCount - 1) + '">Subtotal &mdash; ' +
            escapeHtml(currentLabel) + '</td><td class="wc-num">' + formatCurrency(groupTotal) + "</td></tr>"
        );
      }
    }

    sorted.forEach((r) => {
      const key = showDept ? r.Dept_Name + "||" + r[typeField] : r[typeField] || "Other";
      if (key !== currentKey) {
        flushGroup();
        currentKey = key;
        currentLabel = showDept ? r.Dept_Name + " — " + (r[typeField] || "Other") : r[typeField] || "Other";
        groupTotal = 0;
        bodyRows.push('<tr class="wc-table-group-row"><td colspan="' + colCount + '">' + escapeHtml(currentLabel) + "</td></tr>");
      }
      const amt = r.FY2027_Proposed || 0;
      groupTotal += amt;
      grandTotal += amt;
      bodyRows.push(
        "<tr>" +
          (showDept ? "<td>" + escapeHtml(r.Dept_Name || "") + "</td>" : "") +
          "<td>" + escapeHtml(r[typeField] || "") + "</td>" +
          "<td>" + escapeHtml(r[codeField] || "") + "</td>" +
          "<td>" + escapeHtml(r[nameField] || "") + "</td>" +
          '<td class="wc-num">' + formatCurrency(amt) + "</td>" +
        "</tr>"
      );
    });
    flushGroup();

    bodyRows.push(
      '<tr class="wc-table-total-row"><td colspan="' + (colCount - 1) + '">Total</td><td class="wc-num">' +
        formatCurrency(grandTotal) + "</td></tr>"
    );

    return renderTable({
      columns: columns,
      bodyRows: bodyRows,
      caption: opts.caption
    });
  }

  // Department-page expense/revenue tables: rolled up to category level
  // (Personnel Services, Operating Expenditures, Capital Outlay, etc.)
  // rather than individual object/revenue codes.
  function renderTypeSummaryTable(rows, kind, caption) {
    if (!rows.length) return "";
    const isExpense = kind === "expense";
    const typeField = isExpense ? "Object_Type" : "Revenue_Type";
    const typeLabel = isExpense ? "Object Type" : "Revenue Type";

    const totalsByType = new Map();
    let grandTotal = 0;
    rows.forEach((r) => {
      const type = r[typeField] || "Other";
      const amt = r.FY2027_Proposed || 0;
      totalsByType.set(type, (totalsByType.get(type) || 0) + amt);
      grandTotal += amt;
    });

    const bodyRows = Array.from(totalsByType.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, amt]) => "<tr>" + categoryCellHtml(type, isExpense) + '<td class="wc-num">' + formatCurrency(amt) + "</td></tr>");

    bodyRows.push('<tr class="wc-table-total-row"><td>Total</td><td class="wc-num">' + formatCurrency(grandTotal) + "</td></tr>");

    return renderTable({
      caption: caption,
      columns: [{ label: typeLabel }, { label: "FY 2027 Proposed", num: true }],
      bodyRows: bodyRows
    });
  }

  function renderStaffingTable(rows) {
    if (!rows.length) return "";
    const showPrior = getShowPriorYears();
    const years = [2024, 2025, 2026, 2027];
    const priorYears = years.filter((y) => y < 2027);
    const totals = { 2024: 0, 2025: 0, 2026: 0, 2027: 0 };
    const bodyRows = rows
      .slice()
      .sort((a, b) => (a.Position_Name || "").localeCompare(b.Position_Name || ""))
      .map((r) => {
        years.forEach((y) => { totals[y] += r[y] || 0; });
        return (
          "<tr><td>" + escapeHtml(r.Position_Name || "") + "</td>" +
          years.map((y) => {
            const classes = ["wc-num"].concat(y < 2027 ? ["wc-prior-year"] : []);
            return '<td class="' + classes.join(" ") + '">' + formatNumber(r[y] || 0) + "</td>";
          }).join("") +
          "</tr>"
        );
      });
    bodyRows.push(
      '<tr class="wc-table-total-row"><td>Total FTE</td>' +
        years.map((y) => {
          const classes = ["wc-num"].concat(y < 2027 ? ["wc-prior-year"] : []);
          return '<td class="' + classes.join(" ") + '">' + formatNumber(totals[y]) + "</td>";
        }).join("") +
        "</tr>"
    );
    return (
      '<section class="wc-staffing-card' + (showPrior ? " show-prior-years" : "") + '">' +
      '<div class="wc-data-table-wrap">' +
      '<div class="wc-table-label-row">' +
      '<p class="wc-table-label">Staffing / FTE</p>' +
      '<div class="wc-fy-column-toggle-wrap">' +
      '<label class="wc-fy-column-toggle-label">' +
      '<input type="checkbox" class="wc-fy-column-toggle-checkbox" aria-label="View Prior Years" ' +
      (showPrior ? "checked" : "") + " />" +
      '<span class="wc-fy-column-toggle-text">View Prior Years</span>' +
      "</label>" +
      "</div>" +
      "</div>" +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table wc-staffing-table">' +
      "<thead><tr>" +
      "<th>Position Name</th>" +
      priorYears.map((y) => '<th class="wc-num wc-prior-year">FY ' + y + "</th>").join("") +
      '<th class="wc-num">FY 2027</th>' +
      "</tr></thead>" +
      "<tbody>" + bodyRows.join("") + "</tbody>" +
      "</table>" +
      "</div>" +
      "</div>" +
      "</section>"
    );
  }

  function renderMachineryTable(rows) {
    if (!rows.length) return "";
    let total = 0;
    const bodyRows = rows.map((r) => {
      total += r.Amount || 0;
      return "<tr><td>" + escapeHtml(r.Item_Description || "") + '</td><td class="wc-num">' + formatCurrency(r.Amount || 0) + "</td></tr>";
    });
    bodyRows.push('<tr class="wc-table-total-row"><td>Total</td><td class="wc-num">' + formatCurrency(total) + "</td></tr>");
    return renderTable({
      caption: "Machinery, Vehicles & Equipment",
      columns: [{ label: "Item Description" }, { label: "Amount", num: true }],
      bodyRows: bodyRows
    });
  }

  function getShowPriorYears() {
    try {
      return localStorage.getItem(PRIOR_YEARS_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setShowPriorYears(value) {
    try {
      localStorage.setItem(PRIOR_YEARS_KEY, value ? "1" : "0");
    } catch (e) {
      /* localStorage unavailable; in-memory state still applies */
    }
  }

  function runLength(rows, startIndex, keyFn) {
    const value = keyFn(rows[startIndex]);
    let count = 0;
    for (let i = startIndex; i < rows.length; i++) {
      if (keyFn(rows[i]) !== value) break;
      count++;
    }
    return count;
  }

  // Mirrors the markup/classes used by the original walton-performance-measures
  // widget so department pages keep the same look: merged Goal/Objective
  // cells, a Code Link column, and a "View Prior Years" column toggle.
  function renderPerformanceTable(rows) {
    if (!rows.length) return "";
    const showPrior = getShowPriorYears();
    const yearCols = [
      { key: "Actual_2022", label: "Actual 2022" },
      { key: "Actual_2023", label: "Actual 2023" },
      { key: "Actual_2024", label: "Actual 2024" },
      { key: "Actual_2025", label: "Actual 2025" },
      { key: "Projected_2026", label: "Projected 2026" }
    ];
    const finalCol = { key: "Projected_2027", label: "Projected 2027" };

    const bodyRows = rows.map((r, index) => {
      const isFirstGoalRow = index === 0 || rows[index - 1].Goal !== r.Goal;
      const goalRowspan = isFirstGoalRow ? runLength(rows, index, (x) => x.Goal) : 0;
      const isFirstObjectiveRow = index === 0 || rows[index - 1].Objective !== r.Objective;
      const objectiveRowspan = isFirstObjectiveRow ? runLength(rows, index, (x) => x.Objective) : 0;

      return (
        "<tr>" +
        (isFirstGoalRow
          ? '<td class="wc-performance-code wc-performance-merged-cell" rowspan="' + goalRowspan + '">' +
            escapeHtml(r["Code Link"] || "") + "</td>"
          : "") +
        (isFirstGoalRow
          ? '<td class="wc-performance-goal wc-performance-merged-cell" rowspan="' + goalRowspan + '">' +
            escapeHtml(r.Goal || "") + "</td>"
          : "") +
        (isFirstObjectiveRow
          ? '<td class="wc-performance-objective wc-performance-merged-cell" rowspan="' + objectiveRowspan + '">' +
            escapeHtml(r.Objective || "") + "</td>"
          : "") +
        '<td class="wc-performance-measure">' + escapeHtml(r.Measure || "") + "</td>" +
        yearCols.map((c) => '<td class="wc-performance-value wc-prior-year">' + escapeHtml(r[c.key] || "") + "</td>").join("") +
        '<td class="wc-performance-value">' + escapeHtml(r[finalCol.key] || "") + "</td>" +
        "</tr>"
      );
    });

    return (
      '<section class="wc-performance-card' + (showPrior ? " show-prior-years" : "") + '">' +
      '<div class="wc-fy-column-toggle-wrap">' +
      '<label class="wc-fy-column-toggle-label">' +
      '<input type="checkbox" class="wc-fy-column-toggle-checkbox" aria-label="View Prior Years" ' +
      (showPrior ? "checked" : "") + " />" +
      '<span class="wc-fy-column-toggle-text">View Prior Years</span>' +
      "</label>" +
      "</div>" +
      '<div class="wc-performance-table-wrap">' +
      '<table class="wc-performance-table">' +
      "<thead><tr>" +
      '<th>Code Link</th><th>Departmental Goal</th><th>Objective</th><th>Performance Measure</th>' +
      yearCols.map((c) => '<th class="wc-prior-year">' + escapeHtml(c.label) + "</th>").join("") +
      "<th>" + escapeHtml(finalCol.label) + "</th>" +
      "</tr></thead>" +
      "<tbody>" + bodyRows.join("") + "</tbody>" +
      "</table>" +
      "</div>" +
      '<div class="wc-performance-note">' +
      "The code link shown for this department corresponds to a Strategic Priority Initiative identified by the Walton County Board of County Commissioners." +
      "</div>" +
      "</section>"
    );
  }

  function applyPriorYearsState(checked) {
    document.querySelectorAll(".wc-performance-card, .wc-staffing-card").forEach((card) => {
      card.classList.toggle("show-prior-years", checked);
    });
    document.querySelectorAll(".wc-fy-column-toggle-checkbox").forEach((cb) => {
      cb.checked = checked;
    });
  }

  function bindPriorYearsToggle(container) {
    if (!container) return;
    container.querySelectorAll(".wc-fy-column-toggle-checkbox").forEach((checkbox) => {
      if (checkbox.getAttribute("data-wc-prior-years-bound") === "true") return;
      checkbox.setAttribute("data-wc-prior-years-bound", "true");
      checkbox.addEventListener("change", () => {
        const checked = checkbox.checked;
        setShowPriorYears(checked);
        applyPriorYearsState(checked);
      });
    });
  }

  // ---- department page rendering ----

  function mountOrHide(container, html) {
    if (!container) return;
    if (!html) {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.innerHTML = html;
  }

  function pageAlreadyHasStatementOfFunction(container) {
    const headings = document.querySelectorAll("h2");
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      if (container && container.contains(h)) continue;
      if (h.textContent.trim().toLowerCase() === "statement of function") return true;
    }
    return false;
  }

  function renderDepartmentNarrative(container, deptName, deptCode) {
    if (!container) return;
    if (pageAlreadyHasStatementOfFunction(container)) {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    const paragraphs = getDepartmentNarrative(deptName, deptCode);
    if (!paragraphs.length) {
      container.innerHTML = "";
      container.hidden = true;
      return;
    }
    container.hidden = false;

    if (normalizeDeptName(deptName) === "libraries") {
      const introParagraphs = paragraphs.slice(0, 2);
      const remainingParagraphs = paragraphs.slice(2);
      container.innerHTML =
        '<section class="statement-of-function content-section libraries-statement-media">' +
        "<h2>Statement of Function</h2>" +
        '<div class="libraries-statement-intro">' +
        introParagraphs.map((p) => "<p>" + escapeHtml(p) + "</p>").join("") +
        "</div>" +
        '<div class="libraries-statement-lower">' +
        '<div class="libraries-statement-rest">' +
        remainingParagraphs.map((p) => "<p>" + escapeHtml(p) + "</p>").join("") +
        "</div>" +
        '<div class="libraries-video-frame">' +
        '<iframe src="https://www.youtube.com/embed/gJ7QNzqj8ks?controls=1&amp;modestbranding=1&amp;rel=0&amp;playsinline=1" title="Libraries budget video" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>' +
        "</div>" +
        "</div>" +
        "</section>";
      return;
    }

    container.innerHTML =
      '<section class="statement-of-function content-section">' +
      "<h2>Statement of Function</h2>" +
      paragraphs.map((p) => "<p>" + escapeHtml(p) + "</p>").join("") +
      "</section>";
  }

  function showLoadingState(containers) {
    const first = containers.find(Boolean);
    if (first) {
      first.hidden = false;
      first.innerHTML = '<div class="wc-data-loading">' + escapeHtml(LOADING_MESSAGE) + "</div>";
    }
  }

  function showErrorState(containers) {
    containers.forEach((c, i) => {
      if (!c) return;
      if (i === 0) {
        c.hidden = false;
        c.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
      } else {
        c.innerHTML = "";
        c.hidden = true;
      }
    });
  }

  function initDepartmentPage() {
    const ids = [
      "department-narrative",
      "department-performance-table",
      "department-expense-table",
      "department-revenue-table",
      "department-staffing-table",
      "department-machinery-table"
    ];
    const containers = ids.map((id) => document.getElementById(id));
    if (!containers.some(Boolean)) return;

    const deptName = getDepartmentNameFromPage();
    const deptCode = getDeptCodeFromPage();
    if (!deptName) return;

    showLoadingState(containers);

    loadBudgetData()
      .then((data) => {
        if (Object.keys(data.errors || {}).length >= data.datasetCount) {
          showErrorState(containers);
          return;
        }
        const [narrativeEl, performanceEl, expenseEl, revenueEl, staffingEl, machineryEl] = containers;

        renderDepartmentNarrative(narrativeEl, deptName, deptCode);

        mountOrHide(performanceEl, renderPerformanceTable(getDepartmentPerformanceMeasures(deptName, deptCode)));
        bindPriorYearsToggle(performanceEl);

        mountOrHide(
          expenseEl,
          renderTypeSummaryTable(getDepartmentExpenses(deptName, deptCode), "expense", "Expenditure Summary")
        );
        bindTooltipAnchors(expenseEl);

        mountOrHide(
          revenueEl,
          renderTypeSummaryTable(getDepartmentRevenues(deptName, deptCode), "revenue", "Revenue Summary")
        );
        bindTooltipAnchors(revenueEl);

        mountOrHide(staffingEl, renderStaffingTable(getDepartmentStaffing(deptName, deptCode)));
        bindPriorYearsToggle(staffingEl);
        mountOrHide(machineryEl, renderMachineryTable(getDepartmentMachinery(deptName, deptCode)));
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load budget data", err);
        showErrorState(containers);
      });
  }

  // ---- financial summary pages (Summary of Expenses / Summary of Revenues) ----

  function renderFilterControls(container, fields, state, onChange) {
    if (!container) return;
    const selects = fields
      .map(
        (f) =>
          '<label class="wc-filter-field"><span>' + escapeHtml(f.label) + "</span>" +
          '<select data-filter-key="' + escapeHtml(f.key) + '"><option value="">All</option>' +
          f.options.map((o) => '<option value="' + escapeHtml(o) + '">' + escapeHtml(o) + "</option>").join("") +
          "</select></label>"
      )
      .join("");

    container.innerHTML =
      selects +
      '<label class="wc-filter-field wc-filter-search"><span>Search</span>' +
      '<input type="search" data-filter-key="search" placeholder="Search by name or code" /></label>';

    container.querySelectorAll("select[data-filter-key]").forEach((sel) => {
      sel.addEventListener("change", () => {
        state[sel.dataset.filterKey] = sel.value;
        onChange();
      });
    });
    const searchInput = container.querySelector('input[data-filter-key="search"]');
    if (searchInput) {
      let t;
      searchInput.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          state.search = searchInput.value.trim();
          onChange();
        }, 150);
      });
    }
  }

  function renderFinancialSummary(container, type) {
    if (!container) return;
    const isExpense = type !== "revenues";
    const rows = isExpense ? cache.expenditures : cache.revenues;
    if (!rows.length) {
      container.innerHTML = '<div class="wc-data-empty">No ' + (isExpense ? "expenditure" : "revenue") + " data is available.</div>";
      return;
    }
    const typeField = isExpense ? "Object_Type" : "Revenue_Type";
    const nameField = isExpense ? "Object_Name" : "Revenue_Name";
    const codeField = isExpense ? "Object_Code" : "Revenue_Code";

    container.innerHTML =
      '<div class="wc-filter-bar" role="search" aria-label="Filter ' + (isExpense ? "expenditures" : "revenues") + '"></div>' +
      '<div class="wc-filter-summary"></div>' +
      '<div class="wc-financial-summary-table"></div>';

    const filterBar = container.querySelector(".wc-filter-bar");
    const summaryEl = container.querySelector(".wc-filter-summary");
    const tableEl = container.querySelector(".wc-financial-summary-table");
    const state = { department: "", type: "", search: "" };

    function applyFilters() {
      const filtered = rows.filter((r) => {
        if (state.department && r.Dept_Name !== state.department) return false;
        if (state.type && r[typeField] !== state.type) return false;
        if (state.search) {
          const haystack = (
            (r.Dept_Name || "") + " " + (r[nameField] || "") + " " + (r[codeField] || "") + " " + (r.Project_Name || "")
          ).toLowerCase();
          if (!haystack.includes(state.search.toLowerCase())) return false;
        }
        return true;
      });

      mountOrHide(
        tableEl,
        renderLedgerTable({ rows: filtered, kind: isExpense ? "expense" : "revenue", scope: "summary" })
      );
      if (!filtered.length) {
        tableEl.hidden = false;
        tableEl.innerHTML = '<div class="wc-data-empty">No rows match the current filters.</div>';
      }
      const total = filtered.reduce((s, r) => s + (r.FY2027_Proposed || 0), 0);
      summaryEl.innerHTML =
        '<p class="wc-filter-result-count">Showing ' + filtered.length.toLocaleString() + " of " + rows.length.toLocaleString() +
        " rows &mdash; FY 2027 Proposed Total: " + formatCurrency(total) + "</p>";
    }

    renderFilterControls(
      filterBar,
      [
        { key: "department", label: "Department", options: uniqueSorted(rows.map((r) => r.Dept_Name)) },
        { key: "type", label: isExpense ? "Object Type" : "Revenue Type", options: uniqueSorted(rows.map((r) => r[typeField])) }
      ],
      state,
      applyFilters
    );

    applyFilters();
  }

  function initFinancialSummaryPage() {
    const container = document.getElementById("financial-summary");
    if (!container) return;
    const type = container.dataset.summaryType === "revenues" ? "revenues" : "expenses";

    container.innerHTML = '<div class="wc-data-loading">' + escapeHtml(LOADING_MESSAGE) + "</div>";

    loadBudgetData()
      .then((data) => {
        if (Object.keys(data.errors || {}).length >= data.datasetCount) {
          container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
          return;
        }
        renderFinancialSummary(container, type);
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load financial summary", err);
        container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initDepartmentPage();
    initFinancialSummaryPage();
  });

  window.WCBudgetData = {
    DATA_SOURCES,
    loadBudgetData,
    parseCSV,
    formatCurrency,
    formatNumber,
    getDepartmentNameFromPage,
    getDepartmentExpenses,
    getDepartmentRevenues,
    getDepartmentStaffing,
    getDepartmentMachinery,
    getDepartmentPerformanceMeasures,
    getDepartmentNarrative,
    renderTable,
    renderDepartmentNarrative,
    renderFinancialSummary,
    renderFilterControls
  };
})();
