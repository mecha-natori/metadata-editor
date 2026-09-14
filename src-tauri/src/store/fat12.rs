use anyhow::bail;
use anyhow::ensure;
use chrono::DateTime;
use chrono::Datelike;
use chrono::Local;
use chrono::NaiveDate;
use chrono::NaiveTime;
use chrono::Timelike;
use encoding_rs::SHIFT_JIS;
use std::iter::Take;
use std::slice;

const EXPECTED_JMPBOOT: [u8; 3] = [0xeb, 0x3c, 0x90];
const EXPECTED_OEMNAME: [u8; 8] = [0x4d, 0x45, 0x43, 0x48, 0x41, 0x4c, 0x41, 0x42];
const EXPECTED_BYTSPERSEC: [u8; 2] = [0x00, 0x02];
const EXPECTED_SECPERCLUS: [u8; 1] = [0x01];
const EXPECTED_RSVDSECCNT: [u8; 2] = [0x01, 0x00];
const EXPECTED_NUMFATS: [u8; 1] = [0x01];
const EXPECTED_MEDIA: [u8; 1] = [0xf8];
const EXPECTED_FATSZ: [u8; 2] = [0x01, 0x00];
const EXPECTED_SECPERTRK: [u8; 2] = [0x10, 0x00];
const EXPECTED_NUMHEADS: [u8; 2] = [0x02, 0x00];
const EXPECTED_DRVNUM: [u8; 1] = [0x80];
const EXPECTED_BOOTSIG: [u8; 1] = [0x29];
const EXPECTED_VOLLAB: [u8; 11] = [
    0x44, 0x41, 0x54, 0x41, 0x5f, 0x53, 0x54, 0x4f, 0x52, 0x45, 0x20
];
const EXPECTED_FILSYSTYPE: [u8; 8] = [0x46, 0x41, 0x54, 0x31, 0x32, 0x20, 0x20, 0x20];
const EXPECTED_BOOTCODE: [u8; 3] = [0xf4, 0xeb, 0xfd];
const EXPECTED_SIGN: [u8; 2] = [0x55, 0xaa];

#[derive(Debug)]
pub struct Fat12FileSystem {
    root_entries: RootDirectory,
    sectors: u16,
    vol_id: u32,
    fat: Fat12,
    data: Box<[u8]>
}

impl Fat12FileSystem {
    pub fn new(root_entries: u16, sectors: u16) -> Self {
        let data = {
            let mut data = vec![
                0;
                sectors as usize * 512
                    - 1024
                    - usize::div_ceil(root_entries as usize * 32, 512) * 512
            ]
            .into_boxed_slice();
            let sectors_bytes = sectors.to_le_bytes();
            data[data.len() - 512] = sectors_bytes[0];
            data[data.len() - 511] = sectors_bytes[1];
            data
        };
        let root_entries = RootDirectory::new(root_entries);
        let vol_id = rand::random();
        let fat = Fat12::default();
        Self {
            root_entries,
            sectors,
            vol_id,
            fat,
            data
        }
    }

