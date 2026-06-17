window.WCSidebar = (function () {
  var collapseState = {};

  function buildGroupedHTML(filterText) {
    var term = (filterText || '').trim().toLowerCase();

    return window.WC_SECTION_ORDER.map(function (section) {
      var items = window.wcPageList.filter(function (p) {
        return p.section === section && (!term || p.title.toLowerCase().indexOf(term) !== -1);
      });
      if (term && items.length === 0) return '';

      var isOpen = term ? true : collapseState[section] !== false;

      var linksHtml = items.map(function (p) {
        return '<a href="' + window.wcPageUrl(p.id) + '" data-page-id="' + p.id + '">' + p.title + '</a>';
      }).join('');

      return (
        '<div class="wc-sidebar-section' + (isOpen ? ' open' : '') + '" data-section="' + section + '">' +
          '<button class="wc-sidebar-section-toggle" type="button">' + section + '<span class="arrow">&#9656;</span></button>' +
          '<div class="wc-sidebar-section-links">' + linksHtml + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function bindSectionToggles() {
    document.querySelectorAll('.wc-sidebar-section-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var section = btn.closest('.wc-sidebar-section');
        var willOpen = !section.classList.contains('open');
        section.classList.toggle('open', willOpen);
        collapseState[section.dataset.section] = willOpen;
      });
    });
  }

  function bindLinkClicks() {
    document.querySelectorAll('.wc-sidebar-section-links a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var pageId = a.dataset.pageId;
        close();

        var idx = window.wcPageIndexById(pageId);
        if (idx === -1) return;

        var bookWrap = document.getElementById('book-wrap');
        if (bookWrap && !bookWrap.hidden && window.WCFlipbook) {
          window.WCFlipbook.goTo(idx + 1);
        } else if (window.WCMobileScroll) {
          window.WCMobileScroll.goToId(pageId);
        }
      });
    });
  }

  function render(filterText) {
    var container = document.getElementById('wc-sidebar-sections');
    container.innerHTML = buildGroupedHTML(filterText);
    bindSectionToggles();
    bindLinkClicks();
  }

  function highlightActiveSidebarLink(pageId) {
    document.querySelectorAll('.wc-sidebar-section-links a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.pageId === pageId);
    });
  }

  function open(focusTarget) {
    document.getElementById('wc-sidebar').classList.add('open');
    document.getElementById('wc-sidebar-overlay').classList.add('is-active');
    if (focusTarget === 'search') {
      document.getElementById('wc-sidebar-search-input').focus();
    } else {
      var firstToggle = document.querySelector('.wc-sidebar-section-toggle');
      if (firstToggle) firstToggle.focus();
    }
  }

  function close() {
    document.getElementById('wc-sidebar').classList.remove('open');
    document.getElementById('wc-sidebar-overlay').classList.remove('is-active');
  }

  function init() {
    render('');

    document.getElementById('wc-sidebar-search-input').addEventListener('input', function (e) {
      render(e.target.value);
    });
    document.getElementById('wc-sidebar-close').addEventListener('click', close);
    document.getElementById('wc-sidebar-overlay').addEventListener('click', close);

    document.addEventListener('click', function (e) {
      var sidebar = document.getElementById('wc-sidebar');
      if (!sidebar.classList.contains('open')) return;
      if (sidebar.contains(e.target)) return;
      if (e.target.closest('#wc-search-icon-btn, #wc-menu-icon-btn')) return;
      close();
    });

    document.getElementById('wc-search-icon-btn').addEventListener('click', function () { open('search'); });
    document.getElementById('wc-menu-icon-btn').addEventListener('click', function () { open('nav'); });
  }

  return { init: init, open: open, close: close, render: render, highlightActiveSidebarLink: highlightActiveSidebarLink };
})();
