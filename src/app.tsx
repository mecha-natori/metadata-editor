import { Modal } from './components/modal';
import { useResult } from './hooks/result';
import { useSwitchState } from './hooks/switch-state';
import { getAllBoardNames, getBoard } from '@/lib/boards';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useState } from 'react';
import { z } from 'zod';
import type { ChangeEvent, JSX, SubmitEvent } from 'react';

const formatFormSchema = z.object({
    board: z.string().transform(board => getBoard(board)!),
    length: z.coerce
        .number()
        .int('サイズは整数である必要があります。')
        .min(8, 'サイズは8B以上である必要があります。')
        .max(
            0xffffffff,
            `サイズは${bytesToString(0xffffffff)}(${0xffffffff}B)以下である必要があります。`
        ),
    version: z.enum(['1'])
});

export function App(): JSX.Element {
    const { ShowResult, result, setError, setOk } = useResult();
    const boards = getAllBoardNames();
    const versions = Object.values(formatFormSchema.shape.version.enum);
    const [board, setBoard] = useState(boards[0]);
    const [length, setLength] = useState(8);
    const [formatModalOpen, handleFormatModalClose, handleFormatModalOpen] =
        useSwitchState(false);
    const handleBoardChange = useCallback(
        (e: ChangeEvent<HTMLSelectElement, HTMLSelectElement>) => {
            setBoard(e.currentTarget.value);
        },
        []
    );
    const handleLengthChange = useCallback(
        (e: ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
            setLength(Number.parseInt(e.currentTarget.value, 10));
        },
        []
    );
    const handleFormat = useCallback(
        (e: SubmitEvent<HTMLFormElement>) => {
            e.preventDefault();
            const formData = formatFormSchema.safeParse(
                Object.fromEntries(new FormData(e.target))
            );
            if (!formData.success) {
                setError(
                    <>
                        {formData.error.issues.map((issue, i) => (
                            <p key={i}>{issue.message}</p>
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
                .catch((err: unknown) => {
                    setError(err as string);
                });
        },
        [setError, setOk]
    );
    return (
        <>
            <div className="flex min-h-screen w-screen flex-col items-center justify-center px-8 py-16">
                <h1>メタデータエディタ</h1>
                <p>メカトロ製基板のメタデータストアを操作します。</p>
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
                <button
                    className="m-4 cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                    onClick={handleFormatModalOpen}
                    type="button"
                >
                    フォーマット
                </button>
            </div>
            <Modal
                onClose={handleFormatModalClose}
                open={formatModalOpen}
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
            </Modal>
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
