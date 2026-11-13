import { UpdaterModal as UpdaterModalInternal } from '@/components/_internal/updater-modal';
import { useModal } from '@/hooks/modal';
import { useToast } from '@/hooks/toast';
import { bytesToString } from '@/lib/helper';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useState } from 'react';
import type { UpdaterModalProps as UpdateModalInternalProps } from '@/components/_internal/updater-modal';
import type { UseModalResult } from '@/hooks/modal';
import type { Update } from '@tauri-apps/plugin-updater';
import type { JSX } from 'react';

const UPDATE_PROGRESS_TOAST_ID =
    'io.github.mecha-natori.metadata-editor.update-progress';

export interface UpdaterModalProps extends Omit<
    UpdateModalInternalProps,
    'currentVersion' | 'newVersion' | keyof UseModalResult
> {}

export interface UseUpdaterResult {
    UpdaterModal: (props: UpdaterModalProps) => JSX.Element;
}

export function useUpdater(): UseUpdaterResult {
    const [update, setUpdate] = useState<null | Update>(null);
    const { handleOpen, ...updaterModalProps } = useModal();
    const { toast } = useToast();
    const UpdaterModal = useCallback(
        () => (
            <UpdaterModalInternal
                currentVersion={update!.currentVersion}
                newVersion={update!.version}
                {...updaterModalProps}
            />
        ),
        [update!.currentVersion, update!.version, updaterModalProps]
    );
    useEffect(() => {
        toast('更新をチェック中...', { toastId: UPDATE_PROGRESS_TOAST_ID });
        // oxlint-disable-next-line promise/catch-or-return typescript/no-floating-promises
        check().then(u => {
            setUpdate(u);
            if (!u) {
                toast('最新バージョンです。', {
                    toastId: UPDATE_PROGRESS_TOAST_ID
                });
                return;
            }
            handleOpen();
        });
    }, [handleOpen, toast]);
    useEffect(() => {
        if (!update) {
            // oxlint-disable-next-line eslint/no-undefined unicord/no-useless-undefined
            return undefined;
        }
        let downloadedSize = 0;
        let totalSize = '';
        let closeTimer: null | ReturnType<typeof setTimeout> = null;
        // oxlint-disable-next-line promise/catch-or-return typescript/no-floating-promises
        update
            .downloadAndInstall(event => {
                switch (event.event) {
                    case 'Finished':
                        toast('ダウンロード完了、インストール中...', {
                            toastId: UPDATE_PROGRESS_TOAST_ID
                        });
                        break;
                    case 'Progress':
                        downloadedSize += event.data.chunkLength;
                        toast(
                            `更新をダウンロード中: ${bytesToString(downloadedSize)} / ${totalSize}`,
                            { toastId: UPDATE_PROGRESS_TOAST_ID }
                        );
                        break;
                    case 'Started':
                        totalSize = event.data.contentLength
                            ? bytesToString(event.data.contentLength)
                            : '不明';
                        toast(`更新をダウンロード中: 0B / ${totalSize}`, {
                            toastId: UPDATE_PROGRESS_TOAST_ID
                        });
                        break;
                    default:
                        throw new Error('Unreachable');
                }
            })
            .then(() => {
                toast(
                    { msg: '10秒後に再起動します。', title: '更新完了' },
                    { autoClose: false, toastId: UPDATE_PROGRESS_TOAST_ID }
                );
                closeTimer = setTimeout(() => {
                    // oxlint-disable-next-line typescript/no-floating-promises
                    relaunch();
                }, 10000);
            });
        return () => {
            if (closeTimer !== null) {
                clearTimeout(closeTimer);
            }
        };
    }, [toast, update]);
    return { UpdaterModal };
}
