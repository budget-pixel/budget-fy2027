window.WCMobileScroll = (function () {
  var currentIndex = 0;
  var abortController = null;

  function updateBar() {
    var counter = document.getElementById('mobile-page-counter');
    if (counter) counter.textContent = 'Page ' + (currentIndex + 1) + ' of ' + window.wcPageList.length;

    var prevBtn = document.getElementById('mobile-prev');
    var nextBtn = document.getElementById('mobile-next');
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === window.wcPageList.length - 1;
  }

  function render(index) {
    currentIndex = Math.max(0, Math.min(window.wcPageList.length - 1, index));
    var entry = window.wcPageList[currentIndex];
    var container = document.getElementById('mobile-content');

    window.WCContentLoader.loadPageContent(entry.id, container).then(function () {
      window.scrollTo(0, 0);
    });

    updateBar();
    if (window.WCSidebar) window.WCSidebar.highlightActiveSidebarLink(entry.id);
  }

  function next() {
    render(currentIndex + 1);
  }

  function prev() {
    render(currentIndex - 1);
  }

  function goToId(pageId) {
    var idx = window.wcPageIndexById(pageId);
    if (idx !== -1) render(idx);
  }

  function init(startPageId) {
    abortController = new AbortController();
    var signal = abortController.signal;

    var prevBtn = document.getElementById('mobile-prev');
    var nextBtn = document.getElementById('mobile-next');
    if (prevBtn) prevBtn.addEventListener('click', prev, { signal: signal });
    if (nextBtn) nextBtn.addEventListener('click', next, { signal: signal });

    var startIndex = startPageId ? window.wcPageIndexById(startPageId) : currentIndex;
    render(startIndex === -1 ? 0 : startIndex);
  }

  function destroy() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  return { init: init, next: next, prev: prev, goToId: goToId, render: render, destroy: destroy };
})();
