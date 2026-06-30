/* Ledger, the Budget Pixel Guide -- guided page assistant prototype.
   Office of Management and Budget page only. Hard-gated below so including
   this file elsewhere by mistake is a no-op. Not a chatbot: structured
   modes only (menu / guided tour / approved Q&A) with fixed, approved
   answer text. No Supabase queries, no raw data, no open-ended input.
   Ledger is rendered from assets/images/ledger-sprite.png (a single sprite
   sheet); frame selection happens in CSS via the ledger-guide--* classes. */
(function () {
  "use strict";

  function isOmbPage() {
    var path = String((window.location && window.location.pathname) || "").toLowerCase();
    if (path.indexOf("office-of-management-and-budget") !== -1) return true;
    var titleEl = document.querySelector(".page-title");
    return !!(titleEl && titleEl.textContent && titleEl.textContent.trim() === "Office of Management and Budget");
  }

  if (!isOmbPage()) return;

  var STORAGE_KEY = "wc-budget-pixel-guide:omb-enabled";
  // 84px keeps Ledger clear of the sticky nav bar; both margins satisfy the
  // 12px minimum, NAV_CLEARANCE is just stricter for this page's layout.
  var NAV_CLEARANCE = 84;
  var EDGE_MARGIN = 12;
  var CONTEXT_TIP_COOLDOWN_MS = 10000;
  var CONTEXT_TIP_VISIBLE_MS = 6000;

  // Fixed tour sequence. `selectors` are tried in order; the first visible
  // match is used. A step with no visible target is skipped, never shown
  // broken. "finish" has no target at all -- the mascot just returns home.
  var TOUR_STEPS = [
    {
      id: "heading",
      ledgerState: "pointing",
      selectors: [".page-title"],
      message: "This page shows budget information for the Office of Management and Budget. Use it to review how this office’s budget is organized."
    },
    {
      id: "overview",
      ledgerState: "pointing",
      selectors: [".wc-finance-card"],
      message: "These summary figures give you a quick snapshot before you review the detailed rows below."
    },
    {
      id: "main-table",
      ledgerState: "holding",
      selectors: [".wc-view-budget-lines-toggle", ".wc-data-table"],
      message: "This table breaks the office budget into detailed categories and line items."
    },
    {
      id: "historical-actuals",
      ledgerState: "holding",
      selectors: ["#department-performance-table .wc-prior-year", ".wc-data-table .wc-prior-year"],
      message: "Historical actuals show prior-year activity. They help compare what happened in past years to what is planned now."
    },
    {
      id: "budget-columns",
      ledgerState: "pointing",
      selectors: [".wc-finance-card-total", ".wc-finance-card-head"],
      message: "Budget columns show planned funding for the budget year. These amounts are not the same as transactions."
    },
    {
      id: "clickable-actuals",
      ledgerState: "holding",
      selectors: [".wc-actual-drilldown-link"],
      message: "When an actual amount is clickable, you can select it to view related public transactions."
    },
    {
      id: "filters",
      ledgerState: "pointing",
      selectors: [".wc-fy-column-toggle-checkbox"],
      message: "Use filters or search to narrow the table and find specific categories, objects, or services."
    },
    {
      id: "finish",
      ledgerState: "idle",
      selectors: null,
      message: "That is the basic layout. You can keep exploring the table or ask Ledger a common question."
    }
  ];

  var ASK_QUESTIONS = [
    {
      question: "What is this page?",
      answer: "This page shows budget information for the Office of Management and Budget. It helps explain how funding is organized for this office."
    },
    {
      question: "How do I read this table?",
      answer: "Read each row as a budget line or category. The columns show historical actuals, current or proposed budget amounts, and related details where available."
    },
    {
      question: "What are actuals?",
      answer: "Actuals are amounts from prior years that show what was actually collected or spent."
    },
    {
      question: "What is a budget amount?",
      answer: "A budget amount is planned funding for a fiscal year. It is not a list of individual transactions."
    },
    {
      question: "Why are some numbers clickable?",
      answer: "Some historical actual amounts are clickable because related public transaction records are available."
    },
    {
      question: "Why might totals differ?",
      answer: "Transaction totals may differ from budget summary amounts if activity is summarized differently, recorded centrally, or unavailable at the transaction level."
    },
    {
      question: "Where should I start?",
      answer: "Start with the summary figures, then review the table rows. Use filters or search if you are looking for a specific category or object."
    }
  ];

  // Context tips reuse the same approved answer text above -- no new
  // wording invented for the passive-hint path.
  var CONTEXT_TIP_RULES = [
    { selector: ".wc-data-table th, .wc-performance-table th", answerIndex: 1 },
    { selector: ".wc-actual-drilldown-link", answerIndex: 4 },
    { selector: ".wc-fy-column-toggle-checkbox", answerIndex: 6 }
  ];

  var prefersReducedMotion = false;
  try {
    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    prefersReducedMotion = false;
  }

  var state = {
    enabled: false,
    mode: "menu", // "menu" | "tour" | "ask"
    tourStepIndex: -1,
    activeTourTargetEl: null,
    lastContextTipAt: 0,
    contextTipTimer: null,
    scrollScheduled: false,
    reducedMotion: prefersReducedMotion
  };

  var els = {
    root: null,
    mascot: null,
    highlight: null,
    panel: null,
    message: null,
    actions: null
  };

  function readStoredPreference() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function storePreference(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch (e) {
      /* localStorage unavailable; the toggle still works for this visit */
    }
  }

  function isElementVisible(el) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    var style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  // Resolves a tour step to a target element.
  //   - returns an Element  -> step has a real, visible target
  //   - returns null        -> step intentionally has no target ("finish")
  //   - returns undefined   -> step wanted a target but none is visible; skip it
  function resolveStepTarget(step) {
    if (!step.selectors) return null;
    for (var i = 0; i < step.selectors.length; i++) {
      var matches = document.querySelectorAll(step.selectors[i]);
      for (var j = 0; j < matches.length; j++) {
        if (isElementVisible(matches[j])) return matches[j];
      }
    }
    return undefined;
  }

  function findAvailableStepIndex(fromIndex, direction) {
    var idx = fromIndex;
    while (true) {
      idx += direction;
      if (idx < 0 || idx >= TOUR_STEPS.length) return -1;
      if (resolveStepTarget(TOUR_STEPS[idx]) !== undefined) return idx;
    }
  }

  var LEDGER_STATES = ["idle", "pointing", "holding", "presenting", "thinking"];

  function setLedgerState(name) {
    if (!els.mascot) return;
    LEDGER_STATES.forEach(function (s) {
      els.mascot.classList.remove("ledger-guide--" + s);
    });
    els.mascot.classList.add("ledger-guide--" + name);
  }

  var LEDGER_SPRITE_PATH = "../assets/images/ledger-sprite.png";

  function buildLedgerSprite() {
    // Ledger, the Budget Pixel Guide: a single sprite-sheet element.
    // Frame selection happens entirely in CSS via the ledger-guide--* state
    // classes on the parent (.wc-pixel-guide-mascot); this div just hosts
    // the background-image. Purely decorative, hidden from assistive tech.
    return '<div class="ledger-sprite" aria-hidden="true"></div>';
  }

  function isDebugMode() {
    try {
      return (
        /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ||
        new URLSearchParams(window.location.search).has("debugBudgetPixel")
      );
    } catch (e) {
      return false;
    }
  }

  function debugCheckSpriteLoad() {
    if (!isDebugMode()) return;
    var probe = new Image();
    probe.onload = function () {
      console.log(
        "Budget Pixel Guide: ledger-sprite.png loaded (" + probe.naturalWidth + "x" + probe.naturalHeight + ")"
      );
    };
    probe.onerror = function () {
      console.error("Budget Pixel Guide: ledger-sprite.png failed to load from " + LEDGER_SPRITE_PATH);
    };
    probe.src = LEDGER_SPRITE_PATH;
  }

  function buildToggleIcon() {
    return (
      '<svg class="wc-pixel-guide-toggle-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<rect x="3" y="2" width="10" height="10" rx="1" fill="currentColor"/>' +
      '<rect x="5" y="5" width="2" height="2" fill="#fff"/>' +
      '<rect x="9" y="5" width="2" height="2" fill="#fff"/>' +
      "</svg>"
    );
  }

  function ensureGuideElements() {
    if (els.root) return;

    var root = document.createElement("div");
    root.className = "wc-pixel-guide";
    root.setAttribute("hidden", "hidden");

    var mascot = document.createElement("div");
    mascot.className = "wc-pixel-guide-mascot ledger-guide--idle";
    mascot.innerHTML = buildLedgerSprite();

    var highlight = document.createElement("div");
    highlight.className = "wc-pixel-guide-highlight";

    var panel = document.createElement("div");
    panel.className = "wc-pixel-guide-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Ledger, the Budget Pixel Guide");
    panel.innerHTML =
      '<span class="wc-pixel-guide-panel-kicker">Ledger</span>' +
      '<p class="wc-pixel-guide-message" aria-live="polite"></p>' +
      '<div class="wc-pixel-guide-actions"></div>';

    root.appendChild(mascot);
    root.appendChild(highlight);
    root.appendChild(panel);
    document.body.appendChild(root);

    els.root = root;
    els.mascot = mascot;
    els.highlight = highlight;
    els.panel = panel;
    els.message = panel.querySelector(".wc-pixel-guide-message");
    els.actions = panel.querySelector(".wc-pixel-guide-actions");
  }

  function handleGlobalKeydown(event) {
    if (event.key !== "Escape" || !state.enabled) return;
    if (state.mode === "tour") {
      endTour();
    } else {
      setEnabled(false);
    }
  }

  function ensureToggleButton() {
    var existing = document.querySelector(".wc-pixel-guide-toggle");
    if (existing) return existing;

    var titleEl = document.querySelector(".page-title");
    if (!titleEl || !titleEl.parentNode) return null;

    var wrap = document.createElement("div");
    wrap.className = "wc-pixel-guide-toggle-wrap";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "wc-pixel-guide-toggle";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = buildToggleIcon() + '<span class="wc-pixel-guide-toggle-label">Show Ledger</span>';

    wrap.appendChild(button);
    titleEl.insertAdjacentElement("afterend", wrap);
    return button;
  }

  function setToggleLabel(enabled) {
    var button = document.querySelector(".wc-pixel-guide-toggle");
    if (!button) return;
    var label = button.querySelector(".wc-pixel-guide-toggle-label");
    if (label) label.textContent = enabled ? "Hide Ledger" : "Show Ledger";
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
  }

  // The sprite's on-screen size is driven entirely by CSS (--ledger-frame-size,
  // 120px desktop / 88px mobile) -- never assume a fixed JS constant for it,
  // that's exactly what caused Ledger to hang off the right edge before:
  // clamping math used a stale 52px guess while the real element was 120px.
  function getMascotSize() {
    if (els.mascot) {
      var rect = els.mascot.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return { width: rect.width, height: rect.height };
    }
    return { width: 60, height: 60 };
  }

  function clampPosition(left, top, size) {
    var s = size || getMascotSize();
    var maxLeft = Math.max(EDGE_MARGIN, window.innerWidth - s.width - EDGE_MARGIN);
    var maxTop = Math.max(NAV_CLEARANCE, window.innerHeight - s.height - EDGE_MARGIN);
    return {
      left: Math.max(EDGE_MARGIN, Math.min(left, maxLeft)),
      top: Math.max(NAV_CLEARANCE, Math.min(top, maxTop))
    };
  }

  // Default idle spot: attached near the top-right corner of the guide
  // panel, overlapping its edge slightly (never more than
  // PANEL_OVERLAP_MAX px outside the panel), then clamped to stay fully
  // inside the viewport. On narrow screens, centered above the panel
  // instead, since a panel that already sits near the screen's right edge
  // leaves no room for Ledger to hang off its corner.
  var PANEL_OVERLAP_MAX = 20;

  function idleHomePosition() {
    var size = getMascotSize();
    if (!els.panel) {
      return clampPosition(window.innerWidth - size.width - EDGE_MARGIN, window.innerHeight - size.height - EDGE_MARGIN, size);
    }

    var panelRect = els.panel.getBoundingClientRect();
    var left, top;
    if (window.innerWidth <= 640) {
      left = panelRect.left + (panelRect.width - size.width) / 2;
      top = panelRect.top - size.height + 10;
    } else {
      left = panelRect.right - size.width + PANEL_OVERLAP_MAX;
      top = panelRect.top - size.height + PANEL_OVERLAP_MAX;
    }
    return clampPosition(left, top, size);
  }

  function setMascotPosition(pos) {
    els.mascot.style.left = pos.left + "px";
    els.mascot.style.top = pos.top + "px";
  }

  function moveMascotToElement(el, ledgerState) {
    var size = getMascotSize();
    var rect = el.getBoundingClientRect();
    // Dock just outside the target's top-right corner -- reads as "holding
    // the edge" of the table/card without ever covering its content.
    var pos = clampPosition(rect.right - size.width * 0.4, rect.top - size.height * 0.6, size);
    setMascotPosition(pos);
    setLedgerState(ledgerState || "pointing");
  }

  function resetMascotToIdle() {
    state.activeTourTargetEl = null;
    setLedgerState("idle");
    setMascotPosition(idleHomePosition());
  }

  function showHighlightOn(el) {
    var rect = el.getBoundingClientRect();
    var pad = 6;
    els.highlight.style.left = (rect.left - pad) + "px";
    els.highlight.style.top = (rect.top - pad) + "px";
    els.highlight.style.width = (rect.width + pad * 2) + "px";
    els.highlight.style.height = (rect.height + pad * 2) + "px";
    els.highlight.classList.add("is-visible");
  }

  function hideHighlight() {
    els.highlight.classList.remove("is-visible");
  }

  function setMessage(text) {
    els.message.textContent = text;
  }

  function renderActionButtons(buttons, rowed) {
    els.actions.innerHTML = "";
    els.actions.classList.toggle("wc-pixel-guide-actions-row", !!rowed);
    buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wc-pixel-guide-action" + (b.variant ? " wc-pixel-guide-action--" + b.variant : "");
      btn.textContent = b.label;
      btn.addEventListener("click", b.onClick);
      els.actions.appendChild(btn);
    });
  }

  // ---- thinking transition: brief glasses/eye wiggle before a menu/ask
  // message changes. Never used during tour steps, since those already
  // have their own move animation. ----

  function showThinkingThen(applyFn) {
    if (state.reducedMotion) {
      applyFn();
      return;
    }
    setLedgerState("thinking");
    window.setTimeout(applyFn, 220);
  }

  // ---- menu mode ----

  function renderMenu() {
    state.mode = "menu";
    state.tourStepIndex = -1;
    hideHighlight();
    // Panel content first, then position Ledger off the panel's *actual*
    // rendered height -- measuring before the content/buttons are set would
    // use a stale (often shorter) height left over from the prior render.
    setMessage("Hi, I’m Ledger. I can help you read this budget page.");
    renderActionButtons([
      { label: "Start page tour", variant: "primary", onClick: startTour },
      { label: "Ask Ledger", onClick: function () { showThinkingThen(renderAsk); } },
      { label: "Hide Ledger", variant: "quiet", onClick: function () { setEnabled(false); } }
    ]);
    resetMascotToIdle();
  }

  // ---- ask Ledger mode ----

  function renderAsk() {
    state.mode = "ask";
    hideHighlight();
    setMessage("Choose a question:");
    var buttons = ASK_QUESTIONS.map(function (q) {
      return { label: q.question, onClick: function () { showThinkingThen(function () { renderAnswer(q.answer); }); } };
    });
    buttons.push({ label: "Explain this page", onClick: function () { showThinkingThen(renderExplainPage); } });
    buttons.push({ label: "Back", variant: "quiet", onClick: function () { showThinkingThen(renderMenu); } });
    renderActionButtons(buttons);
    resetMascotToIdle();
  }

  function renderAnswer(answerText) {
    setMessage(answerText);
    renderActionButtons([
      { label: "Back", onClick: function () { showThinkingThen(renderAsk); } },
      { label: "Hide Ledger", variant: "quiet", onClick: function () { setEnabled(false); } }
    ], true);
    // Re-anchor to the panel's actual height (an answer can be much longer
    // than the question list it replaced) before overriding idle's state.
    resetMascotToIdle();
    setLedgerState("presenting");
  }

  // ---- "Explain this page" -- safe, visible-DOM-only summary ----

  function getPageDepartmentName() {
    var titleEl = document.querySelector(".page-title");
    var text = titleEl && titleEl.textContent ? titleEl.textContent.trim() : "";
    return text || null;
  }

  function getVisibleRowCount() {
    var tableRows = Array.prototype.filter.call(
      document.querySelectorAll(".wc-data-table tbody tr, .wc-performance-table tbody tr"),
      isElementVisible
    );
    if (tableRows.length) return tableRows.length;
    var cardRows = document.querySelectorAll(".wc-finance-card-row");
    if (cardRows.length) return cardRows.length;
    return null;
  }

  function buildExplainSummary() {
    var deptName = getPageDepartmentName();
    var rowCount = getVisibleRowCount();
    var deptPhrase = "This page is showing " + (deptName || "this department's budget") + ".";
    var rowPhrase = rowCount !== null
      ? " The visible table includes " + rowCount + " row" + (rowCount === 1 ? "" : "s") + "."
      : " The visible tables summarize this department's budget.";
    return deptPhrase + rowPhrase + " Historical actuals show prior-year activity, and budget columns show planned funding.";
  }

  function renderExplainPage() {
    setMessage(buildExplainSummary());
    renderActionButtons([
      { label: "Back", onClick: function () { showThinkingThen(renderAsk); } },
      { label: "Hide Ledger", variant: "quiet", onClick: function () { setEnabled(false); } }
    ], true);
    resetMascotToIdle();
    setLedgerState("presenting");
  }

  // ---- guided tour mode ----

  function startTour() {
    state.mode = "tour";
    var idx = findAvailableStepIndex(-1, 1);
    if (idx === -1) {
      endTour();
      return;
    }
    state.tourStepIndex = idx;
    showTourStep();
  }

  function showTourStep() {
    var step = TOUR_STEPS[state.tourStepIndex];
    var target = resolveStepTarget(step);

    setMessage(step.message);

    if (target) {
      state.activeTourTargetEl = target;
      moveMascotToElement(target, step.ledgerState);
      showHighlightOn(target);
      if (!state.reducedMotion) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      state.activeTourTargetEl = null;
      hideHighlight();
      resetMascotToIdle();
    }

    var isFirst = findAvailableStepIndex(state.tourStepIndex, -1) === -1;
    var isLast = findAvailableStepIndex(state.tourStepIndex, 1) === -1;
    var buttons = [];
    if (!isFirst) buttons.push({ label: "Back", onClick: function () { goToStep(-1); } });
    if (!isLast) buttons.push({ label: "Next", variant: "primary", onClick: function () { goToStep(1); } });
    buttons.push({ label: "End tour", variant: "quiet", onClick: endTour });
    renderActionButtons(buttons, true);
  }

  function goToStep(direction) {
    var idx = findAvailableStepIndex(state.tourStepIndex, direction);
    if (idx === -1) {
      if (direction > 0) endTour();
      return;
    }
    state.tourStepIndex = idx;
    showTourStep();
  }

  function endTour() {
    hideHighlight();
    renderMenu();
  }

  // ---- context tips: passive, rate-limited, never during a tour ----

  function findContextTipRule(target) {
    for (var i = 0; i < CONTEXT_TIP_RULES.length; i++) {
      var rule = CONTEXT_TIP_RULES[i];
      if (target.closest && target.closest(rule.selector)) return rule;
    }
    return null;
  }

  function handleContextEvent(event) {
    if (!state.enabled || state.mode !== "menu") return;
    if (!event.target || typeof event.target.closest !== "function") return;

    var now = Date.now();
    if (now - state.lastContextTipAt < CONTEXT_TIP_COOLDOWN_MS) return;

    var rule = findContextTipRule(event.target);
    if (!rule) return;

    state.lastContextTipAt = now;
    setMessage(ASK_QUESTIONS[rule.answerIndex].answer);
    window.clearTimeout(state.contextTipTimer);
    state.contextTipTimer = window.setTimeout(function () {
      if (state.enabled && state.mode === "menu") renderMenu();
    }, CONTEXT_TIP_VISIBLE_MS);
  }

  // ---- scroll/resize: keep the active tour target docked, keep idle home anchored ----

  function handleScrollOrResize() {
    if (!state.enabled || state.scrollScheduled) return;
    state.scrollScheduled = true;
    window.requestAnimationFrame(function () {
      state.scrollScheduled = false;
      if (state.mode === "tour" && state.activeTourTargetEl) {
        if (!isElementVisible(state.activeTourTargetEl)) {
          // Target left the page (e.g. a panel collapsed); move to the next
          // available step rather than pointing at nothing.
          goToStep(1);
          return;
        }
        moveMascotToElement(state.activeTourTargetEl, TOUR_STEPS[state.tourStepIndex].ledgerState);
        showHighlightOn(state.activeTourTargetEl);
      } else if (state.mode !== "tour") {
        resetMascotToIdle();
      }
    });
  }

  // ---- enable/disable ----

  function setEnabled(enabled) {
    state.enabled = enabled;
    storePreference(enabled);
    ensureGuideElements();

    if (enabled) {
      els.root.removeAttribute("hidden");
      els.mascot.classList.toggle("is-reduced-motion", state.reducedMotion);
      els.highlight.classList.toggle("is-reduced-motion", state.reducedMotion);
      renderMenu();
    } else {
      els.root.setAttribute("hidden", "hidden");
      hideHighlight();
      window.clearTimeout(state.contextTipTimer);
      state.mode = "menu";
      state.tourStepIndex = -1;
      state.activeTourTargetEl = null;
    }

    setToggleLabel(enabled);
  }

  function init() {
    var button = ensureToggleButton();
    if (!button) return;

    debugCheckSpriteLoad();
    setEnabled(readStoredPreference());

    button.addEventListener("click", function () {
      setEnabled(!state.enabled);
    });

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("focusin", handleContextEvent);
    document.addEventListener("click", handleContextEvent);
    document.addEventListener("keydown", handleGlobalKeydown);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
