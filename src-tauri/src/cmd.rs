use crate::AppState;
use crate::ChipFamily;
use std::sync::Mutex;
use store::Store;
use store::StoreApi;
use store::StoreVersion;
use tauri::State;
use tauri::ipc::Response;

#[tauri::command]
pub fn format(
    chip_family: ChipFamily,
    chip_name: &str,
    store_base: u32,
    store_length: u32,
    store_version: StoreVersion
) -> Result<(), String> {
    let store = Store::new(store_version, store_length);
    let bytes = store
        .to_bytes()
        .map_err(anyhow::Error::new)
        .map_err(|err| err.to_string())?;
    super::write(store_base, bytes, chip_family, chip_name)?;
    Ok(())
}

#[tauri::command]
pub fn load(
    bank_base: u32,
    bank_length: u32,
    chip_family: ChipFamily,
    chip_name: &str,
    state: State<'_, Mutex<AppState>>
) -> Result<Vec<String>, String> {
    let store = super::read(bank_base, bank_length, chip_family, chip_name)?;
    let store_length = store.len() as u32;
    let mut store = store.as_slice();
    let store = Store::read_from_bytes(&mut store, store_length)
        .map_err(|err| format!("ストアの読み取りに失敗しました: {}", err))?;
    let keys = store.get().get_entries().keys().cloned().collect();
    {
        let mut state = state.lock().unwrap();
        state.store = Some(store);
    }
    Ok(keys)
}

#[tauri::command]
pub fn get_data(name: &str, state: State<'_, Mutex<AppState>>) -> Result<Response, String> {
    let state = state.lock().unwrap();
    let store = state
        .store
        .as_ref()
        .ok_or("ストアがロードされていません。")?
        .get();
    let data = store.get_entry(name).ok_or("エントリが存在しません。")?;
    Ok(Response::new(data.clone()))
}
