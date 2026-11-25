#!/usr/bin/env node

import { load as loadToml } from 'js-toml';
import { open, opendir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_DIR = join(import.meta.dirname, '../..');
const OUT_DIR = join(BASE_DIR, 'out');
const OUT_FILE = join(OUT_DIR, 'update.json');

await main().catch(console.error);

async function main() {
    const version = await (async () => {
        const content = await (async () => {
            try {
                return readFile(join(BASE_DIR, 'Cargo.toml'), {
                    encoding: 'utf8'
                });
            } catch (err) {
                if (isSystemError(err) && err.code === 'ENOENT') {
                    throw new Error('Workspace manifest not found.', {
                        cause: err
                    });
                }
                throw new Error('Unknown error.', { cause: err });
            }
        })();
        const manifest = loadToml(content);
        // @ts-expect-error 型定義端折った代償
        // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-assignment typescript/no-unsafe-member-access typescript/no-unsafe-type-assertion
        return manifest.workspace.package.version as string;
    })();
    await using outDir = await (async () => {
        try {
            return opendir(OUT_DIR, { encoding: 'utf8' });
        } catch (err) {
            if (isSystemError(err) && err.code === 'ENOENT') {
                throw new Error('Output directory not found.', { cause: err });
            }
            throw new Error('Unknown error.', { cause: err });
        }
    })();
    await using file = await open(OUT_FILE, 'w', 0o0644);
    const sigPromises: {
        [key in keyof Signatures]: Promise<Signatures[key]> | null;
    } = { linuxAmd64: null, macosUniversal: null, windowsAmd64: null };
    for await (const f of outDir) {
        if (f.name.endsWith('_amd64.AppImage.sig')) {
            sigPromises.linuxAmd64 = (async () => {
                try {
                    return readFile(join(f.parentPath, f.name), {
                        encoding: 'utf8'
                    });
                } catch (err) {
                    if (isSystemError(err) && err.code === 'ENOENT') {
                        throw new Error(
                            `Signature file '${f.name}' not found.`,
                            { cause: err }
                        );
                    }
                    throw new Error('Unknown error.', { cause: err });
                }
            })();
        }
        if (f.name.endsWith('_universal.app.tar.gz.sig')) {
            sigPromises.macosUniversal = (async () => {
                try {
                    return readFile(join(f.parentPath, f.name), {
                        encoding: 'utf8'
                    });
                } catch (err) {
                    if (isSystemError(err) && err.code === 'ENOENT') {
                        throw new Error(
                            `Signature file '${f.name}' not found.`,
                            { cause: err }
                        );
                    }
                    throw new Error('Unknown error.', { cause: err });
                }
            })();
        }
        if (f.name.endsWith('_x64_ja-JP.msi.sig')) {
            sigPromises.windowsAmd64 = (async () => {
                try {
                    return readFile(join(f.parentPath, f.name), {
                        encoding: 'utf8'
                    });
                } catch (err) {
                    if (isSystemError(err) && err.code === 'ENOENT') {
                        throw new Error(
                            `Signature file '${f.name}' not found.`,
                            { cause: err }
                        );
                    }
                    throw new Error('Unknown error.', { cause: err });
                }
            })();
        }
    }
    const sigs = await Promise.allKeyed(
        sigPromises as { [key in keyof Signatures]: Promise<Signatures[key]> }
    );
    const manifest = {
        notes: '',
        platforms: {
            'darwin-universal': {
                signature: sigs.macosUniversal,
                url: `https://github.com/mecha-natori/metadata-editor/releases/v${version}/mechatronicslab-circuit-metadata-editor_${version}_universal.app.tar.gz`
            },
            'linux-x86_64': {
                signature: sigs.linuxAmd64,
                url: `https://github.com/mecha-natori/metadata-editor/releases/v${version}/mechatronicslab-circuit-metadata-editor_${version}_amd64.AppImage`
            },
            'windows-x86_64': {
                signature: sigs.windowsAmd64,
                url: `https://github.com/mecha-natori/metadata-editor/releases/v${version}/mechatronicslab-circuit-metadata-editor_${version}_x64_ja-JP.msi`
            }
        },
        pub_date: Temporal.Now.instant(),
        version
    } satisfies UpdateManifest;
    await file.writeFile(JSON.stringify(manifest), { encoding: 'utf8' });
}

interface UpdateFileManifest {
    signature: string;
    url: string;
}

interface UpdateManifest {
    notes: string;
    platforms: Record<string, UpdateFileManifest>;
    pub_date: Temporal.Instant;
    version: string;
}

interface Signatures {
    linuxAmd64: string;
    macosUniversal: string;
    windowsAmd64: string;
}

interface SystemError {
    code: string;
}

function isSystemError(err: unknown): err is SystemError {
    return Error.isError(err) && 'code' in err && typeof err.code === 'string';
}
