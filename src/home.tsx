import { useModal } from './hooks/modal';
import { useResult } from './hooks/result';
import { getAllBoardNames, getBoard } from '@/lib/boards';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import type { ChangeEvent, JSX, MouseEvent, SubmitEvent } from 'react';

const formatFormSchema = z.object({
    board: z.string().transform(board => getBoard(board)!),
    length: z.coerce
        .number()
        .int('サイズは整数である必要があります。')
        .min(8, 'サイズは8B以上である必要があります。')
        .max(
            0xffff_ffff,
            `サイズは${bytesToString(0xffff_ffff)}(4294967295B)以下である必要があります。`
        ),
    version: z.enum(['1'])
});

export function Home(): JSX.Element {
    const { ShowResult, result, setError, setOk } = useResult();
    const boards = getAllBoardNames();
    const versions = Object.values(formatFormSchema.shape.version.enum);
    const [board, setBoard] = useState(boards[0]);
    const [length, setLength] = useState(8);
    const {
        Modal: FormatModal,
        handleClose: handleFormatModalClose,
        handleOpen: handleFormatModalOpen,
        open: formatModalOpen,
        ref: formatModalRef
    } = useModal();
    const handleBoardChange = useCallback(
        (e: ChangeEvent<HTMLSelectElement>) => {
            setBoard(e.currentTarget.value);
        },
        []
    );
    const handleLengthChange = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setLength(Number.parseInt(e.currentTarget.value, 10));
        },
        []
    );
    const handleDump = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            const boardData = getBoard(board)!;
            const bankBase = boardData.banks.at(-1)!.base;
            const bankLength = boardData.banks.at(-1)!.length;
            const chipFamily = boardData.chip.family;
            const chipName = boardData.chip.name;
            invoke('dump', { bankBase, bankLength, chipFamily, chipName })
                .then(() => {
                    alert('ファイル書き出しが完了しました。');
                })
                .catch(alert);
        },
        [board]
    );
    const handleRestore = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            const boardData = getBoard(board)!;
            const chipFamily = boardData.chip.family;
            const chipName = boardData.chip.name;
            invoke('restore', { chipFamily, chipName })
                .then(() => {
                    alert('ファイルからの復元が完了しました。');
                })
                .catch(alert);
        },
        [board]
    );
    const handleFormat = useCallback(
        (e: SubmitEvent) => {
            e.preventDefault();
            const formData = formatFormSchema.safeParse(
                Object.fromEntries(new FormData(e.target))
            );
            if (!formData.success) {
                setError(
                    <>
                        {formData.error.issues.map(issue => (
                            <p key={`${issue.path.join('')}:${issue.message}`}>
                                {issue.message}
                            </p>
                        ))}
                    </>
                );
                return;
            }
            const { board, length: minLength } = formData.data;
            const storeVersion = Number.parseInt(formData.data.version, 10);
            let storeBase = board.banks.at(-1)!.base;
            let storeLength = 0;
            for (const bank of board.banks.toReversed()) {
                storeBase = bank.base;
                storeLength += bank.length;
                if (minLength <= storeLength) {
                    break;
                }
            }
            if (storeLength < minLength) {
                setError(
                    `サイズが大きすぎます。最大サイズ:${storeLength}B (※プログラムなども含めての容量のため、より小さくする必要があります。)`
                );
                return;
            }
            invoke('format', {
                chipFamily: board.chip.family,
                chipName: board.chip.name,
                storeBase,
                storeLength,
                storeVersion
            })
                .then(() => {
                    setOk(
                        `フォーマットに成功しました！ ベースアドレス:0x${storeBase.toString(16).padStart(8, '0')} サイズ:${bytesToString(storeLength)}(${storeLength}B)`
                    );
                })
                // oxlint-disable-next-line promise/prefer-await-to-callbacks
                .catch((err: unknown) => {
                    // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-type-assertion
                    setError(err as string);
                });
        },
        [setError, setOk]
    );
    return (
        <>
            <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-8 px-8 py-16">
                <div className="flex flex-col items-center justify-center gap-2">
                    <h1>メタデータエディタ</h1>
                    <p>メカトロ製基板のメタデータストアを操作します。</p>
                </div>
                <div className="flex flex-col items-center justify-center gap-2">
                    <label htmlFor="board">基板:</label>
                    <select
                        className="rounded-lg border px-2 py-1"
                        id="board"
                        name="board"
                        onChange={handleBoardChange}
                        value={board}
                    >
                        {boards.map(board => (
                            <option
                                key={board}
                                value={board}
                            >
                                {board}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col items-center justify-center gap-4">
                    <button
                        className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
                        onClick={handleFormatModalOpen}
                        type="button"
                    >
                        フォーマット
                    </button>
                    <Link to={`/edit/${board}`}>
                        <button
                            className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
                            type="button"
                        >
                            読み込む
                        </button>
                    </Link>
                    {import.meta.env.TAURI_ENV_DEBUG && (
                        <Link to="/edit/test">
                            <button
                                className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
                                type="button"
                            >
                                [デバッグ用] ダミーを読み込む
                            </button>
                        </Link>
                    )}
                    <button
                        className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
                        onClick={handleDump}
                        type="button"
                    >
                        ファイル書き出し
                    </button>
                    <button
                        className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
                        onClick={handleRestore}
                        type="button"
                    >
                        ファイルからの復元
                    </button>
                </div>
            </div>
            <FormatModal
                onClose={handleFormatModalClose}
                open={formatModalOpen}
                ref={formatModalRef}
            >
                <ShowResult result={result} />
                <form
                    className="my-4 flex flex-col items-center justify-center gap-8"
                    onSubmit={handleFormat}
                >
                    <div className="flex w-full flex-col items-center justify-center gap-4">
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <label htmlFor="format-version">
                                ストアバージョン:
                            </label>
                            <div className="flex w-full flex-col items-center">
                                <select
                                    id="format-version"
                                    name="version"
                                >
                                    {versions.map(ver => (
                                        <option
                                            key={ver}
                                            value={ver}
                                        >
                                            v{ver}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <label htmlFor="format-length">
                                必要サイズ(実際はより大きくなる可能性があります):
                            </label>
                            <div
                                className="flex w-full flex-row items-center after:ml-2 after:whitespace-nowrap after:content-[attr(data-after)]"
                                data-after={`B (=${bytesToString(length)})`}
                            >
                                <input
                                    className="w-0 flex-grow rounded-sm border px-1 text-right"
                                    id="format-length"
                                    name="length"
                                    onChange={handleLengthChange}
                                    type="number"
                                    value={length}
                                />
                            </div>
                        </div>
                    </div>
                    <input
                        name="board"
                        type="hidden"
                        value={board}
                    />
                    <button
                        className="cursor-pointer rounded-4xl bg-(--foreground) px-12 py-3 text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                        type="submit"
                    >
                        フォーマット実行
                    </button>
                </form>
            </FormatModal>
        </>
    );
}

function bytesToString(bytes: number): string {
    if (2 ** 30 <= bytes) {
        return `${bytes / 2 ** 30}GiB`;
    }
    if (2 ** 20 <= bytes) {
        return `${bytes / 2 ** 20}MiB`;
    }
    if (2 ** 10 <= bytes) {
        return `${bytes / 2 ** 10}KiB`;
    }
    return `${bytes}B`;
}
