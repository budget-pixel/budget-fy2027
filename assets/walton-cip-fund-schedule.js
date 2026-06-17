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
  const projects = wcCipProjects.filter(project => String(project.funding || "").toLowerCase() === config.funding);

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
      <section class="wc-year-table-block">
        <div class="wc-year-table-heading">
          <h2>${year} ${escapeHtml(config.label)} Schedule</h2>
          <strong>${money(total)}</strong>
        </div>

        <div class="wc-table-wrap">
          <table class="wc-transport-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>${year}</th>
              </tr>
            </thead>
            <tbody>
              ${yearProjects.map(project => `
                <tr>
                  <td>${escapeHtml(project.title)}</td>
                  <td class="amount">${money(project.year_amount_value)}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td>Total ${year} ${escapeHtml(config.label)}</td>
                <td class="amount">${money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    `;
  }).join("");

  document.getElementById(config.mountId).innerHTML =
    tables || `<div class="wc-empty-message">No ${escapeHtml(config.label)} projects found.</div>`;
}
