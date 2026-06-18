(function(){
  var STORAGE_KEY = 'wcSidebarPreference';
  var sidebar = document.getElementById('sidebar');
  var nav = document.querySelector('nav#nav-menu.nav-menu');
  var state = {
    open: false,
    pinned: false,
    side: 'left'
  };

  function readPreference(){
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      var saved = JSON.parse(raw);
      state.pinned = saved.pinned === true;
      state.side = saved.side === 'right' ? 'right' : 'left';
      state.open = state.pinned;
    } catch(error) {
      state.open = false;
      state.pinned = false;
      state.side = 'left';
    }
  }

  function savePreference(){
    try {
      if(window.localStorage){
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          pinned: state.pinned,
          side: state.side
        }));
      }
    } catch(error) {}
  }

  function getToggle(){
    return document.getElementById('sidebar-toggle');
  }

  function setBodyClass(name, enabled){
    document.body.classList.toggle(name, enabled);
  }

  function updateUi(){
    if(!sidebar) return;

    setBodyClass('sidebar-open', state.open || state.pinned);
    setBodyClass('sidebar-pinned', state.pinned);
    setBodyClass('sidebar-pinned-left', state.pinned && state.side === 'left');
    setBodyClass('sidebar-pinned-right', state.pinned && state.side === 'right');
    setBodyClass('sidebar-side-left', state.side === 'left');
    setBodyClass('sidebar-side-right', state.side === 'right');

    sidebar.classList.toggle('open', state.open || state.pinned);
    sidebar.classList.toggle('is-pinned', state.pinned);
    sidebar.classList.toggle('is-left', state.side === 'left');
    sidebar.classList.toggle('is-right', state.side === 'right');

    var toggle = getToggle();
    if(toggle){
      toggle.setAttribute('aria-expanded', String(state.open || state.pinned));
      toggle.classList.toggle('is-active', state.open || state.pinned);
    }

    document.querySelectorAll('[data-sidebar-side]').forEach(function(button){
      button.setAttribute('aria-pressed', String(state.pinned && button.getAttribute('data-sidebar-side') === state.side));
    });

    var unpin = document.querySelector('[data-sidebar-action="unpin"]');
    if(unpin){
      unpin.disabled = !state.pinned;
      unpin.setAttribute('aria-pressed', String(!state.pinned));
    }
  }

  function setOpen(open){
    state.open = open;
    if(!state.pinned){
      updateUi();
    }
  }

  function toggleSidebar(){
    if(state.pinned){
      state.pinned = false;
      state.open = false;
      savePreference();
      updateUi();
      return;
    }
    state.open = !state.open;
    updateUi();
  }

  function pinSidebar(side){
    state.side = side === 'right' ? 'right' : 'left';
    state.pinned = true;
    state.open = true;
    savePreference();
    updateUi();
  }

  function unpinSidebar(){
    state.pinned = false;
    state.open = false;
    savePreference();
    updateUi();
  }

  function insertSidebarToggle(){
    nav = document.querySelector('nav#nav-menu.nav-menu');
    if(!nav || document.getElementById('sidebar-toggle')) return;

    var btn = document.createElement('button');
    btn.id = 'sidebar-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle navigation panel');
    btn.setAttribute('aria-controls', 'sidebar');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
    nav.insertBefore(btn, nav.firstChild);
    btn.addEventListener('click', toggleSidebar);
    updateUi();
  }

  function insertSidebarControls(){
    if(!sidebar || sidebar.querySelector('.wc-sidebar-controls')) return;

    var header = sidebar.querySelector('.wc-sidebar-header');
    if(!header){
      header = document.createElement('div');
      header.className = 'wc-sidebar-header';
      header.textContent = 'FY 2027 Budget';
      sidebar.insertBefore(header, sidebar.firstChild);
    }

    var controls = document.createElement('div');
    controls.className = 'wc-sidebar-controls';
    controls.innerHTML =
      '<button type="button" data-sidebar-side="left" aria-label="Pin navigation to left" title="Pin left">&#8676;</button>' +
      '<button type="button" data-sidebar-action="unpin" aria-label="Unpin navigation" title="Unpin">&times;</button>' +
      '<button type="button" data-sidebar-side="right" aria-label="Pin navigation to right" title="Pin right">&#8677;</button>';
    header.appendChild(controls);

    controls.addEventListener('click', function(event){
      var button = event.target && event.target.closest ? event.target.closest('button') : null;
      if(!button) return;

      var side = button.getAttribute('data-sidebar-side');
      if(side){
        pinSidebar(side);
        return;
      }

      if(button.getAttribute('data-sidebar-action') === 'unpin'){
        unpinSidebar();
      }
    });
  }

  function bindSidebarSections(){
    document.querySelectorAll('.nav-section-toggle').forEach(function(btn){
      if(btn.getAttribute('data-sidebar-bound') === 'true') return;
      btn.setAttribute('data-sidebar-bound', 'true');
      btn.addEventListener('click', function(){
        btn.closest('.nav-section').classList.toggle('open');
      });
    });
  }

  function openActiveSection(){
    var active = document.querySelector('.nav-section-links a.active');
    if(active){
      active.closest('.nav-section').classList.add('open');
      setTimeout(function(){ active.scrollIntoView({block:'nearest'}); }, 100);
    } else {
      var first = document.querySelector('.nav-section');
      if(first) first.classList.add('open');
    }
  }

  document.addEventListener('click', function(event){
    if(!sidebar || state.pinned || !state.open) return;

    var toggle = getToggle();
    if(!sidebar.contains(event.target) &&
       event.target !== toggle &&
       !(toggle && toggle.contains(event.target))){
      setOpen(false);
    }
  });

  document.addEventListener('keydown', function(event){
    if(event.key === 'Escape' && state.open && !state.pinned){
      setOpen(false);
      var toggle = getToggle();
      if(toggle) toggle.focus();
    }
  });

  readPreference();
  updateUi();
  insertSidebarControls();
  bindSidebarSections();
  openActiveSection();

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(insertSidebarToggle, 400);
    });
  } else {
    setTimeout(insertSidebarToggle, 400);
  }
})();
