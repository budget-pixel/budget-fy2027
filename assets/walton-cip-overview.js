const app = document.getElementById("app");

const defaultVisibleCount = 9;
const loadMoreIncrement = 9;
const urlParams = new URLSearchParams(window.location.search);
const isStandaloneSearchPage =
  document.body.dataset.page === "project-search" ||
  window.location.pathname.endsWith("/search.html");


const isFullView = isStandaloneSearchPage || urlParams.get("view") === "all";
const incomingSearch = String(urlParams.get("q") || "").trim().toLowerCase();

function buildProjectUrl(project){
  return `cip-project.html?project=${encodeURIComponent(project.slug || "")}`;
}


let visibleLimit = isFullView ? 9999 : defaultVisibleCount;

function resetVisibleLimit(){
  visibleLimit = isFullView ? 9999 : defaultVisibleCount;
}

const filters = {
  department: "all",
  year: "all",
  fund: "all",
  search: incomingSearch
};

function normalizeFilterValue(value){
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSearchableProjects(){
  const projects = Array.isArray(window.wcCipProjects) ? window.wcCipProjects : [];

  return projects.filter(project => !project.is_legacy_in_house_engineering_row);
}

function formatMoneyShort(value){
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);

  if(abs >= 1000000){
    return "$" + (amount / 1000000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
      minimumFractionDigits: abs < 10000000 ? 1 : 0
    }) + "M";
  }

  return "$" + Math.round(amount).toLocaleString("en-US");
}

function projectBudgetValue(project){
  return Number(project && project.budget_value ? project.budget_value : 0) || 0;
}

function getCipOverviewStats(projects){
  const currentProjects = (projects || []).filter(project => projectBudgetValue(project) > 0);
  const totalBudget = currentProjects.reduce((sum, project) => sum + projectBudgetValue(project), 0);
  function fundTotal(matches){
    return currentProjects.reduce((sum, project) => {
      const funding = String(project.funding || "").toLowerCase();
      return matches.some(match => funding.includes(match)) ? sum + projectBudgetValue(project) : sum;
    }, 0);
  }

  const fundCards = [
    {
      label: "Capital Projects Fund",
      value: fundTotal(["capital projects fund", "capital project"]),
      text: "County facilities, public infrastructure, and major improvements.",
      href: "cip-capital-projects.html"
    },
    {
      label: "Grant Funded",
      value: fundTotal(["grant"]),
      text: "Projects supported by federal, state, or regional grant funding.",
      href: "cip-grants.html"
    },
    {
      label: "Sheriff Fund",
      value: fundTotal(["sheriff", "fine", "forfeiture"]),
      text: "Public safety facilities, equipment, and law enforcement capital needs.",
      href: "cip-sheriff.html"
    },
    {
      label: "Tourist Development Fund",
      value: fundTotal(["tourist", "tourism"]),
      text: "Beach operations, visitor infrastructure, and destination improvements.",
      href: "cip-tourist-development.html"
    },
    {
      label: "Transportation Fund",
      value: fundTotal(["transportation"]),
      text: "Road, bridge, drainage, and mobility infrastructure.",
      href: "cip-transportation.html"
    }
  ];

  return {
    totalBudget,
    projectCount: currentProjects.length,
    fundCards
  };
}

function getFilterOptions(projects, key, preferredOrder){
  const seen = {};
  const options = [];

  projects.forEach(project => {
    const label = String(project[key] || "").trim();

    if(!label){
      return;
    }

    const value = normalizeFilterValue(label);

    if(seen[value]){
      return;
    }

    seen[value] = true;
    options.push({ label, value });
  });

  const order = preferredOrder.reduce((acc, item, index) => {
    acc[normalizeFilterValue(item)] = index;
    return acc;
  }, {});

  return options.sort((a, b) => {
    const aOrder = order[a.value] ?? 999;
    const bOrder = order[b.value] ?? 999;

    return aOrder - bOrder || a.label.localeCompare(b.label);
  });
}

