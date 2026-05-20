use compress_tools::{list_archive_files, uncompress_archive_file};
use std::io::Cursor;
use std::path::Path;
use tauri::Manager;

/* ── Helpers ─────────────────────────────────────────────────────── */

/// Collect sorted relative paths of image files inside a cache directory.
fn collect_image_paths(cache_dir: &Path, book_id: &str) -> Vec<String> {
    let image_exts = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
    let mut paths: Vec<String> = std::fs::read_dir(cache_dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let ext = Path::new(&name)
                .extension()
                .and_then(|x| x.to_str())
                .unwrap_or("")
                .to_lowercase();
            if image_exts.contains(&ext.as_str()) {
                Some(format!("cbr_cache/{}/{}", book_id, name))
            } else {
                None
            }
        })
        .collect();
    paths.sort();
    paths
}

/// Try to extract using the `7z` command (p7zip-full).
/// Handles RAR3, RAR4, and RAR5 — the most reliable option on Ubuntu.
fn try_7z(src: &Path, dst: &Path) -> bool {
    std::process::Command::new("7z")
        .args([
            "e", "-y",
            &src.to_string_lossy(),
            &format!("-o{}", dst.display()),
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Try `unrar` then `rar` commands as a second option.
fn try_unrar(src: &Path, dst: &Path) -> bool {
    for cmd in &["unrar", "rar"] {
        let ok = std::process::Command::new(cmd)
            .args(["e", "-y", &src.to_string_lossy(), &format!("{}/", dst.display())])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if ok {
            return true;
        }
    }
    false
}

/// Last resort: libarchive via compress-tools.
/// Works for RAR3 on most systems; Ubuntu's libarchive may lack RAR5 support.
fn try_libarchive(src: &Path, dst: &Path) -> Result<(), String> {
    let data = std::fs::read(src).map_err(|e| e.to_string())?;
    let image_exts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif"];

    let mut cursor = Cursor::new(&data);
    let entries = list_archive_files(&mut cursor).map_err(|e| e.to_string())?;

    let mut image_files: Vec<String> = entries
        .into_iter()
        .filter(|n| {
            let ext = Path::new(n)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            image_exts.contains(&ext.as_str())
        })
        .collect();
    image_files.sort();

    if image_files.is_empty() {
        return Err("no images in archive".to_string());
    }

    for (i, entry) in image_files.iter().enumerate() {
        let ext = Path::new(entry)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg")
            .to_lowercase();
        let out = dst.join(format!("{:05}.{}", i, ext));
        let mut cur = Cursor::new(&data);
        let mut buf = Vec::new();
        uncompress_archive_file(&mut cur, &mut buf, entry)
            .map_err(|e| e.to_string())?;
        std::fs::write(&out, &buf).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/* ── Tauri command ───────────────────────────────────────────────── */

/// Extract all image pages from a CBR/RAR archive.
///
/// Pages are extracted to $APPDATA/cbr_cache/{bookId}/ on first open,
/// then served from that cache on subsequent opens.
///
/// Returns sorted relative paths readable via the Tauri FS plugin
/// with BaseDirectory.AppData (no extra permissions needed).
///
/// Extraction order of preference:
///   1. 7z   (sudo apt install p7zip-full)  — handles RAR3/4/5
///   2. unrar (sudo apt install unrar)       — handles RAR3/4/5
///   3. libarchive (compress-tools)          — RAR3 only on Ubuntu
#[tauri::command]
async fn extract_cbr_pages(
    app: tauri::AppHandle,
    relative_path: String,
) -> Result<Vec<String>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;

    let book_id = Path::new(&relative_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("cbr_book")
        .to_string();

    let cache_dir = app_data.join("cbr_cache").join(&book_id);
    let file_path = app_data.join(&relative_path);

    // ── Serve from cache if already extracted ────────────────────────
    if cache_dir.exists() {
        let cached = collect_image_paths(&cache_dir, &book_id);
        if !cached.is_empty() {
            return Ok(cached);
        }
    }

    // ── Validate the source file ─────────────────────────────────────
    if !file_path.exists() {
        return Err(format!(
            "CBR file not found on disk.\nExpected: {}",
            file_path.display()
        ));
    }

    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Cannot create cache directory: {}", e))?;

    // ── Try extraction methods in order ──────────────────────────────
    // try_libarchive is sync I/O — offload to a dedicated thread so it can't
    // stall the async runtime (libarchive has no async API).
    let file_path_c = file_path.clone();
    let cache_dir_c = cache_dir.clone();
    let libarchive_ok = std::thread::spawn(move || {
        try_libarchive(&file_path_c, &cache_dir_c).is_ok()
    }).join().unwrap_or(false);

    let extracted = try_7z(&file_path, &cache_dir)
        || try_unrar(&file_path, &cache_dir)
        || libarchive_ok;

    if !extracted {
        let _ = std::fs::remove_dir_all(&cache_dir);
        return Err(
            "Cannot extract this CBR file.\n\n\
             Ubuntu's built-in libarchive lacks RAR5 support.\n\
             Fix: install 7zip in a terminal:\n\n\
             sudo apt install p7zip-full\n\n\
             Then reopen the book."
                .to_string(),
        );
    }

    // ── List extracted pages ─────────────────────────────────────────
    let paths = collect_image_paths(&cache_dir, &book_id);
    if paths.is_empty() {
        return Err("No image files found in this CBR archive after extraction.".to_string());
    }

    Ok(paths)
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
