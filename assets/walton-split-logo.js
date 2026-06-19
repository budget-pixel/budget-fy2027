(function(){
  var STYLE_ID = "wc-split-logo-styles";

  function injectStyles(){
    if(document.getElementById(STYLE_ID)){
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .wc-split-brand,
      .wc-split-brand *{
        -webkit-text-size-adjust:100% !important;
        text-size-adjust:100% !important;
      }

      .wc-split-brand{
        display:flex !important;
        align-items:center !important;
        justify-content:flex-start !important;
        gap:14px !important;
        width:auto !important;
        min-width:max-content !important;
        height:58px !important;
        flex:0 0 auto !important;
        overflow:visible !important;
        font-family:Arial, Helvetica, sans-serif !important;
        text-decoration:none !important;
        color:inherit !important;
      }

      .wc-split-brand-text{
        display:flex !important;
        flex-direction:column !important;
        justify-content:center !important;
        align-items:flex-start !important;
        gap:0 !important;
      }

      .wc-split-brand-top{
        display:block !important;
        color:#006231 !important;
        font-family:Arial, Helvetica, sans-serif !important;
        font-size:22px !important;
        line-height:1 !important;
        font-weight:800 !important;
        letter-spacing:.06em !important;
        text-transform:uppercase !important;
        white-space:nowrap !important;
      }

      .wc-split-brand-bottom{
        display:block !important;
        margin-top:3px !important;
        color:#000000 !important;
        font-family:Arial, Helvetica, sans-serif !important;
        font-size:10.588235px !important;
        line-height:9px !important;
        font-weight:800 !important;
        letter-spacing:.15em !important;
        text-transform:uppercase !important;
        white-space:nowrap !important;
      }

      .wc-split-brand-seal,
      .wc-seal-mark{
        position:static !important;
        display:block !important;
        width:50px !important;
        height:50px !important;
        flex:0 0 50px !important;
        border-radius:999px !important;
        background:#ffffff url("https://stories.opengov.com/countyofwaltonfl/uploads/c432578eae78-Walton_County_Logo_no_background.png") center center / 46px 46px no-repeat !important;
        border:3px solid #d1be78 !important;
        box-sizing:border-box !important;
        transform:none !important;
        z-index:2 !important;
        cursor:pointer !important;
        text-decoration:none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function getHtml(linkHref, linkLabel){
    var sealTag = linkHref ? "a" : "span";
    var hrefAttr = linkHref ? ' href="' + linkHref + '"' : "";
    var ariaAttr = linkLabel ? ' aria-label="' + linkLabel + '"' : ' aria-hidden="true"';

    return `
      <div class="wc-split-brand" aria-label="Walton County Board of County Commissioners">
        <${sealTag} class="wc-split-brand-seal wc-seal-mark"${hrefAttr}${ariaAttr}></${sealTag}>
        <div class="wc-split-brand-text">
          <div class="wc-split-brand-top">Walton County</div>
          <div class="wc-split-brand-bottom">Board of County Commissioners</div>
        </div>
      </div>
    `;
  }

  function equalizeBrandTextWidth(block){
    var top = block.querySelector(".wc-split-brand-top");
    var bottom = block.querySelector(".wc-split-brand-bottom");
    if(!top || !bottom){
      return;
    }
    bottom.style.removeProperty("letter-spacing");
    var topWidth = top.getBoundingClientRect().width;
    var bottomWidth = bottom.getBoundingClientRect().width;
    if(!topWidth || !bottomWidth){
      return;
    }
    var gaps = Math.max((bottom.textContent || "").length - 1, 1);
    var baseSpacing = parseFloat(getComputedStyle(bottom).letterSpacing) || 0;
    var nextSpacing = baseSpacing + (topWidth - bottomWidth) / gaps;
    bottom.style.setProperty("letter-spacing", nextSpacing + "px", "important");
  }

  function equalizeAll(root){
    (root || document).querySelectorAll(".wc-split-brand-text").forEach(equalizeBrandTextWidth);
  }

  window.WaltonSplitLogo = {
    injectStyles: injectStyles,
    getHtml: getHtml,
    equalizeAll: equalizeAll
  };

  injectStyles();
})();
