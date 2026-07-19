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

  // Разрешаем прокрутку вверх/вниз, НЕ ломая полноэкранную карту
  // (не трогаем height/position — только снимаем запрет прокрутки)
  var scrollCss = document.createElement('style');
  scrollCss.textContent =
    'html,body{overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;' +
    'overscroll-behavior-y:auto!important;}';
  (document.head || document.documentElement).appendChild(scrollCss);

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

  // Настройки приложения (сохраняются между запусками)
  function pref(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var adOn = pref('gdebenz_adblock', '1') === '1';

  // ---------------------------------------------------------------
  // Блокировщик рекламы (можно выключить в меню ⚙)
  // ---------------------------------------------------------------
  if (adOn) {
  // Основные рекламные и трекинговые сети рунета и мира
  var AD_SRC = new RegExp(
    [
      'an\\.yandex\\.ru', 'ads\\.adfox\\.ru', 'adfox\\.ru', 'yandexadexchange',
      'yandex\\.ru/ads', 'mc\\.yandex\\.ru', 'yastatic\\.net/pcode',
      'doubleclick\\.net', 'googlesyndication', 'googleadservices',
      'google-analytics\\.com', 'googletagmanager\\.com', 'googletagservices',
      'adsbygoogle', 'pagead2?\\.',
      'ad\\.mail\\.ru', 'rtb\\.mail\\.ru', 'top-fwz1\\.mail\\.ru', 'r\\.mradx\\.net',
      'ads\\.vk\\.com', 'mytarget',
      'adriver\\.ru', 'buzzoola', 'relap\\.io', 'criteo\\.(com|net)',
      'betweendigital', 'otm-r\\.com', 'ssp\\.rambler\\.ru', 'adsniper',
      'videonow\\.ru', 'tns-counter\\.ru', 'adhigh\\.net', 'hybrid\\.ai',
      'luxup\\.ru', 'sape\\.ru', 'directadvert', 'marketgid', 'mgid\\.com',
      'yadro\\.ru', 'admitad', 'gdeslon', 'cityads', 'exoclick', 'propellerads',
      'popunder', 'clickunder', 'teasernet', 'smi2\\.ru', 'infox\\.sg'
    ].join('|'),
    'i'
  );

  function isAdUrl(u) {
    return u && AD_SRC.test(String(u));
  }

  // 1) Не даём вставлять рекламные скрипты и фреймы (перехват src)
  function guardSrc(proto) {
    try {
      var d = Object.getOwnPropertyDescriptor(proto, 'src');
      if (!d || !d.set) return;
      Object.defineProperty(proto, 'src', {
        get: d.get,
        set: function (v) {
          d.set.call(this, isAdUrl(v) ? 'about:blank' : v);
        },
        configurable: true
      });
    } catch (e) {}
  }
  guardSrc(HTMLScriptElement.prototype);
  guardSrc(HTMLIFrameElement.prototype);
  try {
    var origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (String(name).toLowerCase() === 'src' && isAdUrl(value) &&
          (this.tagName === 'SCRIPT' || this.tagName === 'IFRAME')) {
        value = 'about:blank';
      }
      return origSetAttr.call(this, name, value);
    };
  } catch (e) {}

  // 2) Блокируем сетевые запросы к рекламным доменам
  try {
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function (input) {
        var u = input && input.url ? input.url : input;
        if (isAdUrl(u)) {
          return Promise.reject(new TypeError('blocked by app'));
        }
        return origFetch.apply(this, arguments);
      };
    }
  } catch (e) {}
  try {
    var origOpen2 = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__adBlocked = isAdUrl(url);
      return origOpen2.apply(this, arguments);
    };
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      if (this.__adBlocked) {
        try { this.abort(); } catch (e) {}
        return;
      }
      return origSend.apply(this, arguments);
    };
  } catch (e) {}

  // 3) Прячем рекламные контейнеры (включая баннеры самого сайта)
  var adCss = document.createElement('style');
  adCss.textContent =
    '[id^="yandex_rtb"],[id^="adfox"],[class^="adfox"],.adfox,ins.adsbygoogle,' +
    'iframe[src*="adfox"],iframe[src*="an.yandex.ru"],iframe[src*="doubleclick"],' +
    'iframe[src*="googlesyndication"],iframe[src*="ads.vk.com"],iframe[src*="mytarget"],' +
    '[id^="admixer"],[class*="ad-banner"],[class*="advert-block"],' +
    '.sg-banner,.rs-ad,.seo-ad-article' +
    '{display:none!important;visibility:hidden!important;height:0!important;}';
  document.documentElement.appendChild(adCss);

  // 4) Вырезаем то, что всё же просочилось
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var nodes = muts[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (!n.tagName) continue;
        if ((n.tagName === 'SCRIPT' || n.tagName === 'IFRAME') && isAdUrl(n.src)) {
          n.remove();
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  } // if (adOn)

  // Кнопки показываем только на своих сайтах (не на странице входа Яндекса и т.п.)
  if (!/(^|\.)gdebenz\.(ru|org)$/.test(location.hostname)) return;

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
      side + ':8px',
      // в самом низу экрана
      'bottom:0px',
      'z-index:2147483647',
      'padding:6px 10px',
      'border-radius:999px',
      'border:1px solid #35e07f',
      'background:#0b0f14',
      'color:#35e07f',
      'font:600 12px/1 system-ui,-apple-system,sans-serif',
      'cursor:pointer',
      'box-shadow:0 4px 14px rgba(0,0,0,.35)',
      'opacity:.92'
    ].join(';');
    btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function () { btn.style.opacity = '.92'; });
  }

  ready(function () {
    var isRu = /(^|\.)gdebenz\.ru$/.test(location.hostname);
    var hideBtns = pref('gdebenz_hide', '0') === '1';

    // Две боковые кнопки — только если не скрыты через меню
    if (!hideBtns) {
      // Переключение .ru <-> .org (справа)
      var btn = document.createElement('button');
      btn.id = '__gdebenz_toggle_btn';
      btn.textContent = isRu ? '⇄ gdebenz.org' : '⇄ gdebenz.ru';
      btn.title = isRu ? 'Переключиться на gdebenz.org' : 'Переключиться на gdebenz.ru';
      styleBtn(btn, 'right');
      btn.addEventListener('click', function () {
        location.href = isRu ? 'https://gdebenz.org/' : 'https://gdebenz.ru/';
      });
      document.body.appendChild(btn);

      // Открыть в браузере по умолчанию (слева)
      var bbtn = document.createElement('button');
      bbtn.id = '__gdebenz_browser_btn';
      bbtn.textContent = '🌐 В браузере';
      bbtn.title = 'Открыть эту страницу в браузере по умолчанию';
      styleBtn(bbtn, 'left');
      bbtn.addEventListener('click', function () {
        location.href =
          location.origin + '/__gdebenz_open_browser?u=' + encodeURIComponent(location.href);
      });
      document.body.appendChild(bbtn);
    }

    // Маленькая центральная кнопка настроек (⚙)
    var gear = document.createElement('button');
    gear.id = '__gdebenz_gear_btn';
    gear.type = 'button';
    gear.textContent = '⚙';
    gear.title = 'Настройки приложения';
    gear.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:0px', 'transform:translateX(-50%)',
      'z-index:2147483647', 'width:32px', 'height:32px', 'border-radius:50%',
      'border:1px solid #35e07f', 'background:#0b0f14', 'color:#35e07f',
      'font-size:15px', 'line-height:30px', 'padding:0', 'text-align:center',
      'cursor:pointer', 'box-shadow:0 4px 14px rgba(0,0,0,.35)', 'opacity:.9'
    ].join(';');
    document.body.appendChild(gear);

    // Панель меню
    var panel = document.createElement('div');
    panel.id = '__gdebenz_panel';
    panel.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:42px', 'transform:translateX(-50%)',
      'z-index:2147483647', 'display:none', 'width:230px', 'box-sizing:border-box',
      'background:#0b0f14', 'border:1px solid #35e07f', 'border-radius:12px',
      'padding:8px', 'box-shadow:0 6px 22px rgba(0,0,0,.5)',
      'font:600 13px/1.2 system-ui,-apple-system,sans-serif'
    ].join(';');
    document.body.appendChild(panel);

    function row(label, onClick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = [
        'display:block', 'width:100%', 'text-align:left', 'margin:4px 0',
        'padding:9px 10px', 'border-radius:8px', 'border:1px solid #23402f',
        'background:#10121a', 'color:#35e07f', 'font:inherit', 'cursor:pointer'
      ].join(';');
      b.addEventListener('click', onClick);
      panel.appendChild(b);
      return b;
    }

    row(hideBtns ? '↔ Показать кнопки по краям' : '↔ Скрыть кнопки по краям', function () {
      setPref('gdebenz_hide', hideBtns ? '0' : '1');
      location.reload();
    });
    row('🛡 Реклама: ' + (adOn ? 'блокируется' : 'показывается'), function () {
      setPref('gdebenz_adblock', adOn ? '0' : '1');
      location.reload();
    });
    row('📍 Разрешить геолокацию', function () {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function () {}, function () {}, { timeout: 8000 });
      }
      panel.style.display = 'none';
    });
    row(isRu ? '⇄ Открыть gdebenz.org' : '⇄ Открыть gdebenz.ru', function () {
      location.href = isRu ? 'https://gdebenz.org/' : 'https://gdebenz.ru/';
    });

    gear.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', function (e) {
      if (e.target !== gear && !panel.contains(e.target)) panel.style.display = 'none';
    });
  });
})();
