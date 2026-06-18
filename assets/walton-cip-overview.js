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

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFilteredProjects(){
  return wcCipProjects.filter(project => {
    const department = String(project.dept || project.department || "").toLowerCase();
    const target = String(project.target || "").toLowerCase();
    const funding = String(project.funding || "").toLowerCase();

    const content = [
      project.title,
      project.description,
      project.dept,
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
      department.includes(filters.department);

    const matchesYear =
      filters.year === "all" ||
      target.includes(filters.year);

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
          <span>District</span>
          <strong>${escapeHtml(project.district)}</strong>
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

function initBudgetCounters(){
  const section = document.querySelector(".wc-budget-strip");
  const counters = document.querySelectorAll(".wc-budget-count");

  if(!section || !counters.length){
    return;
  }

  function formatValue(value, decimals){
    return Number(value).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function animateCounters(){
    counters.forEach(counter => {
      const target = Number(counter.dataset.target || 0);
      const prefix = counter.dataset.prefix || "";
      const suffix = counter.dataset.suffix || "";
      const decimals = Number(counter.dataset.decimals || 0);
      const duration = 1100;
      const startTime = performance.now();

      function update(now){
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = target * eased;

        counter.textContent = prefix + formatValue(currentValue, decimals) + suffix;

        if(progress < 1){
          requestAnimationFrame(update);
        }else{
          counter.textContent = prefix + formatValue(target, decimals) + suffix;
        }
      }

      counter.textContent = prefix + formatValue(0, decimals) + suffix;
      requestAnimationFrame(update);
    });
  }

  if("IntersectionObserver" in window){
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          animateCounters();
          observer.disconnect();
        }
      });
    }, { threshold: .35 });

    observer.observe(section);
  }else{
    animateCounters();
  }
}

