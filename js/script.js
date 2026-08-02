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

  // Stagger direct children of grid containers by 80ms each (motion only).
  if (!prefersReducedMotion) {
    document.querySelectorAll('.reveal-stagger').forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.style.transitionDelay = (i * 80) + 'ms';
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
            // Clear the stagger delay once revealed so it never lags later
            // transitions (e.g. hover lift on pricing cards).
            if (el.classList.contains('reveal-stagger')) {
              var kids = el.children;
              setTimeout(function () {
                Array.prototype.forEach.call(kids, function (c) {
                  c.style.transitionDelay = '';
                });
              }, (kids.length * 80) + 700);
            }
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

  /* ---- Hero headline: word-by-word reveal on load ---- */
  (function () {
    if (prefersReducedMotion) return;
    var h1 = document.querySelector('.hero h1');
    if (!h1) return;
    var idx = 0;
    (function wrap(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          // text node — split into words, preserve whitespace (incl. &nbsp;)
          var parts = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (part === '') return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            var w = document.createElement('span');
            w.className = 'hero-word';
            w.textContent = part;
            w.style.animationDelay = (idx * 90) + 'ms';
            idx++;
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          // element (e.g. .text-teal span) — recurse, keep <br> intact
          wrap(child);
        }
      });
    }(h1));
    h1.classList.add('hero-words-ready');
  }());

  /* ---- Stat counter: count up when stats bar enters view ---- */
  (function () {
    var bar = document.querySelector('.hero-stats');
    if (!bar || prefersReducedMotion || !('IntersectionObserver' in window)) return;
    var nums = bar.querySelectorAll('strong');

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function run(el) {
      var full = el.textContent;
      var m = full.match(/\d[\d,]*/);
      if (!m) return;
      var target = parseInt(m[0].replace(/,/g, ''), 10);
      if (isNaN(target)) return;
      var prefix = full.slice(0, m.index);
      var suffix = full.slice(m.index + m[0].length);
      var dur = 1000, startTs = null;
      function step(ts) {
        if (startTs === null) startTs = ts;
        var p = Math.min((ts - startTs) / dur, 1);
        el.textContent = prefix + Math.round(easeOutCubic(p) * target) + suffix;
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = full;
      }
      requestAnimationFrame(step);
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          nums.forEach(run);
          io.disconnect();
        }
      });
    }, { threshold: 0.5 });
    io.observe(bar);
  }());

  /* ---- Button click ripple ---- */
  (function () {
    if (prefersReducedMotion) return;
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.btn-primary, .btn-whatsapp');
      if (!btn) return;
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      var ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 620);
    });
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

  /* ---- 3D card tilt + cursor spotlight ---- */
  (function () {
    if (prefersReducedMotion) return;
    var els = document.querySelectorAll('.card, .feature, .who-card, .step');
    els.forEach(function (el) {
      var spot = document.createElement('div');
      spot.className = 'card-spotlight';
      el.insertBefore(spot, el.firstChild);

      el.addEventListener('mousemove', function (e) {
        var r  = el.getBoundingClientRect();
        var x  = e.clientX - r.left;
        var y  = e.clientY - r.top;
        var rx = ((y - r.height / 2) / (r.height / 2)) * -6;
        var ry = ((x - r.width  / 2) / (r.width  / 2)) *  6;
        el.style.transition = 'border-color 260ms var(--ease), background 260ms var(--ease), box-shadow 260ms var(--ease)';
        el.style.transform  = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateY(-4px)';
        spot.style.setProperty('--mx', x + 'px');
        spot.style.setProperty('--my', y + 'px');
        spot.style.opacity = '1';
      });

      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform 500ms var(--ease), border-color 260ms var(--ease), background 260ms var(--ease), box-shadow 260ms var(--ease)';
        el.style.transform  = '';
        spot.style.opacity  = '0';
      });
    });
  }());

  /* ---- Magnetic buttons ---- */
  (function () {
    if (prefersReducedMotion) return;
    document.querySelectorAll('.btn-primary, .btn-whatsapp').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width  / 2) * 0.22;
        var y = (e.clientY - r.top  - r.height / 2) * 0.22;
        btn.style.transform = 'translateY(-2px) translate(' + x + 'px,' + y + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }());

  /* ---- Hero scroll parallax ---- */
  (function () {
    if (prefersReducedMotion) return;
    var copy   = document.querySelector('.hero-copy');
    var visual = document.querySelector('.hero-visual');
    var hero   = document.querySelector('.hero');
    if (!copy || !visual || !hero) return;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset;
        if (y <= hero.offsetHeight + 120) {
          copy.style.transform   = 'translateY(' + (y * 0.12) + 'px)';
          visual.style.transform = 'translateY(' + (y * 0.07) + 'px)';
        }
        ticking = false;
      });
    }, { passive: true });
  }());

})();
