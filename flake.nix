{
  inputs = {
    fenix = {
      inputs.nixpkgs.follows = "nixpkgs";
      url = "github:nix-community/fenix";
    };
    flake-compat = {
      flake = false;
      url = "github:NixOS/flake-compat";
    };
    flake-parts = {
      inputs.nixpkgs-lib.follows = "nixpkgs";
      url = "github:hercules-ci/flake-parts";
    };
    git-hooks = {
      inputs = {
        flake-compat.follows = "";
        nixpkgs.follows = "nixpkgs";
      };
      url = "github:cachix/git-hooks.nix";
    };
    ms0503-lib = {
      inputs = {
        flake-compat.follows = "";
        flake-parts.follows = "flake-parts";
        git-hooks.follows = "";
        nixpkgs.follows = "nixpkgs";
        treefmt-nix.follows = "";
      };
      url = "github:ms0503/lib.nix";
    };
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems = {
      flake = false;
      url = "github:nix-systems/default";
    };
    treefmt-nix = {
      inputs.nixpkgs.follows = "nixpkgs";
      url = "github:numtide/treefmt-nix";
    };
  };
  nixConfig = {
    experimental-features = [
      "flakes"
      "nix-command"
      "pipe-operators"
    ];
    substituters = [
      "https://cache.nixos.org"
      "https://ms0503.cachix.org"
      "https://nix-community.cachix.org"
    ];
    trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "ms0503.cachix.org-1:Cc2mXpepZr7O9aFcRj5jq3mIcvdUPp85sLFuQj+IKbM="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };
  outputs =
    inputs@{
      flake-parts,
      ms0503-lib,
      systems,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        ./nix/treefmt.nix
        ./nix/git-hooks.nix
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
                  (pnpm.override {
                    nodejs-slim = nodejs-slim_latest;
                  })
                  at-spi2-atk
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
          packages.default =
            let
              inherit (pkgs) callPackage makeRustPlatform;
              rustPlatform = makeRustPlatform {
                inherit (inputs'.fenix.packages.latest) cargo rustc;
              };
            in
            callPackage ./nix/package.nix {
              inherit rustPlatform;
              myLib = ms0503-lib.lib;
              nodejs-slim = pkgs.nodejs-slim_26;
              pnpm = pkgs.pnpm_11;
              pnpmDepsHash = "sha256-j0R1tt0hQIwOB+uljSqd+zMopJp01igavq4RMZnEYpw=";
            };
        };
      systems = import systems;
    };
}
