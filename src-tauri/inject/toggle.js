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
  // ВАЖНО: viewport-fit=cover НЕ ставим — иначе сайт залезает под чёлку/статус-бар
  // и кнопка «назад» вверху становится недоступной.

  // Настройки приложения (сохраняются между запусками)
  function pref(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function setPref(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var adOn = pref('gdebenz_adblock', '1') === '1';

  // Масштаб страницы (подгон под экран) — применяем сразу и при загрузке
  function applyZoom(z) {
    try { document.documentElement.style.zoom = (z / 100).toString(); } catch (e) {}
  }
  var curZoom = parseInt(pref('gdebenz_zoom', '100'), 10) || 100;
  applyZoom(curZoom);
  ready(function () { applyZoom(curZoom); });

  // Подгон под телефон: для моделей с чёлкой красим безопасные зоны тёмным,
  // чтобы не было белой полосы (сайт при этом НЕ залезает под чёлку)
  function applyDevice() {
    var d = pref('gdebenz_device', 'auto');
    var css = document.getElementById('__gb_device_css');
    if (!css) {
      css = document.createElement('style'); css.id = '__gb_device_css';
      (document.head || document.documentElement).appendChild(css);
    }
    css.textContent = (d === 'notch') ? 'html{background:#0b0f14;}' : '';
  }
  applyDevice();
  ready(applyDevice);

  // Держать экран включённым (Wake Lock) — не гаснуть во время просмотра
  var wakeLock = null;
  function refreshWakeLock() {
    var on = pref('gdebenz_wakelock', '0') === '1';
    try {
      if (on && navigator.wakeLock && document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }).catch(function () {});
      } else if (!on && wakeLock) {
        wakeLock.release().catch(function () {}); wakeLock = null;
      }
    } catch (e) {}
  }
  ready(refreshWakeLock);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refreshWakeLock();
  });

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

  // Сайт по умолчанию при запуске приложения (один раз за сессию)
  try {
    var startPref = pref('gdebenz_start', '');
    if (startPref && !sessionStorage.getItem('__gb_started')) {
      sessionStorage.setItem('__gb_started', '1');
      var onRuStart = /(^|\.)gdebenz\.ru$/.test(location.hostname);
      if (startPref === 'org' && onRuStart) { location.replace('https://gdebenz.org/'); return; }
      if (startPref === 'ru' && !onRuStart) { location.replace('https://gdebenz.ru/'); return; }
    } else {
      sessionStorage.setItem('__gb_started', '1');
    }
  } catch (e) {}

  // Перезагрузка сайта при возврате в приложение — обновляет местоположение
  if (pref('gdebenz_autoreload', '1') === '1') {
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
  }

  var btnSize = pref('gdebenz_btnsize', 'normal');
  var SIZE = {
    small: { pad: '4px 8px', font: '11px' },
    normal: { pad: '6px 10px', font: '12px' },
    large: { pad: '9px 14px', font: '15px' }
  };
  function styleBtn(btn, side) {
    var s = SIZE[btnSize] || SIZE.normal;
    btn.type = 'button';
    btn.style.cssText = [
      'position:fixed',
      side + ':8px',
      // в самом низу экрана
      'bottom:0px',
      'z-index:2147483647',
      'padding:' + s.pad,
      'border-radius:999px',
      'border:1px solid #35e07f',
      'background:#0b0f14',
      'color:#35e07f',
      'font:600 ' + s.font + '/1 system-ui,-apple-system,sans-serif',
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

    // Полноэкранное окно настроек
    var overlay = document.createElement('div');
    overlay.id = '__gdebenz_settings';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647', 'display:none',
      'background:#0b0f14', 'color:#e6f5ec', 'overflow:auto',
      '-webkit-overflow-scrolling:touch',
      'font:400 15px/1.4 system-ui,-apple-system,sans-serif'
    ].join(';');
    document.body.appendChild(overlay);

    function closeSettings() { overlay.style.display = 'none'; }
    function openSettings() { overlay.style.display = 'block'; overlay.scrollTop = 0; }

    var wrap = document.createElement('div');
    wrap.style.cssText = 'max-width:680px;margin:0 auto;padding:calc(16px + env(safe-area-inset-top,0px)) 18px calc(40px + env(safe-area-inset-bottom,0px));';
    overlay.appendChild(wrap);

    // Шапка
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
    var h1 = document.createElement('div');
    h1.textContent = 'Настройки';
    h1.style.cssText = 'font:800 26px/1 system-ui,-apple-system,sans-serif;color:#fff;';
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.style.cssText = 'width:40px;height:40px;border-radius:50%;border:1px solid #23402f;background:#10121a;color:#35e07f;font-size:18px;cursor:pointer;';
    close.addEventListener('click', closeSettings);
    head.appendChild(h1);
    head.appendChild(close);
    wrap.appendChild(head);

    function section(title) {
      var s = document.createElement('div');
      s.textContent = title;
      s.style.cssText = 'text-transform:uppercase;font:700 12px/1 system-ui;color:#6b8b7a;letter-spacing:.05em;margin:22px 4px 10px;';
      wrap.appendChild(s);
    }
    function card() {
      var c = document.createElement('div');
      c.style.cssText = 'background:#10121a;border:1px solid #1e3226;border-radius:14px;overflow:hidden;';
      wrap.appendChild(c);
      return c;
    }
    function bigRow(parent, label, value, onClick) {
      var r = document.createElement('button');
      r.type = 'button';
      r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;padding:16px;border:0;border-top:1px solid #17271d;background:transparent;color:#e6f5ec;font:600 16px/1.2 system-ui;cursor:pointer;text-align:left;';
      var l = document.createElement('span'); l.textContent = label;
      var v = document.createElement('span'); v.textContent = value || ''; v.style.cssText = 'color:#35e07f;font-weight:700;';
      r.appendChild(l); r.appendChild(v);
      if (onClick) r.addEventListener('click', onClick);
      parent.appendChild(r);
      return r;
    }

    // --- Масштаб страницы (подгон под экран / «разрешение») ---
    section('Экран');
    var zc = card();
    var zoomWrap = document.createElement('div');
    zoomWrap.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:12px;';
    var zoomLabel = document.createElement('div');
    zoomLabel.style.cssText = 'font:600 16px/1.2 system-ui;';
    zoomLabel.textContent = 'Масштаб страницы: ' + curZoom + '%';
    var zoomRow = document.createElement('div');
    zoomRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    [75, 90, 100, 110, 125, 150].forEach(function (z) {
      var zb = document.createElement('button');
      zb.type = 'button';
      zb.textContent = z + '%';
      zb.style.cssText = 'flex:1;min-width:60px;padding:12px 0;border-radius:10px;border:1px solid ' +
        (z === curZoom ? '#35e07f' : '#23402f') + ';background:' + (z === curZoom ? '#12291d' : '#0b0f14') +
        ';color:#35e07f;font:700 15px system-ui;cursor:pointer;';
      zb.addEventListener('click', function () {
        curZoom = z; setPref('gdebenz_zoom', String(z)); applyZoom(z);
        zoomLabel.textContent = 'Масштаб страницы: ' + z + '%';
        Array.prototype.forEach.call(zoomRow.children, function (c) {
          var cz = parseInt(c.textContent, 10);
          c.style.borderColor = cz === z ? '#35e07f' : '#23402f';
          c.style.background = cz === z ? '#12291d' : '#0b0f14';
        });
      });
      zoomRow.appendChild(zb);
    });
    zoomWrap.appendChild(zoomLabel);
    zoomWrap.appendChild(zoomRow);
    zc.appendChild(zoomWrap);

    // --- Экран телефона (подбор под модель) ---
    section('Экран телефона');
    var dc = card();
    var curDev = pref('gdebenz_device', 'auto');
    function pickDevice(key, zoom) {
      setPref('gdebenz_device', key);
      setPref('gdebenz_zoom', String(zoom));
      location.reload();
    }
    bigRow(dc, 'Авто', curDev === 'auto' ? '✓' : '', function () { pickDevice('auto', 100); });
    bigRow(dc, 'iPhone mini / SE (мелкий экран)', curDev === 'mini' ? '✓' : '', function () { pickDevice('mini', 90); });
    bigRow(dc, 'iPhone с чёлкой (XR, 11–15)', curDev === 'notch' ? '✓' : '', function () { pickDevice('notch', 110); });
    bigRow(dc, 'Компьютер / большой экран', curDev === 'pc' ? '✓' : '', function () { pickDevice('pc', 100); });
    var devNote = document.createElement('div');
    devNote.style.cssText = 'padding:12px 16px;color:#8fb5a1;font:400 13px/1.5 system-ui;';
    devNote.textContent = 'Выберите ваш телефон — приложение подберёт масштаб и уберёт белую полосу. Если что-то мелкое или крупное — подстройте «Масштаб страницы» выше.';
    dc.appendChild(devNote);

    // --- Приложение ---
    section('Приложение');
    var ac = card();
    bigRow(ac, 'Кнопки по краям', hideBtns ? 'скрыты' : 'показаны', function () {
      setPref('gdebenz_hide', hideBtns ? '0' : '1'); location.reload();
    });
    bigRow(ac, 'Блокировка рекламы', adOn ? 'вкл' : 'выкл', function () {
      setPref('gdebenz_adblock', adOn ? '0' : '1'); location.reload();
    });
    bigRow(ac, 'Доступ к геолокации', 'запросить', function () {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function () {
          alert('Геолокация разрешена');
        }, function () {
          alert('Геолокация отклонена или недоступна');
        }, { timeout: 8000 });
      }
    });

    // --- Сайт ---
    section('Сайт');
    var sc = card();
    bigRow(sc, 'Текущий сайт', isRu ? 'gdebenz.ru' : 'gdebenz.org', null);
    bigRow(sc, isRu ? 'Переключить на gdebenz.org' : 'Переключить на gdebenz.ru', '⇄', function () {
      location.href = isRu ? 'https://gdebenz.org/' : 'https://gdebenz.ru/';
    });
    bigRow(sc, 'Открыть в браузере', '🌐', function () {
      location.href = location.origin + '/__gdebenz_open_browser?u=' + encodeURIComponent(location.href);
    });

    var startNow = pref('gdebenz_start', '');
    bigRow(sc, 'Сайт при запуске',
      startNow === 'org' ? 'gdebenz.org' : (startNow === 'ru' ? 'gdebenz.ru' : 'как есть'),
      function () {
        var next = startNow === '' ? 'ru' : (startNow === 'ru' ? 'org' : '');
        setPref('gdebenz_start', next);
        this.querySelector('span:last-child').textContent =
          next === 'org' ? 'gdebenz.org' : (next === 'ru' ? 'gdebenz.ru' : 'как есть');
        startNow = next;
      });

    // --- Поведение ---
    section('Поведение');
    var bc = card();
    bigRow(bc, 'Обновлять при возврате', pref('gdebenz_autoreload', '1') === '1' ? 'вкл' : 'выкл', function () {
      setPref('gdebenz_autoreload', pref('gdebenz_autoreload', '1') === '1' ? '0' : '1'); location.reload();
    });
    bigRow(bc, 'Не гасить экран', pref('gdebenz_wakelock', '0') === '1' ? 'вкл' : 'выкл', function () {
      setPref('gdebenz_wakelock', pref('gdebenz_wakelock', '0') === '1' ? '0' : '1');
      refreshWakeLock();
      this.querySelector('span:last-child').textContent = pref('gdebenz_wakelock', '0') === '1' ? 'вкл' : 'выкл';
    });
    bigRow(bc, 'Размер кнопок',
      btnSize === 'small' ? 'маленькие' : (btnSize === 'large' ? 'крупные' : 'обычные'),
      function () {
        var order = ['small', 'normal', 'large'];
        var next = order[(order.indexOf(btnSize) + 1) % order.length];
        setPref('gdebenz_btnsize', next); location.reload();
      });

    // --- Сброс ---
    section('Прочее');
    var rc = card();
    bigRow(rc, 'Сбросить настройки приложения', '↺', function () {
      if (confirm('Сбросить все настройки приложения к значениям по умолчанию?')) {
        try {
          ['gdebenz_zoom', 'gdebenz_hide', 'gdebenz_adblock', 'gdebenz_autoreload',
           'gdebenz_wakelock', 'gdebenz_btnsize', 'gdebenz_start'].forEach(function (k) {
            localStorage.removeItem(k);
          });
        } catch (e) {}
        location.reload();
      }
    });

    var note = document.createElement('div');
    note.style.cssText = 'margin-top:22px;padding:14px 16px;border-radius:12px;background:#0f1f16;color:#8fb5a1;font:400 13px/1.5 system-ui;';
    note.textContent = 'GdeBenz — приложение для сайта gdebenz.ru / gdebenz.org. Настройки сохраняются на этом устройстве.';
    wrap.appendChild(note);

    gear.addEventListener('click', function (e) {
      e.stopPropagation();
      if (overlay.style.display === 'none') openSettings(); else closeSettings();
    });
  });
})();
