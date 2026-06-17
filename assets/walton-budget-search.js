(function(){
  window.initWaltonBudgetSearch = function(options){
    var nav = options && options.nav;
    var getWaltonSplitBrandHtml = options && options.getWaltonSplitBrandHtml;

    if(!nav){
      return;
    }

    var logoContainer = nav.querySelector(".logo-container");

    if(
      logoContainer &&
      !logoContainer.querySelector(".wc-split-brand") &&
      typeof getWaltonSplitBrandHtml === "function"
    ){
      logoContainer.innerHTML = getWaltonSplitBrandHtml(
        "6989dbbdb4696f0b333f2246.html",
        "Go to Home"
      );
    }

    var existingSearchSlot = nav.querySelector(".wc-nav-search-slot");

    if(existingSearchSlot){
      if(existingSearchSlot.classList.contains("wc-nav-search-slot-fallback")){
        existingSearchSlot.parentNode.removeChild(existingSearchSlot);
      }else{
        return;
      }
    }

    var slot = document.createElement("div");
    slot.className = "wc-nav-search-slot";

    slot.innerHTML = `
      <div class="wc-search-wrap">
        <div class="wc-search-box">
          <svg class="wc-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.15 6.15a7.5 7.5 0 0 0 10.5 10.5Z"></path>
          </svg>

          <input
            type="search"
            id="wcTocSearch"
            placeholder="Search the budget publications..."
            aria-label="Search table of contents"
            autocomplete="off"
          >
        </div>
      </div>

      <div class="wc-nav-search-results" role="listbox" aria-label="Search results"></div>
    `;

    nav.appendChild(slot);

    var results = slot.querySelector(".wc-nav-search-results");
    var input = slot.querySelector("#wcTocSearch");
    var searchBox = slot.querySelector(".wc-search-box");
    var searchIcon = slot.querySelector(".wc-search-icon");

    var links = [];
    var seenHrefs = {};
    var wcProjectSearchBaseUrl = window.wcProjectSearchBaseUrl || "https://budget-pixel.github.io/walton-cip-project-search/?view=all&v=6&q=";
    var wcCipAssetBaseUrl = window.wcCipAssetBaseUrl || "https://budget-pixel.github.io/walton-cip-project-search/";

    function isMobileNav(){
      return window.matchMedia && window.matchMedia("(max-width:768px)").matches;
    }

    function openMobileSearch(){
      if(!isMobileNav()){
        return;
      }

      slot.classList.add("is-mobile-open");

      setTimeout(function(){
        input.focus();
        renderResults(input.value);
      }, 30);
    }

    function closeMobileSearch(){
      if(!isMobileNav()){
        return;
      }

      slot.classList.remove("is-mobile-open");
      results.classList.remove("is-active");
      input.blur();
    }

    function normalizeSearchText(value){
      if(value === null || value === undefined){
        return "";
      }

      if(Array.isArray(value)){
        return value.map(normalizeSearchText).join(" ");
      }

      if(typeof value === "object"){
        return Object.keys(value).map(function(key){
          return normalizeSearchText(value[key]);
        }).join(" ");
      }

      return String(value).toLowerCase().replace(/[^a-z0-9$%\.\s-]/g, " ").replace(/\s+/g, " ").trim();
    }

    function addSearchLink(title, section, href, extraSearchText){
      title = title ? String(title).trim() : "";
      section = section ? String(section).trim() : "Budget Book";
      href = href ? String(href).trim() : "";
      extraSearchText = normalizeSearchText(extraSearchText);

      if(!title || !href || href === "#" || seenHrefs[href]){
        return;
      }

      seenHrefs[href] = true;

      links.push({
        title:title,
        section:section,
        href:href,
        searchText:normalizeSearchText(title + " " + section + " " + extraSearchText)
      });
    }

    function getProjectValue(project, keys){
      for(var i = 0; i < keys.length; i++){
        if(
          project &&
          project[keys[i]] !== undefined &&
          project[keys[i]] !== null &&
          String(project[keys[i]]).trim() !== ""
        ){
          return String(project[keys[i]]).trim();
        }
      }

      return "";
    }

    function flattenProjectText(value){
      var pieces = [];

      function walk(item){
        if(item === null || item === undefined){
          return;
        }

        if(typeof item === "string" || typeof item === "number"){
          pieces.push(String(item));
          return;
        }

        if(Array.isArray(item)){
          item.forEach(walk);
          return;
        }

        if(typeof item === "object"){
          Object.keys(item).forEach(function(key){
            walk(item[key]);
          });
        }
      }

      walk(value);
      return pieces.join(" ");
    }

    function getLoadedProjects(){
      if(window.wcProjects && Array.isArray(window.wcProjects)){
        return window.wcProjects;
      }

      try{
        if(typeof wcProjects !== "undefined" && Array.isArray(wcProjects)){
          return wcProjects;
        }
      }catch(e){}

      return [];
    }

    function loadProjectSearchData(){
      var projects = getLoadedProjects();

      if(!projects.length){
        return;
      }

      projects.forEach(function(project){
        var projectTitle = getProjectValue(project, [
          "title",
          "projectTitle",
          "project_name",
          "projectName",
          "name",
          "Project Name",
          "Project"
        ]) || "Untitled Project";

        var projectDepartment = getProjectValue(project, [
          "department",
          "dept",
          "Department",
          "category",
          "division"
        ]) || "CIP Project";

        var projectSearchText = flattenProjectText(project);

        var projectSlug = getProjectValue(project, [
          "slug",
          "projectSlug",
          "project_slug",
          "Slug"
        ]);

        var projectHref = "";

        if(projectSlug){
          projectHref = "https://budget-pixel.github.io/walton-cip-project-search/project.html?project=" + encodeURIComponent(projectSlug);
        }else{
          projectHref = getProjectValue(project, [
            "href",
            "url",
            "link",
            "detailUrl",
            "detailURL",
            "projectUrl",
            "projectURL",
            "pageUrl",
            "pageURL"
          ]);
        }

        if(!projectHref){
          projectHref = wcProjectSearchBaseUrl + encodeURIComponent(projectTitle);
        }

        addSearchLink(
          projectTitle,
          "CIP Project • " + projectDepartment,
          projectHref,
          projectSearchText
        );
      });

      if(input && document.activeElement === input){
        renderResults(input.value);
      }
    }

    function renderResultItem(item){
      var resultLink = document.createElement("a");
      resultLink.className = "wc-nav-search-result";
      resultLink.href = item.href;
      resultLink.innerHTML = `<strong>${item.title}</strong><span>${item.section}</span>`;
      results.appendChild(resultLink);
    }

    function renderResults(query){
      var normalizedQuery = query.toLowerCase().trim();
      results.innerHTML = "";

      if(!normalizedQuery){
        links.forEach(renderResultItem);
        results.classList.add("is-active");
        return;
      }

      var matches = links.filter(function(item){
        return item.searchText.indexOf(normalizedQuery) !== -1;
      }).slice(0, 12);

      if(!matches.length){
        results.innerHTML = '<div class="wc-nav-search-empty">No matching sections found.</div>';
        results.classList.add("is-active");
        return;
      }

      matches.forEach(renderResultItem);
      results.classList.add("is-active");
    }

    var budgetPages = window.wcBudgetPages || [];

    budgetPages.forEach(function(page){
      var pageSearchText = [
        page.title,
        page.section,
        page.description,
        page.summary,
        page.keywords,
        page.aliases,
        page.terms,
        page.searchText
      ].filter(Boolean).join(" ");

      addSearchLink(page.title, page.section, page.href, pageSearchText);
    });

    var projectScript = document.createElement("script");
    projectScript.src = wcCipAssetBaseUrl + "projects.js?v=6";
    projectScript.onload = function(){
      loadProjectSearchData();
    };
    document.head.appendChild(projectScript);

    if(searchBox){
      searchBox.addEventListener("click", function(e){
        if(isMobileNav() && !slot.classList.contains("is-mobile-open")){
          e.preventDefault();
          openMobileSearch();
        }
      });
    }

    if(searchIcon){
      searchIcon.addEventListener("click", function(e){
        if(isMobileNav()){
          e.preventDefault();
          openMobileSearch();
        }
      });
    }

    input.addEventListener("input", function(){
      renderResults(input.value);
    });

    input.addEventListener("focus", function(){
      renderResults(input.value);
    });

    input.addEventListener("keydown", function(e){
      if(e.key === "Escape"){
        results.classList.remove("is-active");
        input.blur();
        closeMobileSearch();
      }
    });

    document.addEventListener("click", function(e){
      if(!slot.contains(e.target)){
        results.classList.remove("is-active");
        closeMobileSearch();
      }
    });
  };
})();
