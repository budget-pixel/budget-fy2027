const app = document.getElementById("app") || document.getElementById("wc-performance-measures");

const WC_PRIOR_YEARS_KEY = "wc_show_prior_years";
let wcShowPriorYears = false;
try{ wcShowPriorYears = localStorage.getItem(WC_PRIOR_YEARS_KEY) === '1'; }catch(e){}

const urlParams = new URLSearchParams(window.location.search);
const selectedDepartment = String(
  app?.dataset?.department ||
  urlParams.get("department") ||
  ""
).trim().toLowerCase();

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function normalizeValue(value){
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g,"and")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"");
}

function departmentMatches(record, selected){
  if(!selected){
    return true;
  }

  return normalizeValue(record.department) === normalizeValue(selected) ||
         String(record.department || "").trim().toLowerCase() === selected;
}

function countRowsWithSameObjective(rows, startIndex){
  const objective = String(rows[startIndex]?.objective || "").trim();
  let count = 0;

  for(let i = startIndex; i < rows.length; i++){
    const currentObjective = String(rows[i]?.objective || "").trim();

    if(currentObjective !== objective){
      break;
    }

    count++;
  }

  return count;
}

function getFiscalHeaders(record){
  const defaults = {
    actual2022: "Actual 2022",
    actual2023: "Actual 2023",
    actual2024: "Actual 2024",
    actual2025: "Actual 2025",
    projected2026: "Projected 2026",
    projected2027: "Projected 2027"
  };

  const labels = record?.fiscalYearLabels || record?.fiscalYears || {};

  return {
    actual2022: labels.actual2022 || labels.actual1 || defaults.actual2022,
    actual2023: labels.actual2023 || labels.actual2 || defaults.actual2023,
    actual2024: labels.actual2024 || labels.actual3 || defaults.actual2024,
    actual2025: labels.actual2025 || labels.actual4 || defaults.actual2025,
    projected2026: labels.projected2026 || labels.projected1 || defaults.projected2026,
    projected2027: labels.projected2027 || labels.projected2 || defaults.projected2027
  };
}

