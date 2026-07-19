// GdeBenz: кнопки переключения gdebenz.ru/gdebenz.org и «Открыть в браузере»
(function () {
  if (window.__GDEBENZ_TOGGLE__) return;
  window.__GDEBENZ_TOGGLE__ = true;

  // Tauri не открывает всплывающие окна: вход через Яндекс/MAX, который сайт
  // открывает через window.open, ведём в этом же окне
  var nativeOpen = window.open ? window.open.bind(window) : null;
  window.open = function (url) {
    if (url) {
      location.href = url;
      return null;
    }
    return nativeOpen ? nativeOpen.apply(null, arguments) : null;
  };

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // iPhone: растягиваем страницу под нижнюю жест-полоску,
  // чтобы не оставалась белая полоса внизу
  ready(function () {
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      if (!/viewport-fit/.test(vp.content)) {
        vp.content += ', viewport-fit=cover';
      }
    } else {
      vp = document.createElement('meta');
      vp.name = 'viewport';
      vp.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
      document.head.appendChild(vp);
    }
  });

  // Кнопки показываем только на своих сайтах (не на странице входа Яндекса и т.п.)
  if (!/(^|\.)gdebenz\.(ru|org)$/.test(location.hostname)) return;

  // Блокировка рекламы — только внутри приложения
  var AD_SRC = /an\.yandex\.ru|ads\.adfox\.ru|adfox\.ru|yandexadexchange|doubleclick\.net|googlesyndication|googleadservices|adriver\.ru|buzzoola|relap\.io|adsbygoogle/i;
  var adCss = document.createElement('style');
  adCss.textContent =
    '[id^="yandex_rtb"],[id^="adfox"],[class^="adfox"],.adfox,ins.adsbygoogle,' +
    'iframe[src*="adfox"],iframe[src*="an.yandex.ru"],iframe[src*="doubleclick"],' +
    'iframe[src*="googlesyndication"]{display:none!important;visibility:hidden!important;height:0!important;}';
  document.documentElement.appendChild(adCss);
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var nodes = muts[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (!n.tagName) continue;
        if ((n.tagName === 'SCRIPT' || n.tagName === 'IFRAME') && AD_SRC.test(n.src || '')) {
          n.remove();
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Перезагрузка сайта при возврате в приложение — обновляет местоположение
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > 2000) {
      location.reload();
    }
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) location.reload();
  });

  function styleBtn(btn, side) {
    btn.type = 'button';
    btn.style.cssText = [
      'position:fixed',
      side + ':16px',
      'bottom:8px',
      'z-index:2147483647',
      'padding:10px 16px',
      'border-radius:999px',
      'border:1px solid #35e07f',
      'background:#0b0f14',
      'color:#35e07f',
      'font:600 14px/1 system-ui,-apple-system,sans-serif',
      'cursor:pointer',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)',
      'opacity:.92'
    ].join(';');
    btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function () { btn.style.opacity = '.92'; });
  }

  ready(function () {
    var isRu = /(^|\.)gdebenz\.ru$/.test(location.hostname);

    // Переключение .ru <-> .org
    var btn = document.createElement('button');
    btn.id = '__gdebenz_toggle_btn';
    btn.textContent = isRu ? '⇄ gdebenz.org' : '⇄ gdebenz.ru';
    btn.title = isRu
      ? 'Переключиться на gdebenz.org'
      : 'Переключиться на gdebenz.ru';
    styleBtn(btn, 'right');
    btn.addEventListener('click', function () {
      location.href = isRu ? 'https://gdebenz.org/' : 'https://gdebenz.ru/';
    });
    document.body.appendChild(btn);

    // Открыть текущую страницу в браузере по умолчанию
    var bbtn = document.createElement('button');
    bbtn.id = '__gdebenz_browser_btn';
    bbtn.textContent = '🌐 В браузере';
    bbtn.title = 'Открыть эту страницу в браузере по умолчанию';
    styleBtn(bbtn, 'left');
    bbtn.addEventListener('click', function () {
      location.href =
        location.origin +
        '/__gdebenz_open_browser?u=' +
        encodeURIComponent(location.href);
    });
    document.body.appendChild(bbtn);
  });
})();
