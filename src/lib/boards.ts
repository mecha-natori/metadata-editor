import boardsFile from '@/boards.json';

const { boards } = boardsFile;

export interface Board {
    banks: Array<{ base: number; length: number }>;
    chip: { family: 'esp32' | 'stm32' | 'test'; name: string };
}

export const testBoard: Board = {
    banks: [{ base: 0, length: 256 }],
    chip: { family: 'test', name: 'TestBoard' }
};

export function getAllBoardNames(): Array<string> {
    return Object.keys(boards);
}

export function getBoard(name: string): Board | null {
    if (!Object.hasOwn(boards, name)) {
        return null;
    }
    return boards[name];
}