    pub fn from_bytes<T>(bytes: T) -> anyhow::Result<Self>
    where
        T: AsRef<[u8]>
    {
        let bytes = bytes.as_ref();
        // 1024 = 512(boot sector) + 512(fat)
        ensure!(
            1024 <= bytes.len(),
            "File system must be at least 1024 bytes in size."
        );
        let mut bytes = bytes.iter();
        check_field(&mut bytes, EXPECTED_JMPBOOT, "BS_JmpBoot")?;
        check_field(&mut bytes, EXPECTED_OEMNAME, "BS_OEMName")?;
        check_field(&mut bytes, EXPECTED_BYTSPERSEC, "BPB_BytsPerSec")?;
        check_field(&mut bytes, EXPECTED_SECPERCLUS, "BPB_SecPerClus")?;
        check_field(&mut bytes, EXPECTED_RSVDSECCNT, "BPB_RsvdSecCnt")?;
        check_field(&mut bytes, EXPECTED_NUMFATS, "BPB_NumFATs")?;
        let root_entries_num = u16::from_le_bytes([*bytes.next().unwrap(), *bytes.next().unwrap()]);
        let sectors = u16::from_le_bytes([*bytes.next().unwrap(), *bytes.next().unwrap()]);
        check_field(&mut bytes, EXPECTED_MEDIA, "BPB_Media")?;
        check_field(&mut bytes, EXPECTED_FATSZ, "BPB_FATSz16")?;
        check_field(&mut bytes, EXPECTED_SECPERTRK, "BPB_SecPerTrk")?;
        check_field(&mut bytes, EXPECTED_NUMHEADS, "BPB_NumHeads")?;
        check_zero_field::<4>(&mut bytes, "BPB_HiddSec")?;
        check_zero_field::<4>(&mut bytes, "BPB_TotSec32")?;
        check_field(&mut bytes, EXPECTED_DRVNUM, "BS_DrvNum")?;
        check_zero_field::<1>(&mut bytes, "BS_Reserved")?;
        check_field(&mut bytes, EXPECTED_BOOTSIG, "BS_BootSig")?;
        let vol_id = u32::from_le_bytes([
            *bytes.next().unwrap(),
            *bytes.next().unwrap(),
            *bytes.next().unwrap(),
            *bytes.next().unwrap()
        ]);
        check_field(&mut bytes, EXPECTED_VOLLAB, "BS_VolLab")?;
        check_field(&mut bytes, EXPECTED_FILSYSTYPE, "BS_FilSysType")?;
        check_field(&mut bytes, EXPECTED_BOOTCODE, "BS_BootCode")?;
        ensure!(*bytes.next().unwrap() == 0x01, "Invalid version detected.");
        check_zero_field::<444>(&mut bytes, "BS_BootCode")?;
        check_field(&mut bytes, EXPECTED_SIGN, "BS_Sign")?;
        let fat = Fat12::from_bytes(bytes.by_ref().take(512))?;
        ensure!(
            u16::from(fat.get_entry(0)?) == 0xff8 && u16::from(fat.get_entry(1)?) == 0xfff,
            "Invalid FAT detected."
        );
        let root_entries = RootDirectory::from_bytes(&mut bytes, root_entries_num.into())?;
        let data = bytes.copied().collect::<Vec<_>>().into_boxed_slice();
        let last_sector = &data[(data.len() - 512)..data.len()];
        let secondary_sectors = u16::from_le_bytes([last_sector[0], last_sector[1]]);
        ensure!(
            sectors == secondary_sectors,
            "Invalid secondary sectors count detected."
        );
        Ok(Self {
            root_entries,
            sectors,
            vol_id,
            fat,
            data
        })
    }

    pub fn into_bytes(self) -> Box<[u8]> {
        let mut result = Vec::with_capacity(self.sectors as usize * 512);
        result.extend_from_slice(&EXPECTED_JMPBOOT);
        result.extend_from_slice(&EXPECTED_OEMNAME);
        result.extend_from_slice(&EXPECTED_BYTSPERSEC);
        result.extend_from_slice(&EXPECTED_SECPERCLUS);
        result.extend_from_slice(&EXPECTED_RSVDSECCNT);
        result.extend_from_slice(&EXPECTED_NUMFATS);
        result.push(self.root_entries.0.len() as u8);
        result.push((self.root_entries.0.len() >> 8) as u8);
        result.push(self.sectors as u8);
        result.push((self.sectors >> 8) as u8);
        result.extend_from_slice(&EXPECTED_MEDIA);
        result.extend_from_slice(&EXPECTED_FATSZ);
        result.extend_from_slice(&EXPECTED_SECPERTRK);
        result.extend_from_slice(&EXPECTED_NUMHEADS);
        result.extend_from_slice(&[0x00; 8]);
        result.extend_from_slice(&EXPECTED_DRVNUM);
        result.push(0x00);
        result.extend_from_slice(&EXPECTED_BOOTSIG);
        result.push(self.vol_id as u8);
        result.push((self.vol_id >> 8) as u8);
        result.push((self.vol_id >> 16) as u8);
        result.push((self.vol_id >> 24) as u8);
        result.extend_from_slice(&EXPECTED_VOLLAB);
        result.extend_from_slice(&EXPECTED_FILSYSTYPE);
        result.extend_from_slice(&EXPECTED_BOOTCODE);
        result.push(0x01);
        result.extend_from_slice(&[0x00; 444]);
        result.extend_from_slice(&EXPECTED_SIGN);
        result.extend_from_slice(&self.fat.into_bytes());
        result.extend_from_slice(&self.root_entries.into_bytes());
        result.extend_from_slice(&self.data);
        result.into_boxed_slice()
    }
}

