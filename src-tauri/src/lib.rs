use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const TOGGLE_SCRIPT: &str = include_str!("../inject/toggle.js");

// Сайты приложения + провайдеры входа (OAuth): Яндекс, MAX, VK ID, Mail.ru
const ALLOWED_DOMAINS: &[&str] = &[
    "gdebenz.ru",
    "gdebenz.org",
    "yandex.ru",
    "yandex.com",
    "yandex.net",
    "ya.ru",
    "max.ru",
    "oneme.ru",
    "vk.com",
    "vk.ru",
    "vkid.ru",
    "mail.ru",
    // Карты: Яндекс.Карты/Навигатор (yandex.ru покрыт выше), 2ГИС
    "2gis.ru",
    "2gis.com",
];

// Ссылки-приложения карт: на телефоне открывают установленное приложение,
// на компьютере превращаются в веб-версию карт
const MAP_SCHEMES: &[&str] = &["yandexmaps", "yandexnavi", "dgis"];

// Прочие внешние ссылки — всегда через системный обработчик
const EXTERNAL_SCHEMES: &[&str] = &["intent", "geo", "tel", "mailto"];

// Служебный путь: страница просит открыть ссылку в браузере по умолчанию
const OPEN_IN_BROWSER_PATH: &str = "/__gdebenz_open_browser";

fn allowed_host(host: &str) -> bool {
    ALLOWED_DOMAINS
        .iter()
        .any(|d| host == *d || host.ends_with(&format!(".{d}")))
}

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

                    if EXTERNAL_SCHEMES.contains(&scheme) {
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
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
                            url.host_str().is_some_and(allowed_host)
                        }
                        // tauri:// / about:blank and similar internal schemes
                        _ => true,
                    }
                });

            #[cfg(desktop)]
            let builder = builder
                .title("GdeBenz")
                .inner_size(1200.0, 800.0)
                .center();

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
