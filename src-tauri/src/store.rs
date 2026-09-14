use crate::ChipFamily;
use crate::store::fat12::Fat12FileSystem;

mod fat12;

#[tauri::command]
pub fn format(
    base_addr: u64,
    chip_family: ChipFamily,
    chip_name: &str,
    length: u32,
    root_entries: u16
) -> Result<(), String> {
    // 33554432 = 2^16 * 512
    if 33554432 <= length {
        return Err("32MiB以上は非対応です。".into());
    }
    if !length.is_multiple_of(512) {
        return Err("サイズは512B単位である必要があります。".into());
    }
    let fs = Fat12FileSystem::new(root_entries, (length / 512) as u16);
    let fs = fs.into_bytes();
    crate::write(base_addr, fs, chip_family, chip_name)?;
    Ok(())
}
