#![feature(decl_macro)]
#![feature(integer_casts)]
#![feature(read_le)]

use crate::error::StoreError;
use crate::helper::FxIndexMap;
use std::io::Read;
use store_macro::create_store_abstraction;

pub mod error;

pub(crate) mod helper;

pub mod v1;

pub trait StoreApi
where
    Self: Sized
{
    fn new(length: u32) -> Self;
    fn get_entries(&self) -> &FxIndexMap<String, Vec<u8>>;
    fn get_entry(&self, name: impl AsRef<str>) -> Option<&Vec<u8>>;
    fn get_entry_mut(&mut self, name: impl AsRef<str>) -> Option<&mut Vec<u8>>;
    fn create_entry(
        &mut self,
        name: impl Into<String>,
        data: impl AsRef<[u8]>
    ) -> Result<(), StoreError>;
    fn remove_entry(&mut self, name: impl AsRef<str>) -> Result<Vec<u8>, StoreError>;
    fn rename_entry(
        &mut self,
        old_name: impl Into<String>,
        new_name: impl Into<String>
    ) -> Result<(), StoreError>;
    fn read_from_bytes(data: &mut impl Read, resv: u8, length: u32) -> Result<Self, StoreError>;
    fn to_bytes(&self) -> Result<Box<[u8]>, StoreError>;
}

create_store_abstraction!(1);
