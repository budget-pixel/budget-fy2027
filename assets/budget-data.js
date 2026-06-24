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
    "court technology and innovations": [
      "court technology court administration",
      "court technology state attorney",
      "court technology public defender",
      "court technology innovations",
      "court innovations",
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
      "communications",
      "marketing",
      "north walton",
      "north walton tourist development tax"
    ],
    "tourism beach operations": [
      "beach operations",
      "beach renourishment",
      "beach tram"
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
    "building construction and maintenance": ["562000", "563000", "543000"],
    "board of county commissioners": ["531001", "531002", "531003", "531004"]
  };

  // Friendlier display captions for sub-group tables whose raw Dept_Name
  // in the sheet reads awkwardly on its own.
  const DEPT_NAME_DISPLAY_OVERRIDES = {};

  // Explanatory notes shown under a sub-group's Expenditure Summary table,
  // in the same italic callout style as the staffing notes.
  const EXPENSE_GROUP_NOTES = {
    "public safety": [
      "Under Florida Statutes §125.0104(5)(c), eligible counties may allocate up to 10% of Tourist Development Tax revenues to reimburse public safety expenses necessitated by increased tourism and visitor impacts."
    ],
    "south walton fire": [
      "The rise in the budget is attributed to contractual obligations, specifically, the contractual provision for incremental adjustments within the agreement with the South Walton Fire District, tied to the Consumer Price Index Municipal Class Size D - South, calculated from April of the preceding year to April of the current year."
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
  // Engineering (now 10116002) has its actuals/FY2026 budget booked under
  // legacy code 00120000.
  const DEPT_CODE_ACTUALS_ALIASES = {
    "00117000": ["00117010", "00117020", "10117000"],
    "10116002": ["00120000"]
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

  function normalizeActivityRow(row) {
    return {
      Dept_Code: (row.Dept_Code || "").trim(),
      Dept_Name: (row.Dept_Name || "").trim(),
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
  function fundCodeForRow(row) {
    return String((row && row.Dept_Code) || "").trim().slice(0, 3);
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
        cache.expenditures = applyActualsToRows(cache.expenditures, actuals.expenseRows);
        cache.revenues = applyActualsToRows(cache.revenues, actuals.revenueRows);
        cache.expenditures = applyOriginalBudgetToRows(cache.expenditures, actuals.originalBudgetRows);
        cache.revenues = applyOriginalBudgetToRows(cache.revenues, actuals.originalBudgetRows);
      }

      cache.machinery = buildMachineryRowsFromExpenditures(cache.expenditures);

      return cache;
    });

    return loadPromise;
  }

  // ---- rendering primitives ----

  function priorYearsToggleHtml(showPrior, extraWrapClass, scope) {
    const priorScope = scope || "budget";
    const label =
      '<label class="wc-fy-column-toggle-label">' +
      '<input type="checkbox" class="wc-fy-column-toggle-checkbox" data-wc-prior-years-scope="' + escapeHtml(priorScope) + '" aria-label="View Prior Years" ' +
      (showPrior ? "checked" : "") + " />" +
      '<span class="wc-fy-column-toggle-text">View Prior Years</span>' +
      "</label>";
    return '<div class="wc-fy-column-toggle-wrap' + (extraWrapClass ? " " + extraWrapClass : "") + '">' + label + "</div>";
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

  function renderBudgetLinesToggle(rows, descriptionField, kind, combineByName) {
    if (!rows || !rows.length) return { button: "", detail: "" };
    budgetLinesDetailCounter += 1;
    const detailId = "wc-budget-lines-" + budgetLinesDetailCounter;
    const isExpense = kind !== "revenue";
    // See PRIOR_YEARS_DISABLED_REVENUE_DEPT_NAMES. Guarded to
    // combineByName === false since this should only apply to the
    // department's own single-page breakdown, not a county-wide summary
    // (those keep the toggle -- see isRevenueContextNoteSuppressed below,
    // which removes just the disclaimer for them, not the toggle itself).
    const isPriorYearsDisabledRevenue = !isExpense && !combineByName && rows.length &&
      PRIOR_YEARS_DISABLED_REVENUE_DEPT_NAMES.has(normalizeDeptName(rows[0].Dept_Name));
    // The "View Prior Years" preference is a single, page-wide localStorage
    // value shared by every table (see getShowPriorYears), so it isn't
    // enough to just hide this table's own checkbox -- showPrior has to be
    // forced false here too, or toggling it on anywhere else on the page
    // would still expand this table's prior-year columns.
    const showPrior = isPriorYearsDisabledRevenue ? false : getShowPriorYears();
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

    function budgetLineRowsHtml(rowsToRender, rowClass, suppressDescription) {
      return rowsToRender
      .slice()
      .sort((a, b) => String(a[codeField] || "").localeCompare(String(b[codeField] || "")))
      .map((r) => {
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
            return '<td class="wc-num wc-prior-year">' +
              (href ? '<a class="wc-actual-drilldown-link" href="' + escapeHtml(href) + '">' + value + "</a>" : value) +
              "</td>";
          }).join("") +
          '<td class="wc-num">' + formatCurrency(r.FY2027_Proposed || 0) + "</td></tr>"
        );
      });
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

    const toggleHeader = isPriorYearsDisabledRevenue ? "" : priorYearsToggleHtml(showPrior, "wc-budget-lines-detail-header");
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
    const isRevenueContextNoteSuppressed = isPriorYearsDisabledRevenue || combineByName;
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

  function lastUpdatedNoteHtml() {
    const stamp = new Date().toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" });
    return '<p class="wc-data-updated-note"><em>Last Updated: ' + escapeHtml(stamp) + "</em></p>";
  }

  function renderTable(options) {
    const columns = options.columns || [];
    const bodyRows = options.bodyRows || [];
    if (!bodyRows.length) return "";
    const captionHtml = options.caption ? '<p class="wc-table-label">' + escapeHtml(options.caption) + "</p>" : "";
    const headerHtml = options.toggleHtml
      ? '<div class="wc-table-label-row">' + captionHtml + options.toggleHtml + "</div>"
      : captionHtml;
    return (
      '<div class="wc-data-table-wrap">' +
      headerHtml +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table">' +
      "<thead><tr>" +
      columns.map((c) => {
        const classes = (c.num ? ["wc-num"] : []).concat(c.classes || []);
        return '<th class="' + classes.join(" ") + '">' + escapeHtml(c.label) + "</th>";
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
    const sortedRows = rows
      .slice()
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    const nonZeroRows = sortedRows.filter((row) => (row.amount || 0) !== 0);
    const visibleRows = nonZeroRows.slice(0, 3);
    const rowCountClass = " wc-finance-card-rows-" + Math.max(visibleRows.length, 0);
    const itemHtml = visibleRows.map((row) => {
      const amount = row.amount || 0;
      const percent = total ? Math.abs(amount) / Math.abs(total) * 100 : 0;
      const width = total ? Math.max(percent, amount ? 2 : 0) : 0;
      const isZero = amount === 0;
      return (
        '<div class="wc-finance-card-row' + (isZero ? " is-zero" : "") + '">' +
          '<div class="wc-finance-card-row-head">' +
            '<strong>' + escapeHtml(row.label || "Other") + '</strong>' +
            '<span>' + escapeHtml(percent.toFixed(percent >= 10 ? 0 : 1)) + '%</span>' +
          '</div>' +
          '<div class="wc-finance-card-track" aria-hidden="true">' +
            '<span style="width:' + width.toFixed(2) + '%"></span>' +
          '</div>' +
          '<div class="wc-finance-card-amount">' + escapeHtml(formatCurrency(amount)) + '</div>' +
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
  function renderTypeSummaryGroup(rows, kind, caption, notes, descriptionField) {
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

    const showPrior = getShowPriorYears();
    const detail = renderBudgetLinesToggle(rows, descriptionField, kind);
    if (detail.button && !isExpense) {
      detail.button = detail.button
        .replace('data-closed-label="View Budget Lines"', 'data-closed-label="View Revenue Lines"')
        .replace('data-open-label="Hide Budget Lines"', 'data-open-label="Hide Revenue Lines"')
        .replace("View Budget Lines", "View Revenue Lines");
    }
    const cardRows = Array.from(totalsByType.entries()).map(([type, totals]) => ({
      label: type,
      amount: totals.FY2027_Proposed || 0
    }));

    return renderFinancialDashboardCard({
      caption,
      kind,
      rows: cardRows,
      total: grandTotals.FY2027_Proposed || 0,
      showPrior,
      detail,
      notes: isExpense ? notes : null
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
    const norm = normalizeDeptName(deptName || "");
    return groupNames
      .map((name) => {
        const nameNorm = normalizeDeptName(name);
        const groupCaption = nameNorm === norm ? caption : (DEPT_NAME_DISPLAY_OVERRIDES[nameNorm] || name);
        const notes = nameNorm === norm ? null : EXPENSE_GROUP_NOTES[nameNorm];
        return renderTypeSummaryGroup(rows.filter((r) => (r.Dept_Name || "") === name), kind, groupCaption, notes);
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
    { key: "Charges for Services", label: "Charges for Services" },
    { key: "General Government Taxes", label: "General Government Taxes" },
    { key: "Intergovernmental Revenues", label: "Intergovernmental Revenues" },
    { key: "Judgments, Fines and Forfeits", label: "Judgments, Fines and Forfeits" },
    { key: "Miscellaneous Revenue", label: "Miscellaneous Revenue" },
    { key: "Other Sources", label: "Other Sources" },
    { key: "Permits Fees and Special Assessments", label: "Permits, Fees, and Special Assessments" }
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
      // Expense rows are summed directly, same as the Consolidated Expense
      // Summary -- no extra cross-Dept_Name dedup here. Some departments
      // legitimately share one Dept_Code+Object_Code across several
      // distinct rows (e.g. Statutory & Other's many recipients, each its
      // own Project_Code/amount), and a generic fund+code dedup can't tell
      // those apart from a true duplicate (e.g. Code Compliance / Code
      // Compliance Beach both carrying the same undivided account total),
      // so it ends up stripping out legitimate amounts along with the
      // real duplicates. Matching the Consolidated page's plain-sum
      // behavior keeps this table consistent with the schedule the county
      // already treats as correct.
      const shouldDedupeRevenue = rows === revenueRows && isActualOrBudgetField;
      const seenAmounts = shouldDedupeRevenue ? new Set() : null;
      return rows.reduce((sum, r) => {
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
      return (
        "<tr" + (rowClass ? ' class="' + rowClass + '"' : "") + "><td>" + escapeHtml(label) + "</td>" +
        values.map((v, i) =>
          '<td class="wc-num' + (i < values.length - 1 ? " wc-prior-year" : "") + '">' + formatCurrency(v) + "</td>"
        ).join("") +
        "</tr>"
      );
    }

    const isOtherFinancingRevenue = (r) => String(r.Revenue_Code || "").trim() === "381000";
    const isOtherFinancingExpense = isOtherFinancingExpenseRow;

    const bodyRows = [];

    const beginningValues = FUND_SCHEDULE_YEAR_COLUMNS.map((c) => fundBalanceForYear(fundCodes, fiscalYearForField(c.field) - 1));
    bodyRows.push(rowHtml("Beginning Fund Balance", beginningValues, "wc-table-subtotal-row"));

    bodyRows.push(
      '<tr class="wc-table-group-row"><td>Revenues</td>' +
      FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => '<td class="' + (i < FUND_SCHEDULE_YEAR_COLUMNS.length - 1 ? "wc-prior-year" : "") + '"></td>').join("") + "</tr>"
    );
    const revenueTypeRows = CONSOLIDATED_REVENUE_TYPE_ROWS
      .map((spec) => ({ label: spec.label, values: rowValues((r) => r.Revenue_Type === spec.key && !isOtherFinancingRevenue(r), revenueRows) }))
      .sort((a, b) => b.values[b.values.length - 1] - a.values[a.values.length - 1]);
    const generalGovTaxesRow = revenueTypeRows.find((row) => row.label === "General Government Taxes");
    if (generalGovTaxesRow) {
      const fy2026Index = FUND_SCHEDULE_YEAR_COLUMNS.findIndex((c) => c.field === "FY2026_Original_Budget");
      if (fy2026Index !== -1) {
        generalGovTaxesRow.values[fy2026Index] += adValoremFivePercentReductionForFunds(fundCodes);
      }
    }
    revenueTypeRows.forEach((row) => bodyRows.push(rowHtml(row.label, row.values)));
    const revenueTypeValues = revenueTypeRows.map((row) => row.values);
    const revenueSubtotalValues = FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => revenueTypeValues.reduce((s, v) => s + v[i], 0));
    bodyRows.push(rowHtml("Total Revenues", revenueSubtotalValues, "wc-table-subtotal-row"));

    const otherSourcesValues = rowValues(isOtherFinancingRevenue, revenueRows);
    bodyRows.push(rowHtml("Other Financial Sources", otherSourcesValues));
    const revenueTotalValues = revenueSubtotalValues.map((v, i) => v + otherSourcesValues[i]);
    bodyRows.push(rowHtml("Total Revenue and Other Financial Sources", revenueTotalValues, "wc-table-total-row"));

    bodyRows.push(
      '<tr class="wc-table-group-row"><td>Expenditures</td>' +
      FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => '<td class="' + (i < FUND_SCHEDULE_YEAR_COLUMNS.length - 1 ? "wc-prior-year" : "") + '"></td>').join("") + "</tr>"
    );
    const expenseTypeRows = CONSOLIDATED_EXPENDITURE_ACTIVITY_ROWS
      .map((activity) => ({ label: activity, values: rowValues((r) => expenseActivityForRow(r) === activity && !isOtherFinancingExpense(r), expenseRows) }))
      .sort((a, b) => b.values[b.values.length - 1] - a.values[a.values.length - 1]);
    expenseTypeRows.forEach((row) => bodyRows.push(rowHtml(row.label, row.values)));
    const expenseTypeValues = expenseTypeRows.map((row) => row.values);
    const expenseSubtotalValues = FUND_SCHEDULE_YEAR_COLUMNS.map((c, i) => expenseTypeValues.reduce((s, v) => s + v[i], 0));
    bodyRows.push(rowHtml("Expenditures Total", expenseSubtotalValues, "wc-table-subtotal-row"));

    const otherUsesValues = rowValues(isOtherFinancingExpense, expenseRows);
    bodyRows.push(rowHtml("Other Financial Uses", otherUsesValues));
    const expenseTotalValues = expenseSubtotalValues.map((v, i) => v + otherUsesValues[i]);
    bodyRows.push(rowHtml("Total Expenditures and Other Financial Uses", expenseTotalValues, "wc-table-total-row"));

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
      '<div class="wc-table-label-row">' +
      '<p class="wc-table-label">' + escapeHtml(caption) + "</p>" +
      priorYearsToggleHtml(showPrior) +
      "</div>" +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table">' +
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
    { type: "Intergovernmental Revenues", label: "Intergovernmental Revenues" },
    { type: "Miscellaneous Revenue", label: "Miscellaneous Revenue" },
    { type: "Other Sources", label: "Other Sources" },
    { type: "Charges for Services", label: "Charges for Services" },
    { type: "Permits Fees and Special Assessments", label: "Permits, Fees, and Special Assessments" },
    { type: "Judgments, Fines and Forfeits", label: "Judgments, Fines and Forfeits" }
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

    const bodyRows = CONSOLIDATED_REVENUE_SUMMARY_ROWS.map((spec) => {
      // Revenue_Code 381000 (Interfund Group Transfer In) is reported on
      // the Summary of Interfund Transfers page instead, and the
      // Self-Insurance Fund (503) is an Internal Service fund rather than
      // a governmental one, so both are excluded here.
      const matching = rows.filter((r) =>
        r.Revenue_Type === spec.type &&
        String(r.Revenue_Code || "").trim() !== "381000" &&
        !CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r))
      );
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
    const rows = (cache.expenditures || []).filter((r) =>
      !CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r)) &&
      !isOtherFinancingExpenseRow(r)
    );
    if (!rows.length) return "";

    const lastIndex = CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.length - 1;
    const totals = CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map(() => 0);
    const allMatchingRows = [];
    const bodyRows = EXPENSE_ACTIVITY_SECTIONS.map((section) => {
      const activityNorm = section.activity.toLowerCase();
      const matching = rows.filter((r) => expenseActivityForRow(r).toLowerCase() === activityNorm);
      allMatchingRows.push(...matching);
      return (
        "<tr><td>" + escapeHtml(section.title || section.activity) + "</td>" +
        CONSOLIDATED_REVENUE_SUMMARY_COLUMNS.map((col, i) => {
          const sum = matching.reduce((s, r) => s + (r[col.field] || 0), 0);
          totals[i] += sum;
          return '<td class="wc-num' + (i < lastIndex ? " wc-prior-year" : "") + '">' + formatCurrency(sum) + "</td>";
        }).join("") +
        "</tr>"
      );
    });
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
      renderExpenseDepartmentBudgetLinesFooter(allMatchingRows) +
      "</div>"
    );
  }

  // The Consolidated Expense Summary's "View Budget Lines" detail shows
  // department-level subtotals (with each department's category) rather
  // than individual object-code lines, since the visible table above is
  // already rolled up to the 8 broad categories.
  function renderExpenseDepartmentBudgetLinesFooter(rows) {
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

    const sumFields = BUDGET_LINE_PRIOR_YEAR_COLUMNS.map((c) => c.field).concat(["FY2027_Proposed"]);
    const byDept = new Map();
    rows.forEach((r) => {
      const name = r.Dept_Name || "Unknown";
      if (!byDept.has(name)) {
        const entry = { Dept_Name: name, activity: expenseActivityForRow(r) };
        sumFields.forEach((f) => { entry[f] = 0; });
        byDept.set(name, entry);
      }
      const entry = byDept.get(name);
      sumFields.forEach((f) => { entry[f] += r[f] || 0; });
    });

    const deptRows = Array.from(byDept.values()).sort((a, b) => {
      const ai = activityIndex(a.activity);
      const bi = activityIndex(b.activity);
      if (ai !== bi) return ai - bi;
      return a.Dept_Name.localeCompare(b.Dept_Name);
    });

    const bodyRows = deptRows.map((d) => {
      const isZeroCurrent = (d.FY2027_Proposed || 0) === 0;
      return (
        "<tr" + (isZeroCurrent ? ' class="wc-budget-line-zero-current"' : "") + ">" +
        "<td>" + escapeHtml(activityLabel(d.activity)) + "</td>" +
        "<td>" + escapeHtml(d.Dept_Name) + "</td>" +
        BUDGET_LINE_PRIOR_YEAR_COLUMNS.map((c) =>
          '<td class="wc-num wc-prior-year">' + formatCurrency(d[c.field] || 0) + "</td>"
        ).join("") +
        '<td class="wc-num">' + formatCurrency(d.FY2027_Proposed || 0) + "</td></tr>"
      );
    });
    const totals = {};
    sumFields.forEach((field) => {
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

  // One narrative banner + full-width stacked-bar chart (grouped by
  // contributing department) per expense Activity classification.
  function renderExpenseActivityChart(container, section, idPrefix) {
    if (!container) return;
    const expenseRows = cache.expenditures || [];
    const activityNorm = section.activity.toLowerCase();

    container.innerHTML =
      '<div class="wc-expense-activity-chart-card">' +
      '<div class="wc-expense-activity-chart-wrap"><canvas id="' + idPrefix + '"></canvas></div>' +
      '<div class="wc-revenue-chart-legend" id="' + idPrefix + '-legend"></div>' +
      lastUpdatedNoteHtml() +
      "</div>";

    if (typeof Chart === "undefined") return;

    const byDept = new Map();
    expenseRows
      .filter((r) =>
        expenseActivityForRow(r).toLowerCase() === activityNorm &&
        !CONSOLIDATED_SCHEDULE_EXCLUDED_FUND_CODES.has(fundCodeForRow(r))
      )
      .forEach((r) => {
        const name = r.Dept_Name || "Unknown";
        if (!byDept.has(name)) byDept.set(name, []);
        byDept.get(name).push(r);
      });

    const datasets = Array.from(byDept.entries()).map(([name, rowsForName], i) => ({
      label: name,
      data: REVENUE_TOPIC_CHART_YEARS.map((y) => rowsForName.reduce((s, r) => s + (r[y.field] || 0), 0)),
      backgroundColor: REVENUE_TOPIC_CHART_COLORS[i % REVENUE_TOPIC_CHART_COLORS.length],
      borderRadius: 6,
      borderSkipped: false
    }));

    const canvas = document.getElementById(idPrefix);
    if (!canvas || !datasets.length) return;

    const chart = new Chart(canvas, {
      type: "bar",
      data: { labels: REVENUE_TOPIC_CHART_YEARS.map((y) => y.label), datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { display: true },
            ticks: { callback: (v) => formatAbbreviatedCurrency(v) }
          }
        },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": " + formatAbbreviatedCurrency(ctx.parsed.y)
            }
          }
        }
      }
    });

    const legendEl = document.getElementById(idPrefix + "-legend");
    if (legendEl) {
      legendEl.innerHTML = datasets.map((d, i) =>
        '<button type="button" class="wc-revenue-chart-legend-item" data-index="' + i + '">' +
        '<span class="wc-revenue-chart-legend-swatch" style="background:' + d.backgroundColor + '"></span>' +
        "<span>" + escapeHtml(d.label) + "</span>" +
        "</button>"
      ).join("");

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
          const meta = chart.getDatasetMeta(i);
          meta.hidden = meta.hidden === null ? !chart.data.datasets[i].hidden : !meta.hidden;
          item.classList.toggle("is-hidden", !!meta.hidden);
          chart.update();
        });
      });
    }
  }

  function initExpenseActivityChartsPage() {
    const sections = EXPENSE_ACTIVITY_SECTIONS.filter((s) => document.getElementById(s.containerId));
    if (!sections.length) return;

    sections.forEach((s) => {
      document.getElementById(s.containerId).innerHTML = '<div class="wc-data-loading">' + escapeHtml(LOADING_MESSAGE) + "</div>";
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
    const remainder = { title: "Intergovernmental Revenue", narrativeKey: "Intergovernmental Revenue", matches: remainderOfType("Intergovernmental Revenues", siblings) };
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
        { title: "Ad Valorem Taxes", narrativeKey: "Property Tax", matches: byRevenueCodes(["311000", "311001"]) },
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
    { field: "FY2026_Budget", label: "FY 2026 Budget" },
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

    return rows.reduce((sum, row) => {
      return sum + (row[field] || 0);
    }, 0);
  }

  function renderRevenueTopicCards(container, topics, idPrefix) {
    if (!container) return;
    const revenueRows = cache.revenues || [];
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

      const datasets = Array.from(byName.entries()).map(([name, rowsForName], i) => ({
        label: name,
        data: REVENUE_TOPIC_CHART_YEARS.map((y) => sumRevenueRowsForField(rowsForName, y.field)),
        backgroundColor: REVENUE_TOPIC_CHART_COLORS[i % REVENUE_TOPIC_CHART_COLORS.length],
        borderRadius: 6,
        borderSkipped: false
      }));

      const canvas = document.getElementById(idPrefix + "-" + topicIndex);
      if (!canvas || !datasets.length) return;

      const chart = new Chart(canvas, {
        type: "bar",
        data: { labels: REVENUE_TOPIC_CHART_YEARS.map((y) => y.label), datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: {
              stacked: true,
              beginAtZero: true,
              grid: { display: true },
              ticks: { callback: (v) => formatAbbreviatedCurrency(v) }
            }
          },
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: "index",
              intersect: false,
              callbacks: {
                label: (ctx) => ctx.dataset.label + ": " + formatAbbreviatedCurrency(ctx.parsed.y)
              }
            }
          }
        }
      });

      // Chart.js's built-in bottom legend gets cramped/overlaps once a
      // topic has more than a few revenue codes (e.g. State Fuel Taxes),
      // so render a full, always-visible custom legend list instead.
      const legendEl = document.getElementById(idPrefix + "-" + topicIndex + "-legend");
      if (legendEl) {
        legendEl.innerHTML = datasets.map((d, i) =>
          '<button type="button" class="wc-revenue-chart-legend-item" data-index="' + i + '">' +
          '<span class="wc-revenue-chart-legend-swatch" style="background:' + d.backgroundColor + '"></span>' +
          "<span>" + escapeHtml(d.label) + "</span>" +
          "</button>"
        ).join("");

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
            const meta = chart.getDatasetMeta(i);
            meta.hidden = meta.hidden === null ? !chart.data.datasets[i].hidden : !meta.hidden;
            item.classList.toggle("is-hidden", !!meta.hidden);
            chart.update();
          });
        });
      }
    });
  }

  function initRevenueTopicCardsPage() {
    const sections = REVENUE_CLASSIFICATION_SECTIONS.filter((s) => document.getElementById(s.containerId));
    if (!sections.length) return;

    sections.forEach((s) => {
      document.getElementById(s.containerId).innerHTML = '<div class="wc-data-loading">' + escapeHtml(LOADING_MESSAGE) + "</div>";
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

  function renderStaffingGroup(rows, label) {
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
    const notes = buildStaffingNotes(rows);
    const notesHtml = notes.length
      ? '<div class="wc-staffing-notes"><p class="wc-staffing-notes-title">Staffing Notes:</p>' +
        notes.map((n) => "<p>" + n + "</p>").join("") +
        "</div>"
      : "";
    const detailId = "wc-staffing-lines-" + (++budgetLinesDetailCounter);
    const activeStaffingRows = sortedRows
      .filter((r) => (r[2027] || 0) !== 0)
      .sort((a, b) => (b[2027] || 0) - (a[2027] || 0));
    const visibleStaffingRows = activeStaffingRows.slice(0, 5);
    const otherStaffingFte = activeStaffingRows
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
  function renderStaffingTable(rows) {
    if (!rows.length) return "";
    const groupNames = uniqueSorted(rows.map((r) => r.Dept_Name || ""));
    if (groupNames.length <= 1) {
      return renderStaffingGroup(rows, "Staffing / FTE");
    }
    return groupNames
      .map((name) => renderStaffingGroup(rows.filter((r) => (r.Dept_Name || "") === name), name))
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
    const parksRows = rows.filter((r) => ["562000", "563000"].includes(String(r.Object_Code || "").trim()));
    const utilityRows = rows.filter((r) => String(r.Object_Code || "").trim() === "543000");
    const pieces = [
      renderTypeSummaryTable(parksRows, "expense", "Parks, Recreation, and Public Facilities Capital Program", "Building Construction and Maintenance"),
      renderTypeSummaryTable(utilityRows, "expense", "County-Wide Utilities", "Building Construction and Maintenance")
    ].filter(Boolean);

    if (!pieces.length) return "";
    return '<section class="building-construction-supplemental-tables">' + pieces.join("") + "</section>";
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
    // Dept_Name "Court Innovation" (singular) in the revenues sheet.
    const revenueRows = (cache.revenues || []).filter(
      (r) => normalizeDeptName(r.Dept_Name) === "court innovation"
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
      expensePiece +
      revenuePiece
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
      staffingNames: ["Sales and Visitors Center"],
      machineryNames: []
    },
    {
      label: "Communications",
      narrativeNames: ["Communications"],
      expenseNames: ["Communications"],
      revenueNames: [],
      staffingNames: ["Communications"],
      machineryNames: []
    },
    {
      label: "Marketing",
      narrativeNames: ["Marketing"],
      expenseNames: ["Marketing"],
      revenueNames: [],
      staffingNames: ["Marketing"],
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

    return overview + sections;
  }

  // Tourism Beach Operations' page combines three separately budgeted
  // programs. The narrative/performance sheets call the main program
  // "Tourism Beach Operations" while the expenditure/staffing/machinery
  // sheets call it plain "Beach Operations" for the same Dept_Code.
  const TOURISM_BEACH_SECTIONS = [
    {
      label: "Beach Operations",
      narrativeNames: ["Tourism Beach Operations"],
      expenseNames: ["Beach Operations"],
      revenueNames: [],
      staffingNames: ["Beach Operations"],
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
      staffingNames: ["Beach Tram"],
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
  const DEPTS_WITH_PERFORMANCE_FOLDED_IN = new Set(["tourism beach operations"]);

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
      '<label class="wc-fy-column-toggle-label">' +
      '<input type="checkbox" class="wc-fy-column-toggle-checkbox" data-wc-prior-years-scope="performance" aria-label="View Prior Years" ' +
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

  function priorYearsScopeForCheckbox(checkbox) {
    if (!checkbox) return "budget";
    return checkbox.getAttribute("data-wc-prior-years-scope") ||
      (checkbox.closest(".wc-performance-card") ? "performance" : "budget");
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

  function arrangeDepartmentFinancialDashboard(expenseEl, revenueEl, staffingEl, supplementalExpenseEls) {
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
      "department-court-innovations-tables"
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
        const [narrativeEl, performanceEl, expenseEl, revenueEl, staffingEl, machineryEl, stateAidEl, solidWasteEl, buildingConstructionEl, bccEl, courtInnovationsEl] = containers;

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

        arrangeDepartmentFinancialDashboard(expenseEl, revenueEl, staffingEl, [
          solidWasteEl,
          buildingConstructionEl,
          bccEl
        ]);
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

    container.innerHTML = '<div class="wc-data-loading">' + escapeHtml(LOADING_MESSAGE) + "</div>";

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

  function renderPersonnelSummary(container) {
    if (!container) return;
    const rows = cache.staffing || [];
    if (!rows.length) {
      container.innerHTML = '<div class="wc-data-empty">No personnel data is available.</div>';
      return;
    }

    const departments = uniqueSorted(rows.map((r) => r.Dept_Name));
    const fundNames = uniqueSorted(rows.map((r) => fundNameForRow(r)));
    const years = [2024, 2025, 2026, 2027];

    container.innerHTML =
      '<div class="wc-filter-bar wc-machinery-picker">' +
      '<label class="wc-filter-field"><span>Department</span>' +
      '<select id="wcPersonnelDeptSelect"><option value="">All</option>' +
      departments.map((d) => '<option value="' + escapeHtml(d) + '">' + escapeHtml(d) + "</option>").join("") +
      "</select></label>" +
      '<label class="wc-filter-field"><span>Fund</span>' +
      '<select id="wcPersonnelFundSelect"><option value="">All</option>' +
      fundNames.map((f) => '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + "</option>").join("") +
      "</select></label>" +
      "</div>" +
      '<div class="wc-financial-summary-table"></div>';

    const deptSelect = container.querySelector("#wcPersonnelDeptSelect");
    const fundSelect = container.querySelector("#wcPersonnelFundSelect");
    const tableEl = container.querySelector(".wc-financial-summary-table");

    function applyFilters() {
      const deptName = deptSelect.value;
      const fundName = fundSelect.value;
      const filtered = rows.filter((r) =>
        (!deptName || r.Dept_Name === deptName) && (!fundName || fundNameForRow(r) === fundName)
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

      const deptsInView = uniqueSorted(filtered.map((r) => r.Dept_Name));
      const totalsByDept = new Map();
      deptsInView.forEach((d) => totalsByDept.set(d, { 2024: 0, 2025: 0, 2026: 0, 2027: 0 }));
      filtered.forEach((r) => {
        const t = totalsByDept.get(r.Dept_Name);
        years.forEach((y) => { t[y] += r[y] || 0; });
      });
      const grand = { 2024: 0, 2025: 0, 2026: 0, 2027: 0 };
      totalsByDept.forEach((t) => years.forEach((y) => { grand[y] += t[y]; }));

      const bodyRows = deptsInView.map((d) => {
        const t = totalsByDept.get(d);
        return "<tr><td>" + escapeHtml(d) + "</td>" + years.map((y) => '<td class="wc-num">' + formatNumber(t[y]) + "</td>").join("") + "</tr>";
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
        })
      );
    }

    deptSelect.addEventListener("change", applyFilters);
    fundSelect.addEventListener("change", applyFilters);
    applyFilters();
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

    container.innerHTML = '<div class="wc-data-loading">' + escapeHtml(LOADING_MESSAGE) + "</div>";

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

  function initConsolidatedFundTableContainer(containerId, renderFn, errorContext, onMounted) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="wc-data-loading">' + escapeHtml(LOADING_MESSAGE) + "</div>";

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
    renderInterfundTransfersOutTable,
    renderInterfundTransfersInTable,
    renderConsolidatedRevenueSummaryTable,
    renderRevenueTopicCards
  };
})();
