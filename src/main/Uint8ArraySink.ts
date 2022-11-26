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

    /** The current capacity (number of bytes) of the buffer. */
    private capacity: number;

    /** The current buffer holding the written bytes. */
    private buffer: Uint8Array;

    /**
     * Creates a new Uint8Array sink with the given initial capacity.
     */
    public constructor(capacity = 1024) {
        this.capacity = capacity;
        this.buffer = new Uint8Array(capacity);
    }

    /** @inheritDoc */
    public write(chunk: Uint8Array | number): void {
        const isNumber = typeof chunk === "number";
        let capacity = this.capacity;
        const newSize = this.size + (isNumber ? 1 : chunk.byteLength);
        if (newSize > capacity) {
            while (newSize > capacity) {
                capacity += capacity;
            }
            const newBuffer = new Uint8Array(capacity);
            this.capacity = capacity;
            newBuffer.set(this.buffer, 0);
            this.buffer = newBuffer;
        }
        if (isNumber) {
            this.buffer[this.size] = chunk;
        } else {
            this.buffer.set(chunk, this.size);
        }
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
        return this.capacity;
    }

    /**
     * Returns the byte at the given index.
     *
     * @param index - The index. Negative indices references bytes from the end.
     * @returns The found byte or undefined if out of bounds.
     */
    public at(index: number): number | undefined {
        if (index < 0) {
            index += this.size;
        }
        if (index >= this.size) {
            return undefined;
        }
        return this.buffer[index];
    }

    /**
     * @returns the written bytes.
     */
    public getData(): Uint8Array {
        if (this.size === this.capacity) {
            return this.buffer;
        } else {
            return this.buffer.subarray(0, this.size);
        }
    }

    /**
     * Resets the sink so it can be used for another operation. This keeps the current capacity and reuses the same
     * buffer so make sure you finished processing the previous data.
     */
    public reset(): void {
        this.size = 0;
    }

    /**
     * Rewinds the sink by the given number of bytes. The size shrinks accordingly but the capacity stays the same as
     * before.
     *
     * @param numBytes - The number of bytes to remove from the end of the sink.
     */
    public rewind(numBytes: number): void {
        this.size = Math.max(0, this.size - numBytes);
    }
}
