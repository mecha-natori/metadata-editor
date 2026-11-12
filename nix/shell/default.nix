{
  imports = [
    ./git-hooks.nix
    ./treefmt.nix
  ];
  perSystem =
    {
      config,
      inputs',
      lib,
      pkgs,
      system,
      ...
    }:
    {
      devShells.shell =
        let
          libraries = with pkgs; [
            cairo
            dbus
            gdk-pixbuf
            glib
            gtk3
            libsoup_3
            webkitgtk_4_1
          ];
        in
        pkgs.mkShell {
          __NV_DISABLE_EXPLICIT_SYNC = 1;
          LD_LIBRARY_PATH = lib.makeLibraryPath libraries;
          RUSTFLAGS = lib.optionalString (system |> lib.hasSuffix "-linux") "-Clink-arg=-fuse-ld=mold";
          packages = builtins.concatLists [
            config.pre-commit.settings.enabledPackages
            (config.treefmt.build.programs |> lib.attrValues)
            libraries
            (with pkgs; [
              (builtins.readFile ./update-deps-hash.sh |> writeScriptBin "update-deps-hash")
              (pnpm.override {
                nodejs-slim = nodejs-slim_latest;
              })
              at-spi2-atk
              bash
              gawk
              gnugrep
              nodejs-slim_latest
              pango
              pkg-config
            ])
            (lib.optional (system |> lib.hasSuffix "-linux") pkgs.mold)
            (with inputs'.fenix.packages; [
              (latest.withComponents [
                "cargo"
                "clippy"
                "rust-analyzer"
                "rust-src"
                "rustc"
                "rustfmt"
              ])
            ])
          ];
          shellHook = ''
            ${config.pre-commit.shellHook}
            export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH"
          '';
        };
    };
}
