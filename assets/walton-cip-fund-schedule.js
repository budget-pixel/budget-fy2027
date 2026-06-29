function money(value){
  const amount = Number(value || 0);

  return "$" + Math.round(amount).toLocaleString("en-US");
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getYearAmount(project, year){
  return (project.funding_by_year || [])
    .filter(item => item.year === year)
    .reduce((sum, item) => sum + Number(item.amount_value || 0), 0);
}

function getInHouseEngineeringAmount(project){
  if(Number(project.in_house_engineering_value || 0) > 0){
    return Number(project.in_house_engineering_value || 0);
  }

  return (project.in_house_engineering_rows || [])
    .reduce((sum, row) => sum + Number(row.amount_value || 0), 0);
}

function isLegacyInHouseEngineeringRow(project){
  const title = String(project.title || "").toLowerCase();
  const accountCode = String(project.budget_account_code || "").trim();

  return Boolean(project.is_legacy_in_house_engineering_row) ||
    title.includes("in-house engineering") ||
    accountCode === "534000";
}

function displayYear(year){
  return String(year || "").replace(/^FY(\d{4})$/, "FY $1");
}

function getHashYear(years){
  const hashYear = decodeURIComponent(String(window.location.hash || "").replace(/^#/, "")).toUpperCase();

  return years.includes(hashYear) ? hashYear : "";
}

function buildProjectUrl(project, year){
  if(!project || !project.slug){
    return "";
  }

  const returnPath = window.location.pathname.split("/").pop() || "capital-projects.html";
  const returnTarget = year ? `${returnPath}#${encodeURIComponent(year)}` : returnPath;

  return `cip-project.html?project=${encodeURIComponent(project.slug)}&return=${encodeURIComponent(returnTarget)}`;
}

function renderProjectTitle(project, year){
  const title = escapeHtml(project && project.title ? project.title : "Capital Project");
  const url = buildProjectUrl(project, year);

  if(!url){
    return title;
  }

  return `<a class="wc-cip-project-link" href="${escapeHtml(url)}">${title}</a>`;
}

function renderYearScheduleTable(year, label, projects, totalLabel, options){
  const total = projects.reduce((sum, project) => sum + project.year_amount_value, 0);
  const showFundingColumn = Boolean(options && options.showFundingColumn);

  if(!projects.length){
    return "";
  }

  const yearLabel = displayYear(year);

  return `
    <div class="wc-table-wrap wc-cip-year-table">
      <p class="wc-table-label">${escapeHtml(yearLabel)} ${escapeHtml(label)}</p>
      <div class="wc-data-table-scroll">
        <table class="wc-data-table">
          <thead>
            <tr>
              <th>Project</th>
              ${showFundingColumn ? "<th>Fund</th>" : ""}
              <th class="wc-num">${escapeHtml(yearLabel)}</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map(project => `
              <tr>
                <td>${renderProjectTitle(project, year)}</td>
                ${showFundingColumn ? `<td>${escapeHtml(project.funding || "Not listed")}</td>` : ""}
                <td class="wc-num">${money(project.year_amount_value)}</td>
              </tr>
            `).join("")}
            <tr class="wc-table-total-row">
              <td${showFundingColumn ? ' colspan="2"' : ""}>Total ${escapeHtml(yearLabel)} ${escapeHtml(totalLabel || label)}</td>
              <td class="wc-num">${money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFundSchedule(config){
  const years = ["FY2027", "FY2028", "FY2029", "FY2030", "FY2031"];
  const mount = document.getElementById(config.mountId);
  const projectFilter = typeof config.projectFilter === "function"
    ? config.projectFilter
    : project => String(project.funding || "").toLowerCase() === config.funding;

  if(!mount){
    return;
  }

  mount.innerHTML = '<div class="wc-data-loading">Loading capital schedule...</div>';

  const ready = window.wcCipProjectsReady || Promise.resolve(window.wcCipProjects || []);

  if(!document.getElementById("wc-cip-schedule-styles")){
    const style = document.createElement("style");
    style.id = "wc-cip-schedule-styles";
    style.textContent = `
      .wc-cip-schedule-shell{
        margin-top:28px;
      }

      .wc-cip-schedule-controls{
        margin:0 0 22px;
        padding:22px;
        border:1px solid rgba(0,63,40,.12);
        border-radius:24px;
        background:#f7fbf7;
      }

      .wc-cip-schedule-control-top{
        display:flex;
        justify-content:space-between;
        gap:18px;
        align-items:flex-start;
        margin-bottom:18px;
      }

      .wc-cip-schedule-control-top h2{
        margin:0 0 6px;
        color:#172033;
        font-family:Georgia, "Times New Roman", serif;
        font-size:clamp(26px, 3vw, 40px);
        line-height:1.08;
        font-weight:500;
      }

      .wc-cip-schedule-control-top p{
        max-width:640px;
        margin:0;
        color:#607184;
        font-size:14px;
        line-height:1.65;
      }

      .wc-cip-active-total{
        min-width:190px;
        text-align:right;
      }

      .wc-cip-active-total strong{
        display:block;
        color:#003f28;
        font-size:28px;
        line-height:1;
      }

      .wc-cip-active-total span{
        display:block;
        margin-top:7px;
        color:#607184;
        font-size:11px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .wc-cip-year-picker{
        display:grid;
        grid-template-columns:repeat(auto-fit, minmax(116px,1fr));
        gap:8px;
        margin-bottom:16px;
      }

      .wc-cip-year-button{
        min-height:44px;
        border:1px solid rgba(0,63,40,.14);
        border-radius:999px;
        background:#ffffff;
        color:#24344d;
        font-size:13px;
        font-weight:800;
        cursor:pointer;
        transition:background .2s ease, border-color .2s ease, color .2s ease, transform .2s ease;
      }

      .wc-cip-year-button:hover,
      .wc-cip-year-button.is-active{
        border-color:#003f28;
        background:#003f28;
        color:#ffffff;
      }

      .wc-cip-year-button:hover{
        transform:translateY(-1px);
      }

      .wc-cip-year-body{
        display:grid;
        gap:22px;
      }

      .wc-cip-year-summary{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:1px;
        overflow:hidden;
        border:1px solid rgba(0,63,40,.12);
        border-radius:20px;
        background:rgba(0,63,40,.12);
      }

      .wc-cip-year-stat{
        padding:18px;
        background:#ffffff;
      }

      .wc-cip-year-stat strong{
        display:block;
        color:#003f28;
        font-size:26px;
        line-height:1;
      }

      .wc-cip-year-stat span{
        display:block;
        margin-top:8px;
        color:#607184;
        font-size:11px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .wc-cip-year-table{
        margin-top:0;
      }

      .wc-cip-project-link{
        color:#003f28;
        font-weight:800;
        text-decoration:none;
        text-underline-offset:3px;
      }

      .wc-cip-project-link:hover{
        text-decoration:underline;
      }

      @media(max-width:760px){
        .wc-cip-schedule-control-top{
          flex-direction:column;
        }

        .wc-cip-active-total{
          text-align:left;
        }

        .wc-cip-year-picker,
        .wc-cip-year-summary{
          grid-template-columns:1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  ready.then(projectList => {
    const projects = (Array.isArray(projectList) ? projectList : window.wcCipProjects || [])
      .filter(projectFilter);

    const scheduleProjects = projects.filter(project => !isLegacyInHouseEngineeringRow(project));
    const inHouseProjects = scheduleProjects.filter(project => getInHouseEngineeringAmount(project) > 0);

    function getYearProjects(projectSource, year){
      return projectSource
        .map(project => ({
          ...project,
          year_amount_value: getYearAmount(project, year)
        }))
        .filter(project => project.year_amount_value > 0)
        .sort((a, b) => b.year_amount_value - a.year_amount_value || a.title.localeCompare(b.title));
    }

    function getYearInHouseProjects(projectSource, year){
      return projectSource
        .map(project => ({
          ...project,
          year_amount_value: year === "FY2027" ? getInHouseEngineeringAmount(project) : 0
        }))
        .filter(project => project.year_amount_value > 0)
        .sort((a, b) => b.year_amount_value - a.year_amount_value || a.title.localeCompare(b.title));
    }

    const yearData = years.reduce((data, year) => {
      const yearProjects = getYearProjects(scheduleProjects, year);
      const yearInHouseProjects = getYearInHouseProjects(inHouseProjects, year);
      const total = yearProjects.reduce((sum, project) => sum + project.year_amount_value, 0);
      const inHouseTotal = yearInHouseProjects.reduce((sum, project) => sum + project.year_amount_value, 0);

      data[year] = {
        projects: yearProjects,
        inHouseProjects: yearInHouseProjects,
        total,
        inHouseTotal
      };

      return data;
    }, {});

    const hasProjects = years.some(year =>
      yearData[year].projects.length || yearData[year].inHouseProjects.length
    );
    const availableYears = years.filter(year =>
      yearData[year].projects.length || yearData[year].inHouseProjects.length
    );

    if(!hasProjects){
      mount.innerHTML = `<p class="wc-data-empty">No ${escapeHtml(config.label)} projects found.</p>`;
      return;
    }

    const requestedYear = config.defaultYear || getHashYear(years) || "FY2027";
    let activeYear = availableYears.includes(requestedYear)
      ? requestedYear
      : availableYears[0];

    function renderActiveYear(){
      const data = yearData[activeYear] || yearData.FY2027;
      const yearLabel = displayYear(activeYear);
      const tables = [
        renderYearScheduleTable(activeYear, config.label + " Schedule", data.projects, config.label, config),
        renderYearScheduleTable(activeYear, "In-House Engineering Schedule", data.inHouseProjects, "In-House Engineering", config)
      ].join("");

      mount.innerHTML = `
        <section class="wc-cip-schedule-shell" aria-label="${escapeHtml(config.label)} capital schedule">
          <div class="wc-cip-schedule-controls">
            <div class="wc-cip-schedule-control-top">
              <div>
                <h2>${escapeHtml(yearLabel)} Schedule</h2>
                <p>Use the year controls to review planned future-year capital projects.</p>
              </div>
              <div class="wc-cip-active-total">
                <strong>${money(data.total)}</strong>
                <span>${escapeHtml(yearLabel)} Total</span>
              </div>
            </div>
            <div class="wc-cip-year-picker" role="tablist" aria-label="Select capital schedule year">
              ${availableYears.map(year => `
                <button class="wc-cip-year-button${year === activeYear ? " is-active" : ""}" type="button" data-cip-year="${escapeHtml(year)}" role="tab" aria-selected="${year === activeYear ? "true" : "false"}">
                  ${escapeHtml(displayYear(year))}
                </button>
              `).join("")}
            </div>
          </div>
          <div class="wc-cip-year-body">
            <div class="wc-cip-year-summary" aria-label="${escapeHtml(yearLabel)} schedule summary">
              <div class="wc-cip-year-stat">
                <strong>${money(data.total)}</strong>
                <span>${escapeHtml(config.label)}</span>
              </div>
              <div class="wc-cip-year-stat">
                <strong>${escapeHtml(data.projects.length)}</strong>
                <span>Projects Listed</span>
              </div>
              <div class="wc-cip-year-stat">
                <strong>${money(data.inHouseTotal)}</strong>
                <span>In-House Engineering</span>
              </div>
            </div>
            ${tables || `<p class="wc-data-empty">No ${escapeHtml(config.label)} projects are listed for ${escapeHtml(yearLabel)}.</p>`}
          </div>
        </section>
      `;

      mount.querySelectorAll("[data-cip-year]").forEach(button => {
        button.addEventListener("click", () => {
          activeYear = button.getAttribute("data-cip-year") || "FY2027";
          if(window.history && window.history.replaceState){
            window.history.replaceState(null, "", `#${activeYear}`);
          }
          renderActiveYear();
        });
      });
    }

    renderActiveYear();
  }).catch(error => {
    console.error("Walton CIP: failed to render capital schedule", error);
    mount.innerHTML = `<p class="wc-data-empty">Capital schedule data could not be loaded.</p>`;
  });
}
