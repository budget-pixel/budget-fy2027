window.WCModeSwitch = (function () {
  var BREAKPOINT = 768; // matches assets/style.css's existing breakpoint
  var currentMode = null; // 'desktop' | 'mobile'
  var switching = false;
  var resizeTimer = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-wc-cdn="' + src + '"]');
      if (existing) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.dataset.wcCdn = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.body.appendChild(s);
    });
  }

  function ensureDesktopLibsLoaded() {
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.turn) return Promise.resolve();
    return loadScript('https://code.jquery.com/jquery-3.7.1.min.js')
      .then(function () { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/turn.js/3/turn.min.js'); });
  }

  function currentPageId() {
    if (currentMode === 'desktop' && window.WCFlipbook) return window.WCFlipbook.currentPageId();
    var content = document.getElementById('mobile-content');
    return content ? content.dataset.loadedPageId : null;
  }

  function switchTo(mode) {
    if (mode === currentMode) return Promise.resolve();
    var keepPageId = currentPageId();

    var bookWrap = document.getElementById('book-wrap');
    var mobileWrap = document.getElementById('mobile-wrap');

    var teardown = Promise.resolve();
    if (currentMode === 'desktop' && window.WCFlipbook) {
      window.WCFlipbook.destroy();
    } else if (currentMode === 'mobile' && window.WCMobileScroll) {
      window.WCMobileScroll.destroy();
    }

    if (mode === 'desktop') {
      bookWrap.hidden = false;
      mobileWrap.hidden = true;
      teardown = ensureDesktopLibsLoaded().then(function () {
        window.WCFlipbook.init();
        if (keepPageId) {
          var idx = window.wcPageIndexById(keepPageId);
          if (idx !== -1) window.WCFlipbook.goTo(idx + 1);
        }
      });
    } else {
      bookWrap.hidden = true;
      mobileWrap.hidden = false;
      window.WCMobileScroll.init(keepPageId);
    }

    currentMode = mode;
    return teardown;
  }

  function evaluate() {
    var wantMode = window.innerWidth >= BREAKPOINT ? 'desktop' : 'mobile';
    if (switching) return;
    switching = true;
    switchTo(wantMode).finally(function () { switching = false; });
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var wantMode = window.innerWidth >= BREAKPOINT ? 'desktop' : 'mobile';
      if (wantMode === currentMode && currentMode === 'desktop' && window.WCFlipbook) {
        window.WCFlipbook.resize();
      } else {
        evaluate();
      }
    }, 150);
  }

  function init() {
    evaluate();
    window.addEventListener('resize', onResize);
  }

  return { init: init, evaluate: evaluate };
})();