function renderDepartment(record){
  const rows = Array.isArray(record.rows) ? record.rows : [];
  const totalRows = Math.max(rows.length, 1);
  const fiscalHeaders = getFiscalHeaders(record);

  return `
    <section class="wc-performance-card ${wcShowPriorYears ? "show-prior-years" : ""}">
      <div class="wc-performance-card-header">
        <span>Code Link ${escapeHtml(record.codeLink)}</span>
        <h2>${escapeHtml(record.department)}</h2>
        <div class="wc-performance-goal-block">
          <span class="wc-performance-goal-label">Departmental Goal</span>
          <p>${escapeHtml(record.goal)}</p>
        </div>
      </div>

      <div class="wc-fy-column-toggle-wrap">
        <label class="wc-fy-column-toggle-label">
          <input type="checkbox" class="wc-fy-column-toggle-checkbox" aria-label="View Prior Years" ${wcShowPriorYears ? "checked" : ""} />
          <span class="wc-fy-column-toggle-text">View Prior Years</span>
        </label>
      </div>

      <div class="wc-performance-table-wrap">
        <table class="wc-performance-table">
          <colgroup>
            <col class="wc-col-code">
            <col class="wc-col-goal">
            <col class="wc-col-objective">
            <col class="wc-col-measure">
            <col class="wc-col-fiscal wc-col-prior-year">
            <col class="wc-col-fiscal wc-col-prior-year">
            <col class="wc-col-fiscal wc-col-prior-year">
            <col class="wc-col-fiscal wc-col-prior-year">
            <col class="wc-col-fiscal wc-col-prior-year">
            <col class="wc-col-fiscal">
          </colgroup>
          <thead>
            <tr>
              <th>Code Link</th>
              <th>Departmental Goal</th>
              <th>Objective</th>
              <th>Performance Measure</th>
              <th class="wc-prior-year">${escapeHtml(fiscalHeaders.actual2022)}</th>
              <th class="wc-prior-year">${escapeHtml(fiscalHeaders.actual2023)}</th>
              <th class="wc-prior-year">${escapeHtml(fiscalHeaders.actual2024)}</th>
              <th class="wc-prior-year">${escapeHtml(fiscalHeaders.actual2025)}</th>
              <th class="wc-prior-year">${escapeHtml(fiscalHeaders.projected2026)}</th>
              <th>${escapeHtml(fiscalHeaders.projected2027)}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => {
              const previousObjective = index > 0 ? String(rows[index - 1]?.objective || "").trim() : "";
              const currentObjective = String(row.objective || "").trim();
              const isFirstRow = index === 0;
              const isFirstObjectiveRow = currentObjective !== previousObjective;
              const objectiveRowspan = countRowsWithSameObjective(rows, index);

              return `
                <tr>
                  ${isFirstRow ? `<td class="wc-performance-code wc-performance-merged-cell" rowspan="${totalRows}" style="vertical-align:middle;">${escapeHtml(record.codeLink)}</td>` : ""}
                  ${isFirstRow ? `<td class="wc-performance-goal wc-performance-merged-cell" rowspan="${totalRows}" style="vertical-align:middle;">${escapeHtml(record.goal)}</td>` : ""}
                  ${isFirstObjectiveRow ? `<td class="wc-performance-objective wc-performance-merged-cell" rowspan="${objectiveRowspan}" style="vertical-align:middle;">${escapeHtml(row.objective)}</td>` : ""}
                  <td class="wc-performance-measure">${escapeHtml(row.measure)}</td>
                  <td class="wc-performance-value wc-prior-year">${escapeHtml(row.actual2022)}</td>
                  <td class="wc-performance-value wc-prior-year">${escapeHtml(row.actual2023)}</td>
                  <td class="wc-performance-value wc-prior-year">${escapeHtml(row.actual2024)}</td>
                  <td class="wc-performance-value wc-prior-year">${escapeHtml(row.actual2025)}</td>
                  <td class="wc-performance-value wc-prior-year">${escapeHtml(row.projected2026)}</td>
                  <td class="wc-performance-value">${escapeHtml(row.projected2027)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="wc-performance-note">
        The code link shown for this department corresponds to a Strategic Priority Initiative identified by the Walton County Board of County Commissioners.
        <a href="https://stories.opengov.com/countyofwaltonfl/cf6eaa7a-a98d-479a-9869-b20398ee38e5/published/re0lJHwus?currentPageId=6989dbbdf5cb414d7e5c7efb" target="_blank" rel="noopener noreferrer">View Strategic Priorities</a>.
      </div>
    </section>
  `;
}

function renderApp(){
  if(!app){
    return;
  }

  const allRecords = Array.isArray(window.wcPerformanceMeasures)
    ? window.wcPerformanceMeasures
    : [];

  const records = allRecords.filter(record => departmentMatches(record, selectedDepartment));
  const isFiltered = Boolean(selectedDepartment);
  const isEmbedded = app.id === "wc-performance-measures" || isFiltered;

  app.innerHTML = `
    <main class="wc-performance-page ${isEmbedded ? "is-embedded" : ""}">
      ${!isEmbedded ? `
        <header class="wc-performance-header">
          <h1>Departmental Goals, Objectives, and Performance Measures</h1>
          <p>
            Review departmental goals, objectives, and performance measures used to track service delivery, operational outcomes, and budget priorities.
          </p>
        </header>
      ` : ""}

      ${records.length
        ? `<div style="display:grid;gap:28px;">${records.map(renderDepartment).join("")}</div>`
        : `<div class="wc-performance-empty">No department performance measures found for this selection.</div>`
      }
    </main>
  `;
}

renderApp();

function applyPriorYearsState(){
  document.querySelectorAll('.wc-performance-card').forEach(card=>{
    if(wcShowPriorYears) card.classList.add('show-prior-years'); else card.classList.remove('show-prior-years');
  });

  document.querySelectorAll('.wc-fy-column-toggle-checkbox').forEach(cb=>{
    try{ cb.checked = !!wcShowPriorYears; }catch(e){}
  });
}

function initPriorYearsToggle(){
  document.addEventListener('change', (e)=>{
    const target = e.target;
    if(!target || !target.classList) return;
    if(target.classList.contains('wc-fy-column-toggle-checkbox')){
      wcShowPriorYears = !!target.checked;
      try{ localStorage.setItem(WC_PRIOR_YEARS_KEY, wcShowPriorYears ? '1' : '0'); }catch(e){}
      applyPriorYearsState();
    }
  });

  // ensure initial state applied
  applyPriorYearsState();
}

initPriorYearsToggle();
