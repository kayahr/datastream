/*
 * Copyright (C) 2022 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { DataReaderSource } from "../DataReaderSource";

/**
 * Source which reads from a Uint8Array.
 */
export class Uint8ArraySource implements DataReaderSource {
    /** The array to read from. Null when already passed to reader. */
    private array: Uint8Array | null;

    /**
     * Creates a new Uint8Array sink with the given initial capacity.
     */
    public constructor(array: Uint8Array) {
        this.array = array;
    }

    /** @inheritDoc */
    public read(): ReadableStreamReadResult<Uint8Array> {
        const array = this.array;
        if (array == null) {
            return { done: true };
        } else {
            this.array = null;
            return { done: false, value: array };
        }
    }
}
