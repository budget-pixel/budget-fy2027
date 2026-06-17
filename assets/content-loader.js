window.WCContentLoader = (function () {
  var cache = new Map(); // pageId -> { html: string, executed: boolean }
  var scriptTextCache = new Map(); // external script src -> fetched source text

  function rewriteRelativePaths(containerEl) {
    containerEl.querySelectorAll('[src^="../assets/"]').forEach(function (el) {
      el.setAttribute('src', el.getAttribute('src').replace(/^\.\.\//, ''));
    });
    containerEl.querySelectorAll('[href^="../assets/"]').forEach(function (el) {
      el.setAttribute('href', el.getAttribute('href').replace(/^\.\.\//, ''));
    });

    containerEl.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || /^(https?:|mailto:|#)/i.test(href)) return;
      if (href.indexOf('../') === 0) {
        a.setAttribute('href', href.replace(/^\.\.\//, ''));
        return;
      }
      if (href.indexOf('pages/') === 0 || href.indexOf('assets/') === 0) return;
      a.setAttribute('href', 'pages/' + href);
    });
  }

  function fetchScriptText(src) {
    if (scriptTextCache.has(src)) return Promise.resolve(scriptTextCache.get(src));
    return fetch(src)
      .then(function (res) { return res.text(); })
      .then(function (text) {
        scriptTextCache.set(src, text);
        return text;
      });
  }

  // Several page-content scripts are shared across many different pages (e.g.
  // walton-cip-fund-schedule.js is loaded by 5 different CIP pages) and declare
  // top-level const/let bindings. Running them as independent global <script>
  // tags works the first time, but re-running any of them for a different page
  // later in the same document throws "Identifier already declared". Running each
  // <script> in its own separate closure would avoid that crash but would also
  // hide variables (e.g. wcCipProjects) from sibling scripts in the *same* page
  // that expect to read them as bare globals.
  //
  // Fix: bundle every script belonging to one page injection into a single shared
  // function scope (siblings within that page still see each other's
  // declarations), isolated from every other page's bundle (so re-running a
  // shared vendor script for a different page never collides).
  async function reExecuteScripts(containerEl) {
    var scriptEls = Array.prototype.slice.call(containerEl.querySelectorAll('script'));
    if (!scriptEls.length) return;

    var codeParts = await Promise.all(scriptEls.map(function (el) {
      return el.src ? fetchScriptText(el.src) : Promise.resolve(el.textContent);
    }));

    scriptEls.forEach(function (el) { el.remove(); });

    var bundle = '(function(){\n' + codeParts.join('\n;\n') + '\n})();';
    var fresh = document.createElement('script');
    fresh.textContent = bundle;
    document.body.appendChild(fresh);
  }

  function idFromHref(href) {
    var match = /(?:^|\/)pages\/([^/]+)\.html$/.exec(href || '');
    if (match) return match[1];
    return null;
  }

  function interceptInPageLinks(containerEl) {
    containerEl.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || !containerEl.contains(a)) return;

      var href = a.getAttribute('href');
      if (!href || /^(https?:|mailto:|#)/i.test(href)) return;

      var pageId = idFromHref(href);
      if (!pageId) return;

      var idx = window.wcPageIndexById(pageId);
      if (idx === -1) return;

      e.preventDefault();
      var bookWrap = document.getElementById('book-wrap');
      if (bookWrap && !bookWrap.hidden && window.WCFlipbook) {
        window.WCFlipbook.goTo(idx + 1);
      } else if (window.WCMobileScroll) {
        window.WCMobileScroll.goToId(pageId);
      }
    });
  }

  async function applyEntry(entry, pageId, containerEl) {
    containerEl.innerHTML = entry.html;
    rewriteRelativePaths(containerEl);
    if (!entry.executed) {
      await reExecuteScripts(containerEl);
      entry.executed = true;
      entry.html = containerEl.innerHTML;
    }
    if (!containerEl.dataset.wcLinksBound) {
      interceptInPageLinks(containerEl);
      containerEl.dataset.wcLinksBound = 'true';
    }
    containerEl.dataset.loadedPageId = pageId;
    return entry;
  }

  async function loadPageContent(pageId, containerEl) {
    var entry = cache.get(pageId);
    if (entry) {
      return applyEntry(entry, pageId, containerEl);
    }

    try {
      var res = await fetch(window.wcPageUrl(pageId));
      var html = await res.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var contentEl = doc.querySelector('#content');
      var newEntry = {
        html: contentEl ? contentEl.innerHTML : '<p class="page-loading">Content unavailable.</p>',
        executed: false
      };
      cache.set(pageId, newEntry);
      return await applyEntry(newEntry, pageId, containerEl);
    } catch (err) {
      containerEl.innerHTML = '<p class="page-loading">Unable to load this page.</p>';
      console.error('WCContentLoader: failed to load', pageId, err);
    }
  }

  return { loadPageContent: loadPageContent, cache: cache };
})();
