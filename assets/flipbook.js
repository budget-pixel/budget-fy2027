window.WCFlipbook = (function () {
  var $book = null;
  var RENDER_WINDOW = 2; // pages ahead/behind to keep rendered

  function headerHeight() {
    var header = document.getElementById('wc-header');
    return header ? header.offsetHeight : 74;
  }

  function buildPlaceholders(bookEl) {
    bookEl.innerHTML = '';
    window.wcPageList.forEach(function (entry, i) {
      var div = document.createElement('div');
      div.className = 'page';
      div.dataset.pageId = entry.id;
      div.dataset.pageIndex = String(i + 1);
      div.innerHTML = '<p class="page-loading">Loading&hellip;</p>';
      bookEl.appendChild(div);
    });
  }

  function updatePageCounter(page) {
    var el = document.getElementById('page-counter');
    if (el) el.textContent = 'Page ' + page + ' of ' + window.wcPageList.length;
  }

  function ensureRendered(pageNumber) {
    var lo = Math.max(1, pageNumber - RENDER_WINDOW);
    var hi = Math.min(window.wcPageList.length, pageNumber + RENDER_WINDOW);
    for (var p = lo; p <= hi; p++) {
      var leaf = document.querySelector('#book .page[data-page-index="' + p + '"]');
      if (leaf && leaf.dataset.loadedPageId !== leaf.dataset.pageId) {
        var entry = window.wcPageList[p - 1];
        window.WCContentLoader.loadPageContent(entry.id, leaf).then(function () {
          if ($book) $book.turn('update');
        });
      }
    }
  }

  function highlightForPage(page) {
    var entry = window.wcPageList[page - 1];
    if (entry && window.WCSidebar) window.WCSidebar.highlightActiveSidebarLink(entry.id);
  }

  var EDGE_ZONE = 0.12; // fraction of book width treated as a click-to-flip edge

  function bindEdgeClicks(bookEl) {
    bookEl.addEventListener('click', function (e) {
      if (e.target.closest('a, button, input, select, textarea, summary')) return;
      var rect = bookEl.getBoundingClientRect();
      var relX = (e.clientX - rect.left) / rect.width;
      if (relX >= 1 - EDGE_ZONE) next();
      else if (relX <= EDGE_ZONE) prev();
    });
  }

  function init() {
    var bookEl = document.getElementById('book');
    buildPlaceholders(bookEl);
    bindEdgeClicks(bookEl);
    $book = $(bookEl);
    $book.turn({
      width: window.innerWidth,
      height: window.innerHeight - headerHeight(),
      autoCenter: true,
      display: 'single',
      pages: window.wcPageList.length,
      when: {
        turning: function (event, page) {
          updatePageCounter(page);
          ensureRendered(page);
        },
        turned: function (event, page) {
          updatePageCounter(page);
          ensureRendered(page);
          highlightForPage(page);
        }
      }
    });
    updatePageCounter(1);
    ensureRendered(1);
    highlightForPage(1);
  }

  function goTo(pageNumber) {
    if ($book) $book.turn('page', pageNumber);
  }

  function next() {
    if ($book) $book.turn('next');
  }

  function prev() {
    if ($book) $book.turn('previous');
  }

  function resize() {
    if ($book) $book.turn('size', window.innerWidth, window.innerHeight - headerHeight());
  }

  function destroy() {
    if ($book) {
      $book.turn('destroy');
      $book.removeData();
      $book = null;
    }
  }

  function currentPageId() {
    if (!$book) return null;
    var page = $book.turn('page');
    var entry = window.wcPageList[page - 1];
    return entry ? entry.id : null;
  }

  return { init: init, goTo: goTo, next: next, prev: prev, resize: resize, destroy: destroy, currentPageId: currentPageId };
})();
