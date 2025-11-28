/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { createTextEncoder } from "@kayahr/text-encoding/no-encodings";
import type { DataWriterSink } from "./DataWriterSink.ts";
import { Endianness, getNativeEndianness } from "./Endianness.ts";

/** The default buffer size (64KB). */
const DEFAULT_BUFFER_SIZE = 65536;

/**
 * Options for constructing a data writer.
 */
export interface DataWriterOptions {
    /** The buffer size. Defaults to 64KB. */
    bufferSize?: number;

    /** The endianness to use for writing multi-byte values. Defaults to native endianness. */
    endianness?: Endianness;

    /** The encoding used to write strings. Defaults to "utf-8". */
    encoding?: string;
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
    private readonly encoding: string;
    private written = 0;
    private byte = 0;
    private bit = 0;
    private writing = Promise.resolve();

    /**
     * Creates a new data writer for writing data to the given sink.
     *
     * @param sink - The sink to write data to.
     */
    public constructor(sink: DataWriterSink, { bufferSize = DEFAULT_BUFFER_SIZE, endianness = Endianness.LITTLE,
            encoding = "utf-8" }: DataWriterOptions = {}) {
        this.sink = sink;
        this.bufferSize = bufferSize;
        this.endianness = endianness;
        this.encoding = encoding;
        this.buffer = new Uint8Array(bufferSize);
    }

    /**
     * Returns the default endianness of the writer.
     *
     * @returns the default endianness used when no endianness is specified as parameter to the various write methods.
     */
    public getEndianness(): Endianness {
        return this.endianness;
    }

    /**
     * Returns the default encoding of the writer.
     *
     * @returns the default encoding used when no encoding is specified as parameter to the various string write
     *          methods.
     */
    public getEncoding(): string {
        return this.encoding;
    }

    /**
     * @returns The buffer size of the writer.
     */
    public getBufferSize(): number {
        return this.bufferSize;
    }

    /**
     * Returns the number of written bytes. This value reflects the number of bytes the writer was told to write so
     * far, not the actual number of written bytes (which may not be finished because writing happens asynchronously).
     * When a write operation fails then this counter is invalid and may not be in sync with the output sink any
     * longer.
     *
     * @returns the number of written bytes.
     */
    public getWritten(): number {
        return this.written;
    }

    /**
     * Writes all buffered data to the sink. If an incomplete byte is buffered then it is padded with zeroes so the
     * writer points to the beginning of a new byte after flushing.
     */
    public flush(): Promise<void> {
        const { byte, bit } = this;
        if (byte > 0 || bit > 0) {
            this.byte = 0;
            this.bit = 0;
            const chunk = new Uint8Array(this.buffer.subarray(0, byte + (bit > 0 ? 1 : 0)));
            this.writing = this.writing.then(() => this.sink.write(chunk));
        }
        return this.writing;
    }

    /**
     * Writes a single bit.
     *
     * @param value - The bit to write.
     */
    public writeBit(value: number): void {
        this.buffer[this.byte] = (this.buffer[this.byte] & ((1 << this.bit) - 1)) | ((value & 1) << this.bit);
        this.bit++;
        if (this.bit >= 8) {
            this.bit = 0;
            this.byte++;
            this.written++;
            if (this.byte >= this.bufferSize) {
                void this.flush();
            }
        }
    }

    /**
     * Writes an unsigned 8 bit value.
     *
     * @param value - The value to write.
     */
    public writeUint8(value: number): void {
        if (this.bit === 0) {
            // At byte boundary, whole byte can be written at once
            this.buffer[this.byte] = value;
            this.byte++;
            this.written++;
            if (this.byte >= this.bufferSize) {
                void this.flush();
            }
        } else {
            // Not at byte boundary, writing each bit separately
            this.writeBit(value >> 0 & 1);
            this.writeBit(value >> 1 & 1);
            this.writeBit(value >> 2 & 1);
            this.writeBit(value >> 3 & 1);
            this.writeBit(value >> 4 & 1);
            this.writeBit(value >> 5 & 1);
            this.writeBit(value >> 6 & 1);
            this.writeBit(value >> 7 & 1);
        }
    }

    /**
     * Writes a signed 8 bit value.
     *
     * @param value - The value to write.
     */
    public writeInt8(value: number): void {
        this.writeUint8(value);
    }

