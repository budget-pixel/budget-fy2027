(function () {
  "use strict";

  function assetPath(path) {
    return (window.location.pathname.indexOf("/pages/") !== -1 ? "../" : "") + path;
  }

  var BRAND_LOGO_URL = assetPath("assets/images/Page Images/walton-county-logo-no-background.png");

  var EXCLUDED_PRINT_PAGES = {
    "": true,
    "index.html": true,
    "our-county.html": true,
    "budget-overview.html": true,
    "departments.html": true,
    "capital-projects.html": true,
    "financials.html": true,
    "constitutional-officers.html": true,
    "autonomous-entities.html": true,
    "search.html": true
  };

  function currentPageName() {
    var path = window.location.pathname.split("/").pop() || "";
    return path.toLowerCase();
  }

  function isPrintablePage() {
    var pageName = currentPageName();
    if (EXCLUDED_PRINT_PAGES[pageName]) return false;
    return Boolean(document.querySelector("main#content, main#main-content, main"));
  }

var PRINT_CSS = `
.wc-print-brand-pill{
  display:none;
}
.wc-print-document-header{
  display:none;
}
.wc-print-budget-table-wrap{
  display:none;
}
@media print{
  @page{
    size:letter landscape;
    margin:.35in;
  }

  .wc-pdf-button,
  .wc-print-button-slot,
  button,
  .wc-view-budget-lines-toggle,
  .wc-budget-detail-close,
  .wc-forecast-sort-toggle,
  .wc-forecast-sort-button,
  .wc-fy-column-toggle-wrap,
  .wc-revenue-chart-legend button{
    display:none !important;
    visibility:hidden !important;
  }

  details{
    display:block !important;
  }

  details > summary{
    display:none !important;
  }

  :root{
    --green:#006231 !important;
    --green2:#0b7741 !important;
    --gold:#d1be78 !important;
    --navy:#172033 !important;
    --light:#ffffff !important;
    --border:#d9e2dc !important;
    --text:#172033 !important;
    --muted:#435064 !important;
    color-scheme:light !important;
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

  #layout,
  main#content,
  main#main-content,
  main{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    margin:0 !important;
    padding:0 !important;
    background:#ffffff !important;
    overflow:visible !important;
    box-shadow:none !important;
  }

  main#content::before,
  main#main-content::before,
  main:not(#content):not(#main-content)::before{
    content:"Walton County FY 2027 Budget" !important;
    display:block !important;
    margin:0 0 .09in 0 !important;
    padding:0 0 .07in 0 !important;
    border-bottom:2px solid #006231 !important;
    color:#435064 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:8.5pt !important;
    font-weight:800 !important;
    letter-spacing:.08em !important;
    line-height:1.2 !important;
    text-transform:uppercase !important;
  }

  body.wc-has-print-document-header main#content::before,
  body.wc-has-print-document-header main#main-content::before,
  body.wc-has-print-document-header main:not(#content):not(#main-content)::before{
    content:none !important;
    display:none !important;
  }

  .wc-print-document-header{
    display:flex !important;
    align-items:center !important;
    justify-content:flex-start !important;
    gap:.18in !important;
    width:100% !important;
    margin:0 0 .18in 0 !important;
    padding:0 0 .07in 0 !important;
    border-bottom:2px solid #006231 !important;
    background:transparent !important;
    color:#435064 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    break-after:avoid !important;
    page-break-after:avoid !important;
  }

  .wc-print-document-title{
    display:none !important;
    min-width:0 !important;
    color:#435064 !important;
    font-size:8.5pt !important;
    font-weight:800 !important;
    letter-spacing:.08em !important;
    line-height:1.2 !important;
    text-transform:uppercase !important;
  }

  .wc-print-document-brand{
    display:inline-flex !important;
    align-items:center !important;
    justify-content:flex-start !important;
    gap:.055in !important;
    flex:0 0 auto !important;
    background:transparent !important;
    color:#435064 !important;
    font-size:8.5pt !important;
    font-weight:800 !important;
    letter-spacing:.02em !important;
    line-height:1 !important;
    text-transform:uppercase !important;
    white-space:nowrap !important;
  }

  .wc-print-document-seal{
    display:block !important;
    width:.2in !important;
    height:.2in !important;
    flex:0 0 .2in !important;
    border:1px solid #d1be78 !important;
    border-radius:999px !important;
    background:transparent url("${BRAND_LOGO_URL}") center center / .16in .16in no-repeat !important;
    box-sizing:border-box !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
  }

  .page-eyebrow{
    display:block !important;
    margin:0 0 .05in 0 !important;
    color:#006231 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:8pt !important;
    font-weight:800 !important;
    letter-spacing:.08em !important;
    line-height:1.25 !important;
    text-transform:uppercase !important;
  }

  .page-title,
  h1.page-title{
    display:block !important;
    margin:0 0 .16in 0 !important;
    padding:0 !important;
    color:#172033 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:23pt !important;
    font-weight:800 !important;
    letter-spacing:0 !important;
    line-height:1.08 !important;
    break-after:avoid !important;
    page-break-after:avoid !important;
  }

  .page-intro{
    max-width:100% !important;
    margin:0 0 .22in 0 !important;
    color:#435064 !important;
    font-size:10.5pt !important;
    line-height:1.45 !important;
    text-align:left !important;
  }

  .page-text,
  .content-section,
  article,
  section{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    margin:0 0 .18in 0 !important;
    padding:0 !important;
    background:transparent !important;
    border:0 !important;
    box-shadow:none !important;
    overflow:visible !important;
  }

  .page-text ul,
  .page-text ol,
  main ul,
  main ol{
    margin:.04in 0 .14in .22in !important;
    padding:0 !important;
  }

  .page-text li,
  main li{
    margin:0 0 .035in 0 !important;
    padding:0 !important;
    font-size:9.5pt !important;
    line-height:1.35 !important;
    color:#172033 !important;
  }

  .wc-metrics-strip,
  .wc-dept-fund-summary,
  .wc-forecast-fund-grid,
  .wc-revenue-topic-row{
    display:block !important;
    width:100% !important;
    margin:0 0 .12in 0 !important;
    padding:0 !important;
  }

  .wc-metric-card,
  .wc-dept-fund-card,
  .wc-forecast-fund-card,
  .wc-revenue-topic-chart-card,
  .wc-revenue-topic-narrative-card,
  .wc-directory-list li{
    display:block !important;
    width:100% !important;
    margin:0 0 .1in 0 !important;
    padding:.1in .12in !important;
    background:#ffffff !important;
    border:1px solid #d9e2dc !important;
    border-radius:0 !important;
    box-shadow:none !important;
    break-inside:avoid !important;
    page-break-inside:avoid !important;
  }

  .wc-directory-item{
    display:block !important;
    padding:0 !important;
  }

  .wc-directory-item-meta{
    display:block !important;
    margin:.06in 0 0 0 !important;
  }

  .wc-directory-item-stat{
    display:inline-block !important;
    width:auto !important;
    min-width:0 !important;
    margin:0 .16in .04in 0 !important;
    text-align:left !important;
    vertical-align:top !important;
  }

  .wc-directory-item-arrow{
    display:none !important;
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

  h3,
  h4,
  .wc-fund-section-heading,
  .wc-revenue-topic-title{
    color:#172033 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-weight:700 !important;
    line-height:1.25 !important;
    margin:.14in 0 .06in 0 !important;
    break-after:avoid !important;
    page-break-after:avoid !important;
  }

  h3,
  .wc-fund-section-heading,
  .wc-revenue-topic-title{
    font-size:10.5pt !important;
  }

  h4{
    font-size:9.5pt !important;
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
    display:none !important;
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

  img,
  svg,
  canvas{
    max-width:100% !important;
    height:auto !important;
    page-break-inside:avoid !important;
    break-inside:avoid !important;
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

  .wc-performance-card::before{
    position:static !important;
    display:block !important;
    top:auto !important;
    left:auto !important;
    transform:none !important;
    margin:0 0 .085in 0 !important;
    padding:0 0 .08in 0 !important;
    white-space:normal !important;
    text-align:left !important;
    color:#000000 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:10.5pt !important;
    font-weight:600 !important;
    line-height:1.25 !important;
    letter-spacing:.035em !important;
    text-transform:none !important;
    border-left:0 !important;
    border-radius:0 !important;
    background:linear-gradient(#d1be78, #d1be78) left bottom / .42in 2px no-repeat !important;
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

  .wc-performance-table th,
  .wc-print-budget-table-wrap .wc-data-table th{
    white-space:pre-line !important;
    word-break:keep-all !important;
    overflow-wrap:normal !important;
    hyphens:none !important;
    line-height:1.15 !important;
  }

  .wc-performance-table th:nth-child(1),
  .wc-performance-table td:nth-child(1){width:5% !important;}
  .wc-performance-table th:nth-child(2),
  .wc-performance-table td:nth-child(2){width:20% !important;}
  .wc-performance-table th:nth-child(3),
  .wc-performance-table td:nth-child(3){width:25% !important;}
  .wc-performance-table th:nth-child(4),
  .wc-performance-table td:nth-child(4){width:26% !important;}
  .wc-performance-card .wc-performance-table .wc-fy-2022.wc-prior-year,
  .wc-performance-card .wc-performance-table .wc-fy-2023.wc-prior-year{
    width:0 !important;
  }
  .wc-performance-table th:nth-child(n+5),
  .wc-performance-table td:nth-child(n+5){width:6% !important;}

  .wc-performance-table td:nth-child(n+5){
    text-align:right !important;
  }

  .wc-finance-card{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    margin:0 0 .18in 0 !important;
    padding:0 !important;
    background:transparent !important;
    border:0 !important;
    border-radius:0 !important;
    box-shadow:none !important;
    overflow:visible !important;
  }

  .wc-finance-card::before{
    content:attr(data-print-title) !important;
    display:block !important;
    margin:0 0 .085in 0 !important;
    padding:0 0 .08in 0 !important;
    color:#000000 !important;
    font-family:"Avenir Next", "Helvetica Neue", Arial, Helvetica, sans-serif !important;
    font-size:10.5pt !important;
    font-weight:600 !important;
    line-height:1.25 !important;
    letter-spacing:.035em !important;
    text-align:left !important;
    background:linear-gradient(#d1be78, #d1be78) left bottom / .42in 2px no-repeat !important;
    break-after:avoid !important;
    page-break-after:avoid !important;
  }

  .wc-finance-card-head,
  .wc-finance-card-breakdown,
  .wc-finance-card-footer{
    display:none !important;
    visibility:hidden !important;
  }

  .wc-budget-lines-detail,
  .wc-budget-lines-detail[hidden],
  .wc-budget-lines-card,
  .wc-budget-lines-card[hidden]{
    display:block !important;
    visibility:visible !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    height:auto !important;
    max-height:none !important;
    margin:0 0 .16in 0 !important;
    padding:0 !important;
    border:0 !important;
    border-radius:0 !important;
    background:#ffffff !important;
    overflow:visible !important;
    opacity:1 !important;
  }

  .wc-budget-lines-tools,
  .wc-budget-lines-detail-header{
    display:none !important;
    visibility:hidden !important;
  }

  .wc-data-table-scroll{
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    overflow:visible !important;
  }

  .wc-has-print-budget-table > .wc-data-table-wrap{
    display:none !important;
    visibility:hidden !important;
  }

  .wc-print-budget-table-wrap,
  .wc-print-budget-table-wrap .wc-data-table-wrap,
  .wc-print-budget-table-wrap .wc-data-table-scroll{
    display:block !important;
    visibility:visible !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    margin:0 !important;
    padding:0 !important;
    border:0 !important;
    border-radius:0 !important;
    overflow:visible !important;
  }

  .wc-print-budget-table-wrap .wc-data-table{
    width:100% !important;
    min-width:100% !important;
    max-width:100% !important;
    table-layout:fixed !important;
    border-collapse:collapse !important;
  }

  .wc-print-budget-table-wrap .wc-data-table th:first-child,
  .wc-print-budget-table-wrap .wc-data-table td:first-child{
    width:28% !important;
    text-align:left !important;
  }

  .wc-print-budget-table-wrap .wc-data-table th:nth-child(n+2),
  .wc-print-budget-table-wrap .wc-data-table td:nth-child(n+2){
    width:12% !important;
    text-align:right !important;
  }

  .wc-prior-year,
  .wc-budget-lines-card:not(.show-prior-years) .wc-prior-year,
  .wc-staffing-card:not(.show-prior-years) .wc-staffing-table .wc-prior-year,
  .wc-performance-card:not(.show-prior-years) .wc-performance-table .wc-col-prior-year,
  .wc-performance-card:not(.show-prior-years) .wc-performance-table .wc-prior-year{
    display:table-cell !important;
    visibility:visible !important;
  }

  .wc-performance-card .wc-performance-table .wc-fy-2022.wc-prior-year,
  .wc-performance-card .wc-performance-table .wc-fy-2023.wc-prior-year{
    display:none !important;
    visibility:hidden !important;
  }

  .wc-budget-line-detail-row{
    display:none !important;
  }

  .wc-budget-line-summary-row,
  .wc-budget-line-summary-row.wc-budget-line-zero-current,
  .wc-staffing-table tr{
    display:table-row !important;
    visibility:visible !important;
  }

  .wc-fy-2020,
  .wc-fy-2021,
  .wc-budget-lines-card .wc-fy-2020,
  .wc-budget-lines-card .wc-fy-2021,
  .wc-budget-lines-card:not(.show-prior-years) .wc-fy-2020,
  .wc-budget-lines-card:not(.show-prior-years) .wc-fy-2021,
  .wc-staffing-card:not(.show-prior-years) .wc-staffing-table .wc-fy-2020,
  .wc-staffing-card:not(.show-prior-years) .wc-staffing-table .wc-fy-2021{
    display:none !important;
    visibility:hidden !important;
  }

  .wc-table-unclassified-row{
    display:none !important;
    visibility:hidden !important;
  }

  .wc-print-kind-expense .wc-budget-lines-detail > .wc-data-table-wrap table th:nth-child(1),
  .wc-print-kind-expense .wc-budget-lines-detail > .wc-data-table-wrap table td:nth-child(1),
  .wc-print-kind-expense .wc-budget-lines-detail > .wc-data-table-wrap table th:nth-child(2),
  .wc-print-kind-expense .wc-budget-lines-detail > .wc-data-table-wrap table td:nth-child(2),
  .wc-print-kind-revenue .wc-budget-lines-detail > .wc-data-table-wrap table th:nth-child(1),
  .wc-print-kind-revenue .wc-budget-lines-detail > .wc-data-table-wrap table td:nth-child(1){
    display:none !important;
    visibility:hidden !important;
  }

  .wc-print-kind-revenue .wc-budget-lines-detail > .wc-data-table-wrap .wc-table-subtotal-row{
    display:none !important;
    visibility:hidden !important;
  }

  .wc-print-kind-expense .wc-budget-lines-detail > .wc-data-table-wrap .wc-table-subtotal-row td:nth-child(1),
  .wc-print-kind-expense .wc-budget-lines-detail > .wc-data-table-wrap .wc-table-total-row td:nth-child(1),
  .wc-print-kind-revenue .wc-budget-lines-detail > .wc-data-table-wrap .wc-table-total-row td:nth-child(1){
    display:table-cell !important;
    visibility:visible !important;
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
  [data-table-scroll-container="true"] table,
  table{
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
  [data-report-table-id] td,
  table th,
  table td{
    white-space:normal !important;
    word-break:normal !important;
    overflow-wrap:break-word !important;
    hyphens:auto !important;
    font-size:8pt !important;
    line-height:1.25 !important;
    padding:5px 6px !important;
    vertical-align:top !important;
  }

  thead{
    display:table-header-group !important;
  }

  tfoot{
    display:table-footer-group !important;
  }

  tr,
  td,
  th{
    break-inside:avoid !important;
    page-break-inside:avoid !important;
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

  function ensurePrintDocumentHeader() {
    var main = document.querySelector("main#content") || document.querySelector("main#main-content") || document.querySelector("main");
    if (!main) return;

    var printHeader = main.querySelector(".wc-print-document-header");
    if (!printHeader) {
      printHeader = document.createElement("div");
      printHeader.className = "wc-print-document-header";
      printHeader.setAttribute("aria-hidden", "true");
      printHeader.innerHTML =
        '<span class="wc-print-document-title"></span>' +
        '<span class="wc-print-document-brand"><span class="wc-print-document-seal"></span><span>Walton County</span></span>';
      main.insertBefore(printHeader, main.firstChild);
    }

    if (document.body) document.body.classList.add("wc-has-print-document-header");
  }

  function ensureStatementPanel() {
    document.querySelectorAll("h2").forEach(function (heading) {
      if (heading.textContent.trim().toLowerCase() !== "statement of function") return;

      var section = heading.closest("section");
      if (section) section.classList.add("wc-statement-panel");
    });
  }

  function ensurePrintFinanceTitles() {
    document.querySelectorAll(".wc-finance-card").forEach(function (card) {
      if (card.getAttribute("data-print-title")) return;
      var kicker = card.querySelector(".wc-finance-card-kicker");
      var title = kicker ? kicker.textContent.trim() : "";
      if (title) card.setAttribute("data-print-title", title);
    });
  }

  function openPrintDetails() {
    document.querySelectorAll("details").forEach(function (detail) {
      if (!detail.open) {
        detail.setAttribute("data-wc-print-opened", "true");
        detail.open = true;
      }
    });
  }

  function restorePrintDetails() {
    document.querySelectorAll('details[data-wc-print-opened="true"]').forEach(function (detail) {
      detail.open = false;
      detail.removeAttribute("data-wc-print-opened");
    });
  }

  function syncPrintPreparation() {
    if (window.matchMedia && window.matchMedia("print").matches) {
      openPrintDetails();
    }
  }

  function init() {
    if (!isPrintablePage()) return;
    document.documentElement.classList.add("wc-pdf-printable");
    if (document.body) document.body.classList.add("wc-pdf-printable");
    injectStyles();
    ensurePrintDocumentHeader();
    ensurePrintBrandPill();
    ensureStatementPanel();
    ensurePrintFinanceTitles();
    syncPrintPreparation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", init);
  window.addEventListener("beforeprint", function () {
    ensurePrintDocumentHeader();
    ensurePrintBrandPill();
    ensureStatementPanel();
    ensurePrintFinanceTitles();
    openPrintDetails();
  });
  window.addEventListener("afterprint", function () {
    restorePrintDetails();
  });
  if (window.matchMedia) {
    var printQuery = window.matchMedia("print");
    if (typeof printQuery.addEventListener === "function") {
      printQuery.addEventListener("change", function (event) {
        if (event.matches) {
          openPrintDetails();
        } else {
          restorePrintDetails();
        }
      });
    } else if (typeof printQuery.addListener === "function") {
      printQuery.addListener(function (event) {
        if (event.matches) {
          openPrintDetails();
        } else {
          restorePrintDetails();
        }
      });
    }
  }
})();
