use fatfs::FatType;
use fatfs::FormatVolumeOptions;
use fatfs::ReadWriteSeek;
use std::io;
use std::io::SeekFrom;

pub fn format<T: ReadWriteSeek>(disk: &mut T, root_entries: u16, sectors: u16) -> io::Result<()> {
    let opts = FormatVolumeOptions::new()
        .bytes_per_cluster(0x0200)
        .bytes_per_sector(0x0200)
        .drive_num(0x80)
        .fat_type(FatType::Fat12)
        .fats(0x01)
        .heads(0x02)
        .max_root_dir_entries(root_entries)
        .media(0xf8)
        .sectors_per_track(0x20)
        .total_sectors(sectors.into())
        .volume_id(rand::random())
        .volume_label(*b"DATA_STORE ");
    fatfs::format_volume(&mut *disk, opts)?;
    disk.seek(SeekFrom::Start(0x3e))?;
    disk.write_all(&[0xf4, 0xeb, 0xfd])?;
    Ok(())
}
