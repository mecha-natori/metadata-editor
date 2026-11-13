import type { ModalProps, UseModalResult } from '@/hooks/modal';
import type { JSX } from 'react';

export interface UpdaterModalProps extends Omit<
    ModalProps & UseModalResult,
    'children' | 'handleOpen' | 'onClose'
> {
    currentVersion: string;
    newVersion: string;
    notes?: string;
}

export function UpdaterModal({
    Modal,
    className,
    currentVersion,
    handleClose,
    newVersion,
    notes = '-',
    open,
    ref,
    ...props
}: UpdaterModalProps): JSX.Element {
    return (
        <Modal
            className={`flex flex-col gap-8 ${className ?? ''}`}
            onClose={handleClose}
            open={open}
            ref={ref}
            {...props}
        >
            <h2>更新があります</h2>
            <p>
                v{currentVersion} → v{newVersion}
            </p>
            <h3>リリースノート</h3>
            <div>{notes}</div>
        </Modal>
    );
}
