use proc_macro::TokenStream;
use proc_macro_crate::FoundCrate;
use proc_macro_crate::crate_name;
use quote::format_ident;
use quote::quote;
use syn::LitInt;
use syn::Token;
use syn::parse::Parse;
use syn::parse::ParseStream;
use syn::parse_macro_input;

#[proc_macro]
pub fn create_store_abstraction(input: TokenStream) -> TokenStream {
    let StoreAbstractionInput {
        versions
    } = parse_macro_input!(input as StoreAbstractionInput);
    let store = get_crate("store");
    let serde_repr = get_crate("serde_repr");
    let enum_variants = versions.iter().map(|ver| {
        let variant = format_ident!("V{}", ver);
        let module = format_ident!("v{}", ver);
        quote! {
            #variant(#store::#module::Store)
        }
    });
    let version_enum = versions.iter().map(|ver| {
        let variant = format_ident!("V{}", ver);
        quote! {
            #variant = #ver
        }
    });
    let new_arms = versions.iter().map(|ver| {
        let variant = format_ident!("V{}", ver);
        let module = format_ident!("v{}", ver);
        quote! {
            StoreVersion::#variant => Self::#variant(#store::#module::Store::new(length))
        }
    });
    let read_from_bytes_arms = versions.iter().map(|ver| {
        let variant = format_ident!("V{}", ver);
        let module = format_ident!("v{}", ver);
        quote! {
            #ver => Ok(
                Self::#variant(
                    #store::#module::Store::read_from_bytes(
                        data,
                        resv,
                        length
                    )?
                )
            )
        }
    });
    let to_bytes_arms = versions.iter().map(|ver| {
        let variant = format_ident!("V{}", ver);
        quote! {
            Self::#variant(inner) => inner.to_bytes()
        }
    });
    let from_impls = versions.iter().map(|ver| {
        let variant = format_ident!("V{}", ver);
        let module = format_ident!("v{}", ver);
        quote! {
            impl From<#store::#module::Store> for Store {
                fn from(value: #store::#module::Store) -> Self {
                    Self::#variant(value)
                }
            }
        }
    });
    quote! {
        #[derive(Clone, Debug, Eq, PartialEq)]
        pub enum Store {
            #(#enum_variants),*
        }

        #[derive(
            #serde_repr::Deserialize_repr,
            #serde_repr::Serialize_repr,
            Clone,
            Copy,
            Debug,
            Eq,
            Hash,
            Ord,
            PartialEq,
            PartialOrd
        )]
        #[repr(u8)]
        pub enum StoreVersion {
            #(#version_enum),*
        }

        impl Store {
            pub fn new(version: StoreVersion, length: u32) -> Self {
                match version {
                    #(#new_arms),*
                }
            }

            pub fn read_from_bytes<T>(
                data: &mut T,
                length: u32
            ) -> Result<Self, #store::error::StoreError>
            where
                T: ::std::io::Read
            {
                let (version, resv) = {
                    let b = <T as #store::helper::ReadByte>::read_byte(data)
                        .map_err(|_|
                            #store::error::ParseError::ReadFailed("version")
                        )?;
                    (b >> 4, b & 0x0f)
                };
                match version {
                    #(#read_from_bytes_arms,)*
                    _ => Err(
                        #store::error::ParseError::UnknownVersion(version).into()
                    )
                }
            }

            pub fn to_bytes(
                &self
            ) -> Result<Box<[u8]>, #store::error::StoreError> {
                match self {
                    #(#to_bytes_arms),*
                }
            }
        }

        #(#from_impls)*
    }
    .into()
}

struct StoreAbstractionInput {
    versions: Vec<u8>
}

impl Parse for StoreAbstractionInput {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let mut versions = vec![];
        while !input.is_empty() {
            let lit = input.parse::<LitInt>()?;
            let ver = lit.base10_parse::<u8>()?;
            if 0x0f < ver {
                return Err(syn::Error::new(
                    lit.span(),
                    "store version must be in the range 0..=15"
                ));
            }
            versions.push(ver);
            if input.is_empty() {
                break;
            }
            input.parse::<Token![,]>()?;
        }
        Ok(Self {
            versions
        })
    }
}

fn get_crate(name: impl AsRef<str>) -> proc_macro2::TokenStream {
    let name = name.as_ref();
    match crate_name(name).unwrap_or_else(|_| panic!("crate '{}' must exist", name)) {
        FoundCrate::Itself => quote!(crate),
        FoundCrate::Name(name) => {
            let ident = format_ident!("{}", name);
            quote!(::#ident)
        }
    }
}
