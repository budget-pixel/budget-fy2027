/* Walton County FY 2027 Budget — Supabase actuals data layer.
   Google Sheets remains the source for budget/publication rows, labels,
   descriptions, FY 2026 budget, FY 2027 proposed, and page narrative content.
   Supabase public views provide FY 2020-FY 2025 historical actuals.
   Cache tables stay internal in Supabase and are not queried by browser code.
   Raw transaction data must not load on page startup; transaction drilldown
   should be lazy-loaded only for a specific year/org/object/project request.
   Use a Supabase publishable/anon key only; never place a service-role key in
   this public static website. */
(function () {
  "use strict";

  const SUPABASE_URL = "https://gxsfkvzexfpctaiozqrb.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_94LmtSpqQZCvjeyQa9BYVQ__b-Rgj8L";

  let supabaseClient = null;
  let warnedAboutConfig = false;
  const SUPABASE_PAGE_SIZE = 1000;

  function hasSupabaseConfig() {
    return (
      SUPABASE_URL &&
      SUPABASE_PUBLISHABLE_KEY &&
      SUPABASE_URL !== "REPLACE_WITH_SUPABASE_PROJECT_URL" &&
      SUPABASE_PUBLISHABLE_KEY !== "REPLACE_WITH_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  function getClient() {
    if (!hasSupabaseConfig()) {
      if (!warnedAboutConfig) {
        console.warn(
          "WCSupabaseData: Supabase URL/key placeholders are not configured; using Google Sheets historical actual fallbacks."
        );
        warnedAboutConfig = true;
      }
      return null;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.error("WCSupabaseData: Supabase client library is not available.");
      return null;
    }

    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    }

    return supabaseClient;
  }

  async function loadSummaryRows(viewName) {
    const client = getClient();
    if (!client) return [];

    const rows = [];
    let from = 0;

    while (true) {
      const to = from + SUPABASE_PAGE_SIZE - 1;
      const { data, error } = await client
        .from(viewName)
        .select("year, org, object, project, amount")
        .order("year", { ascending: true })
        .order("org", { ascending: true })
        .order("object", { ascending: true })
        .order("project", { ascending: true })
        .range(from, to);

      if (error) {
        console.error("Failed to load " + viewName + " actuals from Supabase:", error);
        return rows;
      }

      const page = Array.isArray(data) ? data : [];
      rows.push(...page);
      if (page.length < SUPABASE_PAGE_SIZE) break;
      from += SUPABASE_PAGE_SIZE;
    }

    return rows;
  }

  function loadExpenseActuals() {
    return loadSummaryRows("expense_actuals_public");
  }

  function loadRevenueActuals() {
    return loadSummaryRows("revenue_actuals_public");
  }

  function cleanCode(value) {
    return String(value === undefined || value === null ? "" : value).trim();
  }

  function normalizeYear(value) {
    const text = cleanCode(value);
    const match = text.match(/\d{4}/);
    return match ? match[0] : text;
  }

  function amountToNumber(value) {
    const parsed = Number(String(value === undefined || value === null ? "" : value).replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function buildLookupKey(org, object, project, year) {
    return [cleanCode(org), cleanCode(object), cleanCode(project), normalizeYear(year)].join("|");
  }

  function buildActualsLookup(rows) {
    const lookup = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = buildLookupKey(row.org, row.object, row.project, row.year);
      lookup.set(key, amountToNumber(row.amount));
    });
    return lookup;
  }

  function firstValue(row, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const value = row && row[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function rowOrg(row) {
    return firstValue(row, ["org", "Org", "ORG", "Dept_Code", "dept_code", "DeptCode"]);
  }

  function rowObject(row) {
    return firstValue(row, [
      "object",
      "Object",
      "OBJECT",
      "Object_Code",
      "object_code",
      "ObjectCode",
      "Revenue_Code",
      "revenue_code",
      "RevenueCode"
    ]);
  }

  function rowProject(row) {
    return firstValue(row, ["project", "Project", "PROJECT", "Project_Code", "project_code", "ProjectCode"]);
  }

  function getActualAmount(lookup, row, year) {
    if (!lookup || typeof lookup.get !== "function") return undefined;
    const key = buildLookupKey(rowOrg(row), rowObject(row), rowProject(row), year);
    return lookup.get(key);
  }

  function actualOrFallback(lookup, row, year, fallbackValue) {
    if (!lookup || typeof lookup.has !== "function") return amountToNumber(fallbackValue);
    const key = buildLookupKey(rowOrg(row), rowObject(row), rowProject(row), year);
    if (lookup.has(key)) return amountToNumber(lookup.get(key));
    return amountToNumber(fallbackValue);
  }

  async function loadTransactions(filters) {
    const client = getClient();
    if (!client) return [];

    const options = filters || {};
    let query = client
      .from("transactions_raw")
      .select("*")
      .order("eff_date", { ascending: true });

    if (options.year !== undefined && options.year !== null && String(options.year).trim() !== "") {
      query = query.eq("year", options.year);
    }
    if (options.org !== undefined && options.org !== null && String(options.org).trim() !== "") {
      query = query.eq("org", options.org);
    }
    if (options.object !== undefined && options.object !== null && String(options.object).trim() !== "") {
      query = query.eq("object", options.object);
    }
    if (options.project !== undefined && options.project !== null && String(options.project).trim() !== "") {
      query = query.eq("project", options.project);
    }
    if (options.type !== undefined && options.type !== null && String(options.type).trim() !== "") {
      query = query.eq("t", options.type);
    }

    const { data, error } = await query;
    if (error) {
      console.error("WCSupabaseData: failed to load transaction detail", error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  window.WCSupabaseData = {
    loadExpenseActuals,
    loadRevenueActuals,
    buildActualsLookup,
    getActualAmount,
    actualOrFallback,
    loadTransactions
  };
})();
