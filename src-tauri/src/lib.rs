use probe_rs::Session;
use probe_rs::SessionConfig;
use probe_rs::flashing::DownloadOptions;
use probe_rs::probe::WireProtocol;
use serde::Deserialize;
use serde::Serialize;
use std::time::Duration;

mod store;

pub fn run() -> anyhow::Result<()> {
    env_logger::init();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![store::format])
        .run(tauri::generate_context!())?;
    Ok(())
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ChipFamily {
    Esp32,
    Stm32
}

pub(crate) fn write<T>(
    bank_base: u64,
    bytes: T,
    chip_family: ChipFamily,
    chip_name: &str
) -> Result<(), String>
where
    T: AsRef<[u8]>
{
    let bytes = bytes.as_ref();
    let protocol = match chip_family {
        ChipFamily::Esp32 => WireProtocol::Jtag,
        ChipFamily::Stm32 => WireProtocol::Swd
    };
    let session_config = SessionConfig {
        protocol: Some(protocol),
        speed: Some(1000),
        ..Default::default()
    };
    let download_options = {
        let mut opts = DownloadOptions::default();
        opts.keep_unwritten_bytes = true;
        opts.verify = true;
        opts
    };
    let Ok(mut session) = Session::auto_attach(chip_name, session_config) else {
        return Err("基板との接続に失敗しました。".to_string());
    };
    if let Ok(mut core) = session.core(0)
        && let Ok(_) = core.halt(Duration::from_millis(200))
    {
        // nop
    } else {
        return Err("基板の停止に失敗しました。".to_string());
    }
    let mut loader = session.target().flash_loader();
    if let Ok(_) = loader.add_data(bank_base, bytes)
        && let Ok(_) = loader.commit(&mut session, download_options)
    {
        // nop
    } else {
        return Err("基板への書き込みに失敗しました".to_string());
    }
    Ok(())
}
