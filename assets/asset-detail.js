(function () {
  "use strict";

  const DATA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRc6KHhTwcdREn_SvLONy_cucXH8NxF45hgdyn8IoFGSeTbIVKtDGMMWsbgSFpMizxtxy_fE-pAMmiu/pub?gid=1951375493&single=true&output=csv";
  const container = document.getElementById("asset-record");
  // Temporary display fallback until the Fleet Note column is included in
  // the published machinery-request CSV. A nonblank request note passed in
  // the URL always takes precedence over this fallback.
  const FALLBACK_FLEET_NOTES = {
    "9218": "The truck currently has 168,091 miles, and the last service was performed on January 28 at 160,918 miles. It has since experienced a catastrophic rocker arm failure, which de-lobed the camshafts and circulated metal throughout the engine’s oiling system. Due to the severity of the internal damage, two repair paths are available. The department may also choose to surplus the vehicle."
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (char !== "\r") field += char;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    const headers = rows.shift() || [];
    return rows.filter((values) => values.some(Boolean)).map((values) => {
      const record = {};
      headers.forEach((header, index) => { record[header.trim()] = String(values[index] || "").trim(); });
      return record;
    });
  }

  function numberValue(value) {
    const normalized = String(value || "").replace(/[$,]/g, "").trim();
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function currency(value) {
    return numberValue(value).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  }

  function quantity(value, suffix) {
    const number = numberValue(value);
    return number.toLocaleString("en-US", { maximumFractionDigits: 2 }) + (suffix ? " " + suffix : "");
  }

  function sum(record, fields) {
    return fields.reduce((total, field) => total + numberValue(record[field]), 0);
  }

  function kpi(label, value, interpretation, tone) {
    return '<article class="wc-fleet-kpi ' + (tone || "") + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(interpretation) + "</small></article>";
  }

  function metadata(label, value) {
    return '<div class="wc-fleet-meta-item"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + "</strong></div>";
  }

  function parseVehicleYear(description) {
    const match = String(description || "").match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : 0;
  }

  function render(record) {
    const pmFields = ["PM Labor Cost", "PM Equipment Cost", "PM Inventory Cost", "PM Supplies Cost", "PM Outsourcing Cost", "PM Overhead Cost"];
    const nonPmFields = ["Non-PM Labor Cost", "Non-PM Equip Cost", "Non-PM Inv Cost", "Non-PM Supply Cost", "Non-PM Outsource Cost", "Non-PM Overhead Cost"];
    const pmTotal = sum(record, pmFields);
    const repairTotal = sum(record, nonPmFields);
    const assetNumber = record["Equip Code"];
    const params = new URLSearchParams(window.location.search);
    const replacementCost = numberValue(params.get("amount"));
    const replacementDescription = params.get("replacement") || "Replacement equipment";
    const fleetNote = params.get("fleetNote") || FALLBACK_FLEET_NOTES[String(assetNumber || "").trim()] || "";
    const submittedMileage = Math.abs(numberValue(record["LTD Miles"]));
    const currentMileageMatch = fleetNote.match(/currently has ([\d,]+) miles/i);
    const currentMileage = currentMileageMatch ? numberValue(currentMileageMatch[1]) : submittedMileage;
    const maintenanceTotal = pmTotal + repairTotal;
    const maintenanceShare = replacementCost > 0 ? maintenanceTotal / replacementCost : 0;
    const vehicleYear = parseVehicleYear(record["Asset Desc."]);
    const vehicleAge = vehicleYear ? Math.max(0, new Date().getFullYear() - vehicleYear) : null;
    document.title = "Asset " + assetNumber + " — Walton County FY 2027 Budget";

    container.innerHTML =
      '<header class="wc-fleet-header">' +
        '<div class="wc-fleet-title-row"><div><span class="wc-fleet-eyebrow">Fleet asset record</span><h1>' + escapeHtml(record["Asset Desc."] || "County vehicle") + "</h1></div></div>" +
        '<div class="wc-fleet-metadata">' + metadata("Asset ID", assetNumber) + metadata("Department", record["Equip Group"] || "Not listed") + metadata("Mileage", quantity(currentMileage, "miles")) + metadata("Vehicle age", vehicleAge == null ? "Not available" : vehicleAge + (vehicleAge === 1 ? " year" : " years")) + "</div>" +
      "</header>" +
      '<section class="wc-fleet-section" aria-labelledby="fleetConditionTitle"><div class="wc-fleet-section-heading"><div><h2 id="fleetConditionTitle">Fleet Notes</h2></div></div>' +
        '<div class="wc-fleet-note-card"><p>' + escapeHtml(fleetNote || "No fleet condition note is available for this request.") + "</p></div>" +
        '<div class="wc-fleet-cost-subhead"><h3>Cost indicators</h3><p>Figures reflect the published asset history and machinery request.</p></div>' +
        '<div class="wc-fleet-kpi-grid">' +
          kpi("Request cost", replacementCost > 0 ? currency(replacementCost) : "Not listed", replacementDescription, "primary") +
          kpi("Lifetime maintenance cost", currency(maintenanceTotal), "Recorded maintenance and repairs", maintenanceShare >= .5 ? "warning" : "") +
          kpi("Maintenance as % of request cost", replacementCost > 0 ? (maintenanceShare * 100).toFixed(1) + "%" : "Not available", "Historical maintenance divided by request cost", maintenanceShare >= .5 ? "warning" : "") +
        "</div></section>";
  }

  function loadAssetRecord() {
    const requestedAsset = new URLSearchParams(window.location.search).get("asset");
    if (!requestedAsset) {
      container.innerHTML = '<div class="wc-data-empty"><strong>No asset number was provided.</strong><br>Return to the machinery summary and select a BCC replacement number.</div>';
      return;
    }

    fetch(DATA_URL)
      .then((response) => { if (!response.ok) throw new Error("Equipment sheet request failed"); return response.text(); })
      .then(parseCSV)
      .then((records) => {
        const record = records.find((item) => String(item["Equip Code"] || "").trim() === String(requestedAsset).trim());
        if (!record) {
          container.innerHTML = '<div class="wc-data-empty"><strong>No equipment record was found for BCC asset ' + escapeHtml(requestedAsset) + '.</strong><br>The asset may not yet be included in the published equipment history.</div>';
          return;
        }
        render(record);
      })
      .catch((error) => {
        console.error("Asset detail failed to load", error);
        container.innerHTML = '<div class="wc-data-error">The equipment record could not be loaded right now. Please return to the machinery summary and try again.</div>';
      });
  }

  // This page is only published for dark-mode visitors (same convention as
  // Summary of Personnel Cost/Contractual Services -- see nav.js's
  // wc-dark-mode-only-result handling) -- reads the theme directly from
  // localStorage rather than document.documentElement's data-theme
  // attribute, since nav.js (which sets that attribute) loads after this
  // script and hasn't necessarily run yet.
  const THEME_STORAGE_KEY = "waltonBudgetTheme";
  function isDarkModeActive() {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
    } catch (e) {
      return document.documentElement.getAttribute("data-theme") === "dark";
    }
  }

  let assetRecordLoaded = false;
  function checkThemeAccess() {
    if (!isDarkModeActive()) {
      assetRecordLoaded = false;
      container.innerHTML = '<div class="wc-data-empty"><strong>This page is only available in dark mode.</strong><br>Use the theme toggle in the navigation to switch to dark mode to view this equipment record.</div>';
      return;
    }
    if (assetRecordLoaded) return;
    assetRecordLoaded = true;
    loadAssetRecord();
  }

  checkThemeAccess();
  // Reacts live if the visitor toggles the theme without reloading the page.
  new MutationObserver(checkThemeAccess).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}());
