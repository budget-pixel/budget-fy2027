const app = document.getElementById("app");

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}



function displayValue(value, fallback = "Not specified"){
  if(value === null || value === undefined || String(value).trim() === ""){
    return fallback;
  }
  return escapeHtml(value);
}

function parseBudgetAmount(value){
  if(value === null || value === undefined){
    return null;
  }

  let text = String(value).trim();

  if(!text || text.toLowerCase() === "not specified" || text.toLowerCase() === "tbd"){
    return null;
  }

  text = text.replace(/\$/g, "").replace(/,/g, "").trim();

  const multiplierMatch = text.match(/^(-?\d+(?:\.\d+)?)\s*([kKmMbB])$/);

  if(multiplierMatch){
    const number = Number(multiplierMatch[1]);
    const suffix = multiplierMatch[2].toLowerCase();

    if(!Number.isFinite(number)){
      return null;
    }

    if(suffix === "k") return number * 1000;
    if(suffix === "m") return number * 1000000;
    if(suffix === "b") return number * 1000000000;
  }

  const numeric = Number(text);

  if(!Number.isFinite(numeric)){
    return null;
  }

  return numeric;
}

function displayBudgetValue(value, fallback = "Not specified"){
  const amount = parseBudgetAmount(value);

  if(amount === null){
    return displayValue(value, fallback);
  }

  return escapeHtml("$" + Math.round(amount).toLocaleString("en-US"));
}

function hasDisplayValue(value){
  if(value === null || value === undefined){
    return false;
  }

  const text = String(value).trim();

  return text !== "" && text.toLowerCase() !== "not specified" && text.toLowerCase() !== "tbd";
}

function getProjectValue(project, keys, fallback = "Not specified"){
  for(const key of keys){
    if(project[key] !== null && project[key] !== undefined && String(project[key]).trim() !== ""){
      return project[key];
    }
  }
  return fallback;
}

