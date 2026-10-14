import { useCallback, useEffect, useRef } from 'react';
import type {
    DetailedHTMLProps,
    DialogHTMLAttributes,
    JSX,
    PropsWithChildren,
    RefObject
} from 'react';

export interface UseModalResult {
    Modal: (props: ModalProps) => JSX.Element;
    ref: ModalProps['ref'];
}

export function useModal(): UseModalResult {
    const ref = useRef<HTMLDialogElement>(null);
    return { Modal, ref };
}

export interface ModalProps extends PropsWithChildren<
    Omit<
        DetailedHTMLProps<
            DialogHTMLAttributes<HTMLDialogElement>,
            HTMLDialogElement
        >,
        'open'
    >
> {
    onClose: () => void;
    open: boolean;
    ref: RefObject<HTMLDialogElement | null>;
}

function Modal({
    children,
    className,
    open,
    ref,
    ...props
}: ModalProps): JSX.Element {
    const handleClose = useCallback(() => {
        ref.current?.close();
    }, []);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) {
            return;
        }
        if (open && !dialog.open) {
            dialog.showModal();
        }
        if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);
    return (
        <dialog
            className={`m-auto min-h-24 min-w-24 rounded-2xl border border-(--border-modal) px-8 pt-16 pb-6 backdrop:bg-(--background-backdrop) ${className ?? ''}`}
            ref={ref}
            {...props}
        >
            {children}
            <button
                className="absolute top-2 right-2 cursor-pointer rounded-md bg-(--foreground) px-2 py-1 text-sm text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                onClick={handleClose}
                type="button"
            >
                閉じる
            </button>
        </dialog>
    );
}
