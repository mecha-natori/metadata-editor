import { useModal } from './hooks/modal';
import { getBoard, testBoard } from './lib/boards';
import { encodeSetDataValue } from './lib/encode';
import { idFunc } from './lib/helper';
import { invoke } from '@tauri-apps/api/core';
import {
    Suspense,
    useCallback,
    useEffect,
    useReducer,
    useRef,
    useState
} from 'react';
import { Await, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import type {
    Dispatch,
    JSX,
    MouseEvent,
    RefObject,
    SetStateAction,
    SubmitEvent
} from 'react';

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
const editFormSchema = z.object({ data: dataSchema });

async function getEntryData(name: string): Promise<string> {
    try {
        return invoke('get_data', { name }).then(data =>
            // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-type-assertion
            new Uint8Array(data as ArrayBuffer).toHex()
        );
    } catch (err) {
        // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-type-assertion
        return `(取得失敗: ${err as string})`;
    }
}

export function Edit(): JSX.Element {
    const params = useParams<'board'>();
    const board =
        import.meta.env.DEV && params.board === 'test'
            ? testBoard
            : getBoard(params.board!)!;
    const navigate = useNavigate();
    const [, syncData] = useReducer(x => !x, false);
    const [entryNames, setEntryNames] = useState<Array<string>>([]);
    const [deleteButtonRefs, setDeleteButtonRefs] = useState<
        ReadonlyMap<string, HTMLButtonElement>
    >(new Map());
    const [editButtonRefs, setEditButtonRefs] = useState<
        ReadonlyMap<string, HTMLButtonElement>
    >(new Map());
    const addOpenRef = useRef<HTMLButtonElement>(null);
    const noSaveWarnOpenRef = useRef<HTMLButtonElement>(null);
    const handleDeleteButtonAttach = useCallback(
        (name: string, node: HTMLButtonElement) => {
            setDeleteButtonRefs(prev => {
                if (prev.get(name) === node) {
                    return prev;
                }
                const next = new Map(prev);
                // oxlint-disable-next-line unicorn/no-immediate-mutation
                next.set(name, node);
                return next;
            });
        },
        []
    );
    const handleDeleteButtonDetach = useCallback(
        (name: string, node: HTMLButtonElement) => {
            setDeleteButtonRefs(prev => {
                if (prev.get(name) !== node) {
                    return prev;
                }
                const next = new Map(prev);
                // oxlint-disable-next-line unicorn/no-immediate-mutation
                next.delete(name);
                return next;
            });
        },
        []
    );
    const handleEditButtonAttach = useCallback(
        (name: string, node: HTMLButtonElement) => {
            setEditButtonRefs(prev => {
                if (prev.get(name) === node) {
                    return prev;
                }
                const next = new Map(prev);
                // oxlint-disable-next-line unicorn/no-immediate-mutation
                next.set(name, node);
                return next;
            });
        },
        []
    );
    const handleEditButtonDetach = useCallback(
        (name: string, node: HTMLButtonElement) => {
            setEditButtonRefs(prev => {
                if (prev.get(name) !== node) {
                    return prev;
                }
                const next = new Map(prev);
                // oxlint-disable-next-line unicorn/no-immediate-mutation
                next.delete(name);
                return next;
            });
        },
        []
    );
    const handleSave = useCallback((e: MouseEvent) => {
        e.preventDefault();
        invoke('save')
            .then(() => {
                alert('保存が完了しました！');
            })
            .catch(alert);
    }, []);
    const handleSaveClose = useCallback(
        (e: MouseEvent) => {
            handleSave(e);
            // oxlint-disable-next-line typescript/no-floating-promises
            navigate('/');
        },
        [handleSave, navigate]
    );
    useEffect(() => {
        const bankBase = board.banks.at(-1)!.base;
        const bankLength = board.banks.at(-1)!.length;
        const chipFamily = board.chip.family;
        const chipName = board.chip.name;
        invoke('load', { bankBase, bankLength, chipFamily, chipName })
            .then(names => {
                // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-type-assertion
                setEntryNames(names as Array<string>);
            })
            // oxlint-disable-next-line promise/prefer-await-to-callbacks
            .catch(async (err: unknown) => {
                alert(err);
                await navigate('/');
            });
    }, [board, navigate]);
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
                        ref={noSaveWarnOpenRef}
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
                                    ref={addOpenRef}
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
                                <td className="grid items-center border-r p-2 font-mono">
                                    <Suspense fallback="(読み込み中...)">
                                        <Await
                                            // oxlint-disable-next-line react/no-children-prop
                                            children={idFunc}
                                            resolve={getEntryData(name)}
                                        />
                                    </Suspense>
                                </td>
                                <td className="flex flex-row items-center justify-center p-2">
                                    <EditButton
                                        name={name}
                                        onAttach={handleEditButtonAttach}
                                        onDetach={handleEditButtonDetach}
                                    />
                                    <DeleteButton
                                        name={name}
                                        onAttach={handleDeleteButtonAttach}
                                        onDetach={handleDeleteButtonDetach}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <AddModal
                openRef={addOpenRef}
                setEntryNames={setEntryNames}
            />
            <DeleteWarnModal
                openRefs={deleteButtonRefs}
                setEntryNames={setEntryNames}
            />
            <EditModal
                openRefs={editButtonRefs}
                syncData={syncData}
            />
            <NoSaveWarnModal openRef={noSaveWarnOpenRef} />
        </>
    );
}

