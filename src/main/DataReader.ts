/*
 * Copyright (C) 2022 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { DataReaderSource } from "./DataReaderSource";
import { Endianness } from "./Endianness";
import { Uint8ArraySink } from "./Uint8ArraySink";

/**
 * Options for constructing a data reader.
 */
export interface DataReaderOptions {
    /** The endianness to use for reading multi-byte values. Defaults to native endianness. */
    endianness?: Endianness;
}

export enum EOL {
    /** Line feed character (Unix) */
    LF,

    /** Carriage return character (Old Mac OS) */
    CR,

    /** Carriage return and line feed character (Windows) */
    CRLF,

    /** Carriage return or line feed (Old Mac OS or Unix) */
    CR_OR_LF,

    /** Carriage return and line feed or only line feed (Windows or Unix) */
    CRLF_OR_LF
}

export namespace EOL {
    export function isEOL(eol: EOL, byte: number, previousByte?: number): number {
        switch (eol) {
            case EOL.LF:
                return byte === 0x0a ? 1 : 0;
            case EOL.CR:
                return byte === 0x0d ? 1 : 0;
            case EOL.CRLF:
                return previousByte === 0x0d && byte === 0x0a ? 2 : 0;
            case EOL.CR_OR_LF:
                return byte === 0x0a || byte === 0x0d ? 1 : 0;
            case EOL.CRLF_OR_LF:
                return byte === 0x0a ? previousByte === 0x0d ? 2 : 1 : 0;
        }
    }
}

export interface ReadStringOptions {
    /** The text encoding. Defaults to utf-8. */
    encoding?: string;

    /**
     * The initial buffer size for creating the string bytes. The buffer size duplicates itself when full, so the
     * higher this value is set the less buffer grows happen but the more memory is wasted for reading small lines.
     * Defaults to 1024.
     */
    bufferSize?: number;

    /** The maximum number of bytes (not characters!) to read. Default is unlimited. */
    maxBytes?: number;
}

export interface ReadLineOptions extends ReadStringOptions {
    /** The EOL marker to stop reading at. Defaults to CRLF_OR_LF. */
    eol?: EOL;

    /** True to include EOL marker in returned line. Defaults to false. */
    includeEOL?: boolean;

    /** True to stop reading at a null character. False (default) to do not so. */
    nullTerminated?: boolean
}

/**
 * Reads all kind of data values from the specified source.
 */
export class DataReader {
    private readonly source: DataReaderSource;
    private buffer: Uint8Array;
    private readonly endianness: Endianness;
    private bufferSize: number;
    private read: number = 0;
    private byte: number = 0;
    private bit: number = 0;

    /**
     * Creates a new data reader for reading data from the given source.
     *
     * @param source - The source to read from.
     */
    public constructor(source: DataReaderSource, { endianness = Endianness.getNative() }:
            DataReaderOptions = {}) {
        this.source = source;
        this.endianness = endianness;
        this.bufferSize = 0;
        this.buffer = new Uint8Array(0);
    }

    /**
     * Returns the default endianness of the reader.
     *
     * @return The default endianness used when no endianness is specified as parameter to the various read methods.
     */
    public getEndianness(): Endianness {
        return this.endianness;
    }

    /**
     * @returns the number of bytes that have been read so far.
     */
    public getRead(): number {
        return this.read;
    }

    /**
     * Fills the buffer when empty.
     *
     * @returns True if buffer has been filled or is still filled, false if end of stream is reached
     */
    private async fill(): Promise<boolean> {
        if (this.byte < this.bufferSize) {
            // No need to fill buffer because buffer still has unread bytes
            return true;
        }
        this.byte = 0;
        const { done, value } = await this.source.read();
        if (done) {
            // End of stream has been reached
            this.buffer = new Uint8Array(0);
            this.bufferSize = 0;
            return false;
        } else {
            // Data received, fill butter
            this.buffer = value;
            this.bufferSize = value.length;
            return true;
        }
    }

    /**
     * Reads and returns a single bit from the stream.
     *
     * @return The read bit. Null if end of stream has been reached.
     */
    public async readBit(): Promise<number | null> {
        if (this.byte >= this.bufferSize) {
            if (!await this.fill()) {
                return null;
            }
        }
        const value = (this.buffer[this.byte] >> this.bit) & 1;
        this.bit++;
        if (this.bit >= 8) {
            this.bit = 0;
            this.byte++;
            this.read++;
        }
        return value;
    }

