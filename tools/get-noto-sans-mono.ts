#!/usr/bin/env node

import { load as loadToml } from 'js-toml';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_DIR = join(import.meta.dirname, '..');
const CARGO_TOML_FILE = join(BASE_DIR, 'Cargo.toml');
const FONT_DIR = join(BASE_DIR, 'public/fonts');
const FONT_FILE = join(FONT_DIR, 'NotoSansMono.woff2');

const cargoToml = await readFile(CARGO_TOML_FILE, { encoding: 'utf8' }).then(
    file => loadToml(file)
);
// @ts-expect-error 型定義端折った代償
// oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-assignment typescript/no-unsafe-member-access typescript/no-unsafe-type-assertion
const version = cargoToml.workspace.package.version as string;

const USER_AGENT = `AppleWebKit/537.36 Chrome/128.0.0.0 metadata-editor/${version}`;
const CSS_URL =
    'https://fonts.googleapis.com/css2?family=Noto+Sans+Mono:wdth,wght@100,400&text=0123456789abcdef';
const FONT_URL_PATTERN = /src: url\((.+)\) format\('woff2'\);/u;

async function main() {
    const css = await fetch(CSS_URL, {
        headers: { 'User-Agent': USER_AGENT }
    }).then(async res => res.text());
    const fontUrl = (() => {
        const captures = FONT_URL_PATTERN.exec(css);
        if (!captures) {
            throw new Error('Unknown font CSS detected');
        }
        return captures[1];
    })();
    const font = await fetch(fontUrl)
        .then(async res => res.arrayBuffer())
        .then(buf => new Uint8Array(buf));
    await mkdir(FONT_DIR, { recursive: true });
    await writeFile(FONT_FILE, font);
}

await main().catch(console.error);
