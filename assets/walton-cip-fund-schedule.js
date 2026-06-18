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

function renderYearScheduleTable(year, label, projects, totalLabel){
  const total = projects.reduce((sum, project) => sum + project.year_amount_value, 0);

  if(!projects.length){
    return "";
  }

  return `
    <div class="wc-table-wrap">
      <p class="wc-table-label">${year} ${escapeHtml(label)}</p>
      <div class="wc-data-table-scroll">
        <table class="wc-data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th class="wc-num">${year}</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map(project => `
              <tr>
                <td>${escapeHtml(project.title)}</td>
                <td class="wc-num">${money(project.year_amount_value)}</td>
              </tr>
            `).join("")}
            <tr class="wc-table-total-row">
              <td>Total ${year} ${escapeHtml(totalLabel || label)}</td>
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

  if(!mount){
    return;
  }

  mount.innerHTML = '<div class="wc-data-loading">Loading capital schedule...</div>';

  const ready = window.wcCipProjectsReady || Promise.resolve(window.wcCipProjects || []);

  ready.then(projectList => {
    const projects = (Array.isArray(projectList) ? projectList : window.wcCipProjects || [])
      .filter(project => String(project.funding || "").toLowerCase() === config.funding);

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

    const tables = years.map(year => {
      const yearProjects = getYearProjects(scheduleProjects, year);
      const yearInHouseProjects = getYearInHouseProjects(inHouseProjects, year);

      return [
        renderYearScheduleTable(year, config.label + " Schedule", yearProjects, config.label),
        renderYearScheduleTable(year, "In-House Engineering Schedule", yearInHouseProjects, "In-House Engineering")
      ].join("");
    }).join("");

    mount.innerHTML =
      tables || `<p class="wc-data-empty">No ${escapeHtml(config.label)} projects found.</p>`;
  }).catch(error => {
    console.error("Walton CIP: failed to render capital schedule", error);
    mount.innerHTML = `<p class="wc-data-empty">Capital schedule data could not be loaded.</p>`;
  });
}
