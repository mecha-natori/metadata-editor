import { useSwitchState } from './switch-state';
import { useCallback, useEffect, useRef } from 'react';
import type {
    DetailedHTMLProps,
    HTMLAttributes,
    JSX,
    PropsWithChildren,
    RefObject
} from 'react';

export interface UseModalResult {
    Modal: (props: ModalProps) => JSX.Element;
    handleClose: ModalProps['onClose'];
    handleOpen: () => void;
    open: ModalProps['open'];
    ref: ModalProps['ref'];
}

export function useModal(
    initialState: 'close' | 'open' = 'close'
): UseModalResult {
    const ref = useRef<HTMLDialogElement>(null);
    const [open, handleClose, handleOpen] = useSwitchState(
        initialState === 'open'
    );
    return { Modal, handleClose, handleOpen, open, ref };
}

export interface ModalProps extends PropsWithChildren<
    Omit<
        DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>,
        'ref'
    >
> {
    onClose: () => void;
    open: boolean;
    ref: RefObject<HTMLDialogElement | null>;
}

function Modal({
    children,
    onClose,
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
            className="m-auto min-h-24 min-w-24 rounded-2xl border border-(--border-modal) px-8 pt-16 pb-6 backdrop:bg-(--background-backdrop)"
            onClose={onClose}
            ref={ref}
        >
            <div {...props}>{children}</div>
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