    /**
     * Reads and returns an unsigned 8 bit value.
     *
     * @return The read value. Null if end of stream has been reached.
     */
    public async readUint8(): Promise<number | null> {
        if (this.bit === 0) {
            // At byte boundary, whole byte can be read at once
            if (this.byte >= this.bufferSize) {
                if (!await this.fill()) {
                    return null;
                }
            }
            const value = this.buffer[this.byte];
            this.byte++;
            this.read++;
            return value;
        } else {
            // In middle of a byte. Read low bits, fill buffer and then read high bits and return combined byte
            const low = this.buffer[this.byte] >> this.bit;
            this.byte++;
            if (this.byte >= this.bufferSize) {
                if (!await this.fill()) {
                    return null;
                }
            }
            const high = (this.buffer[this.byte] & (2 ** this.bit - 1)) << (8 - this.bit);
            return low | high;
        }
    }

    /**
     * Reads and returns an signed 8 bit value.
     *
     * @returns the read value. Null if end of stream has been reached.
     */
    public async readInt8(): Promise<number | null> {
        const value = await this.readUint8();
        if (value == null) {
            return value;
        }
        return value << 24 >> 24;
    }

    /**
     * Reads an unsigned 16 bit value.
     *
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     */
    public async readUint16(endianness: Endianness = this.endianness): Promise<number | null> {
        const first = await this.readUint8();
        if (first == null) {
            return null;
        }
        const second = await this.readUint8();
        if (second == null) {
            return null;
        }
        if (endianness === Endianness.LITTLE) {
            return first | (second << 8);
        } else {
            return (first << 8) | second;
        }
    }

    /**
     * Reads a signed 16 bit value.
     *
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     */
    public async readInt16(endianness: Endianness = this.endianness): Promise<number | null> {
        const unsigned = await this.readUint16(endianness);
        if (unsigned == null) {
            return null;
        }
        return unsigned << 16 >> 16;
    }

    /**
     * Reads an unsigned 32 bit value.
     *
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     */
    public async readUint32(endianness: Endianness = this.endianness): Promise<number | null> {
        const unsigned = await this.readInt32(endianness);
        if (unsigned == null) {
            return null;
        }
        return unsigned >>> 0;
    }

    /**
     * Reads a signed 32 bit value.
     *
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     */
    public async readInt32(endianness: Endianness = this.endianness): Promise<number | null> {
        const first = await this.readUint16(endianness);
        if (first == null) {
            return null;
        }
        const second = await this.readUint16(endianness);
        if (second == null) {
            return null;
        }
        if (endianness === Endianness.LITTLE) {
            return first | (second << 16);
        } else {
            return (first << 16) | second;
        }
    }

    /**
     * Reads a unsigned 64 bit value.
     *
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     */
    public async readBigUint64(endianness: Endianness = this.endianness): Promise<bigint | null> {
        const first = await this.readUint32(endianness);
        if (first == null) {
            return null;
        }
        const second = await this.readUint32(endianness);
        if (second == null) {
            return null;
        }
        if (endianness === Endianness.LITTLE) {
            return BigInt(first) | (BigInt(second) << 32n);
        } else {
            return BigInt(second) | (BigInt(first) << 32n);
        }
    }

    /**
     * Reads a signed 64 bit value.
     *
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     */
    public async readBigInt64(endianness: Endianness = this.endianness): Promise<bigint | null> {
        const unsigned = await this.readBigUint64(endianness);
        if (unsigned == null) {
            return null;
        }
        if ((unsigned & (1n << 63n)) !== 0n) {
            return unsigned - (1n << 64n);
        }
        return unsigned;
    }

