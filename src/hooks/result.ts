import { ShowResult } from '@/components/_internal/show-result';
import { Result } from '@/lib/result';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

export type { ShowResultProps } from '@/components/_internal/show-result';

export interface UseResultResult {
    result: Result;
    ShowResult: typeof ShowResult;

    setError: (message: ReactNode) => void;

    setOk: (message?: ReactNode) => void;
}

export function useResult(): UseResultResult {
    const [result, setResult] = useState<Result>(Result.Initial());
    const setError = useCallback((message: ReactNode) => {
        // oxlint-disable-next-line unicorn/throw-new-error
        setResult(Result.Error(message));
    }, []);
    const setOk = useCallback((message?: ReactNode) => {
        setResult(Result.Ok(message));
    }, []);
    return { ShowResult, result, setError, setOk };
}