function renderFilterButton(type, value, label){
  return `<button class="wc-project-filter ${filters[type] === value ? "active" : ""}" data-filter-type="${escapeHtml(type)}" data-filter="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function getFilteredProjects(){
  const projects = getSearchableProjects();

  return projects.filter(project => {

    const department = normalizeFilterValue(project.department_filter || project.dept || project.department);
    const departmentLabel = normalizeFilterValue(project.dept || project.department);
    const target = String(project.target || "").toLowerCase();
    const targetYears = Array.isArray(project.target_years) ? project.target_years.join(" ").toLowerCase() : "";
    const funding = normalizeFilterValue(project.funding);

    const content = [
      project.title,
      project.description,
      project.dept,
      project.department_filter,
      project.category,
      project.category_label,
      project.budget,
      project.funding,
      project.target,
      project.district,
      project.status_text
    ].join(" ").toLowerCase();

    const matchesSearch =
      !filters.search ||
      content.includes(filters.search);

    const matchesDepartment =
      filters.department === "all" ||
      department.includes(filters.department) ||
      departmentLabel.includes(filters.department);

    const matchesYear =
      filters.year === "all" ||
      target.includes(filters.year) ||
      targetYears.includes(filters.year);

    const matchesFund =
      filters.fund === "all" ||
      funding.includes(filters.fund);

    return (
      matchesSearch &&
      matchesDepartment &&
      matchesYear &&
      matchesFund
    );
  });
}

function renderProjectCard(project){
  const description = String(project.description || "");
  const statusClass = project.status_class || getStatusClass(project.status_text);
  const departmentLabel = project.dept || project.department || project.category_label || "Department";
  const staffDeliveryValue =
    project.in_house_engineering_value_formatted ||
    project.in_house_engineering_value ||
    "";

  return `
    <article class="wc-project-card" data-department="${escapeHtml(departmentLabel)}" data-target="${escapeHtml(String(project.target || "").toLowerCase())}" data-project-url="${escapeHtml(buildProjectUrl(project))}" tabindex="0" role="link" aria-label="View details for ${escapeHtml(project.title)}">

      <div class="wc-project-card-top">
        <h3>${escapeHtml(project.title)}</h3>
        <span class="wc-project-category">${escapeHtml(departmentLabel)}</span>
      </div>

      <div class="wc-project-description">
        ${escapeHtml(description)}
      </div>

      ${description.length > 180 ? `<button class="wc-project-read-more" type="button">Read More</button>` : ""}

      <div class="wc-project-metrics">

        <div class="wc-project-metric">
          <span>Project Budget</span>
          <strong>${escapeHtml(project.budget)}</strong>
        </div>

        <div class="wc-project-metric">
          <span>Funding Source</span>
          <strong>${escapeHtml(project.funding)}</strong>
        </div>

        <div class="wc-project-metric">
          <span>Target Year</span>
          <strong>${escapeHtml(project.target)}</strong>
        </div>

      </div>

      <div class="wc-project-card-badges">

        <div class="wc-project-status ${escapeHtml(statusClass)}">
          ${escapeHtml(project.status_text)}
        </div>

        ${project.has_in_house_engineering ? `
          <div
            class="wc-project-card-badge"
            title="Estimated equivalent consultant engineering value delivered internally by County staff. Not included in total project budget."
            aria-label="In-house engineering savings${staffDeliveryValue ? `, ${escapeHtml(staffDeliveryValue)}` : ""}. Estimated equivalent consultant engineering value delivered internally by County staff. Not included in total project budget."
          >
            In-House Eng Savings${staffDeliveryValue ? ` · ${escapeHtml(staffDeliveryValue)}` : ""}
          </div>
        ` : ""}

      </div>

      <div class="wc-project-card-action">View Project</div>

    </article>
  `;
}

function getStatusClass(statusText){
  const status = String(statusText || "").toLowerCase();

  if(status.includes("construction")){
    return "wc-status-construction";
  }

  if(status.includes("design")){
    return "wc-status-design";
  }

  if(status.includes("complete")){
    return "wc-status-complete";
  }

  return "wc-status-planning";
}


function renderProjects(){
  if(!isStandaloneSearchPage && document.body && document.body.classList){
    document.body.classList.add("wc-cip-overview-page");
  }

  const allProjects = getSearchableProjects();
  const overviewStats = getCipOverviewStats(allProjects);
  const filtered = getFilteredProjects();
  const visibleProjects = filtered.slice(0, visibleLimit);
  const departmentOptions = getFilterOptions(allProjects, "dept", [
    "Public Works/Engineering",
    "Beach Operations",
    "Sheriff",
    "Administration",
    "Capital Projects"
  ]);
  const fundOptions = getFilterOptions(allProjects, "funding", [
    "Capital Projects Fund",
    "Transportation Fund",
    "Tourist Development Fund",
    "Grant Funded",
    "Sheriff Fund",
    "General Fund"
  ]);
  const rows = [];

  for(let i = 0; i < visibleProjects.length; i += 3){
    rows.push(visibleProjects.slice(i, i + 3));
  }

  app.innerHTML = `
    <style>

      *{
        box-sizing:border-box;
      }

      body{
        margin:0;
        background:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
      }

      body.wc-cip-overview-page #content{
        max-width:1240px;
        padding:44px 32px 70px;
      }

      body.wc-cip-overview-page .page-nav{
        width:100%;
        max-width:1180px;
        margin:12px auto 0 auto;
        padding:14px 20px 0 20px;
        border-top:1px solid rgba(36,52,77,0.10);
        box-sizing:border-box;
      }

      body.wc-cip-overview-page .page-nav a{
        min-height:34px;
        padding:7px 14px;
        font-size:12px;
      }

      .wc-cip-main-section{
        position:relative;
        width:100vw;
        max-width:100vw;
        left:50%;
        margin-left:-50vw;
        margin-right:-50vw;
        padding:0 20px 0 20px;
        box-sizing:border-box;
        background:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
        overflow:visible;
      }

      .wc-cip-main-inner{
        width:100%;
        max-width:1180px;
        margin:0 auto;
        overflow:visible;
      }

      .wc-cip-sticky-nav-shell{
        position:sticky;
        top:0;
        z-index:1000;
        width:100%;
        max-width:1180px;
        margin-left:auto;
        margin-right:auto;
        margin-bottom:12px;
        padding:7px 0 9px 0;
        background:transparent;
        border-bottom:0;
        box-shadow:none;
        box-sizing:border-box;
      }

      .wc-cip-sticky-nav-shell::after{
        content:"";
        position:absolute;
        left:50%;
        bottom:0;
        width:100vw;
        height:3px;
        transform:translateX(-50%);
        background:#006231;
        pointer-events:none;
      }

      .wc-cip-proxy-nav{
        display:flex;
        align-items:center;
        justify-content:center;
        flex-wrap:wrap;
        gap:0;
        width:100%;
        max-width:1180px;
        margin:0;
        padding:0 12px;
        background:transparent;
        backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
        box-sizing:border-box;
        margin-left:auto;
        margin-right:auto;
      }

      .wc-cip-proxy-button,
      .wc-cip-proxy-link{
        position:relative;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:34px;
        margin:5px 2px;
        padding:0 12px;
        border:0;
        border-radius:999px;
        background:transparent;
        color:#172033;
        font-family:Arial, Helvetica, sans-serif;
        font-size:11px;
        font-weight:800;
        letter-spacing:.05em;
        text-transform:uppercase;
        text-decoration:none;
        cursor:pointer;
        transition:
          background .22s ease,
          border-color .22s ease,
          color .22s ease,
          transform .22s ease;
      }

      .wc-cip-proxy-button::after,
      .wc-cip-proxy-link::after{
        display:none;
      }

      .wc-cip-proxy-button:hover,
      .wc-cip-proxy-link:hover{
        color:#006231;
      }

      .wc-cip-proxy-button.is-active,
      .wc-cip-proxy-button:hover,
      .wc-cip-proxy-link:hover{
        background:#00623114;
        color:#006231;
      }

      .wc-cip-proxy-button.is-active{
        background:#00623114;
        color:#006231;
      }

      .wc-cip-proxy-link.wc-cip-proxy-search{
        margin-left:8px;
        padding:0 12px;
        background:#006231;
        color:#ffffff;
      }

      .wc-cip-proxy-link.wc-cip-proxy-search:hover{
        color:#ffffff;
        background:#004f28;
      }

      .wc-intro-section{
        position:relative;
        width:100vw;
        max-width:100vw;
        left:50%;
        margin-left:-50vw;
        margin-right:-50vw;
        padding:28px 20px 24px 20px;
        box-sizing:border-box;
        font-family:Arial, Helvetica, sans-serif;
        background:#ffffff;
      }

      #wc-cip-overview,
      #wc-cip-at-glance,
      #wc-project-search{
        scroll-margin-top:160px;
      }

      .wc-intro-inner{
        max-width:100%;
        width:100%;
        max-width:980px;
        padding:0 18px;
        box-sizing:border-box;
        margin:0 auto;
        text-align:left;
      }

      .wc-intro-inner span{
        display:block;
        margin-bottom:8px;
        color:#006231;
        font-size:11px;
        font-weight:700;
        letter-spacing:.14em;
        text-transform:uppercase;
        text-align:center;
      }

      .wc-intro-inner h2{
        margin:0 0 10px 0;
        color:#172033;
        font-size:30px;
        line-height:1.12;
        font-weight:700;
        text-align:center;
      }

      .wc-intro-inner h2::after{
        content:"";
        display:block;
        width:62px;
        height:3px;
        margin:10px auto 0 auto;
        border-radius:999px;
        background:linear-gradient(90deg,#006231 0%,#0b7741 100%);
      }

      .wc-intro-inner p{
        margin:0 0 12px 0;
        color:#24344d;
        font-size:14px;
        line-height:1.55;
        text-align:justify;
        text-justify:inter-word;
      }

      .wc-intro-inner p:last-child{
        margin-bottom:0;
      }

      .wc-intro-divider{
        width:100%;
        max-width:100%;
        height:1px;
        margin:22px auto 0 auto;
        background:linear-gradient(90deg, rgba(0,98,49,0) 0%, rgba(0,98,49,0.18) 20%, rgba(0,98,49,0.28) 50%, rgba(0,98,49,0.18) 80%, rgba(0,98,49,0) 100%);
      }

      .wc-cip-page-header{
        margin:0 0 28px;
        font-family:Arial, Helvetica, sans-serif;
      }

      .wc-cip-page-header .page-intro{
        max-width:820px;
        text-align:left;
      }

      .wc-budget-strip-section{
        padding:8px 0 28px 0;
      }

      .wc-cip-feature-section,
      .wc-cip-info-section{
        width:100% !important;
        max-width:100% !important;
        padding:0 0 28px 0 !important;
        box-sizing:border-box !important;
        overflow-x:hidden !important;
        background:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
      }

      .wc-cip-feature-grid,
      .wc-cip-info-grid{
        display:flex;
        flex-direction:row;
        align-items:stretch;
        gap:16px;
        width:100% !important;
        max-width:1180px !important;
        margin:0 auto !important;
        box-sizing:border-box !important;
        overflow:hidden !important;
      }

      .wc-cip-info-grid{
        gap:18px;
      }

      .wc-cip-feature-card{
        flex:1 1 0;
        min-width:0;
        display:grid;
        grid-template-columns:42% 58%;
        align-items:stretch;
        overflow:hidden;
        border-radius:16px;
        background:#ffffff;
        border:1px solid rgba(209,190,120,0.42);
        box-shadow:
          0 8px 20px rgba(0,98,49,0.07),
          0 3px 8px rgba(36,52,77,0.05);
        box-sizing:border-box;
      }

      .wc-cip-feature-image{
        min-height:220px;
        overflow:hidden;
      }

      .wc-cip-feature-image img{
        width:100%;
        height:100%;
        min-height:220px;
        object-fit:cover;
        display:block;
      }

      .wc-cip-feature-content{
        padding:22px;
        box-sizing:border-box;
        display:flex;
        flex-direction:column;
        justify-content:center;
      }

      .wc-cip-feature-content span,
      .wc-cip-label{
        display:block;
        margin-bottom:8px;
        color:#006231;
        font-size:10px;
        font-weight:700;
        letter-spacing:.14em;
        text-transform:uppercase;
      }

      .wc-cip-feature-content h2,
      .wc-cip-content h2{
        margin:0 0 10px 0;
        color:#172033;
        font-size:21px;
        line-height:1.15;
        font-weight:700;
      }

      .wc-cip-content h2{
        margin-bottom:12px;
        font-size:22px;
      }

      .wc-cip-feature-content h2::after,
      .wc-cip-content h2::after{
        content:"";
        display:block;
        width:54px;
        height:3px;
        margin:10px 0 0 0;
        border-radius:999px;
        background:linear-gradient(90deg,#006231 0%,#0b7741 100%);
      }

      .wc-cip-feature-content p,
      .wc-cip-content p{
        margin:0;
        color:#24344d;
        font-size:13px;
        line-height:1.55;
        text-align:left;
      }

      .wc-cip-content p{
        margin:0 0 12px 0;
        line-height:1.56;
      }

      .wc-cip-panel{
        flex:1 1 0;
        min-width:0;
        max-width:100%;
        box-sizing:border-box;
        background:#ffffff;
        border-radius:16px;
        overflow:hidden;
        border:1px solid rgba(209,190,120,0.35);
        box-shadow:
          0 9px 22px rgba(0,98,49,0.07),
          0 3px 9px rgba(36,52,77,0.05);
        transition:transform .28s ease, box-shadow .28s ease;
      }

      .wc-cip-panel:hover{
        transform:translateY(-2px);
        box-shadow:
          0 14px 28px rgba(0,98,49,0.10),
          0 6px 14px rgba(36,52,77,0.07);
      }

      .wc-cip-video{
        position:relative;
        width:100% !important;
        overflow:hidden;
        background:#000000;
      }

      .wc-cip-video iframe{
        display:block;
        width:100% !important;
        height:240px;
        border:0;
      }

      .wc-cip-content{
        padding:22px 22px 20px 22px;
        box-sizing:border-box;
      }

      .wc-cip-list{
        margin:14px 0 0 0;
        padding:0;
        list-style:none;
      }

      .wc-cip-list li{
        position:relative;
        padding:0 0 0 17px;
        margin:0 0 12px 0;
        color:#24344d;
        font-size:13px;
        line-height:1.5;
        text-align:left;
      }

      .wc-cip-list li:last-child{
        margin-bottom:0;
      }

      .wc-cip-list li::before{
        content:"";
        position:absolute;
        left:0;
        top:8px;
        width:8px;
        height:8px;
        border-radius:999px;
        background:linear-gradient(135deg,#006231 0%,#0b7741 100%);
        box-shadow:0 0 0 3px rgba(0,98,49,0.10);
      }

      .wc-cip-list strong{
        color:#172033;
      }

      .wc-cip-story-hero{
        position:relative;
        min-height:520px;
        margin:0 0 24px;
        overflow:hidden;
        border-radius:30px;
        background:#10251d;
      }

      .wc-cip-story-hero img{
        width:100%;
        height:100%;
        min-height:520px;
        object-fit:cover;
        filter:saturate(.94) contrast(1.03);
      }

      .wc-cip-story-hero::after{
        content:"";
        position:absolute;
        inset:0;
        background:linear-gradient(90deg, rgba(0,31,20,.86) 0%, rgba(0,31,20,.54) 44%, rgba(0,31,20,.1) 100%);
      }

      .wc-cip-story-panel{
        position:absolute;
        left:clamp(24px, 5vw, 58px);
        bottom:clamp(24px, 5vw, 54px);
        z-index:1;
        width:min(640px, calc(100% - 48px));
        padding:30px;
        border:1px solid rgba(255,255,255,.24);
        border-radius:26px;
        background:rgba(255,255,255,.14);
        color:#ffffff;
        backdrop-filter:blur(14px);
      }

      .wc-cip-kicker{
        display:block;
        margin:0 0 10px;
        color:#003f28;
        font-size:12px;
        font-weight:900;
        letter-spacing:.16em;
        text-transform:uppercase;
      }

      .wc-cip-story-panel .wc-cip-kicker{
        color:#f1dc94;
      }

      .wc-cip-story-panel h1{
        margin:0 0 16px;
        color:#ffffff;
        font-family:Georgia, "Times New Roman", serif;
        font-size:clamp(42px, 6vw, 76px);
        line-height:.96;
        font-weight:500;
        letter-spacing:0;
      }

      .wc-cip-story-panel p{
        max-width:560px;
        margin:0;
        color:rgba(255,255,255,.88);
        font-size:17px;
        line-height:1.65;
      }

      .wc-cip-overview-metrics{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:1px;
        margin:0 0 72px;
        overflow:hidden;
        border:1px solid rgba(0,63,40,.12);
        border-radius:24px;
        background:rgba(0,63,40,.12);
      }

      .wc-cip-overview-metrics-two{
        grid-template-columns:repeat(2, minmax(0,1fr));
      }

      .wc-cip-overview-metric{
        padding:24px;
        background:#f7fbf7;
      }

      .wc-cip-overview-metric strong{
        display:block;
        color:#003f28;
        font-size:clamp(30px, 4vw, 46px);
        line-height:1;
      }

      .wc-cip-overview-metric span{
        display:block;
        margin-top:10px;
        color:#607184;
        font-size:12px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .wc-cip-story-section{
        margin:0 0 76px;
      }

      .wc-cip-story-header{
        max-width:820px;
        margin:0 0 28px;
      }

      .wc-cip-story-header h2,
      .wc-cip-story-copy h2{
        margin:0 0 14px;
        color:#172033;
        font-family:Georgia, "Times New Roman", serif;
        font-size:clamp(34px, 4vw, 58px);
        line-height:1.05;
        font-weight:500;
      }

      .wc-cip-story-header p,
      .wc-cip-story-copy p{
        margin:0 0 14px;
        color:#607184;
        font-size:16px;
        line-height:1.75;
      }

      .wc-cip-gfoa-section{
        display:grid;
        grid-template-columns:minmax(280px,.42fr) minmax(0,.58fr);
        gap:30px;
        align-items:start;
      }

      .wc-cip-gfoa-media{
        display:grid;
        gap:14px;
      }

      .wc-cip-gfoa-copy{
        padding-top:4px;
      }

      .wc-cip-gfoa-copy h3{
        margin:0 0 16px;
        color:#172033;
        font-family:Georgia, "Times New Roman", serif;
        font-size:clamp(28px, 3vw, 42px);
        line-height:1.08;
        font-weight:500;
      }

      .wc-cip-gfoa-copy > p{
        max-width:720px;
        margin:0 0 26px;
        color:#607184;
        font-size:16px;
        line-height:1.75;
      }

      .wc-cip-element-grid{
        display:grid;
        grid-template-columns:repeat(2, minmax(0,1fr));
        gap:14px;
        margin:0 0 30px;
      }

      .wc-cip-element-card{
        min-height:178px;
        padding:20px;
        border:1px solid rgba(0,63,40,.12);
        border-radius:18px;
        background:#f7fbf7;
      }

      .wc-cip-element-card strong{
        display:block;
        margin:0 0 10px;
        color:#003f28;
        font-size:18px;
        line-height:1.2;
      }

      .wc-cip-element-card p{
        margin:0;
        color:#526577;
        font-size:14px;
        line-height:1.65;
      }

      .wc-cip-gfoa-video{
        position:relative;
        min-height:190px;
        overflow:hidden;
        border:1px solid rgba(0,63,40,.12);
        border-radius:18px;
        background:#07140f;
      }

      .wc-cip-gfoa-video iframe{
        display:block;
        width:100%;
        height:220px;
        border:0;
      }

      .wc-cip-finance-list{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:14px;
        margin:0;
        padding:0;
        list-style:none;
      }

      .wc-cip-finance-list li{
        padding:18px;
        border:1px solid rgba(0,63,40,.12);
        border-radius:18px;
        background:#ffffff;
        color:#526577;
        font-size:14px;
        line-height:1.6;
      }

      .wc-cip-finance-list strong{
        display:block;
        margin-bottom:4px;
        color:#003f28;
        font-size:13px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .wc-cip-fund-grid{
        display:grid;
        grid-template-columns:repeat(5, minmax(0,1fr));
        gap:14px;
      }

      .wc-cip-fund-card,
      .wc-cip-process-card,
      .wc-cip-link-card{
        border:1px solid rgba(23,32,51,.11);
        border-radius:24px;
        background:rgba(255,255,255,.9);
        box-shadow:0 14px 34px rgba(23,32,51,.08);
      }

      .wc-cip-fund-card{
        display:flex;
        flex-direction:column;
        min-height:230px;
        padding:22px;
        color:inherit;
        text-decoration:none;
      }

      .wc-cip-fund-card small{
        display:block;
        min-height:46px;
        color:#607184;
        font-size:12px;
        font-weight:900;
        letter-spacing:.08em;
        line-height:1.35;
        text-transform:uppercase;
      }

      .wc-cip-fund-card strong{
        display:block;
        margin-top:18px;
        color:#003f28;
        font-size:clamp(28px, 3vw, 42px);
        line-height:1;
      }

      .wc-cip-fund-card p{
        margin:16px 0 0;
        color:#607184;
        font-size:14px;
        line-height:1.55;
      }

      .wc-cip-fund-card span{
        margin-top:auto;
        padding-top:18px;
        color:#003f28;
        font-size:13px;
        font-weight:900;
      }

      .wc-cip-story-grid{
        display:grid;
        grid-template-columns:minmax(0, .95fr) minmax(0, 1.05fr);
        gap:28px;
        align-items:start;
      }

      .wc-cip-story-image{
        overflow:hidden;
        border-radius:26px;
      }

      .wc-cip-story-image img{
        width:100%;
        min-height:420px;
        object-fit:cover;
      }

      .wc-cip-process-grid{
        display:grid;
        grid-template-columns:repeat(4, minmax(0,1fr));
        gap:14px;
        margin-top:24px;
      }

      .wc-cip-process-card{
        padding:22px;
      }

      .wc-cip-process-card strong{
        display:flex;
        align-items:center;
        justify-content:center;
        width:34px;
        height:34px;
        margin-bottom:18px;
        border-radius:999px;
        background:#003f28;
        color:#ffffff;
        font-size:14px;
      }

      .wc-cip-process-card h3{
        margin:0 0 10px;
        color:#172033;
        font-size:18px;
        line-height:1.2;
      }

      .wc-cip-process-card p{
        margin:0;
        color:#607184;
        font-size:14px;
        line-height:1.6;
      }

      .wc-cip-link-grid{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:14px;
      }

      .wc-cip-link-card{
        display:flex;
        flex-direction:column;
        min-height:170px;
        padding:24px;
        color:inherit;
        text-decoration:none;
      }

      .wc-cip-link-card h3{
        margin:0 0 10px;
        color:#172033;
        font-size:20px;
      }

      .wc-cip-link-card p{
        margin:0;
        color:#607184;
        font-size:14px;
        line-height:1.6;
      }

      .wc-cip-link-card span{
        margin-top:auto;
        padding-top:18px;
        color:#003f28;
        font-size:13px;
        font-weight:900;
      }

      @media(max-width:1050px){
        .wc-cip-overview-metrics,
        .wc-cip-fund-grid,
        .wc-cip-process-grid,
        .wc-cip-link-grid{
          grid-template-columns:repeat(2, minmax(0,1fr));
        }

        .wc-cip-gfoa-section{
          grid-template-columns:1fr;
        }

        .wc-cip-gfoa-media{
          grid-template-columns:repeat(2, minmax(0,1fr));
        }

        .wc-cip-story-grid{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:680px){
        .wc-cip-story-hero,
        .wc-cip-story-hero img{
          min-height:540px;
        }

        .wc-cip-story-panel{
          left:16px;
          bottom:16px;
          width:calc(100% - 32px);
          padding:22px;
          border-radius:22px;
        }

        .wc-cip-overview-metrics,
        .wc-cip-fund-grid,
        .wc-cip-process-grid,
        .wc-cip-link-grid,
        .wc-cip-element-grid,
        .wc-cip-finance-list,
        .wc-cip-gfoa-media{
          grid-template-columns:1fr;
        }

        .wc-cip-story-section{
          margin-bottom:54px;
        }

        .wc-cip-story-image img{
          min-height:280px;
        }

        .wc-cip-gfoa-video iframe{
          height:210px;
        }
      }

      .wc-project-index-section{
        position:relative;
        width:100vw;
        max-width:100vw;
        left:50%;
        margin-left:-50vw;
        margin-right:-50vw;
        padding:34px 24px;
        background:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
        box-sizing:border-box;
      }

      .wc-project-index-inner{
        width:100%;
        max-width:1180px;
        margin:0 auto;
      }

      .wc-project-index-header{
        margin-bottom:22px;
        padding:28px;
        border:1px solid rgba(0,63,40,.12);
        border-radius:28px;
        background:#f7fbf7;
      }

      .wc-project-index-header .page-intro{
        max-width:760px;
      }

      .wc-project-search-stats{
        display:grid;
        grid-template-columns:repeat(3, minmax(0,1fr));
        gap:1px;
        margin-top:24px;
        overflow:hidden;
        border:1px solid rgba(0,63,40,.12);
        border-radius:20px;
        background:rgba(0,63,40,.12);
      }

      .wc-project-search-stat{
        padding:18px;
        background:#ffffff;
      }

      .wc-project-search-stat strong{
        display:block;
        color:#003f28;
        font-size:28px;
        line-height:1;
      }

      .wc-project-search-stat span{
        display:block;
        margin-top:8px;
        color:#607184;
        font-size:11px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .wc-project-full-search-row{
        display:flex;
        justify-content:flex-start;
        margin:18px 0 26px 0;
      }

      .wc-project-full-search-link{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:42px;
        padding:0 18px;
        border-radius:999px;
        border:1px solid rgba(0,63,40,.18);
        background:#ffffff;
        color:#003f28;
        font-family:Arial, Helvetica, sans-serif;
        font-size:12px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
        text-decoration:none;
        box-shadow:none;
        transition:transform .22s ease, box-shadow .22s ease;
      }

      .wc-project-full-search-link:hover{
        transform:translateY(-2px);
        box-shadow:0 10px 20px rgba(23,32,51,.08);
      }

      .wc-project-toolbar{
        display:grid;
        gap:16px;
        margin-bottom:18px;
        padding:18px;
        background:#ffffff;
        border-radius:24px;
        border:1px solid rgba(23,32,51,.10);
        box-shadow:0 14px 34px rgba(23,32,51,.06);
      }

      .wc-project-search-wrap{
        position:relative;
        width:100%;
      }

      .wc-project-search{
        width:100% !important;
        height:58px !important;
        padding:0 18px 0 54px !important;
        text-indent:0 !important;
        border-radius:18px;
        border:1px solid rgba(0,63,40,.13);
        background:#f7fbf7;
        font-size:16px;
        color:#172033;
        outline:none;
        box-sizing:border-box;
        transition:
          border-color .22s ease,
          box-shadow .22s ease,
          background .22s ease;
      }

      .wc-project-search::placeholder{
        color:#5a6e7f;
        opacity:1;
      }

      .wc-project-search:focus{
        border-color:#006231;
        background:#ffffff;
        box-shadow:0 0 0 4px rgba(0,98,49,0.08);
      }

      .wc-project-search-icon{
        position:absolute !important;
        left:20px !important;
        top:50% !important;
        transform:translateY(-50%) !important;
        width:18px !important;
        height:18px !important;
        opacity:.55 !important;
        pointer-events:none !important;
        z-index:2 !important;
      }

      .wc-project-filter-group{
        display:grid;
        grid-template-columns:1fr;
        gap:12px;
        width:100%;
      }

      .wc-project-filter-set{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        align-items:center;
        width:100%;
        padding-top:12px;
        border-top:1px solid rgba(23,32,51,.08);
      }

      .wc-project-filter-label{
        color:#5a6e7f;
        font-size:10px;
        font-weight:800;
        letter-spacing:.12em;
        text-transform:uppercase;
        margin-right:2px;
      }

      .wc-project-filter{
        min-height:36px;
        padding:0 13px;
        border-radius:999px;
        border:1px solid rgba(0,98,49,0.14);
        background:#ffffff;
        color:#172033;
        font-size:12px;
        font-weight:800;
        cursor:pointer;
        transition:
          background .22s ease,
          color .22s ease,
          border-color .22s ease,
          transform .22s ease;
      }

      .wc-project-filter:hover{
        transform:translateY(-1px);
      }

      .wc-project-filter.active{
        background:#003f28;
        color:#ffffff;
        border-color:#003f28;
      }

      .wc-project-results-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin:0 0 14px 0;
        color:#5a6e7f;
        font-size:12px;
        font-weight:700;
      }

      .wc-project-grid{
        display:flex !important;
        flex-direction:column !important;
        gap:14px !important;
        width:100% !important;
        max-width:100% !important;
        margin:0 !important;
        padding:0 !important;
        box-sizing:border-box !important;
      }

      .wc-project-row{
        display:flex !important;
        flex-direction:row !important;
        align-items:stretch !important;
        justify-content:flex-start !important;
        gap:14px !important;
        width:100% !important;
        max-width:100% !important;
        margin:0 !important;
        padding:0 !important;
        box-sizing:border-box !important;
      }

      .wc-project-card{
        cursor:pointer;
        flex:1 1 0 !important;
        width:calc((100% - 28px) / 3) !important;
        max-width:calc((100% - 28px) / 3) !important;
        min-width:0 !important;
        box-sizing:border-box !important;
        position:relative;
        display:flex;
        flex-direction:column;
        align-self:stretch !important;
        gap:13px;
        padding:18px;
        background:#ffffff;
        border-radius:20px;
        border:1px solid rgba(23,32,51,.11);
        box-shadow:0 14px 34px rgba(23,32,51,.06);
        transition:
          transform .24s ease,
          box-shadow .24s ease,
          border-color .24s ease;
      }

      .wc-project-card:hover{
        transform:translateY(-2px);
        border-color:rgba(0,63,40,.22);
        box-shadow:0 18px 42px rgba(23,32,51,.09);
      }

      .wc-project-card-top{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:8px;
      }

      .wc-project-card h3{
        margin:0;
        color:#172033;
        font-size:19px;
        line-height:1.24;
        font-weight:700;
      }

      .wc-project-category{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:5px 8px;
        border-radius:999px;
        background:#f7fbf7;
        color:#003f28;
        font-size:9px;
        font-weight:700;
        letter-spacing:.08em;
        text-transform:uppercase;
        white-space:nowrap;
      }

      .wc-project-description{
        color:#5a6e7f;
        font-size:13px;
        line-height:1.6;
        position:relative;
      }

      .wc-project-card.has-overflow .wc-project-description{
        max-height:54px;
        overflow:hidden;
      }

      .wc-project-card.is-expanded .wc-project-description{
        max-height:none;
        overflow:visible;
      }

      .wc-project-card.has-overflow .wc-project-description::after{
        content:"";
        position:absolute;
        left:0;
        right:0;
        bottom:0;
        height:24px;
        background:linear-gradient(
          180deg,
          rgba(255,255,255,0) 0%,
          #ffffff 85%
        );
        pointer-events:none;
      }

      .wc-project-card.is-expanded .wc-project-description::after{
        display:none;
      }

      .wc-project-read-more{
        align-self:flex-start;
        margin-top:-6px;
        padding:0;
        border:0;
        background:transparent;
        color:#006231;
        font-family:Arial, Helvetica, sans-serif;
        font-size:11px;
        font-weight:800;
        letter-spacing:.06em;
        text-transform:uppercase;
        cursor:pointer;
      }

      .wc-project-read-more:hover{
        text-decoration:underline;
      }

      .wc-project-metrics{
        display:grid;
        grid-template-columns:1fr;
        gap:8px;
        margin-top:auto;
        align-items:stretch;
      }

      .wc-project-metric{
        min-height:auto;
        padding:10px 0;
        border-radius:0;
        background:transparent;
        border:0;
        border-top:1px solid rgba(23,32,51,.08);
        display:flex;
        flex-direction:column;
        justify-content:flex-start;
        box-sizing:border-box;
      }

      .wc-project-metric span{
        display:block;
        margin-bottom:4px;
        color:#5a6e7f;
        font-size:9px;
        font-weight:700;
        letter-spacing:.10em;
        text-transform:uppercase;
      }

      .wc-project-metric strong{
        display:block;
        color:#172033;
        font-size:13px;
        line-height:1.25;
        font-weight:700;
        word-break:break-word;
        overflow-wrap:anywhere;
      }

      .wc-project-metric:first-child strong{
        white-space:nowrap;
      }

      .wc-project-card-action{
        display:inline-flex;
        align-items:center;
        justify-content:flex-start;
        margin-top:2px;
        color:#003f28;
        font-size:12px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .wc-project-card-action::after{
        content:"";
        width:28px;
        height:1px;
        margin-left:10px;
        background:#003f28;
        transition:width .22s ease;
      }

      .wc-project-card:hover .wc-project-card-action::after{
        width:44px;
      }

      .wc-project-status{
        display:inline-flex;
        align-items:center;
        gap:8px;
        width:max-content;
        padding:7px 10px;
        border-radius:999px;
        font-size:10px;
        font-weight:700;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .wc-project-status::before{
        content:"";
        width:8px;
        height:8px;
        border-radius:999px;
        background:currentColor;
      }

      .wc-project-card-badges{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-top:-2px;
      }

      .wc-project-card-badge{
        display:inline-flex;
        align-items:center;
        gap:7px;
        width:max-content;
        padding:7px 9px;
        border-radius:999px;
        background:rgba(52,64,84,0.08);
        color:#24344d;
        border:1px solid rgba(52,64,84,0.16);
        font-size:10px;
        font-weight:800;
        letter-spacing:.04em;
        text-transform:uppercase;
      }

      .wc-status-planning{ background:rgba(209,190,120,0.18); color:#8b6d12; }
      .wc-status-design{ background:rgba(90,110,127,0.12); color:#5a6e7f; }
      .wc-status-construction{ background:rgba(0,98,49,0.12); color:#006231; }
      .wc-status-complete{ background:rgba(52,64,84,0.10); color:#24344d; }

      .wc-project-empty{
        display:none;
        padding:24px 16px;
        text-align:center;
        color:#5a6e7f;
        font-size:13px;
      }

      .wc-project-load-more{
        display:none;
        margin:20px auto 0 auto;
        padding:11px 18px;
        border:0;
        border-radius:999px;
        background:linear-gradient(135deg,#006231 0%,#0b7741 100%);
        color:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
        font-size:12px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
        cursor:pointer;
        box-shadow:0 10px 24px rgba(0,98,49,0.16);
        transition:transform .22s ease, box-shadow .22s ease;
      }

      .wc-project-load-more:hover{
        transform:translateY(-2px);
        box-shadow:0 14px 28px rgba(0,98,49,0.20);
      }

      @media(max-width:1100px){
        .wc-cip-feature-grid,
        .wc-cip-info-grid{
          flex-direction:column;
        }

        .wc-cip-feature-card,
        .wc-cip-panel{
          width:100%;
        }

        .wc-project-row{
          flex-wrap:wrap !important;
        }

        .wc-project-card{
          flex:0 1 calc((100% - 24px) / 2) !important;
          width:calc((100% - 24px) / 2) !important;
          max-width:calc((100% - 24px) / 2) !important;
        }
      }

      @media(max-width:760px){
        .wc-cip-main-section{
          width:100% !important;
          max-width:100% !important;
          left:auto !important;
          margin-left:0 !important;
          margin-right:0 !important;
          padding:0 12px 0 12px;
        }

        .wc-cip-sticky-nav-shell{
          width:100% !important;
          max-width:100% !important;
          margin-left:auto !important;
          margin-right:auto !important;
          margin-bottom:14px;
          padding:0;
        }

        .wc-cip-proxy-nav{
          justify-content:flex-start;
          flex-wrap:nowrap;
          gap:0;
          margin:0;
          padding:0 8px;
          border-radius:0;
          overflow-x:auto;
          -webkit-overflow-scrolling:touch;
          scrollbar-width:none;
        }

        .wc-cip-proxy-nav::-webkit-scrollbar{
          display:none;
        }

        .wc-cip-proxy-button,
        .wc-cip-proxy-link{
          flex:0 0 auto;
          min-height:40px;
          padding:0 10px;
          font-size:10px;
          white-space:nowrap;
        }

        .wc-intro-section{
          width:100% !important;
          max-width:100% !important;
          left:auto !important;
          margin-left:0 !important;
          margin-right:0 !important;
          padding:24px 0 20px 0;
        }

        .wc-intro-inner{
          padding:0 12px;
        }

        .wc-intro-inner h2{
          font-size:26px;
        }

        .wc-intro-inner p{
          font-size:13px;
          line-height:1.5;
          text-align:left;
        }

        .wc-cip-feature-section,
        .wc-cip-info-section{
          padding:0 0 22px 0 !important;
        }

        .wc-cip-feature-card{
          display:block;
          grid-template-columns:1fr;
          border-radius:14px;
        }

        .wc-cip-feature-image,
        .wc-cip-feature-image img{
          min-height:170px;
        }

        .wc-cip-feature-content{
          padding:18px 16px;
        }

        .wc-cip-feature-content h2,
        .wc-cip-content h2{
          font-size:19px;
        }

        .wc-cip-feature-content p,
        .wc-cip-content p,
        .wc-cip-list li{
          font-size:12px;
          line-height:1.5;
        }

        .wc-cip-panel{
          border-radius:14px;
        }

        .wc-cip-video iframe{
          height:190px;
        }

        .wc-cip-content{
          padding:18px 16px 16px 16px;
        }

        .wc-project-index-section{
          width:100% !important;
          max-width:100% !important;
          left:auto !important;
          margin-left:0 !important;
          margin-right:0 !important;
          padding:24px 12px !important;
          overflow-x:hidden !important;
        }

        .wc-project-index-inner{
          width:100% !important;
          max-width:100% !important;
        }

        .wc-project-index-header{
          margin-bottom:18px;
          padding:22px;
          border-radius:22px;
        }

        .wc-project-search-stats{
          grid-template-columns:1fr;
          margin-top:18px;
        }

        .wc-project-full-search-row{
          margin:18px 0 20px 0;
        }

        .wc-project-full-search-link{
          width:100%;
          min-height:48px;
          padding:0 18px;
          font-size:13px;
        }

        .wc-project-toolbar{
          padding:14px !important;
          border-radius:20px;
          gap:10px;
        }

        .wc-project-search-wrap{
          flex:1 1 100%;
          min-width:0;
          width:100%;
        }

        .wc-project-search{
          height:52px !important;
          padding-left:48px !important;
          font-size:14px !important;
          border-radius:16px;
        }

        .wc-project-search-icon{
          left:16px !important;
          width:15px !important;
          height:15px !important;
        }

        .wc-project-filter-group{
          gap:9px;
        }

        .wc-project-filter-set{
          width:100%;
          gap:7px;
        }

        .wc-project-filter-label{
          width:100%;
          margin-bottom:2px;
          font-size:11px;
        }

        .wc-project-filter{
          height:34px;
          padding:0 10px;
          font-size:12px;
          flex:0 1 auto;
        }

        .wc-project-results-row{
          flex-direction:column;
          align-items:flex-start;
          gap:5px;
          margin-bottom:12px;
          font-size:12px;
        }

        .wc-project-grid{
          gap:12px !important;
        }

        .wc-project-row{
          flex-direction:column !important;
          gap:12px !important;
          width:100% !important;
        }

        .wc-project-card{
          flex:1 1 auto !important;
          width:100% !important;
          max-width:100% !important;
          min-width:0 !important;
          align-self:auto !important;
          padding:15px !important;
          border-radius:14px;
          gap:10px;
        }

        .wc-project-card:hover{
          transform:none;
        }

        .wc-project-card-top{
          flex-direction:column;
          gap:10px;
        }

        .wc-project-card h3{
          font-size:17px;
          line-height:1.22;
        }

        .wc-project-category{
          align-self:flex-start;
          white-space:normal;
          text-align:left;
          line-height:1.25;
        }

        .wc-project-description{
          font-size:12px;
          line-height:1.5;
        }

        .wc-project-card.has-overflow .wc-project-description{
          max-height:66px;
        }

        .wc-project-metrics{
          grid-template-columns:1fr;
          gap:10px;
        }

        .wc-project-metric{
          min-height:auto;
          padding:10px 0;
        }

        .wc-project-metric strong{
          font-size:13px;
          line-height:1.3;
        }

        .wc-project-status{
          width:100%;
          justify-content:center;
          text-align:center;
          padding:8px 10px;
          font-size:10px;
        }

        .wc-project-card-badge{
          width:100%;
          justify-content:center;
          text-align:center;
        }

        .wc-project-load-more{
          width:100%;
          padding:15px 18px;
          font-size:13px;
        }
      }

      @media(max-width:420px){
        .wc-cip-main-section{
          padding:10px 8px 0 8px;
        }

        .wc-cip-feature-grid,
        .wc-cip-info-grid{
          gap:14px;
        }

        .wc-cip-feature-image,
        .wc-cip-feature-image img{
          min-height:150px;
        }

        .wc-cip-feature-content,
        .wc-cip-content{
          padding:16px 14px 15px 14px;
        }

        .wc-cip-feature-content h2,
        .wc-cip-content h2{
          font-size:18px;
        }

        .wc-cip-video iframe{
          height:170px;
        }

        .wc-project-index-section{
          padding:22px 8px !important;
        }

        .wc-project-toolbar{
          padding:10px !important;
        }

        .wc-project-filter{
          flex:1 1 calc(50% - 8px);
          padding:0 8px;
          font-size:11px;
        }

        .wc-project-card{
          padding:14px !important;
        }

        .wc-project-card h3{
          font-size:16px;
        }
      }

    </style>

    ${!isStandaloneSearchPage ? `
    <div class="wc-cip-page-header">
      <div class="page-eyebrow">Capital Projects</div>
      <h1 class="page-title">Capital Improvement Plan</h1>
      <p class="page-intro">Walton County&rsquo;s Capital Improvement Plan connects long-range infrastructure needs with the funding, timing, and project delivery decisions required to support a growing county.</p>
    </div>
    ` : ""}

    <section class="wc-cip-main-section">
      <div class="wc-cip-main-inner">
        ${!isStandaloneSearchPage ? `
        <section class="wc-cip-story-hero" id="wc-cip-overview" aria-label="Capital Improvement Plan overview">
          <img src="../assets/images/Page Images/cip-bridge-construction.jpg" alt="Bridge construction project in Walton County">
          <div class="wc-cip-story-panel">
            <span class="wc-cip-kicker">FY 2027 Capital Improvement Plan</span>
            <h1>Investing in the infrastructure behind everyday life.</h1>
            <p>The CIP identifies major projects that maintain, improve, and expand public infrastructure across roads, public safety, tourism, facilities, drainage, parks, and other county assets.</p>
          </div>
        </section>

        <section class="wc-cip-overview-metrics wc-cip-overview-metrics-two" id="wc-cip-at-glance" aria-label="CIP at a glance">
          <div class="wc-cip-overview-metric">
            <strong>${escapeHtml(formatMoneyShort(overviewStats.totalBudget))}</strong>
            <span>Planned Project Budget</span>
          </div>
          <div class="wc-cip-overview-metric">
            <strong>${escapeHtml(overviewStats.projectCount)}</strong>
            <span>Projects in the Plan</span>
          </div>
        </section>

        <section class="wc-cip-story-section">
          <div class="wc-cip-story-header">
            <span class="wc-cip-kicker">Capital Funding</span>
            <h2>Capital investments by funding source.</h2>
            <p>Capital projects are organized by fund so residents can see how restricted revenues, grants, and county resources are directed toward long-term improvements.</p>
          </div>
          <div class="wc-cip-fund-grid">
            ${overviewStats.fundCards.map(card => `
              <a class="wc-cip-fund-card" href="${escapeHtml(card.href)}">
                <small>${escapeHtml(card.label)}</small>
                <strong>${escapeHtml(formatMoneyShort(card.value))}</strong>
                <p>${escapeHtml(card.text)}</p>
                <span>View Schedule</span>
              </a>
            `).join("")}
          </div>
        </section>

        <section class="wc-cip-story-section">
          <div class="wc-cip-story-grid">
            <div class="wc-cip-story-image">
              <img src="../assets/images/Page Images/cip-project-site.jpg" alt="Walton County capital project site">
            </div>
            <div class="wc-cip-story-copy">
              <span class="wc-cip-kicker">What Counts as Capital</span>
              <h2>Projects with long-term public value.</h2>
              <p>Walton County defines a CIP project as a significant, non-recurring capital expenditure for the construction, expansion, purchase, major repair, or replacement of buildings, utility systems, streets, infrastructure, or public property.</p>
              <p>Projects generally move through land acquisition, planning, design, permitting, engineering, procurement, construction, inspection, and closeout. Larger efforts often span multiple fiscal years as funding, permitting, and construction schedules evolve.</p>
            </div>
          </div>
        </section>

        <section class="wc-cip-story-section" aria-label="Capital project elements and financing">
          <div class="wc-cip-story-header">
            <span class="wc-cip-kicker">Capital Plan Elements</span>
            <h2>What goes into a capital project.</h2>
            <p>Capital Improvement Plan projects are composed of multiple project elements that collectively support planning, development, construction, and long-term delivery of public infrastructure and facilities throughout Walton County.</p>
          </div>
          <div class="wc-cip-gfoa-section">
            <div class="wc-cip-gfoa-media">
              <div class="wc-cip-gfoa-video">
                <iframe src="https://www.youtube-nocookie.com/embed/2ha4PCBgw2Y?controls=1&amp;modestbranding=1&amp;rel=0&amp;playsinline=1" title="Capital Improvement Plan Elements" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
              </div>
              <div class="wc-cip-gfoa-video">
                <iframe src="https://www.youtube.com/embed/UI4QSqOn7o0?controls=1&amp;modestbranding=1&amp;rel=0&amp;playsinline=1" title="Sources of Financing" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
              </div>
            </div>

            <div class="wc-cip-gfoa-copy">
              <span class="wc-cip-kicker">Elements of a Capital Improvement Plan</span>
              <h3>Project elements and funding sources.</h3>
              <p>Capital projects combine physical improvements, professional services, inspections, and financing decisions so each project can move from need identification to long-term public use.</p>
              <div class="wc-cip-element-grid">
                <article class="wc-cip-element-card">
                  <strong>Land</strong>
                  <p>Purchase of necessary property for capital projects, including building acquisitions, rights-of-way, easements, and property needed to support future infrastructure expansion and public facilities.</p>
                </article>
                <article class="wc-cip-element-card">
                  <strong>Construction / Improvements</strong>
                  <p>Expansions, renovations, major replacements, and mechanical or electrical system installations, including site preparation and infrastructure such as sidewalks, streets, parking areas, drainage systems, and utility connections.</p>
                </article>
                <article class="wc-cip-element-card">
                  <strong>Design / Professional Services</strong>
                  <p>Development of plans, specifications, programming, surveying, engineering services, development costs, permitting support, and environmental impact studies necessary for approved capital projects.</p>
                </article>
                <article class="wc-cip-element-card">
                  <strong>Construction Engineering and Inspection</strong>
                  <p>CEI activities and resources include reviewing, monitoring, and inspecting construction projects through plan reviews, material testing, supervision, quality assurance, and compliance oversight.</p>
                </article>
              </div>
              <span class="wc-cip-kicker">Sources of Financing</span>
              <ul class="wc-cip-finance-list">
                <li><strong>Current Revenues</strong>The County primarily funds capital projects on a cash basis using available revenue streams, including resources that may be legally restricted for specific purposes.</li>
                <li><strong>Grants</strong>Capital grants from federal, state, and regional agencies may support eligible projects and can include local match, compliance, and reporting requirements.</li>
                <li><strong>Debt</strong>When appropriate, the County may issue debt to finance major capital projects using fixed or variable, long-term or short-term structures designed to manage cost and risk.</li>
              </ul>
            </div>
          </div>
        </section>

        <section class="wc-cip-story-section">
          <div class="wc-cip-story-header">
            <span class="wc-cip-kicker">Planning Process</span>
            <h2>How projects move into the capital plan.</h2>
          </div>
          <div class="wc-cip-process-grid">
            <article class="wc-cip-process-card">
              <strong>1</strong>
              <h3>Identify Need</h3>
              <p>Departments identify infrastructure, facility, equipment, mobility, and public service needs.</p>
            </article>
            <article class="wc-cip-process-card">
              <strong>2</strong>
              <h3>Evaluate Funding</h3>
              <p>OMB reviews available revenues, restrictions, grants, timing, and long-term financial impact.</p>
            </article>
            <article class="wc-cip-process-card">
              <strong>3</strong>
              <h3>Prioritize Projects</h3>
              <p>Projects are reviewed against community needs, operational priorities, readiness, and policy direction.</p>
            </article>
            <article class="wc-cip-process-card">
              <strong>4</strong>
              <h3>Adopt Budget</h3>
              <p>Appropriated projects become part of the annual budget, while the five-year CIP remains a planning guide.</p>
            </article>
          </div>
        </section>

        <section class="wc-cip-story-section">
          <div class="wc-cip-story-header">
            <span class="wc-cip-kicker">Explore Capital</span>
            <h2>Move from overview to project detail.</h2>
          </div>
          <div class="wc-cip-link-grid">
            <a class="wc-cip-link-card" href="capital-projects.html">
              <h3>Capital Directory</h3>
              <p>Browse the overview, fund schedules, and project search from one capital landing page.</p>
              <span>Open Directory</span>
            </a>
            <a class="wc-cip-link-card" href="search.html">
              <h3>Project Search</h3>
              <p>Search and filter projects by department, fund, year, district, and project status.</p>
              <span>Search Projects</span>
            </a>
            <a class="wc-cip-link-card" href="cip-capital-projects.html">
              <h3>Fund Schedules</h3>
              <p>Review capital schedules by fund, including transportation, tourism, sheriff, grants, and capital projects.</p>
              <span>View Schedules</span>
            </a>
          </div>
        </section>
        ` : ""}
      </div>
    </section>

    ${isStandaloneSearchPage ? `
    <section class="wc-project-index-section">
      <div class="wc-project-index-inner">

        <div class="wc-project-index-header" id="wc-project-search">
          <div class="page-eyebrow">Capital Projects</div>
          <h1 class="page-title">Project Search</h1>
          <p class="page-intro">Browse, search, and filter Walton County capital improvement projects by department, year, and funding source. This project indexed is designed to help residents quickly locate projects relevant to their community.</p>
          <div class="wc-project-search-stats" aria-label="Capital project search summary">
            <div class="wc-project-search-stat">
              <strong>${escapeHtml(allProjects.length)}</strong>
              <span>Projects in Index</span>
            </div>
            <div class="wc-project-search-stat">
              <strong>${escapeHtml(formatMoneyShort(overviewStats.totalBudget))}</strong>
              <span>Planned Budget</span>
            </div>
            <div class="wc-project-search-stat">
              <strong>${escapeHtml(fundOptions.length)}</strong>
              <span>Funding Sources</span>
            </div>
          </div>
        </div>

        ${!isFullView ? `
          <div class="wc-project-full-search-row">
            <a class="wc-project-full-search-link" href="search.html">Open Full Project Search</a>
          </div>
        ` : ""}

        <div class="wc-project-toolbar">

          <div class="wc-project-search-wrap">
            <svg class="wc-project-search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>

            <input
              type="text"
              class="wc-project-search"
              placeholder="Search projects, departments, locations, or funding sources..."
              value="${escapeHtml(filters.search)}"
            >
          </div>

          <div class="wc-project-filter-group">

            <div class="wc-project-filter-set" data-filter-type="department">
              <span class="wc-project-filter-label">Department</span>
              ${renderFilterButton("department", "all", "All")}
              ${departmentOptions.map(option => renderFilterButton("department", option.value, option.label)).join("")}
            </div>

            <div class="wc-project-filter-set" data-filter-type="year">
              <span class="wc-project-filter-label">Year</span>
              <button class="wc-project-filter ${filters.year === "all" ? "active" : ""}" data-filter-type="year" data-filter="all">All</button>
              <button class="wc-project-filter ${filters.year === "fy2027" ? "active" : ""}" data-filter-type="year" data-filter="fy2027">FY2027</button>
              <button class="wc-project-filter ${filters.year === "fy2028" ? "active" : ""}" data-filter-type="year" data-filter="fy2028">FY2028</button>
              <button class="wc-project-filter ${filters.year === "fy2029" ? "active" : ""}" data-filter-type="year" data-filter="fy2029">FY2029</button>
              <button class="wc-project-filter ${filters.year === "fy2030" ? "active" : ""}" data-filter-type="year" data-filter="fy2030">FY2030</button>
              <button class="wc-project-filter ${filters.year === "fy2031" ? "active" : ""}" data-filter-type="year" data-filter="fy2031">FY2031</button>
            </div>

            <div class="wc-project-filter-set" data-filter-type="fund">
              <span class="wc-project-filter-label">Fund</span>
              ${renderFilterButton("fund", "all", "All")}
              ${fundOptions.map(option => renderFilterButton("fund", option.value, option.label)).join("")}
            </div>

          </div>

        </div>

        <div class="wc-project-results-row">
          <div class="wc-project-results-count">Showing ${visibleProjects.length} of ${filtered.length} projects</div>
          <div>Use search and filters to narrow the list.</div>
        </div>

        <div class="wc-project-grid">
          ${rows.map(row => `<div class="wc-project-row">${row.map(renderProjectCard).join("")}</div>`).join("")}
        </div>

        <div class="wc-project-empty" style="display:${filtered.length ? "none" : "block"};">
          No projects match your search criteria.
        </div>

        

      </div>
    </section>
    ` : ""}
  `;

  const searchField = document.querySelector(".wc-project-search");

  if(searchField){
    searchField.addEventListener("input", e => {
      filters.search = e.target.value.trim().toLowerCase();
      resetVisibleLimit();

      clearTimeout(window.wcProjectSearchTimer);

      window.wcProjectSearchTimer = setTimeout(() => {
        renderProjects();

        const refreshedSearchField = document.querySelector(".wc-project-search");

        if(refreshedSearchField){
          refreshedSearchField.focus();
          refreshedSearchField.value = filters.search;
          refreshedSearchField.setSelectionRange(filters.search.length, filters.search.length);
        }
      }, 120);
    });
  }

  document.querySelectorAll(".wc-project-filter")
    .forEach(button => {
      button.addEventListener("click", () => {
        const filterType = button.dataset.filterType;
        const filterValue = button.dataset.filter;

        filters[filterType] = filterValue;
        resetVisibleLimit();
        renderProjects();
      });
    });

  document.querySelectorAll(".wc-project-card").forEach(card => {
    const description = card.querySelector(".wc-project-description");

    if(!description){
      return;
    }

    description.style.maxHeight = "none";
    const fullDescriptionHeight = description.scrollHeight;
    description.style.maxHeight = "";

    if(fullDescriptionHeight > 78){
      card.classList.add("has-overflow");
    }else{
      card.classList.remove("has-overflow");
    }
  });

  document.querySelectorAll(".wc-project-card").forEach(card => {
    card.addEventListener("click", event => {
      if(event.target.closest(".wc-project-read-more")){
        return;
      }

      const projectUrl = card.dataset.projectUrl;

      if(projectUrl){
        window.location.href = projectUrl;
      }
    });

    card.addEventListener("keydown", event => {
      if(event.key !== "Enter" && event.key !== " "){
        return;
      }

      if(event.target.closest(".wc-project-read-more")){
        return;
      }

      event.preventDefault();

      const projectUrl = card.dataset.projectUrl;

      if(projectUrl){
        window.location.href = projectUrl;
      }
    });
  });

  document.querySelectorAll(".wc-project-read-more").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();

      const card = button.closest(".wc-project-card");

      if(!card){
        return;
      }

      card.classList.toggle("is-expanded");
      button.textContent = card.classList.contains("is-expanded") ? "Show Less" : "Read More";
    });
  });
}

function initProjects(){
  if(!app){
    return;
  }

  app.innerHTML = '<div class="wc-data-loading">Loading capital project data...</div>';

  const ready = window.wcCipProjectsReady || Promise.resolve(window.wcCipProjects || []);

  ready.then(() => {
    renderProjects();
  }).catch(error => {
    console.error("Walton CIP: failed to initialize project search", error);
    app.innerHTML = '<div class="wc-project-empty">Capital project data could not be loaded.</div>';
  });
}

initProjects();
