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
     * @returns the system's native endianness.
     */
    export function getNative(): Endianness {
        if (nativeEndianness == null) {
            const byteArray = new Uint8Array([ 254, 255 ]);
            const wordArray = new Uint16Array(byteArray.buffer, 0, 1);
            nativeEndianness = wordArray[0] === 0xfffe ? Endianness.LITTLE : Endianness.BIG;
        }
        return nativeEndianness;
    }

    /**
     * Swaps endianness of given 16 bit value.
     *
     * @param value - The value to swap.
     * @returns the swapped value.
     */
    export function swap16(value: number): number {
        return ((value & 0xff) << 8) | (value >> 8);
    }

    /**
     * Swaps endianness of given 32 bit value.
     *
     * @param value - The value to swap.
     * @returns the swapped value.
     */
    export function swap32(value: number): number {
        return (((value & 0xff) << 24)
            | ((value & 0xff00) << 8)
            | ((value & 0xff0000) >> 8)
            | (value >>> 24)) >>> 0;
    }

    /**
     * Swaps endianness of given 64 bit value.
     *
     * @param value - The value to swap.
     * @returns the swapped value.
     */
    export function swap64(value: bigint): bigint {
        return ((value & 0xffn) << 56n)
            | ((value & 0xff00n) << 40n)
            | ((value & 0xff0000n) << 24n)
            | ((value & 0xff000000n) << 8n)
            | ((value & 0xff00000000n) >> 8n)
            | ((value & 0xff0000000000n) >> 24n)
            | ((value & 0xff000000000000n) >> 40n)
            | (value >> 56n);
    }
}