interface DeleteButtonProps {
    name: string;

    onAttach: (name: string, node: HTMLButtonElement) => void;

    onDetach: (name: string, node: HTMLButtonElement) => void;
}

function DeleteButton({
    name,
    onAttach: handleAttach,
    onDetach: handleDetach
}: DeleteButtonProps): JSX.Element {
    const ref = useCallback(
        (node: HTMLButtonElement | null) => {
            if (!node) {
                // oxlint-disable-next-line eslint/no-undefined unicorn/no-useless-undefined
                return undefined;
            }
            handleAttach(name, node);
            return () => {
                handleDetach(name, node);
            };
        },
        [handleAttach, handleDetach, name]
    );
    return (
        <button
            className="cursor-pointer rounded-xl border border-(--border-button-delete) bg-(--button-delete) px-4 py-2 transition-colors duration-200 hover:bg-(--hover-button-delete) hover:text-(--foreground)"
            ref={ref}
            type="button"
        >
            削除
        </button>
    );
}

interface EditButtonProps {
    name: string;

    onAttach: (name: string, node: HTMLButtonElement) => void;

    onDetach: (name: string, node: HTMLButtonElement) => void;
}

function EditButton({
    name,
    onAttach: handleAttach,
    onDetach: handleDetach
}: EditButtonProps): JSX.Element {
    const ref = useCallback(
        (node: HTMLButtonElement | null) => {
            if (!node) {
                // oxlint-disable-next-line eslint/no-undefined unicorn/no-useless-undefined
                return undefined;
            }
            handleAttach(name, node);
            return () => {
                handleDetach(name, node);
            };
        },
        [handleAttach, handleDetach, name]
    );
    return (
        <button
            className="cursor-pointer rounded-xl border bg-(--foreground) px-4 py-2 text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground)"
            ref={ref}
            type="button"
        >
            編集
        </button>
    );
}

interface AddModalProps {
    openRef: RefObject<HTMLButtonElement | null>;
    setEntryNames: Dispatch<SetStateAction<Array<string>>>;
}

function AddModal({ openRef, setEntryNames }: AddModalProps): JSX.Element {
    const { Modal, handleClose, handleOpen, open, ref } = useModal();
    const handleAdd = useCallback(
        (e: SubmitEvent) => {
            e.preventDefault();
            const formData = addFormSchema.safeParse(
                Object.fromEntries(new FormData(e.target))
            );
            if (!formData.success) {
                alert(
                    formData.error.issues.map(issue => issue.message).join('\n')
                );
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
                    handleClose();
                    e.target.reset();
                })
                .catch(alert);
        },
        [handleClose, setEntryNames]
    );
    useEffect(() => {
        const opener = openRef.current;
        opener?.addEventListener('click', handleOpen);
        return () => {
            opener?.removeEventListener('click', handleOpen);
        };
    }, [handleOpen, openRef]);
    return (
        <Modal
            onClose={handleClose}
            open={open}
            ref={ref}
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
        </Modal>
    );
}

interface DeleteWarnModalProps {
    openRefs: ReadonlyMap<string, HTMLButtonElement>;
    setEntryNames: Dispatch<SetStateAction<Array<string>>>;
}

function DeleteWarnModal({
    openRefs,
    setEntryNames
}: DeleteWarnModalProps): JSX.Element {
    const [target, setTarget] = useState('');
    const { Modal, handleClose, handleOpen, open, ref } = useModal();
    const handleDeleteButtonClick = useCallback(
        (name: string): EventListener =>
            e => {
                e.preventDefault();
                setTarget(name);
                handleOpen();
            },
        [handleOpen]
    );
    const handleCancel = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            setTarget('');
            ref.current?.close();
        },
        [ref.current]
    );
    const handleConfirm = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            invoke('remove_data', { name: target })
                .then(() => {
                    ref.current?.close();
                    setEntryNames(entryNames =>
                        entryNames.toSpliced(entryNames.indexOf(target), 1)
                    );
                    setTarget('');
                })
                .catch(alert);
        },
        [ref.current, setEntryNames, target]
    );
    useEffect(() => {
        const buttonHandlers = new Map<string, EventListener>();
        for (const [name, opener] of openRefs) {
            buttonHandlers.set(name, handleDeleteButtonClick(name));
            opener.addEventListener('click', buttonHandlers.get(name)!);
            opener.addEventListener('click', handleOpen);
        }
        return () => {
            for (const [name, opener] of openRefs) {
                opener.removeEventListener('click', buttonHandlers.get(name)!);
                opener.removeEventListener('click', handleOpen);
            }
        };
    }, [handleDeleteButtonClick, handleOpen, openRefs]);
    return (
        <Modal
            className="flex flex-col gap-8"
            onClose={handleClose}
            open={open}
            ref={ref}
        >
            <p className="text-lg font-bold">
                エントリの削除後は復元できません。本当に良いですか？
            </p>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:gap-0">
                <button
                    className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground) md:w-max"
                    onClick={handleCancel}
                    type="button"
                >
                    削除しない
                </button>
                <button
                    className="cursor-pointer rounded-4xl border border-(--border-button-delete) bg-(--button-delete) px-8 py-3 text-lg transition-colors duration-200 hover:bg-(--hover-button-delete) hover:text-(--foreground) md:w-max"
                    onClick={handleConfirm}
                    type="button"
                >
                    削除する
                </button>
            </div>
        </Modal>
    );
}

