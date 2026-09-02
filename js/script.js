(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Meta Pixel: count WhatsApp CTA clicks as leads ----
     Placed before the chat block below, which returns early when #wa-chat is
     absent. Guarded on fbq so it no-ops if the pixel is blocked or removed. */
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href*="wa.me/"]');
    if (!link || typeof window.fbq !== 'function') return;
    var where = link.classList.contains('wa-sticky') ? 'sticky'
              : link.closest('#pricing') ? 'pricing'
              : link.closest('#contact') ? 'contact'
              : link.closest('.site-header') ? 'header'
              : link.closest('.hero') ? 'hero'
              : 'other';
    window.fbq('track', 'Lead', { content_name: where });
  });

  /* ---- Footer year ---- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Mobile nav toggle ---- */
  var header = document.querySelector('.site-header');
  var navToggle = document.getElementById('nav-toggle');
  var mainNav = document.getElementById('main-nav');

  if (navToggle && header && mainNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = header.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        header.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- Partners wheel: duplicate the set for a seamless loop ---- */
  var partnersTrack = document.getElementById('partners-track');
  if (partnersTrack && !prefersReducedMotion) {
    Array.prototype.slice.call(partnersTrack.children).forEach(function (item) {
      var clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('img').forEach(function (img) { img.alt = ''; });
      partnersTrack.appendChild(clone);
    });
    partnersTrack.classList.add('is-looping');
  }

  /* ---- Scroll reveal (blocks + staggered grids) ---- */
  var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');

  if (!prefersReducedMotion) {
    document.querySelectorAll('.reveal-stagger').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.transitionDelay = (i * 60) + 'ms';
      });
    });
  }

  if (revealEls.length) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var el = entry.target;
            el.classList.add('is-visible');
            observer.unobserve(el);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

      revealEls.forEach(function (el) { observer.observe(el); });
    }
  }

  /* ---- Scroll progress bar ---- */
  (function () {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;
    var ticking = false;
    function update() {
      var scroller = document.scrollingElement || document.documentElement;
      var scrolled = window.pageYOffset || scroller.scrollTop || 0;
      var max = scroller.scrollHeight - scroller.clientHeight;
      var frac = max > 0 ? Math.min(scrolled / max, 1) : 0;
      bar.style.transform = 'scaleX(' + frac + ')';
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    update();
  }());

  /* ---- Animated WhatsApp conversation ---- */
  var chat = document.getElementById('wa-chat');
  if (!chat) return;

  var script = [
    { side: 'in', lang: 'ar', text: 'مرحباً، هل يوجد موعد متاح يوم الخميس لتنظيف الأسنان؟', time: '8:42 PM' },
    { side: 'out', lang: 'en', text: 'Hi! Yes — we have an opening Thursday at 5:00 PM or 6:30 PM. Which works better for you?', time: '8:42 PM' },
    { side: 'in', lang: 'en', text: '6:30 sounds perfect.', time: '8:43 PM' },
    { side: 'out', lang: 'ar', text: 'تم الحجز ✓ يوم الخميس الساعة 6:30 مساءً. سنرسل لك تذكيراً قبل الموعد بساعة. نراك قريباً!', time: '8:43 PM' }
  ];

  function buildBubble(msg) {
    var bubble = document.createElement('div');
    bubble.className = 'bubble bubble--' + msg.side + (msg.lang === 'ar' ? ' bubble--ar' : '');
    var text = document.createElement('span');
    text.textContent = msg.text;
    var time = document.createElement('time');
    time.textContent = msg.time;
    bubble.appendChild(text);
    bubble.appendChild(time);
    return bubble;
  }

  function buildTyping() {
    var typing = document.createElement('div');
    typing.className = 'wa-typing';
    typing.setAttribute('aria-hidden', 'true');
    typing.innerHTML = '<span></span><span></span><span></span>';
    return typing;
  }

  var TYPING_MS = 1200;
  var GAP_MS = 700;
  var RESTART_DELAY_MS = 4200;
  var timers = [];

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function runConversation() {
    clearTimers();
    chat.innerHTML = '';

    var delay = 250;

    script.forEach(function (msg) {
      if (msg.side === 'out') {
        timers.push(setTimeout(function () {
          var typing = buildTyping();
          chat.appendChild(typing);
          chat.scrollTop = chat.scrollHeight;

          timers.push(setTimeout(function () {
            typing.remove();
            chat.appendChild(buildBubble(msg));
            chat.scrollTop = chat.scrollHeight;
          }, TYPING_MS));
        }, delay));

        delay += TYPING_MS + GAP_MS;
      } else {
        timers.push(setTimeout(function () {
          chat.appendChild(buildBubble(msg));
          chat.scrollTop = chat.scrollHeight;
        }, delay));

        delay += GAP_MS;
      }
    });

    timers.push(setTimeout(runConversation, delay + RESTART_DELAY_MS));
  }

  if (prefersReducedMotion) {
    script.forEach(function (msg) { chat.appendChild(buildBubble(msg)); });
  } else if ('IntersectionObserver' in window) {
    var chatObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          runConversation();
          chatObserver.disconnect();
        }
      });
    }, { threshold: 0.4 });
    chatObserver.observe(chat);
  } else {
    runConversation();
  }

})();
