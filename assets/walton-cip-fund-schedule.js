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

    function getYearProjects(year){
      return projects
        .map(project => ({
          ...project,
          year_amount_value: getYearAmount(project, year)
        }))
        .filter(project => project.year_amount_value > 0)
        .sort((a, b) => b.year_amount_value - a.year_amount_value || a.title.localeCompare(b.title));
    }

    const tables = years.map(year => {
      const yearProjects = getYearProjects(year);
      const total = yearProjects.reduce((sum, project) => sum + project.year_amount_value, 0);

      if(!yearProjects.length){
        return "";
      }

      return `
        <div class="wc-table-wrap">
          <p class="wc-table-label">${year} ${escapeHtml(config.label)} Schedule</p>
          <div class="wc-data-table-scroll">
            <table class="wc-data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th class="wc-num">${year}</th>
                </tr>
              </thead>
              <tbody>
                ${yearProjects.map(project => `
                  <tr>
                    <td>${escapeHtml(project.title)}</td>
                    <td class="wc-num">${money(project.year_amount_value)}</td>
                  </tr>
                `).join("")}
                <tr class="wc-table-total-row">
                  <td>Total ${year} ${escapeHtml(config.label)}</td>
                  <td class="wc-num">${money(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join("");

    mount.innerHTML =
      tables || `<p class="wc-data-empty">No ${escapeHtml(config.label)} projects found.</p>`;
  }).catch(error => {
    console.error("Walton CIP: failed to render capital schedule", error);
    mount.innerHTML = `<p class="wc-data-empty">Capital schedule data could not be loaded.</p>`;
  });
}