interface EditModalProps {
    openRefs: ReadonlyMap<string, HTMLButtonElement>;

    syncData: () => void;
}

function EditModal({ openRefs, syncData }: EditModalProps): JSX.Element {
    const [data, setData] = useState('');
    const [target, setTarget] = useState('');
    const { Modal, handleClose, handleOpen, open, ref } = useModal();
    const handleEditButtonClick = useCallback(
        (name: string): EventListener =>
            e => {
                e.preventDefault();
                setTarget(name);
                // oxlint-disable-next-line promise/catch-or-return typescript/no-floating-promises
                getEntryData(name).then(data => {
                    setData(data);
                    handleOpen();
                });
            },
        [handleOpen]
    );
    const handleEdit = useCallback(
        (e: SubmitEvent) => {
            e.preventDefault();
            const formData = editFormSchema.safeParse(
                Object.fromEntries(new FormData(e.target))
            );
            if (!formData.success) {
                alert(
                    formData.error.issues.map(issue => issue.message).join('\n')
                );
                return;
            }
            const { data } = formData.data;
            const value = encodeSetDataValue(target, data);
            invoke('set_data', value)
                .then(() => {
                    handleClose();
                    e.target.reset();
                    syncData();
                })
                .catch(alert);
        },
        [handleClose, syncData, target]
    );
    useEffect(() => {
        const buttonHandlers = new Map<string, EventListener>();
        for (const [name, opener] of openRefs) {
            buttonHandlers.set(name, handleEditButtonClick(name));
            opener.addEventListener('click', buttonHandlers.get(name)!);
            opener.addEventListener('click', handleOpen);
        }
        return () => {
            for (const [name, opener] of openRefs) {
                opener.removeEventListener('click', buttonHandlers.get(name)!);
                opener.removeEventListener('click', handleOpen);
            }
        };
    }, [handleEditButtonClick, handleOpen, openRefs]);
    return (
        <Modal
            onClose={handleClose}
            open={open}
            ref={ref}
        >
            <form
                className="my-4 flex flex-col items-center justify-center gap-8"
                onSubmit={handleEdit}
            >
                <div className="flex w-full flex-col items-center justify-center gap-4">
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <label htmlFor="edit-name">エントリ名:</label>
                        <div className="flex w-full flex-row items-center">
                            <input
                                className="w-0 flex-grow cursor-not-allowed rounded-sm bg-(--background-disabled) px-1"
                                disabled
                                id="edit-name"
                                name="name"
                                type="text"
                                value={target}
                            />
                        </div>
                    </div>
                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        <label htmlFor="edit-data">
                            データ(バイト列・16進数):
                        </label>
                        <div className="flex w-full flex-row items-center">
                            <textarea
                                className="w-0 flex-grow rounded-sm border px-1 font-mono"
                                defaultValue={data}
                                id="edit-data"
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
                    更新
                </button>
            </form>
        </Modal>
    );
}

interface NoSaveWarnModalProps {
    openRef: RefObject<HTMLElement | null>;
}

function NoSaveWarnModal({ openRef }: NoSaveWarnModalProps): JSX.Element {
    const navigate = useNavigate();
    const { Modal, handleClose, handleOpen, open, ref } = useModal();
    const handleCancel = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            ref.current?.close();
        },
        [ref.current]
    );
    const handleConfirm = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            // oxlint-disable-next-line typescript/no-floating-promises
            navigate('/');
        },
        [navigate]
    );
    useEffect(() => {
        const opener = openRef.current;
        opener?.addEventListener('click', handleOpen);
        return () => {
            opener?.removeEventListener('click', handleOpen);
        };
    }, [handleOpen, openRef]);
    return (
        <Modal
            className="flex flex-col gap-8"
            onClose={handleClose}
            open={open}
            ref={ref}
        >
            <p className="text-lg font-bold">
                変更した内容は失われます。本当に良いですか？
            </p>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:gap-0">
                <button
                    className="cursor-pointer rounded-4xl border bg-(--foreground) px-8 py-3 text-lg text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--foreground) md:w-max"
                    onClick={handleCancel}
                    type="button"
                >
                    編集に戻る
                </button>
                <button
                    className="cursor-pointer rounded-4xl border border-(--border-button-delete) bg-(--button-delete) px-8 py-3 text-lg transition-colors duration-200 hover:bg-(--hover-button-delete) hover:text-(--foreground) md:w-max"
                    onClick={handleConfirm}
                    type="button"
                >
                    保存せずに終了
                </button>
            </div>
        </Modal>
    );
}
