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
    departmentNarratives: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=445845528&single=true&output=csv",
    funds: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=968844446&single=true&output=csv",
    activities: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=1380538812&single=true&output=csv",
    fundBalances: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=78843155&single=true&output=csv"
  };

  const LOADING_MESSAGE = "Loading budget data...";
  // Bouncing-dots markup (see style.css's .wc-loading-dots) appended to the
  // plain loading text so it's visually obvious data is still in flight,
  // not just a static label.
  const LOADING_MESSAGE_HTML = escapeHtml(LOADING_MESSAGE) +
    ' <span class="wc-loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
  const ERROR_MESSAGE = "Budget data could not be loaded. Please try again later.";
  const HISTORICAL_ACTUAL_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
  const SUPABASE_CLIENT_SCRIPT = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  const currentScriptSrc = document.currentScript && document.currentScript.src;
  const assetBaseUrl = currentScriptSrc ? currentScriptSrc.replace(/[^/]+$/, "") : "assets/";
  const supabaseDataScript = assetBaseUrl + "supabase-data.js?v=20260620-2";

  // The published sheets use department names that differ slightly between
  // tabs (and from this site's page titles). These aliases map a page's
  // normalized department name to the additional normalized Dept_Name
  // values it should also match across every dataset.
  const DEPT_ALIASES = {
    "sheriff s office": ["walton county sheriff s office", "walton county sheriffs office", "sheriff"],
    "sheriffs office": ["walton county sheriff s office", "walton county sheriffs office", "sheriff"],
    "clerk of courts and county comptroller": ["clerk of court", "clerk of circuit court"],
    "engineering department": ["public works engineering services", "engineering services"],
    "environmental resources": ["environmental services"],
    "probation": ["probation services"],
    "purchasing": ["procurement"],
    "e911 fund": ["e911", "e 911"],
    "municipal service benefit unit fund": ["municipal service benefit unit", "msbu", "msbu fund"],
    "recreation plat fee fund": ["recreation plat fee"],
    "sidewalk fund": ["sidewalk"],
    // "Court Innovations" is deliberately NOT an alias here -- its rows
    // (Dept_Code 001348/00101000) get their own dedicated card via
    // renderCourtInnovationsSupplementalTables instead of the generic
    // Expense/Revenue Summary, same as its narrative (see
    // renderDepartmentNarrative's "court technology and innovations"
    // branch). Including it here would pull the same rows into both,
    // showing duplicate cards.
    "court technology and innovations": [
      "court technology court administration",
      "court technology state attorney",
      "court technology public defender",
      "court technology innovations",
      "court technology"
    ],
    "public defender": ["court technology public defender"],
    "statutory and other agency funding": ["statutory and other agency fund", "statutory and other"],
    "south walton fire and state control": ["south walton fire", "state fire"],
    "code compliance": ["code compliance beach", "code compliance street"],
    "libraries": ["county libraries"],
    "planning": ["planning short term rental"],
    "tourism administration": [
      "sales and visitor center",
      "sales and visitors center",
      "tourism sales and visitor center",
      "tourism sales and visitors center",
      "communications",
      "tourism communications",
      "marketing",
      "tourism marketing",
      "north walton",
      "north walton tourist development tax"
    ],
    "tourism beach operations": [
      "beach operations",
      "beach renourishment",
      "beach tram",
      "tourism beach tram"
    ],
    "tourism beach tram": ["beach tram"],
    "tourism communications": ["communications"],
    "tourism marketing": ["marketing"],
    "tourism sales and visitor center": ["sales and visitors center", "sales and visitor center"],
    "tourism lifeguard services and beach safety": [
      "south walton fire lifeguard services",
      "public safety"
    ]
  };

  // Object codes pulled out into their own supplemental Expenditure Summary
  // table on certain department pages (see render*SupplementalTables below)
  // and therefore excluded from that department's main summary table so
  // amounts aren't counted twice.
  const EXPENSE_OBJECT_CODES_BROKEN_OUT = {
    "solid waste": ["534000"],
    "building construction and maintenance": ["543000"],
    "board of county commissioners": ["531001", "531002", "531003", "531004"]
  };

  // Friendlier display captions for sub-group tables whose raw Dept_Name
  // in the sheet reads awkwardly on its own.
  const DEPT_NAME_DISPLAY_OVERRIDES = {};
  const DEPARTMENT_PAGE_TITLE_ALIASES = new Map([
    ["bcc other uses contingency", "Board of County Commissioners"],
    ["clerk of court", "Clerk of Courts & County Comptroller"],
    ["procurement", "Purchasing"],
    ["probation services", "Probation"],
    ["environmental services", "Environmental Resources"],
    ["engineering services", "Engineering Department"],
    ["e911", "E911 Fund"],
    ["e 911", "E911 Fund"],
    ["e911 fund", "E911 Fund"],
    ["municipal service benefit unit", "Municipal Service Benefit Unit Fund"],
    ["municipal service benefit unit fund", "Municipal Service Benefit Unit Fund"],
    ["msbu", "Municipal Service Benefit Unit Fund"],
    ["msbu fund", "Municipal Service Benefit Unit Fund"],
    ["recreation plat fee", "Recreation Plat Fee Fund"],
    ["recreation plat fee fund", "Recreation Plat Fee Fund"],
    ["sidewalk", "Sidewalk Fund"],
    ["sidewalk fund", "Sidewalk Fund"],
    ["statutory and other", "Statutory & Other Agency Funding"],
    ["culture and recreation senior centers", "Statutory & Other Agency Funding"],
    ["culture and recreation senior centers and mainstreet", "Statutory & Other Agency Funding"],
    ["senior centers", "Statutory & Other Agency Funding"],
    ["senior centers and mainstreet", "Statutory & Other Agency Funding"],
    ["walton county sheriff's office", "Sheriff's Office"],
    ["walton county sheriffs office", "Sheriff's Office"],
    ["south walton fire", "South Walton Fire & State Control"],
    ["state fire", "South Walton Fire & State Control"],
    ["volunteer fire", "South Walton Fire & State Control"],
    ["court innovations", "Court Technology & Innovations"],
    ["court technology - court administration", "Court Technology & Innovations"],
    ["court technology court administration", "Court Technology & Innovations"],
    ["sales and visitor center", "Tourism Administration"],
    ["sales and visitors center", "Tourism Administration"],
    ["communications", "Tourism Administration"],
    ["marketing", "Tourism Administration"],
    ["north walton tourist development tax", "Tourism Administration"],
    ["beach operations", "Tourism Beach Operations"],
    ["beach code enforcement", "Tourism Beach Operations"],
    ["beach renourishment", "Tourism Beach Operations"],
    ["beach tram", "Tourism Beach Operations"],
    ["tourism beach tram", "Tourism Beach Operations"],
    ["tourism public safety", "Tourism Lifeguard Services and Beach Safety"],
    ["public safety", "Tourism Lifeguard Services and Beach Safety"],
    ["mosquito control state aid", "Mosquito Control"],
    ["south walton fire lifeguard services", "Tourism Lifeguard Services and Beach Safety"],
    ["sheriff beach safety", "Tourism Lifeguard Services and Beach Safety"]
  ]);

  const DEPARTMENT_PAGE_FALLBACK_HREFS = new Map([
    ["E911 Fund", "e911-fund.html"],
    ["Municipal Service Benefit Unit Fund", "municipal-service-benefit-unit-fund.html"],
    ["Recreation Plat Fee Fund", "recreation-plat-fee-fund.html"],
    ["Sidewalk Fund", "sidewalk-fund.html"]
  ]);

  function localPageHref(filename) {
    if (!filename) return "";
    return window.location.pathname.indexOf("/pages/") !== -1 ? filename : "pages/" + filename;
  }

  function departmentPageHref(deptName) {
    const norm = normalizeDeptName(deptName);
    if (!norm || norm === "unclassified") return "";
    const pages = window.wcBudgetPages || [];
    const title = DEPARTMENT_PAGE_TITLE_ALIASES.get(norm) || deptName;
    const exact = pages.find((p) => normalizeDeptName(p.title) === normalizeDeptName(title));
    if (exact && exact.href) return exact.href;
    const departmentMatch = pages.find((p) =>
      p.section === "Departments" && normalizeDeptName(p.title) === norm
    );
    if (departmentMatch && departmentMatch.href) return departmentMatch.href;
    return localPageHref(DEPARTMENT_PAGE_FALLBACK_HREFS.get(title));
  }

  // Explanatory notes shown under a sub-group's Expenditure Summary table,
  // in the same italic callout style as the staffing notes.
  const EXPENSE_GROUP_NOTES = {
    "public safety": [
      "Under Florida Statutes §125.0104(5)(c), eligible counties may allocate up to 10% of Tourist Development Tax revenues to reimburse public safety expenses necessitated by increased tourism and visitor impacts."
    ],
    "south walton fire": [
      "The rise in the budget is attributed to contractual obligations, specifically, the contractual provision for incremental adjustments within the agreement with the South Walton Fire District, tied to the Consumer Price Index Municipal Class Size D - South, calculated from April of the preceding year to April of the current year."
    ],
    "clerk of courts and county comptroller": [
      "Contact the Clerk of Courts & County Comptroller's office directly for additional budget line detail."
    ],
    "tax collector": [
      "Contact the Tax Collector's office directly for additional budget line detail."
    ],
    "sheriffs office": [
      "Contact the Sheriff's Office directly for additional budget line detail."
    ],
    "property appraiser": [
      "Contact the Property Appraiser's office directly for additional budget line detail."
    ],
    "supervisor of elections": [
      "Contact the Supervisor of Elections' office directly for additional budget line detail."
    ]
  };

  // These constitutional officers only roll an FTE total up here rather
  // than itemized position-level data -- see renderStaffingGroup's
  // extraNotes -- so their staffing card points readers to that office
  // directly for a detailed position-level FTE table.
  const STAFFING_GROUP_NOTES = {
    "clerk of courts and county comptroller": [
      "Contact the Clerk of Courts & County Comptroller's office directly for a detailed position-level FTE table."
    ],
    // The staffing sheet's own Dept_Name for the Clerk uses "Clerk of
    // Circuit Court" rather than the page's "Clerk of Courts & County
    // Comptroller" title.
    "clerk of circuit court": [
      "Contact the Clerk of Courts & County Comptroller's office directly for a detailed position-level FTE table."
    ],
    "tax collector": [
      "Contact the Tax Collector's office directly for a detailed position-level FTE table."
    ],
    "sheriffs office": [
      "Contact the Sheriff's Office directly for a detailed position-level FTE table."
    ],
    // The staffing sheet's own Dept_Name for the Sheriff is just "Sheriff"
    // rather than the page's "Sheriff's Office" title.
    sheriff: [
      "Contact the Sheriff's Office directly for a detailed position-level FTE table."
    ],
    "property appraiser": [
      "Contact the Property Appraiser's office directly for a detailed position-level FTE table."
    ],
    "supervisor of elections": [
      "Contact the Supervisor of Elections' office directly for a detailed position-level FTE table."
    ]
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
  const PERFORMANCE_PRIOR_YEARS_KEY = "wc_show_performance_prior_years";

  const cache = {
    expenditures: [],
    dedupedExpenseRows: [],
    revenues: [],
    expenseActualRows: [],
    revenueActualRows: [],
    originalBudgetRows: [],
    staffing: [],
    performanceMeasures: [],
    machinery: [],
    departmentNarratives: [],
    funds: [],
    activities: [],
    fundBalances: [],
    errors: {}
  };
  let loadPromise = null;

  function loadScriptOnce(id, src) {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load " + src)), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = true;
      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          resolve();
        },
        { once: true }
      );
      script.addEventListener("error", () => reject(new Error("Failed to load " + src)), { once: true });
      document.head.appendChild(script);
    });
  }

  function ensureSupabaseDataLayer() {
    if (window.WCSupabaseData) return Promise.resolve(window.WCSupabaseData);

    return loadScriptOnce("wc-supabase-js", SUPABASE_CLIENT_SCRIPT)
      .then(() => loadScriptOnce("wc-supabase-data", supabaseDataScript))
      .then(() => window.WCSupabaseData || null)
      .catch((err) => {
        console.error("WCBudgetData: Supabase actuals layer could not be loaded; using Google Sheets fallbacks.", err);
        return null;
      });
  }

  function loadSupabaseActualLookups() {
    return ensureSupabaseDataLayer().then((supabaseData) => {
      if (!supabaseData) return null;

      return Promise.all([
        supabaseData.loadExpenseActuals(),
        supabaseData.loadRevenueActuals(),
        supabaseData.loadOriginalBudget()
      ]).then(([expenseRows, revenueRows, originalBudgetRows]) => ({
        supabaseData,
        expenseRows,
        revenueRows,
        originalBudgetRows
      }));
    }).catch((err) => {
      console.error("WCBudgetData: Supabase actuals could not be loaded; using Google Sheets fallbacks.", err);
      return null;
    });
  }

  // Some departments' historical actuals are booked under older Dept_Code
  // values that predate a county org-code restructuring and no longer
  // appear anywhere in the current budget sheet. Building Construction and
  // Maintenance (now solely 00117000) has actuals split across 00117010,
  // 00117020, and 10117000 in Supabase, so those need to be pulled in
  // alongside the current code or its prior-year actuals read as zero.
  //
  // Engineering is NOT listed here even though its FY2020-FY2026
  // actuals/budget are booked under legacy code 00120000 while its FY2027
  // sheet row uses 10116002 -- unlike Building Construction's aliases, this
  // wasn't just an org-code rename: the department itself moved from the
  // General Fund (001, 00120000's own fund) to the Transportation Fund
  // (101, 10116002's own fund) starting FY2027. Aliasing 00120000 into
  // 10116002 would pull FY2020-FY2026 dollars onto the Transportation
  // Fund's schedule a year before the department actually got there.
  // synthesizeMissingExpenseRows instead synthesizes 00120000 as its own
  // standalone row (see considerRow), keeping FY2020-FY2026 on fund 001 and
  // FY2027 (the sheet's own 10116002 rows) on fund 101.
  const DEPT_CODE_ACTUALS_ALIASES = {
    "00117000": ["00117010", "00117020", "10117000"]
  };

  // Sums every raw Supabase actuals row matching a department+account+year,
  // regardless of its project dimension. Budget-side FY2027 line items
  // don't carry a comparable project breakdown (expense Project_Code is
  // budget-only/itemization-only; revenue rows have no Project_Code field
  // at all), but the *actuals* data can legitimately have several real,
  // distinct entries for the same department+account split across
  // different projects (e.g. a revenue code billed under one project some
  // years and unassigned in others) -- those are genuine additional
  // dollars, not duplicates, so they must be summed rather than picking
  // just one. `matched` distinguishes "found rows, total happens to be 0"
  // from "no actuals exist for this account" so callers can still fall
  // back to the budget sheet's own column in the latter case.
  // projectCode being undefined/null means "no project scoping" (sum every
  // project under this org+account, the usual rule). Passing "" explicitly
  // means "scope to rows with a blank project specifically" -- distinct from
  // not scoping at all, needed for org+account combinations that mix one
  // blank-project recipient with other recipients under real Project_Codes
  // (see STATUTORY_EXPENSE_OVERRIDES).
  function sumRawActualsForAccount(rawRows, org, code, year, projectCode) {
    const orgNorm = String(org || "").trim();
    const codeNorm = String(code || "").trim();
    const hasProjectScope = projectCode !== undefined && projectCode !== null;
    const projectNorm = hasProjectScope ? String(projectCode).trim() : "";
    const orgNorms = orgNorm ? [orgNorm].concat(DEPT_CODE_ACTUALS_ALIASES[orgNorm] || []) : [];
    let matched = false;
    let total = 0;
    if (orgNorms.length && codeNorm) {
      (rawRows || []).forEach((row) => {
        if (Number(row.year) !== Number(year)) return;
        if (!orgNorms.includes(String(row.org || "").trim())) return;
        if (String(row.object || "").trim() !== codeNorm) return;
        if (hasProjectScope && String(row.project || "").trim() !== projectNorm) return;
        matched = true;
        total += Number(row.amount) || 0;
      });
    }
    return { matched, total };
  }

  // Departments whose budget/actuals must be scoped to one specific
  // Project_Code rather than the usual "sum every project under this
  // org+account" rule (see applyActualsToRows below). Walton County Health
  // Department's expense row shares Dept_Code 00102012 ("Human Services")
  // and Object_Code 581000 ("Aid to Government Agencies") with several
  // *other* aid recipients, each under their own distinct Project_Code --
  // unlike the usual case (one department's own purchases itemized across
  // several Project_Codes), these are genuinely different organizations, so
  // summing by org+account alone pulls in their payments too. Non-Profit
  // Funding Program is the same pattern: its expense row shares Dept_Code
  // 00102014 and Object_Code 583000 ("Other Grants & Aid") with the
  // Indigent Cremation Program, a different recipient under a blank
  // Project_Code.
  const PROJECT_SCOPED_DEPT_NAMES = new Map([
    ["walton county health department", "10255"],
    ["non profit funding program", "10261"]
  ]);

  // Statutory & Other Agency Funding rolls up several small, independent
  // aid/grant line items that are each relabeled onto it from a different
  // original Dept_Name (see STATUTORY_EXPENSE_OVERRIDES) -- unlike the
  // departments above, these are several *different* recipients, each with
  // its own distinct Project_Code, that must stay separate from each other
  // rather than share one fixed scope. So instead of a single fixed
  // Project_Code, each row is scoped to whatever its own Project_Code
  // already is (including blank, for the recipients recorded without one).
  const PROJECT_SCOPED_BY_OWN_ROW_DEPT_NAMES = new Set(["statutory and other"]);

  // projectScopeForRow returns undefined when no row needs project-level
  // scoping at all (the default, "sum every project" rule applies), so
  // sumRawActualsForAccount/applyActualsToRows/applyOriginalBudgetToRows can
  // tell that apart from an explicit "" (scope to a blank Project_Code).
  function projectScopeForRow(row) {
    const deptName = normalizeDeptName(row && row.Dept_Name);
    if (PROJECT_SCOPED_BY_OWN_ROW_DEPT_NAMES.has(deptName)) {
      return String((row && row.Project_Code) || "").trim();
    }
    if (PROJECT_SCOPED_DEPT_NAMES.has(deptName)) {
      return PROJECT_SCOPED_DEPT_NAMES.get(deptName);
    }
    return undefined;
  }

  // Specific (Dept_Code, Object_Code, Project_Code) expense line items that
  // belong on the Statutory & Other Agency Funding page but are recorded in
  // the sheet under a different Dept_Name -- each is its own small,
  // independent aid/grant recipient with no department page of its own.
  // Project_Code "" matches a row with a blank Project_Code specifically
  // (Object_Code is included because some of these orgs have *another*
  // blank-project row under a different account that must NOT be relabeled,
  // e.g. Human Services 581001 alongside its 581000 row). Lakeview
  // (00102013) is the same pattern as the others: three Professional
  // Services (531000) rows under three distinct Project_Codes, no page of
  // its own.
  const STATUTORY_EXPENSE_OVERRIDES = new Set([
    "00102012|581000|10259",
    "00102012|581000|10260",
    "00102012|581000|10720",
    "00102012|581000|10732",
    "00102012|581000|",
    "00102019|581000|10277",
    "00102019|581000|10278",
    "00102011|582000|10257",
    "00102016|582000|10251",
    "00102014|583000|",
    "00102013|531000|10246",
    "00102013|531000|10247",
    "00102013|531000|10248"
  ]);

  function statutoryExpenseOverrideKey(row) {
    return (
      String((row && row.Dept_Code) || "").trim() + "|" +
      String((row && row.Object_Code) || "").trim() + "|" +
      String((row && row.Project_Code) || "").trim()
    );
  }

  function applyStatutoryExpenseOverrides(rows) {
    return (rows || []).map((row) => {
      if (!STATUTORY_EXPENSE_OVERRIDES.has(statutoryExpenseOverrideKey(row))) return row;
      return { ...row, Dept_Name: "Statutory & Other" };
    });
  }

  // Specific (Dept_Code, Revenue_Code) revenue rows relabeled to a
  // different Revenue_Name so they merge into the right category on
  // county-wide summaries (combineByName groups revenue rows by name).
  // Dept_Code 102389 / Revenue_Code 389001 ("Nonoperating less 5%") is the
  // statutory 5% Ad Valorem discount Florida's Truth in Millage law
  // requires budgeting against -- it already shares Ad Valorem Taxes' own
  // Revenue_Type ("General Government Taxes"), but its generic
  // "Nonoperating" name keeps it from merging into that line. No dedicated
  // page shows this row under its original name (only the Summary of
  // Revenues and a glossary mention), so relabeling it is safe everywhere.
  const REVENUE_NAME_OVERRIDES = new Map([["102389|389001", "Ad Valorem Taxes"]]);

  function applyRevenueNameOverrides(rows) {
    return (rows || []).map((row) => {
      const key = String((row && row.Dept_Code) || "").trim() + "|" + String((row && row.Revenue_Code) || "").trim();
      const override = REVENUE_NAME_OVERRIDES.get(key);
      if (!override) return row;
      return { ...row, Revenue_Name: override };
    });
  }

  function isFundScheduleDebugEnabled(flagName) {
    try {
      return new URLSearchParams(window.location.search).get(flagName) === "1";
    } catch (e) {
      return false;
    }
  }

  function isMissingRowsDebugEnabled() {
    return isFundScheduleDebugEnabled("debugMissingRows");
  }

  // Florida's Uniform Accounting System: revenue codes are 3xx, with no
  // overlap with expense's 5xx/6xx (see isLikelyExpenseObjectCode).
  function isLikelyRevenueCode(code) {
    return String(code || "").trim().charAt(0) === "3";
  }

  // "COA Revenue Codes" -- like buildExpenseObjectCatalog, but there's no
  // dedicated tab for this either, so it's derived from the revenues
  // sheet's own Revenue_Code/Revenue_Name/Revenue_Type columns.
  function buildRevenueCodeCatalog(revenueRows) {
    const catalog = new Map();
    (revenueRows || []).forEach((r) => {
      const code = String(r.Revenue_Code || "").trim();
      if (!code || catalog.has(code)) return;
      catalog.set(code, { Revenue_Code: code, Revenue_Name: r.Revenue_Name || "", Revenue_Type: r.Revenue_Type || "" });
    });
    return catalog;
  }

  // Departments/recipients that already have at least one real row
  // somewhere in the sheet -- a synthesized row (see
  // synthesizeMissingExpenseRows/synthesizeMissingRevenueRows below) only
  // gets attributed to a department name pulled from the activities sheet
  // when that name is confirmed here. Some Dept_Codes in the activities
  // sheet are revenue-category labels rather than real departments (e.g.
  // 107342 maps to Dept_Name "Public Safety", not an actual department) --
  // trusting those blindly previously misattributed rows to the wrong page
  // entirely. Anything not confirmed here becomes Dept_Name "Unclassified"
  // instead.
  function buildKnownDeptNames(expenditureRows, revenueRows) {
    const names = new Set();
    (expenditureRows || []).forEach((r) => {
      const n = normalizeDeptName(r.Dept_Name);
      if (n) names.add(n);
    });
    (revenueRows || []).forEach((r) => {
      const n = normalizeDeptName(r.Dept_Name);
      if (n) names.add(n);
    });
    return names;
  }

  const UNCLASSIFIED_DEPT_NAME = "Unclassified";

  // (org, object) keys that SUPABASE_LOOKUP_OVERRIDES already redirects
  // into an existing sheet row's own lookup (e.g. 105389/389001 is summed
  // into the 102389/389001 sheet row's Ad Valorem 5% figure) -- excluded
  // from synthesis below so those dollars aren't also counted via a brand
  // new row.
  function overrideRedirectTargetKeys() {
    const keys = new Set();
    SUPABASE_LOOKUP_OVERRIDES.forEach((targets) => {
      targets.forEach((t) => keys.add(String(t.org || "").trim() + "|" + String(t.object || "").trim()));
    });
    return keys;
  }

  // Org codes that are DEPT_CODE_ACTUALS_ALIASES targets (e.g. 00117010,
  // an alias of canonical org 00117000) -- excluded from revenue synthesis
  // wholesale, any object code, because sumRawActualsForAccount already
  // folds all of an alias target's Supabase rows into the canonical org's
  // own sum, AS LONG AS the canonical org has its own row for that exact
  // object code. (Expense synthesis below checks this per object code
  // instead of blanket-excluding the org -- see synthesizeMissingExpenseRows
  // -- since an alias org can have an account under an object code its
  // canonical org has no row for at all, which this blanket exclusion would
  // otherwise silently drop.)
  function aliasTargetOrgCodes() {
    const codes = new Set();
    Object.keys(DEPT_CODE_ACTUALS_ALIASES).forEach((canonicalOrg) => {
      DEPT_CODE_ACTUALS_ALIASES[canonicalOrg].forEach((aliasOrg) => codes.add(aliasOrg));
    });
    return codes;
  }

  // Supabase actuals/original-budget rows can reference a department+
  // account combination with no row at all in the FY2027 budget sheet --
  // without a row to attach a value to, applyActualsToRows/
  // applyOriginalBudgetToRows have nothing to populate, and every table
  // that reads cache.expenditures (Summary of Expenses, every department's
  // Budget Lines popup, the Fund Financial Schedule) never sees it. This
  // synthesizes a minimal placeholder row for each one found, so the
  // existing actuals/budget machinery picks it up the same way it does for
  // every other row, with no per-table special-casing needed.
  function synthesizeMissingExpenseRows(expenditureRows, originalBudgetRows, actualRows, coaDepartments, coaExpenses, knownDeptNames, excludedKeys) {
    const rows = expenditureRows || [];

    // Coverage already provided by *existing* sheet rows, mirroring exactly
    // what applyOriginalBudgetToRows/applyActualsToRows will later match on:
    // an unscoped row (projectScopeForRow undefined) catches every project
    // under its org+object, while a project-scoped row only catches its own
    // project (see projectScopeForRow). Needed to tell a genuinely missing
    // account apart from one that's already covered by an existing row
    // under a *different* Project_Code than the Supabase row happens to
    // carry -- e.g. Walton County Health Department/Statutory & Other carve
    // out specific projects under 00102012/581000, but a Supabase project
    // matching none of them (and with no unscoped row to fall back to)
    // would otherwise never be attached to any row at all.
    const coverage = new Map();
    function coverageFor(org, object) {
      const key = org + "|" + object;
      let cov = coverage.get(key);
      if (!cov) {
        cov = { any: false, scopes: new Set() };
        coverage.set(key, cov);
      }
      return cov;
    }
    rows.forEach((r) => {
      const org = String(r.Dept_Code || "").trim();
      const object = String(r.Object_Code || "").trim();
      if (!org || !object) return;
      const scope = projectScopeForRow(r);
      const cov = coverageFor(org, object);
      if (scope === undefined) cov.any = true;
      else cov.scopes.add(scope);
    });

    // Reverse of DEPT_CODE_ACTUALS_ALIASES: an alias org's Supabase rows
    // are normally already folded into its canonical org's own row via
    // sumRawActualsForAccount's org expansion -- but only for an object
    // code the canonical org actually has a row for. An alias org's
    // account under an object code the canonical org has no row for at all
    // would otherwise be silently dropped (no row anywhere ever attaches to
    // it), so it still needs its own synthesized row -- attributed to the
    // *canonical* org's code (see considerRow below), not the legacy alias
    // code, since the alias can carry a different (now-stale) fund than
    // where the department actually sits today. E.g. Engineering's legacy
    // code 00120000 was General Fund; its current code 10116002 is the
    // Transportation Fund -- a row left under 00120000 would land on the
    // wrong fund's schedule even though it's the same department's money.
    // sumRawActualsForAccount's alias expansion still finds the alias org's
    // own Supabase rows regardless of which org code the new row carries.
    const canonicalOrgForAlias = new Map();
    Object.keys(DEPT_CODE_ACTUALS_ALIASES).forEach((canonicalOrg) => {
      DEPT_CODE_ACTUALS_ALIASES[canonicalOrg].forEach((aliasOrg) => canonicalOrgForAlias.set(aliasOrg, canonicalOrg));
    });

    function isCovered(org, object, project) {
      const cov = coverage.get(org + "|" + object);
      if (cov && (cov.any || cov.scopes.has(project))) return true;
      const canonicalOrg = canonicalOrgForAlias.get(org);
      if (!canonicalOrg) return false;
      const canonicalCov = coverage.get(canonicalOrg + "|" + object);
      return !!(canonicalCov && (canonicalCov.any || canonicalCov.scopes.has(project)));
    }

    const deptByCode = new Map((coaDepartments || []).map((d) => [String(d.Dept_Code || "").trim(), d]));
    const seenNewKeys = new Set();
    const extraRows = [];

    function considerRow(org, object, project) {
      if (!org || !object || !isLikelyExpenseObjectCode(object) || excludedKeys.has(org + "|" + object)) return;
      if (isCovered(org, object, project)) return;

      // Route a leftover alias-org account to its canonical org's own code
      // (see canonicalOrgForAlias above) rather than the legacy alias code.
      const targetOrg = canonicalOrgForAlias.get(org) || org;

      const key = targetOrg + "|" + object + "|" + project;
      if (seenNewKeys.has(key)) return;
      seenNewKeys.add(key);

      // A (targetOrg,object) with *some* existing project-scoped coverage
      // already (just not this Supabase project) is a shared GL line
      // across several distinct recipients -- the same pattern as
      // Statutory & Other -- so this new row must be scoped to its own
      // project too, or it would unscope-sum the whole account and
      // re-duplicate its siblings' amounts.
      const existingCov = coverage.get(targetOrg + "|" + object);
      const needsOwnProjectScope = !!(existingCov && existingCov.scopes.size > 0);

      const dept = deptByCode.get(targetOrg);
      const deptName = needsOwnProjectScope
        ? "Statutory & Other"
        : DEPT_CODE_NAME_OVERRIDES.get(targetOrg) || resolveSynthesizedDeptName(dept, knownDeptNames);
      const expense = coaExpenses.get(object);

      extraRows.push({
        Dept_Code: targetOrg,
        Dept_Name: deptName,
        Note: needsOwnProjectScope ? "Statutory & Other" : "",
        Project_Code: needsOwnProjectScope ? project : "",
        Project_Name: "",
        Object_Code: object,
        Object_Name: expense ? expense.Object_Name : "Unclassified Account",
        Object_Type: expense ? expense.Object_Type : "",
        FY2027_Proposed: 0
      });

      if (needsOwnProjectScope) coverageFor(targetOrg, object).scopes.add(project);
      else coverageFor(targetOrg, object).any = true;
    }

    (originalBudgetRows || []).forEach((r) => considerRow(String(r.org || "").trim(), String(r.object || "").trim(), String(r.project || "").trim()));
    (actualRows || []).forEach((r) => considerRow(String(r.org || "").trim(), String(r.object || "").trim(), String(r.project || "").trim()));

    if (isMissingRowsDebugEnabled()) {
      console.log("MissingRows debug: synthesized " + extraRows.length + " expense row(s)", extraRows);
    }
    if (!extraRows.length) return rows;
    return rows.concat(extraRows);
  }

  // Revenue counterpart of synthesizeMissingExpenseRows above.
  function synthesizeMissingRevenueRows(revenueRows, originalBudgetRows, actualRows, coaDepartments, coaRevenueCodes, knownDeptNames, excludedKeys, excludedOrgs) {
    const existingKeys = new Set(
      (revenueRows || []).map((r) => String(r.Dept_Code || "").trim() + "|" + String(r.Revenue_Code || "").trim())
    );
    const deptByCode = new Map((coaDepartments || []).map((d) => [String(d.Dept_Code || "").trim(), d]));
    const seenNewKeys = new Set();
    const extraRows = [];

    function considerRow(org, object) {
      if (!org || !object || !isLikelyRevenueCode(object) || excludedOrgs.has(org)) return;
      const key = org + "|" + object;
      if (existingKeys.has(key) || seenNewKeys.has(key) || excludedKeys.has(key)) return;
      seenNewKeys.add(key);

      const dept = deptByCode.get(org);
      const deptName = DEPT_CODE_NAME_OVERRIDES.get(org) || resolveSynthesizedDeptName(dept, knownDeptNames);
      const revenue = coaRevenueCodes.get(object);

      extraRows.push({
        Dept_Code: org,
        Dept_Name: deptName,
        Note: "",
        Project_Name: "",
        Revenue_Code: object,
        Revenue_Name: revenue ? revenue.Revenue_Name : "Unclassified Account",
        Revenue_Type: revenue ? revenue.Revenue_Type : "Miscellaneous Revenue",
        FY2027_Proposed: 0
      });
    }

    (originalBudgetRows || []).forEach((r) => considerRow(String(r.org || "").trim(), String(r.object || "").trim()));
    (actualRows || []).forEach((r) => considerRow(String(r.org || "").trim(), String(r.object || "").trim()));

    if (isMissingRowsDebugEnabled()) {
      console.log("MissingRows debug: synthesized " + extraRows.length + " revenue row(s)", extraRows);
    }
    if (!extraRows.length) return revenueRows || [];
    return (revenueRows || []).concat(extraRows);
  }

  // Revenue rows that represent a reduction against whatever Revenue_Name
  // category they're merged into (combineByName) rather than a collection,
  // so they must subtract from that category's total instead of adding to
  // it. Dept_Code 102389 / Revenue_Code 389001 (relabeled to Ad Valorem
  // Taxes above) is the statutory 5% Ad Valorem discount -- it must always
  // contribute a negative amount to the FY2026 budget merge below,
  // regardless of which sign the source data happens to carry.
  const SUBTRACTIVE_REVENUE_KEYS = new Set(["102389|389001"]);

  function isSubtractiveRevenueRow(row) {
    const key = String((row && row.Dept_Code) || "").trim() + "|" + String((row && row.Revenue_Code) || "").trim();
    return SUBTRACTIVE_REVENUE_KEYS.has(key);
  }

  // FY2026 budget contribution for one row being folded into a
  // combineByName merge: a normal revenue row's raw value is sign-flipped
  // by revenueDisplayAmount (Supabase stores revenue as a credit/negative
  // amount), but a subtractive row above must stay negative -- forced
  // negative outright rather than trusting the source sign, per its
  // definition as a reduction.
  function revenueBudgetMergeContribution(row) {
    const raw = row.FY2026_Original_Budget || row.FY2026_Budget || 0;
    return isSubtractiveRevenueRow(row) ? -Math.abs(raw) : revenueDisplayAmount(raw);
  }

  // The sheet's Dept_Code for a row doesn't always match what Supabase
  // actually has that account under -- a sheet data-entry mismatch, not a
  // real alternate org. The one sheet row for the Ad Valorem 5% reduction
  // (Dept_Code 102389 / Revenue_Code 389001) actually needs to sum two
  // separate per-fund accounts in Supabase, since the 5% statutory
  // reduction applies separately to each fund that levies Ad Valorem tax:
  // org 001389 (General Fund) and org 105389 (Mosquito Control), both
  // Revenue_Code 389001. (The Sheriff Fund's own version of this account is
  // deliberately left out.) Unlike DEPT_CODE_ACTUALS_ALIASES (a real org
  // with multiple legitimate codes, summed because they're genuinely the
  // same account), this overrides the org/object lookups outright for the
  // one sheet row affected.
  // org 201389 / object 389000 ($55,000) is a separate, legitimate
  // Nonoperating Balance Brought Forward account with no sheet row of its
  // own -- folded into the Board of County Commissioners' own 001389/389000
  // row (already in the same Other Sources / Nonoperating Balance merge
  // group on combineByName summaries) rather than redirected away from it.
  const SUPABASE_LOOKUP_OVERRIDES = new Map([
    ["102389|389001", [{ org: "001389", object: "389001" }, { org: "105389", object: "389001" }]],
    ["001389|389000", [{ org: "001389", object: "389000" }, { org: "201389", object: "389000" }]]
  ]);

  function supabaseLookupsForRow(row, org, codeValue) {
    const key = String((row && row.Dept_Code) || "").trim() + "|" + String(codeValue || "").trim();
    return SUPABASE_LOOKUP_OVERRIDES.get(key) || [{ org: org, object: codeValue }];
  }

  // The Ad Valorem 5% statutory reduction's one sheet row (Dept_Code
  // 102389) is filed under fund "102", which isn't one of the funds shown
  // on the Fund Financial Schedules page -- so on a fund-scoped table this
  // row is invisible and the reduction never gets subtracted from the
  // fund(s) it actually applies to (see SUPABASE_LOOKUP_OVERRIDES above).
  // The county-wide Consolidated Revenue Summary doesn't filter by fund the
  // same way, so it already nets this out correctly; a fund-scoped table
  // has to pull each fund's own share back out of Supabase directly.
  const AD_VALOREM_FIVE_PERCENT_ORG_BY_FUND = { "001": "001389", "105": "105389" };

  function isAdValoremFivePercentRow(row) {
    return String((row && row.Dept_Code) || "").trim() === "102389" && String((row && row.Revenue_Code) || "").trim() === "389001";
  }

  function adValoremFivePercentReductionForFunds(fundCodes) {
    const rows = cache.originalBudgetRows || [];
    let total = 0;
    (fundCodes || []).forEach((fundCode) => {
      const org = AD_VALOREM_FIVE_PERCENT_ORG_BY_FUND[fundCode];
      if (!org) return;
      const result = sumRawActualsForAccount(rows, org, "389001", 2026);
      if (result.matched) total += result.total;
    });
    return total ? -Math.abs(total) : 0;
  }

  // Sums sumRawActualsForAccount across every (org, object) lookup for a
  // row (normally just the row's own org/code, but several when an
  // override above applies), matched if any of them found data.
  function sumRawActualsForLookups(rawRows, lookups, year, projectScope) {
    let matched = false;
    let total = 0;
    (lookups || []).forEach((lookup) => {
      const result = sumRawActualsForAccount(rawRows, lookup.org, lookup.object, year, projectScope);
      if (result.matched) {
        matched = true;
        total += result.total;
      }
    });
    return { matched, total };
  }

  // Departments whose own revenue row is really just the shared General
  // Fund Ad Valorem line (Dept_Code 001311, Revenue_Code 311000) referenced
  // by two dozen other departments -- its prior-year actuals/budget can't be
  // meaningfully attributed to this one department specifically, so the
  // "View Prior Years" option and its disclaimer are removed entirely for
  // their revenue tables rather than shown with a caveat (see
  // renderBudgetLinesToggle's isPriorYearsDisabledRevenue).
  const PRIOR_YEARS_DISABLED_REVENUE_DEPT_NAMES = new Set([
    "statutory and other",
    "non profit funding program",
    "clerk of court",
    "tax collector",
    "supervisor of elections",
    "property appraiser"
  ]);

  // Department-specific data-limitation notices shown alongside a
  // department's budget lines (see renderBudgetLinesToggle's
  // departmentDataNote), keyed by normalized Dept_Name.
  const DEPARTMENT_DATA_NOTES = new Map([
    [
      "walton county health department",
      "Due to an accounting change actuals for 2020, 2021, and 2022 are not captured in this report, please reach out to the Office of Management and Budget if you wish to view those years."
    ],
    [
      "statutory and other",
      "Due to an accounting change actuals for 2020, 2021, and 2022 are not captured in this report, please reach out to the Office of Management and Budget if you wish to view those years."
    ]
  ]);

  function applyActualsToRows(rows, rawActualRows) {
    if (!rawActualRows || !rawActualRows.length) return rows;

    // Several FY2027 budget lines can share one department+account (e.g.
    // multiple itemized equipment purchases under object 564000). The
    // account-level actual total only needs computing once per group;
    // every other row in that group is zeroed so a total doesn't multiply
    // it by however many budget lines exist under that account. Dept_Name is
    // part of the group key (not just Dept_Code) because some departments
    // split one Dept_Code across multiple Dept_Names/sub-programs (e.g. Code
    // Compliance / Code Compliance Beach both under 00102030) -- actuals
    // aren't tracked at that sub-program grain, so each Dept_Name still
    // needs its own (undivided, department-wide) actual total rather than
    // having a sibling Dept_Name's row claim it and leave this one at zero.
    // Cross-Dept_Name double-counting at the fund level is guarded against
    // separately in buildFundFinancialSchedule's sumFor.
    const seenGroups = new Set();
    return (rows || []).map((row) => {
      // Expense rows key on Object_Code; revenue rows have no Object_Code
      // at all and key on Revenue_Code instead.
      const codeValue = row.Object_Code !== undefined ? row.Object_Code : row.Revenue_Code;
      const org = row.Dept_Code;
      const projectScope = projectScopeForRow(row);
      // Project scope is appended to the group key (only when defined, so
      // every other department's grouping is unaffected) for rows like
      // Statutory & Other's, where several different recipients share one
      // org+account and must each get their own group instead of collapsing
      // into one and zeroing the rest.
      const groupKey = String(org || "").trim() + "|" + String(row.Dept_Name || "").trim() + "|" + String(codeValue || "").trim() +
        (projectScope !== undefined ? "|" + projectScope : "");
      const isFirstInGroup = !seenGroups.has(groupKey);
      seenGroups.add(groupKey);

      const next = { ...row };
      if (!isFirstInGroup) {
        HISTORICAL_ACTUAL_YEARS.forEach((year) => {
          next["FY" + year + "_Actual"] = 0;
        });
        return next;
      }

      const lookups = supabaseLookupsForRow(row, org, codeValue);
      HISTORICAL_ACTUAL_YEARS.forEach((year) => {
        const field = "FY" + year + "_Actual";
        const result = sumRawActualsForLookups(rawActualRows, lookups, year, projectScope);
        next[field] = result.matched ? result.total : (row[field] || 0);
      });
      return next;
    });
  }

  // FY2026 Original Budget comes from the Supabase BUC cache
  // (expense_original_budget_public). Despite the legacy view name, the
  // BUC source can include revenue and expense codes, so this is applied to
  // both datasets below. Same department+account-level grain and the same
  // sum-across-projects treatment as applyActualsToRows above.
  function applyOriginalBudgetToRows(rows, rawBudgetRows) {
    if (!rawBudgetRows || !rawBudgetRows.length) return rows;

    const seenGroups = new Set();
    return (rows || []).map((row) => {
      const codeValue = row.Object_Code !== undefined ? row.Object_Code : row.Revenue_Code;
      const org = row.Dept_Code;
      const projectScope = projectScopeForRow(row);
      const groupKey = String(org || "").trim() + "|" + String(row.Dept_Name || "").trim() + "|" + String(codeValue || "").trim() +
        (projectScope !== undefined ? "|" + projectScope : "");
      const isFirstInGroup = !seenGroups.has(groupKey);
      seenGroups.add(groupKey);

      if (!isFirstInGroup) {
        return { ...row, FY2026_Original_Budget: 0 };
      }

      const lookups = supabaseLookupsForRow(row, org, codeValue);
      const result = sumRawActualsForLookups(rawBudgetRows, lookups, 2026, projectScope);
      return { ...row, FY2026_Original_Budget: result.matched ? result.total : (row.FY2026_Original_Budget || row.FY2026_Budget || 0) };
    });
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Only http(s)/mailto links are allowed through; anything else
  // (javascript:, data:, vbscript:, a bare "//evil.com", etc.) is rejected
  // so a sheet editor can't turn narrative text into an XSS vector.
  function sanitizeNarrativeUrl(url) {
    const trimmed = String(url || "").trim();
    return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : "";
  }

  // Renders narrative text pulled from Google Sheets: escapes it for safe
  // HTML output, then converts markdown-style **bold** spans into <strong>
  // and [Link Text](https://example.com) spans into target="_blank" links.
  // Used for Statement of Function, Mission, Budget Highlights, and any
  // other narrative content loaded from the sheets.
  function formatNarrativeText(value) {
    const text = String(value === undefined || value === null ? "" : value);
    const pattern = /\*\*(.+?)\*\*|\[([^[\]]+)\]\(([^()\s]+)\)/gs;
    let result = "";
    let lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      result += escapeHtml(text.slice(lastIndex, match.index));
      if (match[1] !== undefined) {
        result += "<strong>" + escapeHtml(match[1]) + "</strong>";
      } else {
        const linkText = escapeHtml(match[2]);
        const safeUrl = sanitizeNarrativeUrl(match[3]);
        result += safeUrl
          ? '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + linkText + "</a>"
          : linkText;
      }
      lastIndex = pattern.lastIndex;
    }
    result += escapeHtml(text.slice(lastIndex));
    return result;
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

  function formatCompactCurrency(value) {
    const n = typeof value === "number" ? value : toNumber(value);
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1000000000) return sign + "$" + (abs / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
    if (abs >= 1000000) return sign + "$" + (abs / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1000) return sign + "$" + (abs / 1000).toFixed(0) + "K";
    return sign + "$" + abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
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

  // Some Dept_Codes are shared by Dept_Names that are NOT the same
  // department split into sub-programs -- they're unrelated line items that
  // happen to book under one shared org code (e.g. Court Innovations and
  // Board of County Commissioners both sit on 00101000; Indigent Cremation
  // Program and Non-Profit Funding Program both sit on 00102014). Naively
  // grouping every row by Dept_Code alone would wrongly merge those into one
  // row. The actual sub-program splits that should collapse (Code
  // Compliance / Code Compliance Beach, Planning / Planning Short-Term
  // Rental) always have one Dept_Name that's a literal prefix of the other,
  // so only those are clustered here -- the shorter, prefix name becomes the
  // cluster's representative/display name. Used by both
  // renderExpenseDepartmentBudgetLinesFooter and buildFundFinancialSchedule's
  // activity breakdowns.
  function clusterDeptNamesByCode(allRows) {
    const namesByCode = new Map();
    allRows.forEach((r) => {
      const code = String(r.Dept_Code || "").trim();
      const name = r.Dept_Name || "";
      if (!code || !name) return;
      if (!namesByCode.has(code)) namesByCode.set(code, new Set());
      namesByCode.get(code).add(name);
    });
    const repByCodeAndName = new Map();
    namesByCode.forEach((nameSet, code) => {
      const names = Array.from(nameSet).sort((a, b) => a.length - b.length);
      const repMap = new Map();
      names.forEach((name) => {
        if (repMap.has(name)) return;
        repMap.set(name, name);
        const norm = name.trim().toLowerCase();
        names.forEach((other) => {
          if (other === name || repMap.has(other)) return;
          if (other.trim().toLowerCase().startsWith(norm)) repMap.set(other, name);
        });
      });
      repByCodeAndName.set(code, repMap);
    });
    return repByCodeAndName;
  }

  function representativeDeptName(repByCodeAndName, r) {
    const code = String(r.Dept_Code || "").trim();
    const repMap = code && repByCodeAndName.get(code);
    return (repMap && repMap.get(r.Dept_Name)) || r.Dept_Name || "Unknown";
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

  function rowsForExactDepartment(rows, deptName) {
    const norm = normalizeDeptName(deptName);
    return (rows || []).filter((r) => normalizeDeptName(r.Dept_Name) === norm);
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

  function getFundCodeFromPage() {
    const el = document.querySelector("[data-fund-code]");
    return el && el.dataset.fundCode ? el.dataset.fundCode.trim() : "";
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
      Note: (row.Note || "").trim(),
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
      Note: (row.Note || "").trim(),
      Project_Code: (row.Project_Code || "").trim(),
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

  function buildMachineryRowsFromExpenditures(rows) {
    return (rows || [])
      .filter((row) => String(row.Object_Code || "").trim() === "564000")
      .map((row) => ({
        Dept_Code: row.Dept_Code || "",
        Dept_Name: row.Dept_Name || "",
        Item_Description: row.Note || row.Project_Name || row.Object_Name || "Machinery & Equipment",
        Amount: row.FY2027_Proposed || 0
      }))
      .filter((row) => row.Amount !== 0);
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

  function normalizeFundRow(row) {
    return {
      Fund_Code: (row.Fund_Code || "").trim(),
      Fund_Name: (row.Fund_Name || "").trim(),
      Fund_Type: (row.Fund_Type || "").trim(),
      Fund_Category: (row.Fund_Category || "").trim(),
      Major_NonMajor: (row.Major_NonMajor || "").trim()
    };
  }

  // Doubles as the "COA Departments" Chart of Accounts source for
  // synthesizeMissingExpenseRows/synthesizeMissingRevenueRows below
  // (Dept_Group/Org_Type weren't previously kept since nothing else used
  // them).
  function normalizeActivityRow(row) {
    return {
      Dept_Code: (row.Dept_Code || "").trim(),
      Dept_Name: (row.Dept_Name || "").trim(),
      Dept_Group: (row.Dept_Group || "").trim(),
      Org_Type: (row.Org_Type || "").trim(),
      Activity: (row.Activity || "").trim()
    };
  }

  function normalizeFundBalanceRow(row) {
    return {
      Year: (row.Year || "").trim(),
      Fund_Code: (row.Fund || "").trim(),
      Fund_Description: (row["Fund Description"] || "").trim(),
      Object_Description: (row["Object Description"] || "").trim(),
      Fund_Balance: toNumber(row["Fund Balance"])
    };
  }

  // The expenditure/revenue sheets don't have a Fund column directly; the
  // fund is encoded as the leading 3 digits of each row's Dept_Code, which
  // line up with Fund_Code values in the funds sheet (e.g. "00104000" and
  // "001381" both start with "001" for the General Fund).
  // org 20146000 (Infrastructure, a synthesized expense row -- see
  // synthesizeMissingExpenseRows) derives a fund code of "201" by the
  // normal Dept_Code.slice(0,3) rule, but that's the same fund-code
  // mismatch as its revenue counterpart (org 201389, already folded into
  // the General Fund's own 001389 row) -- General Fund carries this
  // expense too, so its fund code is corrected here, generally, rather
  // than treating "201" as a fund of its own anywhere a row's fund is
  // determined.
  const DEPT_CODE_FUND_OVERRIDES = new Map([["20146000", "001"]]);

  // org 20146000's own synthesized row (see considerRow below) finds no
  // match in the department catalog, so it would otherwise fall back to
  // the generic "Unclassified" Dept_Name -- but it's an Infrastructure
  // (Object_Code 563000) line, the same kind of spending already booked
  // under fund 300's own "Capital Projects" Dept_Name elsewhere (e.g. org
  // 30047030). Naming it "Capital Projects" here too means the Summary of
  // Expenses' Transportation activity chart groups it with that same
  // series instead of showing a separate, unhelpful "Unclassified" slice.
  const DEPT_CODE_NAME_OVERRIDES = new Map([["20146000", "Capital Projects"]]);

  // A synthesized row's catalog entry (the activities sheet) often carries
  // a Dept_Name too specific/inconsistent to match any real Dept_Name used
  // in the main expenditures/revenues sheets (e.g. "Supervisor of Elections
  // - Federal Elections Grant", "Human Resources (JAD)") -- knownDeptNames
  // rejects those, same as it should. But the same catalog row's Dept_Group
  // column is the clean rollup name for exactly this case ("Supervisor of
  // Elections", "Human Resources"), so it's tried next, before falling all
  // the way to the generic "Unclassified" -- but only when Dept_Group
  // itself is a real, known department name, so a financial/category
  // Dept_Group (e.g. "Ad Valorem Taxes", "Debt Service") never leaks in as
  // a fake department.
  function resolveSynthesizedDeptName(dept, knownDeptNames) {
    if (dept && knownDeptNames.has(normalizeDeptName(dept.Dept_Name))) return dept.Dept_Name;
    if (dept && knownDeptNames.has(normalizeDeptName(dept.Dept_Group))) return dept.Dept_Group;
    return UNCLASSIFIED_DEPT_NAME;
  }

  function fundCodeForRow(row) {
    const deptCode = String((row && row.Dept_Code) || "").trim();
    return DEPT_CODE_FUND_OVERRIDES.get(deptCode) || deptCode.slice(0, 3);
  }

  // True when a fund is shared by more than one department (e.g. the
  // General Fund, 001, used by two dozen departments) -- the revenue
  // actuals/budget disclaimer only applies there, since that's the only
  // case where the fund-scoped fallbacks above still aggregate across
  // multiple departments. A single-department fund (e.g. 107, the Sheriff
  // Fund) has nothing else to aggregate, so the disclaimer would be untrue
  // for it. An unknown/blank fund code (combineByName's merged,
  // multi-department rows) defaults to true since those rows really do
  // span several departments.
  function fundHasMultipleDepartments(fundCode) {
    if (!fundCode) return true;
    const names = new Set();
    (cache.revenues || []).forEach((r) => {
      if (fundCodeForRow(r) !== fundCode) return;
      const name = normalizeDeptName(r.Dept_Name);
      if (name) names.add(name);
    });
    return names.size > 1;
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
      ["departmentNarratives", DATA_SOURCES.departmentNarratives, normalizeNarrativeRow],
      ["funds", DATA_SOURCES.funds, normalizeFundRow],
      ["activities", DATA_SOURCES.activities, normalizeActivityRow],
      ["fundBalances", DATA_SOURCES.fundBalances, normalizeFundBalanceRow]
    ];

    cache.datasetCount = specs.length;

    loadPromise = Promise.all([
      Promise.allSettled(specs.map((spec) => fetchCSV(spec[1]).then((rows) => rows.map(spec[2])))),
      loadSupabaseActualLookups()
    ]).then(([results, actuals]) => {
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

      cache.expenditures = applyStatutoryExpenseOverrides(cache.expenditures);
      cache.revenues = applyRevenueNameOverrides(cache.revenues);

      if (actuals) {
        cache.expenseActualRows = actuals.expenseRows || [];
        cache.revenueActualRows = actuals.revenueRows || [];
        // Kept raw (not collapsed per row like applyOriginalBudgetToRows
        // does) so a fund-scoped schedule can pull one fund's own share
        // back out of a multi-fund SUPABASE_LOOKUP_OVERRIDES row -- see
        // adValoremFivePercentReductionForFunds.
        cache.originalBudgetRows = actuals.originalBudgetRows || [];

        // Add a placeholder row for any Supabase department+account that
        // has no row at all in the sheet, before the actuals/budget
        // machinery below runs, so it picks them up the same way it does
        // every other row -- and so does every table downstream that reads
        // cache.expenditures/cache.revenues (Summary of Expenses/Revenues,
        // every department's own Budget/Revenue Lines popup), with no
        // per-table special-casing needed. Built from the sheet's
        // *pre-synthesis* state, since these are catalogs/known-name lists,
        // not row data that needs the new rows reflected in it.
        const knownDeptNames = buildKnownDeptNames(cache.expenditures, cache.revenues);
        const excludedKeys = overrideRedirectTargetKeys();
        const excludedOrgs = aliasTargetOrgCodes();
        const expenseObjectCatalog = buildExpenseObjectCatalog(cache.expenditures);
        const revenueCodeCatalog = buildRevenueCodeCatalog(cache.revenues);
        cache.expenditures = synthesizeMissingExpenseRows(
          cache.expenditures, actuals.originalBudgetRows, actuals.expenseRows,
          cache.activities, expenseObjectCatalog, knownDeptNames, excludedKeys
        );
        cache.revenues = synthesizeMissingRevenueRows(
          cache.revenues, actuals.originalBudgetRows, actuals.revenueRows,
          cache.activities, revenueCodeCatalog, knownDeptNames, excludedKeys, excludedOrgs
        );

        cache.expenditures = applyActualsToRows(cache.expenditures, actuals.expenseRows);
        cache.revenues = applyActualsToRows(cache.revenues, actuals.revenueRows);
        cache.expenditures = applyOriginalBudgetToRows(cache.expenditures, actuals.originalBudgetRows);
        cache.revenues = applyOriginalBudgetToRows(cache.revenues, actuals.originalBudgetRows);
      }

      // Computed once per load from the now-finalized cache.expenditures,
      // and shared by the Consolidated Expense Summary and
      // buildFundFinancialSchedule for FY2020-FY2026 -- see
      // buildDedupedHistoricalExpenseRows.
      cache.dedupedExpenseRows = buildDedupedHistoricalExpenseRows(cache);

      cache.machinery = buildMachineryRowsFromExpenditures(cache.expenditures);

      return cache;
    });

    return loadPromise;
  }

  // ---- rendering primitives ----

  function priorYearsToggleHtml(showPrior, extraWrapClass, scope) {
    const priorScope = scope || "budget";
    const expanded = showPrior ? "true" : "false";
    const visibleLabel = showPrior ? "Hide Prior Years" : "View Prior Years";
    const accessibleLabel = showPrior ? "Hide prior years" : "View prior years";
    const button =
      '<button type="button" class="wc-fy-column-toggle-button" data-wc-prior-years-scope="' + escapeHtml(priorScope) + '" aria-expanded="' + expanded + '" aria-label="' + accessibleLabel + '">' +
      '<span class="wc-fy-column-toggle-indicator" aria-hidden="true">' + (showPrior ? "✓" : "") + "</span>" +
      '<span class="wc-fy-column-toggle-text">' + visibleLabel + "</span>" +
      "</button>";
    return '<div class="wc-fy-column-toggle-wrap' + (extraWrapClass ? " " + extraWrapClass : "") + '">' + button + "</div>";
  }

  function renderNotesHtml(title, notes) {
    if (!notes || !notes.length) return "";
    return (
      '<div class="wc-staffing-notes"><p class="wc-staffing-notes-title">' + escapeHtml(title) + "</p>" +
      notes.map((n) => "<p>" + escapeHtml(n) + "</p>").join("") +
      "</div>"
    );
  }

  let budgetLinesDetailCounter = 0;
  let fundScheduleActivityCounter = 0;

  // The expandable "View Budget Lines" detail under an Expenditure Summary
  // table: every individual object-code line behind that table's rolled-up
  // totals, including any itemized sub-account (Project_Name) and Note.
  const BUDGET_LINE_PRIOR_YEAR_COLUMNS = [
    { field: "FY2020_Actual", label: "FY 2020 Actual", year: 2020, actual: true },
    { field: "FY2021_Actual", label: "FY 2021 Actual", year: 2021, actual: true },
    { field: "FY2022_Actual", label: "FY 2022 Actual", year: 2022, actual: true },
    { field: "FY2023_Actual", label: "FY 2023 Actual", year: 2023, actual: true },
    { field: "FY2024_Actual", label: "FY 2024 Actual", year: 2024, actual: true },
    { field: "FY2025_Actual", label: "FY 2025 Actual", year: 2025, actual: true },
    // Sourced from expense_original_budget_public (Supabase), not the
    // Google Sheets FY2026_Budget field. Not flagged `actual: true` --
    // budget amounts never drill through to transaction detail, only
    // historical actuals do.
    { field: "FY2026_Original_Budget", label: "FY 2026 Budget" }
  ];

  function budgetLinePriorYearColumns(isExpense) {
    return BUDGET_LINE_PRIOR_YEAR_COLUMNS;
  }

  function splitBudgetLineCodes(value) {
    return String(value || "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
  }

  function revenueActualAmountForCodes(codes, year, fundCode) {
    const codeSet = new Set((codes || []).filter(Boolean));
    if (!codeSet.size || !(cache.revenueActualRows || []).length) return 0;
    return (cache.revenueActualRows || []).reduce((sum, row) => {
      if (Number(row.year) !== Number(year)) return sum;
      if (!codeSet.has(String(row.object || "").trim())) return sum;
      const rowFundCode = String(row.org || "").trim().slice(0, 3);
      if (CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(rowFundCode)) return sum;
      // See revenueBudgetAmountForCodes: a single-department fund (e.g.
      // 107, the Sheriff Fund) should never borrow another fund's actuals
      // for a code it has no organization-scoped data of its own for.
      // Shared funds (e.g. 001) still aggregate across every org in that
      // fund, since they're all genuinely in the same fund.
      if (fundCode && rowFundCode !== fundCode) return sum;
      return sum + (Number(row.amount) || 0);
    }, 0);
  }

  function revenueBudgetAmountForCodes(codes, field, fundCode) {
    const codeSet = new Set((codes || []).filter(Boolean));
    if (!codeSet.size) return 0;
    // A shared GL code (e.g. the General Fund's Ad Valorem Taxes line,
    // Dept_Code 001311) can be referenced by two dozen different
    // departments' own revenue rows under that same Dept_Code. Their
    // FY2026_Original_Budget is intentionally NOT deduped by Dept_Name in
    // applyOriginalBudgetToRows (a different case -- one department split
    // across several Dept_Names, like Code Compliance / Code Compliance
    // Beach -- needs each one to keep the full total). Summed here without
    // a guard, that single account-level amount gets counted once per
    // department referencing it instead of once overall. revenueBudgetUniqueKey
    // (the same dedup key buildFundFinancialSchedule's sumFor already uses
    // for this exact scenario) excludes Dept_Name, so it collapses those
    // department-duplicated rows back down to one.
    //
    // fundCode (when given) additionally restricts the fallback to rows in
    // the same fund as the row being displayed. Single-department funds
    // (e.g. 107, the Sheriff Fund) should never borrow a county-wide total
    // from a fund they have nothing to do with -- a department with no
    // direct match in this fund simply has no budget for that code. Shared
    // funds (e.g. 001, the General Fund) still aggregate across every
    // department in that fund exactly as before, since they're all in the
    // same fund anyway. Callers omit fundCode entirely for combineByName's
    // merged, multi-fund county-wide rows, where no single fund applies.
    const seenKeys = new Set();
    return (cache.revenues || []).reduce((sum, row) => {
      if (!codeSet.has(String(row.Revenue_Code || "").trim())) return sum;
      if (CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(row))) return sum;
      if (fundCode && fundCodeForRow(row) !== fundCode) return sum;
      const key = revenueBudgetUniqueKey(row);
      if (seenKeys.has(key)) return sum;
      seenKeys.add(key);
      return sum + (row[field] || 0);
    }, 0);
  }

  function revenueDisplayAmount(value) {
    return Math.abs(Number(value) || 0);
  }

  function revenueBudgetUniqueKey(row) {
    return [
      fundCodeForRow(row),
      String((row && row.Dept_Code) || "").trim(),
      String((row && row.Revenue_Code) || "").trim(),
      String((row && row.Project_Code) || "").trim()
    ].join("|");
  }

  function budgetLineColumnAmount(row, column, isExpense) {
    if (!isExpense && column.actual) {
      // Many revenue codes (Ad Valorem Taxes, Interfund Group Transfer In,
      // etc.) are reused across many different departments/funds, each with
      // its own distinct historical amount -- they aren't one pooled,
      // county-wide collection that happens to get split out at budget
      // time. So always prefer this row's own department+code actual when
      // Supabase has it, and only fall back to the unscoped county-wide
      // lookup when there's genuinely no department-level data to scope to
      // (e.g. a revenue source that really was only ever tracked centrally).
      const scoped = sumRawActualsForAccount(cache.revenueActualRows, row.Dept_Code, row.Revenue_Code, column.year);
      if (scoped.matched) return revenueDisplayAmount(scoped.total);
      return revenueDisplayAmount(
        revenueActualAmountForCodes(splitBudgetLineCodes(row.Revenue_Code), column.year, fundCodeForRow(row))
      );
    }
    if (!isExpense && column.field === "FY2026_Original_Budget") {
      const codes = splitBudgetLineCodes(row.Revenue_Code);
      const fundCode = fundCodeForRow(row);
      const rowAmount = row.FY2026_Original_Budget || row.FY2026_Budget || 0;
      return revenueDisplayAmount(rowAmount ||
        revenueBudgetAmountForCodes(codes, "FY2026_Original_Budget", fundCode) ||
        revenueBudgetAmountForCodes(codes, "FY2026_Budget", fundCode));
    }
    return row[column.field] || 0;
  }

  function budgetLineColumnTotal(rows, column, isExpense) {
    if (!isExpense && column.actual) {
      // See budgetLineColumnAmount: prefer each row's own department-scoped
      // actual when Supabase has it, summed once per distinct
      // department+code pair, and only fold a code into the unscoped
      // county-wide lookup when no row in this table has department-level
      // data for it at all.
      const codes = [];
      const scopedPairsSeen = new Set();
      let scopedTotal = 0;
      let fundCode = "";
      (rows || []).forEach((row) => {
        if (!fundCode) fundCode = fundCodeForRow(row);
        splitBudgetLineCodes(row.Revenue_Code).forEach((code) => {
          const pairKey = String(row.Dept_Code || "").trim() + "|" + code;
          if (scopedPairsSeen.has(pairKey)) return;
          const scoped = sumRawActualsForAccount(cache.revenueActualRows, row.Dept_Code, code, column.year);
          if (scoped.matched) {
            scopedPairsSeen.add(pairKey);
            scopedTotal += scoped.total;
            return;
          }
          if (!codes.includes(code)) codes.push(code);
        });
      });
      return revenueDisplayAmount(revenueActualAmountForCodes(codes, column.year, fundCode) + scopedTotal);
    }
    if (!isExpense && column.field === "FY2026_Original_Budget") {
      // A zero rowAmount is ambiguous: it can mean "no data for this row,
      // fall back to a code-level lookup" (the original intent below) or
      // "this row's account-level total is already counted by another row
      // sharing the same code" (applyOriginalBudgetToRows zeroes every row
      // but the first in a department+code group on purpose). Tracking
      // which codes already have a real rowAmount keeps the second case
      // from also pulling in a countywide fallback on top of the correct,
      // already-counted amount.
      const codesWithRowAmount = new Set();
      const fallbackCodes = [];
      let rowTotal = 0;
      let fundCode = "";
      (rows || []).forEach((row) => {
        if (!fundCode) fundCode = fundCodeForRow(row);
        const rowAmount = row.FY2026_Original_Budget || row.FY2026_Budget || 0;
        const codes = splitBudgetLineCodes(row.Revenue_Code);
        if (rowAmount) {
          rowTotal += rowAmount;
          codes.forEach((code) => codesWithRowAmount.add(code));
          return;
        }
        codes.forEach((code) => {
          if (!fallbackCodes.includes(code)) fallbackCodes.push(code);
        });
      });
      const eligibleFallbackCodes = fallbackCodes.filter((code) => !codesWithRowAmount.has(code));
      const fallbackTotal =
        revenueBudgetAmountForCodes(eligibleFallbackCodes, "FY2026_Original_Budget", fundCode) ||
        revenueBudgetAmountForCodes(eligibleFallbackCodes, "FY2026_Budget", fundCode);
      return revenueDisplayAmount(rowTotal + fallbackTotal);
    }
    return (rows || []).reduce((sum, row) => sum + (row[column.field] || 0), 0);
  }

  function itemizedDescriptionForBudgetLine(row, descriptionField, isExpense) {
    if (!descriptionField && isExpense) {
      if (row.Project_Name && row.Note && row.Project_Name !== row.Note) return row.Project_Name + " — " + row.Note;
      return row.Project_Name || row.Note || "";
    }
    if (!descriptionField) return row.Note || row.Project_Name || "";
    const primary = row[descriptionField] || "";
    const fallback = isExpense ? (row.Project_Name || row.Note || "") : (row.Note || row.Project_Name || "");
    if (primary && fallback && primary !== fallback) return primary + " — " + fallback;
    return primary || fallback || "";
  }

  function slugParam(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Office of Management and Budget (the original pilot) plus every
  // Constitutional Officers & Other Agencies page except Board of County
  // Commissioners -- both the "Constitutional Officers" section (Clerk,
  // Property Appraiser, Sheriff, Supervisor of Elections, Tax Collector)
  // and the "Autonomous Entities" section. Dept_Name values below are the
  // actual sheet values confirmed against the live data, not the page
  // titles -- several pages don't match 1:1: the Clerk's page is titled
  // "Clerk of Courts & County Comptroller" but the sheet rows are Dept_Name
  // "Clerk of Court"; the Sheriff's page rows are "Walton County Sheriff's
  // Office"; "Court Technology & Innovations" is split across two sheet
  // Dept_Names ("Court Innovations" and "Court Technology - Court
  // Administration"); "South Walton Fire & State Control" is split across
  // three ("South Walton Fire", "State Fire", "Volunteer Fire" -- not
  // "South Walton Fire Lifeguard Services", which the activities sheet
  // classifies under Tourism Administration, not Autonomous Entities, and
  // belongs to the separate Tourism Lifeguard Services and Beach Safety
  // page instead).
  const TRANSACTION_DRILLDOWN_DEPT_NAMES = new Set(
    [
      "Office of Management and Budget",
      "Building Construction and Maintenance",
      "Clerk of Court",
      "Property Appraiser",
      "Supervisor of Elections",
      "Tax Collector",
      "Walton County Sheriff's Office",
      "Circuit Court",
      "County Court",
      "Court Innovations",
      "Court Technology - Court Administration",
      "Guardian Ad Litem",
      "Medical Examiner",
      "Mosquito Control",
      "Mosquito Control State Aid",
      "Non-Profit Funding Program",
      "Public Defender",
      "South Walton Fire",
      "State Fire",
      "Volunteer Fire",
      "State Attorney",
      "Statutory & Other",
      "Walton County Health Department"
    ].map(normalizeDeptName)
  );

  function transactionDrilldownEnabledForRow(row) {
    return TRANSACTION_DRILLDOWN_DEPT_NAMES.has(normalizeDeptName(row && row.Dept_Name));
  }

  function transactionHrefForBudgetLine(row, column, fields) {
    if (!column.actual || !transactionDrilldownEnabledForRow(row)) return "";
    // Must match what the cell actually displays (budgetLineColumnAmount),
    // not row[column.field] directly: for revenue, the displayed actual is
    // a county-wide lookup by Revenue_Code, independent of which row in an
    // account-level dedup group this one is. Reading row[column.field]
    // directly would show $0 (and no link) for every row that the account
    // dedup zeroed, even though the cell is correctly showing a real,
    // non-zero amount sourced from the same account total.
    const isExpense = !fields || fields.kind !== "revenue";
    const amount = budgetLineColumnAmount(row, column, isExpense);
    if (!amount) return "";

    const params = new URLSearchParams();
    const category = row[fields.categoryField] || "";
    const objectCode = row[fields.codeField] || "";
    const objectName = row[fields.nameField] || "";
    const projectCode = row.Project_Code || "";
    const projectName = row.Project_Name || "";
    const deptCode = row.Dept_Code || "";
    // Some departments' transaction history is split across legacy org
    // codes (see DEPT_CODE_ACTUALS_ALIASES); pass all of them so the
    // transaction detail page's query isn't limited to the current code
    // alone and missing years recorded under a prior code.
    const orgCodes = deptCode ? [deptCode].concat(DEPT_CODE_ACTUALS_ALIASES[deptCode] || []) : [];
    const transactionPage = window.location.pathname.indexOf("/pages/") !== -1 ? "transactions.html" : "pages/transactions.html";

    params.set("fy", String(column.year));
    params.set("category", slugParam(category));
    params.set("categoryLabel", category);
    params.set("kind", fields.kind || "expense");
    params.set("selectedActual", String((fields.kind || "expense") === "revenue" ? Math.abs(amount) : amount));
    params.set("objectCode", objectCode);
    params.set("objectName", objectName);
    params.set("org", orgCodes.join(","));
    params.set("departmentCode", deptCode);
    params.set("departmentName", row.Dept_Name || "");
    params.set("fundCode", fundCodeForRow(row));
    if (projectCode) params.set("projectCode", projectCode);
    if (projectName) params.set("program", projectName);

    return transactionPage + "?" + params.toString();
  }

  // Object codes that should never appear as their own itemized row in any
  // Budget Lines / Revenue Lines detail table -- not real Chart of
  // Accounts accounts (500000 is a generic/rollup code with no Object_Name
  // of its own; 523004 is a stray sub-code variant), just noise picked up
  // by synthesizeMissingExpenseRows. Filtered here, not at the source, so
  // they're hidden from every "View Budget Lines" view without touching
  // whatever totals already sum over cache.expenditures.
  const HIDDEN_BUDGET_LINE_OBJECT_CODES = new Set(["500000", "523004"]);

  function renderBudgetLinesToggle(rows, descriptionField, kind, combineByName, forceDisablePriorYears) {
    if (!rows || !rows.length) return { button: "", detail: "" };
    const isExpense = kind !== "revenue";
    const codeFieldForFilter = isExpense ? "Object_Code" : "Revenue_Code";
    rows = rows.filter((r) => !HIDDEN_BUDGET_LINE_OBJECT_CODES.has(String(r[codeFieldForFilter] || "").trim()));
    if (!rows.length) return { button: "", detail: "" };
    budgetLinesDetailCounter += 1;
    const detailId = "wc-budget-lines-" + budgetLinesDetailCounter;
    // See PRIOR_YEARS_DISABLED_REVENUE_DEPT_NAMES. Guarded to
    // combineByName === false since this should only apply to the
    // department's own single-page breakdown, not a county-wide summary
    // (those keep the toggle -- see isRevenueContextNoteSuppressed below,
    // which removes just the disclaimer for them, not the toggle itself).
    // forceDisablePriorYears additionally covers secondary sub-program
    // expense cards (e.g. Code Compliance Beach) whose FY2026 figures
    // aren't reliable on their own -- see renderTypeSummaryTable's
    // showChange.
    const isPriorYearsDisabled = !!forceDisablePriorYears || (!isExpense && !combineByName && rows.length &&
      PRIOR_YEARS_DISABLED_REVENUE_DEPT_NAMES.has(normalizeDeptName(rows[0].Dept_Name)));
    // The "View Prior Years" preference is a single, page-wide localStorage
    // value shared by every table (see getShowPriorYears), so it isn't
    // enough to just hide this table's own checkbox -- showPrior has to be
    // forced false here too, or toggling it on anywhere else on the page
    // would still expand this table's prior-year columns.
    const showPrior = isPriorYearsDisabled ? false : getShowPriorYears();
    const codeField = isExpense ? "Object_Code" : "Revenue_Code";
    const nameField = isExpense ? "Object_Name" : "Revenue_Name";
    const categoryField = isExpense ? "Object_Type" : "Revenue_Type";
    const descField = descriptionField || "Note";
    const priorYearColumns = budgetLinePriorYearColumns(isExpense);

    // On consolidated/county-wide summaries, combine rows that share the
    // same name (e.g. the same revenue source collected under several
    // departments' Dept_Codes) into one line. On a single department's own
    // breakdown, every row is kept separate so distinct budget lines that
    // happen to share an Object/Revenue Name aren't hidden from each other.
    let mergedRows = rows;
    if (combineByName) {
      const sumFields = priorYearColumns.map((c) => c.field).concat(["FY2027_Proposed"]);
      const grouped = new Map();
      const seenRevenueOriginalBudget = new Map();
      rows.forEach((r) => {
        const name = r[nameField] || "";
        const existing = grouped.get(name);
        const description = itemizedDescriptionForBudgetLine(r, descriptionField, isExpense);
        if (!existing) {
          const merged = { codes: [r[codeField] || ""].filter(Boolean), descriptions: description ? [description] : [], category: r[categoryField] || "" };
          sumFields.forEach((f) => {
            if (!isExpense && f === "FY2026_Original_Budget") {
              const key = revenueBudgetUniqueKey(r);
              const seen = seenRevenueOriginalBudget.get(name) || new Set();
              merged[f] = seen.has(key) ? 0 : revenueBudgetMergeContribution(r);
              seen.add(key);
              seenRevenueOriginalBudget.set(name, seen);
            } else {
              merged[f] = r[f] || 0;
            }
          });
          grouped.set(name, merged);
          return;
        }
        if (r[codeField] && !existing.codes.includes(r[codeField])) existing.codes.push(r[codeField]);
        if (description && !existing.descriptions.includes(description)) existing.descriptions.push(description);
        sumFields.forEach((f) => {
          if (!isExpense && f === "FY2026_Original_Budget") {
            const key = revenueBudgetUniqueKey(r);
            const seen = seenRevenueOriginalBudget.get(name) || new Set();
            if (!seen.has(key)) {
              existing[f] += revenueBudgetMergeContribution(r);
              seen.add(key);
              seenRevenueOriginalBudget.set(name, seen);
            }
          } else {
            existing[f] += r[f] || 0;
          }
        });
      });
      mergedRows = Array.from(grouped.entries()).map(([name, merged]) => {
        const row = { [nameField]: name, [codeField]: merged.codes.join(", "), [descField]: merged.descriptions.join("; "), [categoryField]: merged.category };
        sumFields.forEach((f) => { row[f] = merged[f]; });
        return row;
      });
    }

    function groupedPriorYearRows() {
      const sumFields = priorYearColumns.map((c) => c.field).concat(["FY2027_Proposed"]);
      const grouped = new Map();
      // Tracks every distinct project scope seen per group key, so
      // Project_Code can be set on the merged row only when every row
      // folded into it agrees on one scope (see below).
      const projectScopesSeen = new Map();
      mergedRows.forEach((r) => {
        const key = [r[categoryField] || "", r[codeField] || "", r[nameField] || ""].join("||");
        const existing = grouped.get(key);
        const scope = projectScopeForRow(r);
        if (scope !== undefined) {
          const seen = projectScopesSeen.get(key) || new Set();
          seen.add(scope);
          projectScopesSeen.set(key, seen);
        }
        if (!existing) {
          const row = {
            [categoryField]: r[categoryField] || "",
            [codeField]: r[codeField] || "",
            [nameField]: r[nameField] || "",
            [descField]: "",
            // Needed by transactionHrefForBudgetLine/transactionDrilldownEnabledForRow.
            // Dept_Name/Dept_Code are identical across every row here (mergedRows is
            // already scoped to one department), so the first row's value is safe.
            Dept_Name: r.Dept_Name || "",
            Dept_Code: r.Dept_Code || ""
          };
          sumFields.forEach((f) => { row[f] = r[f] || 0; });
          grouped.set(key, row);
          return;
        }
        sumFields.forEach((f) => { existing[f] += r[f] || 0; });
      });
      // Project_Code is set on a merged row only when every row folded into
      // it shares the exact same project scope (e.g. Health Department,
      // whose one fixed project applies to its only row). When a group
      // mixes several different scopes -- Statutory & Other can merge
      // several distinct recipients sharing one Object_Code/Name under
      // different Project_Codes -- or a normal department's rows just don't
      // carry a scope at all, Project_Code is left unset, so the resulting
      // transaction filter falls back to department+code only, matching
      // every transaction the merged total was actually built from instead
      // of under-counting it down to one recipient's project.
      grouped.forEach((row, key) => {
        const scopes = projectScopesSeen.get(key);
        if (scopes && scopes.size === 1) {
          row.Project_Code = Array.from(scopes)[0];
        }
      });
      return Array.from(grouped.values());
    }

    function budgetLineRowHtml(r, rowClass, suppressDescription) {
      const isZeroCurrent = (r.FY2027_Proposed || 0) === 0;
      const drilldownFields = { categoryField, codeField, nameField, kind: isExpense ? "expense" : "revenue" };
      return (
        '<tr class="' + rowClass + (isZeroCurrent ? " wc-budget-line-zero-current" : "") + '">' +
        "<td>" + escapeHtml(r[categoryField] || "") + "</td>" +
        (isExpense ? "<td>" + escapeHtml(r[codeField] || "") + "</td>" : "") +
        "<td>" + escapeHtml(r[nameField] || "") + "</td>" +
        '<td class="wc-itemized-description-column">' + escapeHtml(suppressDescription ? "" : itemizedDescriptionForBudgetLine(r, descriptionField, isExpense)) + "</td>" +
        priorYearColumns.map((c) => {
          const href = transactionHrefForBudgetLine(r, c, drilldownFields);
          const value = formatCurrency(budgetLineColumnAmount(r, c, isExpense));
          const drilldownLabel = "View " + c.label + " transaction detail for " +
            (r[nameField] || r[codeField] || "this budget line") + " actual amount " + value;
          return '<td class="wc-num wc-prior-year">' +
            (href ? '<a class="wc-actual-drilldown-link" href="' + escapeHtml(href) + '" aria-label="' + escapeHtml(drilldownLabel) + '">' + value + "</a>" : value) +
            "</td>";
        }).join("") +
        '<td class="wc-num">' + formatCurrency(r.FY2027_Proposed || 0) + "</td></tr>"
      );
    }

    function budgetLineSubtotalRowHtml(category, categoryRows, rowClass) {
      const labelCells =
        "<td>" + escapeHtml(category) + " Subtotal</td>" +
        (isExpense ? "<td></td>" : "") +
        "<td></td>" +
        '<td class="wc-itemized-description-column"></td>';
      return (
        '<tr class="' + rowClass + ' wc-table-subtotal-row">' + labelCells +
          priorYearColumns.map((c) =>
            '<td class="wc-num wc-prior-year">' + formatCurrency(budgetLineColumnTotal(categoryRows, c, isExpense)) + "</td>"
          ).join("") +
          '<td class="wc-num">' + formatCurrency(categoryRows.reduce((sum, r) => sum + (r.FY2027_Proposed || 0), 0)) + "</td></tr>"
      );
    }

    // One subtotal row per category (Personnel Services, Operating
    // Expenditures, Capital Outlay, etc.) right after that category's own
    // rows, grouped in the order each category first appears once sorted
    // by code (which already clusters by category, since object/revenue
    // codes are assigned in category blocks). Skipped when there's only
    // one category in this set -- a single-category table (e.g. a
    // one-line supplemental card) would otherwise get a subtotal that
    // just repeats the grand total below it.
    function budgetLineRowsHtml(rowsToRender, rowClass, suppressDescription) {
      const sorted = rowsToRender
        .slice()
        .sort((a, b) => String(a[codeField] || "").localeCompare(String(b[codeField] || "")));

      const categoryOrder = [];
      const rowsByCategory = new Map();
      sorted.forEach((r) => {
        const category = r[categoryField] || "Other";
        if (!rowsByCategory.has(category)) {
          categoryOrder.push(category);
          rowsByCategory.set(category, []);
        }
        rowsByCategory.get(category).push(r);
      });

      if (categoryOrder.length <= 1) {
        return sorted.map((r) => budgetLineRowHtml(r, rowClass, suppressDescription));
      }

      const html = [];
      categoryOrder.forEach((category) => {
        const categoryRows = rowsByCategory.get(category);
        categoryRows.forEach((r) => html.push(budgetLineRowHtml(r, rowClass, suppressDescription)));
        html.push(budgetLineSubtotalRowHtml(category, categoryRows, rowClass));
      });
      return html;
    }

    const summaryRows = groupedPriorYearRows();
    const bodyRows = budgetLineRowsHtml(mergedRows, "wc-budget-line-detail-row", false)
      .concat(budgetLineRowsHtml(summaryRows, "wc-budget-line-summary-row", true));
    const totalFields = priorYearColumns.map((c) => c.field).concat(["FY2027_Proposed"]);
    const totals = {};
    totalFields.forEach((field) => {
      totals[field] = mergedRows.reduce((sum, row) => sum + (row[field] || 0), 0);
    });
    const totalLabelCells =
      "<td>Total</td>" +
      (isExpense ? "<td></td>" : "") +
      "<td></td>" +
      '<td class="wc-itemized-description-column"></td>';
    bodyRows.push(
      '<tr class="wc-table-total-row">' + totalLabelCells +
        priorYearColumns.map((c) =>
          '<td class="wc-num wc-prior-year">' + formatCurrency(budgetLineColumnTotal(mergedRows, c, isExpense)) + "</td>"
        ).join("") +
        '<td class="wc-num">' + formatCurrency(totals.FY2027_Proposed || 0) + "</td></tr>"
    );

    const detailTable = renderTable({
      columns: [{ label: "Category" }]
        .concat(isExpense ? [{ label: "Object Code" }] : [])
        .concat([
          { label: isExpense ? "Object Name" : "Revenue Name" },
          { label: "Itemized Description", classes: ["wc-itemized-description-column"] }
        ])
        .concat(
          priorYearColumns.map((c) => ({ label: c.label, num: true, classes: ["wc-prior-year"] })),
          [{ label: "FY 2027 Proposed", num: true }]
        ),
      bodyRows: bodyRows
    });

    const toggleHeader = isPriorYearsDisabled ? "" : priorYearsToggleHtml(showPrior, "wc-budget-lines-detail-header");
    const hasTransactionDrilldown = mergedRows.some(transactionDrilldownEnabledForRow);
    const transactionHelper = hasTransactionDrilldown
      ? '<p class="wc-transaction-drilldown-helper">Actual amounts open transaction detail.</p>'
      : "";
    // A combineByName revenue table (e.g. Summary of Revenues) keeps the
    // "View Prior Years" toggle -- it's a legitimate, intentional view of
    // every department combined -- but the disclaimer itself doesn't apply:
    // "shows only what is budgeted for this specific department or
    // program" is never true here, since every row already is the whole
    // organization combined by design.
    const isRevenueContextNoteSuppressed = isPriorYearsDisabled || combineByName;
    const revenueContextNote = (!isExpense && !isRevenueContextNoteSuppressed && mergedRows.length && fundHasMultipleDepartments(fundCodeForRow(mergedRows[0])))
      ? '<p class="wc-revenue-actuals-note">Past-year actuals may include total collections for this revenue source across the organization. Current budget amounts show only what is budgeted for this specific department or program.</p>'
      : "";
    const departmentDataNoteText = (isExpense && mergedRows.length) ? DEPARTMENT_DATA_NOTES.get(normalizeDeptName(mergedRows[0].Dept_Name)) : "";
    const departmentDataNote = departmentDataNoteText
      ? '<p class="wc-revenue-actuals-note">' + escapeHtml(departmentDataNoteText) + "</p>"
      : "";
    const budgetLinesTools = '<div class="wc-budget-lines-tools">' + revenueContextNote + departmentDataNote + toggleHeader + transactionHelper + "</div>";

    return {
      button: '<button type="button" class="wc-view-budget-lines-toggle" data-target="' + detailId + '" data-closed-label="View Budget Lines" data-open-label="Hide Budget Lines" aria-expanded="false">View Budget Lines</button>',
      detail: '<div class="wc-budget-lines-detail wc-budget-lines-card' + (showPrior ? " show-prior-years" : "") + '" id="' + detailId + '" hidden>' +
        budgetLinesTools + detailTable + "</div>"
    };
  }

  let activeBudgetDetailToggle = null;

  function ensureBudgetDetailModal() {
    let modal = document.querySelector(".wc-budget-detail-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "wc-budget-detail-modal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="wc-budget-detail-backdrop" data-budget-detail-close></div>' +
      '<section class="wc-budget-detail-card" role="dialog" aria-modal="true" aria-labelledby="wc-budget-detail-title">' +
        '<div class="wc-budget-detail-header">' +
          '<div>' +
            '<p class="wc-budget-detail-kicker">Budget Detail</p>' +
            '<h2 id="wc-budget-detail-title">Budget Lines</h2>' +
          '</div>' +
          '<button type="button" class="wc-budget-detail-close" data-budget-detail-close aria-label="Close budget detail">&times;</button>' +
        '</div>' +
        '<div class="wc-budget-detail-body"></div>' +
      '</section>';
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-budget-detail-close]")) {
        closeBudgetDetailModal();
      }
    });
    return modal;
  }

  function closeBudgetDetailModal() {
    const modal = document.querySelector(".wc-budget-detail-modal");
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove("is-open");
    document.body.classList.remove("wc-budget-detail-open");
    document.body.style.overflow = "";
    const body = modal.querySelector(".wc-budget-detail-body");
    if (body) {
      body.innerHTML = "";
      body.className = "wc-budget-detail-body";
    }
    if (activeBudgetDetailToggle) {
      activeBudgetDetailToggle.setAttribute("aria-expanded", "false");
      if (document.contains(activeBudgetDetailToggle)) {
        activeBudgetDetailToggle.focus({ preventScroll: true });
      }
      activeBudgetDetailToggle = null;
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeBudgetDetailModal();
    if ((event.key === " " || event.key === "Spacebar") && event.target && event.target.closest) {
      const drilldownLink = event.target.closest(".wc-actual-drilldown-link");
      if (drilldownLink) {
        event.preventDefault();
        drilldownLink.click();
      }
    }
  });

  function openBudgetDetailModal(toggle, detail) {
    const modal = ensureBudgetDetailModal();
    const title = modal.querySelector("#wc-budget-detail-title");
    const body = modal.querySelector(".wc-budget-detail-body");
    const label = toggle.dataset.closedLabel || toggle.textContent || "Budget Lines";
    if (title) title.textContent = label.replace(/^View\s+/i, "");
    if (body) {
      body.className = "wc-budget-detail-body wc-budget-lines-card";
      body.innerHTML = detail.innerHTML;
      body.querySelectorAll(".wc-fy-column-toggle-checkbox").forEach((checkbox) => {
        checkbox.removeAttribute("data-wc-prior-years-bound");
      });
      body.querySelectorAll(".wc-fy-column-toggle-button").forEach((button) => {
        button.removeAttribute("data-wc-prior-years-bound");
      });
      bindPriorYearsToggle(body);
      applyPriorYearsState(false, body);
      body.classList.remove("show-prior-years");
    }
    activeBudgetDetailToggle = toggle;
    toggle.setAttribute("aria-expanded", "true");
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    document.body.classList.add("wc-budget-detail-open");
    document.body.style.overflow = "hidden";
    const closeButton = modal.querySelector(".wc-budget-detail-close");
    if (closeButton) closeButton.focus({ preventScroll: true });
  }

  // Single delegated listener handles every detail button on the page,
  // regardless of which function rendered the card or table it belongs to.
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest(".wc-view-budget-lines-toggle");
    if (!toggle) return;
    const detail = document.getElementById(toggle.dataset.target);
    if (!detail) return;
    openBudgetDetailModal(toggle, detail);
  });

  // Fund Financial Schedule activity rows (see buildFundFinancialSchedule):
  // a Revenues/Expenditures group's activity rows are collapsed by default
  // until its group header is clicked, and each visible activity row can
  // then be clicked to expand its own department/revenue breakdown inline --
  // accordion-style within that one table, so opening another activity
  // closes whichever one was already open instead of stacking several at
  // once.
  function closeFundActivityDetail(toggle) {
    if (!toggle) return;
    const target = document.getElementById(toggle.dataset.target);
    if (target) target.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", (event) => {
    const groupToggle = event.target.closest(".wc-fund-activity-group-toggle");
    if (groupToggle) {
      const table = groupToggle.closest("table");
      if (!table) return;
      const groupKey = groupToggle.dataset.fundActivityGroup;
      const expanded = groupToggle.getAttribute("aria-expanded") === "true";
      table.querySelectorAll('.wc-fund-activity-row[data-fund-activity-group="' + groupKey + '"]').forEach((row) => {
        row.hidden = expanded;
      });
      if (expanded) {
        table.querySelectorAll('.wc-fund-activity-toggle[data-fund-activity-group="' + groupKey + '"]').forEach(closeFundActivityDetail);
      }
      groupToggle.setAttribute("aria-expanded", String(!expanded));
      return;
    }

    const activityToggle = event.target.closest(".wc-fund-activity-toggle");
    if (!activityToggle) return;
    const table = activityToggle.closest("table");
    const wasOpen = activityToggle.getAttribute("aria-expanded") === "true";
    if (table) {
      table.querySelectorAll(".wc-fund-activity-toggle").forEach((other) => {
        if (other !== activityToggle) closeFundActivityDetail(other);
      });
    }
    if (wasOpen) {
      closeFundActivityDetail(activityToggle);
    } else {
      const target = document.getElementById(activityToggle.dataset.target);
      if (target) target.hidden = false;
      activityToggle.setAttribute("aria-expanded", "true");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const toggle = event.target.closest(".wc-fund-activity-group-toggle, .wc-fund-activity-toggle");
    if (!toggle) return;
    event.preventDefault();
    toggle.click();
  });

  // Forecast Assumptions tables (see renderForecastAssumptionsDetailTable):
  // each row's <tr> already carries data-sort-value/data-sort-name, so
  // re-sorting on click is just a DOM reorder -- no need to re-run the
  // forecast model or re-fetch anything.
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".wc-forecast-sort-button");
    if (!button) return;
    const toggleGroup = button.closest(".wc-forecast-sort-toggle");
    const tableWrap = button.closest(".wc-data-table-wrap");
    const tbody = tableWrap && tableWrap.querySelector("table tbody");
    if (!toggleGroup || !tbody) return;

    const mode = button.dataset.sortMode;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.sort((a, b) => {
      if (mode === "abc") return a.dataset.sortName.localeCompare(b.dataset.sortName);
      const diff = Number(b.dataset.sortValue) - Number(a.dataset.sortValue);
      return mode === "smallest" ? -diff : diff;
    });
    rows.forEach((row) => tbody.appendChild(row));

    toggleGroup.querySelectorAll(".wc-forecast-sort-button").forEach((other) => {
      other.classList.toggle("is-active", other === button);
      other.setAttribute("aria-pressed", String(other === button));
    });
  });

  function lastUpdatedNoteHtml() {
    const stamp = new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return '<p class="wc-data-updated-note"><em>Last Updated: ' + escapeHtml(stamp) + "</em></p>";
  }

  function renderTable(options) {
    const columns = options.columns || [];
    const bodyRows = options.bodyRows || [];
    if (!bodyRows.length) return "";
    const captionHtml = options.caption ? '<p class="wc-table-label">' + escapeHtml(options.caption) + "</p>" : "";
    const tableCaptionHtml = options.caption ? '<caption class="wc-sr-only">' + escapeHtml(options.caption) + "</caption>" : "";
    const headerHtml = options.toggleHtml
      ? '<div class="wc-table-label-row">' + captionHtml + options.toggleHtml + "</div>"
      : captionHtml;
    return (
      '<div class="wc-data-table-wrap">' +
      headerHtml +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table">' +
      tableCaptionHtml +
      "<thead><tr>" +
      columns.map((c) => {
        const classes = (c.num ? ["wc-num"] : []).concat(c.classes || []);
        return '<th scope="col" class="' + classes.join(" ") + '">' + escapeHtml(c.label) + "</th>";
      }).join("") +
      "</tr></thead>" +
      "<tbody>" + bodyRows.join("") + "</tbody>" +
      "</table>" +
      "</div>" +
      (options.showUpdated ? lastUpdatedNoteHtml() : "") +
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

  // A category row's own FY2026 -> FY2027 dollar change (e.g. Personnel
  // Services, Operating Expenditures, Capital Outlay), shown beside that
  // row's current-year amount on every Expenditure Summary card -- and
  // every secondary/supplemental one, since they all render through this
  // same renderFinancialDashboardCard. A category with no FY2026 figure
  // (new this year) or no change shows nothing rather than a misleading
  // divide-by-zero/false "no change".
  function renderFinanceCardRowChange(amount, priorAmount, label) {
    if (!priorAmount) return "";
    const diff = amount - priorAmount;
    const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    // formatCurrency(0) returns "Not listed" (it's built for "no data" --
    // not a literal $0), so a genuine zero change is formatted here
    // instead, rather than being silently dropped like a missing amount.
    const dollarText = diff === 0 ? "$0" : (diff > 0 ? "+" : "-") + formatCurrency(Math.abs(diff));
    return '<div class="wc-finance-card-change wc-finance-card-change-' + direction + '">' + escapeHtml(dollarText) + ' <span class="wc-finance-card-change-label">' + escapeHtml(label || "YoY Change") + '</span></div>';
  }

  function renderFinancialDashboardCard(options) {
    const rows = options.rows || [];
    const caption = options.caption || "Financial Summary";
    const kind = options.kind || "expense";
    const total = options.total || 0;
    const showPrior = !!options.showPrior;
    const detail = options.detail || { button: "", detail: "" };
    const updated = lastUpdatedNoteHtml();
    const zeroClass = total === 0 ? " is-zero" : "";
    const currentLabel = kind === "revenue" ? "FY 2027 Proposed Revenue" : "FY 2027 Proposed Budget";
    // Secondary sub-program cards (e.g. Code Compliance Beach) pass
    // showChange: false -- their FY2026 figures share the same per-account
    // dedup unreliability as their "View Prior Years" toggle (already
    // disabled for them in renderTypeSummaryGroup), so no YoY change shows
    // there either; that comparison belongs on the primary card only.
    const showChange = kind === "expense" && options.showChange !== false;
    // A category with $0 FY2027 (e.g. Capital Outlay eliminated entirely
    // this year) still has a real, meaningful FY2026 -> FY2027 change worth
    // showing -- so "relevant" means either year is nonzero, not just the
    // current one, and the row's rank uses whichever year is larger so a
    // zeroed-out category isn't pushed out of the top-3 by smaller-but-
    // still-funded categories.
    function rowRelevance(row) {
      return Math.max(Math.abs(row.amount || 0), showChange ? Math.abs(row.priorAmount || 0) : 0);
    }
    const sortedRows = rows
      .slice()
      .sort((a, b) => rowRelevance(b) - rowRelevance(a));
    const nonZeroRows = sortedRows.filter((row) => rowRelevance(row) !== 0);
    const visibleRows = nonZeroRows.slice(0, 3);
    const rowCountClass = " wc-finance-card-rows-" + Math.max(visibleRows.length, 0);
    const itemHtml = visibleRows.map((row) => {
      const amount = row.amount || 0;
      const priorAmount = row.priorAmount || 0;
      const percent = total ? Math.abs(amount) / Math.abs(total) * 100 : 0;
      const width = total ? Math.max(percent, amount ? 2 : 0) : 0;
      const isZero = amount === 0 && !(showChange && priorAmount);
      // Each category's own FY2026 -> FY2027 dollar change, shown beside
      // that category's current amount -- distinct from the
      // %-of-total-budget badge in the row head above, which is a
      // same-year share, not a year-over-year comparison. Labeled
      // "Recurring"/"Non-Recurring" instead of a plain "YoY Change" on
      // expense cards -- Capital Outlay's own change is the department's
      // non-recurring capital change; every other category's is recurring
      // operating change (see isCapitalOutlayRowForYoy).
      const changeAmount = row.changeAmount !== undefined ? row.changeAmount : amount;
      const changePriorAmount = row.changePriorAmount !== undefined ? row.changePriorAmount : priorAmount;
      // showChange (and therefore this) only renders for expense cards --
      // see its own definition above. row.label here is the Object_Type
      // category (e.g. "Capital Outlay", "Personnel Services").
      const changeLabel = normalizeObjectTypeForYoy(row.label) === "capital outlay" ? "Non-Recurring YoY Change" : "Recurring YoY Change";
      const changeHtml = showChange ? renderFinanceCardRowChange(changeAmount, changePriorAmount, changeLabel) : "";
      const amountText = amount === 0 && !isZero ? "$0" : formatCurrency(amount);
      // Optional small indented sub-lines under a category's own amount
      // (e.g. Code Compliance's Personnel Services broken into its
      // Street/Beach sides -- see renderCodeComplianceExpenseCard) instead
      // of a whole separate card per sub-program.
      const sublinesHtml = Array.isArray(row.sublines) && row.sublines.length
        ? '<div class="wc-finance-card-sublines">' +
          row.sublines.map((s) =>
            '<div class="wc-finance-card-subline"><span>' + escapeHtml(s.label || "Other") + '</span><strong>' + escapeHtml(formatCurrency(s.amount || 0)) + "</strong></div>"
          ).join("") +
          "</div>"
        : "";
      return (
        '<div class="wc-finance-card-row' + (isZero ? " is-zero" : "") + '">' +
          '<div class="wc-finance-card-row-head">' +
            '<strong>' + escapeHtml(row.label || "Other") + '</strong>' +
            '<span>' + escapeHtml(percent.toFixed(percent >= 10 ? 0 : 1)) + '%</span>' +
          '</div>' +
          '<div class="wc-finance-card-track" aria-hidden="true">' +
            '<span style="width:' + width.toFixed(2) + '%"></span>' +
          '</div>' +
          '<div class="wc-finance-card-amount-row">' +
            '<div class="wc-finance-card-amount">' + escapeHtml(amountText) + '</div>' +
            changeHtml +
          '</div>' +
          sublinesHtml +
        '</div>'
      );
    }).join("");

    return (
      '<section class="wc-finance-card wc-budget-lines-card' + rowCountClass + zeroClass + (showPrior ? " show-prior-years" : "") + '">' +
        '<div class="wc-finance-card-head">' +
          '<div>' +
            '<p class="wc-finance-card-kicker">' + escapeHtml(caption) + '</p>' +
            '<strong class="wc-finance-card-total">' + escapeHtml(formatCompactCurrency(total)) + '</strong>' +
            '<span class="wc-finance-card-subtitle">' + escapeHtml(currentLabel) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="wc-finance-card-breakdown">' + itemHtml + '</div>' +
        '<div class="wc-finance-card-footer">' +
          updated +
          detail.button +
        '</div>' +
        detail.detail +
        renderNotesHtml("Expenditure Notes:", options.notes) +
      '</section>'
    );
  }

  // Department-page expense/revenue tables: rolled up to category level
  // (Personnel Services, Operating Expenditures, Capital Outlay, etc.)
  // rather than individual object/revenue codes.
  function renderTypeSummaryGroup(rows, kind, caption, notes, descriptionField, showChange, combinedChangeByType) {
    const isExpense = kind === "expense";
    const typeField = isExpense ? "Object_Type" : "Revenue_Type";
    const typeLabel = isExpense ? "Object Type" : "Revenue Type";

    const yearFields = BUDGET_LINE_PRIOR_YEAR_COLUMNS.map((c) => c.field).concat(["FY2027_Proposed"]);
    const totalsByType = new Map();
    const grandTotals = {};
    yearFields.forEach((f) => { grandTotals[f] = 0; });
    rows.forEach((r) => {
      const type = r[typeField] || "Other";
      const totals = totalsByType.get(type) || {};
      yearFields.forEach((f) => {
        const amt = r[f] || 0;
        totals[f] = (totals[f] || 0) + amt;
        grandTotals[f] += amt;
      });
      totalsByType.set(type, totals);
    });

    // Secondary sub-program cards (showChange === false, e.g. Code
    // Compliance Beach) don't get a "View Prior Years" toggle either --
    // their FY2026 figures share the same per-account dedup unreliability
    // that already keeps them from showing a YoY change (see
    // renderTypeSummaryTable).
    const forceDisablePriorYears = showChange === false;
    const showPrior = forceDisablePriorYears ? false : getShowPriorYears();
    const detail = renderBudgetLinesToggle(rows, descriptionField, kind, false, forceDisablePriorYears);
    if (detail.button && !isExpense) {
      detail.button = detail.button
        .replace('data-closed-label="View Budget Lines"', 'data-closed-label="View Revenue Lines"')
        .replace('data-open-label="Hide Budget Lines"', 'data-open-label="Hide Revenue Lines"')
        .replace("View Budget Lines", "View Revenue Lines");
    }
    const cardRows = Array.from(totalsByType.entries()).map(([type, totals]) => {
      // The displayed amount/%-of-total stay this card's own slice, but the
      // YoY change badge uses the combined-across-sub-programs total when
      // one was supplied (see renderTypeSummaryTable) -- comparing this
      // card's own FY2027 against its own FY2026 isn't reliable when a
      // sibling sub-program shares its Dept_Code, since FY2026's
      // per-account dedup can attribute a shared account's full prior-year
      // total to either sub-program unpredictably.
      const combined = combinedChangeByType && combinedChangeByType.get(type);
      return {
        label: type,
        amount: totals.FY2027_Proposed || 0,
        priorAmount: totals.FY2026_Original_Budget || 0,
        changeAmount: combined ? combined.amount : (totals.FY2027_Proposed || 0),
        changePriorAmount: combined ? combined.priorAmount : (totals.FY2026_Original_Budget || 0)
      };
    });

    return renderFinancialDashboardCard({
      caption,
      kind,
      rows: cardRows,
      total: grandTotals.FY2027_Proposed || 0,
      showPrior,
      detail,
      notes: isExpense ? notes : null,
      showChange: showChange !== false
    });
  }

  // A single row right under a table: the "Last Updated" stamp on the
  // left and (for expense tables) the "View Budget Lines" toggle on the
  // right, instead of two separate stacked lines.
  function renderTableFooterRow(budgetLineRows, descriptionField, kind, combineByName) {
    const stamp = new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const updated = '<em>Last Updated: ' + escapeHtml(stamp) + "</em>";
    const toggle = budgetLineRows ? renderBudgetLinesToggle(budgetLineRows, descriptionField, kind, combineByName) : { button: "", detail: "" };
    return (
      '<div class="wc-table-footer-row">' +
      '<p class="wc-data-updated-note">' + updated + "</p>" +
      toggle.button +
      "</div>" +
      toggle.detail
    );
  }

  // The "View Budget Lines" modal lists one row per account, summing
  // FY2020-FY2026 straight from whatever rows are passed in -- correct
  // when every row is its own distinct account, but Code Compliance's
  // Street/Beach split shares one Dept_Code, and applyActualsToRows/
  // applyOriginalBudgetToRows give EACH Dept_Name its own full, undivided
  // historical total for a shared account (same account, same object
  // code) rather than splitting it between them. Summing both Dept_Names'
  // rows straight (whether in the modal's own grand total, or its
  // collapsed "Prior Years off" one-row-per-account summary line) would
  // count that one true total twice.
  //
  // Each Dept_Name's own row is kept separate here, not merged into one --
  // Street's and Beach's FY2027 Proposed amounts are genuinely distinct
  // itemized lines, and merging them away would hide Street's own line
  // entirely behind a single combined row. Only the *historical* fields
  // on every row but the first sharing an account are zeroed (the same
  // "first row keeps it, the rest get zeroed" rule
  // buildDedupedHistoricalExpenseRows already uses for this exact
  // scenario), so summing across both Dept_Names' rows lands on the one
  // true historical total instead of doubling it.
  function dedupBudgetLinesAcrossDeptNames(rows) {
    const seenAccountKeys = new Set();
    return rows.map((row) => {
      const key = expenseAccountingKey(row);
      if (!seenAccountKeys.has(key)) {
        seenAccountKeys.add(key);
        return row;
      }
      const deduped = Object.assign({}, row);
      HISTORICAL_EXPENSE_DEDUP_FIELDS.forEach((field) => { deduped[field] = 0; });
      return deduped;
    });
  }

  // Code Compliance's Street/Beach split (sharing one Dept_Code) renders
  // as one combined Expenditure Summary card instead of two separate
  // cards -- Personnel Services shows each side's own current-year
  // subtotal as a small indented subline instead of a whole separate
  // card. FY2026 still has to come from the shared deduped layer (keyed
  // by Dept_Code, not Dept_Name): the per-(Dept_Code,Dept_Name,
  // Object_Code) FY2026 dedup (see applyOriginalBudgetToRows) can
  // attribute a shared account's full prior-year total to either side
  // unpredictably, so summing the raw rows directly would risk
  // double-counting it.
  function renderCodeComplianceExpenseCard(rows, caption) {
    const yearFields = BUDGET_LINE_PRIOR_YEAR_COLUMNS.map((c) => c.field).concat(["FY2027_Proposed"]);
    const totalsByType = new Map();
    const grandTotals = {};
    yearFields.forEach((f) => { grandTotals[f] = 0; });
    const personnelByDept = new Map();
    rows.forEach((r) => {
      const type = r.Object_Type || "Other";
      const totals = totalsByType.get(type) || {};
      yearFields.forEach((f) => {
        const amt = r[f] || 0;
        totals[f] = (totals[f] || 0) + amt;
        grandTotals[f] += amt;
      });
      totalsByType.set(type, totals);
      if (type === "Personnel Services") {
        const deptKey = r.Dept_Name || "Other";
        personnelByDept.set(deptKey, (personnelByDept.get(deptKey) || 0) + (r.FY2027_Proposed || 0));
      }
    });

    const deptCodes = new Set(rows.map((r) => String(r.Dept_Code || "").trim()).filter(Boolean));
    const priorByType = new Map();
    (cache.dedupedExpenseRows || [])
      .filter((r) => deptCodes.has(String(r.Dept_Code || "").trim()))
      .forEach((r) => {
        const type = r.Object_Type || "Other";
        priorByType.set(type, (priorByType.get(type) || 0) + (r.FY2026_Original_Budget || 0));
      });

    function sublineLabel(deptName) {
      const norm = normalizeDeptName(deptName);
      if (norm === "code compliance beach") return "Beach";
      if (norm === "code compliance" || norm === "code compliance street") return "Street";
      return deptName;
    }

    const cardRows = Array.from(totalsByType.entries()).map(([type, totals]) => {
      const amount = totals.FY2027_Proposed || 0;
      const priorAmount = priorByType.get(type) || 0;
      const row = { label: type, amount, priorAmount, changeAmount: amount, changePriorAmount: priorAmount };
      if (type === "Personnel Services" && personnelByDept.size > 1) {
        row.sublines = Array.from(personnelByDept.entries())
          .map(([name, amt]) => ({ label: sublineLabel(name), amount: amt }))
          .sort((a, b) => b.amount - a.amount);
      }
      return row;
    });

    return renderFinancialDashboardCard({
      caption,
      kind: "expense",
      rows: cardRows,
      total: grandTotals.FY2027_Proposed || 0,
      showPrior: getShowPriorYears(),
      detail: renderBudgetLinesToggle(dedupBudgetLinesAcrossDeptNames(rows), undefined, "expense"),
      showChange: true
    });
  }

  // When a department's rows span more than one distinct Dept_Name (e.g.
  // "Planning" includes a separately tracked "Planning Short-Term Rental"
  // program), render one labeled table per sub-program instead of merging
  // them into a single combined summary. The page's own department keeps
  // the original caption (e.g. "Expenditure Summary"); other groups are
  // captioned with their own Dept_Name.
  function renderTypeSummaryTable(rows, kind, caption, deptName) {
    if (!rows.length) return "";
    const groupNames = uniqueSorted(rows.map((r) => r.Dept_Name || ""));
    if (groupNames.length <= 1) {
      return renderTypeSummaryGroup(rows, kind, caption, EXPENSE_GROUP_NOTES[normalizeDeptName(deptName || "")]);
    }
    if (kind === "expense" && normalizeDeptName(deptName || "") === "code compliance") {
      return renderCodeComplianceExpenseCard(rows, caption);
    }
    const norm = normalizeDeptName(deptName || "");

    // The primary card's own YoY change combines every sub-program sharing
    // this Dept_Code (e.g. Code Compliance + Code Compliance Beach)
    // instead of comparing the primary's own slice against its own FY2026
    // -- the per-(Dept_Code,Dept_Name,Object_Code) FY2026 dedup (see
    // applyOriginalBudgetToRows) can attribute a shared account's full
    // prior-year total to either sub-program unpredictably, so the primary
    // alone isn't a trustworthy year-over-year figure on its own. The
    // shared deduped layer (keyed by Dept_Code, not Dept_Name) gives the
    // one true combined FY2026 total per category; FY2027 has no such
    // duplication risk, so it's just summed straight from the raw rows.
    let combinedChangeByType = null;
    if (kind === "expense") {
      const deptCodes = new Set(rows.map((r) => String(r.Dept_Code || "").trim()).filter(Boolean));
      combinedChangeByType = new Map();
      rows.forEach((r) => {
        const type = r.Object_Type || "Other";
        const entry = combinedChangeByType.get(type) || { amount: 0, priorAmount: 0 };
        entry.amount += r.FY2027_Proposed || 0;
        combinedChangeByType.set(type, entry);
      });
      (cache.dedupedExpenseRows || [])
        .filter((r) => deptCodes.has(String(r.Dept_Code || "").trim()))
        .forEach((r) => {
          const type = r.Object_Type || "Other";
          const entry = combinedChangeByType.get(type) || { amount: 0, priorAmount: 0 };
          entry.priorAmount += r.FY2026_Original_Budget || 0;
          combinedChangeByType.set(type, entry);
        });
    }

    return groupNames
      .map((name) => {
        const nameNorm = normalizeDeptName(name);
        const isPrimary = nameNorm === norm;
        const groupCaption = isPrimary ? caption : (DEPT_NAME_DISPLAY_OVERRIDES[nameNorm] || name);
        const notes = isPrimary ? null : EXPENSE_GROUP_NOTES[nameNorm];
        // Secondary sub-program cards (e.g. Code Compliance Beach) get no
        // YoY change or "View Prior Years" toggle at all -- that
        // comparison lives on the primary card, combined, instead.
        return renderTypeSummaryGroup(
          rows.filter((r) => (r.Dept_Name || "") === name),
          kind,
          groupCaption,
          notes,
          undefined,
          isPrimary,
          isPrimary ? combinedChangeByType : null
        );
      })
      .join("");
  }

  // The "Consolidated Financial Schedules" revenue/expenditure-by-fund
  // tables: rows are budget categories, columns are major funds (plus a
  // Non-Major Funds rollup and a grand total), all derived live from the
  // revenues/expenditures + funds sheets rather than hand-entered.
  const CONSOLIDATED_REVENUE_FUND_COLUMNS = [
    { code: "001", label: "General Fund" },
    { code: "101", label: "Transportation Fund" },
    { code: "107", label: "Sheriff Fund" },
    { code: "111", label: "Tourist Development Fund" },
    { code: "112", label: "Solid Waste Fund" },
    { code: "300", label: "Capital Projects Fund" }
  ];

  const CONSOLIDATED_EXPENDITURE_FUND_COLUMNS = [
    { code: "001", label: "General Fund" },
    { code: "101", label: "Transportation Fund" },
    { code: "107", label: "Sheriff Fund" },
    { code: "111", label: "Tourist Development Fund" },
    { code: "112", label: "Solid Waste Fund" },
    { code: "300", label: "Capital Projects Fund" }
  ];

  const CONSOLIDATED_REVENUE_TYPE_ROWS = [
    { key: "General Government Taxes", label: "General Government Taxes" },
    { key: "Permits Fees and Special Assessments", label: "Permits, Fees, and Special Assessments" },
    { key: "Intergovernmental Revenues", label: "Intergovernmental Revenues" },
    { key: "Charges for Services", label: "Charges for Services" },
    { key: "Judgments, Fines and Forfeits", label: "Judgments, Fines and Forfeits" },
    { key: "Miscellaneous Revenue", label: "Miscellaneous Revenue" },
    { key: "Other Sources", label: "Other Sources" }
  ];

  // Expenditures are grouped by function/activity (General Government,
  // Public Safety, etc. — from the activities sheet, keyed by Dept_Code)
  // rather than by Object_Type, per the county's preferred presentation.
  const CONSOLIDATED_EXPENDITURE_ACTIVITY_ROWS = [
    "General Government",
    "Public Safety",
    "Physical Environment",
    "Transportation",
    "Economic Environment",
    "Human Services",
    "Culture and Recreation",
    "Court Related Cost"
  ];

  // Activities that represent financing items (transfers, debt proceeds,
  // fund balance) rather than a functional program area; these are pulled
  // out of the 8 rows above and reported as "Other Financial Uses" instead.
  const OTHER_FINANCING_ACTIVITIES = new Set(["interfund transfers", "other sources"]);

  function activityForDeptCode(deptCode) {
    const code = String(deptCode || "").trim();
    const match = (cache.activities || []).find((a) => a.Dept_Code === code);
    return match ? match.Activity : "";
  }

  // Object_Code 599000 (Other Uses Contingency / reserve for contingency) is
  // budgeted appropriation authority, not a transfer or financing item. Some
  // departments exist solely to hold a contingency line (e.g. "BCC Other
  // Uses Contingency") and are mapped to an Other Sources/Interfund
  // Transfers activity in the activities sheet for unrelated reasons, which
  // would otherwise misroute their dollars into Other Financial Uses instead
  // of the regular Expenditures Total. These two helpers keep that override
  // consistent everywhere expenditure rows are classified by activity.
  function isObjectCode599000(r) {
    return String(r.Object_Code || "").trim() === "599000";
  }

  function expenseActivityForRow(r) {
    return isObjectCode599000(r) ? "General Government" : activityForDeptCode(r.Dept_Code);
  }

  function isOtherFinancingExpenseRow(r) {
    return !isObjectCode599000(r) && OTHER_FINANCING_ACTIVITIES.has(activityForDeptCode(r.Dept_Code).toLowerCase());
  }

  // ---- shared deduped historical expense layer ----
  //
  // Some departments split one Dept_Code across multiple display-only
  // Dept_Names (e.g. Code Compliance / Code Compliance Beach, both under
  // 00102030) -- applyActualsToRows/applyOriginalBudgetToRows deliberately
  // give each Dept_Name its own full, undivided historical total, since
  // actuals aren't tracked at that sub-program grain (see those functions'
  // own comments). That's correct for a single department's own "View
  // Budget Lines" detail, but summing every display row directly -- as the
  // Consolidated Expense Summary and fund-level tables otherwise do --
  // counts that one true account total once per Dept_Name sharing it,
  // inflating FY2020-FY2026 history (and any Activity category those rows
  // roll up into). This layer collapses back down to one row per true
  // accounting record (see expenseAccountingKey for the exact grain) so
  // both tables can report the real historical total instead.
  //
  // FY2027 Proposed is intentionally untouched here: it comes straight from
  // the Google Sheet's own budget rows, which are not subject to this
  // duplication (each is its own itemized budget line, not a repeated
  // historical actual).
  const HISTORICAL_EXPENSE_DEDUP_FIELDS = HISTORICAL_ACTUAL_YEARS
    .map((year) => "FY" + year + "_Actual")
    .concat(["FY2026_Original_Budget"]);
  const HISTORICAL_EXPENSE_DEDUP_FIELD_SET = new Set(HISTORICAL_EXPENSE_DEDUP_FIELDS);

  function isHistoricalExpenseDedupDebugEnabled() {
    return isFundScheduleDebugEnabled("debugHistoricalExpenseDedup");
  }

  function yearForHistoricalExpenseField(field) {
    return field === "FY2026_Original_Budget" ? 2026 : Number(field.slice(2, 6));
  }

  function historicalExpenseFieldValue(row, field) {
    return field === "FY2026_Original_Budget"
      ? (row.FY2026_Original_Budget || row.FY2026_Budget || 0)
      : (row[field] || 0);
  }

  function firstNonZeroHistoricalValue(groupRows, field) {
    for (let i = 0; i < groupRows.length; i++) {
      const value = historicalExpenseFieldValue(groupRows[i], field);
      if (value) return value;
    }
    return 0;
  }

  // The true accounting grain: fund, org (Dept_Code), object (Object_Code),
  // and -- only when the row's own actual/budget lookup is itself scoped to
  // one -- project. Dept_Name is deliberately excluded -- it's a
  // display/sub-program label, not part of how the county books the
  // underlying transaction.
  //
  // Project_Code is NOT part of this grain for most rows, even though it's
  // a real column: projectScopeForRow is undefined for the default case,
  // which means applyActualsToRows/applyOriginalBudgetToRows themselves sum
  // every project under org+object with no project filter at all (see
  // sumRawActualsForAccount's hasProjectScope). So two display rows with
  // different Project_Code values but the same Dept_Code+Object_Code --
  // e.g. Code Compliance (blank project) / Code Compliance Beach ("BEACH"),
  // or Planning (blank project) / Planning Short-Term Rental ("10639") --
  // still resolve to the exact same unscoped total under the hood and must
  // collapse to one key here, or the very duplication this layer exists to
  // fix goes undetected. Project_Code only belongs in the key for rows
  // where projectScopeForRow returns a defined scope (Walton County Health
  // Department, Non-Profit Funding Program, Statutory & Other) -- those
  // lookups really are restricted to one project, so a different
  // Project_Code there is a genuinely different recipient/amount, not a
  // duplicate.
  function expenseAccountingKey(row) {
    const base = [
      fundCodeForRow(row),
      String((row && row.Dept_Code) || "").trim(),
      String((row && row.Object_Code) || "").trim()
    ].join("|");
    const projectScope = projectScopeForRow(row);
    return projectScope !== undefined ? base + "|" + projectScope : base;
  }

  // Builds one merged row per true accounting key from cache.expenditures
  // (after synthesizeMissingExpenseRows has already filled in any
  // Supabase-only accounts), with each HISTORICAL_EXPENSE_DEDUP_FIELDS
  // amount counted once per key instead of once per Dept_Name sharing it.
  // Used by both the Consolidated Expense Summary ("Summary of Expenses")
  // and buildFundFinancialSchedule for FY2020-FY2026 -- see callers.
  function buildDedupedHistoricalExpenseRows(cache) {
    const sourceRows = cache.expenditures || [];
    const debug = isHistoricalExpenseDedupDebugEnabled();

    const groups = new Map();
    sourceRows.forEach((row) => {
      const key = expenseAccountingKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    const debugDuplicateEntries = debug ? [] : null;
    const reductionByCategoryAndField = new Map();

    function addReduction(activity, field, amount) {
      if (!amount) return;
      const bucketKey = activity + "|" + field;
      reductionByCategoryAndField.set(bucketKey, (reductionByCategoryAndField.get(bucketKey) || 0) + amount);
    }

    const dedupedRows = [];
    groups.forEach((groupRows, key) => {
      // Classification metadata (Dept_Name for display, Object_Type) is
      // taken from the first row in the group with a non-empty value, kept
      // consistent across every field for this key. Activity and fund code
      // are derived from Dept_Code/Object_Code, which are already part of
      // the key itself, so they can't conflict across the group.
      const deptNameRow = groupRows.find((r) => String(r.Dept_Name || "").trim()) || groupRows[0];
      const objectTypeRow = groupRows.find((r) => String(r.Object_Type || "").trim()) || groupRows[0];

      if (debug && groupRows.length > 1) {
        const distinctDeptNames = uniqueSorted(groupRows.map((r) => r.Dept_Name));
        const distinctObjectTypes = uniqueSorted(groupRows.map((r) => r.Object_Type));
        if (distinctDeptNames.length > 1 || distinctObjectTypes.length > 1) {
          console.warn("HistoricalExpenseDedup: conflicting classification metadata for key " + key, {
            distinctDeptNames,
            distinctObjectTypes,
            chosenDeptName: deptNameRow.Dept_Name,
            chosenObjectType: objectTypeRow.Object_Type
          });
        }
      }

      const merged = {
        Dept_Code: groupRows[0].Dept_Code,
        Dept_Name: deptNameRow.Dept_Name || "",
        Object_Code: groupRows[0].Object_Code,
        Object_Type: objectTypeRow.Object_Type || "",
        Project_Code: groupRows[0].Project_Code
      };

      HISTORICAL_EXPENSE_DEDUP_FIELDS.forEach((field) => {
        // Every row sharing this key should carry the same full, undivided
        // total (see applyActualsToRows/applyOriginalBudgetToRows), but
        // scanning the whole group for the first non-zero value -- rather
        // than always reading groupRows[0] -- protects against landing on a
        // zero placeholder row (e.g. one of several itemized FY2027 budget
        // lines under the same Dept_Name, zeroed by applyActualsToRows' own
        // narrower per-Dept_Name dedup).
        const value = firstNonZeroHistoricalValue(groupRows, field);
        merged[field] = value;

        if (groupRows.length > 1) {
          const beforeTotal = groupRows.reduce((sum, r) => sum + historicalExpenseFieldValue(r, field), 0);
          const reduction = beforeTotal - value;
          if (reduction) {
            const activity = expenseActivityForRow(merged);
            addReduction(activity, field, reduction);
            if (debugDuplicateEntries) {
              debugDuplicateEntries.push({
                key: key,
                field: field,
                year: yearForHistoricalExpenseField(field),
                activity: activity,
                displayRows: groupRows.map((r) => ({ Dept_Name: r.Dept_Name, amount: historicalExpenseFieldValue(r, field) })),
                amountBeforeDedup: beforeTotal,
                amountAfterDedup: value,
                reduction: reduction
              });
            }
          }
        }
      });

      dedupedRows.push(merged);
    });

    if (debug) {
      console.groupCollapsed(
        "HistoricalExpenseDedup debug -- shared by Summary of Expenses & Fund Financial Schedule " +
        "(compare this log across both pages to confirm parity)"
      );
      console.log("Duplicate accounting keys found:", debugDuplicateEntries.length);
      debugDuplicateEntries.forEach((entry) => console.log(entry));
      const totalsByCategory = new Map();
      const totalsByYear = new Map();
      reductionByCategoryAndField.forEach((amount, bucketKey) => {
        const sep = bucketKey.lastIndexOf("|");
        const activity = bucketKey.slice(0, sep);
        const field = bucketKey.slice(sep + 1);
        totalsByCategory.set(activity, (totalsByCategory.get(activity) || 0) + amount);
        const year = yearForHistoricalExpenseField(field);
        totalsByYear.set(year, (totalsByYear.get(year) || 0) + amount);
      });
      console.log("Total reduction by category:", Array.from(totalsByCategory.entries()));
      console.log("Total reduction by year:", Array.from(totalsByYear.entries()));
      console.groupEnd();
    }

    return dedupedRows;
  }

  // Builds a fund-by-category consolidated table. `categoryFor(row)` returns
  // the row's category key (matched case-insensitively against `typeRows`).
  // `isOtherFinancing(row)` flags rows that should be excluded from the
  // regular category rows and instead reported on their own line below the
  // categories' subtotal (e.g. interfund transfers).
  // The Self-Insurance Fund (503) is an Internal Service fund, not a
  // governmental fund, so it's excluded from this schedule entirely rather
  // than folded into "Non-Major Governmental Funds".
  const CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES = new Set(["503"]);

  function buildConsolidatedFundTable(config) {
    const rows = (config.rows || []).filter(
      (r) => !CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r))
    );
    if (!rows.length || !(cache.funds || []).length) return "";

    const fundColumns = config.fundColumns;
    const majorCodes = new Set(fundColumns.map((c) => c.code));
    const amountFor = (r) => r.FY2027_Proposed || 0;

    // Returns one cell per major fund column, then Non-Major, then Total —
    // each either a formatted dollar amount or "–" if no matching rows
    // exist for that fund at all (vs. "$0" when rows exist but sum to zero).
    function cellsFor(predicate) {
      const majorSums = {};
      const majorHasRows = {};
      fundColumns.forEach((c) => { majorSums[c.code] = 0; majorHasRows[c.code] = false; });
      let nonMajorSum = 0;
      let nonMajorHasRows = false;
      let grandTotal = 0;

      rows.forEach((r) => {
        if (!predicate(r)) return;
        const amt = amountFor(r);
        const code = fundCodeForRow(r);
        grandTotal += amt;
        if (majorCodes.has(code)) {
          majorSums[code] += amt;
          majorHasRows[code] = true;
        } else {
          nonMajorSum += amt;
          nonMajorHasRows = true;
        }
      });

      const cells = fundColumns.map((c) => (majorHasRows[c.code] ? formatCurrency(majorSums[c.code]) : "–"));
      cells.push(nonMajorHasRows ? formatCurrency(nonMajorSum) : "–");
      cells.push(formatCurrency(grandTotal));
      return cells;
    }

    function numericValuesFor(predicate) {
      const majorSums = {};
      fundColumns.forEach((c) => { majorSums[c.code] = 0; });
      let nonMajorSum = 0;
      let grandTotal = 0;
      rows.forEach((r) => {
        if (!predicate(r)) return;
        const amt = amountFor(r);
        const code = fundCodeForRow(r);
        grandTotal += amt;
        if (majorCodes.has(code)) majorSums[code] += amt;
        else nonMajorSum += amt;
      });
      const values = fundColumns.map((c) => majorSums[c.code]);
      values.push(nonMajorSum);
      values.push(grandTotal);
      return values;
    }

    const typeRowRecords = config.typeRows.map((spec) => {
      const keyNorm = spec.key.toLowerCase();
      const predicate = (r) => String(config.categoryFor(r) || "").toLowerCase() === keyNorm && !config.isOtherFinancing(r);
      return { label: spec.label, cells: cellsFor(predicate), values: numericValuesFor(predicate), predicate };
    });

    const columnCount = fundColumns.length + 2;
    const categoryTotalValues = Array.from({ length: columnCount }, (_, i) =>
      typeRowRecords.reduce((sum, tr) => sum + tr.values[i], 0)
    );

    const otherFinancingCells = cellsFor(config.isOtherFinancing);
    const otherFinancingValues = numericValuesFor(config.isOtherFinancing);

    // A row whose category doesn't exactly match one of the lines above (a
    // Dept_Code missing from the activities sheet, a Revenue_Type typo, etc.)
    // would otherwise vanish from every row *and* the grand total with no
    // indication why. Surface it on its own line instead, so a missing
    // source-data mapping shows up as a visible dollar amount to chase down
    // rather than a silent undercount.
    const isUnclassified = (r) => !config.isOtherFinancing(r) && !typeRowRecords.some((tr) => tr.predicate(r));
    const unclassifiedCells = cellsFor(isUnclassified);
    const unclassifiedValues = numericValuesFor(isUnclassified);
    const hasUnclassified = unclassifiedValues.some((v) => v !== 0);

    const grandTotalValues = categoryTotalValues.map((v, i) => v + otherFinancingValues[i] + unclassifiedValues[i]);

    const headerCells = ["ROW LABELS"]
      .concat(fundColumns.map((c) => c.label.toUpperCase()))
      .concat(["NON-MAJOR GOVERNMENTAL FUNDS", "TOTAL ALL FUNDS"]);

    const bodyRows = [];
    bodyRows.push('<tr class="wc-table-group-row"><td>' + escapeHtml(config.groupRowLabel) + "</td>" + headerCells.slice(1).map(() => "<td></td>").join("") + "</tr>");
    typeRowRecords.forEach((tr) => {
      bodyRows.push("<tr><td>" + escapeHtml(tr.label) + "</td>" + tr.cells.map((c) => '<td class="wc-num">' + escapeHtml(c) + "</td>").join("") + "</tr>");
    });
    bodyRows.push(
      '<tr class="wc-table-total-row"><td>' + escapeHtml(config.totalRowLabel) + "</td>" +
      categoryTotalValues.map((v) => '<td class="wc-num">' + formatCurrency(v) + "</td>").join("") +
      "</tr>"
    );
    bodyRows.push(
      "<tr><td>" + escapeHtml(config.otherLineLabel) + "</td>" +
      otherFinancingCells.map((c) => '<td class="wc-num">' + escapeHtml(c) + "</td>").join("") +
      "</tr>"
    );
    if (hasUnclassified) {
      bodyRows.push(
        '<tr class="wc-table-unclassified-row"><td>Unclassified (check source data mapping)</td>' +
        unclassifiedCells.map((c) => '<td class="wc-num">' + escapeHtml(c) + "</td>").join("") +
        "</tr>"
      );
    }
    bodyRows.push(
      "<tr><td>" + escapeHtml(config.grandTotalLabel) + "</td>" +
      grandTotalValues.map((v) => '<td class="wc-num">' + formatCurrency(v) + "</td>").join("") +
      "</tr>"
    );

    return (
      '<div class="wc-table-wrap">' +
      '<p class="wc-table-label">' + escapeHtml(config.caption) + "</p>" +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table">' +
      "<thead><tr>" + headerCells.map((h) => "<th>" + escapeHtml(h) + "</th>").join("") + "</tr></thead>" +
      "<tbody>" + bodyRows.join("") + "</tbody>" +
      "</table>" +
      "</div>" +
      lastUpdatedNoteHtml() +
      "</div>"
    );
  }

  function renderConsolidatedRevenueBudgetTable() {
    return buildConsolidatedFundTable({
      rows: cache.revenues,
      fundColumns: CONSOLIDATED_REVENUE_FUND_COLUMNS,
      typeRows: CONSOLIDATED_REVENUE_TYPE_ROWS,
      categoryFor: (r) => r.Revenue_Type,
      // Revenue_Code 381000 (Interfund Group Transfer In) is an "Other
      // Financing Source," reported on its own line below REVENUES TOTAL
      // rather than inside the regular Other Sources revenue line.
      isOtherFinancing: (r) => String(r.Revenue_Code || "").trim() === "381000",
      caption: "Revenue Budget",
      groupRowLabel: "Revenues",
      totalRowLabel: "REVENUES TOTAL",
      otherLineLabel: "Other Financial Sources",
      grandTotalLabel: "Total Revenue and Other Financial Sources"
    });
  }

  function renderConsolidatedExpenditureBudgetTable() {
    return buildConsolidatedFundTable({
      rows: cache.expenditures,
      fundColumns: CONSOLIDATED_EXPENDITURE_FUND_COLUMNS,
      typeRows: CONSOLIDATED_EXPENDITURE_ACTIVITY_ROWS.map((a) => ({ key: a, label: a })),
      categoryFor: expenseActivityForRow,
      // Rows classified under a financing activity (transfers, debt
      // proceeds, fund balance) rather than a functional program area are
      // reported on their own line below EXPENDITURES TOTAL instead.
      isOtherFinancing: isOtherFinancingExpenseRow,
      caption: "Expenditure Budget",
      groupRowLabel: "Expenditures",
      totalRowLabel: "EXPENDITURES TOTAL",
      otherLineLabel: "Other Financial Uses",
      grandTotalLabel: "Total Expenditure and Other Financial Uses"
    });
  }

  // "Fund Financial Schedules" page: a Beginning Fund Balance -> Revenues
  // (by the same categories as the Consolidated Revenue Budget) ->
  // Expenditures (by the same activities as the Consolidated Expenditure
  // Budget) -> Change in Fund Balance -> Estimated Ending Fund Balance
  // roll-forward, either for one fund (a single "FY 2027 Proposed" column)
  // or several funds combined into side-by-side columns (the consolidated
  // schedule at the top of the page).
  const FUND_SCHEDULE_MAJOR_FUNDS = [
    { code: "001", label: "General Fund" },
    { code: "101", label: "Transportation Fund" },
    { code: "107", label: "Fine & Forfeiture Fund" },
    { code: "111", label: "Tourist Development Fund" },
    { code: "112", label: "Solid Waste Fund" },
    { code: "300", label: "Capital Projects Fund" }
  ];

  const FUND_SCHEDULE_NON_MAJOR_FUNDS = [
    { code: "102", label: "MSBU Fund" },
    { code: "103", label: "Building Fund" },
    { code: "109", label: "E911 Fund" },
    { code: "110", label: "Housing & Urban Development Fund" },
    { code: "105", label: "Mosquito Control Fund" },
    { code: "106", label: "Mosquito Control State Aid Fund" },
    { code: "114", label: "Recreation Plat Fee Fund" },
    { code: "113", label: "Preservation Fund" },
    { code: "115", label: "Sidewalk Fund" }
  ];

  // FY2027's Beginning Fund Balance is simply FY2026's recorded balance,
  // so the sheet only needs FY2026 (and prior) filled in. For a prior-year
  // column (e.g. FY2024 Actual), the beginning balance is the year before
  // that column's own fiscal year.
  function fundBalanceForYear(fundCodes, year) {
    const codes = Array.isArray(fundCodes) ? fundCodes : [fundCodes];
    return (cache.fundBalances || [])
      .filter((r) => codes.includes(r.Fund_Code) && r.Year === String(year))
      .reduce((sum, r) => sum + (r.Fund_Balance || 0), 0);
  }

  const FINANCIAL_FORECAST_FUNDS = [
    { code: "001", label: "General Fund" },
    { code: "101", label: "Transportation Fund" },
    { code: "107", label: "Fine & Forfeiture / Sheriff" },
    { code: "111", label: "Tourist Development Fund" },
    { code: "112", label: "Solid Waste Fund" },
    { code: "300", label: "Capital Projects Fund" }
  ];

  const FINANCIAL_FORECAST_YEARS = [2027, 2028, 2029, 2030, 2031];
  const FINANCIAL_FORECAST_ACTUAL_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

  function forecastMoney(value) {
    const rounded = Math.round(Number(value) || 0);
    const sign = rounded < 0 ? "-" : "";
    return sign + "$" + Math.abs(rounded).toLocaleString("en-US");
  }

  function forecastPercent(value) {
    if (value === null || value === undefined || value === "") return "N/A";
    const n = Number(value);
    if (!Number.isFinite(n)) return "N/A";
    return (n * 100).toFixed(n === 0 ? 0 : 1) + "%";
  }

  function forecastAssumptionValue(row, year) {
    if (!row) return null;
    const value = row["fy" + year + "_assumption"];
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeForecastCategory(value, lineType) {
    const text = String(value || "").trim();
    if (lineType === "expense") {
      if (/operating/i.test(text)) return "Operating Expenses";
      if (/grant/i.test(text)) return "Grants and Aids";
      if (/debt/i.test(text)) return "Debt Service";
      if (/other|transfer|reserve/i.test(text)) return "Other Uses / Transfers";
      return text || "Other Uses / Transfers";
    }
    if (/permit/i.test(text)) return "Permits Fees and Special Assessments";
    if (/judgment|fine|forfeit/i.test(text)) return "Judgments, Fines and Forfeits";
    if (/other/i.test(text)) return "Other Sources";
    return text || "Miscellaneous Revenue";
  }

  // FY2020-FY2023 Ad Valorem Taxes (Revenue_Code 311000) actuals were
  // booked per fund under that fund's own org code -- 001311 (General
  // Fund), 101311 (Transportation), 107311 (Sheriff) -- each collecting
  // its own millage. Starting FY2024 the county books all of it under
  // 001311 alone; 101311 and 107311 go to zero from FY2024 on. Read as-is,
  // the General Fund's Ad Valorem trend looks like it quadrupled in
  // FY2024, when the same countywide collection is now just booked in one
  // place. Scoped to the forecast model only (not a sitewide actuals
  // correction, which would also change how Summary of Revenues/Fund
  // Financial Schedules display Transportation's and Sheriff's own
  // historical actuals): the General Fund's historical trend folds in the
  // other two funds' pre-2024 share, and those two funds' own trend has
  // its now-merged-away share zeroed so the same dollars aren't double
  // counted across funds.
  const FORECAST_AD_VALOREM_REVENUE_CODE = "311000";
  const FORECAST_AD_VALOREM_PRIMARY_ORG = "001311";
  const FORECAST_AD_VALOREM_MERGED_AWAY_ORGS = ["101311", "107311"];
  const FORECAST_AD_VALOREM_MERGE_ORGS = [FORECAST_AD_VALOREM_PRIMARY_ORG].concat(FORECAST_AD_VALOREM_MERGED_AWAY_ORGS);

  function forecastAdValoremHistoricalOverride(row, yearField) {
    if (String(row.Revenue_Code || "").trim() !== FORECAST_AD_VALOREM_REVENUE_CODE) return undefined;
    const org = String(row.Dept_Code || "").trim();
    const isPrimary = org === FORECAST_AD_VALOREM_PRIMARY_ORG;
    const isMergedAway = FORECAST_AD_VALOREM_MERGED_AWAY_ORGS.indexOf(org) !== -1;
    if (!isPrimary && !isMergedAway) return undefined;
    if (isMergedAway) return 0;

    const actualYearMatch = /^FY(\d{4})_Actual$/.exec(yearField);
    if (actualYearMatch) {
      const year = Number(actualYearMatch[1]);
      const total = FORECAST_AD_VALOREM_MERGE_ORGS.reduce(
        (sum, mergeOrg) => sum + sumRawActualsForAccount(cache.revenueActualRows, mergeOrg, FORECAST_AD_VALOREM_REVENUE_CODE, year).total,
        0
      );
      return revenueDisplayAmount(total);
    }
    if (yearField === "FY2026_Original_Budget") {
      const total = FORECAST_AD_VALOREM_MERGE_ORGS.reduce(
        (sum, mergeOrg) => sum + sumRawActualsForAccount(cache.originalBudgetRows, mergeOrg, FORECAST_AD_VALOREM_REVENUE_CODE, 2026).total,
        0
      );
      return revenueDisplayAmount(total);
    }
    return undefined;
  }

  // FY2020-FY2025 actuals and the FY2026 Original Budget are recorded once
  // per account, but a sheet account shared by many departments (e.g. the
  // General Fund's Ad Valorem Taxes line, Dept_Code 001311) repeats that
  // same full account total on every department's own row referencing it
  // (see applyActualsToRows/applyOriginalBudgetToRows, and
  // buildDedupedHistoricalExpenseRows/revenueBudgetUniqueKey, which exist
  // specifically to undo this for other tables). Summed here without the
  // same guard, those years would multiply a shared account's total once
  // per department referencing it -- which is what was inflating General
  // Government Taxes (dominated by the Ad Valorem line) on this page.
  // FY2027 Proposed is left alone: it comes straight from the sheet's own
  // itemized budget lines, which can legitimately share org/code values.
  function forecastCategoryRows(lineType, fundCode, yearField) {
    const needsDedup = HISTORICAL_EXPENSE_DEDUP_FIELD_SET.has(yearField);
    const categoryField = lineType === "expense" ? "Object_Type" : "Revenue_Type";
    const totals = new Map();
    if (lineType === "expense") {
      const rows = needsDedup ? (cache.dedupedExpenseRows || []) : (cache.expenditures || []);
      rows.forEach((row) => {
        if (fundCodeForRow(row) !== fundCode) return;
        const category = normalizeForecastCategory(row[categoryField], lineType);
        totals.set(category, (totals.get(category) || 0) + (Number(row[yearField]) || 0));
      });
      return totals;
    }
    const seenKeys = needsDedup ? new Set() : null;
    (cache.revenues || []).forEach((row) => {
      if (fundCodeForRow(row) !== fundCode) return;
      if (seenKeys) {
        const key = revenueBudgetUniqueKey(row);
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
      }
      const category = normalizeForecastCategory(row[categoryField], lineType);
      // Actuals/FY2026 budget come from Supabase, which stores revenue as a
      // credit (negative) amount -- every other reader of these two fields
      // (budgetLineColumnAmount, revenueBudgetMergeContribution) flips the
      // sign with revenueDisplayAmount before summing/displaying.
      const rawValue = Number(row[yearField]) || 0;
      let value = needsDedup ? revenueDisplayAmount(rawValue) : rawValue;
      if (needsDedup) {
        const override = forecastAdValoremHistoricalOverride(row, yearField);
        if (override !== undefined) value = override;
      }
      totals.set(category, (totals.get(category) || 0) + value);
    });
    return totals;
  }

  // Same source rows and dedup/sign rules as forecastCategoryRows, but
  // bucketed by the line's own name (Revenue_Name for revenue, Dept_Name
  // for expense) instead of its broad category -- used for the "Category
  // Forecast Detail" breakdown table, which lists individual revenue
  // sources and departments rather than the handful of growth-assumption
  // categories. Each bucket still remembers its parent category so the
  // matching category's growth assumption can be applied to it.
  // Sub-program Dept_Names that split out of their parent department
  // elsewhere on the site (e.g. Code Compliance / Code Compliance Beach,
  // sharing one Dept_Code -- see synthesizeMissingExpenseRows) are folded
  // back into the parent here: the forecast's department breakdown is
  // meant to show one driver per department, not its internal street/beach
  // sub-program split.
  const FORECAST_DETAIL_NAME_MERGE = new Map([
    ["Code Compliance Beach", "Code Compliance"]
  ]);

  function forecastDetailRows(lineType, fundCode, yearField) {
    const needsDedup = HISTORICAL_EXPENSE_DEDUP_FIELD_SET.has(yearField);
    const categoryField = lineType === "expense" ? "Object_Type" : "Revenue_Type";
    const nameField = lineType === "expense" ? "Dept_Name" : "Revenue_Name";
    const totals = new Map();

    function addRow(row, value) {
      const category = normalizeForecastCategory(row[categoryField], lineType);
      const rawName = String(row[nameField] || "").trim() || "Unclassified";
      const name = FORECAST_DETAIL_NAME_MERGE.get(rawName) || rawName;
      const existing = totals.get(name);
      if (existing) {
        existing.value += value;
      } else {
        totals.set(name, { category, value });
      }
    }

    if (lineType === "expense") {
      const rows = needsDedup ? (cache.dedupedExpenseRows || []) : (cache.expenditures || []);
      rows.forEach((row) => {
        if (fundCodeForRow(row) !== fundCode) return;
        addRow(row, Number(row[yearField]) || 0);
      });
      return totals;
    }

    const seenKeys = needsDedup ? new Set() : null;
    (cache.revenues || []).forEach((row) => {
      if (fundCodeForRow(row) !== fundCode) return;
      if (seenKeys) {
        const key = revenueBudgetUniqueKey(row);
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
      }
      const rawValue = Number(row[yearField]) || 0;
      let value = needsDedup ? revenueDisplayAmount(rawValue) : rawValue;
      if (needsDedup) {
        const override = forecastAdValoremHistoricalOverride(row, yearField);
        if (override !== undefined) value = override;
      }
      addRow(row, value);
    });
    return totals;
  }

  function summarizeForecastHistory(lineType, fundCode) {
    return FINANCIAL_FORECAST_ACTUAL_YEARS.map((year) => {
      const field = "FY" + year + "_Actual";
      const categories = forecastCategoryRows(lineType, fundCode, field);
      let total = 0;
      categories.forEach((value) => { total += value; });
      return { year, total, categories };
    });
  }

  function summarizeForecastOriginalBudget(lineType, fundCode) {
    const categories = forecastCategoryRows(lineType, fundCode, "FY2026_Original_Budget");
    let total = 0;
    categories.forEach((value) => { total += value; });
    return { year: 2026, total, categories };
  }

  function forecastAvailableTrendValues(valuesByYear) {
    return FINANCIAL_FORECAST_ACTUAL_YEARS
      .map((year) => ({ year, value: Number(valuesByYear[year]) || 0 }))
      .filter((item) => item.value !== 0);
  }

  function historicalAverageGrowth(valuesByYear) {
    const available = forecastAvailableTrendValues(valuesByYear);
    const growthRates = [];
    for (let i = 1; i < available.length; i += 1) {
      const previous = available[i - 1].value;
      const current = available[i].value;
      if (previous !== 0) growthRates.push((current - previous) / Math.abs(previous));
    }
    if (!growthRates.length) return null;
    return growthRates.reduce((sum, value) => sum + value, 0) / growthRates.length;
  }

  // A leading year that's zero/near-zero (an account that didn't exist
  // yet, or was barely funded) makes a terrible CAGR base -- dividing a
  // healthy current value by a near-zero one inflates the rate into
  // meaninglessness. A base year only counts as "stable" once it reaches
  // at least half of the latest actual year's value or half of the
  // median of all nonzero actuals, whichever bar is lower to clear --
  // either is evidence the account was already at a normal run rate, not
  // still ramping up from nothing.
  function historicalCagr(valuesByYear) {
    const nonZero = forecastAvailableTrendValues(valuesByYear).filter((item) => item.value > 0);
    if (nonZero.length < 2) return null;

    const latestValue = nonZero[nonZero.length - 1].value;
    const sortedValues = nonZero.map((item) => item.value).sort((a, b) => a - b);
    const mid = Math.floor(sortedValues.length / 2);
    const median = sortedValues.length % 2 !== 0
      ? sortedValues[mid]
      : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    const stableThreshold = 0.5 * Math.min(latestValue, median);

    const baseIndex = nonZero.findIndex((item) => item.value >= stableThreshold);
    const stableYears = baseIndex === -1 ? [] : nonZero.slice(baseIndex);
    if (stableYears.length < 3) return null;

    const first = stableYears[0];
    const last = stableYears[stableYears.length - 1];
    const periods = last.year - first.year;
    if (periods <= 0 || first.value <= 0 || last.value <= 0) return null;
    return Math.pow(last.value / first.value, 1 / periods) - 1;
  }

  function suggestedForecastGrowth(avgGrowth, cagr) {
    const candidates = [avgGrowth, cagr].filter((value) => Number.isFinite(value));
    if (!candidates.length) return null;
    const blended = candidates.reduce((sum, value) => sum + value, 0) / candidates.length;
    return Math.max(-0.03, Math.min(0.05, blended));
  }

  function buildForecastAssumptionLookup() {
    const rows = Array.isArray(window.WCFinancialForecastAssumptions) ? window.WCFinancialForecastAssumptions : [];
    const lookup = new Map();
    rows.forEach((row) => {
      const fundCode = String(row.fund_code || "").trim();
      const lineType = String(row.line_type || "").trim().toLowerCase();
      const category = normalizeForecastCategory(row.category, lineType);
      if (!fundCode || !lineType || !category) return;
      lookup.set([fundCode, lineType, category].join("|"), row);
    });
    return lookup;
  }

  function assumptionForForecast(lookup, fund, lineType, category, missingRows) {
    const normalizedCategory = normalizeForecastCategory(category, lineType);
    const key = [fund.code, lineType, normalizedCategory].join("|");
    const row = lookup.get(key);
    if (row) return row;
    if (!missingRows.some((missing) => [missing.fund_code, missing.line_type, missing.category].join("|") === key)) {
      missingRows.push({ fund_code: fund.code, fund_name: fund.label, line_type: lineType, category: normalizedCategory });
    }
    return {
      fund_code: fund.code,
      fund_name: fund.label,
      line_type: lineType,
      category: normalizedCategory,
      fy2028_assumption: null,
      fy2029_assumption: null,
      fy2030_assumption: null,
      fy2031_assumption: null,
      method: "missing assumption fallback",
      manual_override: false,
      notes: "No assumption row found; forecast uses suggested trend when available, otherwise held flat."
    };
  }

  function categoryValuesForTrend(lineType, fundCode, category) {
    const values = {};
    FINANCIAL_FORECAST_ACTUAL_YEARS.forEach((year) => {
      values[year] = forecastCategoryRows(lineType, fundCode, "FY" + year + "_Actual").get(category) || 0;
    });
    values[2026] = forecastCategoryRows(lineType, fundCode, "FY2026_Original_Budget").get(category) || 0;
    values[2027] = forecastCategoryRows(lineType, fundCode, "FY2027_Proposed").get(category) || 0;
    return values;
  }

  function forecastAssumptionDetails(fund, lineType, category, assumptionLookup, missingRows) {
    const values = categoryValuesForTrend(lineType, fund.code, category);
    const avgGrowth = historicalAverageGrowth(values);
    const cagr = historicalCagr(values);
    const suggested = suggestedForecastGrowth(avgGrowth, cagr);
    const assumption = assumptionForForecast(assumptionLookup, fund, lineType, category, missingRows);
    return { values, avgGrowth, cagr, suggested, assumption };
  }

  function forecastAnnualCategories(fund, lineType, baselineCategories, assumptionLookup, missingRows, assumptionDetails) {
    const categories = new Map();
    baselineCategories.forEach((value, category) => {
      categories.set(category, { 2027: value });
    });
    FINANCIAL_FORECAST_YEARS.slice(1).forEach((year) => {
      Array.from(categories.keys()).forEach((category) => {
        const detailsKey = [fund.code, lineType, category].join("|");
        const details = assumptionDetails.get(detailsKey) || forecastAssumptionDetails(fund, lineType, category, assumptionLookup, missingRows);
        assumptionDetails.set(detailsKey, details);
        const previous = categories.get(category)[year - 1] || 0;
        const manual = forecastAssumptionValue(details.assumption, year);
        const growth = manual !== null ? manual : (Number.isFinite(details.suggested) ? details.suggested : 0);
        categories.get(category)[year] = previous * (1 + growth);
      });
    });
    return categories;
  }

  // Forecasts each individual revenue source/department (see
  // forecastDetailRows) forward the same way forecastAnnualCategories
  // forecasts its broader category -- by applying that detail row's own
  // parent category's growth assumption. assumptionDetails is expected to
  // already hold every category for this fund/lineType (forecastAnnualCategories
  // populates it first, from the same underlying baseline), so growth here
  // is read, not recomputed.
  function forecastAnnualDetails(fund, lineType, baselineDetails, assumptionDetails) {
    const details = new Map();
    baselineDetails.forEach((entry, name) => {
      details.set(name, { category: entry.category, values: { 2027: entry.value } });
    });
    FINANCIAL_FORECAST_YEARS.slice(1).forEach((year) => {
      details.forEach((entry) => {
        const detailsKey = [fund.code, lineType, entry.category].join("|");
        const categoryDetails = assumptionDetails.get(detailsKey);
        const manual = categoryDetails ? forecastAssumptionValue(categoryDetails.assumption, year) : null;
        const suggested = categoryDetails && Number.isFinite(categoryDetails.suggested) ? categoryDetails.suggested : 0;
        const growth = manual !== null ? manual : suggested;
        const previous = entry.values[year - 1] || 0;
        entry.values[year] = previous * (1 + growth);
      });
    });
    return details;
  }

  // Same eight year-fields forecastAssumptionDetails reads per category,
  // but bucketed by forecastDetailRows' own name (Revenue_Name/Dept_Name)
  // instead -- so the "Forecast Assumptions" table can show each
  // individual revenue source/department's own historical trend, which is
  // what actually drives its parent category's blended growth rate (see
  // the Ad Valorem Taxes case: one line item dominated "General Government
  // Taxes" enough to make a recording change in that one account look like
  // the whole category's trend).
  function forecastDetailHistoryByYear(lineType, fundCode) {
    const yearFields = FINANCIAL_FORECAST_ACTUAL_YEARS.map((year) => "FY" + year + "_Actual").concat(["FY2026_Original_Budget", "FY2027_Proposed"]);
    const byYear = new Map();
    yearFields.forEach((field) => byYear.set(field, forecastDetailRows(lineType, fundCode, field)));
    return byYear;
  }

  // assumptionDetails is expected to already hold every category for this
  // fund/lineType (forecastAnnualCategories populates it first, from the
  // same underlying baseline) -- the "Assumption" shown per name is its
  // parent category's, since that's the rate actually applied to it (see
  // forecastAnnualDetails); each name's own avgGrowth/cagr below is its
  // own, independent of the category, to surface it as an individual driver.
  function forecastDetailAssumptionRows(fund, lineType, assumptionDetails) {
    const byYearDetailMaps = forecastDetailHistoryByYear(lineType, fund.code);
    const baseline = byYearDetailMaps.get("FY2027_Proposed");
    return Array.from(baseline.keys()).map((name) => {
      const category = baseline.get(name).category;
      const values = {};
      FINANCIAL_FORECAST_ACTUAL_YEARS.forEach((year) => {
        const entry = byYearDetailMaps.get("FY" + year + "_Actual").get(name);
        values[year] = entry ? entry.value : 0;
      });
      const entry2026 = byYearDetailMaps.get("FY2026_Original_Budget").get(name);
      values[2026] = entry2026 ? entry2026.value : 0;
      values[2027] = baseline.get(name).value;
      const categoryDetails = assumptionDetails.get([fund.code, lineType, category].join("|"));
      return {
        name,
        category,
        values,
        avgGrowth: historicalAverageGrowth(values),
        cagr: historicalCagr(values),
        categoryAssumption: categoryDetails ? categoryDetails.assumption : null
      };
    });
  }

  function sumForecastCategories(categories, year) {
    let total = 0;
    categories.forEach((values) => { total += values[year] || 0; });
    return total;
  }

  function getCipProjectYearAmount(project, year) {
    const key = "FY" + year;
    return (project.funding_by_year || [])
      .filter((item) => item.year === key)
      .reduce((sum, item) => sum + (Number(item.amount_value) || 0), 0);
  }

  function isCapitalProjectsFundCipProject(project) {
    return String(project && project.funding || "").trim().toLowerCase() === "capital projects fund";
  }

  function buildCapitalProjectsCipForecast(projectList) {
    const projects = (Array.isArray(projectList) ? projectList : (window.wcCipProjects || []))
      .filter(isCapitalProjectsFundCipProject)
      .filter((project) => !project.is_legacy_in_house_engineering_row);
    const byYear = {};
    const missingYearValues = [];
    FINANCIAL_FORECAST_YEARS.forEach((year) => {
      const rows = projects
        .map((project) => ({
          title: project.title || "Capital Project",
          project_code: project.project_code || "",
          year: "FY" + year,
          amount: getCipProjectYearAmount(project, year)
        }))
        .filter((row) => row.amount > 0);
      byYear[year] = {
        rows,
        total: rows.reduce((sum, row) => sum + row.amount, 0)
      };
      if (!rows.length) missingYearValues.push({ fund_code: "300", year: "FY" + year, note: "No Capital Projects Fund CIP project values found for this year." });
    });
    return { projects, byYear, missingYearValues };
  }

  function buildFinancialForecastModel(cipProjectList) {
    const debugEnabled = new URLSearchParams(window.location.search).get("debugForecast") === "1";
    const assumptionLookup = buildForecastAssumptionLookup();
    const missingAssumptions = [];
    const assumptionDetails = new Map();
    const cipForecast = buildCapitalProjectsCipForecast(cipProjectList);
    const funds = FINANCIAL_FORECAST_FUNDS.map((fund) => {
      const baselineRevenueCategories = forecastCategoryRows("revenue", fund.code, "FY2027_Proposed");
      const baselineExpenseCategories = forecastCategoryRows("expense", fund.code, "FY2027_Proposed");
      const revenueCategories = forecastAnnualCategories(fund, "revenue", baselineRevenueCategories, assumptionLookup, missingAssumptions, assumptionDetails);
      const expenseCategories = forecastAnnualCategories(fund, "expense", baselineExpenseCategories, assumptionLookup, missingAssumptions, assumptionDetails);

      // Detail breakdowns (revenue by source name, expense by department)
      // for the "Category Forecast Detail" table -- built after the
      // category-level forecasts above so assumptionDetails already has
      // every category's growth assumption populated for this fund/lineType.
      const baselineRevenueDetails = forecastDetailRows("revenue", fund.code, "FY2027_Proposed");
      const baselineExpenseDetails = forecastDetailRows("expense", fund.code, "FY2027_Proposed");
      const revenueDetails = forecastAnnualDetails(fund, "revenue", baselineRevenueDetails, assumptionDetails);
      const expenseDetails = forecastAnnualDetails(fund, "expense", baselineExpenseDetails, assumptionDetails);

      // Individual revenue source/department rows for the "Forecast
      // Assumptions" table -- see forecastDetailAssumptionRows. Computed
      // after the category forecasts above so every category this fund's
      // names belong to already has an assumptionDetails entry.
      const revenueDetailAssumptions = forecastDetailAssumptionRows(fund, "revenue", assumptionDetails);
      const expenseDetailAssumptions = forecastDetailAssumptionRows(fund, "expense", assumptionDetails);

      if (fund.code === "300") {
        Array.from(expenseCategories.keys()).forEach((category) => {
          FINANCIAL_FORECAST_YEARS.forEach((year) => {
            expenseCategories.get(category)[year] = 0;
          });
        });
        if (!expenseCategories.has("CIP Project Schedule")) expenseCategories.set("CIP Project Schedule", { 2027: 0 });
        FINANCIAL_FORECAST_YEARS.forEach((year) => {
          expenseCategories.get("CIP Project Schedule")[year] = cipForecast.byYear[year] ? cipForecast.byYear[year].total : 0;
        });

        // Capital Projects Fund expenditures are driven by the CIP
        // schedule rather than any department's own budget lines -- mirror
        // the category-level override above onto the department detail
        // breakdown so the two tables agree.
        Array.from(expenseDetails.keys()).forEach((name) => {
          FINANCIAL_FORECAST_YEARS.forEach((year) => {
            expenseDetails.get(name).values[year] = 0;
          });
        });
        if (!expenseDetails.has("CIP Project Schedule")) expenseDetails.set("CIP Project Schedule", { category: "Capital Outlay", values: { 2027: 0 } });
        FINANCIAL_FORECAST_YEARS.forEach((year) => {
          expenseDetails.get("CIP Project Schedule").values[year] = cipForecast.byYear[year] ? cipForecast.byYear[year].total : 0;
        });
      }

      const beginningBalanceSourceYear = 2026;
      const annual = {};

      FINANCIAL_FORECAST_YEARS.forEach((year, index) => {
        const beginningBalance = index === 0 ? fundBalanceForYear(fund.code, beginningBalanceSourceYear) : annual[year - 1].endingBalance;
        const revenues = sumForecastCategories(revenueCategories, year);
        const expenditures = sumForecastCategories(expenseCategories, year);
        const netChange = revenues - expenditures;
        annual[year] = {
          year,
          beginningBalance,
          revenues,
          expenditures,
          netChange,
          endingBalance: beginningBalance + netChange
        };
      });

      return {
        fund,
        beginningBalanceSource: "Fund balance sheet FY " + beginningBalanceSourceYear,
        historicalRevenue: summarizeForecastHistory("revenue", fund.code),
        historicalExpense: summarizeForecastHistory("expense", fund.code),
        originalBudgetRevenue: summarizeForecastOriginalBudget("revenue", fund.code),
        originalBudgetExpense: summarizeForecastOriginalBudget("expense", fund.code),
        baselineRevenueCategories,
        baselineExpenseCategories,
        revenueCategories,
        expenseCategories,
        revenueDetails,
        expenseDetails,
        revenueDetailAssumptions,
        expenseDetailAssumptions,
        annual
      };
    });

    Array.from(assumptionLookup.values()).forEach((row) => {
      const fund = FINANCIAL_FORECAST_FUNDS.find((item) => item.code === String(row.fund_code || "").trim());
      const lineType = String(row.line_type || "").trim().toLowerCase();
      const category = normalizeForecastCategory(row.category, lineType);
      if (!fund || !lineType || !category) return;
      const key = [fund.code, lineType, category].join("|");
      if (!assumptionDetails.has(key)) {
        assumptionDetails.set(key, forecastAssumptionDetails(fund, lineType, category, assumptionLookup, missingAssumptions));
      }
    });

    const model = {
      funds,
      missingAssumptions,
      missingCipYearValues: cipForecast.missingYearValues,
      cipForecast,
      assumptions: Array.from(assumptionLookup.values()),
      assumptionDetails
    };
    if (debugEnabled) {
      const debug = {};
      funds.forEach((item) => {
        debug[item.fund.code + " " + item.fund.label] = {
          fy2027BaselineRevenueByCategory: Object.fromEntries(item.baselineRevenueCategories),
          fy2027BaselineExpenseByCategory: Object.fromEntries(item.baselineExpenseCategories),
          beginningFundBalanceSource: item.beginningBalanceSource,
          assumptionsApplied: model.assumptions.filter((row) => String(row.fund_code) === item.fund.code),
          annualCalculatedRevenues: Object.fromEntries(FINANCIAL_FORECAST_YEARS.map((y) => [y, item.annual[y].revenues])),
          annualCalculatedExpenditures: Object.fromEntries(FINANCIAL_FORECAST_YEARS.map((y) => [y, item.annual[y].expenditures])),
          annualNetChange: Object.fromEntries(FINANCIAL_FORECAST_YEARS.map((y) => [y, item.annual[y].netChange])),
          annualEndingFundBalance: Object.fromEntries(FINANCIAL_FORECAST_YEARS.map((y) => [y, item.annual[y].endingBalance]))
        };
      });
      console.group("Financial forecast debug");
      console.log("Forecast model", debug);
      console.log("Historical trend details", Array.from(assumptionDetails.entries()).map(([key, details]) => ({
        key,
        values: details.values,
        historical_avg_growth: details.avgGrowth,
        historical_cagr: details.cagr,
        suggested_growth_rate: details.suggested,
        manual_assumptions_used: {
          FY2028: forecastAssumptionValue(details.assumption, 2028),
          FY2029: forecastAssumptionValue(details.assumption, 2029),
          FY2030: forecastAssumptionValue(details.assumption, 2030),
          FY2031: forecastAssumptionValue(details.assumption, 2031)
        }
      })));
      console.log("CIP project rows used for fund 300", cipForecast.byYear);
      console.log("Missing assumption rows", missingAssumptions);
      console.log("Missing CIP year values", cipForecast.missingYearValues);
      console.groupEnd();
    }
    return model;
  }

  function renderForecastDetailTable(item) {
    const rows = [
      ["Beginning Fund Balance", "beginningBalance"],
      ["Revenues", "revenues"],
      ["Expenditures", "expenditures"],
      ["Net Change", "netChange"],
      ["Ending Fund Balance", "endingBalance"]
    ].map(([label, key]) => (
      '<tr class="' + (key === "endingBalance" ? "wc-table-total-row" : "") + '">' +
      '<td>' + escapeHtml(label) + '</td>' +
      FINANCIAL_FORECAST_YEARS.map((year) => '<td class="wc-num">' + forecastMoney(item.annual[year][key]) + '</td>').join("") +
      '</tr>'
    ));
    return renderTable({
      caption: item.fund.code + " " + item.fund.label,
      columns: [{ label: "Line" }].concat(FINANCIAL_FORECAST_YEARS.map((year) => ({ label: "FY " + year + (year === 2027 ? " Baseline" : " Forecast"), num: true }))),
      bodyRows: rows
    });
  }

  function renderForecastDetailBreakdownTable(item, lineType, details) {
    const label = lineType === "revenue" ? "Revenue Source Forecast" : "Expense Department Forecast";
    const columnLabel = lineType === "revenue" ? "Revenue Source" : "Department";
    const rows = Array.from(details.keys())
      .filter((name) => FINANCIAL_FORECAST_YEARS.some((year) => (details.get(name).values[year] || 0) !== 0))
      .sort((a, b) => (details.get(b).values[2027] || 0) - (details.get(a).values[2027] || 0))
      .map((name) => (
      '<tr><td>' + escapeHtml(name) + '</td>' +
      FINANCIAL_FORECAST_YEARS.map((year) => '<td class="wc-num">' + forecastMoney(details.get(name).values[year] || 0) + '</td>').join("") +
      '</tr>'
    ));
    return renderTable({
      caption: label,
      columns: [{ label: columnLabel }].concat(FINANCIAL_FORECAST_YEARS.map((year) => ({ label: "FY " + year, num: true }))),
      bodyRows: rows
    });
  }

  // Small, faded-out revenue lines specific to one fund -- not worth a
  // row on the assumptions table (each is a few thousand dollars at most,
  // several already trailing off to $0). Keyed by "<fund code>|<name,
  // lowercased>" since the same revenue name can be a real, sizable line
  // in a different fund (e.g. Ad Valorem Taxes Delinquent is negligible
  // for Transportation/Sheriff but not necessarily elsewhere).
  const FORECAST_ASSUMPTIONS_HIDDEN_FUND_ROWS = new Set([
    "101|federal grant (economic environment)",
    "101|ad valorem taxes delinquent",
    "101|state payment in lieu of tax",
    "107|ad valorem taxes delinquent",
    "107|state payment in lieu of tax",
    "111|federal grant (public safety)",
    "111|state grant (public safety)",
    "001|non-profit funding program",
    "001|recreation - fbip boating allocation"
  ]);

  // Lists each individual revenue source/department (rather than the
  // handful of broad categories) so the line items actually driving a
  // category's blended growth rate are visible on their own -- see
  // forecastDetailAssumptionRows.
  function renderForecastAssumptionsDetailTable(model, lineType) {
    const assumptionYears = FINANCIAL_FORECAST_YEARS.slice(1);
    const nameLabel = lineType === "revenue" ? "Revenue Source" : "Department";
    const detailsField = lineType === "revenue" ? "revenueDetailAssumptions" : "expenseDetailAssumptions";

    const rowData = model.funds.flatMap((item) => (item[detailsField] || []).map((detail) => ({ fund: item.fund, detail })))
      .filter(({ detail }) => !/^interfund group transfer/i.test(detail.name))
      .filter(({ detail }) => !/^refund of prior year expenditures/i.test(detail.name))
      .filter(({ detail }) => !/^unclassified/i.test(detail.name))
      .filter(({ fund, detail }) => !FORECAST_ASSUMPTIONS_HIDDEN_FUND_ROWS.has(fund.code + "|" + detail.name.toLowerCase()))
      // A line with nothing recorded in either of the two most recent
      // actual years has effectively gone dormant/discontinued -- its
      // older actuals are stale context, not a useful forward-looking
      // driver, so it's just noise on this table.
      .filter(({ detail }) => (detail.values[2024] || 0) !== 0 || (detail.values[2025] || 0) !== 0)
      .filter(({ detail }) => {
        const hasData = FINANCIAL_FORECAST_ACTUAL_YEARS.concat([2027]).some((year) => (detail.values[year] || 0) !== 0);
        const hasGrowthRate = Number.isFinite(detail.avgGrowth) || Number.isFinite(detail.cagr);
        return hasData && hasGrowthRate;
      })
      .map(({ fund, detail }) => ({
        fund,
        detail,
        assumptionValues: assumptionYears.map((year) => forecastAssumptionValue(detail.categoryAssumption, year))
      }))
      // Initial server-rendered order, before the sort buttons (added
      // below) take over client-side: biggest driver first, across every
      // fund -- grouping by fund first would bury a bigger line item in a
      // smaller fund below a smaller one in the General Fund just because
      // of fund order.
      .sort((a, b) => (b.detail.values[2027] || 0) - (a.detail.values[2027] || 0));

    // The editable assumptions file currently sets one flat rate across
    // FY2028-FY2031 for every category -- four identical columns are just
    // noise in that case. Only collapse to one "Assumption" column when
    // every row's four years agree; if even one category has a year-by-year
    // assumption, show all four so that distinction stays visible.
    const allRowsFlat = rowData.every((item) => item.assumptionValues.every((value) => value === item.assumptionValues[0]));
    const assumptionColumns = allRowsFlat
      ? [{ label: "Assumption", num: true }]
      : assumptionYears.map((year) => ({ label: "FY " + year + " Assumption", num: true }));

    const rows = rowData.map(({ fund, detail, assumptionValues }) => {
      const assumptionCells = allRowsFlat
        ? '<td class="wc-num">' + escapeHtml(forecastPercent(assumptionValues[0])) + '</td>'
        : assumptionValues.map((value) => '<td class="wc-num">' + escapeHtml(forecastPercent(value)) + '</td>').join("");
      // data-sort-value/data-sort-name let the sort buttons below
      // reorder these rows client-side without re-running the whole
      // forecast model -- see the delegated click handler for
      // .wc-forecast-sort-button.
      return (
        '<tr data-sort-value="' + (detail.values[2027] || 0) + '" data-sort-name="' + escapeHtml(detail.name.toLowerCase()) + '">' +
        '<td>' + escapeHtml(fund.code) + '</td>' +
        '<td>' + escapeHtml(fund.label) + '</td>' +
        '<td>' + escapeHtml(detail.name) + '</td>' +
        FINANCIAL_FORECAST_ACTUAL_YEARS.map((year) => '<td class="wc-num">' + forecastMoney(detail.values[year] || 0) + '</td>').join("") +
        '<td class="wc-num">' + escapeHtml(forecastPercent(detail.cagr)) + '</td>' +
        assumptionCells + '</tr>'
      );
    });

    const sortToggleHtml =
      '<div class="wc-forecast-sort-toggle" role="group" aria-label="Sort ' + escapeHtml(nameLabel.toLowerCase()) + ' rows">' +
        '<button type="button" class="wc-forecast-sort-button is-active" data-sort-mode="largest" aria-pressed="true">Largest First</button>' +
        '<button type="button" class="wc-forecast-sort-button" data-sort-mode="smallest" aria-pressed="false">Smallest First</button>' +
        '<button type="button" class="wc-forecast-sort-button" data-sort-mode="abc" aria-pressed="false">A-Z</button>' +
      '</div>';
    return renderTable({
      caption: lineType === "revenue" ? "Revenue Forecast Assumptions" : "Expense Forecast Assumptions",
      toggleHtml: sortToggleHtml,
      columns: [
        { label: "Fund" },
        { label: "Fund Name" },
        { label: nameLabel },
        { label: "FY 2020 Actual", num: true },
        { label: "FY 2021 Actual", num: true },
        { label: "FY 2022 Actual", num: true },
        { label: "FY 2023 Actual", num: true },
        { label: "FY 2024 Actual", num: true },
        { label: "FY 2025 Actual", num: true },
        { label: "Historical CAGR", num: true }
      ].concat(assumptionColumns),
      bodyRows: rows
    });
  }

  function renderFinancialForecast(cipProjectList) {
    const model = buildFinancialForecastModel(cipProjectList);
    return (
      '<section class="wc-forecast-section">' +
        '<h2 class="wc-fund-section-heading">Major Fund Detail</h2>' +
        model.funds.map((item) => (
          '<article class="wc-forecast-fund">' +
            '<h3>' + escapeHtml(item.fund.code + " " + item.fund.label) + '</h3>' +
            renderForecastDetailTable(item) +
            '<details class="wc-forecast-detail"><summary>Category Forecast Detail</summary>' +
              renderForecastDetailBreakdownTable(item, "revenue", item.revenueDetails) +
              renderForecastDetailBreakdownTable(item, "expense", item.expenseDetails) +
            '</details>' +
          '</article>'
        )).join("") +
      '</section>' +
      '<section class="wc-forecast-section">' +
        '<h2 class="wc-fund-section-heading">Assumptions</h2>' +
        renderForecastAssumptionsDetailTable(model, "revenue") +
        renderForecastAssumptionsDetailTable(model, "expense") +
      '</section>' +
      lastUpdatedNoteHtml()
    );
  }

  // The fund roll-forward schedule shows the same prior-year-actuals + FY2026
  // Budget columns as the Budget Lines modal. FY2026 budget is sourced from
  // the Supabase original budget cache, with the sheet value used only as a
  // fallback when a row is not present in that cache.
  const FUND_SCHEDULE_YEAR_COLUMNS = BUDGET_LINE_PRIOR_YEAR_COLUMNS
    .concat([
      { field: "FY2027_Proposed", label: "FY 2027 Proposed" }
    ]);

  function fiscalYearForField(field) {
    return Number(field.slice(2, 6));
  }

  // "COA Expenses" (Object_Code/Object_Name/Object_Type) has no dedicated
  // Google Sheet tab, so this catalog is derived from the expenditures
  // sheet's own Object_Code/Object_Name/Object_Type columns instead (first
  // row seen per code) -- classification/label use only, never dollars.
  // Used by synthesizeMissingExpenseRows.
  function buildExpenseObjectCatalog(expenditureRows) {
    const catalog = new Map();
    (expenditureRows || []).forEach((r) => {
      const code = String(r.Object_Code || "").trim();
      if (!code || catalog.has(code)) return;
      catalog.set(code, { Object_Code: code, Object_Name: r.Object_Name || "", Object_Type: r.Object_Type || "" });
    });
    return catalog;
  }

  // Florida's Uniform Accounting System object codes are 3xx for revenue
  // and 5xx/6xx for expense, with no overlap -- used by
  // synthesizeMissingExpenseRows to keep revenue-coded Supabase rows out of
  // its expense-only synthesis.
  function isLikelyExpenseObjectCode(object) {
    const firstDigit = String(object || "").trim().charAt(0);
    return firstDigit === "5" || firstDigit === "6";
  }

  // One or more fund codes combined into a single Beginning Fund Balance ->
  // Revenues -> Other Financial Sources -> Expenditures -> Other Financial
  // Uses -> Change in Fund Balance -> Estimated Ending Fund Balance
  // roll-forward, with a year column per FUND_SCHEDULE_YEAR_COLUMNS entry
  // (prior years hidden behind the same "View Prior Years" toggle used
  // elsewhere on the site).
  function buildFundFinancialSchedule(fundCodes, caption) {
    const revenueRows = cache.revenues || [];
    const expenseRows = cache.expenditures || [];
    if ((!revenueRows.length && !expenseRows.length) || !(cache.fundBalances || []).length) return "";

    const isExcludedFund = (r) => CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r));
    // The Ad Valorem 5% row's nominal Dept_Code (102389) maps to fund
    // "102" (MSBU), which doesn't actually levy this reduction -- it's
    // handled separately per-fund via adValoremFivePercentReductionForFunds,
    // so exclude it here rather than letting it land on MSBU's own table.
    const inFund = (r) => fundCodes.includes(fundCodeForRow(r)) && !isExcludedFund(r) && !isAdValoremFivePercentRow(r);
    const revenueActualFields = new Set(BUDGET_LINE_PRIOR_YEAR_COLUMNS.filter((c) => c.actual).map((c) => c.field));

    function sumFor(rows, predicate, field) {
      const isActualOrBudgetField = revenueActualFields.has(field) || field === "FY2026_Original_Budget";
      // Revenue rows are summed directly here, same as the Consolidated
      // Revenue Summary table, with a cross-department dedup for shared
      // account-level actuals/budget (see revenueBudgetUniqueKey/
      // revenueBudgetAmountForCodes). Some departments legitimately share
      // one Dept_Code+Object_Code across several distinct expense rows
      // (e.g. Statutory & Other's many recipients, each its own
      // Project_Code/amount) -- revenueBudgetUniqueKey's fund+org+code+
      // project grain tells those apart from a true duplicate by keeping
      // Project_Code in the key, so it's safe to reuse for expenses too.
      const shouldDedupeRevenue = rows === revenueRows && isActualOrBudgetField;
      // For historical expense fields (FY2020-FY2026), source from the
      // shared deduped layer instead of the raw display rows -- some
      // departments split one Dept_Code across multiple display-only
      // Dept_Names (e.g. Code Compliance / Code Compliance Beach), each
      // carrying the same full account total (see applyActualsToRows), and
      // summing every display row directly would count that total once per
      // Dept_Name sharing it. buildDedupedHistoricalExpenseRows collapses
      // that back to one row per true accounting record; inFund/predicate
      // below still apply to it unchanged since fund code and Dept_Code/
      // Object_Code (what they key off) are preserved on every deduped row.
      const isHistoricalExpenseField = rows === expenseRows && HISTORICAL_EXPENSE_DEDUP_FIELD_SET.has(field);
      const sourceRows = isHistoricalExpenseField ? (cache.dedupedExpenseRows || []) : rows;
      const seenAmounts = shouldDedupeRevenue ? new Set() : null;
      return sourceRows.reduce((sum, r) => {
        if (!inFund(r) || !predicate(r)) return sum;
        if (seenAmounts) {
          const key = revenueBudgetUniqueKey(r);
          if (seenAmounts.has(key)) return sum;
          seenAmounts.add(key);
        }
        if (field === "FY2026_Original_Budget") {
          // Reuse the same FY2026 contribution logic as the Consolidated
          // Revenue Summary (revenueBudgetMergeContribution) instead of a
          // separate, drifting copy -- it knows about subtractive revenue
          // rows (e.g. the Ad Valorem 5% reduction) that must subtract from
          // their category instead of being sign-flipped positive.
          return sum + (rows === revenueRows ? revenueBudgetMergeContribution(r) : (r.FY2026_Original_Budget || r.FY2026_Budget || 0));
        }
        return sum + (r[field] || 0);
      }, 0);
    }

    function rowValues(predicate, rows) {
      return FUND_SCHEDULE_YEAR_COLUMNS.map((c) => sumFor(rows, predicate, c.field));
    }

    function rowHtml(label, values, rowClass) {
      const labelClass = rowClass && rowClass.indexOf("wc-table-total-row") !== -1 ? ' class="wc-fund-total-label-cell"' : "";
      return (
        "<tr" + (rowClass ? ' class="' + rowClass + '"' : "") + "><td" + labelClass + ">" + escapeHtml(label) + "</td>" +
        values.map((v, i) =>
          '<td class="wc-num' + (i < values.length - 1 ? " wc-prior-year" : "") + '">' + formatCurrency(v) + "</td>"
        ).join("") +
        "</tr>"
      );
    }

    const isOtherFinancingRevenue = (r) => String(r.Revenue_Code || "").trim() === "381000";
    const isOtherFinancingExpense = isOtherFinancingExpenseRow;

    // Each activity/type row's own breakdown -- by revenue source for a
    // Revenues row, by department for an Expenditures row -- computed with
    // the same sumFor/rowValues this table's own totals use, so a row's
    // breakdown always foots to that row's own displayed total. Rendered
    // collapsed inside the activity row's own detail row (see
    // activityRowHtml) rather than always-on, since most users only ever
    // need to drill into one or two activities at a time.
    function activityBreakdownHtml(predicate, isExpenseKind, extraLine) {
      const sourceRows = isExpenseKind ? expenseRows : revenueRows;
      const matchingRaw = sourceRows.filter((r) => inFund(r) && predicate(r));
      if (!matchingRaw.length && !extraLine) return "";

      let labelFor;
      let names;
      if (isExpenseKind) {
        const matchingDeduped = (cache.dedupedExpenseRows || []).filter((r) => inFund(r) && predicate(r));
        const repByCodeAndName = clusterDeptNamesByCode(matchingRaw.concat(matchingDeduped));
        labelFor = (r) => representativeDeptName(repByCodeAndName, r);
        names = uniqueSorted(matchingRaw.concat(matchingDeduped).map(labelFor));
      } else {
        labelFor = (r) => r.Revenue_Name || r.Dept_Name || "Unknown";
        names = uniqueSorted(matchingRaw.map(labelFor));
      }

      const lastIndex = FUND_SCHEDULE_YEAR_COLUMNS.length - 1;
      let entries = names.map((name) => ({
        label: name,
        values: rowValues((r) => predicate(r) && labelFor(r) === name, sourceRows)
      }));
      // The Ad Valorem 5% statutory reduction (see
      // adValoremFivePercentReductionForFunds) isn't a row this fund's
      // revenue rows can be filtered/grouped to -- it's pulled separately
      // from Supabase and only folded into General Government Taxes' own
      // total above. Folded into its matching source row here (by label)
      // too, so that row -- and this breakdown as a whole -- still foots to
      // the activity row's displayed total instead of running short by the
      // reduction amount, without showing it as its own separate line.
      if (extraLine) {
        const merge = entries.find((e) => e.label === extraLine.label);
        if (merge) {
          merge.values = merge.values.map((v, i) => v + extraLine.values[i]);
        } else {
          entries.push(extraLine);
        }
      }
      // Rows that are exactly $0 across every column add nothing but
      // clutter to a fund-scoped breakdown -- most funds only touch a
      // handful of the county-wide revenue sources/departments under any
      // given activity.
      entries = entries.filter((e) => e.values.some((v) => v));
      entries.sort((a, b) => (b.values[lastIndex] || 0) - (a.values[lastIndex] || 0));
      if (!entries.length) return "";

      return (
        '<div class="wc-fund-activity-detail">' +
        '<table class="wc-data-table wc-fund-activity-detail-table">' +
        "<thead><tr><th>" + escapeHtml(isExpenseKind ? "Department" : "Revenue Source") + "</th>" +
        FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => '<th class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + escapeHtml(c.label.toUpperCase()) + "</th>").join("") +
        "</tr></thead><tbody>" +
        entries.map((e) => rowHtml(e.label, e.values)).join("") +
        "</tbody></table></div>"
      );
    }

    // The Revenues/Expenditures group header and each activity row below it
    // are collapsed by default -- clicking the group header reveals its
    // activity rows (see the delegated click handler further down), and
    // clicking a visible activity row expands its own breakdown inline,
    // closing whichever other activity in the same table was already open.
    function groupHeaderHtml(label, groupKey) {
      return (
        '<tr class="wc-table-group-row wc-fund-activity-group-toggle" data-fund-activity-group="' + groupKey + '" tabindex="0" role="button" aria-expanded="false">' +
        "<td>" + escapeHtml(label) + '<span class="wc-fund-activity-chevron" aria-hidden="true"></span></td>' +
        FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => '<td class="' + (i < FUND_SCHEDULE_YEAR_COLUMNS.length - 1 ? "wc-prior-year" : "") + '"></td>').join("") +
        "</tr>"
      );
    }
    function activityRowHtml(label, values, groupKey, predicate, isExpenseKind, extraLine) {
      fundScheduleActivityCounter += 1;
      const rowId = "wc-fund-activity-detail-" + fundScheduleActivityCounter;
      const detailHtml = predicate ? activityBreakdownHtml(predicate, isExpenseKind, extraLine) : "";
      const toggleClass = detailHtml ? " wc-fund-activity-toggle" : "";
      const toggleAttrs = detailHtml ? ' data-target="' + rowId + '" tabindex="0" role="button" aria-expanded="false"' : "";
      const row =
        '<tr class="wc-fund-activity-row' + toggleClass + '" data-fund-activity-group="' + groupKey + '"' + toggleAttrs + " hidden><td>" +
        escapeHtml(label) + (detailHtml ? '<span class="wc-fund-activity-chevron" aria-hidden="true"></span>' : "") + "</td>" +
        values.map((v, i) => '<td class="wc-num' + (i < values.length - 1 ? " wc-prior-year" : "") + '">' + formatCurrency(v) + "</td>").join("") +
        "</tr>";
      const detailRow = detailHtml
        ? '<tr class="wc-fund-activity-detail-row" id="' + rowId + '" data-fund-activity-group="' + groupKey + '" hidden><td colspan="' + (values.length + 1) + '">' + detailHtml + "</td></tr>"
        : "";
      return row + detailRow;
    }

    const bodyRows = [];

    const beginningValues = FUND_SCHEDULE_YEAR_COLUMNS.map((c) => fundBalanceForYear(fundCodes, fiscalYearForField(c.field) - 1));
    bodyRows.push(rowHtml("Beginning Fund Balance", beginningValues, "wc-table-subtotal-row"));

    bodyRows.push(groupHeaderHtml("Revenues", "revenue"));
    const revenueTypeRows = CONSOLIDATED_REVENUE_TYPE_ROWS
      .map((spec) => ({
        label: spec.label,
        predicate: (r) => r.Revenue_Type === spec.key && !isOtherFinancingRevenue(r),
        values: rowValues((r) => r.Revenue_Type === spec.key && !isOtherFinancingRevenue(r), revenueRows)
      }));
    const generalGovTaxesRow = revenueTypeRows.find((row) => row.label === "General Government Taxes");
    if (generalGovTaxesRow) {
      const fy2026Index = FUND_SCHEDULE_YEAR_COLUMNS.findIndex((c) => c.field === "FY2026_Original_Budget");
      const adValoremFivePercent = adValoremFivePercentReductionForFunds(fundCodes);
      if (fy2026Index !== -1) {
        generalGovTaxesRow.values[fy2026Index] += adValoremFivePercent;
        if (adValoremFivePercent) {
          generalGovTaxesRow.extraLine = {
            label: "Ad Valorem Taxes",
            values: FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => (i === fy2026Index ? adValoremFivePercent : 0))
          };
        }
      }
    }
    // A row that's exactly $0 across every column is just visual noise on a
    // fund-scoped schedule -- most funds don't touch every revenue
    // type/expenditure activity the county has. Still summed into the
    // subtotal below either way (trivially, since it's 0).
    revenueTypeRows.forEach((row) => {
      if (row.values.some((v) => v)) bodyRows.push(activityRowHtml(row.label, row.values, "revenue", row.predicate, false, row.extraLine));
    });
    const revenueTypeValues = revenueTypeRows.map((row) => row.values);
    const revenueSubtotalValues = FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => revenueTypeValues.reduce((s, v) => s + v[i], 0));
    bodyRows.push(rowHtml("Total Revenues", revenueSubtotalValues, "wc-table-total-row"));

    const otherSourcesValues = rowValues(isOtherFinancingRevenue, revenueRows);
    if (otherSourcesValues.some((v) => v)) bodyRows.push(rowHtml("Other Financial Sources", otherSourcesValues));
    const revenueTotalValues = revenueSubtotalValues.map((v, i) => v + otherSourcesValues[i]);
    bodyRows.push(rowHtml("Total Revenue and Other Financial Sources", revenueTotalValues, "wc-table-subtotal-row"));

    bodyRows.push(groupHeaderHtml("Expenditures", "expense"));
    // Case-insensitive, matching the Consolidated Expense Summary -- the
    // activities sheet has a few inconsistently-cased entries (e.g.
    // "economic Environment").
    const knownExpenseActivities = new Set(CONSOLIDATED_EXPENDITURE_ACTIVITY_ROWS.map((a) => a.toLowerCase()));
    const expenseTypeRows = CONSOLIDATED_EXPENDITURE_ACTIVITY_ROWS.map((activity) => {
      const activityNorm = activity.toLowerCase();
      const predicate = (r) => expenseActivityForRow(r).toLowerCase() === activityNorm && !isOtherFinancingExpense(r);
      return { label: activity, predicate, values: rowValues(predicate, expenseRows) };
    });
    // Rows whose activity doesn't match a known section above (e.g. a row
    // synthesized from a Supabase-only account with no COA classification --
    // see synthesizeMissingExpenseRows) land on their own Unclassified line
    // instead of being dropped, same as the Consolidated Expense Summary.
    const unclassifiedValues = rowValues(
      (r) => !knownExpenseActivities.has(expenseActivityForRow(r).toLowerCase()) && !isOtherFinancingExpense(r),
      expenseRows
    );
    // Hidden when every column is exactly $0 -- an always-zero row is just
    // visual noise on a fund table that has nothing unclassified.
    if (unclassifiedValues.some((v) => v !== 0)) {
      expenseTypeRows.push({ label: "Unclassified", predicate: null, values: unclassifiedValues });
    }
    expenseTypeRows.forEach((row) => {
      if (row.values.some((v) => v)) bodyRows.push(activityRowHtml(row.label, row.values, "expense", row.predicate, true));
    });
    const expenseTypeValues = expenseTypeRows.map((row) => row.values);
    const expenseSubtotalValues = FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => expenseTypeValues.reduce((s, v) => s + v[i], 0));
    bodyRows.push(rowHtml("Total Expenditures", expenseSubtotalValues, "wc-table-total-row"));

    const otherUsesValues = rowValues(isOtherFinancingExpense, expenseRows);
    if (otherUsesValues.some((v) => v)) bodyRows.push(rowHtml("Other Financial Uses", otherUsesValues));
    const expenseTotalValues = expenseSubtotalValues.map((v, i) => v + otherUsesValues[i]);
    bodyRows.push(rowHtml("Total Expenditures and Other Financial Uses", expenseTotalValues, "wc-table-subtotal-row"));

    const changeValues = revenueTotalValues.map((v, i) => v - expenseTotalValues[i]);
    bodyRows.push(rowHtml("Change in Fund Balance", changeValues, "wc-table-subtotal-row"));

    const endingValues = changeValues.map((v, i) => v + beginningValues[i]);
    bodyRows.push(rowHtml("Estimated Ending Fund Balance", endingValues, "wc-table-total-row"));

    const showPrior = getShowPriorYears();
    const headerCells = ["ROW LABELS"].concat(
      FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => ({ label: c.label.toUpperCase(), prior: i < FUND_SCHEDULE_YEAR_COLUMNS.length - 1 }))
    );

    return (
      '<div class="wc-budget-lines-card' + (showPrior ? " show-prior-years" : "") + '">' +
      '<div class="wc-table-wrap">' +
      '<div class="wc-table-label-row wc-fund-financial-label-row">' +
      '<p class="wc-table-label wc-fund-financial-table-title">' + escapeHtml(caption) + "</p>" +
      priorYearsToggleHtml(showPrior) +
      "</div>" +
      '<div class="wc-data-table-scroll wc-fund-financial-schedule-scroll">' +
      '<table class="wc-data-table wc-fund-financial-schedule-table">' +
      "<thead><tr><th>" + escapeHtml(headerCells[0]) + "</th>" +
      headerCells.slice(1).map((h) => '<th class="wc-num' + (h.prior ? " wc-prior-year" : "") + '">' + escapeHtml(h.label) + "</th>").join("") +
      "</tr></thead>" +
      "<tbody>" + bodyRows.join("") + "</tbody>" +
      "</table>" +
      "</div>" +
      lastUpdatedNoteHtml() +
      "</div>" +
      "</div>"
    );
  }

  // Every distinct fund code actually present in the revenue/expenditure
  // data, regardless of whether it's been added to FUND_SCHEDULE_MAJOR_FUNDS
  // / FUND_SCHEDULE_NON_MAJOR_FUNDS. The consolidated schedule must use this
  // instead of that hand-maintained list (which has already silently missed
  // a fund twice -- 106, then 102) so it can't drift out of sync with the
  // Consolidated Revenue/Expense Summary reports, which sum every fund with
  // no restriction beyond the same CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES
  // exclusion buildFundFinancialSchedule's own isExcludedFund already
  // applies. The major/non-major *sections* still use the curated list,
  // since each fund there needs its own labeled section.
  function allKnownFundCodes() {
    const codes = new Set();
    (cache.revenues || []).forEach((r) => {
      const code = fundCodeForRow(r);
      if (code) codes.add(code);
    });
    (cache.expenditures || []).forEach((r) => {
      const code = fundCodeForRow(r);
      if (code) codes.add(code);
    });
    // Some funds exist only in Supabase with no Google Sheet row at all
    // (e.g. the Preservation Fund) -- synthesizeMissingExpenseRows/
    // synthesizeMissingRevenueRows now add a sheet row for these, so the
    // scans above already see them via fundCodeForRow's same DEPT_CODE_
    // FUND_OVERRIDES correction. These extra scans stay as a defensive
    // backstop in case a Supabase org/object combination is excluded from
    // synthesis (e.g. an alias target or override redirect target) but
    // still needs its fund represented somewhere.
    (cache.originalBudgetRows || []).forEach((r) => {
      const code = fundCodeForRow({ Dept_Code: r.org });
      if (code) codes.add(code);
    });
    (cache.expenseActualRows || []).forEach((r) => {
      const code = fundCodeForRow({ Dept_Code: r.org });
      if (code) codes.add(code);
    });
    return Array.from(codes);
  }

  function renderFundFinancialScheduleSection(funds) {
    return funds
      .map((f) => buildFundFinancialSchedule([f.code], f.label))
      .filter(Boolean)
      .join("");
  }

  function initFundFinancialSchedulesPage() {
    const consolidatedEl = document.getElementById("consolidated-fund-financial-schedule");
    const majorEl = document.getElementById("major-fund-financial-schedules");
    const nonMajorEl = document.getElementById("non-major-fund-financial-schedules");
    const containers = [consolidatedEl, majorEl, nonMajorEl];
    if (!containers.some(Boolean)) return;

    showLoadingState(containers);

    loadBudgetData()
      .then((data) => {
        if (Object.keys(data.errors || {}).length >= data.datasetCount) {
          showErrorState(containers);
          return;
        }
        mountOrHide(consolidatedEl, buildFundFinancialSchedule(allKnownFundCodes(), "Consolidated Fund Financial Schedule"));
        mountOrHide(majorEl, renderFundFinancialScheduleSection(FUND_SCHEDULE_MAJOR_FUNDS));
        mountOrHide(nonMajorEl, renderFundFinancialScheduleSection(FUND_SCHEDULE_NON_MAJOR_FUNDS));
        bindPriorYearsToggle(consolidatedEl);
        bindPriorYearsToggle(majorEl);
        bindPriorYearsToggle(nonMajorEl);
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load budget data", err);
        showErrorState(containers);
      });
  }

  // "Summary of Interfund Transfers" page: the two sides of fund-to-fund
  // transfers, each derived from a single object/revenue code rather than
  // hand-entered. Dept_Name is used as the description since the sheets
  // don't carry a separate transfer-purpose narrative field.
  function renderInterfundTransferTable(rows, fundLabel, caption) {
    const nonZeroRows = rows.filter((r) => (r.FY2027_Proposed || 0) !== 0);
    if (!nonZeroRows.length) return "";
    const sorted = nonZeroRows.slice().sort((a, b) => {
      const fa = fundNameForRow(a), fb = fundNameForRow(b);
      return fa === fb ? (a.Dept_Name || "").localeCompare(b.Dept_Name || "") : fa.localeCompare(fb);
    });
    let total = 0;
    const bodyRows = sorted.map((r) => {
      const amt = r.FY2027_Proposed || 0;
      total += amt;
      const description = r.Note || r.Dept_Name || "";
      return (
        "<tr><td>" + escapeHtml(fundNameForRow(r)) + "</td><td>" + escapeHtml(description) + '</td><td class="wc-num">' + formatCurrency(amt) + "</td></tr>"
      );
    });
    bodyRows.push('<tr class="wc-table-total-row"><td colspan="2">Total</td><td class="wc-num">' + formatCurrency(total) + "</td></tr>");
    return renderTable({
      caption: caption,
      columns: [{ label: fundLabel }, { label: "Description" }, { label: "Amount", num: true }],
      bodyRows: bodyRows,
      showUpdated: true
    });
  }

  function renderInterfundTransfersOutTable() {
    const rows = (cache.expenditures || []).filter((r) => String(r.Object_Code || "").trim() === "591000");
    return renderInterfundTransferTable(rows, "Fund (Transferring Out)", "Interfund Transfers Out");
  }

  function renderInterfundTransfersInTable() {
    const rows = (cache.revenues || []).filter((r) => String(r.Revenue_Code || "").trim() === "381000");
    return renderInterfundTransferTable(rows, "Fund (Receiving)", "Interfund Transfers In");
  }

  function initInterfundTransfersPage() {
    initConsolidatedFundTableContainer("interfund-transfers-out-table", renderInterfundTransfersOutTable, "interfund transfers out");
    initConsolidatedFundTableContainer("interfund-transfers-in-table", renderInterfundTransfersInTable, "interfund transfers in");
  }

  // "Summary of Revenues" page: historical actuals (FY2020-FY2025) by
  // revenue category, live from the revenues sheet.
  const CONSOLIDATED_REVENUE_SUMMARY_ROWS = [
    { type: "General Government Taxes", label: "General Government Taxes" },
    { type: "Permits Fees and Special Assessments", label: "Permits, Fees, and Special Assessments" },
    { type: "Intergovernmental Revenues", label: "Intergovernmental Revenues" },
    { type: "Charges for Services", label: "Charges for Services" },
    { type: "Judgments, Fines and Forfeits", label: "Judgments, Fines and Forfeits" },
    { type: "Miscellaneous Revenue", label: "Miscellaneous Revenue" },
    { type: "Other Sources", label: "Other Sources" }
  ];

  const CONSOLIDATED_REVENUE_SUMMARY_COLUMNS = [
    { field: "FY2020_Actual", label: "FY 2020 Actuals" },
    { field: "FY2021_Actual", label: "FY 2021 Actuals" },
    { field: "FY2022_Actual", label: "FY 2022 Actuals" },
    { field: "FY2023_Actual", label: "FY 2023 Actuals" },
    { field: "FY2024_Actual", label: "FY 2024 Actuals" },
    { field: "FY2025_Actual", label: "FY 2025 Actuals" },
    { field: "FY2026_Original_Budget", label: "FY 2026 Budget" },
    { field: "FY2027_Proposed", label: "FY 2027 Budget" }
  ];

  function renderConsolidatedRevenueSummaryTable() {
    const rows = cache.revenues || [];
    if (!rows.length) return "";

    const lastIndex = CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.length - 1;
    const totals = CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map(() => 0);
    const allMatchingRows = [];
    const revenueActualFields = new Set(BUDGET_LINE_PRIOR_YEAR_COLUMNS.filter((c) => c.actual).map((c) => c.field));

    function dedupedRevenueSum(rowsToSum, field) {
      const shouldDedupe = revenueActualFields.has(field) || field === "FY2026_Original_Budget";
      const seen = shouldDedupe ? new Set() : null;
      return rowsToSum.reduce((sum, r) => {
        if (seen) {
          const key = revenueBudgetUniqueKey(r);
          if (seen.has(key)) return sum;
          seen.add(key);
        }
        if (field === "FY2026_Original_Budget") {
          return sum + revenueBudgetMergeContribution(r);
        }
        return sum + (r[field] || 0);
      }, 0);
    }

    const isReportedElsewhere = (r) =>
      String(r.Revenue_Code || "").trim() === "381000" ||
      CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r));

    const bodyRows = CONSOLIDATED_REVENUE_SUMMARY_ROWS.map((spec) => {
      // Revenue_Code 381000 (Interfund Group Transfer In) is reported on
      // the Summary of Interfund Transfers page instead, and the
      // Self-Insurance Fund (503) is an Internal Service fund rather than
      // a governmental one, so both are excluded here.
      const matching = rows.filter((r) => r.Revenue_Type === spec.type && !isReportedElsewhere(r));
      allMatchingRows.push(...matching);
      return (
        "<tr><td>" + escapeHtml(spec.label) + "</td>" +
        CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map((col, i) => {
          const sum = dedupedRevenueSum(matching, col.field);
          totals[i] += sum;
          return '<td class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + formatCurrency(sum) + "</td>";
        }).join("") +
        "</tr>"
      );
    });
    // Catch-all for any row whose Revenue_Type doesn't match a known
    // category above -- e.g. a row synthesized from a Supabase-only
    // account with no COA classification (see synthesizeMissingRevenueRows).
    // Without this, an unrecognized type would be silently excluded from
    // every category row *and* from Total, which defeats the entire point
    // of never dropping a Supabase dollar.
    const knownRevenueTypes = new Set(CONSOLIDATED_REVENUE_SUMMARY_ROWS.map((spec) => spec.type));
    const unclassifiedRevenueRows = rows.filter((r) => !knownRevenueTypes.has(r.Revenue_Type) && !isReportedElsewhere(r));
    allMatchingRows.push(...unclassifiedRevenueRows);
    const unclassifiedRevenueValues = CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map((col, i) => {
      const sum = dedupedRevenueSum(unclassifiedRevenueRows, col.field);
      totals[i] += sum;
      return sum;
    });
    // Hidden when every column is exactly $0 -- still folded into totals
    // above either way, but an always-zero row is just visual noise on a
    // table that has nothing unclassified.
    if (unclassifiedRevenueValues.some((v) => v !== 0)) {
      bodyRows.push(
        "<tr><td>Unclassified</td>" +
        unclassifiedRevenueValues.map((v, i) => '<td class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + formatCurrency(v) + "</td>").join("") +
        "</tr>"
      );
    }
    bodyRows.push(
      '<tr class="wc-table-total-row"><td>Total</td>' +
      totals.map((t, i) => '<td class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + formatCurrency(t) + "</td>").join("") +
      "</tr>"
    );

    const showPrior = getShowPriorYears();
    return (
      '<div class="wc-budget-lines-card' + (showPrior ? " show-prior-years" : "") + '">' +
      '<div class="wc-table-wrap">' +
      '<div class="wc-table-label-row">' +
      '<p class="wc-table-label">Consolidated Revenue Summary</p>' +
      priorYearsToggleHtml(showPrior) +
      "</div>" +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table">' +
      "<thead><tr><th></th>" +
      CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map((c, i) => '<th class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + escapeHtml(c.label) + "</th>").join("") +
      "</tr></thead>" +
      "<tbody>" + bodyRows.join("") + "</tbody>" +
      "</table>" +
      "</div>" +
      "</div>" +
      renderTableFooterRow(allMatchingRows, null, "revenue", true) +
      "</div>"
    );
  }

  function initConsolidatedRevenueSummaryPage() {
    initConsolidatedFundTableContainer(
      "consolidated-revenue-summary-table",
      renderConsolidatedRevenueSummaryTable,
      "consolidated revenue summary",
      bindPriorYearsToggle
    );
  }

  // "Summary of Expenses" page: a Consolidated Expense Summary showing just
  // the 8 functional Activity classifications (the same level of detail as
  // the Consolidated Revenue Summary's Revenue_Type rows), followed by one
  // narrative + stacked-bar-chart section per Activity.
  const EXPENSE_ACTIVITY_SECTIONS = [
    { containerId: "expense-activity-general-government", activity: "General Government" },
    { containerId: "expense-activity-public-safety", activity: "Public Safety" },
    { containerId: "expense-activity-physical-environment", activity: "Physical Environment" },
    { containerId: "expense-activity-transportation", activity: "Transportation" },
    { containerId: "expense-activity-economic-environment", activity: "Economic Environment" },
    { containerId: "expense-activity-human-services", activity: "Human Services" },
    { containerId: "expense-activity-culture-and-recreation", activity: "Culture and Recreation" },
    { containerId: "expense-activity-court-related-cost", activity: "Court Related Cost", title: "Court-Related Cost" }
  ];

  function renderConsolidatedExpenseSummaryTable() {
    // The Activity sheet has a few inconsistently-cased entries (e.g.
    // "economic Environment"), so matching is done case-insensitively.
    // Interfund transfers/other financing rows are reported on the Summary
    // of Interfund Transfers page instead, same as the revenue summary
    // excludes Revenue_Code 381000; the Self-Insurance Fund (503) is an
    // Internal Service fund rather than a governmental one.
    const matchesFundAndFinancing = (r) =>
      !CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r)) &&
      !isOtherFinancingExpenseRow(r);
    const rows = (cache.expenditures || []).filter(matchesFundAndFinancing);
    if (!rows.length) return "";

    // FY2020-FY2026 columns are summed from the shared deduped layer
    // instead of the raw display rows -- see buildDedupedHistoricalExpenseRows.
    // FY2027 Proposed keeps summing the raw rows directly, since it isn't
    // subject to the same display-row duplication.
    const dedupedRows = (cache.dedupedExpenseRows || []).filter(matchesFundAndFinancing);

    function columnSum(matchingRaw, matchingDeduped, col) {
      const source = HISTORICAL_EXPENSE_DEDUP_FIELD_SET.has(col.field) ? matchingDeduped : matchingRaw;
      return source.reduce((s, r) => s + (r[col.field] || 0), 0);
    }

    const lastIndex = CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.length - 1;
    const totals = CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map(() => 0);
    const allMatchingRows = [];
    const allMatchingDedupedRows = [];
    const bodyRows = EXPENSE_ACTIVITY_SECTIONS.map((section) => {
      const activityNorm = section.activity.toLowerCase();
      const matching = rows.filter((r) => expenseActivityForRow(r).toLowerCase() === activityNorm);
      const matchingDeduped = dedupedRows.filter((r) => expenseActivityForRow(r).toLowerCase() === activityNorm);
      allMatchingRows.push(...matching);
      allMatchingDedupedRows.push(...matchingDeduped);
      return (
        "<tr><td>" + escapeHtml(section.title || section.activity) + "</td>" +
        CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map((col, i) => {
          const sum = columnSum(matching, matchingDeduped, col);
          totals[i] += sum;
          return '<td class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + formatCurrency(sum) + "</td>";
        }).join("") +
        "</tr>"
      );
    });
    // Catch-all for any row whose activity doesn't match a known section
    // above -- e.g. a row synthesized from a Supabase-only account with no
    // COA classification (see synthesizeMissingExpenseRows). Without this,
    // an unrecognized activity would be silently excluded from every
    // section *and* from Total, which defeats the entire point of never
    // dropping a Supabase dollar.
    const knownActivities = new Set(EXPENSE_ACTIVITY_SECTIONS.map((s) => s.activity.toLowerCase()));
    const unclassifiedExpenseRows = rows.filter((r) => !knownActivities.has(expenseActivityForRow(r).toLowerCase()));
    const unclassifiedDedupedRows = dedupedRows.filter((r) => !knownActivities.has(expenseActivityForRow(r).toLowerCase()));
    allMatchingRows.push(...unclassifiedExpenseRows);
    allMatchingDedupedRows.push(...unclassifiedDedupedRows);
    const unclassifiedExpenseValues = CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map((col, i) => {
      const sum = columnSum(unclassifiedExpenseRows, unclassifiedDedupedRows, col);
      totals[i] += sum;
      return sum;
    });
    // Hidden when every column is exactly $0 -- still folded into totals
    // above either way, but an always-zero row is just visual noise on a
    // table that has nothing unclassified.
    if (unclassifiedExpenseValues.some((v) => v !== 0)) {
      bodyRows.push(
        "<tr><td>Unclassified</td>" +
        unclassifiedExpenseValues.map((v, i) => '<td class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + formatCurrency(v) + "</td>").join("") +
        "</tr>"
      );
    }
    bodyRows.push(
      '<tr class="wc-table-total-row"><td>Total</td>' +
      totals.map((t, i) => '<td class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + formatCurrency(t) + "</td>").join("") +
      "</tr>"
    );

    const showPrior = getShowPriorYears();
    return (
      '<div class="wc-budget-lines-card' + (showPrior ? " show-prior-years" : "") + '">' +
      '<div class="wc-table-wrap">' +
      '<div class="wc-table-label-row">' +
      '<p class="wc-table-label">Consolidated Expense Summary</p>' +
      priorYearsToggleHtml(showPrior) +
      "</div>" +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table">' +
      "<thead><tr><th></th>" +
      CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map((c, i) => '<th class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + escapeHtml(c.label) + "</th>").join("") +
      "</tr></thead>" +
      "<tbody>" + bodyRows.join("") + "</tbody>" +
      "</table>" +
      "</div>" +
      "</div>" +
      renderExpenseDepartmentBudgetLinesFooter(allMatchingRows, allMatchingDedupedRows) +
      "</div>"
    );
  }

  // The Consolidated Expense Summary's "View Budget Lines" detail shows
  // department-level subtotals (with each department's category) rather
  // than individual object-code lines, since the visible table above is
  // already rolled up to the 8 broad categories.
  function renderExpenseDepartmentBudgetLinesFooter(rows, dedupedRows) {
    const stamp = new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const updated = '<em>Last Updated: ' + escapeHtml(stamp) + "</em>";
    if (!rows.length) {
      return '<div class="wc-table-footer-row"><p class="wc-data-updated-note">' + updated + "</p></div>";
    }

    budgetLinesDetailCounter += 1;
    const detailId = "wc-budget-lines-" + budgetLinesDetailCounter;
    const showPrior = getShowPriorYears();

    function activityIndex(activity) {
      const norm = String(activity || "").toLowerCase();
      const idx = EXPENSE_ACTIVITY_SECTIONS.findIndex((s) => s.activity.toLowerCase() === norm);
      return idx === -1 ? EXPENSE_ACTIVITY_SECTIONS.length : idx;
    }
    function activityLabel(activity) {
      const norm = String(activity || "").toLowerCase();
      const match = EXPENSE_ACTIVITY_SECTIONS.find((s) => s.activity.toLowerCase() === norm);
      return match ? (match.title || match.activity) : "Other";
    }

    // FY2020-FY2026 columns are summed per department from the shared
    // deduped layer, same as the visible table above (see
    // buildDedupedHistoricalExpenseRows) -- some departments split one
    // Dept_Code across multiple display-only Dept_Names (e.g. Code
    // Compliance / Code Compliance Beach) that each carry the *same* full
    // historical/FY2026 total for a shared account, so summing those fields
    // from the raw display rows per Dept_Name would double-count it.
    // FY2027 Proposed still sums from the raw rows, since it isn't subject
    // to that duplication.
    const historicalFields = BUDGET_LINE_PRIOR_YEAR_COLUMNS.map((c) => c.field);
    const currentYearField = "FY2027_Proposed";

    const repByCodeAndName = clusterDeptNamesByCode(rows.concat(dedupedRows || []));
    function representativeName(r) {
      return representativeDeptName(repByCodeAndName, r);
    }
    function groupKeyFor(r) {
      const code = String(r.Dept_Code || "").trim();
      return code ? code + "|" + normalizeDeptName(representativeName(r)) : "name:" + normalizeDeptName(r.Dept_Name);
    }
    function entryFor(byDept, r) {
      const key = groupKeyFor(r);
      const name = representativeName(r);
      if (!byDept.has(key)) {
        const entry = { Dept_Name: name, activity: expenseActivityForRow(r), [currentYearField]: 0 };
        historicalFields.forEach((f) => { entry[f] = 0; });
        byDept.set(key, entry);
      }
      return byDept.get(key);
    }
    const byDept = new Map();
    rows.forEach((r) => {
      entryFor(byDept, r)[currentYearField] += r[currentYearField] || 0;
    });
    (dedupedRows || rows).forEach((r) => {
      const entry = entryFor(byDept, r);
      historicalFields.forEach((f) => { entry[f] += r[f] || 0; });
    });

    const deptRows = Array.from(byDept.values()).sort((a, b) => {
      const ai = activityIndex(a.activity);
      const bi = activityIndex(b.activity);
      if (ai !== bi) return ai - bi;
      return a.Dept_Name.localeCompare(b.Dept_Name);
    });

    const bodyRows = deptRows.map((d) => {
      const isZeroCurrent = (d.FY2027_Proposed || 0) === 0;
      const deptHref = departmentPageHref(d.Dept_Name);
      const deptLabel = escapeHtml(d.Dept_Name);
      return (
        "<tr" + (isZeroCurrent ? ' class="wc-budget-line-zero-current"' : "") + ">" +
        "<td>" + escapeHtml(activityLabel(d.activity)) + "</td>" +
        "<td>" + (deptHref ? '<a class="wc-department-row-link" href="' + escapeHtml(deptHref) + '">' + deptLabel + "</a>" : deptLabel) + "</td>" +
        BUDGET_LINE_PRIOR_YEAR_COLUMNS.map((c) =>
          '<td class="wc-num wc-prior-year">' + formatCurrency(d[c.field] || 0) + "</td>"
        ).join("") +
        '<td class="wc-num">' + formatCurrency(d.FY2027_Proposed || 0) + "</td></tr>"
      );
    });
    const totals = {};
    historicalFields.concat([currentYearField]).forEach((field) => {
      totals[field] = deptRows.reduce((sum, row) => sum + (row[field] || 0), 0);
    });
    bodyRows.push(
      '<tr class="wc-table-total-row"><td colspan="2">Total</td>' +
        BUDGET_LINE_PRIOR_YEAR_COLUMNS.map((c) =>
          '<td class="wc-num wc-prior-year">' + formatCurrency(totals[c.field] || 0) + "</td>"
        ).join("") +
        '<td class="wc-num">' + formatCurrency(totals.FY2027_Proposed || 0) + "</td></tr>"
    );

    const detailTable = renderTable({
      columns: [{ label: "Category" }, { label: "Department" }].concat(
        BUDGET_LINE_PRIOR_YEAR_COLUMNS.map((c) => ({ label: c.label, num: true, classes: ["wc-prior-year"] })),
        [{ label: "FY 2027 Proposed", num: true }]
      ),
      bodyRows: bodyRows
    });

    const toggleHeader = priorYearsToggleHtml(showPrior, "wc-budget-lines-detail-header");

    return (
      '<div class="wc-table-footer-row">' +
      '<p class="wc-data-updated-note">' + updated + "</p>" +
      '<button type="button" class="wc-view-budget-lines-toggle" data-target="' + detailId + '" aria-expanded="false">View Budget Lines</button>' +
      "</div>" +
      '<div class="wc-budget-lines-detail wc-budget-lines-card' + (showPrior ? " show-prior-years" : "") + '" id="' + detailId + '" hidden>' +
      toggleHeader + detailTable +
      "</div>"
    );
  }

  function initConsolidatedExpenseSummaryPage() {
    initConsolidatedFundTableContainer(
      "consolidated-expense-summary-table",
      renderConsolidatedExpenseSummaryTable,
      "consolidated expense summary",
      bindPriorYearsToggle
    );
  }

  // Traces a rounded-rectangle path on `ctx` without relying on the
  // browser's native CanvasRenderingContext2D.roundRect (not available in
  // every supported browser), clamping the radius so it never exceeds half
  // the rectangle's own width/height -- a too-large radius would otherwise
  // make the two corners on a short/narrow side overlap and self-intersect.
  function tracePathForRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // Chart.js draws each stacked dataset's bar segment as its own flat
  // rectangle. Rounding any one segment's own corners (e.g. via its
  // borderRadius option) breaks down two ways: a segment in the middle of
  // the stack gets rounded on a side that should butt flush against its
  // neighbor, and the *outermost* segment's rounding gets silently clamped
  // away by Chart.js whenever that segment's own value is a thin sliver
  // (a small dollar amount can be only a few pixels tall, too short to fit
  // a 6px radius) -- the bar still looks flat even though the rounding
  // logic picked the right segment.
  //
  // Clipping the whole bar's silhouette to one rounded rectangle, based on
  // the bar's *total* stacked height rather than any single segment's
  // value, fixes both: it's a Chart.js plugin (registered per chart, not
  // globally, since only these two stacked-bar charts want it) that clips
  // the canvas to every bar's rounded outline before Chart.js draws the
  // (otherwise plain, square) bar rectangles, so only the true top/bottom
  // of the combined stack ever gets rounded, regardless of which dataset
  // happens to occupy that edge.
  function stackedBarRoundingPlugin(radius) {
    return {
      id: "wcStackedBarRounding",
      beforeDatasetsDraw(chart) {
        const datasets = chart.data.datasets;
        const meta0 = chart.getDatasetMeta(0);
        if (!datasets.length || !meta0 || !meta0.data.length) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        let pathed = false;
        meta0.data.forEach((firstEl, barIndex) => {
          let top = Infinity;
          let bottom = -Infinity;
          let left = null;
          let width = 0;
          datasets.forEach((ds, di) => {
            const meta = chart.getDatasetMeta(di);
            if (meta.hidden || !ds.data[barIndex]) return;
            const el = meta.data[barIndex];
            if (!el) return;
            top = Math.min(top, el.y);
            bottom = Math.max(bottom, el.base);
            if (left === null) {
              left = el.x - el.width / 2;
              width = el.width;
            }
          });
          if (left === null || !isFinite(top)) return;
          tracePathForRoundedRect(ctx, left, top, width, bottom - top, radius);
          pathed = true;
        });
        if (pathed) {
          ctx.clip();
          chart.$wcStackedBarClipped = true;
        } else {
          ctx.restore();
        }
      },
      afterDatasetsDraw(chart) {
        if (chart.$wcStackedBarClipped) {
          chart.ctx.restore();
          chart.$wcStackedBarClipped = false;
        }
      }
    };
  }

  // Chart.js draws straight to <canvas>, so its axis labels/gridlines can't
  // pick up the site's CSS dark-mode variables the way every other element
  // on the page does just by being styled in stylesheet.css. Reading the
  // live CSS variables here (rather than hardcoding a parallel light/dark
  // color pair in JS) keeps these in sync automatically if the palette in
  // style.css ever changes.
  function wcChartThemeColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: (styles.getPropertyValue("--muted") || "#5a6e7f").trim(),
      grid: (styles.getPropertyValue("--border") || "#e0e8e4").trim()
    };
  }

  // Scriptable options (the `() => ...` callbacks set on each chart's
  // scales/datasets below) only get re-evaluated when something tells
  // Chart.js to redraw -- they don't repaint on their own just because
  // --text/--border changed. The theme toggle (walton-budget-nav.js) flips
  // data-theme on <html> with no page reload and without dispatching any
  // event of its own, so this observes that attribute directly (one
  // observer total, regardless of how many listeners are registered) and
  // re-runs every registered listener -- a chart's own `.update()`, or a
  // legend swatch recolor, or anything else -- whenever it changes.
  const wcThemeListeners = [];
  let wcThemeObserverStarted = false;

  function onWcThemeChange(listener) {
    wcThemeListeners.push(listener);
    if (wcThemeObserverStarted) return;
    wcThemeObserverStarted = true;
    const observer = new MutationObserver(() => {
      wcThemeListeners.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          // A listener's chart/DOM was destroyed since the last theme
          // change -- nothing to update for it.
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function registerWcThemedChart(chart) {
    onWcThemeChange(() => chart.update());
  }

  // The site's fixed bar-chart palette (REVENUE_TOPIC_CHART_COLORS) is
  // tuned for a white chart background -- several entries (near-black
  // greens, pure black, dark greys) are deliberately dark for contrast
  // there, which makes them nearly invisible against the dark theme's
  // near-black chart background instead. Rather than hand-maintaining a
  // second 24-color palette to keep in sync, this lightens each color by a
  // fixed amount in HSL space when dark mode is active, preserving its hue
  // (so position N in the palette still reads as "the same family of
  // color" in both themes) while guaranteeing every entry ends up legible.
  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    return [
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255
    ];
  }

  function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l * 100];
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return [h, s * 100, l * 100];
  }

  function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }

  // Clicking a custom legend item (see renderExpenseActivityChart/
  // renderRevenueTopicCards) isolates that one series instead of Chart.js's
  // default of hiding it -- clicking a series shows ONLY that series;
  // clicking it again (or whichever series is currently the sole one
  // shown) restores every series. Clicking a different series while one is
  // already isolated switches the isolation to the new one rather than
  // stacking/toggling individually, since "isolate" is a single either/or
  // view rather than a per-series on/off switch.
  function handleChartLegendIsolateClick(chart, legendEl, i) {
    const metas = chart.data.datasets.map((_, di) => chart.getDatasetMeta(di));
    const isVisible = (di) => metas[di].hidden !== true;
    const onlyThisVisible = isVisible(i) && metas.every((meta, di) => di === i || !isVisible(di));
    metas.forEach((meta, di) => {
      meta.hidden = onlyThisVisible ? false : di !== i;
    });
    legendEl.querySelectorAll(".wc-revenue-chart-legend-item").forEach((el, di) => {
      el.classList.toggle("is-hidden", !!metas[di].hidden);
    });
    chart.update();
  }

  function chartColorForTheme(hex) {
    if (document.documentElement.getAttribute("data-theme") !== "dark") return hex;
    const [h, s, l] = rgbToHsl(...hexToRgb(hex));
    return hslToHex(h, Math.min(85, s + 8), Math.min(82, l + 30));
  }

  // One narrative banner + full-width stacked-bar chart (grouped by
  // contributing department) per expense Activity classification.
  function renderExpenseActivityChart(container, section, idPrefix) {
    if (!container) return;
    const activityNorm = section.activity.toLowerCase();
    const matchesActivityAndFund = (r) =>
      expenseActivityForRow(r).toLowerCase() === activityNorm &&
      !CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r));
    const expenseRows = (cache.expenditures || []).filter(matchesActivityAndFund);
    // FY2020-FY2026 columns are summed from the shared deduped layer
    // instead of the raw display rows -- see buildDedupedHistoricalExpenseRows.
    // Some departments split one Dept_Code across multiple display-only
    // Dept_Names (e.g. Code Compliance / Code Compliance Beach), each
    // carrying the same full account total for those years -- stacking
    // both bars would double it. FY2027 Proposed keeps summing the raw
    // rows directly, since it isn't subject to that display-row
    // duplication (each Dept_Name's own itemized FY2027 budget lines are
    // genuinely distinct).
    const dedupedRows = (cache.dedupedExpenseRows || []).filter(matchesActivityAndFund);

    container.innerHTML =
      '<div class="wc-expense-activity-chart-card">' +
      '<div class="wc-expense-activity-chart-wrap"><canvas id="' + idPrefix + '"></canvas></div>' +
      '<div class="wc-revenue-chart-legend" id="' + idPrefix + '-legend"></div>' +
      lastUpdatedNoteHtml() +
      "</div>";

    if (typeof Chart === "undefined") return;

    const byDept = new Map();
    expenseRows.forEach((r) => {
      const name = r.Dept_Name || "Unknown";
      if (!byDept.has(name)) byDept.set(name, []);
      byDept.get(name).push(r);
    });
    const dedupedByDept = new Map();
    dedupedRows.forEach((r) => {
      const name = r.Dept_Name || "Unknown";
      if (!dedupedByDept.has(name)) dedupedByDept.set(name, []);
      dedupedByDept.get(name).push(r);
    });

    const baseColors = Array.from(byDept.keys()).map((_, i) => REVENUE_TOPIC_CHART_COLORS[i % REVENUE_TOPIC_CHART_COLORS.length]);
    const datasets = Array.from(byDept.entries()).map(([name, rowsForName], i) => ({
      label: name,
      data: REVENUE_TOPIC_CHART_YEARS.map((y) => {
        const source = HISTORICAL_EXPENSE_DEDUP_FIELD_SET.has(y.field) ? (dedupedByDept.get(name) || []) : rowsForName;
        return source.reduce((s, r) => s + (r[y.field] || 0), 0);
      }),
      // Scriptable so it re-resolves (via registerWcThemedChart's
      // chart.update() on theme change) to a dark-mode-legible variant
      // instead of staying fixed at the light-mode hex forever -- see
      // chartColorForTheme.
      backgroundColor: () => chartColorForTheme(baseColors[i])
    }));

    const canvas = document.getElementById(idPrefix);
    if (!canvas || !datasets.length) return;

    const chart = new Chart(canvas, {
      type: "bar",
      data: { labels: REVENUE_TOPIC_CHART_YEARS.map((y) => y.label), datasets: datasets },
      plugins: [stackedBarRoundingPlugin(6)],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: () => wcChartThemeColors().text }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { display: true, color: () => wcChartThemeColors().grid },
            ticks: { color: () => wcChartThemeColors().text, callback: (v) => formatAbbreviatedCurrency(v) }
          }
        },
        // "nearest"/intersect:true so hovering activates just the one bar
        // segment under the cursor -- the previous "index"/intersect:false
        // combo showed every dataset's value at that x position regardless
        // of which segment was actually being pointed at.
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "nearest",
            intersect: true,
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": " + formatAbbreviatedCurrency(ctx.parsed.y)
            }
          }
        }
      }
    });
    registerWcThemedChart(chart);

    const legendEl = document.getElementById(idPrefix + "-legend");
    if (legendEl) {
      legendEl.innerHTML = datasets.map((d, i) =>
        '<button type="button" class="wc-revenue-chart-legend-item" data-index="' + i + '">' +
        '<span class="wc-revenue-chart-legend-swatch" style="background:' + chartColorForTheme(baseColors[i]) + '"></span>' +
        "<span>" + escapeHtml(d.label) + "</span>" +
        "</button>"
      ).join("");
      onWcThemeChange(() => {
        legendEl.querySelectorAll(".wc-revenue-chart-legend-swatch").forEach((swatch, i) => {
          swatch.style.background = chartColorForTheme(baseColors[i]);
        });
      });

      legendEl.querySelectorAll(".wc-revenue-chart-legend-item").forEach((item) => {
        const i = Number(item.dataset.index);
        item.addEventListener("mouseenter", () => {
          chart.setActiveElements(chart.data.datasets[i].data.map((_, di) => ({ datasetIndex: i, index: di })));
          chart.update();
        });
        item.addEventListener("mouseleave", () => {
          chart.setActiveElements([]);
          chart.update();
        });
        item.addEventListener("click", () => {
          handleChartLegendIsolateClick(chart, legendEl, i);
        });
      });
    }
  }

  function initExpenseActivityChartsPage() {
    const sections = EXPENSE_ACTIVITY_SECTIONS.filter((s) => document.getElementById(s.containerId));
    if (!sections.length) return;

    sections.forEach((s) => {
      document.getElementById(s.containerId).innerHTML = '<div class="wc-data-loading">' + LOADING_MESSAGE_HTML + "</div>";
    });

    loadBudgetData()
      .then((data) => {
        sections.forEach((s) => {
          const container = document.getElementById(s.containerId);
          if (Object.keys(data.errors || {}).length >= data.datasetCount) {
            container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
            return;
          }
          renderExpenseActivityChart(container, s, "wc-expense-chart-" + s.containerId);
        });
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load expense activity charts", err);
        sections.forEach((s) => {
          document.getElementById(s.containerId).innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
        });
      });
  }

  // "Summary of Revenues" page: a narrative + bar-chart card for each major
  // revenue source within each classification. Narrative text comes from
  // the same departmentNarratives sheet, keyed by the topic name below
  // instead of a department name.
  function byRevenueCodes(codes) {
    const set = new Set(codes);
    return (r) => set.has(String(r.Revenue_Code || "").trim());
  }
  function byRevenueCodeAndDeptCode(code, deptCode) {
    return (r) => String(r.Revenue_Code || "").trim() === code && String(r.Dept_Code || "").trim() === deptCode;
  }
  // A catch-all topic: every row of this Revenue_Type not already claimed
  // by one of the other topics in the same section.
  function remainderOfType(type, siblingMatchers) {
    return (r) => r.Revenue_Type === type && !siblingMatchers.some((m) => m(r));
  }

  function buildIntergovernmentalRevenueTopics() {
    const halfCent = { title: "Local Government Half-Cent Sales Tax", narrativeKey: "Local Government Half-Cent Sales Tax", matches: byRevenueCodes(["335180"]) };
    const stateFuel = { title: "State Fuel Taxes", narrativeKey: "State Fuel Taxes", matches: byRevenueCodes(["335420", "335421", "335422", "335490"]) };
    const stateRevenueShare = { title: "State Revenue Share Proceeds", narrativeKey: "State Revenue Share Proceeds", matches: byRevenueCodes(["335121"]) };
    const section8 = { title: "Section 8 Housing Choice Voucher Program", narrativeKey: "Section 8 Housing Choice Voucher Program", matches: byRevenueCodes(["331500"]) };
    const resourceOfficers = { title: "Sheriff Resource Officers", narrativeKey: "Sheriff Resource Officers", matches: byRevenueCodes(["337200"]) };
    const siblings = [halfCent, stateFuel, stateRevenueShare, section8, resourceOfficers].map((t) => t.matches);
    const remainderType = remainderOfType("Intergovernmental Revenues", siblings);
    // Grant accounts (Federal Grant (...), State Grant (...)) are one-off,
    // program-specific awards rather than recurring intergovernmental
    // revenue -- they clutter this catch-all card's chart with a long tail
    // of small, inconsistent-year-to-year slivers instead of the steady
    // shared-revenue sources it's meant to show.
    const remainder = {
      title: "Intergovernmental Revenue",
      narrativeKey: "Intergovernmental Revenue",
      matches: (r) => remainderType(r) && !/grant/i.test(r.Revenue_Name || "")
    };
    return [halfCent, stateFuel, stateRevenueShare, section8, resourceOfficers, remainder];
  }

  function buildChargesForServicesTopics() {
    const planningFees = { title: "Planning Fees", narrativeKey: "Planning Fees", matches: byRevenueCodes(["341201"]) };
    const eagleSprings = {
      title: "Eagle Springs Golf and Recreation Center Revenue",
      narrativeKey: "Eagle Springs Golf and Recreation Center Revenue",
      matches: byRevenueCodes(["347201", "347202", "347203", "347204", "347205", "347206", "347207", "347208", "347209", "347210", "347211"])
    };
    const ambulanceFees = { title: "Ambulance Fees", narrativeKey: "Ambulance Fees", matches: byRevenueCodes(["342600"]) };
    const fireRescueMsbu = { title: "Fire Rescue MSBUs", narrativeKey: "Fire Rescue MSBUs", matches: byRevenueCodeAndDeptCode("343410", "107343") };
    const siblings = [planningFees, eagleSprings, ambulanceFees, fireRescueMsbu].map((t) => t.matches);
    const remainder = { title: "Charges for Services", narrativeKey: "Charges for Services", matches: remainderOfType("Charges for Services", siblings) };
    return [planningFees, eagleSprings, ambulanceFees, fireRescueMsbu, remainder];
  }

  function buildPermitsFeesTopics() {
    return [
      { title: "Building Permits", narrativeKey: "Building Permits", matches: byRevenueCodes(["322000"]) },
      { title: "Beach Activity & Event Permits", narrativeKey: "Beach Activity & Event Permits", matches: byRevenueCodes(["329002", "329003", "329004", "329005", "329009"]) }
    ];
  }

  function buildJudgmentsFinesTopics() {
    return [
      { title: "Ordinance Fines", narrativeKey: "Ordinance Fines", matches: byRevenueCodes(["354000", "354001", "354002", "354003"]) }
    ];
  }

  function buildMiscellaneousRevenueTopics() {
    return [
      { title: "Recreation Plat Fee", narrativeKey: "Recreation Plat Fee", matches: byRevenueCodes(["369902"]) },
      { title: "Interest", narrativeKey: "Interest", matches: byRevenueCodes(["361100", "361102", "361103", "361105", "361106", "361107", "361108", "361111"]) }
    ];
  }

  const REVENUE_CLASSIFICATION_SECTIONS = [
    {
      containerId: "general-government-tax-topics",
      topics: [
        {
          title: "Ad Valorem Taxes",
          narrativeKey: "Property Tax",
          // Also matches the statutory 5% Ad Valorem discount row
          // (Dept_Code 102389/Revenue_Code 389001, relabeled to "Ad Valorem
          // Taxes" by REVENUE_NAME_OVERRIDES) so its FY2026 reduction nets
          // into this chart's bar the same way it already does on the
          // Summary of Revenues table -- without it, the chart's FY2026 bar
          // showed the gross amount instead of net-of-5%.
          matches: (r) => byRevenueCodes(["311000", "311001"])(r) || byRevenueCodeAndDeptCode("389001", "102389")(r)
        },
        { title: "Tourist Development Taxes", narrativeKey: "Tourist Development Tax", matches: byRevenueCodes(["312120", "312130", "312150", "312160", "312170"]) },
        { title: "Local Discretionary Sales Surtax", narrativeKey: "Local Discretionary Sales Surtax", matches: byRevenueCodes(["312600"]) },
        { title: "Local Option Fuel Tax", narrativeKey: "Local Option Fuel Tax", matches: byRevenueCodes(["312300", "312410"]) }
      ]
    },
    { containerId: "intergovernmental-revenue-topics", topics: buildIntergovernmentalRevenueTopics() },
    { containerId: "charges-for-services-topics", topics: buildChargesForServicesTopics() },
    { containerId: "permits-fees-topics", topics: buildPermitsFeesTopics() },
    { containerId: "judgments-fines-topics", topics: buildJudgmentsFinesTopics() },
    { containerId: "miscellaneous-revenue-topics", topics: buildMiscellaneousRevenueTopics() }
  ];

  const REVENUE_TOPIC_CHART_YEARS = [
    { field: "FY2022_Actual", label: "FY 2022 Actual" },
    { field: "FY2023_Actual", label: "FY 2023 Actual" },
    { field: "FY2024_Actual", label: "FY 2024 Actual" },
    { field: "FY2025_Actual", label: "FY 2025 Actual" },
    // Sourced from expense_original_budget_public (Supabase), not the
    // Google Sheets FY2026_Budget field -- the sheet no longer carries that
    // column at all, so reading it directly left this bar permanently
    // empty. See BUDGET_LINE_PRIOR_YEAR_COLUMNS for the same field used
    // everywhere else FY2026 is shown.
    { field: "FY2026_Original_Budget", label: "FY 2026 Budget" },
    { field: "FY2027_Proposed", label: "FY 2027 Proposed" }
  ];

  const REVENUE_TOPIC_CHART_COLORS = [
    "#003f28", "#097FBB", "#D1BE78", "#FFDE59", "#3A9FD6", "#2F6F4D",
    "#A3955C", "#C7AA3F", "#065A86", "#002b1b", "#BFAE6A", "#FFE98A",
    "#4D4D4D", "#7A7A7A", "#005236", "#000000", "#6FAF8F", "#5B7C99",
    "#8A8F98", "#7A9E7E", "#355C7D", "#9BA3AF", "#4B6F52", "#6D8299"
  ];

  // Abbreviates large dollar amounts for axis ticks/legends, e.g. $150M, $1.2M, $500K.
  function formatAbbreviatedCurrency(value) {
    const n = Number(value) || 0;
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    if (abs >= 1e9) return sign + "$" + trimDecimal(abs / 1e9) + "B";
    if (abs >= 1e6) return sign + "$" + trimDecimal(abs / 1e6) + "M";
    if (abs >= 1e3) return sign + "$" + trimDecimal(abs / 1e3) + "K";
    return sign + "$" + abs;
  }

  function trimDecimal(n) {
    return (Math.round(n * 10) / 10).toString();
  }

  const REVENUE_ACTUAL_FIELD_NAMES = new Set(BUDGET_LINE_PRIOR_YEAR_COLUMNS.filter((c) => c.actual).map((c) => c.field));

  function sumRevenueRowsForField(rows, field) {
    if (REVENUE_ACTUAL_FIELD_NAMES.has(field) && (cache.revenueActualRows || []).length) {
      const year = Number(field.slice(2, 6));
      const codes = new Set(rows.map((row) => String((row && row.Revenue_Code) || "").trim()).filter(Boolean));
      return (cache.revenueActualRows || []).reduce((sum, row) => {
        if (Number(row.year) !== year) return sum;
        if (!codes.has(String(row.object || "").trim())) return sum;
        if (CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(String(row.org || "").trim().slice(0, 3))) return sum;
        return sum + (Number(row.amount) || 0);
      }, 0);
    }

    if (field === "FY2026_Original_Budget") {
      // Same dedup as the Consolidated Revenue Summary's dedupedRevenueSum
      // (revenueBudgetUniqueKey: fund+Dept_Code+Revenue_Code+Project_Code)
      // -- a shared GL code (e.g. the General Fund's Ad Valorem Taxes line)
      // can be referenced by many departments' own rows under the same
      // Dept_Code, each carrying the *same* full account total rather than
      // its own share, so summing every row directly would multiply it by
      // however many departments reference it. Unlike budgetLineColumnTotal
      // (scoped to one department's own rows, where a code-level fallback
      // is needed for a row the dedup zeroed out), a chart topic's rows
      // already span every department county-wide, so deduping by key and
      // summing each one once is sufficient -- the real amount lives on
      // whichever row in the group happens to be first.
      const seen = new Set();
      return (rows || []).reduce((sum, row) => {
        const key = revenueBudgetUniqueKey(row);
        if (seen.has(key)) return sum;
        seen.add(key);
        return sum + revenueBudgetMergeContribution(row);
      }, 0);
    }

    return rows.reduce((sum, row) => {
      return sum + (row[field] || 0);
    }, 0);
  }

  function renderRevenueTopicCards(container, topics, idPrefix) {
    if (!container) return;
    // The Self-Insurance Fund (503) is an Internal Service fund, not a
    // governmental one, and is excluded from every other revenue
    // schedule on the site for the same reason (see
    // CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES) -- its premium/fee
    // revenue (Employee/Retiree/Cobra Health Fees, etc.) has no business
    // appearing on these topic cards either.
    const revenueRows = (cache.revenues || []).filter((r) => !CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r)));
    const narrativeRows = cache.departmentNarratives || [];

    container.innerHTML = topics.map((topic, topicIndex) => {
      const narrativeRow = narrativeRows.find((r) => normalizeDeptName(r.Dept_Name) === normalizeDeptName(topic.narrativeKey));
      const paragraphs = narrativeRow ? splitIntoParagraphs(narrativeRow.Narrative) : [];
      const narrativeHtml = paragraphs.length
        ? paragraphs.map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("")
        : '<p class="wc-data-empty">Narrative coming soon.</p>';

      const chartCardHtml =
        '<div class="wc-revenue-topic-chart-card">' +
        '<div class="wc-revenue-topic-chart-wrap"><canvas id="' + idPrefix + "-" + topicIndex + '"></canvas></div>' +
        '<div class="wc-revenue-chart-legend" id="' + idPrefix + "-" + topicIndex + '-legend"></div>' +
        lastUpdatedNoteHtml() +
        "</div>";
      const narrativeCardHtml =
        '<div class="wc-revenue-topic-narrative-card">' +
        '<h2 class="wc-revenue-topic-title">' + escapeHtml(topic.title) + "</h2>" +
        narrativeHtml +
        "</div>";
      const isReversed = topicIndex % 2 === 1;

      return (
        '<div class="wc-revenue-topic-block">' +
        '<div class="wc-revenue-topic-row' + (isReversed ? " wc-revenue-topic-row-reverse" : "") + '">' +
        (isReversed ? narrativeCardHtml + chartCardHtml : chartCardHtml + narrativeCardHtml) +
        "</div>" +
        "</div>"
      );
    }).join("");

    if (typeof Chart === "undefined") return;

    topics.forEach((topic, topicIndex) => {
      // Grouped by Revenue_Name (not Revenue_Code) so codes that share a
      // name, like Tourist Development Tax's per-cent tiers, combine into
      // a single bar segment instead of one sliver per code.
      const byName = new Map();
      revenueRows.filter(topic.matches).forEach((r) => {
        const name = r.Revenue_Name || String(r.Revenue_Code || "").trim();
        if (!byName.has(name)) byName.set(name, []);
        byName.get(name).push(r);
      });

      const baseColors = Array.from(byName.keys()).map((_, i) => REVENUE_TOPIC_CHART_COLORS[i % REVENUE_TOPIC_CHART_COLORS.length]);
      const datasets = Array.from(byName.entries()).map(([name, rowsForName], i) => ({
        label: name,
        data: REVENUE_TOPIC_CHART_YEARS.map((y) => sumRevenueRowsForField(rowsForName, y.field)),
        // Scriptable so it re-resolves (via registerWcThemedChart's
        // chart.update() on theme change) to a dark-mode-legible variant
        // instead of staying fixed at the light-mode hex forever -- see
        // chartColorForTheme.
        backgroundColor: () => chartColorForTheme(baseColors[i])
      }));

      const canvas = document.getElementById(idPrefix + "-" + topicIndex);
      if (!canvas || !datasets.length) return;

      const chart = new Chart(canvas, {
        type: "bar",
        data: { labels: REVENUE_TOPIC_CHART_YEARS.map((y) => y.label), datasets: datasets },
        plugins: [stackedBarRoundingPlugin(6)],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              grid: { display: false },
              ticks: { color: () => wcChartThemeColors().text }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { display: true, color: () => wcChartThemeColors().grid },
              ticks: { color: () => wcChartThemeColors().text, callback: (v) => formatAbbreviatedCurrency(v) }
            }
          },
          // See renderExpenseActivityChart's matching comment -- isolates
          // the hovered bar segment's own tooltip instead of every
          // dataset's value at that x position.
          interaction: { mode: "nearest", intersect: true },
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: "nearest",
              intersect: true,
              callbacks: {
                label: (ctx) => ctx.dataset.label + ": " + formatAbbreviatedCurrency(ctx.parsed.y)
              }
            }
          }
        }
      });
      registerWcThemedChart(chart);

      // Chart.js's built-in bottom legend gets cramped/overlaps once a
      // topic has more than a few revenue codes (e.g. State Fuel Taxes),
      // so render a full, always-visible custom legend list instead.
      const legendEl = document.getElementById(idPrefix + "-" + topicIndex + "-legend");
      if (legendEl) {
        legendEl.innerHTML = datasets.map((d, i) =>
          '<button type="button" class="wc-revenue-chart-legend-item" data-index="' + i + '">' +
          '<span class="wc-revenue-chart-legend-swatch" style="background:' + chartColorForTheme(baseColors[i]) + '"></span>' +
          "<span>" + escapeHtml(d.label) + "</span>" +
          "</button>"
        ).join("");
        onWcThemeChange(() => {
          legendEl.querySelectorAll(".wc-revenue-chart-legend-swatch").forEach((swatch, i) => {
            swatch.style.background = chartColorForTheme(baseColors[i]);
          });
        });

        legendEl.querySelectorAll(".wc-revenue-chart-legend-item").forEach((item) => {
          const i = Number(item.dataset.index);
          item.addEventListener("mouseenter", () => {
            chart.setActiveElements(chart.data.datasets[i].data.map((_, di) => ({ datasetIndex: i, index: di })));
            chart.update();
          });
          item.addEventListener("mouseleave", () => {
            chart.setActiveElements([]);
            chart.update();
          });
          item.addEventListener("click", () => {
            handleChartLegendIsolateClick(chart, legendEl, i);
          });
        });
      }
    });
  }

  function initRevenueTopicCardsPage() {
    const sections = REVENUE_CLASSIFICATION_SECTIONS.filter((s) => document.getElementById(s.containerId));
    if (!sections.length) return;

    sections.forEach((s) => {
      document.getElementById(s.containerId).innerHTML = '<div class="wc-data-loading">' + LOADING_MESSAGE_HTML + "</div>";
    });

    loadBudgetData()
      .then((data) => {
        sections.forEach((s) => {
          const container = document.getElementById(s.containerId);
          if (Object.keys(data.errors || {}).length >= data.datasetCount) {
            container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
            return;
          }
          renderRevenueTopicCards(container, s.topics, "wc-chart-" + s.containerId);
        });
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load revenue topic cards", err);
        sections.forEach((s) => {
          document.getElementById(s.containerId).innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
        });
      });
  }

  // Flags any position whose FTE changed between the prior adopted year
  // (2026) and the proposed year (2027), so the table can call out
  // staffing changes without someone having to write them up by hand.
  function buildStaffingNotes(rows) {
    return rows
      .slice()
      .sort((a, b) => (a.Position_Name || "").localeCompare(b.Position_Name || ""))
      .reduce((notes, r) => {
        const before = r[2026] || 0;
        const after = r[2027] || 0;
        const delta = after - before;
        if (Math.abs(delta) < 1e-9) return notes;
        const verb = delta > 0 ? "Requested" : "Reduced";
        notes.push(
          verb + " " + formatNumber(Math.abs(delta)) + " FTE (" +
          escapeHtml(r.Position_Name || "") + ") in Fiscal Year 2027."
        );
        return notes;
      }, []);
  }

  function renderStaffingGroup(rows, label, forcedOtherMaxFte, extraNotes) {
    const showPrior = getShowPriorYears();
    const years = [2024, 2025, 2026, 2027];
    const priorYears = years.filter((y) => y < 2027);
    const totals = { 2024: 0, 2025: 0, 2026: 0, 2027: 0 };
    const sortedRows = rows
      .slice()
      .sort((a, b) => (a.Position_Name || "").localeCompare(b.Position_Name || ""));

    sortedRows.forEach((r) => {
      years.forEach((y) => { totals[y] += r[y] || 0; });
    });

    const bodyRows = sortedRows.map((r) => {
        const rowClass = (r[2027] || 0) === 0 ? ' class="wc-staffing-zero-current"' : "";
        return (
          "<tr" + rowClass + "><td>" + escapeHtml(r.Position_Name || "") + "</td>" +
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
    // Some constitutional officers (Clerk, Tax Collector, Sheriff,
    // Property Appraiser, Supervisor of Elections) only roll an FTE total
    // up here rather than itemized position-level data they publish
    // elsewhere -- see STAFFING_GROUP_NOTES -- so a static note pointing to
    // that office is appended alongside any auto-generated FTE-change notes.
    const notes = buildStaffingNotes(rows).concat(extraNotes || []);
    const notesHtml = notes.length
      ? '<div class="wc-staffing-notes"><p class="wc-staffing-notes-title">Staffing Notes:</p>' +
        notes.map((n) => "<p>" + n + "</p>").join("") +
        "</div>"
      : "";
    const detailId = "wc-staffing-lines-" + (++budgetLinesDetailCounter);
    // Any position at or below a card-specific FTE threshold is folded
    // into "All Other" on this card's own breakdown regardless of how it'd
    // otherwise rank (e.g. Code Compliance Street folds every 0.5-FTE
    // position, not just a specific named one) -- still counted in the
    // total and listed individually in the "View Position Detail" table
    // below, just not surfaced as its own top-5 line here.
    const rankableRows = forcedOtherMaxFte
      ? sortedRows.filter((r) => (r[2027] || 0) > forcedOtherMaxFte)
      : sortedRows;
    const forcedOtherFte = forcedOtherMaxFte
      ? sortedRows
        .filter((r) => (r[2027] || 0) > 0 && (r[2027] || 0) <= forcedOtherMaxFte)
        .reduce((sum, row) => sum + (row[2027] || 0), 0)
      : 0;
    const activeStaffingRows = rankableRows
      .filter((r) => (r[2027] || 0) !== 0)
      .sort((a, b) => (b[2027] || 0) - (a[2027] || 0));
    const visibleStaffingRows = activeStaffingRows.slice(0, 5);
    const otherStaffingFte = forcedOtherFte + activeStaffingRows
      .slice(5)
      .reduce((sum, row) => sum + (row[2027] || 0), 0);
    if (otherStaffingFte !== 0) {
      visibleStaffingRows.push({ Position_Name: "All Other", 2027: otherStaffingFte });
    }
    const visibleMaxFte = Math.max.apply(null, visibleStaffingRows.map((r) => r[2027] || 0).concat([0]));
    const positionRows = visibleStaffingRows
      .map((r) => {
        const current = r[2027] || 0;
        const width = visibleMaxFte ? Math.max(2, current / visibleMaxFte * 100) : 0;
        return (
          '<div class="wc-finance-card-row">' +
            '<div class="wc-finance-card-row-head">' +
              '<strong>' + escapeHtml(r.Position_Name || "Position") + '</strong>' +
              '<span>' + escapeHtml(formatNumber(current)) + ' FTE</span>' +
            '</div>' +
            '<div class="wc-finance-card-track" aria-hidden="true"><span style="width:' + width.toFixed(2) + '%"></span></div>' +
          '</div>'
        );
      }).join("");
    return (
      '<section class="wc-finance-card wc-staffing-card' + (showPrior ? " show-prior-years" : "") + '">' +
        '<div class="wc-finance-card-head">' +
          '<div>' +
            '<p class="wc-finance-card-kicker">' + escapeHtml(label) + '</p>' +
            '<strong class="wc-finance-card-total">' + escapeHtml(formatNumber(totals[2027])) + '</strong>' +
            '<span class="wc-finance-card-subtitle">FY 2027 Full-Time Equivalent Positions</span>' +
          '</div>' +
        '</div>' +
        '<div class="wc-finance-card-breakdown">' + positionRows + '</div>' +
        '<div class="wc-finance-card-footer">' +
          lastUpdatedNoteHtml() +
          '<button type="button" class="wc-view-budget-lines-toggle" data-target="' + detailId + '" data-closed-label="View Position Detail" data-open-label="Hide Position Detail" aria-expanded="false">View Position Detail</button>' +
        '</div>' +
        notesHtml +
        '<div class="wc-budget-lines-detail wc-budget-lines-card' + (showPrior ? " show-prior-years" : "") + '" id="' + detailId + '" hidden>' +
          priorYearsToggleHtml(showPrior, "wc-budget-lines-detail-header") +
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

  // When a department's staffing rows span more than one distinct Dept_Name
  // (e.g. "Code Compliance" is split into "Code Compliance Street" and
  // "Code Compliance Beach" in the sheet), render one labeled table per
  // sub-unit instead of merging them into a single undifferentiated list.
  // Position names always folded into "All Other" on a specific
  // sub-program's own staffing card, keyed by normalized Dept_Name -- see
  // renderStaffingGroup's forcedOtherPositions.
  const STAFFING_GROUP_FORCED_OTHER_MAX_FTE = {
    "code compliance street": 0.5
  };

  function renderStaffingTable(rows) {
    if (!rows.length) return "";
    const groupNames = uniqueSorted(rows.map((r) => r.Dept_Name || ""));
    if (groupNames.length <= 1) {
      return renderStaffingGroup(rows, "Staffing / FTE", null, STAFFING_GROUP_NOTES[normalizeDeptName(rows[0].Dept_Name || "")]);
    }
    return groupNames
      .map((name) => renderStaffingGroup(
        rows.filter((r) => (r.Dept_Name || "") === name),
        name,
        STAFFING_GROUP_FORCED_OTHER_MAX_FTE[normalizeDeptName(name)],
        STAFFING_GROUP_NOTES[normalizeDeptName(name)]
      ))
      .join("");
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

  function renderSolidWasteSupplementalTables() {
    const franchiseRows = rowsForExactDepartment(cache.expenditures, "Solid Waste")
      .filter((r) => String(r.Object_Code || "").trim() === "534000");
    const transferRows = rowsForExactDepartment(cache.expenditures, "Solid Waste Transfer");
    const pieces = [
      renderTypeSummaryTable(franchiseRows, "expense", "Waste Collection and Disposal Franchise Services", "Solid Waste"),
      renderTypeSummaryTable(transferRows, "expense", "Interfund Transfer", "Solid Waste Transfer")
    ].filter(Boolean);

    if (!pieces.length) return "";
    return '<section class="solid-waste-supplemental-tables">' + pieces.join("") + "</section>";
  }

  function renderBuildingConstructionSupplementalTables() {
    const rows = rowsForExactDepartment(cache.expenditures, "Building Construction and Maintenance");
    const utilityRows = rows.filter((r) => String(r.Object_Code || "").trim() === "543000");
    const piece = renderTypeSummaryTable(utilityRows, "expense", "County-Wide Utilities", "Building Construction and Maintenance");

    if (!piece) return "";
    return '<section class="building-construction-supplemental-tables">' + piece + "</section>";
  }

  function renderBoardOfCountyCommissionersSupplementalTables() {
    const rows = rowsForExactDepartment(cache.expenditures, "BCC Other Uses Contingency");
    const piece = renderTypeSummaryTable(rows, "expense", "Reserves for Contingency", "BCC Other Uses Contingency");
    if (!piece) return "";
    return '<section class="bcc-supplemental-tables">' + piece + "</section>";
  }

  // The Court Innovation FTE (Project 1040) is budgeted under the Board of
  // County Commissioners' Dept_Code rather than its own Dept_Name, and the
  // court-ordinance distributions (Law Library, Juvenile Justice, Legal
  // Aid, Innovative Program) are booked under a "Court Innovations"
  // Dept_Name that shares that same Dept_Code — neither gets picked up by
  // this page's normal Dept_Name alias matching. Both pools fund the same
  // statutory program, so they're combined into one rolled-up table here
  // rather than shown as two separate "Court Innovations" breakdowns.
  function renderCourtInnovationsSupplementalTables() {
    const rows = (cache.expenditures || []).filter(
      (r) =>
        (r.Dept_Code === "00101000" && r.Project_Code === "1040") ||
        normalizeDeptName(r.Dept_Name) === "court innovations"
    );
    const expensePiece = renderTypeSummaryGroup(rows, "expense", "Expenditure Summary");

    // The $65 court cost itself (Additional Court Cost — Law Library,
    // Juvenile Justice, Legal Aid, Innovative Programs) is booked under
    // Dept_Name "Court Innovations" (Dept_Code 001348) in the revenues sheet.
    const revenueRows = (cache.revenues || []).filter(
      (r) => normalizeDeptName(r.Dept_Name) === "court innovations"
    );
    const revenuePiece = renderTypeSummaryGroup(revenueRows, "revenue", "Revenue Summary");

    if (!expensePiece && !revenuePiece) return "";

    const narrativeRows = cache.departmentNarratives || [];
    const narrativeRow = narrativeRows.find((r) => normalizeDeptName(r.Dept_Name) === normalizeDeptName("Court Innovations"));
    const narrativeHtml = narrativeRow && narrativeRow.Narrative
      ? splitIntoParagraphs(narrativeRow.Narrative).map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("")
      : "";

    return (
      '<section class="court-innovations-supplemental-tables statement-of-function content-section">' +
      "<h2>Court Innovations</h2>" +
      narrativeHtml +
      "</section>" +
      '<div class="court-innovations-cards">' +
      expensePiece +
      revenuePiece +
      "</div>"
    );
  }

  // Tourism Administration's page combines five separately budgeted
  // divisions that each have their own rows in the sheets (and, across
  // sheets, sometimes a slightly different spelling of the same division).
  const TOURISM_ADMIN_SECTIONS = [
    {
      label: "Tourism Administration",
      narrativeNames: ["Tourism Administration"],
      expenseNames: ["Tourism Administration"],
      revenueNames: ["Tourist Development Taxes"],
      staffingNames: ["Tourism Administration"],
      machineryNames: []
    },
    {
      label: "Sales and Visitor Center",
      narrativeNames: ["Sales and Visitor Center"],
      expenseNames: ["Sales and Visitors Center"],
      revenueNames: [],
      staffingNames: ["Sales and Visitors Center", "Tourism Sales and Visitors Center"],
      machineryNames: []
    },
    {
      label: "Communications",
      narrativeNames: ["Communications"],
      expenseNames: ["Communications"],
      revenueNames: [],
      staffingNames: ["Communications", "Tourism Communications"],
      machineryNames: []
    },
    {
      label: "Marketing",
      narrativeNames: ["Marketing"],
      expenseNames: ["Marketing"],
      revenueNames: [],
      staffingNames: ["Marketing", "Tourism Marketing"],
      machineryNames: []
    },
    {
      label: "North Walton",
      narrativeNames: ["North Walton"],
      expenseNames: ["North Walton Tourist Development Tax"],
      revenueNames: [],
      staffingNames: [],
      machineryNames: []
    }
  ];

  const TOURISM_ADMIN_OVERVIEW_PARAGRAPHS = [
    "The mission of the Walton County Tourism Department and its divisions is to protect and strengthen the Walton County brand, while enhancing and supporting the tourism economy. As the Destination Marketing Organization responsible for promoting tourism and maintaining the local beaches as a primary attraction, we showcase the diverse attractions of these 16 beach neighborhoods and the rich heritage and natural beauty throughout the county. Through creative marketing, dynamic social media engagement, and close collaboration with meeting planners, Walton County Tourism creates exceptional experiences for all visitors, stimulating visitor spending and bolstering the local economy. In turn, Walton County Tourism uses this revenue to enhance community infrastructure and promote safety initiatives."
  ];

  const TOURISM_ADMIN_HIGHLIGHTS_PARAGRAPHS = [
  "In 2025, 4.5 million visitors came to Walton County, accounting for $3.9 billion in direct spending and generating more than 3.9 million room nights for accommodation partners. These figures, which saw a slight decrease from 2024, represent a $4.7 billion economic impact to Walton County, generating more than $61.4 million in Tourist Development Tax revenues.",
  "Tourism in Walton County supported 29,450 jobs (direct and indirect) and generated more than $1.2 billion in wages and salaries. An additional Walton County job is supported by every 156 visitors. Visitors to Walton County generated a net tax benefit of $60.9 million, saving local residents $1,772 in local taxes per household each year. Visitors to Walton County also accounted for 68% of all retail spending. Walton County Tourism’s marketing efforts supported 65 local events with $500,000 in reimbursable funds through its event grant marketing program.",
  "In 2025, the Visitor Center welcomed 22,917 people and generated $206,582 in branded merchandise sales. Group Sales was responsible for generating 284 meeting and wedding leads for our partners. The sales team actively prospects, networks, makes sales calls and hosts familiarization tours and events in target markets, in addition to participating in travel and trade shows. Communications generated close to $32 million in earned (advertising equivalency) media value in 2025 and circulation/viewership of more than 4.8 billion impressions in 208 press hits across top travel and leisure media placements including publications like Conde Nast Traveler, Modern Luxury, Travel + Leisure, Southern Living and USA Today Travel. They also hosted 8 media visits and multiple desksides in core markets."
];

  function rowsForExactNames(rows, names) {
    const norms = (names || []).map(normalizeDeptName);
    return (rows || []).filter((r) => norms.includes(normalizeDeptName(r.Dept_Name)));
  }

  function renderTourismAdministrationSections() {
    const overview =
      '<section class="content-section tourism-admin-overview">' +
      TOURISM_ADMIN_OVERVIEW_PARAGRAPHS.map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("") +
      "<h3>Highlights</h3>" +
      TOURISM_ADMIN_HIGHLIGHTS_PARAGRAPHS.map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("") +
      "</section>";
    const tourismAdminSpec = TOURISM_ADMIN_SECTIONS.find((spec) => spec.label === "Tourism Administration");
    const tourismAdminRevenue = tourismAdminSpec
      ? renderTypeSummaryTable(
          rowsForExactNames(cache.revenues, tourismAdminSpec.revenueNames),
          "revenue",
          "Revenue Summary",
          tourismAdminSpec.label
        )
      : "";

    // Rendered inside the "Tourism Administration" division's own section,
    // right after its statement-of-function narrative but before its
    // Expenditure Summary card, instead of the page's standalone
    // #department-performance-table container, which would otherwise land
    // after every division's own section -- see DEPTS_WITH_PERFORMANCE_FOLDED_IN.
    const performanceHtml = renderPerformanceTable(getDepartmentPerformanceMeasures("Tourism Administration", ""));

    const sections = TOURISM_ADMIN_SECTIONS.map((spec) => {
      const narrativeRows = rowsForExactNames(cache.departmentNarratives, spec.narrativeNames)
        .filter((r) => r.Narrative && r.Narrative.trim());
      const narrativeHtml = narrativeRows.length
        ? splitIntoParagraphs(narrativeRows[0].Narrative).map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("")
        : "";

      const expenseRows = rowsForExactNames(cache.expenditures, spec.expenseNames);
      const revenueRows = rowsForExactNames(cache.revenues, spec.revenueNames);
      const staffingRows = rowsForExactNames(cache.staffing, spec.staffingNames);
      const body = [
        narrativeHtml,
        spec.label === "Tourism Administration" ? performanceHtml : "",
        renderTypeSummaryTable(expenseRows, "expense", "Expenditure Summary", spec.label),
        spec.label === "Tourism Administration" ? "" : renderTypeSummaryTable(revenueRows, "revenue", "Revenue Summary", spec.label),
        renderStaffingTable(staffingRows)
      ].filter(Boolean).join("");

      if (!body) return "";
      return (
        '<section class="tourism-admin-section">' +
        '<h2 class="tourism-admin-section-title">' + escapeHtml(spec.label) + "</h2>" +
        body +
        "</section>"
      );
    }).filter(Boolean).join("");

    return overview + tourismAdminRevenue + sections;
  }

  // Tourism Beach Operations' page combines three separately budgeted
  // programs. The narrative/performance/staffing sheets call the main
  // program "Tourism Beach Operations" while the expenditure/machinery
  // sheets call it plain "Beach Operations" for the same Dept_Code.
  const TOURISM_BEACH_SECTIONS = [
    {
      label: "Beach Operations",
      narrativeNames: ["Tourism Beach Operations"],
      expenseNames: ["Beach Operations"],
      revenueNames: [],
      staffingNames: ["Tourism Beach Operations"],
      machineryNames: [],
      performanceNames: ["Tourism Beach Operations"]
    },
    {
      label: "Beach Renourishment",
      narrativeNames: ["Beach Renourishment"],
      expenseNames: ["Beach Renourishment"],
      revenueNames: [],
      staffingNames: [],
      machineryNames: []
    },
    {
      label: "Beach Tram",
      narrativeNames: ["Beach Tram"],
      expenseNames: ["Beach Tram"],
      revenueNames: [],
      staffingNames: ["Tourism Beach Tram"],
      machineryNames: []
    }
  ];

  function renderTourismBeachOperationsSections() {
    return TOURISM_BEACH_SECTIONS.map((spec) => {
      const narrativeRows = rowsForExactNames(cache.departmentNarratives, spec.narrativeNames)
        .filter((r) => r.Narrative && r.Narrative.trim());
      const narrativeHtml = narrativeRows.length
        ? splitIntoParagraphs(narrativeRows[0].Narrative).map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("")
        : "";

      const expenseRows = rowsForExactNames(cache.expenditures, spec.expenseNames);
      const revenueRows = rowsForExactNames(cache.revenues, spec.revenueNames);
      const staffingRows = rowsForExactNames(cache.staffing, spec.staffingNames);
      const performanceRows = rowsForExactNames(cache.performanceMeasures, spec.performanceNames || []);

      const body = [
        narrativeHtml,
        renderPerformanceTable(performanceRows),
        renderTypeSummaryTable(expenseRows, "expense", "Expenditure Summary", spec.label),
        renderTypeSummaryTable(revenueRows, "revenue", "Revenue Summary", spec.label),
        renderStaffingTable(staffingRows)
      ].filter(Boolean).join("");

      if (!body) return "";
      return (
        '<section class="tourism-admin-section">' +
        '<h2 class="tourism-admin-section-title">' + escapeHtml(spec.label) + "</h2>" +
        body +
        "</section>"
      );
    }).filter(Boolean).join("");
  }

  // Tourism Lifeguard Services and Beach Safety's page combines two
  // separately budgeted programs, each with their own narrative and
  // expenditure rows in the sheets.
  const TOURISM_LIFEGUARD_SECTIONS = [
    {
      label: "South Walton Fire Lifeguard Services",
      narrativeNames: ["South Walton Fire Lifeguard Services"],
      expenseNames: ["South Walton Fire Lifeguard Services"],
      revenueNames: [],
      staffingNames: [],
      machineryNames: []
    },
    {
      label: "Public Safety",
      narrativeNames: ["Public Safety"],
      expenseNames: ["Public Safety"],
      revenueNames: [],
      staffingNames: [],
      machineryNames: []
    }
  ];

  // The page's narrative container sits beside the map embed in a two-column
  // grid, so only the first program's narrative (no table) renders there;
  // both programs' tables render together, full-width, below the grid.
  function renderTourismLifeguardIntro() {
    const introSpec = TOURISM_LIFEGUARD_SECTIONS[0];
    const narrativeRows = rowsForExactNames(cache.departmentNarratives, introSpec.narrativeNames)
      .filter((r) => r.Narrative && r.Narrative.trim());
    if (!narrativeRows.length) return "";
    return (
      '<section class="statement-of-function content-section">' +
      "<h2>" + escapeHtml(introSpec.label) + "</h2>" +
      splitIntoParagraphs(narrativeRows[0].Narrative).map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("") +
      "</section>"
    );
  }

  function renderTourismLifeguardSections() {
    return TOURISM_LIFEGUARD_SECTIONS.map((spec, index) => {
      // The first program's narrative already renders above (next to the
      // map embed), so only show it again here for any later program.
      const narrativeRows = index === 0
        ? []
        : rowsForExactNames(cache.departmentNarratives, spec.narrativeNames).filter((r) => r.Narrative && r.Narrative.trim());
      const narrativeHtml = narrativeRows.length
        ? splitIntoParagraphs(narrativeRows[0].Narrative).map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("")
        : "";

      const expenseRows = rowsForExactNames(cache.expenditures, spec.expenseNames);
      const revenueRows = rowsForExactNames(cache.revenues, spec.revenueNames);
      const staffingRows = rowsForExactNames(cache.staffing, spec.staffingNames);
      const body = [
        narrativeHtml,
        renderTypeSummaryTable(expenseRows, "expense", "Expenditure Summary", spec.label),
        renderTypeSummaryTable(revenueRows, "revenue", "Revenue Summary", spec.label),
        renderStaffingTable(staffingRows)
      ].filter(Boolean).join("");

      if (!body) return "";
      // The first program's name already heads the page (next to the map
      // embed above), so don't repeat it as a section title here too. Later
      // programs use the same small uppercase heading style as that intro
      // for visual consistency, scoped to its own class so it doesn't
      // affect unrelated paragraphs (table captions, notes) in this section.
      const titleHtml = index === 0 ? "" : '<h2 class="statement-of-function-style-heading">' + escapeHtml(spec.label) + "</h2>";
      return (
        '<section class="tourism-admin-section">' +
        titleHtml +
        body +
        "</section>"
      );
    }).filter(Boolean).join("");
  }

  const COMBINED_SECTION_RENDERERS = {
    "tourism administration": renderTourismAdministrationSections,
    "tourism beach operations": renderTourismBeachOperationsSections
  };

  // Departments whose combined sections (above) already render their own
  // Performance Measures table inline, so the page's standalone
  // performance container should stay empty instead of duplicating it.
  const DEPTS_WITH_PERFORMANCE_FOLDED_IN = new Set(["tourism beach operations", "tourism administration"]);

  function renderMosquitoStateAidTables() {
    const expenseRows = rowsForExactDepartment(cache.expenditures, "Mosquito Control State Aid");
    const revenueRows = rowsForExactDepartment(cache.revenues, "Mosquito Control State Aid");
    const pieces = [
      renderTypeSummaryTable(expenseRows, "expense", "Mosquito Control State Aid Expenditure Summary", "Mosquito Control State Aid"),
      renderTypeSummaryTable(revenueRows, "revenue", "Mosquito Control State Aid Revenue Summary", "Mosquito Control State Aid")
    ].filter(Boolean);

    if (!pieces.length) return "";
    return '<section class="mosquito-state-aid-tables">' + pieces.join("") + "</section>";
  }

  function priorYearsStorageKey(scope) {
    return scope === "performance" ? PERFORMANCE_PRIOR_YEARS_KEY : PRIOR_YEARS_KEY;
  }

  function getShowPriorYears(scope) {
    try {
      return localStorage.getItem(priorYearsStorageKey(scope)) === "1";
    } catch (e) {
      return false;
    }
  }

  function setShowPriorYears(value, scope) {
    try {
      localStorage.setItem(priorYearsStorageKey(scope), value ? "1" : "0");
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
    const showPrior = getShowPriorYears("performance");
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
      '<button type="button" class="wc-fy-column-toggle-button" data-wc-prior-years-scope="performance" aria-expanded="' + (showPrior ? "true" : "false") + '" aria-label="' + (showPrior ? "Hide prior years" : "View prior years") + '">' +
      '<span class="wc-fy-column-toggle-indicator" aria-hidden="true">' + (showPrior ? "✓" : "") + "</span>" +
      '<span class="wc-fy-column-toggle-text">' + (showPrior ? "Hide Prior Years" : "View Prior Years") + "</span>" +
      "</button>" +
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

  function priorYearsScopeForCheckbox(checkbox) {
    if (!checkbox) return "budget";
    return checkbox.getAttribute("data-wc-prior-years-scope") ||
      (checkbox.closest(".wc-performance-card") ? "performance" : "budget");
  }

  function priorYearsScopeForToggle(toggle) {
    if (!toggle) return "budget";
    return toggle.getAttribute("data-wc-prior-years-scope") ||
      (toggle.closest(".wc-performance-card") ? "performance" : "budget");
  }

  function syncPriorYearsToggle(toggle, checked) {
    if (!toggle) return;
    if (toggle.matches(".wc-fy-column-toggle-checkbox")) {
      toggle.checked = checked;
      toggle.setAttribute("aria-label", checked ? "Hide prior years" : "View prior years");
      return;
    }
    toggle.setAttribute("aria-expanded", checked ? "true" : "false");
    toggle.setAttribute("aria-label", checked ? "Hide prior years" : "View prior years");
    const indicator = toggle.querySelector(".wc-fy-column-toggle-indicator");
    if (indicator) indicator.textContent = checked ? "✓" : "";
    const text = toggle.querySelector(".wc-fy-column-toggle-text");
    if (text) text.textContent = checked ? "Hide Prior Years" : "View Prior Years";
  }

  function applyPriorYearsState(checked, container, scope) {
    const root = container || document;
    const priorScope = scope || "budget";
    const cardSelector = priorScope === "performance" ? ".wc-performance-card" : ".wc-staffing-card, .wc-budget-lines-card";
    if (root.classList && root.matches(cardSelector)) {
      root.classList.toggle("show-prior-years", checked);
    }
    root.querySelectorAll(cardSelector).forEach((card) => {
      card.classList.toggle("show-prior-years", checked);
    });
    root.querySelectorAll('.wc-fy-column-toggle-checkbox[data-wc-prior-years-scope="' + priorScope + '"]').forEach((cb) => {
      syncPriorYearsToggle(cb, checked);
    });
    root.querySelectorAll('.wc-fy-column-toggle-button[data-wc-prior-years-scope="' + priorScope + '"]').forEach((button) => {
      syncPriorYearsToggle(button, checked);
    });
  }

  function bindPriorYearsToggle(container) {
    if (!container) return;
    container.querySelectorAll(".wc-fy-column-toggle-button").forEach((button) => {
      if (button.getAttribute("data-wc-prior-years-bound") === "true") return;
      button.setAttribute("data-wc-prior-years-bound", "true");
      button.addEventListener("click", () => {
        const checked = button.getAttribute("aria-expanded") !== "true";
        const scope = priorYearsScopeForToggle(button);
        setShowPriorYears(checked, scope);
        applyPriorYearsState(checked, null, scope);
      });
    });
    container.querySelectorAll(".wc-fy-column-toggle-checkbox").forEach((checkbox) => {
      if (checkbox.getAttribute("data-wc-prior-years-bound") === "true") return;
      checkbox.setAttribute("data-wc-prior-years-bound", "true");
      checkbox.addEventListener("change", () => {
        const checked = checkbox.checked;
        const scope = priorYearsScopeForCheckbox(checkbox);
        setShowPriorYears(checked, scope);
        applyPriorYearsState(checked, null, scope);
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

    // "Court Innovations" gets its own dedicated section further down the
    // page (next to the Project 1040 budget it funds), so it's excluded
    // here to avoid showing that narrative twice.
    if (normalizeDeptName(deptName) === "court technology and innovations") {
      const rows = rowsForDepartment(cache.departmentNarratives, deptName, deptCode)
        .filter((r) => r.Narrative && r.Narrative.trim() && normalizeDeptName(r.Dept_Name) !== "court innovations");
      const seen = new Set();
      const filteredParagraphs = [];
      rows.forEach((r) => {
        const text = r.Narrative.trim();
        if (!seen.has(text)) {
          seen.add(text);
          filteredParagraphs.push(...splitIntoParagraphs(text));
        }
      });
      if (!filteredParagraphs.length) {
        container.innerHTML = "";
        container.hidden = true;
        return;
      }
      container.innerHTML =
        '<section class="statement-of-function content-section">' +
        "<h2>Court Technology - Court Administration</h2>" +
        filteredParagraphs.map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("") +
        "</section>";
      return;
    }

    if (normalizeDeptName(deptName) === "libraries") {
      const introParagraphs = paragraphs.slice(0, 2);
      const remainingParagraphs = paragraphs.slice(2);
      container.innerHTML =
        '<section class="statement-of-function content-section libraries-statement-media">' +
        "<h2>Statement of Function</h2>" +
        '<div class="libraries-statement-intro">' +
        introParagraphs.map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("") +
        "</div>" +
        '<div class="libraries-statement-lower">' +
        '<div class="libraries-statement-rest">' +
        remainingParagraphs.map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("") +
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
      paragraphs.map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("") +
      "</section>";
  }

  function showLoadingState(containers) {
    const first = containers.find(Boolean);
    if (first) {
      first.hidden = false;
      first.innerHTML = '<div class="wc-data-loading">' + LOADING_MESSAGE_HTML + "</div>";
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

  function arrangeDepartmentFinancialDashboard(expenseEl, revenueEl, staffingEl, supplementalExpenseEls, deptName) {
    const supplementalEls = supplementalExpenseEls || [];
    const cards = [expenseEl].concat(supplementalEls, [revenueEl, staffingEl]).filter((el) =>
      el && !el.hidden && el.innerHTML.trim()
    );
    if (!cards.length) return;
    let grid = document.querySelector(".wc-department-financial-grid");
    if (!grid) {
      grid = document.createElement("section");
      grid.className = "wc-department-financial-grid";
      cards[0].parentNode.insertBefore(grid, cards[0]);
    }
    cards.forEach((card) => grid.appendChild(card));

    // Departments with multiple sub-programs (distinct Dept_Name values,
    // e.g. Code Compliance / Code Compliance Beach) render one stacked
    // card per sub-program inside the expense and revenue mounts
    // independently -- a sub-program with no revenue rows means the two
    // mounts end up with a different number of stacked cards. CSS Grid
    // stretches paired cells in the same row to match the taller one,
    // which otherwise inflates the shorter mount's card with a large
    // empty gap before its footer. Opt mismatched mounts out of that
    // stretch so each card just keeps its own natural height.
    const expenseCardCount = expenseEl ? expenseEl.querySelectorAll(".wc-finance-card").length : 0;
    const revenueCardCount = revenueEl ? revenueEl.querySelectorAll(".wc-finance-card").length : 0;
    if (expenseEl) expenseEl.classList.toggle("wc-financial-mount-natural-height", expenseCardCount !== revenueCardCount);
    if (revenueEl) revenueEl.classList.toggle("wc-financial-mount-natural-height", expenseCardCount !== revenueCardCount);
  }

  // Object_Type (case/whitespace normalized) is how a expense category
  // row is identified as Capital Outlay vs. everything else (recurring)
  // -- see renderFinancialDashboardCard's Recurring/Non-Recurring YoY
  // Change labels.
  function normalizeObjectTypeForYoy(value) {
    return String(value || "").trim().toLowerCase();
  }

  function initDepartmentPage() {
    const ids = [
      "department-narrative",
      "department-performance-table",
      "department-expense-table",
      "department-revenue-table",
      "department-staffing-table",
      "department-machinery-table",
      "department-state-aid-tables",
      "department-solid-waste-tables",
      "department-building-construction-tables",
      "department-bcc-tables",
      "department-court-innovations-tables",
      "department-fund-schedule"
    ];
    const containers = ids.map((id) => document.getElementById(id));
    if (!containers.some(Boolean)) return;
    document.body.classList.add("wc-department-financial-dashboard");

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
        const [narrativeEl, performanceEl, expenseEl, revenueEl, staffingEl, machineryEl, stateAidEl, solidWasteEl, buildingConstructionEl, bccEl, courtInnovationsEl, fundScheduleEl] = containers;

        // Some pages combine several separately budgeted divisions; for
        // those, narrative/expenditures/revenue/staffing/machinery (and,
        // for Beach Operations, performance measures) are grouped together
        // into one block per division rather than spread across the page's
        // per-data-type containers.
        const combinedSectionsRenderer = COMBINED_SECTION_RENDERERS[normalizeDeptName(deptName)];
        const performanceFoldedIntoSections = DEPTS_WITH_PERFORMANCE_FOLDED_IN.has(normalizeDeptName(deptName));

        mountOrHide(
          performanceEl,
          performanceFoldedIntoSections ? "" : renderPerformanceTable(getDepartmentPerformanceMeasures(deptName, deptCode))
        );
        bindPriorYearsToggle(performanceEl);

        if (combinedSectionsRenderer) {
          mountOrHide(narrativeEl, combinedSectionsRenderer());
          bindTooltipAnchors(narrativeEl);
          bindPriorYearsToggle(narrativeEl);
          mountOrHide(expenseEl, "");
          mountOrHide(revenueEl, "");
          mountOrHide(staffingEl, "");
          mountOrHide(machineryEl, "");
          mountOrHide(stateAidEl, "");
          mountOrHide(solidWasteEl, "");
          mountOrHide(buildingConstructionEl, "");
          mountOrHide(bccEl, "");
          mountOrHide(courtInnovationsEl, "");
          mountOrHide(fundScheduleEl, "");
          return;
        }

        // Tourism Lifeguard Services and Beach Safety's narrative container
        // sits beside a map embed in a two-column grid, so only the first
        // program's narrative goes there; both programs' expense tables
        // render together, full-width, in the expense container below it.
        if (normalizeDeptName(deptName) === "tourism lifeguard services and beach safety") {
          mountOrHide(narrativeEl, renderTourismLifeguardIntro());
          mountOrHide(expenseEl, renderTourismLifeguardSections());
          bindTooltipAnchors(expenseEl);
          bindPriorYearsToggle(expenseEl);
          mountOrHide(revenueEl, "");
          mountOrHide(staffingEl, "");
          mountOrHide(machineryEl, "");
          mountOrHide(stateAidEl, "");
          mountOrHide(solidWasteEl, "");
          mountOrHide(buildingConstructionEl, "");
          mountOrHide(bccEl, "");
          mountOrHide(courtInnovationsEl, "");
          mountOrHide(fundScheduleEl, "");
          return;
        }

        renderDepartmentNarrative(narrativeEl, deptName, deptCode);

        // Statutory & Other Agency Funding is scattered across many
        // unrelated Dept_Names (Economic Development Alliance, Human
        // Services, Lakeview, Volunteer Fire, etc.), so it's pulled
        // together by its shared Note value instead of by Dept_Name. Each
        // row's Project_Name (e.g. "Lakeview Center (Mental Health)")
        // identifies the specific agency/program, so that's used as the
        // "Itemized Description" in the budget lines detail instead of
        // the Note column (which is just "Statutory & Other" on every row).
        let expenseHtml;
        if (normalizeDeptName(deptName) === "statutory and other agency funding") {
          const statutoryRows = (cache.expenditures || []).filter((r) => (r.Note || "").trim() === "Statutory & Other");
          expenseHtml = renderTypeSummaryGroup(statutoryRows, "expense", "Expenditure Summary", null, "Project_Name");
        } else {
          // Some departments break specific object codes out into their own
          // supplemental table below; exclude those codes here to avoid
          // double-counting them in the main Expenditure Summary.
          const excludedObjectCodes = EXPENSE_OBJECT_CODES_BROKEN_OUT[normalizeDeptName(deptName)] || [];
          // The Court Innovation FTE (Project 1040) is booked under the Board
          // of County Commissioners' Dept_Name/Dept_Code, but it's shown on
          // the Court Innovations rollup instead, so it's excluded here to
          // avoid double-counting it on the BCC page.
          const isBcc = normalizeDeptName(deptName) === "board of county commissioners";
          const expenseRows = getDepartmentExpenses(deptName, deptCode).filter(
            (r) =>
              !excludedObjectCodes.includes(String(r.Object_Code || "").trim()) &&
              !(isBcc && String(r.Project_Code || "").trim() === "1040")
          );
          expenseHtml = renderTypeSummaryTable(expenseRows, "expense", "Expenditure Summary", deptName);
        }
        mountOrHide(expenseEl, expenseHtml);
        bindTooltipAnchors(expenseEl);
        bindPriorYearsToggle(expenseEl);

        mountOrHide(
          revenueEl,
          renderTypeSummaryTable(getDepartmentRevenues(deptName, deptCode), "revenue", "Revenue Summary", deptName)
        );
        bindTooltipAnchors(revenueEl);
        bindPriorYearsToggle(revenueEl);

        mountOrHide(staffingEl, renderStaffingTable(getDepartmentStaffing(deptName, deptCode)));
        bindPriorYearsToggle(staffingEl);
        mountOrHide(machineryEl, "");
        mountOrHide(
          stateAidEl,
          normalizeDeptName(deptName) === "mosquito control" ? renderMosquitoStateAidTables() : ""
        );
        bindTooltipAnchors(stateAidEl);

        mountOrHide(
          solidWasteEl,
          normalizeDeptName(deptName) === "solid waste" ? renderSolidWasteSupplementalTables() : ""
        );
        bindTooltipAnchors(solidWasteEl);
        bindPriorYearsToggle(solidWasteEl);

        mountOrHide(
          buildingConstructionEl,
          normalizeDeptName(deptName) === "building construction and maintenance"
            ? renderBuildingConstructionSupplementalTables()
            : ""
        );
        bindTooltipAnchors(buildingConstructionEl);
        bindPriorYearsToggle(buildingConstructionEl);

        mountOrHide(
          bccEl,
          normalizeDeptName(deptName) === "board of county commissioners"
            ? renderBoardOfCountyCommissionersSupplementalTables()
            : ""
        );
        bindTooltipAnchors(bccEl);
        bindPriorYearsToggle(bccEl);

        mountOrHide(
          courtInnovationsEl,
          normalizeDeptName(deptName) === "court technology and innovations"
            ? renderCourtInnovationsSupplementalTables()
            : ""
        );
        bindTooltipAnchors(courtInnovationsEl);
        bindPriorYearsToggle(courtInnovationsEl);

        const fundCode = getFundCodeFromPage();
        mountOrHide(
          fundScheduleEl,
          fundCode ? buildFundFinancialSchedule([fundCode], deptName) : ""
        );
        bindPriorYearsToggle(fundScheduleEl);

        arrangeDepartmentFinancialDashboard(expenseEl, revenueEl, staffingEl, [
          solidWasteEl,
          buildingConstructionEl,
          bccEl
        ], deptName);
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

  // Summary of Machinery, Vehicles & Equipment: a department picker instead
  // of one long scrolling list of every item across every department.
  function renderMachinerySummary(container) {
    if (!container) return;
    const rows = cache.machinery || [];
    if (!rows.length) {
      container.innerHTML = '<div class="wc-data-empty">No machinery, vehicles &amp; equipment data is available.</div>';
      return;
    }

    const departments = uniqueSorted(rows.map((r) => r.Dept_Name));

    container.innerHTML =
      '<div class="wc-filter-bar wc-machinery-picker">' +
      '<label class="wc-filter-field"><span>Department</span>' +
      '<select id="wcMachineryDeptSelect"><option value="">All</option>' +
      departments.map((d) => '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + "</option>").join("") +
      "</select></label>" +
      "</div>" +
      '<div class="wc-financial-summary-table"></div>';

    const select = container.querySelector("#wcMachineryDeptSelect");
    const tableEl = container.querySelector(".wc-financial-summary-table");

    function showDepartment(deptName) {
      const items = deptName
        ? rows.filter((r) => r.Dept_Name === deptName)
        : rows.slice().sort((a, b) => String(a.Dept_Name || "").localeCompare(String(b.Dept_Name || "")));
      const total = items.reduce((s, r) => s + (r.Amount || 0), 0);
      const showDeptColumn = !deptName;

      const bodyRows = items.map((r) =>
        "<tr>" +
        (showDeptColumn ? "<td>" + escapeHtml(r.Dept_Name || "") + "</td>" : "") +
        "<td>" + escapeHtml(r.Item_Description || "") + '</td><td class="wc-num">' + formatCurrency(r.Amount || 0) + "</td></tr>"
      );
      bodyRows.push(
        '<tr class="wc-table-total-row"><td' + (showDeptColumn ? ' colspan="2"' : "") + ">Total</td><td class=\"wc-num\">" + formatCurrency(total) + "</td></tr>"
      );

      const columns = showDeptColumn
        ? [{ label: "Department" }, { label: "Item Description" }, { label: "Amount", num: true }]
        : [{ label: "Item Description" }, { label: "Amount", num: true }];

      mountOrHide(
        tableEl,
        renderTable({
          caption: deptName || "All Departments",
          columns: columns,
          bodyRows: bodyRows
        })
      );
    }

    select.addEventListener("change", () => showDepartment(select.value));
    showDepartment("");
  }

  function initMachinerySummaryPage() {
    const container = document.getElementById("machinery-summary");
    if (!container) return;

    container.innerHTML = '<div class="wc-data-loading">' + LOADING_MESSAGE_HTML + "</div>";

    loadBudgetData()
      .then((data) => {
        if (Object.keys(data.errors || {}).length >= data.datasetCount) {
          container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
          return;
        }
        renderMachinerySummary(container);
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load machinery summary", err);
        container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
      });
  }

  // Summary of Personnel: same department-picker pattern as the machinery
  // summary. "All" shows each department's total FTE per year; selecting
  // one department drills into its position-level staffing table.
  function fundNameForRow(row) {
    const code = fundCodeForRow(row);
    const fund = (cache.funds || []).find((f) => f.Fund_Code === code);
    return fund ? fund.Fund_Name : "Constitutional Offices";
  }

  // Engineering moved from the General Fund to the Transportation Fund
  // starting FY2027 (see DEPT_CODE_ACTUALS_ALIASES' comment above) -- the
  // budget figures reflect that via a brand new FY2027 Dept_Code
  // (10116002, naturally fund 101) while the legacy code (00120000, fund
  // 001) keeps holding its real FY2020-FY2026 history. The staffing sheet
  // has no such split: every position is still booked under the one
  // legacy 00120000 row regardless of year, so without this override its
  // FY2027 headcount would land on the General Fund's own Personnel
  // callout/filter instead of Transportation's. Scoped to
  // personnelFundLabelForRow specifically (not fundNameForRow itself,
  // which Summary of Interfund Transfers also uses for expenditure/
  // revenue rows where this Dept_Code has no special meaning).
  function fundNameForStaffingRow(row) {
    if (String((row && row.Dept_Code) || "").trim() === "00120000") return "Transportation Fund";
    return fundNameForRow(row);
  }

  // Summary of Personnel's "at a glance" FTE callouts: the constitutional
  // officers whose own staffing rows carry no Dept_Code (so they'd
  // otherwise get lumped into one undifferentiated catch-all) broken out
  // individually, then one callout per actual fund for every other row --
  // grouped dynamically by fundNameForRow rather than a fixed list, so
  // nothing ends up unbroken-out in a generic "All Remaining" bucket.
  // Board of County Commissioners and Circuit Court are General Fund
  // departments (confirmed by their expenditure rows) but get their own
  // named callouts here too, same as the constitutional officers, rather
  // than folding into the General Fund (Board Departments) card -- their
  // own staffing rows carry the same blank Dept_Code the officers' do, so
  // without a named group they'd otherwise have nowhere distinct to land.
  const PERSONNEL_NAMED_CALLOUT_GROUPS = [
    { label: "Board of County Commissioners", match: (r) => normalizeDeptName(r.Dept_Name) === "board of county commissioners" },
    { label: "Circuit Court", match: (r) => normalizeDeptName(r.Dept_Name) === "circuit court" },
    { label: "Clerk of Court", match: (r) => normalizeDeptName(r.Dept_Name) === "clerk of circuit court" },
    { label: "Tax Collector", match: (r) => normalizeDeptName(r.Dept_Name) === "tax collector" },
    { label: "Property Appraiser", match: (r) => normalizeDeptName(r.Dept_Name) === "property appraiser" },
    { label: "Supervisor of Elections", match: (r) => normalizeDeptName(r.Dept_Name) === "supervisor of elections" },
    { label: "Sheriff Fund", match: (r) => normalizeDeptName(r.Dept_Name) === "sheriff" }
  ];

  // Code Compliance's two sub-programs read fine as their own staffing
  // cards on the department's own page (see renderStaffingTable), but on
  // the Summary of Personnel all-departments schedule they should roll up
  // into one "Code Compliance" line instead of splitting across two rows.
  function personnelDeptDisplayName(deptName) {
    const norm = normalizeDeptName(deptName);
    if (norm === "code compliance beach" || norm === "code compliance street") return "Code Compliance";
    return deptName;
  }

  // One label per staffing row -- the single source of truth for both the
  // callout cards above and the page's own "Fund" filter dropdown, so every
  // callout card corresponds to exactly one selectable filter option (and
  // vice versa) instead of the two drifting apart.
  function personnelFundLabelForRow(row) {
    const group = PERSONNEL_NAMED_CALLOUT_GROUPS.find((g) => g.match(row));
    if (group) return group.label;
    const fundName = fundNameForStaffingRow(row);
    // Board of County Commissioners and Circuit Court (named groups above)
    // already cover the General Fund's non-department rows, so the plain
    // "General Fund" fund-name match here is exclusively the rest of the
    // Board Departments -- relabeled to match departments.html's own
    // "General Fund (Board Departments)" card.
    return fundName === "General Fund" ? "General Fund (Board Departments)" : fundName;
  }

  // The Summary of Personnel all-departments table's per-department
  // "View Positions" detail -- same hidden-detail-div + delegated
  // .wc-view-budget-lines-toggle click handling already used for "View
  // Budget Lines"/"View Position Detail" elsewhere (see
  // openBudgetDetailModal), just scoped to one department's own position
  // list instead of a department page's own staffing card.
  function personnelDeptDetailHtml(deptRows, deptName) {
    budgetLinesDetailCounter += 1;
    const detailId = "wc-personnel-dept-detail-" + budgetLinesDetailCounter;
    const years = [2024, 2025, 2026, 2027];
    const priorYears = years.filter((y) => y < 2027);
    const showPriorLocal = getShowPriorYears();
    const sortedPositions = deptRows
      .slice()
      .sort((a, b) => (a.Position_Name || "").localeCompare(b.Position_Name || ""));
    const totals = { 2024: 0, 2025: 0, 2026: 0, 2027: 0 };
    const bodyRows = sortedPositions.map((r) => {
      years.forEach((y) => { totals[y] += r[y] || 0; });
      const rowClass = (r[2027] || 0) === 0 ? ' class="wc-staffing-zero-current"' : "";
      return (
        "<tr" + rowClass + "><td>" + escapeHtml(r.Position_Name || "") + "</td>" +
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
    // Same "contact the office" note shown on these constitutional
    // officers' own staffing cards (see STAFFING_GROUP_NOTES) -- repeated
    // here since this modal is the only place their position list is
    // surfaced on the all-departments Summary of Personnel schedule.
    const extraNotes = STAFFING_GROUP_NOTES[normalizeDeptName(deptName || "")] || [];
    const notesHtml = extraNotes.length
      ? '<div class="wc-staffing-notes"><p class="wc-staffing-notes-title">Staffing Notes:</p>' +
        extraNotes.map((n) => "<p>" + n + "</p>").join("") +
        "</div>"
      : "";
    const detailHtml =
      '<div class="wc-budget-lines-detail wc-budget-lines-card' + (showPriorLocal ? " show-prior-years" : "") + '" id="' + detailId + '" hidden>' +
        priorYearsToggleHtml(showPriorLocal, "wc-budget-lines-detail-header") +
        '<div class="wc-data-table-scroll">' +
        '<table class="wc-data-table wc-staffing-table">' +
        "<thead><tr><th>Position Name</th>" +
        priorYears.map((y) => '<th class="wc-num wc-prior-year">FY ' + y + "</th>").join("") +
        '<th class="wc-num">FY 2027</th>' +
        "</tr></thead><tbody>" + bodyRows.join("") + "</tbody></table></div>" +
        notesHtml +
      "</div>";
    return { detailId, detailHtml };
  }

  // Shared by the Summary of Personnel page's own callout row and the
  // Financials directory's "Summary of Personnel" link card (see
  // financials.html), so both stay in sync with one grouping definition.
  // Sorted largest to smallest so the biggest funds/offices read first.
  function getPersonnelFundCallouts(rows) {
    const totalsByLabel = new Map();
    rows.forEach((r) => {
      const label = personnelFundLabelForRow(r);
      totalsByLabel.set(label, (totalsByLabel.get(label) || 0) + (Number(r[2027]) || 0));
    });
    const callouts = [];
    totalsByLabel.forEach((total, label) => callouts.push({ label, total }));
    return callouts.sort((a, b) => b.total - a.total);
  }

  function renderPersonnelFundCallouts(rows) {
    const callouts = getPersonnelFundCallouts(rows);
    return (
      '<div class="wc-personnel-fund-stats">' +
      callouts.map((c) =>
        '<button type="button" class="wc-personnel-fund-stat" data-personnel-fund-filter="' + escapeHtml(c.label) + '">' +
        "<strong>" + formatNumber(c.total) + "</strong><span>" + escapeHtml(c.label) + "</span></button>"
      ).join("") +
      "</div>"
    );
  }

  function renderPersonnelSummary(container) {
    if (!container) return;
    const rows = cache.staffing || [];
    if (!rows.length) {
      container.innerHTML = '<div class="wc-data-empty">No personnel data is available.</div>';
      return;
    }

    const departments = uniqueSorted(rows.map((r) => r.Dept_Name));
    // Matches the callout cards above one-for-one -- see
    // personnelFundLabelForRow -- so every card is also a selectable Fund
    // filter option, not just a static display.
    const fundNames = uniqueSorted(rows.map((r) => personnelFundLabelForRow(r)));
    const years = [2024, 2025, 2026, 2027];

    container.innerHTML =
      renderPersonnelFundCallouts(rows) +
      '<div class="wc-filter-bar wc-machinery-picker">' +
      '<label class="wc-filter-field"><span>Department</span>' +
      '<select id="wcPersonnelDeptSelect"><option value="">All</option>' +
      departments.map((d) => '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + "</option>").join("") +
      "</select></label>" +
      '<label class="wc-filter-field"><span>Fund</span>' +
      '<select id="wcPersonnelFundSelect"><option value="">All</option>' +
      fundNames.map((f) => '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + "</option>").join("") +
      "</select></label>" +
      '<button type="button" class="wc-view-budget-lines-toggle" id="wcPersonnelSortToggle" aria-pressed="false">Sort: Largest to Smallest</button>' +
      "</div>" +
      '<div class="wc-financial-summary-table"></div>';

    const deptSelect = container.querySelector("#wcPersonnelDeptSelect");
    const fundSelect = container.querySelector("#wcPersonnelFundSelect");
    const sortToggle = container.querySelector("#wcPersonnelSortToggle");
    const tableEl = container.querySelector(".wc-financial-summary-table");
    let sortByFte = false;

    function applyFilters() {
      const deptName = deptSelect.value;
      const fundName = fundSelect.value;
      const filtered = rows.filter((r) =>
        (!deptName || r.Dept_Name === deptName) && (!fundName || personnelFundLabelForRow(r) === fundName)
      );

      if (!filtered.length) {
        tableEl.hidden = false;
        tableEl.innerHTML = '<div class="wc-data-empty">No positions match the current filters.</div>';
        return;
      }

      if (deptName) {
        mountOrHide(tableEl, renderStaffingTable(filtered));
        bindPriorYearsToggle(tableEl);
        return;
      }

      const totalsByDept = new Map();
      const rowsByDept = new Map();
      filtered.forEach((r) => {
        // Code Compliance's two sub-programs (Code Compliance Beach/Street)
        // are shown as their own staffing cards on the department's own
        // page, but on this all-departments schedule they should read as
        // one "Code Compliance" line rather than split across two rows.
        const name = personnelDeptDisplayName(r.Dept_Name);
        if (!totalsByDept.has(name)) {
          totalsByDept.set(name, { 2024: 0, 2025: 0, 2026: 0, 2027: 0 });
          rowsByDept.set(name, []);
        }
        const t = totalsByDept.get(name);
        years.forEach((y) => { t[y] += r[y] || 0; });
        rowsByDept.get(name).push(r);
      });
      const deptsInView = sortByFte
        ? Array.from(totalsByDept.keys()).sort((a, b) => totalsByDept.get(b)[2027] - totalsByDept.get(a)[2027])
        : uniqueSorted(Array.from(totalsByDept.keys()));
      const grand = { 2024: 0, 2025: 0, 2026: 0, 2027: 0 };
      totalsByDept.forEach((t) => years.forEach((y) => { grand[y] += t[y]; }));

      // Each department name is a "View Positions" toggle, opening the
      // same budget-detail modal used for "View Budget Lines" elsewhere
      // (see openBudgetDetailModal) with that department's own position
      // list instead of leaving users stuck at the department-level total.
      const detailMarkup = [];
      const bodyRows = deptsInView.map((d) => {
        const t = totalsByDept.get(d);
        const { detailId, detailHtml } = personnelDeptDetailHtml(rowsByDept.get(d), d);
        detailMarkup.push(detailHtml);
        return (
          "<tr><td>" +
          '<button type="button" class="wc-view-budget-lines-toggle wc-table-row-link" data-target="' + detailId + '" data-closed-label="' + escapeHtml(d) + '" aria-expanded="false">' +
          escapeHtml(d) + "</button>" +
          "</td>" +
          years.map((y) => '<td class="wc-num">' + formatNumber(t[y]) + "</td>").join("") +
          "</tr>"
        );
      });
      bodyRows.push(
        '<tr class="wc-table-total-row"><td>Total FTE</td>' +
        years.map((y) => '<td class="wc-num">' + formatNumber(grand[y]) + "</td>").join("") +
        "</tr>"
      );

      mountOrHide(
        tableEl,
        renderTable({
          caption: fundName || "All Departments",
          columns: [{ label: "Department" }].concat(years.map((y) => ({ label: "FY " + y, num: true }))),
          bodyRows: bodyRows
        }) + detailMarkup.join("")
      );
    }

    deptSelect.addEventListener("change", applyFilters);
    fundSelect.addEventListener("change", applyFilters);
    sortToggle.addEventListener("click", () => {
      sortByFte = !sortByFte;
      sortToggle.textContent = sortByFte ? "Sort: A to Z" : "Sort: Largest to Smallest";
      sortToggle.setAttribute("aria-pressed", String(sortByFte));
      applyFilters();
    });
    const calloutButtons = container.querySelectorAll("[data-personnel-fund-filter]");
    function syncActiveCallout() {
      calloutButtons.forEach((button) => {
        button.classList.toggle("is-active", !deptSelect.value && button.dataset.personnelFundFilter === fundSelect.value);
      });
    }
    fundSelect.addEventListener("change", syncActiveCallout);
    deptSelect.addEventListener("change", syncActiveCallout);
    calloutButtons.forEach((button) => {
      button.addEventListener("click", () => {
        deptSelect.value = "";
        fundSelect.value = button.dataset.personnelFundFilter;
        applyFilters();
        syncActiveCallout();
        tableEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });

    // Arriving from a Financials directory callout link (?fund=...) lands
    // pre-filtered to that fund, same as clicking the matching card here
    // would -- see personnelCalloutsHtml in financials.html.
    let requestedFund = "";
    try {
      requestedFund = new URLSearchParams(window.location.search).get("fund") || "";
    } catch (e) {
      requestedFund = "";
    }
    if (requestedFund && fundNames.includes(requestedFund)) {
      fundSelect.value = requestedFund;
    }

    applyFilters();
    syncActiveCallout();
  }

  // A free-text note shown below the Summary of Personnel schedule, sourced
  // from the Narratives sheet's "Summary of Personnel Note" Dept_Name row
  // (same sheet/column used for department narratives elsewhere) rather
  // than hardcoded on the page.
  function renderPersonnelSummaryNote() {
    const narrativeRows = cache.departmentNarratives || [];
    const row = narrativeRows.find((r) => normalizeDeptName(r.Dept_Name) === normalizeDeptName("Summary of Personnel Note"));
    if (!row || !row.Narrative || !row.Narrative.trim()) return "";
    return (
      '<section class="wc-personnel-summary-note content-section">' +
      splitIntoParagraphs(row.Narrative).map((p) => "<p>" + formatNarrativeText(p) + "</p>").join("") +
      "</section>"
    );
  }

  function initPersonnelSummaryPage() {
    const container = document.getElementById("personnel-summary");
    if (!container) return;
    const notesContainer = document.getElementById("personnel-summary-notes");

    container.innerHTML = '<div class="wc-data-loading">' + LOADING_MESSAGE_HTML + "</div>";

    loadBudgetData()
      .then((data) => {
        if (Object.keys(data.errors || {}).length >= data.datasetCount) {
          container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
          return;
        }
        renderPersonnelSummary(container);
        mountOrHide(notesContainer, renderPersonnelSummaryNote());
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load personnel summary", err);
        container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
      });
  }

  function initFinancialSummaryPage() {
    const container = document.getElementById("financial-summary");
    if (!container) return;
    const type = container.dataset.summaryType === "revenues" ? "revenues" : "expenses";

    container.innerHTML = '<div class="wc-data-loading">' + LOADING_MESSAGE_HTML + "</div>";

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

  function initConsolidatedFundTableContainer(containerId, renderFn, errorContext, onMounted) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="wc-data-loading">' + LOADING_MESSAGE_HTML + "</div>";

    loadBudgetData()
      .then((data) => {
        if (Object.keys(data.errors || {}).length >= data.datasetCount) {
          container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
          return;
        }
        container.innerHTML = renderFn();
        if (onMounted) onMounted(container);
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load " + errorContext, err);
        container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
      });
  }

  function initConsolidatedFundTablesPage() {
    initConsolidatedFundTableContainer("consolidated-revenue-budget-table", renderConsolidatedRevenueBudgetTable, "consolidated revenue budget");
    initConsolidatedFundTableContainer("consolidated-expenditure-budget-table", renderConsolidatedExpenditureBudgetTable, "consolidated expenditure budget");
  }

  function initFinancialForecastPage() {
    const container = document.getElementById("financial-forecast");
    if (!container) return;
    container.innerHTML = '<div class="wc-data-loading">' + LOADING_MESSAGE_HTML + "</div>";

    Promise.all([
      loadBudgetData(),
      window.wcCipProjectsReady || Promise.resolve(window.wcCipProjects || [])
    ])
      .then(([data, cipProjects]) => {
        if (Object.keys(data.errors || {}).length >= data.datasetCount) {
          container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
          return;
        }
        container.innerHTML = renderFinancialForecast(cipProjects);
      })
      .catch((err) => {
        console.error("WCBudgetData: failed to load financial forecast", err);
        container.innerHTML = '<div class="wc-data-error">' + escapeHtml(ERROR_MESSAGE) + "</div>";
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initDepartmentPage();
    initFinancialSummaryPage();
    initConsolidatedFundTablesPage();
    initMachinerySummaryPage();
    initPersonnelSummaryPage();
    initInterfundTransfersPage();
    initConsolidatedRevenueSummaryPage();
    initRevenueTopicCardsPage();
    initFundFinancialSchedulesPage();
    initConsolidatedExpenseSummaryPage();
    initExpenseActivityChartsPage();
    initFinancialForecastPage();
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
    renderFilterControls,
    renderConsolidatedRevenueBudgetTable,
    renderConsolidatedExpenditureBudgetTable,
    renderMachinerySummary,
    renderPersonnelSummary,
    getPersonnelFundCallouts,
    renderInterfundTransfersOutTable,
    renderInterfundTransfersInTable,
    renderConsolidatedRevenueSummaryTable,
    renderRevenueTopicCards,
    renderFinancialForecast
  };
})();
