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

  // Кнопки показываем только на своих сайтах (не на странице входа Яндекса и т.п.)
  if (!/(^|\.)gdebenz\.(ru|org)$/.test(location.hostname)) return;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function styleBtn(btn, bottom) {
    btn.type = 'button';
    btn.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:' + bottom + 'px',
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
    styleBtn(btn, 16);
    btn.addEventListener('click', function () {
      location.href = isRu ? 'https://gdebenz.org/' : 'https://gdebenz.ru/';
    });
    document.body.appendChild(btn);

    // Открыть текущую страницу в браузере по умолчанию
    var bbtn = document.createElement('button');
    bbtn.id = '__gdebenz_browser_btn';
    bbtn.textContent = '🌐 В браузере';
    bbtn.title = 'Открыть эту страницу в браузере по умолчанию';
    styleBtn(bbtn, 64);
    bbtn.addEventListener('click', function () {
      location.href =
        location.origin +
        '/__gdebenz_open_browser?u=' +
        encodeURIComponent(location.href);
    });
    document.body.appendChild(bbtn);
  });
})();