fn check_field<const N: usize>(
    bytes: &mut slice::Iter<'_, u8>,
    expected: [u8; N],
    name: &str
) -> anyhow::Result<()> {
    let mut is_invalid = false;
    for ex in expected {
        let &b = bytes.next().unwrap();
        if b != ex {
            is_invalid = true;
        }
    }
    ensure!(!is_invalid, "Invalid {} detected.", name);
    Ok(())
}

fn check_zero_field<const N: usize>(
    bytes: &mut slice::Iter<'_, u8>,
    name: &str
) -> anyhow::Result<()> {
    let expected = [0; N];
    check_field(bytes, expected, name)
}

#[derive(Debug)]
pub struct Fat12([Fat12Entry; 341]);

impl Fat12 {
    pub fn from_bytes(bytes: Take<&mut slice::Iter<'_, u8>>) -> anyhow::Result<Self> {
        let mut fat = [Default::default(); _];
        let mut fat_i = 0;
        let mut id_buf = [0; 2];
        for (buf_i, &b) in bytes.enumerate() {
            match fat_i % 4 {
                0 =>
                    if buf_i.is_multiple_of(2) {
                        id_buf[0] = b;
                    } else {
                        id_buf[1] = b & 0x0f;
                        fat[fat_i] = u16::from_le_bytes(id_buf).into();
                        fat_i += 1;
                        id_buf[0] = b >> 4;
                    },
                1 => {
                    id_buf[0] |= (b & 0x0f) << 4;
                    id_buf[1] = b >> 4;
                    fat[fat_i] = u16::from_le_bytes(id_buf).into();
                    fat_i += 1;
                }
                2 =>
                    if buf_i.is_multiple_of(2) {
                        id_buf[1] = b & 0x0f;
                        fat[fat_i] = u16::from_le_bytes(id_buf).into();
                        fat_i += 1;
                        id_buf[0] = b >> 4;
                    } else {
                        id_buf[0] = b;
                    },
                3 => {
                    id_buf[0] |= (b & 0x0f) << 4;
                    id_buf[1] = b >> 4;
                    fat[fat_i] = u16::from_le_bytes(id_buf).into();
                    fat_i += 1;
                }
                _ => unreachable!()
            }
        }
        ensure!(
            fat[340] == Fat12Entry::Available || fat[340] == Fat12Entry::Bad,
            "Invalid last sector detected."
        );
        Ok(Self(fat))
    }

    pub fn into_bytes(self) -> [u8; 512] {
        let mut result = [0; _];
        let mut buf_i = 0;
        for (fat_i, entry) in self.0.into_iter().enumerate() {
            let entry = u16::from(entry);
            if fat_i.is_multiple_of(2) {
                result[buf_i] = entry as u8;
                buf_i += 1;
                result[buf_i] = (entry >> 8) as u8;
            } else {
                result[buf_i] |= ((entry & 0x00f) << 4) as u8;
                buf_i += 1;
                result[buf_i] = (entry >> 4) as u8;
                buf_i += 1;
            }
        }
        result
    }

    pub fn get_entry(&self, num: usize) -> anyhow::Result<Fat12Entry> {
        ensure!(num < 341, "Out of range");
        Ok(self.0[num])
    }

    pub fn get_entry_chain(&self, start_num: usize) -> anyhow::Result<Box<[Fat12Entry]>> {
        let start = self.get_entry(start_num)?;
        let mut result = vec![start];
        if let Fat12Entry::Used(num) = start {
            let mut num = num;
            loop {
                let entry = self.get_entry(num.into())?;
                result.push(entry);
                match entry {
                    Fat12Entry::Used(next) => num = next,
                    Fat12Entry::End(_) => break,
                    _ => bail!("Invalid FAT entry")
                }
            }
        }
        Ok(result.into_boxed_slice())
    }
}

