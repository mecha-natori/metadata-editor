use crate::StoreApi;
use crate::error::EditError;
use crate::error::EntryParseError;
use crate::error::EntrySerializeError;
use crate::error::ParseError;
use crate::error::SerializeError;
use crate::error::StoreError;
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

impl StoreApi for Store {
    fn new(length: u32) -> Self {
        Self {
            entries: Default::default(),
            length
        }
    }

    fn get_entries(&self) -> &FxIndexMap<String, Vec<u8>> {
        &self.entries
    }

    fn get_entry(&self, name: impl AsRef<str>) -> Option<&Vec<u8>> {
        let name = name.as_ref();
        self.entries
            .iter()
            .find(|&(k, _)| k == name)
            .map(|(_, v)| v)
    }

    fn get_entry_mut(&mut self, name: impl AsRef<str>) -> Option<&mut Vec<u8>> {
        let name = name.as_ref();
        self.entries
            .iter_mut()
            .find(|&(k, _)| k == name)
            .map(|(_, v)| v)
    }

    fn create_entry(
        &mut self,
        name: impl Into<String>,
        data: impl AsRef<[u8]>
    ) -> Result<(), StoreError> {
        let name = name.into();
        let data = data.as_ref();
        require!(
            self.entries.keys().find(|&k| k == &name).is_none(),
            EditError::AlreadyExists(name).into()
        );
        let data = data.to_vec();
        self.entries.insert(name, data);
        Ok(())
    }

    fn remove_entry(&mut self, name: impl AsRef<str>) -> Result<Vec<u8>, StoreError> {
        let name = name.as_ref();
        self.entries
            .swap_remove(name)
            .ok_or(EditError::NotFound(name.to_string()).into())
    }

    fn rename_entry(
        &mut self,
        old_name: impl Into<String>,
        new_name: impl Into<String>
    ) -> Result<(), StoreError> {
        let old_name = old_name.into();
        let new_name = new_name.into();
        require!(
            self.entries.keys().find(|&k| k == &new_name).is_none(),
            EditError::AlreadyExists(new_name).into()
        );
        let entry = self
            .entries
            .swap_remove(&old_name)
            .ok_or(EditError::NotFound(old_name))?;
        self.entries.insert(new_name, entry);
        Ok(())
    }

    fn read_from_bytes(data: &mut impl Read, resv: u8, length: u32) -> Result<Self, StoreError> {
        require!(resv == 0, ParseError::InvalidReservedArea.into());
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
                String::from_utf8(buf.into_vec())
                    .map_err(|_| EntryParseError::InvalidName)
                    .map_err(ParseError::from)?
            };
            actual_header_length += 4 + 2 + 1 + name_length as usize;
            entry_meta_list.push((data_offset..data_offset + data_length as u32, name));
        }
        require!(
            header_length as usize == actual_header_length,
            ParseError::HeaderLengthMismatch(header_length, actual_header_length).into()
        );
        entry_meta_list.sort_unstable_by_key(|a| a.0.start);
        {
            let mut names = FxHashSet::default();
            for (_, name) in entry_meta_list.iter() {
                require!(
                    names.insert(name),
                    ParseError::from(EntryParseError::NameDuplicated(name.clone())).into()
                );
            }
            require!(
                entry_meta_list
                    .windows(2)
                    .all(|win| win[0].0.end <= win[1].0.start),
                ParseError::from(EntryParseError::DataOverlap).into()
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

    fn to_bytes(&self) -> Result<Box<[u8]>, StoreError> {
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
                .ok_or(EntrySerializeError::BigData)
                .map_err(SerializeError::from)?;
            require!(
                offset.checked_add(length.into()).is_some(),
                SerializeError::NoSpace.into()
            );
            let offset = offset.to_le_bytes();
            let length = length.to_le_bytes();
            let name_len = name
                .len()
                .checked_cast::<u8>()
                .ok_or(EntrySerializeError::LongName)
                .map_err(SerializeError::from)?;
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
            SerializeError::SizeLimit.into()
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