function renderProjects(){
  const filtered = getFilteredProjects();
  const visibleProjects = filtered.slice(0, visibleLimit);
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

      .wc-video-hero{
        position:relative;
        width:100%;
        height:clamp(420px, 56vh, 620px);
        overflow:hidden;
        background:#24344d;
        font-family:Arial, Helvetica, sans-serif;
        border-radius:32px;
        isolation:isolate;
        box-shadow:
          0 10px 24px rgba(36,52,77,0.14),
          0 3px 8px rgba(36,52,77,0.08),
          0 1px 0 rgba(255,255,255,0.05) inset;
      }

      .wc-video-hero::before{
        content:"";
        position:absolute;
        inset:0;
        border:1px solid rgba(209,190,120,0.32);
        border-radius:32px;
        box-shadow:
          inset 0 0 0 1px rgba(255,255,255,0.08),
          inset 0 -18px 28px rgba(0,0,0,0.06);
        z-index:4;
        pointer-events:none;
      }

      .wc-video-frame{
        position:absolute;
        top:50%;
        left:50%;
        width:100vw;
        height:56.25vw;
        min-width:177.78vh;
        min-height:100%;
        transform:translate(-50%, -50%);
        border:0;
        pointer-events:none;
        z-index:1;
      }

      .wc-video-overlay{
        position:absolute;
        inset:0;
        background:
          radial-gradient(circle at center, rgba(255,255,255,0) 54%, rgba(20,30,45,0.12) 100%),
          linear-gradient(to bottom, rgba(20,30,45,0.04) 0%, rgba(20,30,45,0.08) 58%, rgba(20,30,45,0.12) 100%),
          linear-gradient(90deg, rgba(0,98,49,0.10) 0%, rgba(0,98,49,0) 28%, rgba(0,98,49,0) 72%, rgba(209,190,120,0.08) 100%);
        z-index:2;
        pointer-events:none;
      }

      .wc-video-content{
        position:relative;
        z-index:3;
        width:100%;
        max-width:1280px;
        height:100%;
        margin:0 auto;
        padding:0 42px;
        box-sizing:border-box;
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:center;
        text-align:center;
        color:#ffffff;
      }

      .wc-video-title-box{
        display:inline-block;
        max-width:1080px;
        padding:32px 52px 34px 52px;
        border-radius:28px;
        background:linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.13) 100%);
        border:1px solid rgba(255,255,255,0.30);
        backdrop-filter:blur(16px) saturate(130%);
        -webkit-backdrop-filter:blur(16px) saturate(130%);
        box-shadow:
          0 8px 18px rgba(0,0,0,0.16),
          inset 0 1px 0 rgba(255,255,255,0.26),
          0 0 18px rgba(209,190,120,0.10);
        animation:wcHeroFadeIn 1.4s ease forwards;
      }

      @keyframes wcHeroFadeIn{
        from{ opacity:0; transform:translateY(22px); }
        to{ opacity:1; transform:translateY(0); }
      }

      .wc-video-content span{
        display:inline-block;
        margin-bottom:18px;
        font-size:13px;
        font-weight:700;
        letter-spacing:.18em;
        text-transform:uppercase;
        color:#f1dc94;
        text-shadow:0 2px 10px rgba(0,0,0,0.34);
      }

      .wc-video-content h1{
        max-width:1000px;
        margin:0;
        font-size:clamp(44px, 5vw, 78px);
        line-height:1.05;
        font-weight:800;
        color:#ffffff;
        text-shadow:
          0 10px 30px rgba(0,0,0,.35),
          0 4px 10px rgba(0,0,0,.25);
      }

      .wc-video-content h1::after{
        content:"";
        display:block;
        width:118px;
        height:5px;
        margin:24px auto 0 auto;
        border-radius:999px;
        background:linear-gradient(90deg,#b89b48 0%,#f3e4a8 50%,#d1be78 100%);
        box-shadow:0 0 18px rgba(209,190,120,0.36);
      }

      .wc-cip-main-section{
        position:relative;
        width:100vw;
        max-width:100vw;
        left:50%;
        margin-left:-50vw;
        margin-right:-50vw;
        padding:0 28px 0 28px;
        box-sizing:border-box;
        background:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
        overflow:visible;
      }

      .wc-cip-main-inner{
        width:100%;
        max-width:1600px;
        margin:0 auto;
        overflow:visible;
      }

      .wc-cip-sticky-nav-shell{
        position:sticky;
        top:0;
        z-index:1000;
        width:100%;
        max-width:1600px;
        margin-left:auto;
        margin-right:auto;
        margin-bottom:18px;
        padding:10px 0 12px 0;
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
        height:4px;
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
        max-width:1600px;
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
        min-height:42px;
        margin:8px 2px;
        padding:0 18px;
        border:0;
        border-radius:999px;
        background:transparent;
        color:#172033;
        font-family:Arial, Helvetica, sans-serif;
        font-size:13px;
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
        padding:0 18px;
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
        padding:42px 28px 34px 28px;
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
        padding:0 40px;
        box-sizing:border-box;
        margin:0 auto;
        text-align:left;
      }

      .wc-intro-inner span{
        display:block;
        margin-bottom:10px;
        color:#006231;
        font-size:13px;
        font-weight:700;
        letter-spacing:.14em;
        text-transform:uppercase;
        text-align:center;
      }

      .wc-intro-inner h2,
      .wc-budget-strip-title{
        margin:0 0 14px 0;
        color:#172033;
        font-size:42px;
        line-height:1.08;
        font-weight:700;
        text-align:center;
      }

      .wc-intro-inner h2::after{
        content:"";
        display:block;
        width:78px;
        height:4px;
        margin:12px auto 0 auto;
        border-radius:999px;
        background:linear-gradient(90deg,#006231 0%,#0b7d45 100%);
      }

      .wc-intro-inner p{
        margin:0 0 16px 0;
        color:#344054;
        font-size:16px;
        line-height:1.7;
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
        margin:32px auto 0 auto;
        background:linear-gradient(90deg, rgba(0,98,49,0) 0%, rgba(0,98,49,0.18) 20%, rgba(0,98,49,0.28) 50%, rgba(0,98,49,0.18) 80%, rgba(0,98,49,0) 100%);
      }

      .wc-budget-strip-section{
        padding:10px 40px 42px 40px;
      }

      .wc-budget-strip-title{
        margin:0 0 16px 0;
        line-height:1.15;
      }

      .wc-budget-strip-title::after{
        content:"";
        display:block;
        width:90px;
        height:4px;
        background:#d1be78;
        border-radius:4px;
        margin:16px auto 0 auto;
      }

      .wc-budget-strip{
        display:grid;
        grid-template-columns:repeat(5, minmax(0,1fr));
        gap:16px;
        margin:34px 0 42px 0;
        padding:22px;
        background:linear-gradient(135deg,#006231 0%,#0b7741 100%);
        border-radius:26px;
        box-shadow:0 18px 42px rgba(0,0,0,.12);
        font-family:Arial, Helvetica, sans-serif;
      }

      .wc-budget-item{
        padding:0 10px;
        text-align:center;
      }

      .wc-budget-label{
        display:block;
        margin-bottom:10px;
        color:rgba(255,255,255,.76);
        font-size:11px;
        font-weight:700;
        letter-spacing:.12em;
        text-transform:uppercase;
      }

      .wc-budget-item strong{
        display:block;
        color:#ffffff;
        font-size:30px;
        line-height:1.1;
        font-weight:800;
        font-variant-numeric:tabular-nums;
      }

      .wc-cip-feature-section,
      .wc-cip-info-section{
        width:100% !important;
        max-width:100% !important;
        padding:0 0 42px 0 !important;
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
        gap:28px;
        width:100% !important;
        max-width:1600px !important;
        margin:0 auto !important;
        box-sizing:border-box !important;
        overflow:hidden !important;
      }

      .wc-cip-info-grid{
        gap:34px;
      }

      .wc-cip-feature-card{
        flex:1 1 0;
        min-width:0;
        display:grid;
        grid-template-columns:42% 58%;
        align-items:stretch;
        overflow:hidden;
        border-radius:28px;
        background:#ffffff;
        border:1px solid rgba(209,190,120,0.42);
        box-shadow:
          0 14px 34px rgba(0,98,49,0.08),
          0 4px 12px rgba(36,52,77,0.06);
        box-sizing:border-box;
      }

      .wc-cip-feature-image{
        min-height:320px;
        overflow:hidden;
      }

      .wc-cip-feature-image img{
        width:100%;
        height:100%;
        min-height:320px;
        object-fit:cover;
        display:block;
      }

      .wc-cip-feature-content{
        padding:34px;
        box-sizing:border-box;
        display:flex;
        flex-direction:column;
        justify-content:center;
      }

      .wc-cip-feature-content span,
      .wc-cip-label{
        display:block;
        margin-bottom:10px;
        color:#006231;
        font-size:12px;
        font-weight:700;
        letter-spacing:.14em;
        text-transform:uppercase;
      }

      .wc-cip-feature-content h2,
      .wc-cip-content h2{
        margin:0 0 14px 0;
        color:#172033;
        font-size:28px;
        line-height:1.15;
        font-weight:700;
      }

      .wc-cip-content h2{
        margin-bottom:16px;
        font-size:30px;
      }

      .wc-cip-feature-content h2::after,
      .wc-cip-content h2::after{
        content:"";
        display:block;
        width:70px;
        height:4px;
        margin:14px 0 0 0;
        border-radius:999px;
        background:linear-gradient(90deg,#006231 0%,#0b7d45 100%);
      }

      .wc-cip-feature-content p,
      .wc-cip-content p{
        margin:0;
        color:#344054;
        font-size:16px;
        line-height:1.7;
        text-align:left;
      }

      .wc-cip-content p{
        margin:0 0 18px 0;
        line-height:1.72;
      }

      .wc-cip-panel{
        flex:1 1 0;
        min-width:0;
        max-width:100%;
        box-sizing:border-box;
        background:#ffffff;
        border-radius:28px;
        overflow:hidden;
        border:1px solid rgba(209,190,120,0.35);
        box-shadow:
          0 16px 38px rgba(0,98,49,0.08),
          0 6px 14px rgba(36,52,77,0.06);
        transition:transform .28s ease, box-shadow .28s ease;
      }

      .wc-cip-panel:hover{
        transform:translateY(-4px);
        box-shadow:
          0 22px 44px rgba(0,98,49,0.12),
          0 10px 20px rgba(36,52,77,0.08);
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
        height:340px;
        border:0;
      }

      .wc-cip-content{
        padding:34px 34px 30px 34px;
        box-sizing:border-box;
      }

      .wc-cip-list{
        margin:22px 0 0 0;
        padding:0;
        list-style:none;
      }

      .wc-cip-list li{
        position:relative;
        padding:0 0 0 22px;
        margin:0 0 18px 0;
        color:#344054;
        font-size:15px;
        line-height:1.68;
        text-align:left;
      }

      .wc-cip-list li:last-child{
        margin-bottom:0;
      }

      .wc-cip-list li::before{
        content:"";
        position:absolute;
        left:0;
        top:10px;
        width:10px;
        height:10px;
        border-radius:999px;
        background:linear-gradient(135deg,#006231 0%,#0b7d45 100%);
        box-shadow:0 0 0 4px rgba(0,98,49,0.10);
      }

      .wc-cip-list strong{
        color:#172033;
      }

      .wc-project-index-section{
        position:relative;
        width:100vw;
        max-width:100vw;
        left:50%;
        margin-left:-50vw;
        margin-right:-50vw;
        padding:54px 34px;
        background:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
        box-sizing:border-box;
      }

      .wc-project-index-inner{
        width:100%;
        max-width:1600px;
        margin:0 auto;
      }

      .wc-project-index-header{
        text-align:center;
        margin-bottom:34px;
      }

      .wc-project-index-header span{
        display:block;
        margin-bottom:10px;
        color:#006231;
        font-size:13px;
        font-weight:700;
        letter-spacing:.14em;
        text-transform:uppercase;
      }

      .wc-project-index-header h2{
        margin:0;
        color:#172033;
        font-size:42px;
        line-height:1.08;
        font-weight:700;
      }

      .wc-project-index-header h2::after{
        content:"";
        display:block;
        width:82px;
        height:4px;
        margin:14px auto 0 auto;
        border-radius:999px;
        background:linear-gradient(90deg,#006231 0%,#0b7d45 100%);
      }

      .wc-project-index-header p{
        max-width:980px;
        margin:18px auto 0 auto;
        color:#475467;
        font-size:16px;
        line-height:1.7;
      }

      .wc-project-full-search-row{
        display:flex;
        justify-content:center;
        margin:24px 0 26px 0;
      }

      .wc-project-full-search-link{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:50px;
        padding:0 24px;
        border-radius:999px;
        background:linear-gradient(135deg,#006231 0%,#0b7d45 100%);
        color:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
        font-size:14px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
        text-decoration:none;
        box-shadow:0 10px 24px rgba(0,98,49,0.16);
        transition:transform .22s ease, box-shadow .22s ease;
      }

      .wc-project-full-search-link:hover{
        transform:translateY(-2px);
        box-shadow:0 14px 28px rgba(0,98,49,0.20);
      }

      .wc-project-toolbar{
        display:flex;
        flex-wrap:wrap;
        gap:16px;
        align-items:center;
        justify-content:space-between;
        margin-bottom:24px;
        padding:22px;
        background:#ffffff;
        border-radius:24px;
        border:1px solid rgba(209,190,120,0.34);
        box-shadow:
          0 12px 28px rgba(0,98,49,0.08),
          0 4px 10px rgba(36,52,77,0.05);
      }

      .wc-project-search-wrap{
        position:relative;
        flex:1 1 420px;
        min-width:280px;
      }

      .wc-project-search{
        width:100% !important;
        height:58px !important;
        padding:0 18px 0 72px !important;
        text-indent:0 !important;
        border-radius:16px;
        border:1px solid rgba(0,98,49,0.16);
        background:#f8faf8;
        font-size:15px;
        color:#172033;
        outline:none;
        box-sizing:border-box;
        transition:
          border-color .22s ease,
          box-shadow .22s ease,
          background .22s ease;
      }

      .wc-project-search::placeholder{
        color:#98a2b3;
        opacity:1;
      }

      .wc-project-search:focus{
        border-color:#006231;
        background:#ffffff;
        box-shadow:0 0 0 4px rgba(0,98,49,0.08);
      }

      .wc-project-search-icon{
        position:absolute !important;
        left:24px !important;
        top:50% !important;
        transform:translateY(-50%) !important;
        width:18px !important;
        height:18px !important;
        opacity:.55 !important;
        pointer-events:none !important;
        z-index:2 !important;
      }

      .wc-project-filter-group{
        display:flex;
        flex-wrap:wrap;
        gap:12px;
        width:100%;
      }

      .wc-project-filter-set{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        align-items:center;
        width:100%;
      }

      .wc-project-filter-label{
        color:#475467;
        font-size:12px;
        font-weight:800;
        letter-spacing:.12em;
        text-transform:uppercase;
        margin-right:2px;
      }

      .wc-project-filter{
        height:46px;
        padding:0 18px;
        border-radius:999px;
        border:1px solid rgba(0,98,49,0.14);
        background:#ffffff;
        color:#172033;
        font-size:14px;
        font-weight:600;
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
        background:linear-gradient(135deg,#006231 0%,#0b7d45 100%);
        color:#ffffff;
        border-color:#006231;
      }

      .wc-project-results-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        margin:0 0 12px 0;
        color:#475467;
        font-size:14px;
        font-weight:700;
      }

      .wc-project-grid{
        display:flex !important;
        flex-direction:column !important;
        gap:24px !important;
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
        gap:24px !important;
        width:100% !important;
        max-width:100% !important;
        margin:0 !important;
        padding:0 !important;
        box-sizing:border-box !important;
      }

      .wc-project-card{
        cursor:pointer;
        flex:1 1 0 !important;
        width:calc((100% - 48px) / 3) !important;
        max-width:calc((100% - 48px) / 3) !important;
        min-width:0 !important;
        box-sizing:border-box !important;
        position:relative;
        display:flex;
        flex-direction:column;
        align-self:stretch !important;
        gap:16px;
        padding:28px;
        background:#ffffff;
        border-radius:26px;
        border:1px solid rgba(209,190,120,0.34);
        box-shadow:
          0 14px 34px rgba(0,98,49,0.08),
          0 4px 12px rgba(36,52,77,0.06);
        transition:
          transform .24s ease,
          box-shadow .24s ease,
          border-color .24s ease;
      }

      .wc-project-card:hover{
        transform:translateY(-4px);
        border-color:rgba(0,98,49,0.28);
        box-shadow:
          0 22px 44px rgba(0,98,49,0.12),
          0 8px 18px rgba(36,52,77,0.08);
      }

      .wc-project-card-top{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:12px;
      }

      .wc-project-card h3{
        margin:0;
        color:#172033;
        font-size:24px;
        line-height:1.2;
        font-weight:700;
      }

      .wc-project-category{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:8px 14px;
        border-radius:999px;
        background:rgba(0,98,49,0.08);
        color:#006231;
        font-size:12px;
        font-weight:700;
        letter-spacing:.08em;
        text-transform:uppercase;
        white-space:nowrap;
      }

      .wc-project-description{
        color:#475467;
        font-size:15px;
        line-height:1.72;
        position:relative;
      }

      .wc-project-card.has-overflow .wc-project-description{
        max-height:78px;
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
        height:34px;
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
        font-size:13px;
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
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
        margin-top:auto;
        align-items:stretch;
      }

      .wc-project-metric{
        min-height:92px;
        padding:14px 16px;
        border-radius:16px;
        background:#f8faf8;
        border:1px solid rgba(0,98,49,0.08);
        display:flex;
        flex-direction:column;
        justify-content:flex-start;
        box-sizing:border-box;
      }

      .wc-project-metric span{
        display:block;
        margin-bottom:6px;
        color:#667085;
        font-size:11px;
        font-weight:700;
        letter-spacing:.10em;
        text-transform:uppercase;
      }

      .wc-project-metric strong{
        display:block;
        color:#172033;
        font-size:18px;
        line-height:1.25;
        font-weight:700;
        word-break:break-word;
        overflow-wrap:anywhere;
      }

      .wc-project-metric:first-child strong{
        white-space:nowrap;
      }

      .wc-project-status{
        display:inline-flex;
        align-items:center;
        gap:8px;
        width:max-content;
        padding:10px 16px;
        border-radius:999px;
        font-size:13px;
        font-weight:700;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .wc-project-status::before{
        content:"";
        width:10px;
        height:10px;
        border-radius:999px;
        background:currentColor;
      }

      .wc-project-card-badges{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        margin-top:-2px;
      }

      .wc-project-card-badge{
        display:inline-flex;
        align-items:center;
        gap:7px;
        width:max-content;
        padding:9px 13px;
        border-radius:999px;
        background:rgba(52,64,84,0.08);
        color:#344054;
        border:1px solid rgba(52,64,84,0.16);
        font-size:12px;
        font-weight:800;
        letter-spacing:.04em;
        text-transform:uppercase;
      }

      .wc-status-planning{ background:rgba(209,190,120,0.18); color:#8b6d12; }
      .wc-status-design{ background:rgba(9,127,187,0.12); color:#0b5f8a; }
      .wc-status-construction{ background:rgba(0,98,49,0.12); color:#006231; }
      .wc-status-complete{ background:rgba(52,64,84,0.10); color:#344054; }

      .wc-project-empty{
        display:none;
        padding:42px 24px;
        text-align:center;
        color:#667085;
        font-size:16px;
      }

      .wc-project-load-more{
        display:none;
        margin:30px auto 0 auto;
        padding:15px 26px;
        border:0;
        border-radius:999px;
        background:linear-gradient(135deg,#006231 0%,#0b7d45 100%);
        color:#ffffff;
        font-family:Arial, Helvetica, sans-serif;
        font-size:14px;
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

        .wc-budget-strip{
          grid-template-columns:repeat(2,1fr);
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

        .wc-video-hero{
          height:420px;
          border-radius:24px;
        }

        .wc-video-hero::before{
          border-radius:24px;
        }

        .wc-video-content{
          padding:0 24px;
        }

        .wc-video-title-box{
          padding:24px 26px 26px 26px;
          border-radius:20px;
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
          min-height:50px;
          padding:0 13px;
          font-size:12px;
          white-space:nowrap;
        }

        .wc-intro-section{
          width:100% !important;
          max-width:100% !important;
          left:auto !important;
          margin-left:0 !important;
          margin-right:0 !important;
          padding:36px 0 30px 0;
        }

        .wc-intro-inner{
          padding:0 18px;
        }

        .wc-intro-inner h2,
        .wc-budget-strip-title{
          font-size:34px;
        }

        .wc-intro-inner p{
          font-size:16px;
          line-height:1.65;
          text-align:left;
        }

        .wc-budget-strip-section{
          padding:4px 0 32px 0;
        }

        .wc-budget-strip{
          grid-template-columns:1fr;
          padding:20px;
          margin-bottom:34px;
        }

        .wc-budget-item strong{
          font-size:26px;
        }

        .wc-cip-feature-section,
        .wc-cip-info-section{
          padding:0 0 34px 0 !important;
        }

        .wc-cip-feature-card{
          display:block;
          grid-template-columns:1fr;
          border-radius:22px;
        }

        .wc-cip-feature-image,
        .wc-cip-feature-image img{
          min-height:220px;
        }

        .wc-cip-feature-content{
          padding:26px 22px;
        }

        .wc-cip-feature-content h2,
        .wc-cip-content h2{
          font-size:24px;
        }

        .wc-cip-feature-content p,
        .wc-cip-content p,
        .wc-cip-list li{
          font-size:15px;
          line-height:1.65;
        }

        .wc-cip-panel{
          border-radius:22px;
        }

        .wc-cip-video iframe{
          height:240px;
        }

        .wc-cip-content{
          padding:28px 24px 24px 24px;
        }

        .wc-project-index-section{
          width:100% !important;
          max-width:100% !important;
          left:auto !important;
          margin-left:0 !important;
          margin-right:0 !important;
          padding:32px 14px !important;
          overflow-x:hidden !important;
        }

        .wc-project-index-inner{
          width:100% !important;
          max-width:100% !important;
        }

        .wc-project-index-header{
          margin-bottom:24px;
          padding:0 4px;
        }

        .wc-project-index-header span{
          font-size:11px;
          letter-spacing:.12em;
        }

        .wc-project-index-header h2{
          font-size:30px;
          line-height:1.12;
        }

        .wc-project-index-header p{
          font-size:15px;
          line-height:1.6;
          margin-top:14px;
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
          padding:16px !important;
          border-radius:20px;
          gap:14px;
        }

        .wc-project-search-wrap{
          flex:1 1 100%;
          min-width:0;
          width:100%;
        }

        .wc-project-search{
          height:54px !important;
          padding-left:62px !important;
          font-size:14px !important;
          border-radius:15px;
        }

        .wc-project-search-icon{
          left:22px !important;
          width:17px !important;
          height:17px !important;
        }

        .wc-project-filter-group{
          gap:14px;
        }

        .wc-project-filter-set{
          width:100%;
          gap:8px;
        }

        .wc-project-filter-label{
          width:100%;
          margin-bottom:2px;
          font-size:11px;
        }

        .wc-project-filter{
          height:42px;
          padding:0 14px;
          font-size:13px;
          flex:0 1 auto;
        }

        .wc-project-results-row{
          flex-direction:column;
          align-items:flex-start;
          gap:6px;
          margin-bottom:16px;
          font-size:13px;
        }

        .wc-project-grid{
          gap:18px !important;
        }

        .wc-project-row{
          flex-direction:column !important;
          gap:18px !important;
          width:100% !important;
        }

        .wc-project-card{
          flex:1 1 auto !important;
          width:100% !important;
          max-width:100% !important;
          min-width:0 !important;
          align-self:auto !important;
          padding:22px !important;
          border-radius:22px;
          gap:14px;
        }

        .wc-project-card:hover{
          transform:none;
        }

        .wc-project-card-top{
          flex-direction:column;
          gap:10px;
        }

        .wc-project-card h3{
          font-size:21px;
          line-height:1.22;
        }

        .wc-project-category{
          align-self:flex-start;
          white-space:normal;
          text-align:left;
          line-height:1.25;
        }

        .wc-project-description{
          font-size:14px;
          line-height:1.65;
        }

        .wc-project-card.has-overflow .wc-project-description{
          max-height:96px;
        }

        .wc-project-metrics{
          grid-template-columns:1fr;
          gap:10px;
        }

        .wc-project-metric{
          min-height:auto;
          padding:13px 14px;
        }

        .wc-project-metric strong{
          font-size:16px;
          line-height:1.3;
        }

        .wc-project-status{
          width:100%;
          justify-content:center;
          text-align:center;
          padding:11px 14px;
          font-size:12px;
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
          padding:14px 10px 0 10px;
        }

        .wc-cip-feature-grid,
        .wc-cip-info-grid{
          gap:22px;
        }

        .wc-cip-feature-image,
        .wc-cip-feature-image img{
          min-height:190px;
        }

        .wc-cip-feature-content,
        .wc-cip-content{
          padding:24px 18px 22px 18px;
        }

        .wc-cip-feature-content h2,
        .wc-cip-content h2{
          font-size:22px;
        }

        .wc-cip-video iframe{
          height:205px;
        }

        .wc-project-index-section{
          padding:28px 10px !important;
        }

        .wc-project-index-header h2{
          font-size:27px;
        }

        .wc-project-toolbar{
          padding:14px !important;
        }

        .wc-project-filter{
          flex:1 1 calc(50% - 8px);
          padding:0 10px;
          font-size:12px;
        }

        .wc-project-card{
          padding:20px !important;
        }

        .wc-project-card h3{
          font-size:20px;
        }
      }

    </style>

    <section class="wc-cip-main-section">
      <div class="wc-cip-main-inner">
        ${!isStandaloneSearchPage ? `
        <div class="wc-video-hero">
          <iframe class="wc-video-frame" src="https://www.youtube.com/embed/9KzURzB0E-U?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=9KzURzB0E-U&amp;controls=0&amp;modestbranding=1&amp;playsinline=1&amp;rel=0&amp;enablejsapi=1" title="Final Budget 2025-2026" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>

          <div class="wc-video-overlay"></div>

          <div class="wc-video-content">
            <div class="wc-video-title-box">
              <span>Walton County, Florida</span>
              <h1>Capital Improvement Plan Fiscal Year 2027-2031</h1>
            </div>
          </div>
        </div>

        <section class="wc-intro-section" id="wc-cip-overview">
          <div class="wc-intro-inner">
            <span>Capital Improvement Plan</span>
            <h2>Introduction</h2>

            <p>
              This online document provides an overview of Walton County&rsquo;s Capital Improvement Plan (CIP) for a five-year period beginning October 1, 2027, and ending September 30, 2031. The CIP serves as the County&rsquo;s long-range financial planning document for proposed capital projects, outlining anticipated project costs, funding strategies, and implementation timelines over the next five fiscal years. The plan is designed to support strategic, efficient, and sustainable infrastructure development throughout Walton County.
            </p>

            <p>
              Capital improvement projects are essential to maintaining and enhancing the quality of life for residents and visitors. Walton County&rsquo;s CIP aligns projected revenues with identified capital priorities and anticipated expenditures necessary to maintain, improve, and expand public infrastructure and facilities. The CIP is updated annually and presented to the Board of County Commissioners for review and approval in order to reflect changing community needs, service demands, economic conditions, and funding availability. As priorities evolve, projects may be accelerated, delayed, modified, or removed based on operational needs, emergencies, available resources, or policy direction from the County Commission. Inclusion in the CIP does not guarantee future funding authorization.
            </p>

            <p>
              Capital projects generally progress through multiple phases, including land acquisition, planning, design, permitting, engineering, procurement, and construction. While some smaller-scale projects may be completed within one to two years, larger and more complex projects often extend across multiple fiscal years and may experience delays associated with permitting requirements, legal considerations, market conditions, or construction timelines. The CIP provides a framework for allocating funding annually throughout each project phase while identifying long-term financial obligations associated with future implementation.
            </p>

            <p>
              Although only projects appropriated within the current fiscal year are formally adopted as part of the annual budget, the five-year CIP remains a critical planning tool for establishing long-term funding priorities and coordinating infrastructure investments across County departments and agencies. Through comprehensive capital planning, Walton County seeks to ensure that infrastructure development remains aligned with community priorities, operational needs, growth trends, and the County&rsquo;s long-term financial sustainability.
            </p>
          </div>

          <div class="wc-intro-divider"></div>
        </section>

        <section class="wc-budget-strip-section" id="wc-cip-at-glance">
          <h2 class="wc-budget-strip-title">Fiscal Year 2027 CIP at a Glance</h2>
          <div class="wc-budget-strip">
            <div class="wc-budget-item">
              <span class="wc-budget-label">Transportation Fund CIP</span>
              <strong class="wc-budget-count" data-target="5.2" data-prefix="$" data-suffix="M" data-decimals="1">$5.2M</strong>
            </div>

            <div class="wc-budget-item">
              <span class="wc-budget-label">Capital Fund CIP</span>
              <strong class="wc-budget-count" data-target="17.9" data-prefix="$" data-suffix="M" data-decimals="1">$17.9M</strong>
            </div>

            <div class="wc-budget-item">
              <span class="wc-budget-label">Sheriff&rsquo;s Office CIP</span>
              <strong class="wc-budget-count" data-target="10" data-prefix="$" data-suffix="M" data-decimals="0">$10M</strong>
            </div>

            <div class="wc-budget-item">
              <span class="wc-budget-label">Tourist Development Fund CIP</span>
              <strong class="wc-budget-count" data-target="9.8" data-prefix="$" data-suffix="M" data-decimals="1">$9.8M</strong>
            </div>

            <div class="wc-budget-item">
              <span class="wc-budget-label">Grant Funded CIP</span>
              <strong class="wc-budget-count" data-target="14.2" data-prefix="$" data-suffix="M" data-decimals="1">$14.2M</strong>
            </div>
          </div>
        </section>

        <section class="wc-cip-feature-section">
          <div class="wc-cip-feature-grid">
            <article class="wc-cip-feature-card">
              <div class="wc-cip-feature-image">
                <img src="https://stories.opengov.com/countyofwaltonfl/uploads/0bb46b56839a-3dcc0cc1c7ae-930602781477-20240621_154908.jpg?v=2026-04-25T00:49:46.254Z" alt="Definition of CIP Projects">
              </div>

              <div class="wc-cip-feature-content">
                <span>Capital Project Criteria</span>
                <h2>Definition of CIP Projects</h2>
                <p>
                  Walton County defines a CIP project as a significant, non-recurring capital expenditure for the construction, expansion, purchase, or major repair or replacement of buildings, utility systems, streets, or other physical structures or properties. Typically, a CIP project has an expected useful life of more than one year and an estimated total expenditure exceeding $50,000.
                </p>
              </div>
            </article>

            <article class="wc-cip-feature-card">
              <div class="wc-cip-feature-image">
                <img src="https://stories.opengov.com/countyofwaltonfl/uploads/a2f6c84a8bdd-254725dbdfca-d2d5e281eaa6-bridge_construction.JPG?v=2026-04-25T00:49:59.957Z" alt="CIP Budget Process">
              </div>

              <div class="wc-cip-feature-content">
                <span>Planning and Funding</span>
                <h2>CIP Budget Process</h2>
                <p>
                  County departments submit their CIP proposals annually to the Office of Management and Budget (OMB). OMB evaluates these requests against available funding and provides recommendations to the Commission and County administrators. This process culminates in the development of the five-year Capital Improvement Plan, which is included in the County&rsquo;s annual budget as approved by the Board of County Commissioners.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section class="wc-cip-info-section">
          <div class="wc-cip-info-grid">
            <article class="wc-cip-panel">
              <div class="wc-cip-video">
                <iframe src="https://www.youtube-nocookie.com/embed/2ha4PCBgw2Y?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=2ha4PCBgw2Y" title="Capital Improvement Plan Elements" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
              </div>

              <div class="wc-cip-content">
                <span class="wc-cip-label">Project Components</span>
                <h2>Elements of a Capital Improvement Plan</h2>
                <p>
                  Capital Improvement Plan projects are composed of multiple project elements that collectively support the planning, development, construction, and long-term delivery of public infrastructure and facilities throughout Walton County.
                </p>

                <ul class="wc-cip-list">
                  <li><strong>Land:</strong> Purchase of necessary property for capital projects, including building acquisitions, rights-of-way, easements, and property needed to support future infrastructure expansion and public facilities.</li>
                  <li><strong>Construction / Improvements:</strong> Expansions, renovations, major replacements, and mechanical or electrical system installations. This also includes site preparation and the construction of infrastructure such as sidewalks, streets, parking areas, drainage systems, and utility connections.</li>
                  <li><strong>Design / Professional Services:</strong> Development of plans, specifications, programming, surveying, engineering services, development costs, permitting support, and environmental impact studies necessary for approved capital projects.</li>
                  <li><strong>Construction Engineering and Inspection (CEI):</strong> Activities and resources associated with reviewing, monitoring, and inspecting construction projects, including plan reviews, material testing, supervision, quality assurance, and compliance oversight.</li>
                </ul>
              </div>
            </article>

            <article class="wc-cip-panel">
              <div class="wc-cip-video">
                <iframe src="https://www.youtube.com/embed/UI4QSqOn7o0?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=UI4QSqOn7o0" title="Sources of Financing" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
              </div>

              <div class="wc-cip-content">
                <span class="wc-cip-label">Funding Strategy</span>
                <h2>Sources of Financing</h2>
                <p>
                  Walton County utilizes a variety of funding mechanisms to support capital improvement projects and long-term infrastructure investment. Funding sources are evaluated annually to ensure projects remain financially sustainable while maintaining operational flexibility and long-range planning objectives.
                </p>

                <ul class="wc-cip-list">
                  <li><strong>Current Revenues (Cash Basis):</strong> The County primarily funds its capital improvement program on a cash basis using a variety of revenue streams, some of which are legally restricted for specific purposes or infrastructure categories.</li>
                  <li><strong>Grants:</strong> Walton County receives capital grants from federal, state, and regional agencies. These grants are typically awarded for specific project purposes and may require local matching funds or compliance with program requirements.</li>
                  <li><strong>Debt:</strong> The County may issue debt to finance major capital projects, utilizing a strategic mix of fixed-rate and variable-rate obligations as well as long-term and short-term financing structures to minimize costs and manage financial risk.</li>
                </ul>
              </div>
            </article>
          </div>
        </section>
        ` : ""}
      </div>
    </section>

    ${isStandaloneSearchPage ? `
    <section class="wc-project-index-section">
      <div class="wc-project-index-inner">

        <div class="wc-project-index-header" id="wc-project-search">
          <span>Capital Project Search</span>
          <h2>Searchable Project Index</h2>
          <p>
            Browse, search, and filter Walton County capital improvement projects by department, year, and funding source. This project index is populated from the CIP export and is designed to help residents quickly locate projects relevant to their community.
          </p>
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
              <button class="wc-project-filter ${filters.department === "all" ? "active" : ""}" data-filter-type="department" data-filter="all">All</button>
              <button class="wc-project-filter ${filters.department === "public works" ? "active" : ""}" data-filter-type="department" data-filter="public works">Public Works/Engineering</button>
              <button class="wc-project-filter ${filters.department === "beach operations" ? "active" : ""}" data-filter-type="department" data-filter="beach operations">Beach Operations</button>
              <button class="wc-project-filter ${filters.department === "sheriff" ? "active" : ""}" data-filter-type="department" data-filter="sheriff">Sheriff</button>
              <button class="wc-project-filter ${filters.department === "administration" ? "active" : ""}" data-filter-type="department" data-filter="administration">Administration</button>
              <button class="wc-project-filter ${filters.department === "building construction" ? "active" : ""}" data-filter-type="department" data-filter="building construction">Building Construction & Maintenance</button>
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
              <button class="wc-project-filter ${filters.fund === "all" ? "active" : ""}" data-filter-type="fund" data-filter="all">All</button>
              <button class="wc-project-filter ${filters.fund === "capital projects fund" ? "active" : ""}" data-filter-type="fund" data-filter="capital projects fund">Capital Projects</button>
              <button class="wc-project-filter ${filters.fund === "transportation fund" ? "active" : ""}" data-filter-type="fund" data-filter="transportation fund">Transportation</button>
              <button class="wc-project-filter ${filters.fund === "tourist development fund" ? "active" : ""}" data-filter-type="fund" data-filter="tourist development fund">Tourist Development</button>
              <button class="wc-project-filter ${filters.fund === "grant" ? "active" : ""}" data-filter-type="fund" data-filter="grant">Grant Funded</button>
              <button class="wc-project-filter ${filters.fund === "sheriff" ? "active" : ""}" data-filter-type="fund" data-filter="sheriff">Sheriff</button>
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

  initBudgetCounters();

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

renderProjects();
