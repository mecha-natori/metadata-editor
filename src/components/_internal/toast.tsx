import type { JSX } from 'react';
import type { ToastContentProps } from 'react-toastify';

export interface ToastProps extends Partial<ToastContentProps> {
    message: string;
    title?: string;
}

export function Toast({ message, title }: ToastProps): JSX.Element {
    return (
        <div className="relative m-1 flex flex-col">
            {title && <div className="text-bold mb-4 text-xl">{title}</div>}
            <div>{message}</div>
        </div>
    );
}
