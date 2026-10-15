import type { Result } from '@/lib/result';
import type { JSX } from 'react';

export interface ShowResultProps {
    result: Result;
}

export function ShowResult({ result }: ShowResultProps): JSX.Element | null {
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
