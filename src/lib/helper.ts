export function idFunc<T>(value: T): T {
    return value;
}

export function bytesToString(bytes: number): string {
    if (2 ** 30 <= bytes) {
        return `${bytes / 2 ** 30}GiB`;
    }
    if (2 ** 20 <= bytes) {
        return `${bytes / 2 ** 20}MiB`;
    }
    if (2 ** 10 <= bytes) {
        return `${bytes / 2 ** 10}KiB`;
    }
    return `${bytes}B`;
}
