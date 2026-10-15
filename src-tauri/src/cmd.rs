use crate::AppState;
use crate::ChipFamily;
use std::io::Cursor;
use std::io::Read;
use std::sync::Mutex;
use store::Store;
use store::StoreApi;
use store::StoreVersion;
use tauri::State;
use tauri::ipc::InvokeBody;
use tauri::ipc::Request;
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
    if chip_family == ChipFamily::Test {
        let mut store = Store::new(StoreVersion::V1, u32::MAX);
        store
            .get_mut()
            .create_entry("test1", vec![
                0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
            ])
            .unwrap();
        store
            .get_mut()
            .create_entry("TEST2", vec![
                0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
            ])
            .unwrap();
        store
            .get_mut()
            .create_entry("テスト3", vec![
                0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
            ])
            .unwrap();
        let keys = store.get().get_entries().keys().cloned().collect();
        {
            let mut state = state.lock().unwrap();
            state.chip_family = Some(chip_family);
            state.chip_name = Some(chip_name.to_string());
            state.store = Some(store);
            state.store_base = Some(0);
        }
        return Ok(keys);
    }
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
pub fn set_data(req: Request, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = req.body() else {
        return Err("データの設定に失敗しました。".into());
    };
    let (name, bytes) = {
        let mut reader = Cursor::new(bytes);
        let mut buf = [0; 1];
        reader
            .read_exact(&mut buf)
            .map_err(|_| "エントリ名長の読み取りに失敗しました。")?;
        let name_len = buf[0];
        let mut buf = vec![0; name_len.into()];
        reader
            .read_exact(&mut buf)
            .map_err(|_| "エントリ名の読み取りに失敗しました。")?;
        let name = String::from_utf8(buf).map_err(|_| "不正なエントリ名です。")?;
        let bytes = &bytes[reader.position() as usize..];
        (name, bytes)
    };
    let mut state = state.lock().unwrap();
    let store = state
        .store
        .as_mut()
        .ok_or("ストアがロードされていません。")?
        .get_mut();
    let entry = {
        let entry = store.get_entry_mut(&name);
        match entry {
            Some(entry) => entry,
            None => {
                store
                    .create_entry(&name, [])
                    .map_err(|_| "エントリの作成に失敗しました。")?;
                store.get_entry_mut(&name).unwrap()
            }
        }
    };
    entry.clear();
    entry.extend_from_slice(bytes);
    Ok(())
}

#[tauri::command]
pub fn save(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let state = state.lock().unwrap();
    if state.chip_family == Some(ChipFamily::Test) {
        return Ok(());
    }
    let store = state.store.as_ref();
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
