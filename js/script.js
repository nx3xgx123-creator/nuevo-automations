(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    } else {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

      revealEls.forEach(function (el) { observer.observe(el); });
    }
  }

  /* ---- Particle canvas ---- */
  (function () {
    var canvas = document.getElementById('particle-canvas');
    if (!canvas || prefersReducedMotion) return;

    var ctx = canvas.getContext('2d');
    var W, H, rafId;
    var pts = [];
    var NUM = 65;
    var LINK = 130;

    function Pt() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.r  = Math.random() * 1.4 + 0.4;
      this.a  = Math.random() * 0.35 + 0.08;
    }

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function tick() {
      rafId = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(95,184,204,' + p.a + ')';
        ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j];
          var dx = p.x - q.x, dy = p.y - q.y;
          var d  = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(95,184,204,' + ((1 - d / LINK) * 0.1) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    window.addEventListener('resize', resize);
    resize();
    for (var i = 0; i < NUM; i++) pts.push(new Pt());
    setTimeout(tick, 400);
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
