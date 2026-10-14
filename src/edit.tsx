import { getBoard, testBoard } from './lib/boards';
import { idFunc } from './lib/helper';
import { invoke } from '@tauri-apps/api/core';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Await, useNavigate, useParams } from 'react-router';
import type { JSX, MouseEvent } from 'react';

export function Edit(): JSX.Element {
    const params = useParams<'board'>();
    const board =
        import.meta.env.DEV && params.board === 'test'
            ? testBoard
            : getBoard(params.board!)!;
    const navigate = useNavigate();
    const [entryNames, setEntryNames] = useState<Array<string>>([]);
    const getEntryData = useCallback(async (name: string): Promise<string> => {
        try {
            return invoke('get_data', { name }).then(data =>
                new Uint8Array(data as ArrayBuffer).toHex()
            );
        } catch (err) {
            return `(取得失敗: ${err})`;
        }
    }, []);
    const handleSave = useCallback((e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        invoke('save')
            .then(() => {
                alert('保存が完了しました！');
            })
            .catch(err => {
                alert(err);
            });
    }, []);
    const handleSaveClose = useCallback((e: MouseEvent<HTMLButtonElement>) => {
        handleSave(e);
        navigate('/');
    }, []);
    const handleNoSaveClose = useCallback(
        (e: MouseEvent<HTMLButtonElement>) => {
            e.preventDefault();
            alert('TODO: 警告モーダル');
            navigate('/');
        },
        []
    );
    useEffect(() => {
        const bankBase = board.banks.at(-1)!.base;
        const bankLength = board.banks.at(-1)!.length;
        const chipFamily = board.chip.family;
        const chipName = board.chip.name;
        invoke('load', { bankBase, bankLength, chipFamily, chipName })
            .then(names => setEntryNames(names as Array<string>))
            .catch(err => {
                alert(err);
                navigate('/');
            });
    }, []);
    return (
        <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-8 px-8 pt-8 pb-16">
            <div className="flex w-full flex-row items-center justify-between">
                <div className="flex flex-row items-center gap-2">
                    <button
                        className="w-max cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
                        onClick={handleSaveClose}
                        type="button"
                    >
                        保存して終了
                    </button>
                    <button
                        className="w-max cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
                        onClick={handleSave}
                        type="button"
                    >
                        保存
                    </button>
                </div>
                <button
                    className="w-max cursor-pointer rounded-4xl border border-(--border-button-delete) bg-(--button-delete) px-8 py-3 text-lg transition-colors duration-200 hover:bg-(--hover-button-delete) hover:text-(--foreground)"
                    onClick={handleNoSaveClose}
                    type="button"
                >
                    保存せずに終了
                </button>
            </div>
            <table className="grid w-full grid-cols-[1fr_1fr_minmax(8rem,_0.4fr)] rounded-md border">
                <thead className="contents">
                    <tr className="col-span-full grid grid-cols-subgrid border-b">
                        <th className="grid place-items-center border-r p-2 text-lg">
                            エントリ名
                        </th>
                        <th className="grid place-items-center border-r p-2 text-lg">
                            データ(バイト列・16進数)
                        </th>
                        <th className="p-2 font-normal">
                            <button
                                className="hover:text(--foreground) cursor-pointer rounded-xl border border-(--border-button-add) bg-(--button-add) px-4 py-2 transition-colors duration-200 hover:bg-(--hover-button-add) dark:text-(--background) dark:hover:text-(--foreground)"
                                type="button"
                            >
                                追加
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody className="contents">
                    {entryNames.map(name => (
                        <tr
                            className="col-span-full grid grid-cols-subgrid border-t border-(--border-table)"
                            key={name}
                        >
                            <td className="grid items-center border-r p-2">
                                {name}
                            </td>
                            <td className="grid items-center border-r p-2">
                                <Suspense fallback="(読み込み中...)">
                                    <Await
                                        children={idFunc}
                                        resolve={getEntryData(name)}
                                    />
                                </Suspense>
                            </td>
                            <td className="flex flex-row items-center justify-center p-2">
                                <button
                                    className="cursor-pointer rounded-xl border bg-(--foreground) px-4 py-2 text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
                                    type="button"
                                >
                                    編集
                                </button>
                                <button
                                    className="cursor-pointer rounded-xl border border-(--border-button-delete) bg-(--button-delete) px-4 py-2 transition-colors duration-200 hover:bg-(--hover-button-delete) hover:text-(--foreground)"
                                    type="button"
                                >
                                    削除
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