impl Default for Fat12 {
    fn default() -> Self {
        let mut entries = [Default::default(); _];
        entries[0] = Fat12Entry::End(0xff8);
        entries[1] = Fat12Entry::End(0xfff);
        Self(entries)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, Ord, PartialEq, PartialOrd)]
pub enum Fat12Entry {
    #[default]
    Available,
    Reserved,
    Used(u16),
    Bad,
    End(u16)
}

impl From<u16> for Fat12Entry {
    fn from(value: u16) -> Self {
        use Fat12Entry::*;

        match value {
            0x000 => Available,
            0x001 => Reserved,
            0x002..=0xff6 => Used(value),
            0xff7 => Bad,
            0xff8..=0xfff => End(value),
            _ => unreachable!()
        }
    }
}

impl From<Fat12Entry> for u16 {
    fn from(value: Fat12Entry) -> Self {
        use Fat12Entry::*;

        match value {
            Available => 0x000,
            Reserved => 0x001,
            Used(a) => a,
            Bad => 0xff7,
            End(a) => a
        }
    }
}

#[derive(Debug)]
pub struct RootDirectory(pub Box<[DirectoryEntry]>);

impl RootDirectory {
    pub fn new(entries: u16) -> Self {
        let mut entries = vec![Default::default(); entries.into()].into_boxed_slice();
        entries[0] = DirectoryEntry {
            name: ("DATA_STO".to_string(), "RE".to_string()),
            attrs: FileAttribute(FileAttribute::VOLUME_LABEL),
            ..Default::default()
        };
        Self(entries)
    }

    pub fn from_bytes(bytes: &mut slice::Iter<'_, u8>, size: usize) -> anyhow::Result<Self> {
        ensure!(
            size.is_multiple_of(32),
            "Number of root directory entry must be multiple of 32."
        );
        let mut root_entries = vec![Default::default(); size].into_boxed_slice();
        for i in 0..size {
            let bytes = bytes.by_ref().take(32);
            let entry = DirectoryEntry::from_bytes(bytes)?;
            root_entries[i] = entry;
        }
        Ok(RootDirectory(root_entries))
    }

