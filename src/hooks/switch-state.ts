import { useCallback, useState } from 'react';

export type UseSwitchStateResult = [boolean, () => void, () => void];

export function useSwitchState(
    initialState: boolean = false
): UseSwitchStateResult {
    const [state, setState] = useState(initialState);
    const setOff = useCallback(() => {
        setState(false);
    }, []);
    const setOn = useCallback(() => {
        setState(true);
    }, []);
    return [state, setOff, setOn];
}
