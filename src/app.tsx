import { getAllBoardNames } from '@/lib/boards';
import { useCallback, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';

export function App(): JSX.Element {
    const boards = getAllBoardNames();
    const [board, setBoard] = useState(boards[0]);
    const handleBoardChange = useCallback(
        (e: ChangeEvent<HTMLSelectElement, HTMLSelectElement>) => {
            setBoard(e.currentTarget.value);
        },
        []
    );
    return (
        <div className="flex min-h-screen w-screen flex-col items-center justify-center px-8 py-16">
            <h1>メタデータエディタ</h1>
            <p>メカトロ製基板のメタデータ領域を操作します。</p>
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
    );
}
