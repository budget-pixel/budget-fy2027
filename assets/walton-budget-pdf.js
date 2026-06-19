(function () {
  "use strict";

  var BRAND_LOGO_URL = "https://stories.opengov.com/countyofwaltonfl/uploads/c432578eae78-Walton_County_Logo_no_background.png";

var PRINT_CSS = `
@media print{
  @page{
    size:letter landscape;
    margin:.35in;
  }

  .wc-pdf-button,
  .wc-print-button-slot{
    display:none !important;
    visibility:hidden !important;
  }

  html,
  body{
    width:auto !important;
    height:auto !important;
    min-height:0 !important;
    overflow:visible !important;
    background:#ffffff !important;
    color:#172033 !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
  }

  *,
  *::before,
  *::after{
    box-shadow:none !important;
  }

  /* YouTube/map embeds never render in printed/PDF output, so hide the
     embed itself and collapse its two-column "statement + video" layout
     to a single full-width column instead of leaving a blank gap; the
     narrative text is justified so it fills that reclaimed width cleanly. */
  .wc-video-frame,
  .extension-video-frame,
  .libraries-video-frame,
  .mosquito-video-frame,
  .recreation-parks-section,
  .environmental-iframe-link,
  .public-works-iframe-link,
  .lifeguard-iframe-link,
  .libraries-iframe-link{
    display:none !important;
  }

  .extension-statement-media,
  .libraries-statement-media,
  .libraries-statement-lower,
  .mosquito-statement-media,
  .eagle-springs-statement-media,
  .eagle-springs-grill-statement-media{
    display:block !important;
    grid-template-columns:none !important;
  }

  .statement-of-function h2,
  .statement-of-function-style-heading,
  .tourism-admin-section-title{
    border-left:0 !important;
    padding-left:0 !important;
  }

  .statement-of-function p,
  .statement-of-function-style-heading + p,
  .tourism-admin-overview p,
  .tourism-admin-section p,
  .libraries-statement-intro p,
  .libraries-statement-rest p,
  .content-section p{
    text-align:justify !important;
  }

  body{
    padding-top:0 !important;
    padding-bottom:.08in !important;
    position:relative !important;
  }

  body::before{
    content:none !important;
    display:none !important;
    visibility:hidden !important;
    width:0 !important;
    height:0 !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
  }

  body::after{
    content:none !important;
    display:none !important;
    visibility:hidden !important;
    width:0 !important;
    height:0 !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
  }

  header.header{
    display:block !important;
    visibility:visible !important;
    background:#ffffff !important;
    background-image:none !important;
    min-height:auto !important;
    height:auto !important;
    margin:0 0 .12in 0 !important;
    padding:.12in .16in .12in .18in !important;
    box-sizing:border-box !important;
    overflow:visible !important;
    border:0 !important;
    border-left:.06in solid #006231 !important;
    border-radius:0 !important;
    position:relative !important;
  }

  header.header .grid.container,
  header.header .col-1,
  header.header .header-content{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    text-align:left !important;
    margin:0 !important;
    padding:0 !important;
  }

  header.header h1,
  header.header h2,
  header.header .editable{
    text-align:left !important;
    margin-left:0 !important;
    margin-right:auto !important;
  }

  header.header .header-overlay,
  header.header nav.header-nav{
    display:none !important;
  }

  header.header h1{
    display:block !important;
    color:#172033 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:25pt !important;
    font-weight:800 !important;
    line-height:1.05 !important;
    letter-spacing:0 !important;
    text-align:left !important;
    margin:0 !important;
    padding:0 !important;
    border-bottom:0 !important;
    break-after:avoid !important;
    page-break-after:avoid !important;
  }

  header.header h1::after{
    content:"Department Budget Profile" !important;
    display:block !important;
    white-space:pre-line !important;
    margin:.055in 0 0 0 !important;
    color:#435064 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:10pt !important;
    font-weight:600 !important;
    line-height:1.45 !important;
    letter-spacing:.01em !important;
  }

  header.header h1 span{
    color:#172033 !important;
  }

  h2,
  .editable h2,
  .editable-content h2,
  .editable-paragraph-text h2{
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:11.5pt !important;
    line-height:1.25 !important;
    margin:.14in 0 .06in 0 !important;
    padding:0 0 .025in 0 !important;
    color:#172033 !important;
    font-weight:650 !important;
    letter-spacing:.025em !important;
    text-transform:none !important;
    break-after:avoid !important;
    page-break-after:avoid !important;
  }

  h2::after,
  .editable h2::after,
  .editable-content h2::after,
  .editable-paragraph-text h2::after{
    content:"" !important;
    display:block !important;
    width:.36in !important;
    height:2px !important;
    margin:.055in 0 0 0 !important;
    background:#006231 !important;
  }

  nav#nav-menu.nav-menu{
    display:none !important;
    visibility:hidden !important;
    height:0 !important;
    max-height:0 !important;
    width:0 !important;
    max-width:0 !important;
    overflow:hidden !important;
  }

  nav#nav-menu.nav-menu *,
  nav#nav-menu .wc-nav-search-slot,
  nav#nav-menu .wc-nav-search-slot *,
  .wc-nav-search-slot,
  .wc-nav-search-slot *,
  .wc-search-wrap,
  .wc-search-wrap *,
  .wc-search-box,
  .wc-search-box *,
  .wc-search-icon,
  .wc-nav-search-results,
  .wc-nav-search-results *,
  #wcTocSearch,
  input[type="search"]{
    display:none !important;
    visibility:hidden !important;
    width:0 !important;
    height:0 !important;
    max-width:0 !important;
    max-height:0 !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
    overflow:hidden !important;
    opacity:0 !important;
  }

  nav#nav-menu.nav-menu::after,
  footer::before,
  footer::after,
  .wc-budget-footer::before,
  .wc-budget-footer::after,
  .wc-budget-footer-bottom::before,
  .wc-budget-footer-bottom::after{
    content:none !important;
    display:none !important;
    visibility:hidden !important;
    height:0 !important;
    border:0 !important;
    background:none !important;
  }

  nav#nav-menu.nav-menu::before{
    content:none !important;
    display:none !important;
    visibility:hidden !important;
  }

  footer,
  footer *,
  footer[role="contentinfo"],
  footer[role="contentinfo"] *,
  .wc-budget-footer,
  .wc-budget-footer *,
  .wc-budget-footer-bottom,
  .wc-budget-footer-bottom *,
  .footer-container,
  .footer-container *,
  [class*="footerNote"],
  [class*="footerNote"] *{
    display:none !important;
    visibility:hidden !important;
    width:0 !important;
    height:0 !important;
    max-width:0 !important;
    max-height:0 !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
    overflow:hidden !important;
    opacity:0 !important;
  }

  .wc-print-brand-pill{
    display:flex !important;
    align-items:center !important;
    justify-content:center !important;
    gap:.035in !important;
    position:absolute !important;
    top:.08in !important;
    right:.16in !important;
    width:auto !important;
    max-width:1.18in !important;
    height:.20in !important;
    min-height:.20in !important;
    padding:.018in .045in .018in .065in !important;
    box-sizing:border-box !important;
    border-radius:999px !important;
    background:#006231 !important;
    color:#ffffff !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:5.9pt !important;
    font-weight:800 !important;
    line-height:1 !important;
    letter-spacing:.02em !important;
    text-transform:uppercase !important;
    white-space:nowrap !important;
    z-index:10 !important;
    break-inside:avoid !important;
    page-break-inside:avoid !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
  }

  .wc-print-brand-text{
    display:block !important;
    color:#ffffff !important;
    white-space:nowrap !important;
  }

  .wc-print-brand-seal{
    display:block !important;
    flex:0 0 .13in !important;
    width:.13in !important;
    height:.13in !important;
    border:1px solid #d1be78 !important;
    border-radius:999px !important;
    background:#ffffff url("${BRAND_LOGO_URL}") center center / .105in .105in no-repeat !important;
    box-sizing:border-box !important;
    overflow:hidden !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
  }

  nav#nav-menu.nav-menu .nav-menu-list,
  nav#nav-menu.nav-menu .nav-menu-item,
  nav#nav-menu.nav-menu .dropdown,
  nav#nav-menu.nav-menu .dropdown-list,
  nav#nav-menu.nav-menu .dropdown-item,
  nav#nav-menu.nav-menu .hamburger-menu,
  nav#nav-menu.nav-menu .wc-nav-search-slot,
  nav#nav-menu.nav-menu .wc-search-wrap,
  nav#nav-menu.nav-menu .wc-search-box,
  nav#nav-menu.nav-menu .wc-nav-search-results,
  nav#nav-menu.nav-menu #wcTocSearch{
    display:none !important;
    visibility:hidden !important;
    height:0 !important;
    width:0 !important;
    max-height:0 !important;
    overflow:hidden !important;
  }

  script,
  noscript,
  nav:not(#nav-menu),
  footer,
  footer[role="contentinfo"],
  .social-wrapper,
  .follow-container,
  #community-react-root,
  .highcharts-exporting-group,
  .highcharts-credits,
  .wc-budget-footer,
  .wc-budget-footer-inner,
  .wc-budget-footer-brand,
  .wc-budget-footer-links,
  .wc-budget-footer-bottom,
  .wc-standalone-budget-nav,
  .wc-standalone-brand,
  .wc-split-brand,
  .wc-split-brand-link,
  .wc-split-brand-seal,
  .wc-nav-search-slot,
  .wc-search-wrap,
  .wc-search-box,
  .wc-nav-search-results,
  #wcTocSearch,
  [class*="search"],
  [class*="Search"],
  iframe,
  video,
  .video,
  .video-container,
  .youtube,
  .youtube-embed,
  .youtube-player,
  [src*="youtube.com"],
  [src*="youtu.be"],
  a[href*="youtube.com"],
  a[href*="youtu.be"],
  a[href*="vimeo.com"],
  [data-media-type="video"],
  [data-media-type="youtube"],
  [class*="video"],
  [class*="Video"]{
    display:none !important;
    visibility:hidden !important;
    height:0 !important;
    max-height:0 !important;
    overflow:hidden !important;
  }

  main[role="main"]{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    box-sizing:border-box !important;
    overflow:visible !important;
    margin:0 !important;
    padding:0 .18in !important;
  }

  section.full-width,
  section.left-right,
  section.contains-media-block,
  .full-width-content,
  .editable-content,
  .media-block,
  .media-block.large,
  .media-block.has-media,
  [data-media-type="embed"],
  [data-media-type="tableTile"]{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    height:auto !important;
    max-height:none !important;
    overflow:visible !important;
    position:static !important;
    left:auto !important;
    right:auto !important;
    margin:0 0 14px 0 !important;
    padding:0 !important;
    transform:none !important;
  }

  .wc-statement-panel{
    box-sizing:border-box !important;
    margin:0 0 14px 0 !important;
    padding:0 !important;
    background:transparent !important;
    border:0 !important;
    border-radius:0 !important;
    break-inside:auto !important;
    page-break-inside:auto !important;
  }

  .wc-statement-panel h2,
  .wc-statement-panel .editable h2,
  .wc-statement-panel .editable-paragraph-text h2{
    font-size:10.5pt !important;
    line-height:1.25 !important;
    margin:0 0 .07in 0 !important;
    padding:0 !important;
    color:#000000 !important;
    font-weight:600 !important;
    letter-spacing:.035em !important;
    text-transform:none !important;
  }

  .wc-statement-panel h2::after,
  .wc-statement-panel .editable h2::after,
  .wc-statement-panel .editable-paragraph-text h2::after{
    content:"" !important;
    display:block !important;
    width:.42in !important;
    height:2px !important;
    margin:.055in 0 0 0 !important;
    background:#d1be78 !important;
  }

  .wc-statement-panel p,
  .wc-statement-panel .editable-paragraph-text p{
    font-size:9.5pt !important;
    line-height:1.45 !important;
    color:#000000 !important;
    margin:.04in 0 .08in 0 !important;
  }

  .grid,
  .grid.container,
  .grid.container.flip{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    box-sizing:border-box !important;
    margin:0 !important;
    padding:0 !important;
  }

  .col-1,
  .col-2,
  .left-right .col-2,
  .left-right-content{
    display:block !important;
    float:none !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    margin:0 0 14px 0 !important;
    padding:0 !important;
    position:static !important;
  }

  h1,
  h2,
  h3,
  .editable,
  .editable-paragraph-text{
    max-width:100% !important;
    width:auto !important;
    overflow:visible !important;
    text-align:left !important;
    word-break:normal !important;
    overflow-wrap:normal !important;
    white-space:normal !important;
  }

  p,
  .align-justify,
  .editable-paragraph-text,
  .editable-paragraph-text p,
  .editable-content p{
    max-width:100% !important;
    width:auto !important;
    overflow:visible !important;
    text-align:left !important;
    text-justify:auto !important;
    word-break:normal !important;
    overflow-wrap:normal !important;
    white-space:normal !important;
  }

  p,
  .editable-paragraph-text p{
    font-size:10pt !important;
    line-height:1.4 !important;
    margin:.04in 0 .1in 0 !important;
  }

  .wc-statement-panel,
  .wc-statement-panel .editable,
  .wc-statement-panel .editable-content,
  .wc-statement-panel .editable-paragraph-text,
  .wc-statement-panel p,
  .wc-statement-panel span,
  .wc-statement-panel div:not(.media-block){
    color:#000000 !important;
  }

  .wc-statement-panel h2,
  .wc-statement-panel h2 *,
  .wc-statement-panel h2 span,
  .wc-statement-panel .editable h2,
  .wc-statement-panel .editable h2 *,
  .wc-statement-panel .editable-paragraph-text h2,
  .wc-statement-panel .editable-paragraph-text h2 *{
    color:#000000 !important;
  }

  h2:has(+ p),
  h2:has(+ .editable-paragraph-text),
  .wc-statement-panel h2,
  .wc-statement-panel h2 *{
    color:#000000 !important;
  }

  a[href]::after{
    content:"" !important;
  }

  a[href*="youtube.com"],
  a[href*="youtu.be"],
  a[href*="vimeo.com"]{
    display:none !important;
    visibility:hidden !important;
  }

  script,
  noscript,
  script[type="text/javascript"],
  script[data-embed-id],
  script[data-selector]{
    display:none !important;
    visibility:hidden !important;
    height:0 !important;
    max-height:0 !important;
    overflow:hidden !important;
    font-size:0 !important;
    line-height:0 !important;
    color:transparent !important;
  }

  .wc-plaque-card{
    width:100% !important;
    max-width:4.6in !important;
    margin:0 auto 14px auto !important;
    break-inside:avoid !important;
    page-break-inside:avoid !important;
    transform:none !important;
    box-shadow:none !important;
  }

  .wc-plaque-inner h2{
    font-size:17pt !important;
  }

  .wc-performance-page,
  .wc-performance-page.is-embedded,
  #wc-performance-measures{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    overflow:visible !important;
    margin:0 0 14px 0 !important;
    padding:0 !important;
  }

  .wc-performance-card{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    overflow:hidden !important;
    margin:0 0 14px 0 !important;
    padding:0 !important;
    border:0 !important;
    border-radius:8px !important;
    background:#ffffff !important;
  }

  /* The on-page heading is an absolutely-positioned ::before that relies on
     the card's normal padding-top for clearance; that padding is removed
     above for print, so without this override the heading text overlaps
     the table instead of sitting above it. */
  .wc-performance-card::before{
    position:static !important;
    display:block !important;
    top:auto !important;
    left:auto !important;
    transform:none !important;
    margin:0 0 10px 0 !important;
    padding:0 !important;
    white-space:normal !important;
    text-align:center !important;
  }

  .wc-fy-column-toggle-wrap{
    display:none !important;
  }

  .wc-performance-table-wrap{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    overflow:hidden !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
    border-radius:8px !important;
    background:#ffffff !important;
  }

  .wc-performance-table,
  .wc-performance-table table,
  table.wc-performance-table{
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    table-layout:fixed !important;
    border-collapse:collapse !important;
  }

  table.wc-performance-table,
  .wc-performance-table{
    border-radius:8px !important;
    overflow:hidden !important;
  }

  .wc-performance-table th,
  .wc-performance-table td{
    white-space:normal !important;
    word-break:normal !important;
    overflow-wrap:break-word !important;
    hyphens:auto !important;
    font-size:7.5pt !important;
    line-height:1.2 !important;
    padding:4px 5px !important;
    vertical-align:middle !important;
  }

  .wc-performance-table th:nth-child(1),
  .wc-performance-table td:nth-child(1){width:6% !important;}
  .wc-performance-table th:nth-child(2),
  .wc-performance-table td:nth-child(2){width:19% !important;}
  .wc-performance-table th:nth-child(3),
  .wc-performance-table td:nth-child(3){width:22% !important;}
  .wc-performance-table th:nth-child(4),
  .wc-performance-table td:nth-child(4){width:23% !important;}
  .wc-performance-table th:nth-child(n+5),
  .wc-performance-table td:nth-child(n+5){width:7.5% !important;}

  .wc-performance-table td:nth-child(n+5){
    text-align:right !important;
  }

  [data-embed-id],
  [data-table-scroll-container="true"]{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    overflow:visible !important;
    position:static !important;
    margin:0 0 14px 0 !important;
    padding:0 !important;
  }

  [data-report-table-container-id]{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    overflow:hidden !important;
    position:static !important;
    margin:0 0 14px 0 !important;
    padding:0 !important;
    border:1px solid rgba(209,190,120,.55) !important;
    border-radius:8px !important;
    background:#ffffff !important;
  }

  [data-report-table-id],
  [data-table-scroll-container="true"] table{
    width:100% !important;
    min-width:0 !important;
    max-width:100% !important;
    table-layout:fixed !important;
    border-collapse:collapse !important;
  }

  [data-report-table-id]{
    border-radius:8px !important;
    overflow:hidden !important;
  }

  [data-report-table-id] th,
  [data-report-table-id] td{
    white-space:normal !important;
    word-break:normal !important;
    overflow-wrap:break-word !important;
    hyphens:auto !important;
    font-size:8pt !important;
    line-height:1.25 !important;
    padding:5px 6px !important;
    vertical-align:top !important;
  }

  [data-report-table-id] th:first-child,
  [data-report-table-id] td:first-child{
    width:34% !important;
  }

  [data-report-table-id] th:nth-child(n+2),
  [data-report-table-id] td:nth-child(n+2){
    text-align:right !important;
  }

  .footerNote__VxEBJ,
  [class*="footerNote"]{
    display:none !important;
  }

  .media-block,
  .wc-performance-card,
  [data-report-table-container-id],
  .wc-plaque-card{
    break-inside:avoid !important;
    page-break-inside:avoid !important;
  }

  html::before,
  html::after{
    content:none !important;
    display:none !important;
    height:0 !important;
    border:0 !important;
    background:none !important;
  }
}
`;

  function injectStyles() {
    if (document.getElementById("wc-budget-pdf-styles")) return;

    var style = document.createElement("style");
    style.id = "wc-budget-pdf-styles";
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
  }

  function ensurePrintBrandPill() {
    var header = document.querySelector("header.header");
    var pill = document.querySelector(".wc-print-brand-pill");
    if (!pill) {
      pill = document.createElement("div");
      pill.className = "wc-print-brand-pill";
      pill.setAttribute("aria-hidden", "true");
      pill.innerHTML = '<span class="wc-print-brand-text">Walton County</span><span class="wc-print-brand-seal"></span>';
    }

    if (header && pill.parentNode !== header) {
      header.appendChild(pill);
    } else if (!header && !pill.parentNode) {
      document.body.insertBefore(pill, document.body.firstChild);
    }
  }

  function ensureStatementPanel() {
    document.querySelectorAll("h2").forEach(function (heading) {
      if (heading.textContent.trim().toLowerCase() !== "statement of function") return;

      var section = heading.closest("section");
      if (section) section.classList.add("wc-statement-panel");
    });
  }


  function init() {
    injectStyles();
    ensurePrintBrandPill();
    ensureStatementPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", init);
  window.addEventListener("beforeprint", function () {
    ensurePrintBrandPill();
    ensureStatementPanel();
  });
})();