function buildBackHref(){
  const params = new URLSearchParams(window.location.search);
  const returnHref = params.get("return");

  if(returnHref && /^[a-z0-9-]+\.html(?:#[a-z0-9_-]+)?$/i.test(returnHref)){
    return returnHref;
  }

  return "search.html";
}

function buildBackLabel(backHref){
  if(/^cip-/.test(String(backHref || ""))){
    return "Back to Schedule";
  }

  return "Back to Project Search";
}

function normalizeProjectSlug(value){
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getRequestedProjectSlug(){
  const params = new URLSearchParams(window.location.search);
  const paramSlug = params.get("project") || params.get("slug");

  if(paramSlug){
    return normalizeProjectSlug(paramSlug);
  }

  const hashSlug = window.location.hash.replace(/^#\/?/, "");

  if(hashSlug){
    return normalizeProjectSlug(hashSlug);
  }

  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const lastPathPart = pathParts[pathParts.length - 1] || "";
  const pathSlug = lastPathPart.replace(/\.html$/i, "");

  if(pathSlug && !/^cip-project$/i.test(pathSlug)){
    return normalizeProjectSlug(pathSlug);
  }

  return "";
}

function projectMatchesRequestedSlug(project, requestedSlug){
  if(!requestedSlug){
    return false;
  }

  if(normalizeProjectSlug(project.slug) === requestedSlug){
    return true;
  }

  const candidates = [
    project.title,
    project.name,
    project.project_name,
    project.location,
    project.project_location,
    project.location_name,
    project.project_code,
    project.code
  ];

  if(candidates.some(value => normalizeProjectSlug(value) === requestedSlug)){
    return true;
  }

  const searchableText = candidates
    .concat([project.slug, project.description, project.overview, project.summary])
    .map(value => String(value ?? "").toLowerCase())
    .join(" ");

  if(requestedSlug === "baldwin-library-learning-center"){
    return searchableText.includes("baldwin") &&
      searchableText.includes("library") &&
      searchableText.includes("learning") &&
      searchableText.includes("center");
  }

  return false;
}

function renderListItem(label, value){
  if(!hasDisplayValue(value)){
    return "";
  }

  return `
    <div class="wc-project-list-item">
      <span>${escapeHtml(label)}</span>
      <strong>${displayValue(value)}</strong>
    </div>
  `;
}

function renderTimelineItem(label, value){
  if(!hasDisplayValue(value)){
    return "";
  }

  return `
    <div class="wc-project-timeline-item">
      <span>${escapeHtml(label)}</span>
      <strong>${displayValue(value)}</strong>
    </div>
  `;
}

function normalizeProjectImages(project){
  if(Array.isArray(project.images) && project.images.length){
    return project.images
      .map(image => {
        if(typeof image === "string"){
          return {
            url:image,
            caption:"Project image"
          };
        }

        return {
          url:image.url || image.src || "",
          caption:image.caption || image.alt || "Project image"
        };
      })
      .filter(image => image.url);
  }

  if(project.image_url){
    return [{
      url:project.image_url,
      caption:project.image_caption || project.image_alt || "Project image"
    }];
  }

  const fallbackSlugs = [
    project.slug,
    normalizeProjectSlug(project.title),
    normalizeProjectSlug(project.name),
    normalizeProjectSlug(project.project_name),
    normalizeProjectSlug(project.proposal_name),
    normalizeProjectSlug(project.location),
    normalizeProjectSlug(project.location_name),
    normalizeProjectSlug(project.description),
    normalizeProjectSlug(project.pertinent_information)
  ].filter(Boolean);

  if(fallbackSlugs.some(slug => /hu(?:ck|ch)aba/.test(slug) && /(?:^|-)r(?:oa)?d(?:-|$)|bridge/.test(slug))){
    return [{
      url:"../assets/images/project-images/huckaba_road_604114_bridge_replacement.jpg",
      caption:"Project image"
    }];
  }

  const uniqueSlugs = Array.from(new Set(fallbackSlugs));

  if(uniqueSlugs.length){
    return uniqueSlugs.flatMap(slug => [
      {
        url:`../assets/images/project-images/${slug}.jpg`,
        caption:"Project image"
      },
      {
        url:`../assets/images/${slug}.jpg`,
        caption:"Project image"
      }
    ]);
  }

  return [];
}

function handleProjectImageError(imageElement){
  const imageCard = imageElement.closest(".wc-project-image-card");
  const imagePanel = imageElement.closest(".wc-project-panel");

  if(imageCard){
    imageCard.remove();
  }

  if(imagePanel && !imagePanel.querySelector(".wc-project-image-card")){
    imagePanel.remove();
  }
}

function openProjectLightbox(src, caption){
  const lightbox = document.getElementById("wcProjectLightbox");
  const image = document.getElementById("wcProjectLightboxImage");
  const captionEl = document.getElementById("wcProjectLightboxCaption");

  if(!lightbox || !image || !captionEl){
    return;
  }

  image.src = src;
  image.alt = caption || "Project image";
  captionEl.textContent = caption || "";
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
}

function closeProjectLightbox(){
  const lightbox = document.getElementById("wcProjectLightbox");
  const image = document.getElementById("wcProjectLightboxImage");

  if(!lightbox || !image){
    return;
  }

  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden","true");
  image.src = "";
  document.body.style.overflow = "";
}

window.addEventListener("keydown", event => {
  if(event.key === "Escape"){
    closeProjectLightbox();
  }
});

function renderProjectImages(project){
  const images = normalizeProjectImages(project);

  if(!images.length){
    return "";
  }

  return `
    <section class="wc-project-panel">
      <h2>Project Images</h2>
      <div class="wc-project-image-grid">
        ${images.map(image => `
          <figure class="wc-project-image-card">
            <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.caption || project.title || "Project image")}" loading="lazy" decoding="async" onerror="handleProjectImageError(this)" onclick="openProjectLightbox('${escapeHtml(image.url)}','${escapeHtml(image.caption || project.title || "Project image")}')">
            ${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}
          </figure>
        `).join("")}
      </div>
    </section>
  `;
}

function normalizeFundingBreakdown(project){
  const possibleBreakdowns = [
    project.funding_by_year,
    project.fiscal_year_breakdown,
    project.funding_breakdown,
    project.yearly_funding,
    project.budget_by_year,
    project.fy_breakdown
  ];

  const breakdown = possibleBreakdowns.find(item => Array.isArray(item) && item.length);

  if(!breakdown){
    return [];
  }

  return breakdown
    .map(item => {
      if(Array.isArray(item)){
        return {
          year:item[0],
          amount:item[1]
        };
      }

      return {
        year:item.year || item.fiscal_year || item.fy || item.label,
        amount:item.amount || item.value || item.budget || item.funding || item.total
      };
    })
    .filter(item => item.year || item.amount);
}

function renderFundingBreakdown(project){
  const yearlyFunding = normalizeFundingBreakdown(project);

  if(!yearlyFunding.length){
    return "";
  }

  return `
    <h2 style="margin-top:26px;">Fiscal Year Breakdown</h2>
    <div class="wc-project-year-breakdown">
      ${yearlyFunding.map(item => `
        <div class="wc-project-year-row">
          <span>${displayValue(item.year)}</span>
          <strong>${displayBudgetValue(item.amount)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}


function renderStaffDeliveryValue(project){
  if(!project.has_in_house_engineering){
    return "";
  }

  const value = project.in_house_engineering_value_formatted || displayValue(project.in_house_engineering_value);
  const rows = Array.isArray(project.in_house_engineering_rows) ? project.in_house_engineering_rows : [];

  return `
    <section class="wc-project-panel">
      <h2>In-House Engineering</h2>
      <div class="wc-project-staff-value">
        <span class="wc-project-staff-label">Estimated Outsource Cost Avoidance</span>
        <strong>${displayValue(value)}</strong>
        <p>Engineering services for this project are being delivered by Walton County staff rather than external consultants.</p>

        ${rows.length ? `
          <div class="wc-project-staff-rows">
            ${rows.map(row => `
              <div class="wc-project-staff-row">
                <span>${displayValue(row.year,"Fiscal Year")}</span>
                <strong>${displayValue(row.amount)}</strong>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    </section>
  `;
}

function renderOverviewBadges(project){
  const badges = [];

  if(project.has_in_house_engineering){
    badges.push(`
      <div class="wc-project-highlight-badge">
        In-House Engineering · ${displayValue(project.in_house_engineering_value_formatted || project.in_house_engineering_value)}
      </div>
    `);
  }

  // Removed Priority badge block

  if(!badges.length){
    return "";
  }

  return `
    <div class="wc-project-highlight-badges">
      ${badges.join("")}
    </div>
  `;
}

function renderProjectPage(){
  const slug = getRequestedProjectSlug();
  const projects = Array.isArray(window.wcCipProjects) ? window.wcCipProjects : [];
  const project = projects.find(p => projectMatchesRequestedSlug(p, slug));
  const backHref = buildBackHref();
  const backLabel = buildBackLabel(backHref);

  if(!project){

    app.innerHTML = `
      <div class="wc-project-not-found">
        <h1>Project Not Found</h1>
        <p>The requested project could not be located.</p>
        <p><a class="wc-project-back" href="${backHref}">&larr; ${backLabel}</a></p>
      </div>
    `;

    return;
  }

  const category = getProjectValue(project,["category_label","category"]);
  const title = getProjectValue(project,["title"],"Untitled Project");
  const description = getProjectValue(project,["description","overview","summary"],"No project description is currently available.");
  const statusText = getProjectValue(project,["status_text","status"],"Status not specified");
  const statusClass = displayValue(project.status_class,"wc-status-planning");
  const budget = getProjectValue(project,["budget","project_budget","total_budget","cost"]);
  const funding = getProjectValue(project,["funding","funding_source","source"]);
  const district = getProjectValue(project,["district","commission_district"]);
  const target = getProjectValue(project,["target","target_year","year","fiscal_year"]);
  const department = getProjectValue(project,["department","related_department","dept"]);
  const location = getProjectValue(project,["location","project_location","address"]);
  const fiscalYear = getProjectValue(project,["fiscal_year","fy","year"]);

  app.innerHTML = `

    <main class="wc-project-page">

      <div class="wc-project-actions">
        <a class="wc-project-back" href="${backHref}">&larr; ${backLabel}</a>
      </div>

      <section class="wc-project-hero">
        <div class="page-eyebrow">${displayValue(category, "Capital Projects")}</div>
        <h1 class="wc-project-title page-title">
          ${displayValue(title)}
        </h1>
      </section>

      <div class="wc-project-grid">

        <div class="wc-project-stack">

          <section class="wc-project-panel">
            <h2>Project Overview</h2>
            <p class="wc-project-overview-text">${displayValue(description)}</p>
          </section>

          ${renderProjectImages(project)}

          <section class="wc-project-panel">
            <h2>Budget & Funding Summary</h2>

            <div class="wc-project-budget-highlight">
              <span>Project Budget</span>
              <strong>${displayBudgetValue(budget)}</strong>
            </div>

            <div class="wc-project-list">
              ${renderListItem("Funding Source", funding)}
            </div>

            ${renderFundingBreakdown(project)}
          </section>

          ${renderStaffDeliveryValue(project)}

        </div>

        <div class="wc-project-stack">

          <section class="wc-project-panel">
            <h2>Project Details</h2>
            <div class="wc-project-list">
              ${renderListItem("Department", department)}
              ${renderListItem("Project Manager", project.project_manager)}
              ${renderListItem("District", district)}
              ${renderListItem("Location", location)}
            </div>
          </section>

          <section class="wc-project-panel">
            <h2>Status & Timeline</h2>
            <div class="wc-project-timeline">
              ${renderTimelineItem("Status", statusText)}
              ${renderTimelineItem("Start Date", project.start_date)}
              ${renderTimelineItem("Estimated Completion", project.estimated_completion_date)}
              ${renderTimelineItem("Target Year", target)}
            </div>
          </section>

        </div>

      </div>

      <div id="wcProjectLightbox" class="wc-project-lightbox" aria-hidden="true" onclick="if(event.target === this){ closeProjectLightbox(); }">
        <div class="wc-project-lightbox-inner">
          <button class="wc-project-lightbox-close" type="button" aria-label="Close image" onclick="closeProjectLightbox()">x</button>
          <img id="wcProjectLightboxImage" src="" alt="">
          <div id="wcProjectLightboxCaption" class="wc-project-lightbox-caption"></div>
        </div>
      </div>
      </main>
  `;

}

function initProjectPage(){
  if(!app){
    return;
  }

  app.innerHTML = '<div class="wc-data-loading">Loading capital project...</div>';

  const ready = window.wcCipProjectsReady || Promise.resolve(window.wcCipProjects || []);

  ready.then(() => {
    renderProjectPage();
  }).catch(error => {
    console.error("Walton CIP: failed to initialize project detail", error);
    app.innerHTML = '<div class="wc-project-not-found"><h1>Project Not Found</h1><p>Capital project data could not be loaded.</p></div>';
  });
}

initProjectPage();
