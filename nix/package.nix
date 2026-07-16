{
  cairo,
  cargo-tauri,
  dbus,
  fetchPnpmDeps,
  gdk-pixbuf,
  glib,
  gtk3,
  lib,
  libsoup_3,
  mold,
  myLib,
  nodejs-slim,
  pkg-config,
  pnpm,
  pnpmConfigHook,
  pnpmDepsHash,
  rustPlatform,
  stdenv,
  webkitgtk_4_1,
  wrapGAppsHook3,
}:
let
  inherit (myLib) filters;
  inherit (myLib.build) cleanSourcePipe;
  cargoToml = ../src-tauri/Cargo.toml |> builtins.readFile |> builtins.fromTOML;
  pnpm' = pnpm.override {
    inherit nodejs-slim;
  };
  runtimeLibraries = [
    cairo
    dbus
    gdk-pixbuf
    glib
    gtk3
    libsoup_3
    webkitgtk_4_1
  ];
in
rustPlatform.buildRustPackage (finalAttrs: {
  inherit (cargoToml.package) version;
  RUSTFLAGS = lib.optionalString stdenv.buildPlatform.isLinux "-Clink-arg=-fuse-ld=mold";
  buildInputs = runtimeLibraries;
  cargoLock.lockFile = ../Cargo.lock;
  meta = {
    inherit (cargoToml.package) description;
    downloadPage = "https://github.com/mecha-natori/metadata-editor/releases";
    homepage = "https://github.com/mecha-natori/metadata-editor/#readme";
    license = lib.licenses.mit;
    mainProgram = "metadata-editor";
    sourceProvenance = with lib.sourceTypes; [
      fromSource
    ];
  };
  nativeBuildInputs = [
    cargo-tauri.hook
    nodejs-slim
    pkg-config
    pnpm'
    pnpmConfigHook
    wrapGAppsHook3
  ]
  ++ lib.optional stdenv.buildPlatform.isLinux mold;
  pname = cargoToml.package.name;
  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) patches pname src;
    fetcherVersion = 4;
    hash = pnpmDepsHash;
    pnpm = pnpm';
    version = "";
  };
  preFixup = ''
    gappsWrapperArgs+=(
      --prefix LD_LIBRARY_PATH : "${lib.makeLibraryPath runtimeLibraries}"
      --set __GL_THREADED_OPTIMIZATIONS 0
      --set __NV_DISABLE_EXPLICIT_SYNC 1
    )
  '';
  src = cleanSourcePipe ../. [
    filters.isNotNixDirectory
    filters.isNotNixFiles
  ];
})