    pub fn into_bytes(self) -> Box<[u8]> {
        let mut result = Vec::with_capacity(self.0.len() * 32);
        for entry in self.0 {
            result.extend_from_slice(&entry.into_bytes());
        }
        result.into_boxed_slice()
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct FileAttribute(pub u8);

impl FileAttribute {
    const ARCHIVE: u8 = 0x20;
    const DIRECTORY: u8 = 0x10;
    const HIDDEN: u8 = 0x02;
    const LONG_FILE_NAME: u8 = 0x0f;
    const READ_ONLY: u8 = 0x01;
    const SYSTEM: u8 = 0x04;
    const VOLUME_LABEL: u8 = 0x08;
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct FileNameAttribute(pub u8);

impl FileNameAttribute {
    const BODY_ALL_LOWER: u8 = 0x08;
    const EXT_ALL_LOWER: u8 = 0x10;
}

#[derive(Clone, Debug, Default)]
pub struct DirectoryEntry {
    name: (String, String),
    attrs: FileAttribute,
    name_attrs: FileNameAttribute,
    create_time_subsecs: u8,
    create_time: u16,
    create_date: u16,
    access_date: u16,
    modify_time: u16,
    modify_date: u16,
    cluster_num: u16,
    file_size: u32
}

impl DirectoryEntry {
    pub fn from_bytes(mut bytes: Take<&mut slice::Iter<'_, u8>>) -> anyhow::Result<Self> {
        ensure!(bytes.len() == 32, "Invalid directory entry size.");
        let mut name = bytes
            .by_ref()
            .take(11)
            .copied()
            .collect::<Vec<_>>()
            .into_boxed_slice();
        let attrs = *bytes.next().unwrap();
        let name_attrs = *bytes.next().unwrap();
        let create_time_subsecs = *bytes.next().unwrap();
        let create_time = bytes
            .by_ref()
            .take(2)
            .copied()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        let create_date = bytes
            .by_ref()
            .take(2)
            .copied()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        let access_date = bytes
            .by_ref()
            .take(2)
            .copied()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        ensure!(
            !bytes
                .by_ref()
                .take(2)
                .copied()
                .map(|b| b != 0)
                .collect::<Vec<_>>()
                .contains(&true),
            "Invalid DIR_FstClusHI detected."
        );
        let modify_time = bytes
            .by_ref()
            .take(2)
            .copied()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        let modify_date = bytes
            .by_ref()
            .take(2)
            .copied()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        let cluster_num = bytes
            .by_ref()
            .take(2)
            .copied()
            .collect::<Vec<_>>()
            .try_into()
            .unwrap();
        let file_size = bytes.copied().collect::<Vec<_>>().try_into().unwrap();
        let name = {
            if name[0] == 0x05 {
                name[0] = 0xe5;
            }
            let (name, ..) = SHIFT_JIS.decode(&name);
            let name = name.into_owned();
            let (body, ext) = (&name[0..8], &name[8..11]);
            let (body, ext) = (body.trim_end(), ext.trim_end());
            (body.to_owned(), ext.to_owned())
        };
        let attrs = FileAttribute(attrs);
        let name_attrs = FileNameAttribute(name_attrs);
        let create_time = u16::from_le_bytes(create_time);
        let create_date = u16::from_le_bytes(create_date);
        let access_date = u16::from_le_bytes(access_date);
        let modify_time = u16::from_le_bytes(modify_time);
        let modify_date = u16::from_le_bytes(modify_date);
        let cluster_num = u16::from_le_bytes(cluster_num);
        let file_size = u32::from_le_bytes(file_size);
        Ok(Self {
            name,
            attrs,
            name_attrs,
            create_time_subsecs,
            create_time,
            create_date,
            access_date,
            modify_time,
            modify_date,
            cluster_num,
            file_size
        })
    }

    pub fn into_bytes(self) -> [u8; 32] {
        let mut result = Vec::with_capacity(32);
        let name = {
            let name = format!("{:<8}{:<3}", self.name.0, self.name.1);
            let (name, ..) = SHIFT_JIS.encode(&name);
            let mut name = name.into_owned();
            if name[0] == 0xe5 {
                name[0] = 0x05;
            }
            TryInto::<[u8; 11]>::try_into(name).unwrap()
        };
        result.extend_from_slice(&name);
        result.push(self.attrs.0);
        result.push(self.name_attrs.0);
        result.push(self.create_time_subsecs);
        result.extend_from_slice(&self.create_time.to_le_bytes());
        result.extend_from_slice(&self.create_date.to_le_bytes());
        result.extend_from_slice(&self.access_date.to_le_bytes());
        result.extend_from_slice(&[0; 2]);
        result.extend_from_slice(&self.modify_time.to_le_bytes());
        result.extend_from_slice(&self.modify_date.to_le_bytes());
        result.extend_from_slice(&self.cluster_num.to_le_bytes());
        result.extend_from_slice(&self.file_size.to_le_bytes());
        result.try_into().unwrap()
    }
}

fn datetime_to_dos_datetime(datetime: DateTime<Local>) -> anyhow::Result<(u16, u16, u8)> {
    let date = date_to_dos_date(datetime.date_naive())?;
    let (time, centisecond) = time_to_dos_time(datetime.time())?;
    Ok((date, time, centisecond))
}

fn date_to_dos_date(date: NaiveDate) -> anyhow::Result<u16> {
    let year = {
        let year = date.year();
        ensure!(
            (1980..=2107).contains(&year),
            "Year of DOS-style date must be between 1980 and 2107."
        );
        (year - 1980) as u16
    };
    let month = date.month() as u16;
    let day = date.day() as u16;
    let date = (year << 9) | (month << 5) | day;
    Ok(date)
}

fn time_to_dos_time(time: NaiveTime) -> anyhow::Result<(u16, u8)> {
    let hour = time.hour() as u16;
    let minute = time.minute() as u16;
    let second = time.second() as u16 / 2;
    let centisecond = (time.nanosecond() / 1000 / 1000 / 10
        + (if second.is_multiple_of(2) { 0 } else { 100 })) as u8;
    let time = (hour << 11) | (minute << 5) | second;
    Ok((time, centisecond))
}
