import { useResult } from './hooks/result';
import { getAllBoardNames, getBoard } from '@/lib/boards';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useState } from 'react';
import { z } from 'zod';
import type { ChangeEvent, JSX, SubmitEvent } from 'react';

const formatSchema = z.object({
    action: z.literal('format'),
    length: z.coerce
        .number()
        .int('サイズは符号なし整数である必要があります。')
        .min(
            3,
            `サイズは少なくとも${3}×512B=${bytesToString(3 * 512)}以上である必要があります。`
        )
        .max(
            0xffff,
            `サイズは${0xffff}×512B=${bytesToString(0xffff * 512)}以下である必要があります。`
        ),
    rootEntries: z.coerce
        .number()
        .int('直下のエントリ数は符号なし整数である必要があります。')
        .min(
            1,
            '直下のエントリ数は少なくとも1×32個=32個以上である必要があります。'
        )
        .max(
            0x10000 / 32 - 1,
            `直下のエントリ数は${0x10000 / 32 - 1}×32個=${0x10000 - 32}個以下である必要があります。`
        )
});
const mountSchema = z.object({ action: z.literal('mount') });
const unmountSchema = z.object({ action: z.literal('unmount') });
const formSchema = z.intersection(
    z.object({ board: z.string().transform(board => getBoard(board)!) }),
    z.discriminatedUnion(
        'action',
        [formatSchema, mountSchema, unmountSchema],
        '不明なアクションです。'
    )
);

export function App(): JSX.Element {
    const { ShowResult, result, setError, setOk } = useResult();
    const boards = getAllBoardNames();
    const [board, setBoard] = useState(boards[0]);
    const handleBoardChange = useCallback(
        (e: ChangeEvent<HTMLSelectElement, HTMLSelectElement>) => {
            setBoard(e.currentTarget.value);
        },
        []
    );
    const [sectors, setSectors] = useState(formatSchema.shape.length.minValue!);
    const handleSectorsChange = useCallback(
        (e: ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
            setSectors(Number.parseInt(e.currentTarget.value, 10));
        },
        []
    );
    const handleSubmit = useCallback(
        (e: SubmitEvent<HTMLFormElement>) => {
            e.preventDefault();
            const formData = formSchema.safeParse(
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
            const { action, board } = formData.data;
            switch (action) {
                case 'format': {
                    const { length, rootEntries } = formData.data;
                    let baseAddr = board.banks.at(-1)!.base;
                    let bankLength = 0;
                    for (const bank of board.banks.toReversed()) {
                        baseAddr = bank.base;
                        bankLength += bank.length;
                        if (length <= bankLength) {
                            break;
                        }
                    }
                    if (bankLength < length) {
                        setError(
                            `サイズが大きすぎます。 最大サイズ:${bankLength}B (※プログラムなども含めての容量のため、より小さくする必要があります)`
                        );
                        return;
                    }
                    invoke('format', {
                        baseAddr,
                        chipFamily: board.chip.family,
                        chipName: board.chip.name,
                        length: bankLength,
                        rootEntries: rootEntries * 32
                    })
                        .then(() => {
                            setOk(
                                `初期化に成功しました！ ベースアドレス:0x${baseAddr.toString(16).padStart(8, '0')} サイズ:${bankLength}B`
                            );
                        })
                        // oxlint-disable-next-line promise/prefer-await-to-callbacks
                        .catch((err: unknown) => {
                            // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-type-assertion
                            setError(err as string);
                        });
                    break;
                }
                case 'mount':
                    setError('未実装です。');
                    break;
                case 'unmount':
                    setError('未実装です。');
                    break;
            }
        },
        [setError, setOk]
    );
    return (
        <div className="flex min-h-screen w-screen flex-col items-center justify-center px-8 py-16">
            <h1>メタデータエディタ</h1>
            <p>メカトロ製基板のメタデータ領域を操作します。</p>
            <ShowResult result={result} />
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
            <div>
                <form
                    className="my-8 flex flex-col items-center justify-center gap-8 rounded-2xl border px-8 py-6"
                    onSubmit={handleSubmit}
                >
                    <div className="flex w-full flex-col items-center justify-center gap-4">
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <label htmlFor="length">
                                サイズ({formatSchema.shape.length.minValue}〜
                                {formatSchema.shape.length.maxValue}):
                            </label>
                            <div
                                className="flex w-full flex-row items-center after:ml-2 after:whitespace-nowrap after:content-[attr(data-after)]"
                                data-after={`×512B=${bytesToString(sectors * 512)}`}
                            >
                                <input
                                    className="w-0 flex-grow px-1 text-right"
                                    id="length"
                                    name="length"
                                    onChange={handleSectorsChange}
                                    type="number"
                                    value={sectors}
                                />
                            </div>
                        </div>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <label htmlFor="root-entries">
                                直下のエントリ数(
                                {formatSchema.shape.rootEntries.minValue}〜
                                {formatSchema.shape.rootEntries.maxValue}):
                            </label>
                            <div className="flex w-full flex-row items-center after:ml-2 after:whitespace-nowrap after:content-['×32個']">
                                <input
                                    className="w-0 flex-grow px-1 text-right"
                                    defaultValue={1}
                                    id="root-entries"
                                    name="rootEntries"
                                    type="number"
                                />
                            </div>
                        </div>
                    </div>
                    <input
                        name="action"
                        type="hidden"
                        value="format"
                    />
                    <input
                        name="board"
                        type="hidden"
                        value={board}
                    />
                    <button
                        className="cursor-pointer rounded-4xl bg-(--foreground) px-12 py-3 text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                        type="submit"
                    >
                        初期化
                    </button>
                </form>
                <div className="my-8 flex flex-col items-center justify-center gap-4 rounded-2xl border px-8 py-6">
                    <form
                        className="flex flex-col items-center justify-center"
                        onSubmit={handleSubmit}
                    >
                        <input
                            name="action"
                            type="hidden"
                            value="mount"
                        />
                        <input
                            name="board"
                            type="hidden"
                            value={board}
                        />
                        <button
                            className="cursor-pointer rounded-4xl bg-(--foreground) px-12 py-3 text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                            type="submit"
                        >
                            仮想ディスクとしてマウント(WIP)
                        </button>
                    </form>
                    <form
                        className="flex flex-col items-center justify-center"
                        onSubmit={handleSubmit}
                    >
                        <input
                            name="action"
                            type="hidden"
                            value="unmount"
                        />
                        <input
                            name="board"
                            type="hidden"
                            value={board}
                        />
                        <button
                            className="cursor-pointer rounded-4xl bg-(--foreground) px-12 py-3 text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                            type="submit"
                        >
                            仮想ディスクをアンマウント(WIP)
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function bytesToString(bytes: number): string {
    if (2 ** 20 <= bytes) {
        return `${bytes / 2 ** 20}MiB`;
    }
    if (2 ** 10 <= bytes) {
        return `${bytes / 2 ** 10}KiB`;
    }
    return `${bytes}B`;
}
