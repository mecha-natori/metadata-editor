import { useSwitchState } from './switch-state';
import { Modal } from '@/components/_internal/modal';
import { useRef } from 'react';
import type { ModalProps } from '@/components/_internal/modal';
import type { JSX } from 'react';

export type { ModalProps };

export interface UseModalResult {
    handleClose: ModalProps['onClose'];
    open: ModalProps['open'];
    ref: ModalProps['ref'];

    handleOpen: () => void;

    Modal: (props: ModalProps) => JSX.Element;
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
