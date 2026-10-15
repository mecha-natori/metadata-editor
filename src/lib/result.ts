import type { ReactNode } from 'react';

// oxlint-disable-next-line eslint/no-redeclare
export const Result = {
    Error: (message: ReactNode) => ({ message, status: 'error' }) as const,
    Initial: () => ({ status: 'initial' }) as const,
    Ok: (message?: ReactNode) => ({ message, status: 'ok' }) as const
} as const;

export type Result = ReturnType<(typeof Result)[keyof typeof Result]>;
