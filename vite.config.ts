import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
    build: {
        assetsDir: 'static',
        cssMinify: 'lightningcss',
        emptyOutDir: false,
        minify: 'oxc',
        ssrEmitAssets: true
    },
    clearScreen: false,
    envPrefix: ['TAURI_ENV_', 'VITE_'],
    plugins: [react(), tailwindcss()],
    resolve: { builtins: [/^node:/u], tsconfigPaths: true },
    server: {
        // oxlint-disable-next-line eslint/no-undefined
        hmr: host ? { host, port: 1421, protocol: 'ws' } : undefined,
        host: host ?? false,
        port: 1420,
        strictPort: true,
        watch: {
            followSymlinks: false,
            ignored: [
                '**/*.nix',
                '**/.direnv/**',
                '**/.pre-commit-config.yaml',
                '**/flake.*',
                '**/nix/**',
                '**/result/**',
                '**/src-tauri/**',
                '**/target/**'
            ]
        }
    },
    ssr: { target: 'node' }
});
