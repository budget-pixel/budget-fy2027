/* Walton County FY 2027 Budget — Principal Property Taxpayers table.
   Loads the Principal Property Taxpayers Google Sheet (no header row: just
   Taxpayer, Assessed Value, % of Total Net Assessed Value, one per row) and
   renders it as a data table, with the Total row computed from the sheet's
   own figures rather than hardcoded. */
(function () {
  "use strict";

  const TAXPAYERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=1358951318&single=true&output=csv";

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Minimal CSV parser (handles quoted fields/commas), mirroring the one in
  // assets/budget-data.js. This sheet has no header row, so rows are
  // returned as plain arrays rather than header-keyed objects.
  function parseCSVRows(text) {
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
    return rows.filter((r) => r.some((cell) => String(cell || "").trim() !== ""));
  }

  function parseCurrency(value) {
    const parsed = Number(String(value || "").replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parsePercent(value) {
    const parsed = Number(String(value || "").replace(/%/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCurrency(value) {
    return "$" + Math.round(value).toLocaleString("en-US");
  }

  function formatPercent(value) {
    return value.toFixed(2) + "%";
  }

  function fetchCSV(url) {
    return fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed with status " + res.status);
        return res.text();
      })
      .then(parseCSVRows);
  }

  function renderTaxpayersTable(container, rows) {
    let totalValue = 0;
    let totalPercent = 0;
    const bodyRows = rows.map((r) => {
      const name = r[0] || "";
      const assessedValue = parseCurrency(r[1]);
      const percent = parsePercent(r[2]);
      totalValue += assessedValue;
      totalPercent += percent;
      return (
        "<tr><td>" + escapeHtml(name) + "</td>" +
        '<td class="wc-num">' + escapeHtml(formatCurrency(assessedValue)) + "</td>" +
        '<td class="wc-num">' + escapeHtml(formatPercent(percent)) + "</td></tr>"
      );
    }).join("");

    const totalRow =
      '<tr class="wc-table-total-row"><td>Total</td>' +
      '<td class="wc-num">' + escapeHtml(formatCurrency(totalValue)) + "</td>" +
      '<td class="wc-num">' + escapeHtml(formatPercent(totalPercent)) + "</td></tr>";

    container.innerHTML =
      '<div class="wc-table-wrap">' +
      '<p class="wc-table-label">Principal Property Tax Payers</p>' +
      '<div class="wc-data-table-scroll">' +
      '<table class="wc-data-table">' +
      "<thead><tr><th>Taxpayer</th><th class=\"wc-num\">Assessed Value</th><th class=\"wc-num\">% of Total Net Assessed Value</th></tr></thead>" +
      "<tbody>" + bodyRows + totalRow + "</tbody>" +
      "</table>" +
      "</div>" +
      "</div>";
  }

  function initPrincipalTaxpayersTable() {
    const container = document.getElementById("principal-taxpayers-section");
    if (!container) return;

    container.innerHTML = '<div class="wc-data-loading">Loading taxpayer data...</div>';

    fetchCSV(TAXPAYERS_CSV_URL)
      .then((rows) => {
        if (!rows.length) {
          container.innerHTML = '<div class="wc-data-empty">Taxpayer data is not currently available.</div>';
          return;
        }
        renderTaxpayersTable(container, rows);
      })
      .catch((err) => {
        console.error("WCPrincipalTaxpayers: failed to load taxpayer data", err);
        container.innerHTML = '<div class="wc-data-error">Taxpayer data could not be loaded. Please try again later.</div>';
      });
  }

  document.addEventListener("DOMContentLoaded", initPrincipalTaxpayersTable);

  window.WCPrincipalTaxpayers = {
    initPrincipalTaxpayersTable
  };
})();
