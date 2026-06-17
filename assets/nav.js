(function(){

  // Inject sidebar-toggle button into the nav bar after nav.js renders it
  function insertSidebarToggle(){
    var nav = document.querySelector('nav#nav-menu.nav-menu');
    if(!nav || document.getElementById('sidebar-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'sidebar-toggle';
    btn.setAttribute('aria-label', 'Toggle navigation');
    btn.innerHTML = '&#9776; Menu';
    nav.insertBefore(btn, nav.firstChild);
    btn.addEventListener('click', toggleSidebar);
  }

  var sidebar = document.getElementById('sidebar');

  function toggleSidebar(){
    if(sidebar){ sidebar.classList.toggle('open'); }
  }

  document.addEventListener('click', function(e){
    if(!sidebar) return;
    var toggle = document.getElementById('sidebar-toggle');
    if(sidebar.classList.contains('open') &&
       !sidebar.contains(e.target) &&
       e.target !== toggle &&
       !(toggle && toggle.contains(e.target))){
      sidebar.classList.remove('open');
    }
  });

  // Collapsible sidebar sections
  document.querySelectorAll('.nav-section-toggle').forEach(function(btn){
    btn.addEventListener('click', function(){
      btn.closest('.nav-section').classList.toggle('open');
    });
  });

  // Open the section that contains the active link
  var active = document.querySelector('.nav-section-links a.active');
  if(active){
    active.closest('.nav-section').classList.add('open');
    setTimeout(function(){ active.scrollIntoView({block:'nearest'}); }, 100);
  } else {
    var first = document.querySelector('.nav-section');
    if(first) first.classList.add('open');
  }

  // Wait for walton-budget-nav.js to finish rendering, then add toggle
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(insertSidebarToggle, 400);
    });
  } else {
    setTimeout(insertSidebarToggle, 400);
  }

})();
