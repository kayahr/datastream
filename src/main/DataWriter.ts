/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { createTextEncoder } from "@kayahr/text-encoding";

import { DataWriterSink } from "./DataWriterSink";
import { Endianness } from "./Endianness";

/** The default buffer size (64KB). */
export const DEFAULT_BUFFER_SIZE = 65536;

/** The default endianness (native). */
export const DEFAULT_ENDIANNESS = Endianness.getNative();

/**
 * Options for constructing a data writer.
 */
export interface DataWriterOptions {
    /** The buffer size. Defaults to 64KB. */
    bufferSize?: number;

    /** The endianness to use for writing multi-byte values. Defaults to native endianness. */
    endianness?: Endianness;
}

/**
 * Writes all kind of data values to a specified sink.
 *
 * Written data is buffered so you have to call the flush method when you are done writing all data to ensure that all
 * data is written to the sink.
 *
 * All methods of the writer are asynchronous but can safely be used synchronously when you have no reason to wait for
 * it. Usually you only want to wait for the flush method at the end of a write operation.
 */
export class DataWriter {
    private readonly sink: DataWriterSink;
    private readonly buffer: Uint8Array;
    private readonly bufferSize: number;
    private readonly endianness: Endianness;
    private written: number = 0;
    private byte: number = 0;
    private bit: number = 0;

    /**
     * Creates a new data writer for writing data to the given sink.
     *
     * @param sink - The sink to write data to.
     */
    public constructor(sink: DataWriterSink, { bufferSize = DEFAULT_BUFFER_SIZE, endianness = Endianness.LITTLE }:
            DataWriterOptions = {}) {
        this.sink = sink;
        this.bufferSize = bufferSize;
        this.endianness = endianness;
        this.buffer = new Uint8Array(bufferSize);
    }

    /**
     * Returns the default endianness of the writer.
     *
     * @return The default endianness used when no endianness is specified as parameter to the various write methods.
     */
    public getEndianness(): Endianness {
        return this.endianness;
    }

    /**
     * Returns the number of written bytes. This value reflects the number of bytes the writer was told to write so
     * far, not the actual number of written bytes (which may not be finished because writing happens asynchronously).
     * When a write operation fails then this counter is invalid and may not be in sync with the output sink any
     * longer.
     *
     * @return The number of written bytes.
     */
    public getWritten(): number {
        return this.written;
    }

    /**
     * Writes all buffered data to the sink. If an incomplete byte is buffered then it is padded with zeroes so the
     * writer points to the beginning of a new byte after flushing.
     */
    public async flush(): Promise<void> {
        const { byte, bit } = this;
        if (byte > 0 || bit > 0) {
            this.byte = 0;
            this.bit = 0;
            const chunk = new Uint8Array(this.buffer.subarray(0, byte + (bit > 0 ? 1 : 0)));
            await this.sink.write(chunk);
        }
    }

    /**
     * Writes a single bit.
     *
     * @param value - The bit to write.
     */
    public async writeBit(value: number): Promise<void> {
        this.buffer[this.byte] |= (value & 1) << this.bit;
        this.bit++;
        if (this.bit >= 8) {
            this.bit = 0;
            this.byte++;
            this.written++;
            if (this.byte >= this.bufferSize) {
                await this.flush();
            }
        }
    }

    /**
     * Writes an unsigned 8 bit value.
     *
     * @param value - The value to write.
     */
    public async writeUint8(value: number): Promise<void> {
        if (this.bit === 0) {
            // At byte boundary, whole byte can be written at once
            this.buffer[this.byte] = value;
            this.byte++;
            this.written++;
            if (this.byte >= this.bufferSize) {
                await this.flush();
            }
        } else {
            // Not at byte boundary, writing each bit separately
            void this.writeBit(value >> 0 & 1);
            void this.writeBit(value >> 1 & 1);
            void this.writeBit(value >> 2 & 1);
            void this.writeBit(value >> 3 & 1);
            void this.writeBit(value >> 4 & 1);
            void this.writeBit(value >> 5 & 1);
            void this.writeBit(value >> 6 & 1);
            await this.writeBit(value >> 7 & 1);
        }
    }