    /**
     * Reads an array of unsigned 8 bit values.
     *
     * @param buffer - The buffer to write the read bytes to.
     * @param offset - Offset within the buffer to start writing to. Defaults to 0.
     * @param size   - Number of bytes to read. Defaults to buffer size minus offset.
     * @returns the number of read bytes. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readUint8Array(buffer: Uint8Array | Uint8ClampedArray, offset = 0, size = buffer.length - offset):
            Promise<number> {
        let read = 0;
        if (this.bit === 0) {
            // At byte boundary, whole byte buffers can be read at once
            while (read < size) {
                if (this.byte >= this.bufferSize) {
                    if (!await this.fill()) {
                        return read;
                    }
                }
                const chunkSize = Math.min(size - read, this.bufferSize - this.byte);
                const chunk = this.buffer.subarray(this.byte, this.byte + chunkSize);
                buffer.set(chunk, offset + read);
                read += chunkSize;
                this.byte += chunkSize;
                this.read += chunkSize;
            }
        } else {
            // In middle of a byte. Have to read bytes one by one
            for (let i = 0; i < size; i++) {
                const value = await this.readUint8();
                if (value == null) {
                    return read;
                }
                buffer[offset + i] = value;
                read++;
            }
        }
        return read;
    }

    /**
     * Reads an array of signed 8 bit values.
     *
     * @param buffer - The buffer to write the read bytes to.
     * @param offset - Offset within the buffer to start writing to. Defaults to 0.
     * @param size   - Number of bytes to read. Defaults to buffer size minus offset.
     * @returns the number of read bytes. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readInt8Array(buffer: Int8Array, offset = 0, size = buffer.length - offset): Promise<number> {
        return this.readUint8Array(new Uint8Array(buffer.buffer), offset, size);
    }

    /**
     * Reads an array of unsigned 16 bit values.
     *
     * @param buffer     - The buffer to write the read bytes to.
     * @param offset     - Offset within the buffer to start writing to. Defaults to 0.
     * @param size       - Number of bytes to read. Defaults to buffer size minus offset.
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readUint16Array(buffer: Uint16Array, offset = 0, size = buffer.length - offset,
            endianness = this.endianness): Promise<number> {
        const read = await this.readUint8Array(new Uint8Array(buffer.buffer, offset * 2, size * 2)) >> 1;
        if (endianness !== Endianness.getNative()) {
            for (let i = offset + read - 1; i >= offset; --i) {
                buffer[i] = Endianness.swap16(buffer[i]);
            }
        }
        return read;
    }

    /**
     * Reads an array of signed 16 bit values.
     *
     * @param buffer     - The buffer to write the read bytes to.
     * @param offset     - Offset within the buffer to start writing to. Defaults to 0.
     * @param size       - Number of bytes to read. Defaults to buffer size minus offset.
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readInt16Array(buffer: Int16Array, offset = 0, size = buffer.length - offset,
            endianness = this.endianness): Promise<number> {
        return this.readUint16Array(new Uint16Array(buffer.buffer), offset, size, endianness);
    }

    /**
     * Reads an array of unsigned 32 bit values.
     *
     * @param buffer     - The buffer to write the read bytes to.
     * @param offset     - Offset within the buffer to start writing to. Defaults to 0.
     * @param size       - Number of bytes to read. Defaults to buffer size minus offset.
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readUint32Array(buffer: Uint32Array, offset = 0, size = buffer.length - offset,
            endianness = this.endianness): Promise<number> {
        const read = await this.readUint8Array(new Uint8Array(buffer.buffer, offset * 4, size * 4)) >> 2;
        if (endianness !== Endianness.getNative()) {
            for (let i = offset + read - 1; i >= offset; --i) {
                buffer[i] = Endianness.swap32(buffer[i]);
            }
        }
        return read;
    }

    /**
     * Reads an array of signed 32 bit values.
     *
     * @param buffer     - The buffer to write the read bytes to.
     * @param offset     - Offset within the buffer to start writing to. Defaults to 0.
     * @param size       - Number of bytes to read. Defaults to buffer size minus offset.
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readInt32Array(buffer: Int32Array, offset = 0, size = buffer.length - offset,
            endianness = this.endianness): Promise<number> {
        return this.readUint32Array(new Uint32Array(buffer.buffer), offset, size, endianness);
    }

    /**
     * Reads an array of unsigned 64 bit values.
     *
     * @param buffer     - The buffer to write the read bytes to.
     * @param offset     - Offset within the buffer to start writing to. Defaults to 0.
     * @param size       - Number of bytes to read. Defaults to buffer size minus offset.
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readBigUint64Array(buffer: BigUint64Array, offset = 0, size = buffer.length - offset,
            endianness = this.endianness): Promise<number> {
        const read = await this.readUint8Array(new Uint8Array(buffer.buffer, offset * 8, size * 8)) >> 4;
        if (endianness !== Endianness.getNative()) {
            for (let i = offset + read - 1; i >= offset; --i) {
                buffer[i] = Endianness.swap64(buffer[i]);
            }
        }
        return read;
    }

    /**
     * Reads an array of signed 64 bit values.
     *
     * @param buffer     - The buffer to write the read bytes to.
     * @param offset     - Offset within the buffer to start writing to. Defaults to 0.
     * @param size       - Number of bytes to read. Defaults to buffer size minus offset.
     * @param endianness - Optional endianness. Defaults to endianness the reader was configured with.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readBigInt64Array(buffer: BigInt64Array, offset = 0, size = buffer.length - offset,
            endianness = this.endianness): Promise<number> {
        return this.readBigUint64Array(new BigUint64Array(buffer.buffer), offset, size, endianness);
    }

    /**
     * Reads a string from the stream.
     *
     * @param size     - The maximum number of bytes to read. Only in ASCII encoding this is the same as the length
     *                   of the string. In other encodings the returned string may be shorter.
     * @param encoding - The encoding. Defaults to "utf-8".
     * @returns the read string. May be smaller than requested size. Empty when end of stream is reached.
     */
    public async readString(size: number, encoding?: string): Promise<string> {
        const buffer = new Uint8Array(size);
        const read = await this.readUint8Array(buffer);
        return new TextDecoder(encoding).decode(read < size ? buffer.subarray(0, read) : buffer);
    }

