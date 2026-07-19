use tauri::{WebviewUrl, WebviewWindowBuilder};
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

// Ссылки-приложения карт: открываем установленное приложение, а не webview
const EXTERNAL_SCHEMES: &[&str] = &[
    "yandexmaps", "yandexnavi", "dgis", "intent", "geo", "tel", "mailto",
];

fn allowed_host(host: &str) -> bool {
    ALLOWED_DOMAINS
        .iter()
        .any(|d| host == *d || host.ends_with(&format!(".{d}")))
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
                    if EXTERNAL_SCHEMES.contains(&scheme) {
                        let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                        return false;
                    }
                    match scheme {
                        "https" | "http" => url.host_str().is_some_and(allowed_host),
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
