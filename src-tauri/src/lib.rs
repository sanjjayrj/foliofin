use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use compress_tools::{list_archive_files, uncompress_archive_file};
use std::io::Cursor;
use tauri::Manager;

/// Extract all image pages from a CBR/RAR archive stored in AppData.
/// `relative_path` is relative to AppData (e.g. "books/{id}.cbr").
/// Returns Vec of (filename, data-url) pairs sorted by filename.
#[tauri::command]
async fn extract_cbr_pages(
    app: tauri::AppHandle,
    relative_path: String,
) -> Result<Vec<(String, String)>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let file_path = app_data.join(&relative_path);

    let data = std::fs::read(&file_path)
        .map_err(|e| format!("Cannot read CBR: {}", e))?;

    let image_exts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif"];

    let mut cursor = Cursor::new(&data);
    let entries = list_archive_files(&mut cursor)
        .map_err(|e| format!("Cannot list archive: {}", e))?;

    let mut image_files: Vec<String> = entries
        .into_iter()
        .filter(|name| {
            let ext = std::path::Path::new(name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            image_exts.contains(&ext.as_str())
        })
        .collect();

    image_files.sort();

    let mut results: Vec<(String, String)> = Vec::new();
    for entry in &image_files {
        let mut cur = Cursor::new(&data);
        let mut content: Vec<u8> = Vec::new();
        uncompress_archive_file(&mut cur, &mut content, entry)
            .map_err(|e| format!("Cannot extract {}: {}", entry, e))?;

        let ext = std::path::Path::new(entry)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg")
            .to_lowercase();
        let mime = match ext.as_str() {
            "png"  => "image/png",
            "gif"  => "image/gif",
            "webp" => "image/webp",
            _      => "image/jpeg",
        };

        results.push((entry.clone(), format!("data:{};base64,{}", mime, B64.encode(&content))));
    }

    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![extract_cbr_pages])
        .run(tauri::generate_context!())
        .expect("error while running FolioFin");
}
