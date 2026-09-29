use thiserror::Error;

#[derive(Debug, Eq, Error, PartialEq)]
pub enum StoreError {
    #[error(transparent)]
    Parse(#[from] ParseError),
    #[error(transparent)]
    Serialize(#[from] SerializeError)
}

#[derive(Debug, Eq, Error, PartialEq)]
pub enum ParseError {
    #[error(transparent)]
    Entry(#[from] EntryParseError),
    #[error("Header length mismatched: expected {0}, actual {1}")]
    HeaderLengthMismatch(u16, usize),
    #[error("Invalid reserved area")]
    InvalidReservedArea,
    #[error("Failed to read {0}")]
    ReadFailed(&'static str),
    #[error("Unknown version: {0}")]
    UnknownVersion(u8)
}

#[derive(Debug, Eq, Error, PartialEq)]
pub enum EntryParseError {
    #[error("Entry data overlap")]
    DataOverlap,
    #[error("Invalid entry name")]
    InvalidName,
    #[error("Entry name duplicated: {0}")]
    NameDuplicated(String)
}

#[derive(Debug, Eq, Error, PartialEq)]
pub enum SerializeError {
    #[error("Too big header")]
    BigHeader,
    #[error(transparent)]
    Entry(#[from] EntrySerializeError),
    #[error("Too many entries")]
    ManyEntries,
    #[error("No space left")]
    NoSpace,
    #[error("Store size limit exceeded")]
    SizeLimit
}

#[derive(Debug, Eq, Error, PartialEq)]
pub enum EntrySerializeError {
    #[error("Too big entry data")]
    BigData,
    #[error("Too long entry name")]
    LongName
}