    /**
     * Writes a signed 8 bit value.
     *
     * @param value - The value to write.
     */
    public async writeInt8(value: number): Promise<void> {
        await this.writeUint8(value);
    }

    /**
     * Writes an unsigned 16 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeUint16(value: number, endianness: Endianness = this.endianness): Promise<void> {
        if (endianness === Endianness.LITTLE) {
            void this.writeUint8(value & 0xff);
            await this.writeUint8(value >>> 8);
        } else {
            void this.writeUint8(value >>> 8);
            await this.writeUint8(value & 0xff);
        }
    }

    /**
     * Writes a signed 16 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeInt16(value: number, endianness: Endianness = this.endianness): Promise<void> {
        await this.writeUint16(value, endianness);
    }

    /**
     * Writes an unsigned 32 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeUint32(value: number, endianness: Endianness = this.endianness): Promise<void> {
        if (endianness === Endianness.LITTLE) {
            void this.writeUint16(value & 0xffff, endianness);
            await this.writeUint16(value >>> 16, endianness);
        } else {
            void this.writeUint16(value >>> 16, endianness);
            await this.writeUint16(value & 0xffff, endianness);
        }
    }

    /**
     * Writes a signed 32 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeInt32(value: number, endianness: Endianness = this.endianness): Promise<void> {
        await this.writeUint32(value, endianness);
    }

    /**
     * Writes an unsigned 64 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeBigUint64(value: bigint | number, endianness: Endianness = this.endianness): Promise<void> {
        const bigValue = BigInt(value);
        if (endianness === Endianness.LITTLE) {
            void this.writeUint32(Number(bigValue & BigInt(0xffffffff)), endianness);
            await this.writeUint32(Number(bigValue >> BigInt(32)), endianness);
        } else {
            void this.writeUint32(Number(bigValue >> BigInt(32)), endianness);
            await this.writeUint32(Number(bigValue & BigInt(0xffffffff)), endianness);
        }
    }

    /**
     * Writes an signed 64 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeBigInt64(value: bigint | number, endianness: Endianness = this.endianness): Promise<void> {
        await this.writeBigUint64(value, endianness);
    }

    /**
     * Writes an array of unsigned 8 bit values.
     *
     * @param values - The values to write.
     */
    public async writeUint8s(values: Uint8Array | Uint8ClampedArray | number[]): Promise<void> {
        const len = values.length;
        let lastPromise: Promise<void> | null = null;
        if (this.bit === 0) {
            let start = 0;
            while (start < len) {
                const end = start + this.bufferSize - this.byte;
                const chunk = values instanceof Array ? values.slice(start, end) : values.subarray(start, end);
                this.buffer.set(chunk, this.byte);
                start += chunk.length;
                this.byte += chunk.length;
                this.written += chunk.length;
                if (this.byte >= this.bufferSize) {
                    lastPromise = this.flush();
                }
            }
        } else {
            for (const value of values) {
                lastPromise = this.writeUint8(value);
            }
        }
        if (lastPromise != null) {
            await lastPromise;
        }
    }

    /**
     * Writes an array of signed 8 bit values.
     *
     * @param values - The values to write.
     */
    public async writeInt8s(values: Int8Array | number[]): Promise<void> {
        const len = values.length;
        let lastPromise: Promise<void> | null = null;
        if (this.bit === 0) {
            let start = 0;
            while (start < len) {
                const end = start + this.bufferSize - this.byte;
                const chunk = values instanceof Array ? values.slice(start, end) : values.subarray(start, end);
                this.buffer.set(chunk, this.byte);
                start += chunk.length;
                this.byte += chunk.length;
                this.written += chunk.length;
                if (this.byte >= this.bufferSize) {
                    lastPromise = this.flush();
                }
            }
        } else {
            for (const value of values) {
                lastPromise = this.writeInt8(value);
            }
        }
        if (lastPromise != null) {
            await lastPromise;
        }
    }

