import { useCallback, useEffect } from 'react';
import type {
    DetailedHTMLProps,
    HTMLAttributes,
    JSX,
    PropsWithChildren,
    RefObject
} from 'react';

export interface ModalProps extends PropsWithChildren<
    Omit<
        DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>,
        'ref'
    >
> {
    open: boolean;
    ref: RefObject<HTMLDialogElement | null>;

    onClose: () => void;
}

export function Modal({
    children,
    onClose: handleClose,
    open,
    ref,
    ...props
}: ModalProps): JSX.Element {
    const handleCloseButtonClick = useCallback(() => {
        ref.current?.close();
    }, [ref.current]);
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
    }, [open, ref]);
    return (
        <dialog
            className="m-auto min-h-24 min-w-24 rounded-2xl border border-(--border-modal) px-8 pt-16 pb-6 backdrop:bg-(--background-backdrop)"
            onClose={handleClose}
            ref={ref}
        >
            <div {...props}>{children}</div>
            <button
                className="absolute top-2 right-2 cursor-pointer rounded-md bg-(--foreground) px-2 py-1 text-sm text-(--background) transition-colors duration-200 hover:bg-(--hover-background) hover:text-(--hover-foreground)"
                onClick={handleCloseButtonClick}
                type="button"
            >
                閉じる
            </button>
        </dialog>
    );
}
