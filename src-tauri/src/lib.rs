use probe_rs::MemoryInterface;
use probe_rs::Session;
use probe_rs::SessionConfig;
use probe_rs::flashing::DownloadOptions;
use probe_rs::probe::WireProtocol;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;
use store::Store;
use tauri::Manager;

mod cmd;

pub fn run() -> anyhow::Result<()> {
    env_logger::init();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cmd::format,
            cmd::get_data,
            cmd::load,
            cmd::save
        ])
        .setup(|app| {
            app.manage(Mutex::new(AppState::default()));
            Ok(())
        })
        .run(tauri::generate_context!())?;
    Ok(())
}

#[derive(Debug, Default, Eq, PartialEq)]
pub(crate) struct AppState {
    pub chip_family: Option<ChipFamily>,
    pub chip_name: Option<String>,
    pub store: Option<Store>,
    pub store_base: Option<u32>
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ChipFamily {
    Esp32,
    Stm32
}

pub(crate) fn read(
    bank_base: u32,
    bank_length: u32,
    chip_family: ChipFamily,
    chip_name: impl AsRef<str>
) -> Result<(Vec<u8>, u32), String> {
    let chip_name = chip_name.as_ref();
    let protocol = match chip_family {
        ChipFamily::Esp32 => WireProtocol::Jtag,
        ChipFamily::Stm32 => WireProtocol::Swd
    };
    let session_config = SessionConfig {
        protocol: Some(protocol),
        speed: Some(1000),
        ..Default::default()
    };
    let mut session = Session::auto_attach(chip_name, session_config)
        .map_err(|_| "基板との接続に失敗しました。")?;
    let mut core = session
        .core(0)
        .map_err(|_| "MCUへのアクセスに失敗しました。")?;
    if core.halt(Duration::from_millis(200)).is_err() {
        return Err("MCUの停止に失敗しました。".into());
    }
    let store_length = {
        let mut buf = vec![0; bank_length as usize];
        core.read(bank_base.into(), &mut buf)
            .map_err(|_| "フラッシュの読み取りに失敗しました。")?;
        let bytes = buf.iter().rev().take(4).copied().collect::<Vec<_>>();
        u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
    };
    let store_base = bank_base + bank_length - store_length;
    let mut buf = vec![0; store_length as usize];
    core.read(store_base.into(), &mut buf)
        .map_err(|_| "フラッシュの読み取りに失敗しました。")?;
    Ok((buf, store_base))
}

pub(crate) fn write(
    bank_base: u32,
    bytes: impl AsRef<[u8]>,
    chip_family: ChipFamily,
    chip_name: impl AsRef<str>
) -> Result<(), String> {
    let chip_name = chip_name.as_ref();
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
    let mut session = Session::auto_attach(chip_name, session_config)
        .map_err(|_| "基板との接続に失敗しました。")?;
    {
        let mut core = session
            .core(0)
            .map_err(|_| "MCUへのアクセスに失敗しました。")?;
        if core.halt(Duration::from_millis(200)).is_err() {
            return Err("基板の停止に失敗しました。".into());
        }
    }
    let mut loader = session.target().flash_loader();
    if loader.add_data(bank_base.into(), bytes).is_err()
        || loader.commit(&mut session, download_options).is_err()
    {
        return Err("基板への書き込みに失敗しました".into());
    }
    Ok(())
}
