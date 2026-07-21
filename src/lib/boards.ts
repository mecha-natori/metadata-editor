import boardsFile from '@/boards.json';

const { boards } = boardsFile;

export interface Board {
    banks: Array<{ base: number; length: number }>;
    chip: { family: 'esp32' | 'stm32'; name: string };
}

export function getAllBoardNames(): Array<string> {
    return Object.keys(boards);
}

export function getBoard(name: string): Board | null {
    if (!Object.hasOwn(boards, name)) {
        return null;
    }
    return boards[name];
}
