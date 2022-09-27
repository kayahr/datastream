/*
 * Copyright (C) 2022 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { DataWriterSink } from "./DataWriterSink";

/**
 * Sink which writes into a growing Uint8Array.
 */
export class Uint8ArraySink implements DataWriterSink {
    /** The current number of bytes written to the sink. */
    private size = 0;

    /** The current buffer holding the written bytes. */
    private buffer: Uint8Array;

    /**
     * Creates a new Uint8Array sink with the given initial capacity.
     */
    public constructor(capacity = 32) {
        this.buffer = new Uint8Array(capacity);
    }

    /** @inheritDoc */
    public write(chunk: Uint8Array): void {
        let capacity = this.buffer.byteLength;
        const newSize = this.size + chunk.byteLength;
        if (newSize > capacity) {
            while (newSize > capacity) {
                capacity += capacity;
            }
            const newBuffer = new Uint8Array(capacity);
            newBuffer.set(this.buffer, 0);
            this.buffer = newBuffer;
        }
        this.buffer.set(chunk, this.size);
        this.size = newSize;
    }

    /**
     * @returns the number of bytes written.
     */
    public getSize(): number {
        return this.size;
    }

    /**
     * @returns the current capacity. When size reaches this capacity then the internal buffer must grow.
     */
    public getCapacity(): number {
        return this.buffer.byteLength;
    }

    /**
     * @returns the written bytes.
     */
    public getData(): Uint8Array {
        return this.buffer.subarray(0, this.size);
    }
}
