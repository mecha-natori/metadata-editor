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
      git-hooks,
      ms0503-lib,
      systems,
      treefmt-nix,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        (git-hooks.flakeModule or { })
        (treefmt-nix.flakeModule or { })
        ./nix/shell
      ];
      perSystem =
        { inputs', pkgs, ... }:
        {
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
              pnpm = pkgs.pnpm_12;
              pnpmDepsHash = builtins.readFile ./deps-hash.txt;
            };
        };
      systems = import systems;
    };
}
