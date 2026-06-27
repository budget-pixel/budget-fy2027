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
        "../index.html",
        "Walton County Board of County Commissioners Home"
      );
      if(window.WaltonSplitLogo && typeof window.WaltonSplitLogo.equalizeAll === "function"){
        window.WaltonSplitLogo.equalizeAll(logoContainer);
      }
    }

    var sidebar = null;
    var searchHost = nav;
    var existingSearchSlot = searchHost.querySelector(".wc-nav-search-slot");

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
      <div class="wc-nav-search-results" role="presentation">
        <div class="wc-search-panel">
          <div class="wc-search-wrap">
            <div class="wc-search-box">
              <svg class="wc-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.15 6.15a7.5 7.5 0 0 0 10.5 10.5Z"></path>
              </svg>

              <input
                type="text"
                id="wcTocSearch"
                placeholder="Search departments, budgets, publications, personnel..."
                aria-label="Search the Walton County budget website"
                autocomplete="off"
              >

              <button type="button" class="wc-search-close" aria-label="Close search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6 6 18"></path>
                </svg>
              </button>
            </div>

            <div class="wc-search-recent" aria-label="Recent searches"></div>
          </div>

          <div class="wc-search-scroll" role="listbox" aria-label="Search results">
            <div class="wc-search-kicker">Search Results</div>
            <div class="wc-search-results-inner"></div>
          </div>
        </div>
      </div>
    `;

    if(sidebar){
      slot.classList.add("wc-sidebar-search-slot");
      var sidebarHeader = sidebar.querySelector(".wc-sidebar-header");
      if(sidebarHeader && sidebarHeader.nextSibling){
        sidebar.insertBefore(slot, sidebarHeader.nextSibling);
      }else if(sidebarHeader){
        sidebar.appendChild(slot);
      }else{
        sidebar.insertBefore(slot, sidebar.firstChild);
      }
    }else{
      nav.appendChild(slot);
    }

    var results = slot.querySelector(".wc-nav-search-results");
    var resultsInner = slot.querySelector(".wc-search-results-inner");
    var recentHost = slot.querySelector(".wc-search-recent");
    var input = slot.querySelector("#wcTocSearch");
    var searchBox = slot.querySelector(".wc-search-box");
    var searchIcon = slot.querySelector(".wc-search-icon");
    var closeButton = slot.querySelector(".wc-search-close");
    var recentStorageKey = "wcBudgetRecentSearches";
    var activeResultIndex = -1;

    var links = [];
    var seenHrefs = {};
    var wcProjectSearchBaseUrl = window.wcProjectSearchBaseUrl || (window.location.pathname.indexOf("/pages/") !== -1 ? "search.html?q=" : "pages/search.html?q=");
    var wcCipAssetBaseUrl = window.wcBudgetAssetBaseUrl || window.wcCipAssetBaseUrl || (window.location.pathname.indexOf("/pages/") !== -1 ? "../assets/" : "assets/");

    function getLocalProjectHref(projectSlug){
      var detailPage = window.location.pathname.indexOf("/pages/") !== -1 ? "cip-project.html" : "pages/cip-project.html";
      return detailPage + "?project=" + encodeURIComponent(projectSlug);
    }

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

    function getRecentSearches(){
      try{
        var parsed = JSON.parse(window.localStorage.getItem(recentStorageKey) || "[]");
        return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 6) : [];
      }catch(e){
        return [];
      }
    }

    function saveRecentSearch(value){
      value = String(value || "").trim();
      if(!value){
        return;
      }
      var normalized = value.toLowerCase();
      var next = [value].concat(getRecentSearches().filter(function(item){
        return String(item).toLowerCase() !== normalized;
      })).slice(0, 6);
      try{
        window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
      }catch(e){}
      renderRecentSearches();
    }

    function renderRecentSearches(){
      if(!recentHost){
        return;
      }
      var recent = getRecentSearches();
      if(!recent.length){
        recent = ["Budget Overview", "Public Works", "Capital Projects", "Personnel Summary"];
      }
      recentHost.innerHTML =
        '<div class="wc-search-recent-label">Recent Searches</div>' +
        '<div class="wc-search-recent-pills">' +
          recent.map(function(term){
            return '<button type="button" class="wc-search-recent-pill" data-query="' + term.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") + '">' + term.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</button>';
          }).join("") +
        '</div>';
    }

    function openSearchMode(){
      if(window.WaltonBudgetGlobalSearch && window.WaltonBudgetGlobalSearch.nav && window.WaltonBudgetGlobalSearch.nav !== nav){
        window.WaltonBudgetGlobalSearch.close();
      }
      var wasOpen = nav.classList.contains("is-search-open");
      nav.classList.add("is-search-open");
      document.body.classList.add("wc-global-search-open");
      document.body.style.overflow = "hidden";
      renderRecentSearches();
      renderResults(input.value);
      if(!wasOpen && document.activeElement !== input){
        setTimeout(function(){
          input.focus();
        }, 60);
      }
    }

    function closeSearchMode(){
      nav.classList.remove("is-search-open");
      document.body.classList.remove("wc-global-search-open");
      document.body.style.overflow = "";
      results.classList.remove("is-active");
      input.blur();
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
      if(window.wcCipProjects && Array.isArray(window.wcCipProjects)){
        return window.wcCipProjects;
      }

      return [];
    }

    function loadProjectSearchData(){
      var projects = getLoadedProjects();

      if(!projects.length){
        return;
      }

      projects.forEach(function(project){
        if(project && project.is_legacy_in_house_engineering_row){
          return;
        }

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
          projectHref = getLocalProjectHref(projectSlug);
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

    var GROUP_ORDER = ["Our County", "Publications", "Budget", "Officers & Agencies", "Departments", "Capital Projects", "Financials"];
    var SECTION_GROUP_MAP = {
      "our county": "Our County",
      "introduction and overview": "Publications",
      "financial structure, policies, and process": "Budget",
      "budget overview": "Budget",
      "departments": "Departments",
      "constitutional officers": "Officers & Agencies",
      "autonomous entities": "Officers & Agencies",
      "capital improvement plan": "Capital Projects",
      "financial summaries": "Financials",
      "debt and financial forecast": "Financials",
      "financials": "Financials"
    };

    function groupLabelFor(section){
      var key = String(section || "").toLowerCase().trim();
      if(key.indexOf("cip project") === 0){
        return "Capital Projects";
      }
      return SECTION_GROUP_MAP[key] || section || "More";
    }

    function renderResultGroup(label, items){
      var group = document.createElement("div");
      group.className = "wc-search-group";

      var heading = document.createElement("div");
      heading.className = "wc-search-group-label";
      heading.textContent = label;
      group.appendChild(heading);

      items.forEach(function(item){
        var resultLink = document.createElement("a");
        resultLink.className = "wc-nav-search-result";
        resultLink.href = item.href;
        resultLink.setAttribute("role", "option");
        resultLink.setAttribute("aria-selected", "false");
        resultLink.innerHTML = `<strong>${item.title}</strong>`;
        group.appendChild(resultLink);
      });

      resultsInner.appendChild(group);
    }

    function renderGroupedResults(items){
      var groups = {};
      var order = [];

      items.forEach(function(item){
        var label = groupLabelFor(item.section);
        if(!groups[label]){
          groups[label] = [];
          order.push(label);
        }
        groups[label].push(item);
      });

      order.sort(function(a, b){
        var ai = GROUP_ORDER.indexOf(a);
        var bi = GROUP_ORDER.indexOf(b);
        if(ai === -1) ai = GROUP_ORDER.length;
        if(bi === -1) bi = GROUP_ORDER.length;
        return ai - bi;
      });

      order.forEach(function(label){
        renderResultGroup(label, groups[label]);
      });
    }

    function findBestSearchMatch(query){
      var normalizedQuery = normalizeSearchText(query);
      if(!normalizedQuery){
        return null;
      }

      var exactMatch = links.find(function(item){
        return normalizeSearchText(item.title) === normalizedQuery;
      });
      if(exactMatch){
        return exactMatch;
      }

      var titleMatch = links.find(function(item){
        return normalizeSearchText(item.title).indexOf(normalizedQuery) !== -1;
      });
      if(titleMatch){
        return titleMatch;
      }

      return links.find(function(item){
        return item.searchText.indexOf(normalizedQuery) !== -1;
      }) || null;
    }

    function renderResults(query){
      var normalizedQuery = query.toLowerCase().trim();
      resultsInner.innerHTML = "";
      activeResultIndex = -1;
      renderRecentSearches();

      if(!normalizedQuery){
        var defaultLinks = links.filter(function(item){
          return groupLabelFor(item.section) !== "Departments";
        }).slice(0, 3);
        renderGroupedResults(defaultLinks);
        results.classList.add("is-active");
        return;
      }

      var matches = links.filter(function(item){
        return item.searchText.indexOf(normalizedQuery) !== -1;
      }).map(function(item, index){
        var titleNormalized = item.title.toLowerCase();
        var rank;
        if(titleNormalized === normalizedQuery){
          rank = 0;
        }else if(titleNormalized.indexOf(normalizedQuery) === 0){
          rank = 1;
        }else if(titleNormalized.indexOf(normalizedQuery) !== -1){
          rank = 2;
        }else{
          rank = 3;
        }
        return { item:item, rank:rank, index:index };
      }).sort(function(a, b){
        return a.rank - b.rank || a.index - b.index;
      }).slice(0, 8).map(function(entry){
        return entry.item;
      });

      if(!matches.length){
        resultsInner.innerHTML = '<div class="wc-nav-search-empty">No matching sections found.</div>';
        results.classList.add("is-active");
        return;
      }

      renderGroupedResults(matches);
      results.classList.add("is-active");
    }

    function getResultLinks(){
      return Array.prototype.slice.call(resultsInner.querySelectorAll(".wc-nav-search-result"));
    }

    function setActiveResult(index){
      var resultLinks = getResultLinks();
      activeResultIndex = resultLinks.length ? (index + resultLinks.length) % resultLinks.length : -1;
      resultLinks.forEach(function(link, i){
        var active = i === activeResultIndex;
        link.classList.toggle("is-active-result", active);
        link.setAttribute("aria-selected", active ? "true" : "false");
        if(active){
          link.scrollIntoView({ block:"nearest" });
        }
      });
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

    function loadProjectsWhenReady(){
      var ready = window.wcCipProjectsReady || Promise.resolve(getLoadedProjects());
      ready.then(loadProjectSearchData).catch(function(error){
        console.error("Walton budget search: failed to load CIP projects", error);
      });
    }

    if(window.wcCipProjectsReady || getLoadedProjects().length){
      loadProjectsWhenReady();
    }else{
      var projectScript = document.createElement("script");
      projectScript.id = "wc-cip-projects-loader";
      projectScript.src = wcCipAssetBaseUrl + "walton-cip-projects.js?v=7";
      projectScript.onload = loadProjectsWhenReady;
      document.head.appendChild(projectScript);
    }

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
      openSearchMode();
      renderResults(input.value);
    });

    input.addEventListener("keydown", function(e){
      if(e.key === "Escape"){
        closeSearchMode();
        closeMobileSearch();
      }
      if(e.key === "ArrowDown"){
        e.preventDefault();
        setActiveResult(activeResultIndex + 1);
      }
      if(e.key === "ArrowUp"){
        e.preventDefault();
        setActiveResult(activeResultIndex - 1);
      }
      if(e.key === "Enter"){
        var resultLinks = getResultLinks();
        if(activeResultIndex >= 0 && resultLinks[activeResultIndex]){
          e.preventDefault();
          saveRecentSearch(input.value || resultLinks[activeResultIndex].querySelector("strong").textContent);
          window.location.href = resultLinks[activeResultIndex].href;
          return;
        }
        saveRecentSearch(input.value);
      }
    });

    slot.addEventListener("click", function(e){
      var target = e.target && e.target.closest ? e.target : null;
      if(!target){
        return;
      }
      var recentButton = target.closest(".wc-search-recent-pill");
      if(recentButton){
        input.value = recentButton.getAttribute("data-query") || "";
        saveRecentSearch(input.value);
        var recentMatch = findBestSearchMatch(input.value);
        if(recentMatch){
          window.location.href = recentMatch.href;
        }else{
          renderResults(input.value);
          input.focus();
        }
        return;
      }

      var resultLink = target.closest(".wc-nav-search-result");
      if(resultLink){
        saveRecentSearch(input.value || resultLink.querySelector("strong").textContent);
      }
    });

    if(closeButton){
      closeButton.addEventListener("click", function(e){
        e.stopPropagation();
        closeSearchMode();
        closeMobileSearch();
      });
    }

    document.addEventListener("click", function(e){
      if(results && e.target === results){
        closeSearchMode();
        return;
      }
      if(!slot.contains(e.target) && !nav.contains(e.target)){
        closeSearchMode();
        closeMobileSearch();
      }
    });

    window.WaltonBudgetGlobalSearch = {
      nav:nav,
      open:openSearchMode,
      close:closeSearchMode
    };
  };
})();
