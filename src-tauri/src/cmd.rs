use crate::AppState;
use crate::ChipFamily;
use std::fs;
use std::io::Cursor;
use std::io::Read;
use std::sync::Mutex;
use store::Store;
use store::StoreApi;
use store::StoreVersion;
use tauri::AppHandle;
use tauri::State;
use tauri::ipc::InvokeBody;
use tauri::ipc::Request;
use tauri::ipc::Response;
use tauri_plugin_dialog::DialogExt;

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
    let (store, store_base) = if chip_family == ChipFamily::Test {
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
        (store, 0)
    } else {
        let (store, store_base) = super::read(bank_base, bank_length, chip_family, chip_name)?;
        let store_length = store.len() as u32;
        let mut store = store.as_slice();
        let store = Store::read_from_bytes(&mut store, store_length)
            .map_err(|err| format!("ストアの読み取りに失敗しました: {}", err))?;
        (store, store_base)
    };
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
    let (name, bytes) = decode_set_data_request(&req)?;
    let mut state = state.lock().unwrap();
    let store = state
        .store
        .as_mut()
        .ok_or("ストアがロードされていません。")?
        .get_mut();
    let entry = store
        .get_entry_mut(name)
        .ok_or("エントリが存在しません。")?;
    entry.clear();
    entry.extend_from_slice(bytes);
    Ok(())
}

#[tauri::command]
pub fn add_data(req: Request, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let (name, bytes) = decode_set_data_request(&req)?;
    let mut state = state.lock().unwrap();
    let store = state
        .store
        .as_mut()
        .ok_or("ストアがロードされていません。")?
        .get_mut();
    store
        .create_entry(&name, [])
        .map_err(|err| format!("エントリの作成に失敗しました: {}", err))?;
    let entry = store.get_entry_mut(name).unwrap();
    entry.clear();
    entry.extend_from_slice(bytes);
    Ok(())
}

#[tauri::command]
pub fn remove_data(name: &str, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    let store = state
        .store
        .as_mut()
        .ok_or("ストアがロードされていません。")?
        .get_mut();
    if store.get_entry(name).is_none() {
        return Err("エントリが存在しません。".into());
    }
    store
        .remove_entry(name)
        .map_err(|_| "エントリの削除に失敗しました。")?;
    Ok(())
}

#[tauri::command]
pub fn rename_data(
    new_name: &str,
    old_name: &str,
    state: State<'_, Mutex<AppState>>
) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    let store = state
        .store
        .as_mut()
        .ok_or("ストアがロードされていません。")?
        .get_mut();
    store
        .rename_entry(old_name, new_name)
        .map_err(|err| format!("エントリ名の変更に失敗しました: {}", err))?;
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

#[tauri::command]
pub fn dump(
    app: AppHandle,
    bank_base: u32,
    bank_length: u32,
    chip_family: ChipFamily,
    chip_name: &str
) -> Result<(), String> {
    let (store, store_base) = if chip_family == ChipFamily::Test {
        let mut store = Store::new(StoreVersion::V1, u8::MAX.into());
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
        (store, 0)
    } else {
        let (store, store_base) = super::read(bank_base, bank_length, chip_family, chip_name)?;
        let store_length = store.len() as u32;
        let mut store = store.as_slice();
        (
            Store::read_from_bytes(&mut store, store_length)
                .map_err(|err| format!("ストアの読み取りに失敗しました: {}", err))?,
            store_base
        )
    };
    let Some(path) = app
        .dialog()
        .file()
        .add_filter("バイナリファイル", &["bin"])
        .blocking_save_file()
    else {
        return Ok(());
    };
    let store_base = store_base.to_le_bytes();
    let chip_name_len = chip_name
        .len()
        .checked_cast()
        .ok_or("チップ名が長過ぎます。")?;
    let bytes = store
        .to_bytes()
        .map_err(|err| format!("ストアのシリアライズに失敗しました: {}", err))?;
    fs::write(
        path.as_path().unwrap(),
        [
            store_base.as_slice(),
            &[chip_name_len],
            chip_name.as_bytes(),
            &bytes
        ]
        .concat()
    )
    .map_err(|err| format!("ファイルの書き込みに失敗しました: {}", err))?;
    Ok(())
}

#[tauri::command]
pub fn restore(app: AppHandle, chip_family: ChipFamily, chip_name: &str) -> Result<(), String> {
    let Some(path) = app
        .dialog()
        .file()
        .add_filter("バイナリファイル", &["bin"])
        .blocking_pick_file()
    else {
        return Ok(());
    };
    if chip_family == ChipFamily::Test {
        return Ok(());
    }
    let (store, store_base) = {
        let store = fs::read(path.as_path().unwrap())
            .map_err(|err| format!("ファイルの読み取りに失敗しました: {}", err))?;
        let mut reader = Cursor::new(&store);
        let store_base = reader
            .read_le()
            .map_err(|err| format!("ストアのベースアドレスの読み取りに失敗しました: {}", err))?;
        let chip_name_len = reader
            .read_le::<u8>()
            .map_err(|err| format!("チップ名長の読み取りに失敗しました: {}", err))?;
        let file_chip_name = {
            let mut buf = vec![0, chip_name_len];
            reader
                .read(&mut buf)
                .map_err(|err| format!("チップ名の読み取りに失敗しました: {}", err))?;
            String::from_utf8(buf).map_err(|err| format!("不正なチップ名です: {}", err))?
        };
        if file_chip_name != chip_name {
            Err("ファイルのチップと対象のチップが一致しません。")?;
        }
        let mut store = &store[reader.position() as usize..];
        let store_length = store.len() as u32;
        (
            Store::read_from_bytes(&mut store, store_length)
                .map_err(|err| format!("ストアの読み取りに失敗しました: {}", err))?,
            store_base
        )
    };
    let bytes = store
        .to_bytes()
        .map_err(|err| format!("ストアのシリアライズに失敗しました: {}", err))?;
    super::write(store_base, bytes, chip_family, chip_name)?;
    Ok(())
}

fn decode_set_data_request<'a>(req: &'a Request) -> Result<(String, &'a [u8]), String> {
    let InvokeBody::Raw(bytes) = req.body() else {
        return Err("データの設定に失敗しました。".into());
    };
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
    Ok((name, bytes))
}
