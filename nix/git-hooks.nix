{ inputs, ... }:
{
  imports = [
    (inputs.git-hooks.flakeModule or { })
  ];
  perSystem =
    {
      config,
      lib,
      pkgs,
      ...
    }:
    lib.optionalAttrs (inputs.git-hooks ? flakeModule) {
      pre-commit = {
        check.enable = true;
        settings = {
          hooks = {
            actionlint.enable = false; # treefmt
            check-json.enable = true;
            check-toml.enable = true;
            markdownlint = {
              enable = true;
              settings.configuration = {
                MD013 = false;
                MD024 = false;
                MD026 = false;
                MD033 = false;
                MD040 = false;
              };
            };
            mdformat.enable = false; # treefmt
            ms0503-check-deps-hash = {
              enable = true;
              entry =
                builtins.readFile ./check-deps-hash.sh |> pkgs.writeScriptBin "check-deps-hash" |> lib.getExe;
              files = "^(deps-hash\\.txt|pnpm-lock\\.yaml)";
            };
            nil.enable = true;
            nixfmt.enable = false; # treefmt
            treefmt = {
              enable = true;
              package = config.treefmt.build.wrapper;
            };
            yamlfmt.enable = false; # treefmt
            yamllint.enable = false; # treefmt
          };
          src = ../.;
        };
      };
    };
}
