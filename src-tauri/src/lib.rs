use std::{fs, io::ErrorKind, path::PathBuf};
use tauri::{AppHandle, Manager};

// The real guard against path traversal: only [a-z0-9-]{1,32} can become a file name.
fn valid_slot(slot: &str) -> bool {
  (1..=32).contains(&slot.len())
    && slot
      .bytes()
      .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn slot_path(app: &AppHandle, slot: &str) -> Result<PathBuf, String> {
  if !valid_slot(slot) {
    return Err(format!("Invalid slot name: {slot}"));
  }
  let dir = app.path().data_dir().map_err(|e| e.to_string())?;
  Ok(dir.join("CoffeeChain").join("saves").join(format!("{slot}.json")))
}

#[tauri::command]
fn save_write(app: AppHandle, slot: String, text: String) -> Result<(), String> {
  let path = slot_path(&app, &slot)?;
  let dir = path.parent().ok_or("Save path has no folder")?;
  fs::create_dir_all(dir).map_err(|e| e.to_string())?;
  // Write a temp file first, so that a crash cannot leave a half-written save.
  let temp = path.with_extension("json.tmp");
  fs::write(&temp, text).map_err(|e| e.to_string())?;
  fs::rename(&temp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_read(app: AppHandle, slot: String) -> Result<Option<String>, String> {
  match fs::read_to_string(slot_path(&app, &slot)?) {
    Ok(text) => Ok(Some(text)),
    Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
    Err(e) => Err(e.to_string()),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![save_write, save_read])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
  use super::valid_slot;

  #[test]
  fn accepts_valid_slot_names() {
    for slot in ["slot-1", "autosave", "a", &"a".repeat(32)] {
      assert!(valid_slot(slot), "{slot}");
    }
  }

  #[test]
  fn rejects_invalid_slot_names() {
    let long = "a".repeat(33);
    for slot in ["", "../x", "a/b", "a\\b", "Slot1", ".", "..", "a.json", "slot 1", "é", "a\0", &long] {
      assert!(!valid_slot(slot), "{slot:?}");
    }
  }
}
