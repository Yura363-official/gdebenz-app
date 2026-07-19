use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const TOGGLE_SCRIPT: &str = include_str!("../inject/toggle.js");

// Перед каждой повторной вставкой проверяем, есть ли уже наши кнопки.
// Если кнопки почему-то не появились (гонка с загрузкой DOM), сбрасываем
// флаг защиты от повторного запуска, чтобы TOGGLE_SCRIPT отработал заново.
const HEAL_SCRIPT: &str = "(function(){try{if(!document.getElementById('__gdebenz_gear_btn')){window.__GDEBENZ_TOGGLE__=false;}}catch(e){}})();";

// Ссылки-приложения карт: на телефоне открывают установленное приложение,
// на компьютере превращаются в веб-версию карт
const MAP_SCHEMES: &[&str] = &["yandexmaps", "yandexnavi", "dgis"];

// Внутренние схемы webview — обрабатываются самим окном
const INTERNAL_SCHEMES: &[&str] = &["tauri", "about", "data", "blob", "asset"];

// Служебный путь: страница просит открыть ссылку в браузере по умолчанию
const OPEN_IN_BROWSER_PATH: &str = "/__gdebenz_open_browser";

// Веб-эквивалент ссылки-приложения карт (для компьютера)
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn map_scheme_to_web(url: &tauri::Url) -> String {
    let q = url.query().unwrap_or("");
    match url.scheme() {
        "yandexnavi" => {
            let mut lat = None;
            let mut lon = None;
            for (k, v) in url.query_pairs() {
                match k.as_ref() {
                    "lat_to" => lat = Some(v.into_owned()),
                    "lon_to" => lon = Some(v.into_owned()),
                    _ => {}
                }
            }
            if let (Some(lat), Some(lon)) = (lat, lon) {
                format!("https://yandex.ru/maps/?rtext=~{lat}%2C{lon}&rtt=auto")
            } else {
                "https://yandex.ru/maps/".to_string()
            }
        }
        "dgis" => {
            let host = url.host_str().unwrap_or("2gis.ru");
            let path = url.path();
            if q.is_empty() {
                format!("https://{host}{path}")
            } else {
                format!("https://{host}{path}?{q}")
            }
        }
        // yandexmaps://maps.yandex.ru/?rtext=... — параметры совместимы с веб-картами
        _ => {
            if q.is_empty() {
                "https://yandex.ru/maps/".to_string()
            } else {
                format!("https://yandex.ru/maps/?{q}")
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let url: tauri::Url = "https://gdebenz.ru/".parse().unwrap();
            let handle = app.handle().clone();
            let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .initialization_script(TOGGLE_SCRIPT)
                // Android не всегда инъектит initialization_script во внешние
                // страницы — дублируем вставку скрипта при загрузке страницы.
                // Скрипт сам защищён от повторного запуска (флаг __GDEBENZ_TOGGLE__).
                .on_page_load(|webview, _payload| {
                    let _ = webview.eval(TOGGLE_SCRIPT);
                })
                .on_navigation(move |url| {
                    let scheme = url.scheme();

                    if MAP_SCHEMES.contains(&scheme) {
                        #[cfg(any(target_os = "android", target_os = "ios"))]
                        {
                            // Телефон: открываем приложение карт
                            let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                        }
                        #[cfg(not(any(target_os = "android", target_os = "ios")))]
                        {
                            // Компьютер: показываем веб-версию карт в этом окне
                            let web = map_scheme_to_web(url);
                            let h = handle.clone();
                            let _ = handle.run_on_main_thread(move || {
                                if let Some(mut w) = h.get_webview_window("main") {
                                    if let Ok(u) = web.parse() {
                                        let _ = w.navigate(u);
                                    }
                                }
                            });
                        }
                        return false;
                    }

                    match scheme {
                        "https" | "http" => {
                            // Кнопка «Открыть в браузере»
                            if url.path() == OPEN_IN_BROWSER_PATH {
                                if let Some(target) = url
                                    .query_pairs()
                                    .find(|(k, _)| k == "u")
                                    .map(|(_, v)| v.into_owned())
                                {
                                    let _ = handle.opener().open_url(target, None::<&str>);
                                }
                                return false;
                            }
                            // Любые сайты открываются свободно
                            true
                        }
                        s if INTERNAL_SCHEMES.contains(&s) => true,
                        // Любая другая схема (max://, tg://, intent://, tel:, mailto: …)
                        // — открываем соответствующее приложение
                        _ => {
                            let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                            false
                        }
                    }
                });

            #[cfg(desktop)]
            let builder = builder
                .title("GdeBenz")
                .inner_size(1200.0, 800.0)
                .center();

            builder.build()?;

            // Гарантированная вставка кнопок на ВСЕХ платформах.
            // КЛЮЧЕВОЕ: eval во WebView обязан выполняться в главном (UI) потоке.
            // На Android вызов eval из фонового потока молча НЕ срабатывает —
            // именно поэтому раньше кнопки появлялись только на iPhone.
            // Здесь фоновый поток лишь отсчитывает время, а сам eval мы
            // отправляем в главный поток через run_on_main_thread.
            let inject_handle = app.handle().clone();
            std::thread::spawn(move || {
                for i in 0..80 {
                    // первые ~10 секунд — часто, дальше реже (для переходов по сайту)
                    let ms = if i < 20 { 400 } else { 2000 };
                    std::thread::sleep(std::time::Duration::from_millis(ms));
                    let h = inject_handle.clone();
                    let _ = inject_handle.run_on_main_thread(move || {
                        if let Some(w) = h.get_webview_window("main") {
                            let _ = w.eval(HEAL_SCRIPT);
                            let _ = w.eval(TOGGLE_SCRIPT);
                        }
                    });
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
