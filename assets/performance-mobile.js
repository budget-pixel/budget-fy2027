

(function(){

  if(window.__wcPerformanceAccordionLoaded){
    return;
  }

  window.__wcPerformanceAccordionLoaded = true;

  function isPriorPerformanceYearLabel(text){
    const normalized = text.trim().replace(/\s+/g, " ");
    const rangeMatch = normalized.match(/\b(20\d{2})\s*[-–]\s*(\d{2}|20\d{2})\b/);
    if(rangeMatch){
      const endYear = rangeMatch[2].length === 2 ? parseInt("20" + rangeMatch[2], 10) : parseInt(rangeMatch[2], 10);
      return endYear < 2027;
    }
    const yearMatch = normalized.match(/\b(20\d{2})\b/);
    if(yearMatch){
      return parseInt(yearMatch[1], 10) < 2027;
    }
    return false;
  }

  function getPerformanceHeaders(table){
    return Array.prototype.slice.call(table.querySelectorAll("thead th")).map(function(cell){
      return cell.innerText.trim().replace(/\s+/g, " ");
    });
  }

  function enhanceWaltonPerformanceTables(){
    document.querySelectorAll(".wc-performance-table-wrap").forEach(function(wrap){
      wrap.removeAttribute("data-wc-performance-prior-toggle");
      const existingToggle = wrap.querySelector(".wc-performance-prior-year-toggle-wrap");
      if(existingToggle && existingToggle.parentNode){
        existingToggle.parentNode.removeChild(existingToggle);
      }
      const previousToggle = wrap.previousElementSibling;
      if(previousToggle && previousToggle.classList.contains("wc-performance-prior-year-toggle-wrap")){
        previousToggle.parentNode.removeChild(previousToggle);
      }
    });
  }

  function buildWaltonPerformanceAccordions(){

    if(window.innerWidth > 768){
      return;
    }

    document.querySelectorAll(".wc-performance-table-wrap").forEach(function(wrap){

      if(wrap.querySelector(".wc-performance-mobile-accordion")){
        return;
      }

      const table = wrap.querySelector(".wc-performance-table");

      if(!table){
        return;
      }

      const rows = table.querySelectorAll("tbody tr");
      const headers = getPerformanceHeaders(table);

      let currentCode = "";
      let currentGoal = "";

      const accordion = document.createElement("div");
      accordion.className = "wc-performance-mobile-accordion";

      rows.forEach(function(row){

        const cells = row.querySelectorAll("td");

        if(cells.length < 6){
          return;
        }

        let index = 0;

        if(row.querySelector(".wc-performance-code")){
          currentCode = cells[index].innerText.trim();
          index++;
        }

        if(row.querySelector(".wc-performance-goal")){
          currentGoal = cells[index].innerText.trim();
          index++;
        }

        const objective = cells[index] ? cells[index].innerText.trim() : "";
        index++;

        const measure = cells[index] ? cells[index].innerText.trim() : "";
        index++;

        const metrics = [];
        for(let metricIndex = index; metricIndex < cells.length; metricIndex++){
          const label = headers[metricIndex] || "";
          if(!label){
            continue;
          }
          metrics.push({
            label:label,
            value:cells[metricIndex] ? cells[metricIndex].innerText.trim() : "",
            isPriorYear:isPriorPerformanceYearLabel(label)
          });
        }

        const item = document.createElement("div");
        item.className = "wc-performance-item";

        item.innerHTML = `
          <button class="wc-performance-summary" type="button">

            <div class="wc-performance-summary-top">

              <div class="wc-performance-code-pill">
                ${currentCode}
              </div>

              <div class="wc-performance-measure-title">
                ${measure}
              </div>

            </div>

          </button>

          <div class="wc-performance-detail">

            <div class="wc-performance-detail-block">
              <div class="wc-performance-detail-label">
                Objective
              </div>

              <div class="wc-performance-detail-text">
                ${objective}
              </div>
            </div>

            <div class="wc-performance-detail-block">
              <div class="wc-performance-detail-label">
                Departmental Goal
              </div>

              <div class="wc-performance-detail-text">
                ${currentGoal}
              </div>
            </div>

            ${metrics.map(function(metric){
              return `
                <div class="wc-performance-metric-row${metric.isPriorYear ? ' is-prior-year' : ''}">
                  <div class="wc-performance-metric-year">
                    ${metric.label}
                  </div>

                  <div class="wc-performance-metric-value">
                    ${metric.value}
                  </div>
                </div>
              `;
            }).join("")}

          </div>
        `;

        const summary = item.querySelector(".wc-performance-summary");

        summary.addEventListener("click", function(){
          item.classList.toggle("is-open");
        });

        accordion.appendChild(item);

      });

      wrap.appendChild(accordion);
      enhanceWaltonPerformanceTables();

    });

  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){
      enhanceWaltonPerformanceTables();
      buildWaltonPerformanceAccordions();
    });
  }else{
    enhanceWaltonPerformanceTables();
    buildWaltonPerformanceAccordions();
  }

  window.addEventListener("resize", function(){

    clearTimeout(window.__wcPerformanceResizeTimer);

    window.__wcPerformanceResizeTimer = setTimeout(function(){

      document.querySelectorAll(".wc-performance-mobile-accordion").forEach(function(el){
        el.remove();
      });

      enhanceWaltonPerformanceTables();
      buildWaltonPerformanceAccordions();

    }, 150);

  });

  try{
    new MutationObserver(function(){
      enhanceWaltonPerformanceTables();
      buildWaltonPerformanceAccordions();
    }).observe(document.documentElement, {
      childList:true,
      subtree:true
    });
  }catch(error){
    if(window.console && typeof window.console.error === "function"){
      window.console.error("Walton performance table enhancement failed:", error);
    }
  }

})();
