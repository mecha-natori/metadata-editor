import { useResult } from "./hooks/result";
import { getAllBoardNames, getBoard } from "@/lib/boards";
import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { z } from "zod";
import type { JSX, SubmitEvent } from "react";

const formSchema = z
    .object({
        board: z.string().transform((board) => getBoard(board)!),
        id: z.string().nonempty("CAN IDを入力して下さい。"),
        idRadix: z
            .enum(["2", "8", "10", "16"])
            .transform((radix) => Number.parseInt(radix, 10)),
    })
    .transform((data, ctx) => {
        // oxlint-disable-next-line radix
        const id = Number.parseInt(data.id, data.idRadix);
        if (Number.isNaN(id)) {
            ctx.addIssue("CAN IDを数値で入力して下さい。");
            return z.NEVER;
        }
        if (id < 0 || 0x7ff < id) {
            ctx.addIssue("CAN IDは符号なし11bit整数である必要があります。");
            return z.NEVER;
        }
        return { ...data, id };
    });

export function App(): JSX.Element {
    const { ShowResult, result, setError, setOk } = useResult();
    const boards = getAllBoardNames();
    const handleSubmit = useCallback(
        (e: SubmitEvent<HTMLFormElement>) => {
            e.preventDefault();
            const formData = formSchema.safeParse(
                Object.fromEntries(new FormData(e.target)),
            );
            if (!formData.success) {
                setError(
                    formData.error.issues
                        .map((issue) => issue.message)
                        .join("\n"),
                );
                return;
            }
            const { board, id } = formData.data;
            invoke("change", {
                bankBase: board.banks.at(-1)!.base,
                bankLength: board.banks.at(-1)!.length,
                canAddr: id,
                chipFamily: board.chip.family,
                chipName: board.chip.name,
            })
                .then(() => {
                    setOk("IDの書き換えに成功しました！");
                })
                // oxlint-disable-next-line promise/prefer-await-to-callbacks
                .catch((err: unknown) => {
                    // oxlint-disable-next-line typescript/consistent-type-assertions typescript/no-unsafe-type-assertion
                    setError(err as string);
                });
        },
        [setError, setOk],
    );
    return (
        <div className="flex h-screen w-screen flex-col items-center justify-center">
            <h1>基板IDチェンジャー</h1>
            <p>メカトロ製基板のCANのIDを変更します。</p>
            <ShowResult result={result} />
            <form
                className="my-8 flex flex-col items-center justify-center gap-8"
                onSubmit={handleSubmit}
            >
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="flex w-full flex-col gap-1">
                        <label htmlFor="board">基板:</label>
                        <select
                            className="rounded-lg border px-2 py-1"
                            id="board"
                            name="board"
                        >
                            {boards.map((board) => (
                                <option key={board} value={board}>
                                    {board}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex w-full flex-col gap-1">
                        <label htmlFor="idRadix">CAN IDの基数:</label>
                        <select
                            className="rounded-lg border px-2 py-1"
                            id="idRadix"
                            name="idRadix"
                        >
                            <option value="2">2</option>
                            <option value="8">8</option>
                            <option value="10">10</option>
                            <option value="16">16</option>
                        </select>
                    </div>
                    <div className="flex w-full flex-col gap-1">
                        <label htmlFor="id">CAN ID:</label>
                        <input
                            className="rounded-lg border px-2 py-1"
                            id="id"
                            name="id"
                            placeholder="CAN ID"
                            type="text"
                        />
                    </div>
                </div>
                <button
                    className="max-w-40 cursor-pointer rounded-4xl bg-(--foreground) px-12 py-3 text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                    type="submit"
                >
                    変更
                </button>
            </form>
        </div>
    );
}
