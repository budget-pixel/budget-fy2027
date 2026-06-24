(function () {
  "use strict";

  // TODO: Transaction CSV export is not currently implemented. If added later,
  // it must export only public_transactions public-facing fields and must not
  // include raw source fields from transactions_raw.

  // Floating-point summation noise only; not a tolerance for real discrepancies.
  const RECONCILIATION_TOLERANCE = 0.01;

  function isDebugMode() {
    try {
      return (
        /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ||
        new URLSearchParams(window.location.search).has("debug")
      );
    } catch (e) {
      return false;
    }
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function parseAmount(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).split(" ")[0] || "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // Returns null (not "") when the param is absent from the URL, distinct
  // from an explicitly empty value -- needed for projectCode, where "absent"
  // must mean "don't filter by project" and "" must mean "filter to a blank
  // Project_Code specifically" (see initTransactionsPage's queryFilters).
  function param(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function compact(values) {
    return values.filter((value) => value !== undefined && value !== null && String(value).trim() !== "");
  }

  function firstValue(row, keys) {
    for (let i = 0; i < keys.length; i += 1) {
      const value = row && row[keys[i]];
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  }

  function renderChips(chips) {
    const host = $("#transaction-filter-chips");
    if (!host) return;
    host.innerHTML = chips.map((chip) => '<span class="wc-transaction-chip">' + escapeHtml(chip) + "</span>").join("");
  }

  function isRevenueContext(context) {
    const text = [context.kind, context.category].join(" ").toLowerCase();
    return /\brevenue\b|\btax\b|\btaxes\b|\bfees\b|\bcharges\b|\bsources\b|\bintergovernmental\b|\bmiscellaneous\b|\bfines\b/.test(text);
  }

  function displayAmount(value, context) {
    const amount = isRevenueContext(context) ? Math.abs(Number(value || 0)) : Number(value || 0);
    return amount;
  }

  // Maps the departmentName carried in the URL back to the department page
  // it came from. The static fallback href in the HTML can only point to
  // one page, and several pages' titles don't match the underlying sheet's
  // Dept_Name (e.g. the Clerk's page is titled "Clerk of Courts & County
  // Comptroller" but rows are Dept_Name "Clerk of Court"), so this has to
  // be resolved here rather than derived from the URL/title directly.
  const DEPARTMENT_BACK_LINK_PAGES = {
    "office of management and budget": "office-of-management-and-budget.html",
    "clerk of court": "clerk-of-courts-and-county-comptroller.html",
    "property appraiser": "property-appraiser.html",
    "supervisor of elections": "supervisor-of-elections.html",
    "tax collector": "tax-collector.html",
    "walton county sheriffs office": "sheriffs-office.html"
  };

  function normalizeDeptNameForBackLink(name) {
    return String(name || "")
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function initBackLink(context) {
    const link = document.querySelector("[data-transaction-back]");
    if (!link) return;

    // Fix the static "always goes to OMB" href before wiring up the
    // history.back() enhancement, so the link is correct even if history
    // isn't usable (e.g. opened in a new tab) and not just when it is.
    const page = DEPARTMENT_BACK_LINK_PAGES[normalizeDeptNameForBackLink(context && context.departmentName)];
    if (page) link.setAttribute("href", page);

    link.addEventListener("click", function (event) {
      if (window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });
  }

  function renderTable(rows, context) {
    const host = $("#transaction-table");
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = "";
      return;
    }

    const hasProgram = rows.some((row) => firstValue(row, ["program_name", "program_code"]) || context.program);
    const bodyRows = rows.map((row) => {
      const vendor = firstValue(row, ["vendor_payee_public"]) || "Not available";
      const description = firstValue(row, ["description_public"]) || "No description provided";
      const project = firstValue(row, ["program_name", "program_code"]) || context.program || "";
      const amount = displayAmount(row.amount, context);
      return (
        "<tr>" +
        "<td>" + escapeHtml(formatDate(row.transaction_date) || "Not available") + "</td>" +
        "<td>" + escapeHtml(vendor) + "</td>" +
        "<td>" + escapeHtml(description) + "</td>" +
        '<td class="wc-num">' + escapeHtml(formatCurrency(amount)) + "</td>" +
        (hasProgram ? "<td>" + escapeHtml(project || "Not available") + "</td>" : "") +
        "</tr>"
      );
    }).join("");

    host.innerHTML =
      '<div class="wc-data-table-scroll wc-transaction-table-scroll">' +
      '<table class="wc-data-table wc-transaction-table">' +
      "<thead><tr>" +
      "<th>Transaction Date</th>" +
      "<th>Vendor / Payee</th>" +
      "<th>Description</th>" +
      '<th class="wc-num">Amount</th>' +
      (hasProgram ? "<th>Program</th>" : "") +
      "</tr></thead>" +
      "<tbody>" + bodyRows + "</tbody>" +
      "</table>" +
      "</div>";
  }

  async function initTransactionsPage() {
    const context = {
      fy: param("fy"),
      category: param("categoryLabel") || param("category"),
      objectCode: param("objectCode"),
      objectName: param("objectName"),
      org: param("org") || param("departmentCode"),
      departmentCode: param("departmentCode"),
      departmentName: param("departmentName"),
      fundCode: param("fundCode"),
      projectCode: param("projectCode"),
      program: param("program"),
      kind: param("kind") || "expense",
      selectedActual: parseAmount(param("selectedActual"))
    };

    initBackLink(context);

    const title = $("#transaction-title");
    const intro = $("#transaction-intro");
    const status = $("#transaction-status");
    const objectLabel = compact([context.objectName, context.objectCode]).join(" — ");

    if (title) title.textContent = objectLabel ? "Transactions for " + objectLabel : "Transaction Detail";
    if (intro) {
      intro.textContent = "Showing transactions for the selected FY " + (context.fy || "") + " actual amount.";
    }

    renderChips(compact([
      context.fy ? "FY " + context.fy : "",
      context.category,
      objectLabel,
      context.departmentName || context.departmentCode,
      context.program || context.projectCode
    ]));

    if (!context.fy || !context.org || !context.objectCode) {
      if (status) status.textContent = "Missing year, department, or object code filter.";
      return;
    }

    if (!window.WCSupabaseData || typeof window.WCSupabaseData.loadTransactions !== "function") {
      if (status) status.textContent = "Transaction data is unavailable.";
      return;
    }

    const queryFilters = {
      year: context.fy,
      org: context.org,
      object: context.objectCode,
      fund: context.fundCode || ""
    };
    // The "project" key is only added when the URL actually specified a
    // projectCode (even an explicitly empty one, for the blank-Project_Code
    // recipients) -- omitting the key entirely (rather than always setting
    // it, even to "") is what makes loadTransactions skip filtering by
    // project at all for a merged/summary row that spans several projects.
    if (context.projectCode !== null) {
      queryFilters.project = context.projectCode;
    }

    const rows = await window.WCSupabaseData.loadTransactions(queryFilters);

    const transactionTotal = rows.reduce((sum, row) => sum + displayAmount(row.amount, context), 0);
    const hasSelectedActual = context.selectedActual !== null;
    const difference = hasSelectedActual ? transactionTotal - context.selectedActual : null;
    const withinTolerance = !hasSelectedActual || Math.abs(difference) <= RECONCILIATION_TOLERANCE;

    if (status) {
      if (!rows.length) {
        status.innerHTML = escapeHtml("No matching transactions were found for this exact filter.");
      } else {
        const lines = [
          rows.length.toLocaleString("en-US") + " transaction" + (rows.length === 1 ? "" : "s") + " found."
        ];
        lines.push("Transaction total: " + formatCurrency(transactionTotal));
        if (hasSelectedActual) lines.push("Difference: " + formatCurrency(difference));

        const warning = hasSelectedActual && !withinTolerance
          ? '<p class="wc-transaction-summary-note">The transaction total does not match the selected actual amount. ' +
            "This may happen if some activity is filtered out for public display, recorded centrally, " +
            "summarized differently in the actuals view, or unavailable at the transaction level.</p>"
          : "";
        status.innerHTML = lines.map((line) => "<p>" + escapeHtml(line) + "</p>").join("") + warning;
      }
    }

    if (isDebugMode()) {
      console.log("Transaction detail reconciliation", {
        fiscalYear: context.fy,
        objectCode: context.objectCode,
        departmentCode: context.org,
        fundCode: context.fundCode || null,
        programCode: context.projectCode || null,
        selectedActualAmount: context.selectedActual,
        queryFilters: queryFilters,
        rowCount: rows.length,
        transactionTotal: transactionTotal,
        difference: difference
      });
    }

    renderTable(rows, context);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTransactionsPage);
  } else {
    initTransactionsPage();
  }
})();
