import { useCallback, useState } from 'react';
import type { JSX } from 'react';

export const Result = {
    Error: (message: string) => ({ message, status: 'error' } as const),
    Initial: () => ({ status: 'initial' } as const),
    Ok: (message?: string) => ({ message, status: 'ok' } as const)
} as const;

export type Result = ReturnType<typeof Result[keyof typeof Result]>;

export interface UseResultResult {
    ShowResult: typeof ShowResult;
    result: Result;
    setError: (message: string) => void;
    setOk: (message?: string) => void;
}

export function useResult(): UseResultResult {
    const [result, setResult] = useState<Result>(Result.Initial());
    const setError = useCallback((message: string) => {
        setResult(Result.Error(message));
    }, []);
    const setOk = useCallback((message?: string) => {
        setResult(Result.Ok(message));
    }, []);
    return {
        ShowResult,
        result,
        setError,
        setOk
    };
}

interface ShowResultProps {
    result: Result;
}

function ShowResult({ result }: ShowResultProps): JSX.Element | null {
    switch (result.status) {
        case 'error':
            return (
                <div className="rounded-lg border border-(--border-error) bg-(--background-error) px-4 py-2">
                    {result.message}
                </div>
            );
        case 'initial':
            return null;
        case 'ok':
            return (
                <div className="rounded-lg border border-(--border-success) bg-(--background-success) px-4 py-2">
                    {result.message ?? ''}
                </div>
            );
        default:
            throw new Error('unreachable code');
    }
}
