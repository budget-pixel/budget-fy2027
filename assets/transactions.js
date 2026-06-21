(function () {
  "use strict";

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

  function param(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
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

  function initBackLink() {
    const link = document.querySelector("[data-transaction-back]");
    if (!link) return;
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

    const rows = await window.WCSupabaseData.loadTransactions({
      year: context.fy,
      org: context.org,
      object: context.objectCode,
      project: context.projectCode || ""
    });

    if (status) {
      const transactionTotal = rows.reduce((sum, row) => sum + displayAmount(row.amount, context), 0);
      const countText = rows.length.toLocaleString("en-US") + " transaction" + (rows.length === 1 ? "" : "s") + " found.";
      const summary = rows.length
        ? countText + " Transaction total: " + formatCurrency(transactionTotal) + "."
        : "No matching transactions were found for this exact filter.";
      const mismatch = context.selectedActual !== null && Math.round(transactionTotal) !== Math.round(context.selectedActual)
        ? '<span class="wc-transaction-summary-note">Transaction total may differ from the displayed actual due to rounding, timing, adjustments, or centrally recorded activity.</span>'
        : "";
      status.innerHTML = escapeHtml(summary) + mismatch;
    }
    renderTable(rows, context);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTransactionsPage);
  } else {
    initTransactionsPage();
  }
})();
