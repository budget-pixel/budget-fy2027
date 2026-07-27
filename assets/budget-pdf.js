(function () {
  "use strict";

  function assetPath(path) {
    return (window.location.pathname.indexOf("/pages/") !== -1 ? "../" : "") + path;
  }

  var BRAND_LOGO_URL = assetPath("assets/images/page-images/walton-county-logo-no-background.png");

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
.wc-code-compliance-staffing-print{
  display:none;
}
@media print{
  @page{
    size:letter landscape;
    /* A touch more on the right than the other sides -- content (e.g. a
       department's Statement of Function paragraph) was sitting flush
       enough against the printable-area edge to just barely get clipped. */
    margin:.35in .5in .35in .35in;
  }

  .wc-pdf-button,
  .wc-print-button-slot,
  button,
  .wc-view-budget-lines-toggle,
  .wc-budget-detail-close,
  .wc-forecast-sort-toggle,
  .wc-forecast-sort-button,
  .wc-fy-column-toggle-wrap,
  .wc-revenue-chart-legend button,
  .wc-skip-link{
    display:none !important;
    visibility:hidden !important;
  }

  /* Summary of Personnel and Summary of Personnel Cost use a department
     name rendered as a "View Budget Lines" toggle button (see
     .wc-table-row-link in style.css, which already strips its button
     chrome so it reads as plain text on screen) rather than a plain <td>
     -- the blanket button-hiding rule above was blanking out the entire
     Department column in print. Higher specificity than the plain
     .wc-view-budget-lines-toggle rule above (an attribute selector counts
     as a second class), so this wins without needing to touch that rule. */
  .wc-table-row-link[data-closed-label]{
    display:inline !important;
    visibility:visible !important;
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
  .eagle-springs-grill-statement-media,
  .code-compliance-statement-media,
  .lifeguard-expense-map-row{
    display:block !important;
    grid-template-columns:none !important;
  }

  /* Code Compliance's Street/Beach staffing split reads as two redundant
     cards in print (see renderStaffingTable's isCodeComplianceStaffingSplit
     in budget-data.js) -- the screen version stays hidden and a single
     merged card takes its place instead. */
  .wc-code-compliance-staffing-screen{
    display:none !important;
  }
  .wc-code-compliance-staffing-print{
    display:block !important;
  }
  /* style.css's #department-staffing-table:has(.wc-finance-card +
     .wc-finance-card) rule puts the two Street/Beach cards side by side
     in a 2-column grid on screen -- but :has() matches on DOM structure,
     not visibility, so it still fires in print even though those two
     cards are hidden (display:none isn't "removed"). Without this, the
     one visible merged card above gets squeezed into a single grid
     column instead of using the full page width. */
  #department-staffing-table:has(.wc-code-compliance-staffing-print){
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

  /* Belt-and-suspenders on top of @page's own right margin above -- justified
     paragraph text (see .content-section p etc. below) runs flush to the
     container's right edge by design, so it still needs its own buffer
     against the printable area's edge rather than relying on @page's
     margin alone to never round short by a pixel or two. */
  main#content,
  main#main-content{
    padding-right:.15in !important;
    box-sizing:border-box !important;
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
  .wc-forecast-fund-grid{
    display:block !important;
    width:100% !important;
    margin:0 0 .12in 0 !important;
    padding:0 !important;
  }

  .wc-metric-card,
  .wc-dept-fund-card,
  .wc-forecast-fund-card,
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
  .wc-statement-panel .editable-paragraph-text h2,
  .wc-fund-section-heading,
  .wc-forecast-fund h3{
    font-size:10.5pt !important;
    line-height:1.25 !important;
    margin:0 0 .07in 0 !important;
    padding:0 !important;
    color:#000000 !important;
    font-weight:600 !important;
    letter-spacing:.035em !important;
    text-transform:none !important;
    border:0 !important;
  }

  .wc-statement-panel h2::after,
  .wc-statement-panel .editable h2::after,
  .wc-statement-panel .editable-paragraph-text h2::after,
  .wc-fund-section-heading::after,
  .wc-forecast-fund h3::after{
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

  /* Financial Forecast: the Revenue/Expenditure Assumptions section
     (growth-rate methodology tables, normally collapsed <details>) is
     planning-methodology detail, not something anyone printing the
     forecast needs -- and would otherwise force-open and print in full
     via the openPrintDetails() logic below. :has() targets the whole
     wc-forecast-section (heading included) rather than just the two
     <details> blocks, since that section holds nothing else. */
  .wc-forecast-section:has(.wc-forecast-assumptions-detail){
    display:none !important;
  }

  /* Same page: also drop each fund's own "Category Forecast Detail"
     breakdown (revenue/expense line items behind that fund's main
     forecast table) -- like Assumptions above, it's a collapsed <details>
     that would otherwise force-open and print in full. This rule also
     covers the two Assumptions <details> from the block above (same
     wc-forecast-detail base class), which is fine since that whole
     section is already hidden either way. */
  .wc-forecast-detail{
    display:none !important;
  }

  a[href]::after{
    content:"" !important;
  }

  /* Summary of Revenues/Expenses "View Budget Lines" detail: the actual-
     amount transaction drilldown links and department row links are only
     useful in the live, clickable site -- in print they should just read
     as plain text, not styled or clickable like a web link. */
  .wc-actual-drilldown-link,
  .wc-department-row-link{
    color:inherit !important;
    text-decoration:none !important;
    pointer-events:none !important;
    cursor:default !important;
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

  /* Performance measures/objectives are department-internal tracking, not
     something anyone printing a budget document needs -- hide the whole
     section (and its narrative banner/table) rather than formatting it
     for print like the rest of the page. */
  .wc-performance-card,
  .wc-performance-page,
  .wc-performance-page.is-embedded,
  #wc-performance-measures{
    display:none !important;
  }

  .wc-fy-column-toggle-wrap{
    display:none !important;
  }

  /* Summary of Revenues / Summary of Expenses: drop the FY2020 and FY2021
     columns (2nd/3rd column, after the row-label column) from the
     Consolidated Revenue/Expense Summary table when printing -- those two
     years are far enough back that they just add clutter to the printout.
     Scoped to .wc-table-wrap specifically (the summary table's own
     wrapper) rather than a bare descendant "table" -- the same container
     div also holds the separate "View Budget Lines" print detail table
     (.wc-print-budget-table-wrap), which already starts at FY2022 on its
     own (see printYearColumns), so matching every table here would strip
     ITS 2nd/3rd columns instead -- FY2022 and FY2023, not FY2020/2021. */
  #consolidated-revenue-summary-table .wc-table-wrap table th:nth-child(2),
  #consolidated-revenue-summary-table .wc-table-wrap table td:nth-child(2),
  #consolidated-revenue-summary-table .wc-table-wrap table th:nth-child(3),
  #consolidated-revenue-summary-table .wc-table-wrap table td:nth-child(3),
  #consolidated-expense-summary-table .wc-table-wrap table th:nth-child(2),
  #consolidated-expense-summary-table .wc-table-wrap table td:nth-child(2),
  #consolidated-expense-summary-table .wc-table-wrap table th:nth-child(3),
  #consolidated-expense-summary-table .wc-table-wrap table td:nth-child(3){
    display:none !important;
  }

  /* Summary of Expenses' own "View Budget Lines" detail (department-level,
     via renderExpenseDepartmentBudgetLinesFooter) has no separate
     print-only table the way Summary of Revenues does -- it's the same
     table on-screen and in print, with two label columns (Category,
     Department) before the year columns start, so FY2020/2021 land on
     the 3rd/4th column here instead of the 2nd/3rd. The Category
     (Activity) column itself is also dropped from print -- the
     department name alone is enough there. */
  #consolidated-expense-summary-table .wc-budget-lines-detail table th:nth-child(1),
  #consolidated-expense-summary-table .wc-budget-lines-detail table td:nth-child(1),
  #consolidated-expense-summary-table .wc-budget-lines-detail table th:nth-child(3),
  #consolidated-expense-summary-table .wc-budget-lines-detail table td:nth-child(3),
  #consolidated-expense-summary-table .wc-budget-lines-detail table th:nth-child(4),
  #consolidated-expense-summary-table .wc-budget-lines-detail table td:nth-child(4){
    display:none !important;
  }

  /* Summary of Revenues / Summary of Expenses: nothing after the summary
     table should print at all -- every revenue topic/expense activity
     section below it (heading, narrative, and chart alike) is a sibling
     of the table's own container div within main#content, so this one
     rule drops all of them in one shot. */
  #consolidated-revenue-summary-table ~ *,
  #consolidated-expense-summary-table ~ *{
    display:none !important;
  }

  /* "Last Updated" stamp (see lastUpdatedNoteHtml/.wc-data-updated-note in
     budget-data.js) shows up under nearly every table/chart/card sitewide
     -- it's noise on a printed page no matter which page it's on, so
     hidden globally rather than scoped to just these two pages. */
  .wc-data-updated-note{
    display:none !important;
  }

  /* Summary of Personnel: the Department/Fund filters and sort toggle,
     plus the "Click on a department name..." hint, are only meaningful
     for the live, interactive page -- dropped from print entirely. The
     department-rollup table itself (one row per department, each a
     "View Positions" toggle into that department's own hidden position
     list) is also dropped, since every department's position-detail
     panel already force-shows in print anyway (see the .wc-budget-lines-
     detail[hidden] rule above) -- keeping both would print the same FTE
     counts twice, once rolled up and once again in full. What's left is
     just the fund callout cards up top followed by one position list per
     department, each labeled by its own print-title heading (see
     personnelDeptDetailHtml in budget-data.js). */
  #personnel-summary .wc-filter-bar,
  #personnel-summary .wc-personnel-table-hint,
  #personnel-summary .wc-financial-summary-table > .wc-data-table-wrap{
    display:none !important;
  }

  /* Same page: also drop the "contact the office for a detailed position-
     level FTE table" Staffing Notes some departments' position lists carry
     (see STAFFING_GROUP_NOTES) -- moot here since the print output already
     is that detailed position-level table. */
  #personnel-summary .wc-staffing-notes{
    display:none !important;
  }

  /* Summary of Machinery, Vehicles & Equipment: same idea as Summary of
     Personnel above -- the Department filter is only meaningful on the
     live, interactive page. Unlike Personnel, this page's own table
     already lists every item flat (with its own Department column) when
     no filter is applied, so only the filter bar itself needs hiding. */
  #machinery-summary .wc-filter-bar{
    display:none !important;
  }

  /* Capital Projects Fund Schedule page (cip-capital-projects.html): this
     is the one CIP fund page that bundles two schedules -- the fund's own
     Capital Projects Fund schedule up top, then a second Grant Funded
     Schedule below it -- but only the fund schedule is needed in print, so
     the Grant Funded Schedule section (heading/narrative) and its table
     are dropped from the printed page. */
  #grant-funded,
  #grantsTables{
    display:none !important;
  }

  /* Capital Fund Schedules (Capital Projects/Transportation/Sheriff/
     Tourist Development, see renderFundSchedule in cip-fund-schedule.js):
     only one fiscal year's table is ever in the DOM at a time -- the year
     buttons swap it out entirely on click rather than just toggling
     visibility -- so print can't show every year at once. Drop the whole
     controls box (heading, FY total, and year-picker buttons together)
     and the three-stat summary row (fund total/projects listed/in-house
     engineering) -- what's left is just the project tables themselves. */
  .wc-cip-schedule-controls,
  .wc-cip-year-summary{
    display:none !important;
  }

  /* Give every table caption (see renderTable/.wc-table-label in
     budget-data.js -- used sitewide, including Interfund Transfers Out/In,
     Revenue/Expenditure Budget, and every other captioned data table) the
     same compact, gold-underlined header treatment department pages
     already get for their "Statement of Function" panel (see
     .wc-statement-panel h2 above and ensureStatementPanel in this file) --
     it's a <p>, not an h2, so it needs its own copy of that rule rather
     than matching the shared selector. */
  .wc-table-label{
    font-size:10.5pt !important;
    line-height:1.25 !important;
    margin:0 0 .07in 0 !important;
    padding:0 !important;
    color:#000000 !important;
    font-weight:600 !important;
    letter-spacing:.035em !important;
    text-transform:none !important;
  }

  .wc-table-label::after{
    content:"" !important;
    display:block !important;
    width:.42in !important;
    height:2px !important;
    margin:.055in 0 0 0 !important;
    background:#d1be78 !important;
  }

  /* Fund Financial Schedules page: same FY2020/2021 drop as the two
     Summary pages above, but every fund card here (Consolidated, each
     Major fund, each Non-Major fund) nests a nth-child(2)/(3) revenue-
     source or department detail table inside its own collapsible activity
     rows -- all sharing the exact same column order (label, then
     FY2020-FY2027), so one plain descendant selector catches the outer
     schedule table and every nested breakdown table alike. */
  #consolidated-fund-financial-schedule table th:nth-child(2),
  #consolidated-fund-financial-schedule table td:nth-child(2),
  #consolidated-fund-financial-schedule table th:nth-child(3),
  #consolidated-fund-financial-schedule table td:nth-child(3),
  #major-fund-financial-schedules table th:nth-child(2),
  #major-fund-financial-schedules table td:nth-child(2),
  #major-fund-financial-schedules table th:nth-child(3),
  #major-fund-financial-schedules table td:nth-child(3),
  #non-major-fund-financial-schedules table th:nth-child(2),
  #non-major-fund-financial-schedules table td:nth-child(2),
  #non-major-fund-financial-schedules table th:nth-child(3),
  #non-major-fund-financial-schedules table td:nth-child(3){
    display:none !important;
  }

  .wc-print-budget-table-wrap .wc-data-table th{
    white-space:pre-line !important;
    word-break:keep-all !important;
    overflow-wrap:normal !important;
    hyphens:none !important;
    line-height:1.15 !important;
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

  /* Tourism Administration pairs a division's Expenditure Summary with
     its Advertising Services card in a two-column screen layout. Printed
     budget lines need the full page width, so keep Advertising Services
     in the same division but place it below the main expenditure table. */
  .tourism-admin-financial-pair{
    display:block !important;
    grid-template-columns:none !important;
    width:100% !important;
    margin:0 !important;
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

  /* Summary of Personnel Cost prints as just the department-level rollup
     table -- every department's own "Cost by Position" detail card (and
     the Department/Fund filter dropdowns above the table) are dropped
     from print entirely, rather than the several-hundred-page position-by-
     position printout the generic .wc-budget-lines-detail unhide rule
     above would otherwise produce. Scoped to #personnel-cost-summary (an
     ID, so it wins over that rule's plain classes regardless of
     !important) so no other page's own detail cards are affected. */
  #personnel-cost-summary .wc-filter-bar,
  #personnel-cost-summary .wc-budget-lines-detail,
  #personnel-cost-summary .wc-budget-lines-detail[hidden]{
    display:none !important;
    visibility:hidden !important;
  }

  /* A staffing card's notes sit between the (print-hidden) summary footer
     and the position-detail table in the source markup -- fine on-screen,
     where the notes are meant to always show regardless of whether the
     detail table is expanded, but in print that puts them above the table
     they're actually annotating. Reordered with flex rather than moving
     them in the DOM, so on-screen visibility/placement is untouched. */
  .wc-staffing-card{
    display:flex !important;
    flex-direction:column !important;
  }
  .wc-staffing-card > .wc-budget-lines-detail{
    order:1 !important;
  }
  .wc-staffing-card > .wc-staffing-notes{
    order:2 !important;
  }

  /* Expenditure/Revenue Notes and Staffing Notes (same shared markup, see
     renderNotesHtml) read as an on-screen callout box (background, gold
     left border, .82rem text) that's oversized and out of place next to
     the compact print typography used everywhere else (see
     .wc-statement-panel p) -- stripped down to a plain, smaller footnote
     here instead. */
  .wc-staffing-notes{
    margin:.08in 0 0 0 !important;
    padding:0 !important;
    background:transparent !important;
    border:0 !important;
    border-radius:0 !important;
    font-size:8.5pt !important;
    line-height:1.35 !important;
    color:#000000 !important;
    font-style:italic !important;
  }

  .wc-staffing-notes p{
    margin:0 0 .04in 0 !important;
  }

  .wc-staffing-notes p:last-child{
    margin-bottom:0 !important;
  }

  .wc-staffing-notes-title{
    font-weight:700 !important;
    font-style:normal !important;
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
  .wc-staffing-card:not(.show-prior-years) .wc-staffing-table .wc-prior-year{
    display:table-cell !important;
    visibility:visible !important;
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

  /* Summary of Expenses' department-level "View Budget Lines" detail: a
     row that's $0 across every column print shows (FY2022-FY2027) is
     dropped from print, even though it stays visible on-screen -- see
     the recentFields check in renderExpenseDepartmentBudgetLinesFooter. */
  .wc-print-zero-recent{
    display:none !important;
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
    // Every department page's own "Statement of Function" section already
    // carries this class -- matching on it directly (rather than the
    // heading's exact text) means the same compact, gold-underlined print
    // header also applies to same-shaped sections whose heading reads
    // something else, like Summary of Revenues' "Revenue Overview" or
    // Summary of Expenses' "Expenditure Overview".
    document.querySelectorAll(".statement-of-function").forEach(function (section) {
      section.classList.add("wc-statement-panel");
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

  // Printed pages should always read as light mode, even when the site
  // itself is currently in dark mode -- there are dozens of
  // :root[data-theme="dark"] color rules across style.css/mobile.css, many
  // with higher CSS specificity than the print stylesheet's own generic
  // :root{...} light-color reset (see injectStyles' PRINT_CSS), so those
  // dark backgrounds/text colors were bleeding through onto the printed
  // page instead of resetting to light. Rather than fight that selector
  // war one rule at a time, this just removes the data-theme="dark"
  // attribute itself for the duration of printing, so none of those rules
  // match in the first place -- robust against every current rule and any
  // future one, without needing a matching print override added every
  // time a new dark-mode style is introduced.
  var PRINT_THEME_ATTR = "data-wc-print-restore-theme";
  function forceLightThemeForPrint() {
    var root = document.documentElement;
    if (root.hasAttribute(PRINT_THEME_ATTR)) return;
    var current = root.getAttribute("data-theme");
    root.setAttribute(PRINT_THEME_ATTR, current === null ? "" : current);
    root.setAttribute("data-theme", "light");
  }
  function restoreThemeAfterPrint() {
    var root = document.documentElement;
    if (!root.hasAttribute(PRINT_THEME_ATTR)) return;
    var previous = root.getAttribute(PRINT_THEME_ATTR);
    root.removeAttribute(PRINT_THEME_ATTR);
    if (previous) {
      root.setAttribute("data-theme", previous);
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function syncPrintPreparation() {
    if (window.matchMedia && window.matchMedia("print").matches) {
      openPrintDetails();
      forceLightThemeForPrint();
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
    forceLightThemeForPrint();
  });
  window.addEventListener("afterprint", function () {
    restorePrintDetails();
    restoreThemeAfterPrint();
  });
  if (window.matchMedia) {
    var printQuery = window.matchMedia("print");
    if (typeof printQuery.addEventListener === "function") {
      printQuery.addEventListener("change", function (event) {
        if (event.matches) {
          openPrintDetails();
          forceLightThemeForPrint();
        } else {
          restorePrintDetails();
          restoreThemeAfterPrint();
        }
      });
    } else if (typeof printQuery.addListener === "function") {
      printQuery.addListener(function (event) {
        if (event.matches) {
          openPrintDetails();
          forceLightThemeForPrint();
        } else {
          restorePrintDetails();
          restoreThemeAfterPrint();
        }
      });
    }
  }
})();