    /**
     * Writes an array of unsigned 16 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeUint16s(values: Uint16Array | number[], endianness: Endianness = this.endianness): Promise<void> {
        if (endianness === Endianness.getNative()) {
            if (values instanceof Array) {
                values = Uint16Array.from(values);
            }
            await this.writeUint8s(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            let lastPromise: Promise<void> | null = null;
            for (const value of values) {
                lastPromise = this.writeUint16(value, endianness);
            }
            if (lastPromise != null) {
                await lastPromise;
            }
        }
    }

    /**
     * Writes an array of signed 16 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeInt16s(values: Int16Array | number[], endianness: Endianness = this.endianness): Promise<void> {
        if (endianness === Endianness.getNative()) {
            if (values instanceof Array) {
                values = Int16Array.from(values);
            }
            await this.writeUint8s(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            let lastPromise: Promise<void> | null = null;
            for (const value of values) {
                lastPromise = this.writeInt16(value, endianness);
            }
            if (lastPromise != null) {
                await lastPromise;
            }
        }
    }

    /**
     * Writes an array of unsigned 32 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeUint32s(values: Uint32Array | number[], endianness: Endianness = this.endianness): Promise<void> {
        if (endianness === Endianness.getNative()) {
            if (values instanceof Array) {
                values = Uint32Array.from(values);
            }
            await this.writeUint8s(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            let lastPromise: Promise<void> | null = null;
            for (const value of values) {
                lastPromise = this.writeUint32(value, endianness);
            }
            if (lastPromise != null) {
                await lastPromise;
            }
        }
    }

    /**
     * Writes an array of signed 32 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeInt32s(values: Int32Array | number[], endianness: Endianness = this.endianness): Promise<void> {
        if (endianness === Endianness.getNative()) {
            if (values instanceof Array) {
                values = Int32Array.from(values);
            }
            await this.writeUint8s(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            let lastPromise: Promise<void> | null = null;
            for (const value of values) {
                lastPromise = this.writeInt32(value, endianness);
            }
            if (lastPromise != null) {
                await lastPromise;
            }
        }
    }

    /**
     * Writes an array of unsigned 64 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeBigUint64s(values: BigUint64Array | Array<bigint>, endianness: Endianness = this.endianness):
            Promise<void> {
        // TODO Check for native endianness
        if (endianness === Endianness.LITTLE) {
            if (values instanceof Array) {
                values = BigUint64Array.from(values);
            }
            await this.writeUint8s(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            let lastPromise: Promise<void> | null = null;
            for (const value of values) {
                lastPromise = this.writeBigUint64(value, endianness);
            }
            if (lastPromise != null) {
                await lastPromise;
            }
        }
    }

    /**
     * Writes an array of signed 64 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public async writeBigInt64s(values: BigInt64Array | Array<bigint>, endianness: Endianness = this.endianness):
            Promise<void> {
        // TODO Check for native endianness
        if (endianness === Endianness.LITTLE) {
            if (values instanceof Array) {
                values = BigInt64Array.from(values);
            }
            await this.writeUint8s(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            let lastPromise: Promise<void> | null = null;
            for (const value of values) {
                lastPromise = this.writeBigInt64(value, endianness);
            }
            if (lastPromise != null) {
                await lastPromise;
            }
        }
    }

    /**
     * Writes a text.
     *
     * @param text     - The text to write.
     * @param encoding - The encoding. Defaults to "utf-8".
     */
    public async writeText(text: string, encoding?: string): Promise<void> {
        return this.writeUint8s(createTextEncoder(encoding).encode(text));
    }
}

/**
 * Creates a data writer for the given stream, passes it to the given callback function, flushes the data writer
 * and release the stream writer lock after callback execution.
 *
 * @param stream   - The stream to write to.
 * @param callback - The callback function to call with the created data writer as argument.
 * @param options  - Optional data writer options.
 */
export async function writeDataToStream(stream: WritableStream<Uint8Array>,
        callback: (writer: DataWriter) => Promise<void> | void, options?: DataWriterOptions): Promise<void> {
    const writer = stream.getWriter();
    try {
        const dataWriter = new DataWriter(writer, options);
        await callback(dataWriter);
        await dataWriter.flush();
    } finally {
        writer.releaseLock();
    }
}
