use crate::ChipFamily;
use std::io::Cursor;

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
    let disk = vec![0u8; length as usize].into_boxed_slice();
    let mut disk = Cursor::new(disk);
    fat12::format(&mut disk, root_entries, (length / 512) as u16).map_err(|err| err.to_string())?;
    crate::write(base_addr, disk.into_inner(), chip_family, chip_name)?;
    Ok(())
}
