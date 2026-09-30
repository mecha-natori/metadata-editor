use crate::ChipFamily;
use store::Store;
use store::StoreVersion;

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
