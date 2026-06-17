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
        gap:4px !important;
        width:auto !important;
        min-width:max-content !important;
        height:58px !important;
        flex:0 0 auto !important;
        overflow:visible !important;
        font-family:"Avenir Next", Avenir, Helvetica, Arial, sans-serif !important;
        text-decoration:none !important;
        color:inherit !important;
      }

      .wc-split-brand-left,
      .wc-split-brand-right{
        display:flex !important;
        flex-direction:column !important;
        justify-content:center !important;
        gap:0 !important;
      }

      .wc-split-brand-left{
        align-items:flex-end !important;
      }

      .wc-split-brand-right{
        align-items:flex-start !important;
      }

      .wc-split-brand-top{
        display:block !important;
        color:#006231 !important;
        font-family:"Avenir Next", Avenir, Helvetica, Arial, sans-serif !important;
        font-size:26px !important;
        line-height:.84 !important;
        font-weight:800 !important;
        letter-spacing:.11em !important;
        text-transform:uppercase !important;
        white-space:nowrap !important;
      }

      .wc-split-brand-bottom{
        display:block !important;
        margin-top:2px !important;
        margin-right:1px !important;
        color:#000000 !important;
        font-family:"Avenir Next", Avenir, Helvetica, Arial, sans-serif !important;
        font-size:10.588235px !important;
        line-height:9px !important;
        font-weight:800 !important;
        letter-spacing:.15em !important;
        text-transform:uppercase !important;
        white-space:nowrap !important;
      }

      .wc-split-brand-right .wc-split-brand-bottom{
        margin-left:3px !important;
        margin-right:1px !important;
        letter-spacing:.20em !important;
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
        border:2px solid #d1be78 !important;
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
        <div class="wc-split-brand-left">
          <div class="wc-split-brand-top">Walton</div>
          <div class="wc-split-brand-bottom">Board of County</div>
        </div>
        <${sealTag} class="wc-split-brand-seal wc-seal-mark"${hrefAttr}${ariaAttr}></${sealTag}>
        <div class="wc-split-brand-right">
          <div class="wc-split-brand-top">County</div>
          <div class="wc-split-brand-bottom">Commissioners</div>
        </div>
      </div>
    `;
  }

  window.WaltonSplitLogo = {
    injectStyles: injectStyles,
    getHtml: getHtml
  };

  injectStyles();
})();
