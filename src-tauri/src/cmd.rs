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
        .map_err(|err| format!("ストアのシリアライズに失敗しました: {}", err))?;
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
    let (store, store_base) = super::read(bank_base, bank_length, chip_family, chip_name)?;
    let store_length = store.len() as u32;
    let mut store = store.as_slice();
    let store = Store::read_from_bytes(&mut store, store_length)
        .map_err(|err| format!("ストアの読み取りに失敗しました: {}", err))?;
    let keys = store.get().get_entries().keys().cloned().collect();
    {
        let mut state = state.lock().unwrap();
        state.chip_family = Some(chip_family);
        state.chip_name = Some(chip_name.to_string());
        state.store = Some(store);
        state.store_base = Some(store_base);
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

#[tauri::command]
pub fn save(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    let store = state.store.as_mut();
    let bytes = store
        .ok_or("ストアがロードされていません。")?
        .to_bytes()
        .map_err(|err| format!("ストアのシリアライズに失敗しました: {}", err))?;
    super::write(
        state.store_base.unwrap(),
        bytes,
        state.chip_family.unwrap(),
        state.chip_name.clone().unwrap()
    )?;
    Ok(())
}