    /**
     * Writes an unsigned 16 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeUint16(value: number, endianness: Endianness = this.endianness): void {
        if (endianness === Endianness.LITTLE) {
            this.writeUint8(value & 0xff);
            this.writeUint8(value >>> 8);
        } else {
            this.writeUint8(value >>> 8);
            this.writeUint8(value & 0xff);
        }
    }

    /**
     * Writes a signed 16 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeInt16(value: number, endianness: Endianness = this.endianness): void {
        this.writeUint16(value, endianness);
    }

    /**
     * Writes an unsigned 32 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeUint32(value: number, endianness: Endianness = this.endianness): void {
        if (endianness === Endianness.LITTLE) {
            this.writeUint16(value & 0xffff, endianness);
            this.writeUint16(value >>> 16, endianness);
        } else {
            this.writeUint16(value >>> 16, endianness);
            this.writeUint16(value & 0xffff, endianness);
        }
    }

    /**
     * Writes a signed 32 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeInt32(value: number, endianness: Endianness = this.endianness): void {
        this.writeUint32(value, endianness);
    }

    /**
     * Writes an unsigned 64 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeBigUint64(value: bigint, endianness: Endianness = this.endianness): void {
        if (endianness === Endianness.LITTLE) {
            this.writeUint32(Number(value & 0xffffffffn), endianness);
            this.writeUint32(Number(value >> 32n), endianness);
        } else {
            this.writeUint32(Number(value >> 32n), endianness);
            this.writeUint32(Number(value & 0xffffffffn), endianness);
        }
    }

    /**
     * Writes an signed 64 bit value.
     *
     * @param value      - The value to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeBigInt64(value: bigint, endianness: Endianness = this.endianness): void {
        this.writeBigUint64(value, endianness);
    }

    /**
     * Writes an array of unsigned 8 bit values.
     *
     * @param values - The values to write.
     */
    public writeUint8Array(values: Uint8Array | Uint8ClampedArray): void {
        const len = values.length;
        if (this.bit === 0) {
            let start = 0;
            while (start < len) {
                const end = start + this.bufferSize - this.byte;
                const chunk = values.subarray(start, end);
                this.buffer.set(chunk, this.byte);
                start += chunk.length;
                this.byte += chunk.length;
                this.written += chunk.length;
                if (this.byte >= this.bufferSize) {
                    void this.flush();
                }
            }
        } else {
            for (const value of values) {
                this.writeUint8(value);
            }
        }
    }

    /**
     * Writes an array of signed 8 bit values.
     *
     * @param values - The values to write.
     */
    public writeInt8Array(values: Int8Array): void {
        const len = values.length;
        if (this.bit === 0) {
            let start = 0;
            while (start < len) {
                const end = start + this.bufferSize - this.byte;
                const chunk = values.subarray(start, end);
                this.buffer.set(chunk, this.byte);
                start += chunk.length;
                this.byte += chunk.length;
                this.written += chunk.length;
                if (this.byte >= this.bufferSize) {
                    void this.flush();
                }
            }
        } else {
            for (const value of values) {
                this.writeInt8(value);
            }
        }
    }

    /**
     * Writes an array of unsigned 16 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeUint16Array(values: Uint16Array, endianness: Endianness = this.endianness): void {
        if (endianness === getNativeEndianness()) {
            this.writeUint8Array(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            for (const value of values) {
                this.writeUint16(value, endianness);
            }
        }
    }

    /**
     * Writes an array of signed 16 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeInt16Array(values: Int16Array, endianness: Endianness = this.endianness): void {
        if (endianness === getNativeEndianness()) {
            this.writeUint8Array(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            for (const value of values) {
                this.writeInt16(value, endianness);
            }
        }
    }

    /**
     * Writes an array of unsigned 32 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeUint32Array(values: Uint32Array, endianness: Endianness = this.endianness): void {
        if (endianness === getNativeEndianness()) {
            this.writeUint8Array(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            for (const value of values) {
                this.writeUint32(value, endianness);
            }
        }
    }

    /**
     * Writes an array of signed 32 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeInt32Array(values: Int32Array, endianness: Endianness = this.endianness): void {
        if (endianness === getNativeEndianness()) {
            this.writeUint8Array(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            for (const value of values) {
                this.writeInt32(value, endianness);
            }
        }
    }

    /**
     * Writes an array of unsigned 64 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeBigUint64Array(values: BigUint64Array, endianness: Endianness = this.endianness): void {
        if (endianness === getNativeEndianness()) {
            this.writeUint8Array(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            for (const value of values) {
                this.writeBigUint64(value, endianness);
            }
        }
    }

    /**
     * Writes an array of signed 64 bit values.
     *
     * @param values     - The values to write.
     * @param endianness - Optional endianness. Defaults to endianness the writer was configured with.
     */
    public writeBigInt64Array(values: BigInt64Array, endianness: Endianness = this.endianness): void {
        if (endianness === getNativeEndianness()) {
            this.writeUint8Array(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
        } else {
            for (const value of values) {
                this.writeBigInt64(value, endianness);
            }
        }
    }

    /**
     * Writes a string.
     *
     * @param text     - The text to write.
     * @param encoding - The encoding. Defaults to encoding the writer was configured with.
     */
    public writeString(text: string, encoding = this.encoding): void {
        this.writeUint8Array(createTextEncoder(encoding).encode(text));
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
