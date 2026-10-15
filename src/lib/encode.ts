export function encodeSetDataValue(name: string, data: string): Uint8Array {
    const utf8Encoder = new TextEncoder();
    const nameBytes = utf8Encoder.encode(name);
    const dataBytes = Uint8Array.fromHex(data);
    const value = new Uint8Array(1 + nameBytes.length + dataBytes.length);
    value.set([nameBytes.length], 0);
    value.set(nameBytes, 1);
    value.set(dataBytes, 1 + nameBytes.length);
    return value;
}
