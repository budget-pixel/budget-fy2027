(function(){
  var wcBudgetNavStarted = false;
  var wcLastKnownUrl = location.href;
  var wcRepairTimer = null;
  var wcBudgetAssetBaseUrl = (document.currentScript && document.currentScript.src)
    ? document.currentScript.src.replace(/[^/]+$/, "")
    : "../assets/";
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);
    t.async=1;
    t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "xb6teb7sh7");

  /* Google Analytics 4 */
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  var gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-Z7W0K4BTDP";
  document.head.appendChild(gaScript);

  gtag("js", new Date());
  gtag("config", "G-Z7W0K4BTDP");
  var mobileStylesheetId = "wc-budget-mobile-styles";
  var splitLogoScriptId = "wc-split-logo-script";
  var splitLogoScriptUrl = wcBudgetAssetBaseUrl + "walton-split-logo.js?v=20260627-axe-a11y";
  var wcThemeStorageKey = "waltonBudgetTheme";
  function applyHiddenAdminThemeParam(){
    try{
      var adminTheme = new URLSearchParams(window.location.search).get("adminTheme");
      if(adminTheme === "dark" || adminTheme === "light"){
        // Hidden local developer preference only; this is not a public feature or navigation setting.
        window.localStorage.setItem(wcThemeStorageKey, adminTheme);
      }
    }catch(e){}
  }
  function getStoredWaltonTheme(){
    try{
      return window.localStorage.getItem(wcThemeStorageKey) === "dark" ? "dark" : "light";
    }catch(e){
      return "light";
    }
  }
  function applyWaltonTheme(theme){
    var nextTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    if(document.body){
      document.body.classList.toggle("wc-dark-mode", nextTheme === "dark");
    }
    document.querySelectorAll(".wc-theme-toggle").forEach(function(button){
      var isDark = nextTheme === "dark";
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      button.title = isDark ? "Light mode" : "Dark mode";
    });
  }
  function setWaltonTheme(theme){
    var nextTheme = theme === "dark" ? "dark" : "light";
    try{
      window.localStorage.setItem(wcThemeStorageKey, nextTheme);
    }catch(e){
      /* Theme still applies for this page view. */
    }
    applyWaltonTheme(nextTheme);
  }
  function toggleWaltonTheme(){
    setWaltonTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }
  applyHiddenAdminThemeParam();
  applyWaltonTheme(getStoredWaltonTheme());
  window.WaltonBudgetTheme = {
    apply:applyWaltonTheme,
    set:setWaltonTheme,
    toggle:toggleWaltonTheme,
    get:getStoredWaltonTheme
  };
  function loadWaltonMobileStylesheet(){
    var mobileStylesheet = document.getElementById(mobileStylesheetId);
    if(!mobileStylesheet){
      mobileStylesheet = document.createElement("link");
      mobileStylesheet.id = mobileStylesheetId;
      mobileStylesheet.rel = "stylesheet";
    }
    mobileStylesheet.href = wcBudgetAssetBaseUrl + "walton-budget-mobile.css?v=23";
    document.head.appendChild(mobileStylesheet);
  }
  function loadWcScriptOnce(scriptId, src, onload){
    var existingScript = document.getElementById(scriptId);
    if(existingScript){
      if(typeof onload === "function"){
        if(existingScript.getAttribute("data-loaded") === "true"){
          onload();
        }else{
          existingScript.addEventListener("load", onload, { once:true });
        }
      }
      return;
    }
    var script = document.createElement("script");
    script.id = scriptId;
    script.src = src;
    script.async = true;
    script.addEventListener("load", function(){
      script.setAttribute("data-loaded", "true");
      if(typeof onload === "function"){
        onload();
      }
    });
    script.addEventListener("error", function(){
      script.setAttribute("data-load-failed", "true");
      if(window.console && typeof window.console.error === "function"){
        window.console.error("Failed to load Walton County budget script:", src);
      }
    });
    document.head.appendChild(script);
  }
  function loadWaltonSplitLogo(onReady){
    if(window.WaltonSplitLogo && typeof window.WaltonSplitLogo.getHtml === "function"){
      if(typeof onReady === "function"){
        onReady();
      }
      return;
    }
    loadWcScriptOnce(splitLogoScriptId, splitLogoScriptUrl, function(){
      if(window.WaltonSplitLogo && typeof window.WaltonSplitLogo.injectStyles === "function"){
        window.WaltonSplitLogo.injectStyles();
      }
      if(typeof onReady === "function"){
        onReady();
      }
    });
  }
  function loadWaltonBudgetSearchModules(onReady){
    loadWcScriptOnce(
      "wc-budget-search-data-script",
      wcBudgetAssetBaseUrl + "walton-budget-search-data.js?v=1",
      function(){
        loadWcScriptOnce(
          "wc-budget-search-script",
          wcBudgetAssetBaseUrl + "walton-budget-search.js?v=20260627-lighthouse-a11y",
          function(){
            var fallbackSlot = document.querySelector(".wc-nav-search-slot-fallback");
            if(fallbackSlot && fallbackSlot.parentNode){
              fallbackSlot.parentNode.removeChild(fallbackSlot);
            }
            if(typeof onReady === "function"){
              onReady();
            }
          }
        );
      }
    );
  }
  function setFyColumnsVisible(table, indices, visible){
    table.classList.toggle('wc-prior-years-hidden', !visible);
    table.classList.toggle('wc-prior-years-visible', visible);
    var rows = table.querySelectorAll('tr');
    rows.forEach(function(row){
      var columnIndex = 0;
      Array.prototype.forEach.call(row.children, function(cell){
        var span = parseInt(cell.getAttribute('colspan') || '1', 10);
        var start = columnIndex;
        var end = columnIndex + (span > 0 ? span : 1);
        var shouldHide = indices.some(function(targetIndex){
          return targetIndex >= start && targetIndex < end;
        });
        if(shouldHide){
          cell.classList.toggle('wc-fy-column-hidden', !visible);
        }
        columnIndex = end;
      });
    });
    markNarrowReportTable(table);
  }
  function markNarrowReportTable(table){
    var firstHeaderRow = table.querySelector('thead tr');
    if(!firstHeaderRow){
      return;
    }
    var visibleColumnCount = Array.prototype.reduce.call(firstHeaderRow.children, function(count, cell){
      if(cell.classList && cell.classList.contains('wc-fy-column-hidden')){
        return count;
      }
      var span = parseInt(cell.getAttribute('colspan') || '1', 10);
      return count + (span > 0 ? span : 1);
    }, 0);
    table.classList.toggle('wc-mobile-fit-visible-columns', visibleColumnCount <= 2);
  }
  var wcBudgetLineTooltips = [
    {
      key:'personnel',
      label:'Personnel Budget',
      patterns:[/personnel\s+budget/i, /^personnel$/i],
      message:'Covers employee compensation and benefits, including salaries, overtime, weekend and holiday pay, seasonal workers, FICA, Florida Retirement System (FRS) contributions, health insurance, workers’ compensation, life insurance, and paid leave buybacks.'
    },
    {
      key:'operating',
      label:'Operating Expenditures',
      patterns:[/operating\s+expenditures/i, /operating\s+expenses/i],
      message:'Covers the day-to-day costs of providing County services, including utilities, fuel, maintenance, professional services, software, office supplies, communications, training, and other routine operating expenses.'
    },
    {
      key:'capital',
      label:'Capital Budget',
      patterns:[/capital\s+budget/i, /^capital$/i],
      message:'Covers major investments in long-term County assets, including vehicles, machinery and equipment, technology systems, buildings, facility improvements, roads, drainage, parks, and other infrastructure projects.'
    }
  ];
  function getBudgetLineCellText(cell){
    var clone = cell.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll('.wc-budget-line-tooltip-anchor'), function(anchor){
      if(anchor.parentNode){
        anchor.parentNode.removeChild(anchor);
      }
    });
    return clone.textContent.trim().replace(/\s+/g, ' ');
  }
  function getBudgetLineTooltipConfig(text){
    return wcBudgetLineTooltips.find(function(config){
      return config.patterns.some(function(pattern){
        return pattern.test(text);
      });
    }) || null;
  }
  function ensureBudgetLineTooltipBubble(){
    var bubble = document.querySelector('.wc-budget-line-tooltip-bubble');
    if(!bubble){
      bubble = document.createElement('div');
      bubble.className = 'wc-budget-line-tooltip-bubble';
      bubble.setAttribute('role', 'tooltip');
      document.body.appendChild(bubble);
    }
    return bubble;
  }
  function positionBudgetLineTooltip(anchor, bubble){
    var rect = anchor.getBoundingClientRect();
    var width = Math.min(300, Math.max(220, window.innerWidth - 32));
    var left = rect.left + (rect.width / 2) - (width / 2);
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
    var top = rect.bottom + 8;
    if(top + bubble.offsetHeight > window.innerHeight - 16){
      top = Math.max(16, rect.top - bubble.offsetHeight - 8);
    }
    bubble.style.setProperty('width', width + 'px', 'important');
    bubble.style.setProperty('left', left + 'px', 'important');
    bubble.style.setProperty('top', top + 'px', 'important');
  }
  function showBudgetLineTooltip(anchor){
    var bubble = ensureBudgetLineTooltipBubble();
    bubble.textContent = anchor.getAttribute('data-wc-tooltip') || '';
    bubble.classList.add('is-visible');
    positionBudgetLineTooltip(anchor, bubble);
  }
  function hideBudgetLineTooltip(){
    var bubble = document.querySelector('.wc-budget-line-tooltip-bubble');
    if(bubble){
      bubble.classList.remove('is-visible');
    }
  }
  function bindBudgetLineTooltipAnchor(anchor){
    if(anchor.getAttribute('data-wc-tooltip-bound') === 'true'){
      return;
    }
    anchor.addEventListener('mouseenter', function(){
      showBudgetLineTooltip(anchor);
    });
    anchor.addEventListener('focus', function(){
      showBudgetLineTooltip(anchor);
    });
    anchor.addEventListener('mouseleave', hideBudgetLineTooltip);
    anchor.addEventListener('blur', hideBudgetLineTooltip);
    anchor.setAttribute('data-wc-tooltip-bound', 'true');
  }
  function addBudgetLineTooltips(table){
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(row){
      var cells = Array.prototype.slice.call(row.querySelectorAll('th, td'));
      var targetCell = null;
      var targetConfig = null;
      cells.some(function(cell){
        var text = getBudgetLineCellText(cell);
        var config = getBudgetLineTooltipConfig(text);
        if(config){
          targetCell = cell;
          targetConfig = config;
          return true;
        }
        return false;
      });
      if(!targetCell || !targetConfig){
        return;
      }
      targetCell.classList.add('wc-budget-line-tooltip-cell');
      var existingAnchor = targetCell.querySelector('.wc-budget-line-tooltip-anchor');
      if(existingAnchor){
        existingAnchor.setAttribute('aria-label', targetConfig.label + ' information');
        existingAnchor.setAttribute('data-wc-tooltip', targetConfig.message);
        bindBudgetLineTooltipAnchor(existingAnchor);
        return;
      }
      var anchor = document.createElement('button');
      anchor.type = 'button';
      anchor.className = 'wc-budget-line-tooltip-anchor';
      anchor.setAttribute('aria-label', targetConfig.label + ' information');
      anchor.setAttribute('data-wc-tooltip', targetConfig.message);
      anchor.textContent = 'i';
      targetCell.appendChild(anchor);
      bindBudgetLineTooltipAnchor(anchor);
    });
  }
  function findFyColumnToggleTitle(table, container){
    var scope = container || table;
    var cursor = scope.previousElementSibling;
    while(cursor){
      var titleText = cursor.querySelector('[data-test="summary-table-title"]');
      if(titleText){
        return titleText.closest('div') || titleText.parentNode;
      }
      cursor = cursor.previousElementSibling;
    }
    var parent = scope.parentNode;
    if(parent){
      var nearbyTitle = null;
      Array.prototype.forEach.call(parent.querySelectorAll('[data-test="summary-table-title"]'), function(titleText){
        if(titleText.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING){
          nearbyTitle = titleText;
        }
      });
      if(nearbyTitle){
        return nearbyTitle.closest('div') || nearbyTitle.parentNode;
      }
    }
    return null;
  }
  function isPerformanceTable(table, container, titleWrap){
    var text = '';
    if(titleWrap){
      text += titleWrap.textContent || '';
    }
    if(container && container !== titleWrap){
      text += ' ' + (container.textContent || '');
    }
    text += ' ' + (table.textContent || '');
    text = text.trim().replace(/\s+/g, ' ');
    if(/\bperformance\b|\bperformance\s+measures\b|\bperformance\s+measure\b|\bmeasure(s)?\b|\bmetric(s)?\b|\boutcome(s)?\b/i.test(text)){
      return true;
    }
    return false;
  }
  function removeFyColumnToggle(table, container, titleWrap){
    if(table.getAttribute('data-wc-fy-toggle') !== 'true'){
      return;
    }
    var wrapper;
    if(titleWrap){
      wrapper = titleWrap.querySelector('.wc-fy-column-toggle-wrap');
      if(wrapper && wrapper.parentNode){
        wrapper.parentNode.removeChild(wrapper);
      }
    }
    container = container || table.parentNode;
    if(container && container.previousElementSibling && container.previousElementSibling.classList.contains('wc-fy-column-toggle-wrap')){
      container.parentNode.removeChild(container.previousElementSibling);
    }
    table.removeAttribute('data-wc-fy-toggle');
  }
  function isPriorYearToggleHeader(text){
    var normalized = text.trim().replace(/\s+/g, ' ');
    var rangeMatch = normalized.match(/\b(20\d{2})\s*[-–]\s*(20\d{2})\b/);
    if(rangeMatch){
      return parseInt(rangeMatch[2], 10) < 2027;
    }
    var fyMatch = normalized.match(/\bFY\s*(20\d{2})\b/i);
    if(fyMatch){
      return parseInt(fyMatch[1], 10) < 2027;
    }
    var yearMatch = normalized.match(/\b(20\d{2})\b/);
    if(yearMatch){
      return parseInt(yearMatch[1], 10) < 2027;
    }
    return false;
  }
  function createFyColumnToggle(table){
    if(table.getAttribute('data-wc-fy-toggle') === 'true'){
      return;
    }
    var headerCells = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    var targetIndices = headerCells.reduce(function(found, th, index){
      var text = th.textContent.trim().replace(/\s+/g, ' ');
      if(isPriorYearToggleHeader(text)){
        found.push(index);
      }
      return found;
    }, []);
    if(!targetIndices.length){
      return;
    }
    var wrapper = document.createElement('div');
    wrapper.className = 'wc-fy-column-toggle-wrap';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'wc-fy-column-toggle-button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'View prior years');
    if(table.id){
      button.setAttribute('aria-controls', table.id);
    }
    var indicator = document.createElement('span');
    indicator.className = 'wc-fy-column-toggle-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    var labelText = document.createElement('span');
    labelText.className = 'wc-fy-column-toggle-text';
    labelText.textContent = 'View Prior Years';
    button.appendChild(indicator);
    button.appendChild(labelText);
    button.addEventListener('click', function(){
      var visible = button.getAttribute('aria-expanded') !== 'true';
      setFyColumnsVisible(table, targetIndices, visible);
      button.setAttribute('aria-expanded', visible.toString());
      button.setAttribute('aria-label', visible ? 'Hide prior years' : 'View prior years');
      indicator.textContent = visible ? '✓' : '';
      labelText.textContent = visible ? 'Hide Prior Years' : 'View Prior Years';
    });
    wrapper.appendChild(button);
    var container = table.closest('[data-report-table-container-id]') || table.parentNode;
    var titleWrap = findFyColumnToggleTitle(table, container);
    if(isPerformanceTable(table, container, titleWrap)){
      removeFyColumnToggle(table, container, titleWrap);
      return;
    }
    if(titleWrap){
      titleWrap.classList.add('wc-has-fy-column-toggle-title');
      wrapper.classList.add('wc-fy-column-toggle-in-title');
      titleWrap.appendChild(wrapper);
    } else if(container && container.parentNode){
      container.parentNode.insertBefore(wrapper, container);
    } else {
      table.parentNode.insertBefore(wrapper, table);
    }
    setFyColumnsVisible(table, targetIndices, false);
    table.setAttribute('data-wc-fy-toggle', 'true');
  }
  function styleTotalRow(row){
    Array.prototype.forEach.call(row.querySelectorAll('th, td'), function(cell){
      cell.style.setProperty('background', 'linear-gradient(135deg,#d1be78 0%,#c2ac5f 100%)', 'important');
      cell.style.setProperty('color', '#172033', 'important');
      cell.style.setProperty('font-weight', '700', 'important');
      cell.style.setProperty('border-bottom', '0', 'important');
    });
  }
  function markTotalRows(table){
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(row){
      var totalCell = row.querySelector('th, td');
      if(totalCell && totalCell.textContent.trim().toLowerCase() === 'total'){
        row.classList.add('wc-budget-total-row');
        styleTotalRow(row);
        return;
      }
      Array.prototype.forEach.call(row.querySelectorAll('th, td'), function(cell){
        if(cell.textContent.trim().toLowerCase() === 'total'){
          row.classList.add('wc-budget-total-row');
          styleTotalRow(row);
        }
      });
    });
  }
  function enhanceBudgetTables(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-report-table-id]'), function(table){
      addBudgetLineTooltips(table);
      var container = table.closest('[data-report-table-container-id]') || table.parentNode;
      var titleWrap = findFyColumnToggleTitle(table, container);
      if(isPerformanceTable(table, container, titleWrap)){
        removeFyColumnToggle(table, container, titleWrap);
      } else {
        createFyColumnToggle(table);
      }
      markNarrowReportTable(table);
      if(table.getAttribute('data-wc-enhanced') === 'true'){
        return;
      }
      markTotalRows(table);
      table.setAttribute('data-wc-enhanced', 'true');
    });
  }
  function watchForBudgetTables(){
    if(window.wcBudgetTableObserver){
      return;
    }
    try{
      window.wcBudgetTableObserver = new MutationObserver(function(){
        enhanceBudgetTables();
      });
      window.wcBudgetTableObserver.observe(document.body, { childList:true, subtree:true });
    }catch(error){
      if(window.console && typeof window.console.error === 'function'){
        window.console.error('Budget table observer failed:', error);
      }
    }
  }
  function loadWaltonPerformanceMobile(){
    loadWcScriptOnce(
      "wc-performance-mobile-script",
      wcBudgetAssetBaseUrl + "walton-performance-mobile.js?v=2"
    );
  }
  var css = `
  *,
  *::before,
  *::after{
    box-sizing:border-box !important;
  }
  html,
  body{
    width:100% !important;
    max-width:100% !important;
    overflow-x:hidden !important;
    -webkit-text-size-adjust:100% !important;
    text-size-adjust:100% !important;
  }
  body{
    position:relative !important;
  }
  .story-page,
  .content,
  .main-content,
  main,
  article,
  [data-testid="story-page"],
  .page-content,
  .story-content{
    max-width:100% !important;
    overflow-x:hidden !important;
  }
  .wc-sr-only{
    position:absolute !important;
    width:1px !important;
    height:1px !important;
    padding:0 !important;
    margin:-1px !important;
    overflow:hidden !important;
    clip:rect(0, 0, 0, 0) !important;
    white-space:nowrap !important;
    border:0 !important;
  }
  .wc-skip-link{
    position:absolute !important;
    top:12px !important;
    left:12px !important;
    z-index:10000 !important;
    transform:translateY(-160%) !important;
    display:inline-flex !important;
    align-items:center !important;
    min-height:44px !important;
    padding:10px 14px !important;
    border:2px solid #0b4b3a !important;
    border-radius:6px !important;
    background:#ffffff !important;
    color:#063b2d !important;
    font:700 15px/1.2 Arial, sans-serif !important;
    text-decoration:none !important;
    box-shadow:0 8px 20px rgba(0,0,0,.18) !important;
  }
  .wc-skip-link:focus{
    transform:translateY(0) !important;
    outline:3px solid #d1be78 !important;
    outline-offset:3px !important;
  }
  img,
  svg,
  canvas,
  iframe,
  video{
    max-width:100% !important;
  }
  /* WALTON COUNTY MENU RESTYLE */
  body,
  .story-page,
  .content,
  .main-content{
    margin-top:0 !important;
    padding-top:0 !important;
  }
  nav#nav-menu.nav-menu{
    position:sticky !important;
    top:0 !important;
    z-index:9999 !important;
    display:grid !important;
    grid-template-columns:auto 1fr auto !important;
    align-items:center !important;
    column-gap:24px !important;
    min-height:88px !important;
    margin-top:0 !important;
    padding:22px clamp(22px, 4vw, 64px) 14px !important;
    box-sizing:border-box !important;
    background:linear-gradient(180deg, rgba(0,62,40,.96), rgba(0,62,40,.88)) !important;
    border-top:0 !important;
    border-bottom:0 !important;
    box-shadow:none !important;
    transition:box-shadow .2s ease !important;
    font-family:Arial, Helvetica, sans-serif !important;
  }
  html[data-theme="dark"] nav#nav-menu.nav-menu{
    background:linear-gradient(180deg, rgba(5,20,14,.98), rgba(5,20,14,.92)) !important;
  }
  nav#nav-menu.nav-menu.is-scrolled{
    box-shadow:none !important;
  }
  nav#nav-menu.nav-menu::before{
    display:none !important;
  }
  nav#nav-menu .logo-container{
    position:relative !important;
    display:flex !important;
    align-items:center !important;
    justify-content:flex-start !important;
    flex:0 0 auto !important;
    width:auto !important;
    min-width:0 !important;
    height:64px !important;
    min-height:64px !important;
    margin:0 !important;
    padding:0 !important;
    background:transparent !important;
    border:0 !important;
    box-shadow:none !important;
    overflow:visible !important;
    font-family:"Avenir Next", Avenir, Helvetica, Arial, sans-serif !important;
  }
  nav#nav-menu .logo-container::before,
  nav#nav-menu .logo-container::after{
    content:none !important;
    display:none !important;
    visibility:hidden !important;
    opacity:0 !important;
  }
  nav#nav-menu .logo-container img,
  nav#nav-menu img.js-logo-navigation,
  nav#nav-menu .logo-container .wc-logo-text-link{
    display:none !important;
    visibility:hidden !important;
    opacity:0 !important;
  }
  nav#nav-menu .logo-container,
  .wc-standalone-brand,
  .wc-budget-footer-brand{
    position:relative !important;
    display:flex !important;
    align-items:center !important;
    justify-content:flex-start !important;
    flex:0 0 auto !important;
    width:auto !important;
    min-width:max-content !important;
    max-width:none !important;
    height:64px !important;
    min-height:64px !important;
    margin:0 !important;
    padding:0 !important;
    background:transparent !important;
    border:0 !important;
    box-shadow:none !important;
    overflow:visible !important;
    font-family:"Avenir Next", Avenir, Helvetica, Arial, sans-serif !important;
    text-decoration:none !important;
  }
  nav#nav-menu .wc-split-brand{
    height:52px !important;
  }
  nav#nav-menu.nav-menu .logo-container{
    height:52px !important;
    min-height:52px !important;
  }
  @media(min-width:861px){
    nav#nav-menu.nav-menu .logo-container{
      min-width:284px !important;
    }
  }
  nav#nav-menu .wc-split-brand-top{
    color:#ffffff !important;
    font-size:24px !important;
  }
  nav#nav-menu .wc-split-brand-bottom{
    color:rgba(255,255,255,.82) !important;
  }
  nav#nav-menu .wc-split-brand-seal,
  nav#nav-menu .wc-seal-mark{
    width:46px !important;
    height:46px !important;
    flex-basis:46px !important;
    background-size:42px 42px !important;
  }
  nav#nav-menu .wc-nav-links{
    transition:opacity .3s cubic-bezier(.4,0,.2,1), transform .3s cubic-bezier(.4,0,.2,1) !important;
  }
  nav#nav-menu.is-search-open .wc-nav-links{
    opacity:0 !important;
    transform:translateY(-8px) !important;
    pointer-events:none !important;
  }
  body.wc-global-search-open #layout,
  body.wc-global-search-open .wc-home-main,
  body.wc-global-search-open .wc-home-shell,
  body.wc-global-search-open .wc-hero-inner,
  body.wc-global-search-open footer[role="contentinfo"]{
    filter:blur(6px) !important;
    transition:filter .3s cubic-bezier(.4,0,.2,1) !important;
  }
  nav#nav-menu .wc-nav-actions,
  nav#nav-menu .wc-search-focus{
    transition:opacity .3s cubic-bezier(.4,0,.2,1), transform .3s cubic-bezier(.4,0,.2,1) !important;
  }
  nav#nav-menu.is-search-open .wc-nav-actions,
  nav#nav-menu.is-search-open .wc-search-focus{
    opacity:.78 !important;
    transform:translateY(-2px) !important;
  }
  nav#nav-menu .wc-nav-search-slot{
    position:fixed !important;
    inset:0 !important;
    z-index:9998 !important;
    pointer-events:none !important;
    font-family:Arial, Helvetica, sans-serif !important;
  }
  nav#nav-menu.is-search-open .wc-nav-search-slot{
    pointer-events:auto !important;
  }
  nav#nav-menu .wc-search-wrap{
    position:fixed !important;
    top:calc(var(--wc-nav-search-top, var(--wc-header-h, 76px)) + 48px) !important;
    left:50% !important;
    right:auto !important;
    width:min(760px, calc(100vw - 40px)) !important;
    height:auto !important;
    margin:0 !important;
    padding:0 !important;
    font-family:Arial, Helvetica, sans-serif !important;
    box-sizing:border-box !important;
    display:flex !important;
    flex-direction:column !important;
    align-items:stretch !important;
    background:transparent !important;
    border:0 !important;
    opacity:0 !important;
    visibility:hidden !important;
    pointer-events:none !important;
    transform:translate(-50%, -10px) !important;
    transition:opacity .3s cubic-bezier(.4,0,.2,1), transform .3s cubic-bezier(.4,0,.2,1), visibility .3s !important;
    z-index:10000 !important;
  }
  nav#nav-menu.is-search-open .wc-search-wrap{
    opacity:1 !important;
    visibility:visible !important;
    pointer-events:auto !important;
    transform:translate(-50%, 0) !important;
  }
  nav#nav-menu .wc-search-box{
    position:relative !important;
    width:100% !important;
    max-width:760px !important;
    margin:0 !important;
    display:flex !important;
    align-items:center !important;
    gap:14px !important;
    background:transparent !important;
    border:0 !important;
    border-bottom:1px solid rgba(255,255,255,.22) !important;
    border-radius:0 !important;
    padding:0 0 16px !important;
    box-sizing:border-box !important;
    box-shadow:none !important;
    transition:border-color .2s ease !important;
  }
  nav#nav-menu .wc-search-box:hover,
  nav#nav-menu .wc-search-box:focus-within{
    transform:none !important;
    border-color:rgba(255,255,255,.42) !important;
    box-shadow:none !important;
  }
  nav#nav-menu .wc-search-icon{
    width:20px !important;
    height:20px !important;
    flex-shrink:0 !important;
    margin-right:0 !important;
    color:rgba(255,255,255,.62) !important;
    stroke:currentColor !important;
    fill:none !important;
  }
  nav#nav-menu #wcTocSearch{
    width:100% !important;
    min-width:0 !important;
    border:0 !important;
    outline:0 !important;
    appearance:none !important;
    -webkit-appearance:none !important;
    background:transparent !important;
    color:rgba(255,255,255,.94) !important;
    font-size:24px !important;
    line-height:1.25 !important;
    font-weight:500 !important;
    letter-spacing:0 !important;
    font-family:Arial, Helvetica, sans-serif !important;
  }
  nav#nav-menu #wcTocSearch::-webkit-search-cancel-button,
  nav#nav-menu #wcTocSearch::-webkit-search-decoration,
  nav#nav-menu #wcTocSearch::-webkit-search-results-button,
  nav#nav-menu #wcTocSearch::-webkit-search-results-decoration{
    display:none !important;
    -webkit-appearance:none !important;
  }
  nav#nav-menu #wcTocSearch::placeholder{
    color:rgba(255,255,255,.46) !important;
    opacity:1 !important;
  }
  nav#nav-menu .wc-search-close{
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    width:32px !important;
    height:32px !important;
    flex:0 0 32px !important;
    border:0 !important;
    border-radius:999px !important;
    background:transparent !important;
    color:rgba(255,255,255,.58) !important;
    cursor:pointer !important;
    transition:background .2s ease, color .2s ease !important;
  }
  nav#nav-menu .wc-search-close:hover{
    background:rgba(255,255,255,.08) !important;
    color:rgba(255,255,255,.9) !important;
  }
  nav#nav-menu .wc-search-close svg{
    width:18px !important;
    height:18px !important;
  }
  nav#nav-menu .wc-nav-search-results{
    position:fixed !important;
    inset:0 !important;
    width:100vw !important;
    max-width:none !important;
    height:100vh !important;
    max-height:none !important;
    overflow:auto !important;
    background:rgba(4,18,14,.64) !important;
    backdrop-filter:blur(14px) saturate(120%) !important;
    -webkit-backdrop-filter:blur(14px) saturate(120%) !important;
    border:0 !important;
    border-radius:0 !important;
    box-shadow:none !important;
    padding:calc(var(--wc-nav-search-top, var(--wc-header-h, 76px)) + 214px) 20px 54px !important;
    box-sizing:border-box !important;
    margin:0 !important;
    display:none;
    opacity:0 !important;
    transition:opacity .3s cubic-bezier(.4,0,.2,1) !important;
    z-index:9999 !important;
  }
  nav#nav-menu .wc-nav-search-results.is-active{
    display:block !important;
    opacity:1 !important;
  }
  nav#nav-menu .wc-search-panel{
    width:min(760px, 100%) !important;
    margin:0 auto !important;
    color:rgba(255,255,255,.92) !important;
  }
  nav#nav-menu .wc-search-kicker{
    margin:0 0 28px !important;
    color:rgba(255,255,255,.48) !important;
    font-size:11px !important;
    line-height:1 !important;
    font-weight:800 !important;
    letter-spacing:.16em !important;
    text-transform:uppercase !important;
  }
  nav#nav-menu .wc-search-group{
    max-width:none !important;
    margin:0 !important;
    padding:0 0 22px !important;
  }
  nav#nav-menu .wc-search-group + .wc-search-group{
    border-top:1px solid rgba(255,255,255,.12) !important;
    padding-top:24px !important;
  }
  nav#nav-menu .wc-search-group-label{
    margin:0 0 10px !important;
    color:rgba(255,255,255,.46) !important;
    font-size:11px !important;
    font-weight:800 !important;
    letter-spacing:.15em !important;
    text-transform:uppercase !important;
  }
  nav#nav-menu .wc-nav-search-result{
    display:grid !important;
    grid-template-columns:minmax(0, 1fr) auto !important;
    gap:18px !important;
    align-items:center !important;
    position:relative !important;
    overflow:hidden !important;
    padding:13px 0 !important;
    border-radius:0 !important;
    text-decoration:none !important;
    border-bottom:1px solid rgba(255,255,255,.10) !important;
    list-style:none !important;
    background-image:none !important;
    outline:0 !important;
    transition:color .2s ease, border-color .2s ease !important;
  }
  nav#nav-menu .wc-nav-search-result::before,
  nav#nav-menu .wc-nav-search-result::after,
  nav#nav-menu .wc-nav-search-result strong::before,
  nav#nav-menu .wc-nav-search-result strong::after{
    content:none !important;
    display:none !important;
  }
  nav#nav-menu .wc-nav-search-result::marker{
    content:"" !important;
  }
  nav#nav-menu .wc-nav-search-result:last-child{
    border-bottom:0 !important;
  }
  nav#nav-menu .wc-nav-search-result:hover{
    background:transparent !important;
    border-color:rgba(255,255,255,.22) !important;
  }
  nav#nav-menu .wc-nav-search-result strong{
    display:block !important;
    margin:0 !important;
    color:rgba(255,255,255,.92) !important;
    font-size:16px !important;
    line-height:1.35 !important;
    font-weight:650 !important;
    letter-spacing:0 !important;
  }
  nav#nav-menu .wc-nav-search-result span{
    display:block !important;
    color:rgba(255,255,255,.46) !important;
    font-size:12px !important;
    line-height:1.35 !important;
    font-weight:600 !important;
    text-align:right !important;
  }
  nav#nav-menu .wc-nav-search-empty{
    padding:20px 0 36px !important;
    color:rgba(255,255,255,.58) !important;
    font-size:15px !important;
    font-weight:600 !important;
  }
  nav#nav-menu .wc-search-recent{
    margin-top:12px !important;
    padding-top:0 !important;
    border-top:0 !important;
  }
  nav#nav-menu .wc-search-recent-label{
    margin:0 0 12px !important;
    color:rgba(255,255,255,.42) !important;
    font-size:11px !important;
    line-height:1 !important;
    font-weight:800 !important;
    letter-spacing:.15em !important;
    text-transform:uppercase !important;
  }
  nav#nav-menu .wc-search-recent-pills{
    display:flex !important;
    flex-wrap:wrap !important;
    gap:8px !important;
  }
  nav#nav-menu .wc-search-recent-pill{
    display:inline-flex !important;
    align-items:center !important;
    min-height:30px !important;
    padding:0 12px !important;
    border:1px solid rgba(255,255,255,.14) !important;
    border-radius:999px !important;
    background:rgba(255,255,255,.06) !important;
    color:rgba(255,255,255,.68) !important;
    font-size:12px !important;
    font-weight:700 !important;
    cursor:pointer !important;
    transition:background .2s ease, color .2s ease, border-color .2s ease !important;
  }
  nav#nav-menu .wc-search-recent-pill:hover{
    background:rgba(255,255,255,.10) !important;
    border-color:rgba(255,255,255,.24) !important;
    color:rgba(255,255,255,.9) !important;
  }
  nav#nav-menu .wc-nav-links{
    grid-column:2 !important;
    display:flex !important;
    align-items:center !important;
    justify-content:flex-end !important;
    gap:4px !important;
    margin:0 !important;
    padding:0 !important;
    list-style:none !important;
  }
  nav#nav-menu .wc-nav-links a{
    display:inline-flex !important;
    align-items:center !important;
    min-height:38px !important;
    padding:0 12px !important;
    border:0 !important;
    border-radius:999px !important;
    background:transparent !important;
    color:rgba(255,255,255,.92) !important;
    font-size:14px !important;
    font-weight:700 !important;
    letter-spacing:0 !important;
    text-decoration:none !important;
    white-space:nowrap !important;
  }
  nav#nav-menu .wc-nav-links a:hover{
    background:rgba(255,255,255,.14) !important;
    color:#d1be78 !important;
  }
  nav#nav-menu .wc-nav-links-search{
    display:none !important;
  }
  nav#nav-menu .wc-nav-actions{
    grid-column:3 !important;
    display:flex !important;
    align-items:center !important;
    justify-content:flex-end !important;
    gap:8px !important;
    position:relative !important;
  }
  nav#nav-menu .wc-nav-search-toggle,
  nav#nav-menu .wc-theme-toggle,
  nav#nav-menu .wc-nav-menu-toggle{
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    width:40px !important;
    height:40px !important;
    flex:0 0 auto !important;
    border-radius:999px !important;
    border:1px solid rgba(255,255,255,.5) !important;
    background:rgba(255,255,255,.14) !important;
    color:#ffffff !important;
    cursor:pointer !important;
    position:relative !important;
    padding:0 !important;
  }
  nav#nav-menu .wc-nav-search-toggle:hover,
  nav#nav-menu .wc-theme-toggle:hover,
  nav#nav-menu .wc-nav-menu-toggle:hover{
    background:rgba(255,255,255,.2) !important;
  }
  nav#nav-menu .wc-nav-search-toggle svg,
  nav#nav-menu .wc-theme-toggle svg{
    width:18px !important;
    height:18px !important;
    stroke:currentColor !important;
    fill:none !important;
  }
  nav#nav-menu .wc-theme-toggle .wc-theme-sun{
    display:none !important;
  }
  html[data-theme="dark"] nav#nav-menu .wc-theme-toggle .wc-theme-moon{
    display:none !important;
  }
  html[data-theme="dark"] nav#nav-menu .wc-theme-toggle .wc-theme-sun{
    display:block !important;
  }
  nav#nav-menu .wc-nav-menu-toggle{
    display:none !important;
    color:#ffffff !important;
  }
  nav#nav-menu .wc-nav-menu-toggle span{
    position:absolute !important;
    left:50% !important;
    top:50% !important;
    --wc-menu-icon-x:1px;
    --wc-menu-icon-y:2px;
    width:18px !important;
    height:2px !important;
    border-radius:999px !important;
    background:currentColor !important;
    transform:translate(calc(-50% + var(--wc-menu-icon-x)), calc(-50% + var(--wc-menu-icon-y))) !important;
    transform-origin:center !important;
  }
  nav#nav-menu .wc-nav-menu-toggle span:nth-child(1){transform:translate(calc(-50% + var(--wc-menu-icon-x)), calc(-50% + var(--wc-menu-icon-y) - 6px)) !important}
  nav#nav-menu .wc-nav-menu-toggle span:nth-child(3){transform:translate(calc(-50% + var(--wc-menu-icon-x)), calc(-50% + var(--wc-menu-icon-y) + 6px)) !important}
  @media (max-width:860px){
    nav#nav-menu.nav-menu{
      display:flex !important;
      flex-wrap:wrap !important;
      justify-content:space-between !important;
    }
    nav#nav-menu .wc-nav-links{
      order:5 !important;
      flex:1 0 100% !important;
      display:none !important;
      flex-direction:column !important;
      align-items:stretch !important;
      padding-top:10px !important;
      margin-top:6px !important;
      border-top:1px solid rgba(255,255,255,0.18) !important;
    }
    nav#nav-menu.is-menu-open .wc-nav-links{
      display:flex !important;
    }
    nav#nav-menu .wc-nav-links a{
      justify-content:flex-start !important;
      border-radius:12px !important;
      background:rgba(255,255,255,.12) !important;
    }
    nav#nav-menu .wc-nav-links-search{
      order:-1 !important;
      display:inline-flex !important;
      align-items:center !important;
      gap:8px !important;
      justify-content:flex-start !important;
      min-height:38px !important;
      padding:0 12px !important;
      margin-bottom:6px !important;
      border:0 !important;
      border-radius:12px !important;
      background:rgba(255,255,255,.12) !important;
      color:rgba(255,255,255,.92) !important;
      font-size:14px !important;
      font-weight:700 !important;
      cursor:pointer !important;
    }
    nav#nav-menu .wc-nav-links-search svg{
      width:18px !important;
      height:18px !important;
      stroke:currentColor !important;
      fill:none !important;
      flex:0 0 auto !important;
    }
    nav#nav-menu .wc-nav-menu-toggle{
      display:inline-flex !important;
    }
    nav#nav-menu .wc-nav-search-toggle{
      display:none !important;
    }
  }
  .wc-breadcrumb{
    display:flex !important;
    align-items:center !important;
    gap:8px !important;
    flex-wrap:wrap !important;
    width:min(980px, calc(100% - 32px)) !important;
    margin:0 auto 22px !important;
    padding:0 !important;
    box-sizing:border-box !important;
    background:transparent !important;
    color:#607184 !important;
    font-size:13px !important;
    font-weight:800 !important;
    letter-spacing:0 !important;
    font-family:Arial, Helvetica, sans-serif !important;
  }
  #content > .wc-breadcrumb{
    width:100% !important;
    margin:-12px 0 24px !important;
  }
  .wc-breadcrumb a{
    color:#006231 !important;
    text-decoration:none !important;
    opacity:1 !important;
  }
  .wc-breadcrumb a:hover{
    color:#0b7741 !important;
    text-decoration:none !important;
  }
  .wc-breadcrumb-sep{
    color:rgba(96,113,132,.52) !important;
    opacity:1 !important;
  }
  .wc-breadcrumb-current{
    color:#607184 !important;
    opacity:1 !important;
  }
  nav#nav-menu .nav-menu-list{
    display:flex !important;
    align-items:center !important;
    justify-content:flex-end !important;
    gap:10px !important;
    margin:0 !important;
    padding:0 !important;
    list-style:none !important;
    flex:1 1 auto !important;
  }
  nav#nav-menu .nav-menu-item,
  nav#nav-menu .dropdown-item{
    position:relative !important;
    border-radius:999px !important;
    background:transparent !important;
    border:1px solid transparent !important;
  }
  nav#nav-menu .nav-menu-item-title,
  nav#nav-menu .dropdown-item-title{
    margin:0 !important;
    padding:11px 18px !important;
    color:#ffffff !important;
    font-size:13px !important;
    line-height:1 !important;
    font-weight:700 !important;
    letter-spacing:.08em !important;
    text-transform:uppercase !important;
    white-space:nowrap !important;
  }
  nav#nav-menu .nav-menu-item:hover,
  nav#nav-menu .dropdown-item:hover{
    background:rgba(255,255,255,0.16) !important;
  }
  nav#nav-menu .dropdown{
    margin-top:12px !important;
    border:1px solid rgba(209,190,120,0.38) !important;
    border-radius:18px !important;
    background:#ffffff !important;
    box-shadow:0 16px 34px rgba(36,52,77,0.14) !important;
    overflow:hidden !important;
  }
  nav#nav-menu .dropdown-list{
    margin:0 !important;
    padding:8px !important;
    list-style:none !important;
  }
  nav#nav-menu .hamburger-menu,
  nav#nav-menu .table-of-contents,
  nav#nav-menu .table-of-contents-button,
  nav#nav-menu .js-inline-nav-menu-item,
  nav#nav-menu .js-more-nav-menu-dropdown-button,
  nav#nav-menu li[data-id="more-nav-menu-dropdown"],
  nav#nav-menu li[aria-controls="more-nav-menu-dropdown-dropdown"],
  nav#nav-menu li[data-id="6989dbbdb4696f0b333f2246"]{
    display:none !important;
    visibility:hidden !important;
    opacity:0 !important;
    width:0 !important;
    height:0 !important;
    overflow:hidden !important;
    pointer-events:none !important;
  }
  nav#nav-menu .nav-menu-item-title,
  nav#nav-menu .dropdown-item-title{
    pointer-events:auto !important;
  }
  nav#nav-menu .js-more-nav-menu-dropdown-button .nav-menu-item-title,
  nav#nav-menu li[data-id="more-nav-menu-dropdown"] .nav-menu-item-title,
  nav#nav-menu li[aria-controls="more-nav-menu-dropdown-dropdown"] .nav-menu-item-title{
    display:none !important;
    visibility:hidden !important;
    opacity:0 !important;
  }
  [data-report-table-container-id]{
    border:1px solid rgba(209,190,120,0.45) !important;
    border-radius:24px !important;
    overflow:auto !important;
    -webkit-overflow-scrolling:touch !important;
    box-sizing:border-box !important;
    background:#ffffff !important;
    box-shadow:
      0 14px 34px rgba(0,63,40,0.08),
      0 4px 12px rgba(36,52,77,0.06) !important;
  }
  [data-table-scroll-container="true"]{
    overflow:auto !important;
    -webkit-overflow-scrolling:touch !important;
    max-width:100% !important;
  }
  [data-report-table-id]{
    width:max-content !important;
    min-width:100% !important;
    border-collapse:separate !important;
    border-spacing:0 !important;
    font-family:Arial, Helvetica, sans-serif !important;
    font-size:14px !important;
  }
  [data-report-table-id] th,
  [data-report-table-id] td{
    padding:12px 14px !important;
    border:0 !important;
    border-bottom:1px solid rgba(36,52,77,0.10) !important;
    vertical-align:middle !important;
  }
  [data-report-table-id] thead th{
    background:linear-gradient(135deg,#003f28 0%,#005236 100%) !important;
    color:#ffffff !important;
    font-weight:700 !important;
    text-align:center !important;
    border-bottom:4px solid #d1be78 !important;
  }
  [data-report-table-id] tbody th{
    color:#172033 !important;
    font-weight:700 !important;
    text-align:left !important;
    background:#ffffff !important;
  }
  [data-report-table-id] tbody td{
    color:#344054 !important;
    text-align:center !important;
    background:#ffffff !important;
  }
  [data-report-table-id] tbody tr:nth-child(even) th,
  [data-report-table-id] tbody tr:nth-child(even) td{
    background:rgba(0,63,40,0.04) !important;
  }
  [data-report-table-id] tbody tr:hover th,
  [data-report-table-id] tbody tr:hover td{
    background:rgba(209,190,120,0.18) !important;
  }
  [data-report-table-id] tbody tr.rowGroupTotal__cm3qr th,
  [data-report-table-id] tbody tr.rowGroupTotal__cm3qr td{
    background:linear-gradient(135deg,#d1be78 0%,#c2ac5f 100%) !important;
    color:#172033 !important;
    font-weight:700 !important;
    border-bottom:0 !important;
  }
  [data-report-table-id] .wc-budget-total-row th,
  [data-report-table-id] .wc-budget-total-row td{
    background:linear-gradient(135deg,#d1be78 0%,#c2ac5f 100%) !important;
    color:#172033 !important;
    font-weight:700 !important;
    border-bottom:0 !important;
  }
  [data-report-table-id] .wc-budget-total-row:hover th,
  [data-report-table-id] .wc-budget-total-row:hover td{
    background:linear-gradient(135deg,#d1be78 0%,#c2ac5f 100%) !important;
  }
  [data-report-table-id] th.wc-fy-column-hidden,
  [data-report-table-id] td.wc-fy-column-hidden{
    display:none !important;
    width:0 !important;
    min-width:0 !important;
    max-width:0 !important;
    padding:0 !important;
    border:0 !important;
    margin:0 !important;
    height:0 !important;
    line-height:0 !important;
    font-size:0 !important;
    box-sizing:border-box !important;
  }
  .wc-fy-column-toggle-wrap{
    display:flex !important;
    justify-content:flex-end !important;
    align-items:center !important;
    width:auto !important;
    min-height:18px !important;
    padding:2px 7px !important;
    margin:0 0 3px 0 !important;
    box-sizing:border-box !important;
    background:#ffffff !important;
    border:1px solid rgba(209,190,120,0.55) !important;
    border-radius:999px !important;
    color:#24344d !important;
    font-family:Arial, Helvetica, sans-serif !important;
    font-size:10px !important;
    font-weight:600 !important;
  }
  .wc-has-fy-column-toggle-title{
    display:flex !important;
    align-items:center !important;
    justify-content:space-between !important;
    gap:8px !important;
    width:100% !important;
    max-width:100% !important;
    box-sizing:border-box !important;
  }
  .wc-has-fy-column-toggle-title [data-test="summary-table-title"]{
    flex:1 1 auto !important;
    min-width:0 !important;
  }
  .wc-fy-column-toggle-in-title{
    flex:0 0 auto !important;
    margin-left:auto !important;
    width:auto !important;
  }
  .wc-fy-column-toggle-label{
    display:inline-flex !important;
    align-items:center !important;
    gap:4px !important;
    cursor:pointer !important;
    color:#24344d !important;
    font-size:10px !important;
    font-weight:600 !important;
    font-style:italic !important;
    text-transform:none !important;
    letter-spacing:.03em !important;
  }
  .wc-fy-column-toggle-checkbox{
    width:11px !important;
    height:11px !important;
    margin:0 !important;
    accent-color:#003f28 !important;
    cursor:pointer !important;
  }
  .wc-fy-column-toggle-text{
    font-size:10px !important;
    line-height:1 !important;
    font-style:italic !important;
    text-transform:none !important;
    letter-spacing:.03em !important;
  }
  .wc-budget-line-tooltip-cell{
    white-space:normal !important;
  }
  .wc-budget-line-tooltip-anchor{
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    width:16px !important;
    height:16px !important;
    min-width:16px !important;
    margin:0 0 0 6px !important;
    padding:0 !important;
    border:1px solid #d1be78 !important;
    border-radius:999px !important;
    background:#ffffff !important;
    color:#003f28 !important;
    font-family:Arial, Helvetica, sans-serif !important;
    font-size:10px !important;
    line-height:1 !important;
    font-weight:800 !important;
    font-style:normal !important;
    vertical-align:middle !important;
    cursor:help !important;
    box-shadow:0 1px 4px rgba(23,32,51,0.12) !important;
  }
  .wc-budget-line-tooltip-anchor:hover,
  .wc-budget-line-tooltip-anchor:focus{
    background:#d1be78 !important;
    color:#172033 !important;
    outline:2px solid rgba(0,63,40,0.22) !important;
    outline-offset:2px !important;
  }
  .wc-budget-line-tooltip-bubble{
    position:fixed !important;
    z-index:10050 !important;
    display:block !important;
    visibility:hidden !important;
    opacity:0 !important;
    pointer-events:none !important;
    max-width:calc(100vw - 32px) !important;
    padding:10px 12px !important;
    border:1px solid #d1be78 !important;
    border-radius:8px !important;
    background:#172033 !important;
    color:#ffffff !important;
    box-shadow:0 12px 28px rgba(23,32,51,0.24) !important;
    font-family:Arial, Helvetica, sans-serif !important;
    font-size:12px !important;
    line-height:1.4 !important;
    font-weight:600 !important;
    text-align:left !important;
    transform:translateY(-2px) !important;
    transition:opacity .15s ease, transform .15s ease, visibility .15s ease !important;
  }
  .wc-budget-line-tooltip-bubble.is-visible{
    visibility:visible !important;
    opacity:1 !important;
    transform:translateY(0) !important;
  }
  [data-report-table-id] th:first-child,
  [data-report-table-id] td:first-child{
    position:sticky !important;
    left:0 !important;
    z-index:10 !important;
    min-width:150px !important;
    max-width:190px !important;
    text-align:left !important;
    background:#ffffff !important;
    background-clip:padding-box !important;
    box-shadow:10px 0 14px rgba(36,52,77,0.14) !important;
  }
  [data-report-table-id] thead th:first-child{
    z-index:12 !important;
    background:linear-gradient(135deg,#003f28 0%,#005236 100%) !important;
    color:#ffffff !important;
  }
  [data-report-table-id] tbody tr:nth-child(even) th:first-child,
  [data-report-table-id] tbody tr:nth-child(even) td:first-child{
    background:#f5f9f7 !important;
  }
  [data-report-table-id] tbody tr:hover th:first-child,
  [data-report-table-id] tbody tr:hover td:first-child{
    background:#f8f2dc !important;
  }
  [data-report-table-id] tbody tr.rowGroupTotal__cm3qr th:first-child,
  [data-report-table-id] tbody tr.rowGroupTotal__cm3qr td:first-child,
  [data-report-table-id] .wc-budget-total-row th:first-child,
  [data-report-table-id] .wc-budget-total-row td:first-child,
  [data-report-table-id] .wc-budget-total-row:hover th:first-child,
  [data-report-table-id] .wc-budget-total-row:hover td:first-child{
    background:linear-gradient(135deg,#d1be78 0%,#c2ac5f 100%) !important;
  }
  [data-report-table-id] caption{
    display:none !important;
  }
  .social-wrapper{
    display:none !important;
    visibility:hidden !important;
    opacity:0 !important;
    height:0 !important;
    width:0 !important;
    overflow:hidden !important;
  }
  .powered-by{
    display:none !important;
    visibility:hidden !important;
    opacity:0 !important;
    height:0 !important;
    width:0 !important;
    overflow:hidden !important;
    pointer-events:none !important;
  }
  footer[role="contentinfo"]{
    display:block !important;
    visibility:visible !important;
    opacity:1 !important;
    position:relative !important;
    left:auto !important;
    right:auto !important;
    bottom:auto !important;
    width:100vw !important;
    max-width:none !important;
    min-height:150px !important;
    height:auto !important;
    margin:48px calc(50% - 50vw) 0 !important;
    padding:0 0 4px 0 !important;
    background:#ffffff !important;
    border-top:1px solid rgba(36,52,77,0.10) !important;
    box-shadow:none !important;
    font-family:Arial, Helvetica, sans-serif !important;
    box-sizing:border-box !important;
    overflow:hidden !important;
    z-index:1 !important;
  }
  footer[role="contentinfo"] *{
    visibility:visible !important;
    opacity:1 !important;
  }
  footer[role="contentinfo"] .footer-container{
    display:block !important;
    visibility:visible !important;
    opacity:1 !important;
    width:100% !important;
    max-width:100% !important;
    min-height:82px !important;
    height:auto !important;
    margin:0 !important;
    padding:28px 36px 1px 36px !important;
    background:#ffffff !important;
    box-sizing:border-box !important;
    overflow:hidden !important;
  }
  footer[role="contentinfo"] .logo-container{
    display:none !important;
  }
  .wc-budget-footer-inner{
    display:flex !important;
    visibility:visible !important;
    opacity:1 !important;
    align-items:center !important;
    justify-content:space-between !important;
    gap:28px !important;
    width:100% !important;
    min-height:auto !important;
    padding-bottom:1px !important;
    margin-bottom:0 !important;
    height:auto !important;
    background:#ffffff !important;
    box-sizing:border-box !important;
    min-width:0 !important;
  }
  .wc-budget-footer-brand{
    display:flex !important;
    align-items:center !important;
    justify-content:flex-start !important;
    gap:0 !important;
    width:auto !important;
    min-width:max-content !important;
    max-width:none !important;
    height:64px !important;
    flex:0 0 auto !important;
    overflow:visible !important;
    text-decoration:none !important;
  }
  .wc-split-brand-link{
    display:inline-flex !important;
    align-items:center !important;
    justify-content:flex-start !important;
    width:max-content !important;
    max-width:100% !important;
    height:64px !important;
    color:inherit !important;
    text-decoration:none !important;
    cursor:pointer !important;
  }
  .wc-split-brand-link .wc-split-brand{
    pointer-events:none !important;
  }
  .wc-budget-footer-links{
    display:flex !important;
    align-items:center !important;
    justify-content:flex-end !important;
    flex-wrap:wrap !important;
    gap:8px !important;
  }
  .wc-budget-footer-links a{
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    min-height:38px !important;
    padding:10px 16px !important;
    border-radius:999px !important;
    color:#172033 !important;
    background:transparent !important;
    border:0 !important;
    text-decoration:none !important;
    font-size:12px !important;
    line-height:1 !important;
    font-weight:800 !important;
    letter-spacing:.07em !important;
    text-transform:uppercase !important;
    white-space:nowrap !important;
    box-shadow:none !important;
    transition:background .2s ease, color .2s ease !important;
  }
  .wc-budget-footer-links a:hover{
    background:rgba(0,98,49,0.08) !important;
    color:#004b2d !important;
  }
  .wc-budget-footer-bottom{
    display:block !important;
    visibility:visible !important;
    opacity:1 !important;
    width:100% !important;
    max-width:100% !important;
    min-height:52px !important;
    height:auto !important;
    margin:0 !important;
    padding:14px 36px 48px 36px !important;
    border-top:1px solid rgba(36,52,77,0.10) !important;
    background:#ffffff !important;
    box-sizing:border-box !important;
    color:rgba(36,52,77,0.70) !important;
    font-size:12px !important;
    line-height:1.5 !important;
    font-weight:600 !important;
    text-align:center !important;
    overflow:visible !important;
  }
  footer[role="contentinfo"].wc-search-footer{
    min-height:0 !important;
    margin:0 calc(50% - 50vw) 0 !important;
    padding:0 !important;
    background:#f6f8f5 !important;
    border-top:1px solid rgba(36,52,77,0.10) !important;
    overflow:visible !important;
  }
  footer[role="contentinfo"].wc-search-footer .footer-container{
    width:min(1120px, 100%) !important;
    max-width:100% !important;
    min-height:0 !important;
    margin:0 auto !important;
    padding:42px clamp(22px, 4vw, 44px) 36px !important;
    background:transparent !important;
    overflow:visible !important;
  }
  .wc-search-footer .wc-budget-footer-inner{
    display:grid !important;
    grid-template-columns:minmax(0, 1fr) auto !important;
    align-items:end !important;
    gap:24px !important;
    margin:0 !important;
    padding:0 !important;
    background:transparent !important;
  }
  .wc-footer-search-copy{
    max-width:680px !important;
  }
  .wc-footer-search-copy h2{
    margin:0 !important;
    color:#172033 !important;
    font-family:Georgia, "Times New Roman", serif !important;
    font-size:clamp(28px, 3.2vw, 42px) !important;
    line-height:1.05 !important;
    font-weight:500 !important;
    letter-spacing:0 !important;
  }
  .wc-footer-search-copy p{
    max-width:560px !important;
    margin:10px 0 0 !important;
    color:rgba(36,52,77,.72) !important;
    font-size:15px !important;
    line-height:1.55 !important;
    font-weight:500 !important;
  }
  .wc-footer-search-button{
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    gap:8px !important;
    min-height:42px !important;
    padding:0 18px !important;
    border:1px solid rgba(0,63,40,.18) !important;
    border-radius:999px !important;
    background:#003f28 !important;
    color:#ffffff !important;
    font:800 12px/1 Arial, Helvetica, sans-serif !important;
    letter-spacing:.04em !important;
    text-transform:none !important;
    cursor:pointer !important;
    box-shadow:0 10px 24px rgba(0,63,40,.14) !important;
    transition:transform .2s ease, background .2s ease, box-shadow .2s ease !important;
    white-space:nowrap !important;
  }
  .wc-footer-search-button:hover{
    transform:translateY(-1px) !important;
    background:#002f1f !important;
    box-shadow:0 12px 28px rgba(0,63,40,.18) !important;
  }
  .wc-footer-search-button svg{
    width:15px !important;
    height:15px !important;
  }
  .wc-search-footer .wc-budget-footer-links{
    display:flex !important;
    justify-content:flex-start !important;
    gap:20px !important;
    margin-top:28px !important;
    padding-top:18px !important;
    border-top:1px solid rgba(36,52,77,.10) !important;
  }
  .wc-search-footer .wc-budget-footer-links a{
    min-height:auto !important;
    padding:0 !important;
    border-radius:0 !important;
    color:#172033 !important;
    background:transparent !important;
    font-size:11px !important;
    font-weight:700 !important;
    letter-spacing:.02em !important;
    text-transform:none !important;
  }
  .wc-search-footer .wc-budget-footer-links a:hover{
    color:#004b2d !important;
    background:transparent !important;
  }
  .wc-search-footer .wc-budget-footer-bottom,
  .wc-search-footer .wc-budget-footer-brand{
    display:none !important;
  }
  html[data-theme="dark"] footer[role="contentinfo"].wc-search-footer{
    background:transparent !important;
  }
  html[data-theme="dark"] footer[role="contentinfo"].wc-search-footer .footer-container{
    background:rgba(14,28,22,.92) !important;
    border-color:rgba(226,235,229,.16) !important;
    box-shadow:0 18px 46px rgba(0,0,0,.28) !important;
  }
  html[data-theme="dark"] .wc-footer-search-copy h2{
    color:#edf3ef !important;
  }
  html[data-theme="dark"] .wc-footer-search-copy p,
  html[data-theme="dark"] .wc-search-footer .wc-budget-footer-links a{
    color:#a9b9b0 !important;
  }
  html[data-theme="dark"] .wc-footer-search-button{
    background:rgba(123,211,159,.13) !important;
    border-color:rgba(123,211,159,.38) !important;
    color:#edf3ef !important;
    box-shadow:none !important;
  }
  html[data-theme="dark"] .wc-footer-search-button:hover{
    background:rgba(123,211,159,.2) !important;
    color:#edf3ef !important;
  }
  
  /* STANDALONE WALTON HEADER */
  .wc-standalone-budget-nav{
    position:sticky !important;
    top:0 !important;
    z-index:9999 !important;
    display:flex !important;
    align-items:center !important;
    justify-content:space-between !important;
    gap:24px !important;
    min-height:88px !important;
    padding:22px clamp(22px, 4vw, 64px) 14px !important;
    box-sizing:border-box !important;
    background:linear-gradient(180deg, rgba(0,62,40,.96), rgba(0,62,40,.88)) !important;
    border-bottom:0 !important;
    box-shadow:none !important;
    font-family:Arial, Helvetica, sans-serif !important;
  }
  html[data-theme="dark"] .wc-standalone-budget-nav{
    background:linear-gradient(180deg, rgba(5,20,14,.98), rgba(5,20,14,.92)) !important;
  }
  .wc-standalone-brand{
    display:flex !important;
    align-items:center !important;
    justify-content:flex-start !important;
    gap:0 !important;
    width:auto !important;
    min-width:max-content !important;
    max-width:none !important;
    height:64px !important;
    flex:0 0 auto !important;
    overflow:visible !important;
    text-decoration:none !important;
  }
  .wc-standalone-budget-nav .wc-split-brand{
    height:52px !important;
  }
  .wc-standalone-budget-nav .wc-split-brand-top{
    color:#ffffff !important;
    font-size:24px !important;
  }
  .wc-standalone-budget-nav .wc-split-brand-bottom{
    color:rgba(255,255,255,.82) !important;
  }
  .wc-standalone-budget-nav .wc-split-brand-seal,
  .wc-standalone-budget-nav .wc-seal-mark{
    width:46px !important;
    height:46px !important;
    flex-basis:46px !important;
    background-size:42px 42px !important;
  }
  .wc-standalone-links{
    display:flex !important;
    align-items:center !important;
    justify-content:flex-end !important;
    gap:10px !important;
    margin-left:auto !important;
  }
  .wc-standalone-links a{
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    min-height:38px !important;
    padding:10px 16px !important;
    border-radius:999px !important;
    color:rgba(255,255,255,.92) !important;
    background:transparent !important;
    border:0 !important;
    text-decoration:none !important;
    font-size:14px !important;
    line-height:1 !important;
    font-weight:700 !important;
    letter-spacing:0 !important;
    text-transform:none !important;
    white-space:nowrap !important;
  }
  .wc-standalone-links a:hover{
    background:rgba(255,255,255,.14) !important;
    color:#d1be78 !important;
  }
  
  `;
  var style = document.getElementById("wc-budget-nav-styles");
  if(!style){
    style = document.createElement("style");
    style.id = "wc-budget-nav-styles";
    document.head.appendChild(style);
  }
  style.textContent = css;
  loadWaltonMobileStylesheet();
  var WC_NAV_LINKS = [
    { label:"Our County", href:"our-county.html" },
    { label:"Budget Overview", href:"budget-overview.html" },
    { label:"Officers & Agencies", href:"constitutional-officers.html" },
    { label:"Departments", href:"departments.html" },
    { label:"Capital Projects", href:"capital-projects.html" },
    { label:"Financials", href:"financials.html" }
  ];
  function ensureWcNavChrome(){
    var nav = document.querySelector("nav#nav-menu.nav-menu");
    if(!nav){
      return;
    }
    var main = document.querySelector("main#content") || document.querySelector("main");
    if(main && !document.getElementById("main-content")){
      var mainTarget = document.createElement("span");
      mainTarget.id = "main-content";
      mainTarget.className = "wc-sr-only";
      mainTarget.setAttribute("tabindex", "-1");
      mainTarget.textContent = "Main content";
      main.insertBefore(mainTarget, main.firstChild);
    }
    if(!document.querySelector(".wc-skip-link")){
      var skipLink = document.createElement("a");
      skipLink.className = "wc-skip-link";
      skipLink.href = "#main-content";
      skipLink.textContent = "Skip to main content";
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
    if(!nav.querySelector(".wc-nav-links")){
      var linksWrap = document.createElement("div");
      linksWrap.className = "wc-nav-links";
      linksWrap.innerHTML =
        '<button type="button" class="wc-nav-links-search" aria-label="Search">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.15 6.15a7.5 7.5 0 0 0 10.5 10.5Z"></path>' +
          '</svg>' +
          '<span>Search</span>' +
        '</button>' +
        WC_NAV_LINKS.map(function(link){
          return '<a href="' + link.href + '">' + link.label + '</a>';
        }).join("");
      nav.appendChild(linksWrap);
    }
    if(!nav.querySelector(".wc-nav-actions")){
      var actions = document.createElement("div");
      actions.className = "wc-nav-actions";
      actions.innerHTML = `
        <button type="button" class="wc-nav-search-toggle" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.15 6.15a7.5 7.5 0 0 0 10.5 10.5Z"></path>
          </svg>
        </button>
        <button type="button" class="wc-nav-menu-toggle" aria-label="Open navigation menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      `;
      nav.appendChild(actions);
      var searchToggle = actions.querySelector(".wc-nav-search-toggle");
      var menuToggle = actions.querySelector(".wc-nav-menu-toggle");
      applyWaltonTheme(getStoredWaltonTheme());
      function syncNavSearchTop(){
        var navRect = nav.getBoundingClientRect();
        document.documentElement.style.setProperty("--wc-nav-search-top", navRect.height + "px");
        var logo = nav.querySelector(".logo-container");
        if(logo){
          var logoRect = logo.getBoundingClientRect();
          document.documentElement.style.setProperty("--wc-search-left", Math.max(0, logoRect.right - navRect.left + 24) + "px");
        }
      }
      function closeNavSearch(){
        if(window.WaltonBudgetGlobalSearch && window.WaltonBudgetGlobalSearch.nav === nav){
          window.WaltonBudgetGlobalSearch.close();
        }else{
          nav.classList.remove("is-search-open");
          document.body.classList.remove("wc-global-search-open");
          document.body.style.overflow = "";
        }
      }
      function openNavSearch(){
        syncNavSearchTop();
        if(window.WaltonBudgetGlobalSearch && window.WaltonBudgetGlobalSearch.nav === nav){
          window.WaltonBudgetGlobalSearch.open();
        }else{
          nav.classList.add("is-search-open");
          document.body.classList.add("wc-global-search-open");
          document.body.style.overflow = "hidden";
          setTimeout(function(){
            var input = nav.querySelector("#wcTocSearch");
            if(input){
              input.focus();
            }
          }, 60);
        }
      }
      searchToggle.addEventListener("click", function(){
        if(nav.classList.contains("is-search-open")){
          closeNavSearch();
        }else{
          openNavSearch();
        }
      });
      var linksSearchToggle = nav.querySelector(".wc-nav-links-search");
      if(linksSearchToggle){
        linksSearchToggle.addEventListener("click", function(){
          nav.classList.remove("is-menu-open");
          menuToggle.setAttribute("aria-expanded", "false");
          openNavSearch();
        });
      }
      menuToggle.addEventListener("click", function(){
        var open = !nav.classList.contains("is-menu-open");
        nav.classList.toggle("is-menu-open", open);
        menuToggle.setAttribute("aria-expanded", String(open));
      });
      window.addEventListener("resize", function(){
        if(nav.classList.contains("is-search-open")){
          syncNavSearchTop();
        }
      });
      document.addEventListener("click", function(e){
        var resultsEl = nav.querySelector(".wc-nav-search-results");
        if(resultsEl && e.target === resultsEl){
          closeNavSearch();
          return;
        }
        if(!nav.contains(e.target)){
          closeNavSearch();
          nav.classList.remove("is-menu-open");
          menuToggle.setAttribute("aria-expanded", "false");
        }
      });
      document.addEventListener("keydown", function(e){
        if(e.key === "Escape" && nav.classList.contains("is-search-open")){
          closeNavSearch();
        }
        if(e.key === "Escape" && nav.classList.contains("is-menu-open")){
          nav.classList.remove("is-menu-open");
          menuToggle.setAttribute("aria-expanded", "false");
          menuToggle.focus({ preventScroll:true });
        }
      });
    }
    if(!nav.dataset.wcScrollBound){
      nav.dataset.wcScrollBound = "true";
      var onScroll = function(){
        nav.classList.toggle("is-scrolled", window.scrollY > 4);
      };
      window.addEventListener("scroll", onScroll, { passive:true });
      onScroll();
    }
  }
  function getWaltonSplitBrandHtml(linkHref, linkLabel){
    if(window.WaltonSplitLogo && typeof window.WaltonSplitLogo.getHtml === "function"){
      var splitLogoHtml = window.WaltonSplitLogo.getHtml("", "");
      if(!linkHref){
        return splitLogoHtml;
      }
      var splitLogoLabel = linkLabel || "Walton County Board of County Commissioners Home";
      return '<a class="wc-split-brand-link" href="' + linkHref + '" aria-label="' + splitLogoLabel + '">' + splitLogoHtml + '</a>';
    }
    var brandHtml = `
      <div class="wc-split-brand">
        <span class="wc-split-brand-seal wc-seal-mark" aria-hidden="true"></span>
        <div class="wc-split-brand-text">
          <div class="wc-split-brand-top">Walton County</div>
          <div class="wc-split-brand-bottom">Board of County Commissioners</div>
        </div>
      </div>
    `;
    if(!linkHref){
      return brandHtml;
    }
    return '<a class="wc-split-brand-link" href="' + linkHref + '" aria-label="' + (linkLabel || "Walton County Board of County Commissioners Home") + '">' + brandHtml + '</a>';
  }

  function ensureWaltonSplitLogoStyles(){
    if(window.WaltonSplitLogo && typeof window.WaltonSplitLogo.injectStyles === "function"){
      window.WaltonSplitLogo.injectStyles();
    }
  }
  function equalizeWaltonSplitLogo(root){
    if(window.WaltonSplitLogo && typeof window.WaltonSplitLogo.scheduleEqualize === "function"){
      window.WaltonSplitLogo.scheduleEqualize(root);
    }else if(window.WaltonSplitLogo && typeof window.WaltonSplitLogo.equalizeAll === "function"){
      window.WaltonSplitLogo.equalizeAll(root);
    }
  }
  function initWcNavSearch(){
    var nav = document.querySelector("nav#nav-menu.nav-menu");
    if(!nav){
      return;
    }
    if(typeof window.initWaltonBudgetSearch === "function"){
      window.initWaltonBudgetSearch({
        nav:nav,
        getWaltonSplitBrandHtml:getWaltonSplitBrandHtml
      });
      equalizeWaltonSplitLogo(nav);
      return;
    }
    var logoContainer = nav.querySelector(".logo-container");
    if(logoContainer && !logoContainer.querySelector(".wc-split-brand")){
      logoContainer.innerHTML = getWaltonSplitBrandHtml(
        "../index.html",
        "Walton County Board of County Commissioners Home"
      );
      if(window.WaltonSplitLogo && typeof window.WaltonSplitLogo.equalizeAll === "function"){
        equalizeWaltonSplitLogo(logoContainer);
      }
    }
    var sidebar = document.getElementById("sidebar");
    var searchHost = sidebar || nav;
    if(searchHost.querySelector(".wc-nav-search-slot")){
      return;
    }
    var slot = document.createElement("div");
    slot.className = "wc-nav-search-slot wc-nav-search-slot-fallback";
    slot.innerHTML = `
      <div class="wc-search-wrap">
        <div class="wc-search-box">
          <svg class="wc-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.15 6.15a7.5 7.5 0 0 0 10.5 10.5Z"></path>
          </svg>
          <input
            type="text"
            id="wcTocSearch"
            placeholder="Search is loading..."
            aria-label="Search table of contents"
            autocomplete="off"
            disabled
          >
        </div>
      </div>
      <div class="wc-nav-search-results" role="listbox" aria-label="Search results"></div>
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
  }
  function hideOpenGovMoreButton(){
    var nav = document.querySelector("nav#nav-menu.nav-menu");
    if(!nav){
      return;
    }
    var moreButtons = nav.querySelectorAll(
      '.js-more-nav-menu-dropdown-button, li[data-id="more-nav-menu-dropdown"], li[aria-controls="more-nav-menu-dropdown-dropdown"], li.nav-menu-item.clickable.js-dropdown-button.js-more-nav-menu-dropdown-button'
    );
    moreButtons.forEach(function(button){
      button.style.setProperty("display", "none", "important");
      button.style.setProperty("visibility", "hidden", "important");
      button.style.setProperty("opacity", "0", "important");
      button.style.setProperty("width", "0", "important");
      button.style.setProperty("height", "0", "important");
      button.style.setProperty("overflow", "hidden", "important");
      button.style.setProperty("pointer-events", "none", "important");
      button.setAttribute("aria-hidden", "true");
      button.setAttribute("tabindex", "-1");
    });
    nav.querySelectorAll(".nav-menu-item-title").forEach(function(title){
      if(title.textContent && title.textContent.trim().toLowerCase() === "more"){
        var parent = title.closest("li");
        if(parent){
          parent.style.setProperty("display", "none", "important");
          parent.style.setProperty("visibility", "hidden", "important");
          parent.style.setProperty("opacity", "0", "important");
          parent.style.setProperty("width", "0", "important");
          parent.style.setProperty("height", "0", "important");
          parent.style.setProperty("overflow", "hidden", "important");
          parent.style.setProperty("pointer-events", "none", "important");
          parent.setAttribute("aria-hidden", "true");
          parent.setAttribute("tabindex", "-1");
        }
      }
    });
  }
  function renderStandaloneBudgetNav(){
    if(!document.body){
      return;
    }
    if(document.querySelector(".wc-standalone-budget-nav")){
      return;
    }
    var header = document.createElement("header");
    header.className = "wc-standalone-budget-nav";
    header.innerHTML = `
      <div class="wc-standalone-brand" aria-label="Walton County">
        ${getWaltonSplitBrandHtml("", "")}
      </div>
    `;
    document.body.insertBefore(header, document.body.firstChild);
    equalizeWaltonSplitLogo(header);
  }
  function ensureWcBreadcrumb(){
    var eyebrow = document.querySelector(".page-eyebrow");
    var title = document.querySelector(".page-title");
    if(!eyebrow || !title){
      return;
    }
    var content = document.getElementById("content");
    var anchor = content || document.querySelector("nav#nav-menu.nav-menu") || document.querySelector(".wc-standalone-budget-nav");
    if(!anchor || !anchor.parentNode){
      return;
    }
    var eyebrowText = eyebrow.textContent.trim();
    var titleText = title.textContent.trim();
    var sectionCrumb = "";
    if(eyebrowText === titleText){
      sectionCrumb = "";
    }else if(titleText === "Overview of Walton County" || titleText === "Organizational Structure" || titleText === "Statistical & Supplemental Information" || titleText === "Glossary, Acronyms, and Frequently Asked Questions" || titleText === "Strategic Initiatives"){
      sectionCrumb = '<a href="our-county.html">Our County</a><span class="wc-breadcrumb-sep">/</span>';
    }else if(eyebrowText === "Departments"){
      sectionCrumb = '<a href="departments.html">Departments</a><span class="wc-breadcrumb-sep">/</span>';
    }else if(eyebrowText === "Constitutional Officers"){
      sectionCrumb = '<a href="constitutional-officers.html">Constitutional Officers & Other Agencies</a><span class="wc-breadcrumb-sep">/</span>';
    }else if(eyebrowText === "Autonomous Entities"){
      sectionCrumb = '<a href="constitutional-officers.html">Constitutional Officers & Other Agencies</a><span class="wc-breadcrumb-sep">/</span>';
    }else if(eyebrowText === "Introduction and Overview" || eyebrowText === "Financial Structure, Policies, and Process"){
      sectionCrumb = '<a href="budget-overview.html">Budget Overview</a><span class="wc-breadcrumb-sep">/</span>';
    }else if(eyebrowText === "Financial Summaries" || eyebrowText === "Debt and Financial Forecast" || eyebrowText === "Glossary, Statistical, and Supplemental Information"){
      sectionCrumb = '<a href="financials.html">Financials</a><span class="wc-breadcrumb-sep">/</span>';
    }else if(eyebrowText === "Capital Projects" || eyebrowText === "Capital Improvement Plan"){
      sectionCrumb = '<a href="capital-projects.html">Capital Projects</a><span class="wc-breadcrumb-sep">/</span>';
    }else if(eyebrowText){
      sectionCrumb = '<span>' + eyebrowText + '</span><span class="wc-breadcrumb-sep">/</span>';
    }
    var html = '<a href="../index.html">Home</a><span class="wc-breadcrumb-sep">/</span>' +
      sectionCrumb +
      '<span class="wc-breadcrumb-current">' + titleText + '</span>';
    var crumb = document.querySelector(".wc-breadcrumb");
    if(!crumb){
      crumb = document.createElement("nav");
      crumb.className = "wc-breadcrumb";
      crumb.setAttribute("aria-label", "Breadcrumb");
      if(content){
        content.insertBefore(crumb, content.firstChild);
      }else{
        anchor.parentNode.insertBefore(crumb, anchor.nextSibling);
      }
    }
    if(crumb.innerHTML !== html){
      crumb.innerHTML = html;
    }
  }
  function renderWaltonBudgetFooter(){
    if(!document.body){
      return;
    }
    function moveFooterToPageEnd(footer){
      if(!footer){
        return;
      }
      var layout = document.getElementById("layout");
      if(layout && layout.parentNode){
        layout.parentNode.insertBefore(footer, layout.nextSibling);
        return;
      }
      document.body.appendChild(footer);
    }

    var footer = document.querySelector('footer[role="contentinfo"]');
    if(!footer){
      footer = document.createElement('footer');
      footer.setAttribute('role', 'contentinfo');
      moveFooterToPageEnd(footer);
    }
    moveFooterToPageEnd(footer);
    var footerContainer = footer.querySelector('.footer-container');
    if(!footerContainer){
      footerContainer = document.createElement('div');
      footerContainer.className = 'footer-container';
      footerContainer.id = 'footer';
      footer.insertBefore(footerContainer, footer.firstChild);
    }
    footer.classList.add("wc-search-footer");
    var accessibilityHref = /\/pages\//.test(window.location.pathname) ? "accessibility.html" : "pages/accessibility.html";
    var desiredFooterHtml = `
      <div class="wc-budget-footer-inner">
        <div class="wc-footer-search-copy">
          <h2>Still looking for something?</h2>
          <p>Search departments, budgets, personnel, funds, publications, and county information.</p>
        </div>
        <button class="wc-footer-search-button" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 6.15 6.15a7.5 7.5 0 0 0 10.5 10.5Z"></path>
          </svg>
          Search the Budget
        </button>
      </div>
      <nav class="wc-budget-footer-links" aria-label="Footer utility links">
        <a href="mailto:budget@mywaltonfl.gov">Contact Budget Office</a>
        <a href="${accessibilityHref}">Accessibility</a>
      </nav>
    `;
    if(footerContainer.getAttribute("data-wc-rendered") !== "true" || footerContainer.innerHTML.trim() !== desiredFooterHtml.trim()){
      footerContainer.innerHTML = desiredFooterHtml;
      footerContainer.setAttribute("data-wc-rendered", "true");
    }
    footer.querySelectorAll('.wc-budget-footer-bottom').forEach(function(footerBottom){
      footerBottom.remove();
    });
    footer.querySelectorAll('.wc-footer-search-button').forEach(function(button){
      if(button.getAttribute("data-wc-search-bound") === "true"){
        return;
      }
      button.setAttribute("data-wc-search-bound", "true");
      button.addEventListener("click", function(){
        if(window.WaltonBudgetGlobalSearch && typeof window.WaltonBudgetGlobalSearch.open === "function"){
          window.WaltonBudgetGlobalSearch.open();
        }
      });
    });
  }
  function startWcBudgetNav(){
    ensureWaltonSplitLogoStyles();
    if(wcBudgetNavStarted){
      initWcNavSearch();
      ensureWcNavChrome();
      ensureWcBreadcrumb();
      hideOpenGovMoreButton();
      renderWaltonBudgetFooter();
      lockHorizontalPageScroll();
      return;
    }
    wcBudgetNavStarted = true;
    if(document.querySelector("nav#nav-menu.nav-menu")){
      loadWaltonBudgetSearchModules(function(){
        initWcNavSearch();
      });
      loadWaltonPerformanceMobile();
      ensureWcNavChrome();
      ensureWcBreadcrumb();
      setTimeout(initWcNavSearch, 800);
      setTimeout(initWcNavSearch, 2000);
      setTimeout(ensureWcBreadcrumb, 800);
      setTimeout(ensureWcBreadcrumb, 2000);
      hideOpenGovMoreButton();
      renderWaltonBudgetFooter();
      setTimeout(hideOpenGovMoreButton, 500);
      setTimeout(hideOpenGovMoreButton, 1500);
      setTimeout(renderWaltonBudgetFooter, 500);
      setTimeout(renderWaltonBudgetFooter, 1500);
      return;
    }
    renderStandaloneBudgetNav();
    loadWaltonPerformanceMobile();
    ensureWcBreadcrumb();
    setTimeout(ensureWcBreadcrumb, 800);
    setTimeout(ensureWcBreadcrumb, 2000);
    if(document.getElementById('app')){
      renderWaltonBudgetFooter();
    }else{
      document.addEventListener('DOMContentLoaded', function(){
        renderWaltonBudgetFooter();
      }, { once:true });
    }
  }
  function safelyStartWcBudgetNav(){
    if(!document.body){
      document.addEventListener('DOMContentLoaded', startWcBudgetNav, { once:true });
      document.addEventListener('DOMContentLoaded', function(){
        enhanceBudgetTables();
        watchForBudgetTables();
      }, { once:true });
      return;
    }
    startWcBudgetNav();
    enhanceBudgetTables();
    watchForBudgetTables();
  }
  loadWaltonSplitLogo(safelyStartWcBudgetNav);
  function lockHorizontalPageScroll(){
    document.documentElement.style.setProperty('overflow-x','hidden','important');
    document.documentElement.style.setProperty('max-width','100%','important');
    document.body.style.setProperty('overflow-x','hidden','important');
    document.body.style.setProperty('max-width','100%','important');
    document.querySelectorAll('.story-page, .content, .main-content, main, article, [data-testid="story-page"], .page-content, .story-content').forEach(function(el){
      el.style.setProperty('max-width','100%','important');
      el.style.setProperty('overflow-x','hidden','important');
    });
  }
  function repairWcBudgetNavAfterOpenGovNavigation(){
    try{
      ensureWaltonSplitLogoStyles();
      hideOpenGovMoreButton();
      renderWaltonBudgetFooter();
      lockHorizontalPageScroll();
      if(document.querySelector("nav#nav-menu.nav-menu")){
        if(typeof window.initWaltonBudgetSearch === "function"){
          window.initWaltonBudgetSearch({
            nav:document.querySelector("nav#nav-menu.nav-menu"),
            getWaltonSplitBrandHtml:getWaltonSplitBrandHtml
          });
        }else{
          initWcNavSearch();
        }
        ensureWcNavChrome();
      }
      ensureWcBreadcrumb();
    }catch(error){
      if(window.console && typeof window.console.error === "function"){
        window.console.error("Walton County budget nav repair failed:", error);
      }
    }
  }
  function queueWcBudgetNavRepair(){
    if(wcRepairTimer){
      clearTimeout(wcRepairTimer);
    }
    wcRepairTimer = setTimeout(function(){
      wcRepairTimer = null;
      repairWcBudgetNavAfterOpenGovNavigation();
    }, 700);
  }
  function watchForOpenGovNavigation(){
    var originalPushState = history.pushState;
    var originalReplaceState = history.replaceState;
    history.pushState = function(){
      originalPushState.apply(history, arguments);
      if(location.href !== wcLastKnownUrl){
        wcLastKnownUrl = location.href;
        queueWcBudgetNavRepair();
      }
    };
    history.replaceState = function(){
      originalReplaceState.apply(history, arguments);
      if(location.href !== wcLastKnownUrl){
        wcLastKnownUrl = location.href;
        queueWcBudgetNavRepair();
      }
    };
    window.addEventListener("popstate", function(){
      if(location.href !== wcLastKnownUrl){
        wcLastKnownUrl = location.href;
        queueWcBudgetNavRepair();
      }
    });
  }
  lockHorizontalPageScroll();
  setTimeout(lockHorizontalPageScroll, 500);
  setTimeout(lockHorizontalPageScroll, 1500);
  setTimeout(lockHorizontalPageScroll, 3000);
  // Navigation watcher intentionally disabled for OpenGov stability testing.
  // watchForOpenGovNavigation();
})();
