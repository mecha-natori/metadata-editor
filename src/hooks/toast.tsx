import { Toast } from '@/components/_internal/toast';
import { useCallback } from 'react';
import { toast as origToast } from 'react-toastify';
import type { ToastOptions } from 'react-toastify';

export interface ToastMessage {
    msg: string;
    title?: string;
}

export interface UseToastResult {
    toast: (body: string | ToastMessage, options?: ToastOptions) => void;
}

export function useToast(): UseToastResult {
    const toast = useCallback(
        (body: string | ToastMessage, options?: ToastOptions) => {
            origToast(
                <Toast
                    message={typeof body === 'string' ? body : body.msg}
                    {...(typeof body === 'string' ? {} : { title: body.title })}
                />,
                { position: 'bottom-right', theme: 'auto', ...options }
            );
        },
        []
    );
    return { toast };
}