    /**
     * Reads a null-terminated string from the stream.
     *
     * @returns the read line. Null when end of stream is reached.
     */
    public async readNullTerminatedString(options: ReadStringOptions = {}): Promise<string | null> {
        const sink = new Uint8ArraySink(options.bufferSize ?? 1024);
        let byte: number | null;
        while ((byte = await this.readUint8()) != null) {
            if (byte === 0) {
                // null termination reached
                break;
            }
            sink.write(byte);
            if (options.maxBytes != null && sink.getSize() >= options.maxBytes) {
                // Maximum number of bytes have been read
                break;
            }
        }

        if (byte == null && sink.getSize() === 0) {
            // End-of-stream is reached and no data was read
            return null;
        }

        return new TextDecoder(options.encoding).decode(sink.getData());
    }

    /**
     * Reads a line from the stream. EOL marker can be defined in the options and by default stops at CRLF or LF
     * without including the EOL marker in the returned string.
     *
     * @returns the read line. Null when end of stream is reached.
     */
    public async readLine(options: ReadLineOptions = {}): Promise<string | null> {
        const sink = new Uint8ArraySink(options.bufferSize ?? 1024);
        const eol = options.eol ?? EOL.CRLF_OR_LF;

        let byte: number | null;
        let previous = 0;
        let eolSize = 0;
        while ((byte = await this.readUint8()) != null) {
            if (byte === 0 && options.nullTerminated === true) {
                // null termination reached
                break;
            }
            sink.write(byte);
            eolSize = EOL.isEOL(eol, byte, previous);
            if (eolSize > 0) {
                // End-of-line has been reached
                break;
            }
            previous = byte;
            if (options.maxBytes != null && sink.getSize() >= options.maxBytes) {
                // Maximum number of bytes have been read
                break;
            }
        }

        if (byte == null && sink.getSize() === 0) {
            // End-of-stream is reached and no data was read
            return null;
        }

        const data = sink.getData();
        return new TextDecoder(options.encoding).decode((options.includeEOL !== true && eolSize > 0)
            ? data.subarray(0, -eolSize) : data);
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
export async function readDataFromStream(stream: ReadableStream<Uint8Array>,
        callback: (reader: DataReader) => Promise<void> | void, options?: DataReaderOptions): Promise<void> {
    const reader = stream.getReader();
    try {
        const dataReader = new DataReader(reader, options);
        await callback(dataReader);
    } finally {
        reader.releaseLock();
    }
}
