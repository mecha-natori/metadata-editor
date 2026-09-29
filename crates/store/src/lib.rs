#![feature(decl_macro)]
#![feature(integer_casts)]
#![feature(read_le)]

use store_macro::create_store_abstraction;

pub mod error;

pub(crate) mod helper;

pub mod v1;

create_store_abstraction!(1);
