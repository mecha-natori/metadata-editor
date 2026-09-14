import { useCallback, useState } from 'react';
import type { JSX, ReactNode } from 'react';

export const Result = {
    Error: (message: ReactNode) => ({ message, status: 'error' }) as const,
    Initial: () => ({ status: 'initial' }) as const,
    Ok: (message?: ReactNode) => ({ message, status: 'ok' }) as const
} as const;

export type Result = ReturnType<(typeof Result)[keyof typeof Result]>;

export interface UseResultResult {
    ShowResult: typeof ShowResult;
    result: Result;
    setError: (message: ReactNode) => void;
    setOk: (message?: ReactNode) => void;
}

export function useResult(): UseResultResult {
    const [result, setResult] = useState<Result>(Result.Initial());
    const setError = useCallback((message: ReactNode) => {
        setResult(Result.Error(message));
    }, []);
    const setOk = useCallback((message?: ReactNode) => {
        setResult(Result.Ok(message));
    }, []);
    return { ShowResult, result, setError, setOk };
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
