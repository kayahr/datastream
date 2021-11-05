/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

/** Enum for specifying endianness */
export enum Endianness {
    /** Little Endian (Low byte before high byte) */
    LITTLE,

    /** Big Endian (High byte before low byte) */
    BIG
}

/** Cached native endianness */
let nativeEndianness: Endianness | null = null;

export namespace Endianness {
    /**
     * Returns the native endianness of the system.
     *
     * @return The system's native endianness.
     */
    export function getNative(): Endianness {
        if (nativeEndianness == null) {
            const byteArray = new Uint8Array([ 254, 255 ]);
            const wordArray = new Uint16Array(byteArray.buffer, 0, 1);
            nativeEndianness = wordArray[0] === 0xfffe ? Endianness.LITTLE : Endianness.BIG;
        }
        return nativeEndianness;
    }
}
