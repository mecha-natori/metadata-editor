use indexmap::IndexMap;
use rustc_hash::FxBuildHasher;
use std::io;
use std::io::Read;

pub type FxIndexMap<K, V> = IndexMap<K, V, FxBuildHasher>;

pub macro require($cond:expr, $err:expr) {
    if !$cond {
        return Err($err);
    }
}

pub trait ReadByte: Read {
    #[inline]
    fn read_byte(&mut self) -> io::Result<u8> {
        let mut buf = [0; 1];
        self.read_exact(&mut buf)?;
        Ok(buf[0])
    }
}

impl<T> ReadByte for T where T: Read
{
}
