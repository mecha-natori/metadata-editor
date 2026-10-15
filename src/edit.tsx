import { useModal } from './hooks/modal';
import { getBoard, testBoard } from './lib/boards';
import { encodeSetDataValue } from './lib/encode';
import { idFunc } from './lib/helper';
import { invoke } from '@tauri-apps/api/core';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Await, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import type { JSX, MouseEvent, MouseEventHandler, SubmitEvent } from 'react';

const dataSchema = z
    .hex('データは16進数バイト列である必要があります。')
    .refine(
        data => data.length % 2 === 0,
        'データは1バイト単位で用意される必要があります。'
    );
const addFormSchema = z.object({
    data: dataSchema,
    name: z
        .string()
        .min(1, 'エントリ名は最低1文字以上必要です。')
        .max(255, 'エントリ名は255文字までです。')
});

export function Edit(): JSX.Element {
    const params = useParams<'board'>();
    const board =
        import.meta.env.DEV && params.board === 'test'
            ? testBoard
            : getBoard(params.board!)!;
    const navigate = useNavigate();
    const [entryNames, setEntryNames] = useState<Array<string>>([]);
    const [deleteTarget, setDeleteTarget] = useState('');
    const {
        Modal: NoSaveWarnModal,
        handleClose: handleNoSaveWarnModalClose,
        handleOpen: handleNoSaveWarnModalOpen,
        open: noSaveWarnModalOpen,
        ref: noSaveWarnModalRef
    } = useModal();
    const {
        Modal: AddModal,
        handleClose: handleAddModalClose,
        handleOpen: handleAddModalOpen,
        open: addModalOpen,
        ref: addModalRef
    } = useModal();
    const {
        Modal: DeleteWarnModal,
        handleClose: handleDeleteWarnModalClose,
        handleOpen: handleDeleteWarnModalOpen,
        open: deleteWarnModalOpen,
        ref: deleteWarnModalRef
    } = useModal();
    const getEntryData = useCallback(async (name: string): Promise<string> => {
        try {
            return invoke('get_data', { name }).then(data =>
                new Uint8Array(data as ArrayBuffer).toHex()
            );
        } catch (err) {
            return `(取得失敗: ${err})`;
        }
    }, []);
    const handleSave = useCallback((e: MouseEvent) => {
        e.preventDefault();
        invoke('save')
            .then(() => {
                alert('保存が完了しました！');
            })
            .catch(alert);
    }, []);
    const handleSaveClose = useCallback((e: MouseEvent) => {
        handleSave(e);
        navigate('/');
    }, []);
    const handleNoSaveClose = useCallback((e: MouseEvent) => {
        e.preventDefault();
        handleNoSaveWarnModalOpen();
    }, []);
    const handleNoSaveCancel = useCallback((e: MouseEvent) => {
        e.preventDefault();
        noSaveWarnModalRef.current?.close();
    }, []);
    const handleNoSaveConfirm = useCallback((e: MouseEvent) => {
        e.preventDefault();
        navigate('/');
    }, []);
    const handleDeleteButtonClick = useCallback(
        (name: string): MouseEventHandler => {
            return e => {
                e.preventDefault();
                setDeleteTarget(name);
                handleDeleteWarnModalOpen();
            };
        },
        []
    );
    const handleDeleteCancel = useCallback((e: MouseEvent) => {
        e.preventDefault();
        setDeleteTarget('');
        deleteWarnModalRef.current?.close();
    }, []);
    const handleDeleteConfirm = useCallback((e: MouseEvent) => {
        e.preventDefault();
        invoke('remove_data', { name: deleteTarget })
            .then(() => {
                setEntryNames(entryNames =>
                    entryNames.toSpliced(entryNames.indexOf(deleteTarget), 1)
                );
                setDeleteTarget('');
            })
            .catch(alert);
    }, []);
    const handleAdd = useCallback((e: SubmitEvent) => {
        e.preventDefault();
        const formData = addFormSchema.safeParse(
            Object.fromEntries(new FormData(e.target))
        );
        if (!formData.success) {
            alert(formData.error.issues.map(issue => issue.message).join('\n'));
            return;
        }
        const { data, name } = formData.data;
        const value = encodeSetDataValue(name, data);
        invoke('add_data', value)
            .then(() => {
                setEntryNames(entryNames => {
                    if (import.meta.env.DEV && entryNames.includes(name)) {
                        return entryNames;
                    }
                    entryNames.push(name);
                    return entryNames;
                });
                handleAddModalClose();
                e.target.reset();
            })
            .catch(alert);
    }, []);
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
        <>
            <div className="flex min-h-screen w-screen flex-col items-center gap-8 px-8 pt-8 pb-16">
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
                                    onClick={handleAddModalOpen}
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
                                        onClick={handleDeleteButtonClick(name)}
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
            <AddModal
                onClose={handleAddModalClose}
                open={addModalOpen}
                ref={addModalRef}
            >
                <form
                    className="my-4 flex flex-col items-center justify-center gap-8"
                    onSubmit={handleAdd}
                >
                    <div className="flex w-full flex-col items-center justify-center gap-4">
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <label htmlFor="add-name">エントリ名:</label>
                            <div className="flex w-full flex-row items-center">
                                <input
                                    className="w-0 flex-grow rounded-sm border px-1"
                                    id="add-name"
                                    name="name"
                                    required
                                    type="text"
                                />
                            </div>
                        </div>
                        <div className="flex w-full flex-col items-center justify-center gap-2">
                            <label htmlFor="add-data">
                                データ(バイト列・16進数):
                            </label>
                            <div className="flex w-full flex-row items-center">
                                <textarea
                                    className="w-0 flex-grow rounded-sm border px-1"
                                    id="add-data"
                                    name="data"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        className="cursor-pointer rounded-4xl bg-(--foreground) px-12 py-3 text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                        type="submit"
                    >
                        追加
                    </button>
                </form>
            </AddModal>
            <DeleteWarnModal
                className="flex flex-col gap-8"
                onClose={handleDeleteWarnModalClose}
                open={deleteWarnModalOpen}
                ref={deleteWarnModalRef}
            >
                <p className="text-lg font-bold">
                    エントリの削除後は復元できません。本当に良いですか？
                </p>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:gap-0">
                    <button
                        className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground) md:w-max"
                        onClick={handleDeleteCancel}
                        type="button"
                    >
                        削除しない
                    </button>
                    <button
                        className="cursor-pointer rounded-4xl border border-(--border-button-delete) bg-(--button-delete) px-8 py-3 text-lg transition-colors duration-200 hover:bg-(--hover-button-delete) hover:text-(--foreground) md:w-max"
                        onClick={handleDeleteConfirm}
                        type="button"
                    >
                        削除する
                    </button>
                </div>
            </DeleteWarnModal>
            <NoSaveWarnModal
                className="flex flex-col gap-8"
                onClose={handleNoSaveWarnModalClose}
                open={noSaveWarnModalOpen}
                ref={noSaveWarnModalRef}
            >
                <p className="text-lg font-bold">
                    変更した内容は失われます。本当に良いですか？
                </p>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:gap-0">
                    <button
                        className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground) md:w-max"
                        onClick={handleNoSaveCancel}
                        type="button"
                    >
                        編集に戻る
                    </button>
                    <button
                        className="cursor-pointer rounded-4xl border border-(--border-button-delete) bg-(--button-delete) px-8 py-3 text-lg transition-colors duration-200 hover:bg-(--hover-button-delete) hover:text-(--foreground) md:w-max"
                        onClick={handleNoSaveConfirm}
                        type="button"
                    >
                        保存せずに終了
                    </button>
                </div>
            </NoSaveWarnModal>
        </>
    );
}
