use tauri::{AppHandle, Manager, Emitter};
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;

// --- 1. COMMANDS IMPLEMENTATION ---

/// Memberikan feedback visual/audio ke Frontend (Support Optimistic UI)
/// Command ini ringan, jadi tidak perlu async.
#[tauri::command]
fn trigger_feedback(app: AppHandle, status: &str) {
    // 1. Emit event ke frontend (React Hook akan menangkap ini)
    if let Err(err) = app.emit("inventory-feedback", status) {
        eprintln!("[Tauri] Failed to emit feedback: {}", err);
    }

    // 2. (Opsional) Native System Beep bisa ditambahkan di sini jika perlu
    // Tapi untuk inventory modern, kita serahkan suara ke Frontend (Web Audio API)
    println!("[Inventory] Feedback Triggered: {}", status);
}

/// Menulis log audit ke file fisik (Secure Audit Trail)
/// ⚠️ ASYNC: Penting agar I/O disk tidak memblokir UI Thread saat transaksi cepat.
#[tauri::command]
async fn write_secure_log(app: AppHandle, message: String, level: String) -> Result<(), String> {
    // Bungkus logic blocking filesystem dalam spawn_blocking agar aman
    tauri::async_runtime::spawn_blocking(move || {
        // 1. Dapatkan path folder log aplikasi secara aman (AppLogDir)
        // Pastikan capability 'fs:allow-app-log-dir-write' aktif
        let app_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
        
        // 2. Buat folder jika belum ada
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir).map_err(|e| format!("Gagal buat folder log: {}", e))?;
        }

        // 3. Tentukan nama file: inventory_audit_[TAHUN-BULAN].log
        // Rotasi bulanan agar file tidak terlalu raksasa
        let current_month = Local::now().format("%Y-%m");
        let filename = format!("inventory_audit_{}.log", current_month);
        let file_path = app_dir.join(filename);
        
        // 4. Buka file dalam mode APPEND (Secure Append Only)
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(|e| format!("Gagal akses file log: {}", e))?;

        // 5. Tulis Log dengan Timestamp Presisi
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f"); // %.3f untuk milidetik
        let log_line = format!("[{}] [{}] {}\n", timestamp, level.to_uppercase(), message);

        file.write_all(log_line.as_bytes())
            .map_err(|e| format!("Gagal menulis log: {}", e))?;
        
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())? // Handle join error
}

// --- 2. MAIN ENTRY POINT ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 👇 PLUGIN SETUP (Wajib urutan ini)
        .plugin(tauri_plugin_fs::init()) // Filesystem akses
        .plugin(tauri_plugin_sql::Builder::default().build()) // SQLite Database
        
        // 👇 LOGGING INTERNAL TAURI (Debug console)
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())

        // 👇 REGISTER COMMANDS
        .invoke_handler(tauri::generate_handler![
            trigger_feedback,
            write_secure_log
        ])

        // 👇 APP SETUP HOOK (Reality Check Boot)
        .setup(|app| {
            // Validasi Environment saat Booting
            if cfg!(debug_assertions) {
                 println!("[Tauri] 🚀 System initialized in DEBUG mode");
                 println!("[Tauri] 📂 App Data Dir: {:?}", app.path().app_data_dir());
            }
            
            // Di sini kita bisa jalankan migrasi native jika perlu,
            // tapi karena kita pakai Drizzle JS-side migration, kita skip.
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}