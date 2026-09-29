use crate::error::EntryParseError;
use crate::error::EntrySerializeError;
use crate::error::ParseError;
use crate::error::SerializeError;
use crate::helper::FxIndexMap;
use crate::helper::ReadByte;
use crate::helper::require;
use indexmap::IndexMap;
use rustc_hash::FxBuildHasher;
use rustc_hash::FxHashSet;
use std::io::Read;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Store {
    entries: FxIndexMap<String, Vec<u8>>,
    length: u32
}

impl Store {
    pub fn new(length: u32) -> Self {
        Self {
            entries: Default::default(),
            length
        }
    }

    pub fn read_from_bytes(
        data: &mut impl Read,
        resv: u8,
        length: u32
    ) -> Result<Self, ParseError> {
        require!(resv == 0, ParseError::InvalidReservedArea);
        let num_entries = data
            .read_byte()
            .map_err(|_| ParseError::ReadFailed("number of entries"))?;
        let header_length = data
            .read_le::<u16>()
            .map_err(|_| ParseError::ReadFailed("header length"))?;
        let mut actual_header_length = 4usize;
        let mut entry_meta_list = Vec::with_capacity(num_entries.into());
        for _ in 0..num_entries {
            let data_offset = data
                .read_le::<u32>()
                .map_err(|_| ParseError::ReadFailed("entry data offset"))?;
            let data_length = data
                .read_le::<u16>()
                .map_err(|_| ParseError::ReadFailed("entry data length"))?;
            let name_length = data
                .read_byte()
                .map_err(|_| ParseError::ReadFailed("entry name length"))?;
            let name = {
                let mut buf = vec![0; name_length.into()].into_boxed_slice();
                data.read_exact(&mut buf)
                    .map_err(|_| ParseError::ReadFailed("entry name"))?;
                String::from_utf8(buf.into_vec()).map_err(|_| EntryParseError::InvalidName)?
            };
            actual_header_length += 4 + 2 + 1 + name_length as usize;
            entry_meta_list.push((data_offset..data_offset + data_length as u32, name));
        }
        require!(
            header_length as usize == actual_header_length,
            ParseError::HeaderLengthMismatch(header_length, actual_header_length)
        );
        entry_meta_list.sort_unstable_by_key(|a| a.0.start);
        {
            let mut names = FxHashSet::default();
            for (_, name) in entry_meta_list.iter() {
                require!(
                    names.insert(name),
                    EntryParseError::NameDuplicated(name.clone()).into()
                );
            }
            require!(
                entry_meta_list
                    .windows(2)
                    .all(|win| win[0].0.end <= win[1].0.start),
                EntryParseError::DataOverlap.into()
            );
        }
        let mut entries = IndexMap::with_capacity_and_hasher(num_entries.into(), FxBuildHasher);
        for (range, name) in entry_meta_list {
            let mut buf = vec![0; range.start as usize].into_boxed_slice();
            data.read_exact(&mut buf)
                .map_err(|_| ParseError::ReadFailed("and skip unused area"))?;
            let mut buf = vec![0; (range.end - range.start) as usize].into_boxed_slice();
            data.read_exact(&mut buf)
                .map_err(|_| ParseError::ReadFailed("data"))?;
            entries.insert(name, buf.into_vec());
        }
        Ok(Self {
            entries,
            length
        })
    }

    pub fn to_bytes(&self) -> Result<Box<[u8]>, SerializeError> {
        let num_entries = self
            .entries
            .len()
            .checked_cast::<u8>()
            .ok_or(SerializeError::ManyEntries)?;
        let mut header_length = 4;
        let mut data = Vec::with_capacity(self.length as usize);
        let mut entries = Vec::with_capacity(self.length as usize);
        for (name, entry_data) in self.entries.iter() {
            let offset = data
                .len()
                .checked_cast::<u32>()
                .ok_or(SerializeError::NoSpace)?;
            let length = entry_data
                .len()
                .checked_cast::<u16>()
                .ok_or(EntrySerializeError::BigData)?;
            require!(
                offset.checked_add(length.into()).is_some(),
                SerializeError::NoSpace
            );
            let offset = offset.to_le_bytes();
            let length = length.to_le_bytes();
            let name_len = name
                .len()
                .checked_cast::<u8>()
                .ok_or(EntrySerializeError::LongName)?;
            let padding_len = (4 - (name.len() + 4 - 1) % 4) % 4;
            let padding = vec![0; padding_len].into_boxed_slice();
            header_length += 4 + 2 + 1 + name.len() + padding_len;
            entries.extend_from_slice(
                [
                    offset.as_slice(),
                    length.as_slice(),
                    &[name_len],
                    name.as_bytes(),
                    &padding
                ]
                .concat()
                .as_slice()
            );
            data.extend(entry_data.clone());
        }
        let store_length = header_length + data.len() + 4;
        let header_length = header_length
            .checked_cast::<u16>()
            .ok_or(SerializeError::BigHeader)?
            .to_le_bytes();
        require!(
            store_length <= self.length as usize,
            SerializeError::SizeLimit
        );
        let padding_len = self.length as usize - store_length;
        let padding = vec![0; padding_len].into_boxed_slice();
        let store_length = store_length.to_le_bytes();
        Ok([
            &[0x10, num_entries],
            header_length.as_slice(),
            entries.as_slice(),
            data.as_slice(),
            &padding,
            store_length.as_slice()
        ]
        .concat()
        .into_boxed_slice())
    }
}
