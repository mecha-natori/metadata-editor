import { useCallback } from 'react';
import type { ButtonHTMLAttributes, DetailedHTMLProps, JSX } from 'react';

export interface TrackedButtonProps extends Omit<
    DetailedHTMLProps<
        ButtonHTMLAttributes<HTMLButtonElement>,
        HTMLButtonElement
    >,
    'ref' | 'type'
> {
    bgClassName?: string;
    hoverBgClassName?: string;
    hoverTextClassName?: string;
    name: string;
    textClassName?: string;

    onAttach: (name: string, node: HTMLButtonElement) => void;

    onDetach: (name: string, node: HTMLButtonElement) => void;
}

export function TrackedButton({
    bgClassName = 'bg-(--foreground)',
    children,
    className,
    hoverBgClassName = 'hover:bg-(--hover-background)',
    hoverTextClassName = 'hover:text-(--foreground)',
    name,
    onAttach: handleAttach,
    onDetach: handleDetach,
    textClassName = 'text-(--background)',
    ...props
}: TrackedButtonProps): JSX.Element {
    const ref = useCallback(
        (node: HTMLButtonElement | null) => {
            if (!node) {
                // oxlint-disable-next-line eslint/no-undefined unicorn/no-useless-undefined
                return undefined;
            }
            handleAttach(name, node);
            return () => {
                handleDetach(name, node);
            };
        },
        [handleAttach, handleDetach, name]
    );
    return (
        <button
            className={`cursor-pointer rounded-xl border px-4 py-2 transition-colors duration-200 ${bgClassName} ${textClassName} ${hoverBgClassName} ${hoverTextClassName} ${className ?? ''}`}
            ref={ref}
            type="button"
            {...props}
        >
            {children}
        </button>
    );
}
