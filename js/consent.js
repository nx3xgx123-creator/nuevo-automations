/* Cookie consent + gated Meta Pixel loading.
 *
 * The pixel is deliberately NOT in the page markup. It is injected here only
 * after consent is granted, so declining actually prevents tracking rather
 * than just hiding a banner. Lead handlers elsewhere already guard on
 * `typeof fbq === 'function'`, so they no-op until this runs.
 */
(function () {
  'use strict';

  var PIXEL_ID = '997785509848718';
  var STORE_KEY = 'nuevo-consent';

  function read() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(STORE_KEY, v); } catch (e) {}
  }

  function loadPixel() {
    if (window.fbq) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function injectStyles() {
    if (document.getElementById('consent-styles')) return;
    var css = ''
      + '.consent{position:fixed;left:16px;right:16px;bottom:16px;z-index:400;'
      + 'max-width:640px;margin:0 auto;padding:20px 22px;border-radius:18px;'
      + 'background:rgba(10,25,48,.82);border:1px solid rgba(255,255,255,.16);'
      + 'backdrop-filter:blur(22px) saturate(170%);-webkit-backdrop-filter:blur(22px) saturate(170%);'
      + 'box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 24px 60px -24px rgba(0,0,0,.9);'
      + 'color:#e8eef8;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;'
      + 'transform:translateY(140%);transition:transform .45s cubic-bezier(.22,1,.36,1)}'
      + '.consent.is-in{transform:none}'
      + '.consent p{margin:0 0 16px;font-size:.92rem;line-height:1.55;color:#c3d1e4}'
      + '.consent a{color:#7fd4e8;text-decoration:underline;text-underline-offset:3px}'
      + '.consent-row{display:flex;gap:10px;flex-wrap:wrap}'
      + '.consent-btn{flex:1 1 auto;min-width:130px;padding:11px 18px;border-radius:999px;'
      + 'font-size:.88rem;font-weight:600;cursor:pointer;font-family:inherit;'
      + 'transition:background .2s,border-color .2s,transform .2s}'
      + '.consent-btn:hover{transform:translateY(-1px)}'
      + '.consent-yes{background:linear-gradient(160deg,rgba(63,168,189,.85),rgba(31,107,122,.8));'
      + 'color:#fff;border:1px solid rgba(255,255,255,.3);'
      + 'box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}'
      + '.consent-no{background:rgba(255,255,255,.07);color:#dce6f2;border:1px solid rgba(255,255,255,.18)}'
      + '.consent-no:hover{background:rgba(255,255,255,.13)}'
      + '@media (prefers-reduced-motion:reduce){.consent{transition:none}}';
    var el = document.createElement('style');
    el.id = 'consent-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function banner() {
    injectStyles();
    var box = document.createElement('div');
    box.className = 'consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Cookie consent');
    box.innerHTML =
      '<p>We use cookies to measure how our ads perform. You can decline and still ' +
      'use the site normally. See our <a href="/privacy/">Privacy Policy</a>.</p>' +
      '<div class="consent-row">' +
      '<button type="button" class="consent-btn consent-yes">Accept</button>' +
      '<button type="button" class="consent-btn consent-no">Decline</button>' +
      '</div>';
    document.body.appendChild(box);
    // setTimeout, not requestAnimationFrame: rAF is paused in background or
    // non-compositing tabs, which would leave the banner parked off-screen
    // and effectively invisible.
    setTimeout(function () { box.classList.add('is-in'); }, 60);

    function close(choice) {
      write(choice);
      box.classList.remove('is-in');
      setTimeout(function () { box.remove(); }, 450);
      if (choice === 'granted') loadPixel();
    }
    box.querySelector('.consent-yes').addEventListener('click', function () { close('granted'); });
    box.querySelector('.consent-no').addEventListener('click', function () { close('denied'); });
  }

  var choice = read();
  if (choice === 'granted') {
    loadPixel();
  } else if (choice !== 'denied') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', banner);
    } else {
      banner();
    }
  }

  window.NuevoConsent = {
    state: function () { return read(); },
    reset: function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    }
  };
}());
