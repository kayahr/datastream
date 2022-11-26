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

export interface ReadStringOptions {
    /** The text encoding. Defaults to utf-8. */
    encoding?: string;

    /**
     * The initial buffer capacity for creating the string bytes. The buffer size duplicates itself when full, so the
     * higher this value is set the less buffer grows happen but the more memory is wasted for reading small lines.
     * Defaults to 1024.
     */
    initialCapacity?: number;

    /** The maximum number of bytes (not characters!) to read. Default is unlimited. */
    maxBytes?: number;

}

export interface ReadLineOptions extends ReadStringOptions {
    /** True to include EOL marker in returned line. Defaults to false. */
    includeEOL?: boolean;
}

/**
 * Options for the various read array methods of a data reader.
 */
export interface ReadArrayOptions {
    /** Optional offset within the buffer to start writing to. Defaults to 0. */
    offset?: number;

    /** Optional number of bytes to read. Defaults to buffer size minus offset. */
    size?: number
}

/**
 * Options for the various multi-byte read array methods of a data reader.
 */
export interface ReadMultiByteArrayOptions extends ReadArrayOptions {
    /** Optional endianness. Defaults to endianness the reader was configured with. */
    endianness?: Endianness
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

    /** Cached sink to read unknown amount of bytes. */
    private sink: WeakRef<Uint8ArraySink> | null = null;

    /** Cached text decoder used to decode strings. A new one is created when text encoding changes. */
    private textDecoder: TextDecoder | null = null;

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
     * @returns the default endianness used when no endianness is specified as parameter to the various read methods.
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
            return this.bufferSize > 0;
        }
    }

    /**
     * Reads and returns a single bit from the stream.
     *
     * @returns the read bit. Null if end of stream has been reached.
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
     * @returns the read value. Null if end of stream has been reached.
     */
    public async readUint8(): Promise<number | null> {
        if (this.bit === 0) { // At byte boundary, whole byte can be read at once
            if (this.byte >= this.bufferSize) {
                if (!await this.fill()) {
                    return null;
                }
            }
            const value = this.buffer[this.byte];
            this.byte++;
            this.read++;
            return value;
        } else { // In middle of a byte. Read low bits, fill buffer and then read high bits and return combined byte
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
     * @param buffer  - The buffer to write the read bytes to.
     * @param options - Optional read array option.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readUint16Array(buffer: Uint16Array, { offset = 0, size = buffer.length - offset,
            endianness = this.endianness }: ReadMultiByteArrayOptions = {}): Promise<number> {
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
     * @param buffer  - The buffer to write the read bytes to.
     * @param options - Optional read array option.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readInt16Array(buffer: Int16Array, options?: ReadMultiByteArrayOptions): Promise<number> {
        return this.readUint16Array(new Uint16Array(buffer.buffer), options);
    }

    /**
     * Reads an array of unsigned 32 bit values.
     *
     * @param buffer  - The buffer to write the read bytes to.
     * @param options - Optional read array option.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readUint32Array(buffer: Uint32Array, { offset = 0, size = buffer.length - offset,
            endianness = this.endianness }: ReadMultiByteArrayOptions = {}): Promise<number> {
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
     * @param buffer  - The buffer to write the read bytes to.
     * @param options - Optional read array option.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readInt32Array(buffer: Int32Array, options?: ReadMultiByteArrayOptions): Promise<number> {
        return this.readUint32Array(new Uint32Array(buffer.buffer), options);
    }

    /**
     * Reads an array of unsigned 64 bit values.
     *
     * @param buffer  - The buffer to write the read bytes to.
     * @param options - Optional read array option.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readBigUint64Array(buffer: BigUint64Array, { offset = 0, size = buffer.length - offset,
            endianness = this.endianness }: ReadMultiByteArrayOptions = {}): Promise<number> {
        const read = await this.readUint8Array(new Uint8Array(buffer.buffer, offset * 8, size * 8)) >> 3;
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
     * @param buffer  - The buffer to write the read bytes to.
     * @param options - Optional read array option.
     * @returns the number of read 16 bit values. 0 when end of stream is reached or 0 bytes were requested to read.
     */
    public async readBigInt64Array(buffer: BigInt64Array, options?: ReadMultiByteArrayOptions): Promise<number> {
        return this.readBigUint64Array(new BigUint64Array(buffer.buffer), options);
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
        return this.getTextDecoder(encoding).decode(read < size ? buffer.subarray(0, read) : buffer);
    }

    /**
     * Returns a byte sink which is used internally to read an unknown amount of bytes. The sink together with its
     * buffer is cached and re-used. The cache is weakly references so it can be garbage collected.
     *
     * Re-using the sink and its buffer drastically improves performance when reading many strings from the reader.
     *
     * @param initialCapacity - The initial capacity to use for a newly created sink. Ignored when a previous sink
     *                          is reused.
     * @returns the byte sink.
     */
    private getSink(initialCapacity?: number): Uint8ArraySink {
        let sink = this.sink?.deref();
        if (sink == null) {
            sink = new Uint8ArraySink(initialCapacity);
            this.sink = new WeakRef(sink);
        } else {
            sink.reset();
        }
        return sink;
    }

    /**
     * Returns a text decoder for the given text encoding. The text decoder is cached and only replaced when the
     * encoding changes.
     *
     * Re-using the text decoder improves performance when reading many strings from the reader.
     *
     * @param encoding - The text encoding.
     * @returns the text decoder for the given encoding.
     */
    private getTextDecoder(encoding: string = "utf-8"): TextDecoder {
        if (this.textDecoder?.encoding === encoding.toLowerCase()) {
            return this.textDecoder;
        } else {
            return (this.textDecoder = new TextDecoder(encoding));
        }
    }

    /**
     * Reads bytes until the given stop value is found or the end of the stream has been reached or the maximum number
     * of bytes to read has been reached.
     *
     * This method has an optimized path when reading at byte boundary. When stream is not at byte boundary then
     * single bytes are read until finished.
     *
     * @param stopValue        - The value to stop at.
     * @param initialCapacity  - Optional initial capacity of the byte sink used to store read bytes.
     * @param maxBytes         - Optional maximum number of bytes to read. Default is reading until end of stream.
     * @param includeStopValue - Set to true to include stop value in result array.
     * @returns The read bytes or null when end of stream has been reached without reading any bytes. The returned
     *          array is volatile because it is reused so process the data immediately before calling other methods
     *          on the reader.
     */
    private async readUntil(stopValue: number, initialCapacity?: number, maxBytes?: number, includeStopValue = false):
            Promise<Uint8ArraySink | null> {
        const sink = this.getSink(initialCapacity);
        let read = 0;
        let end = false;
        if (this.bit === 0) {
            while (!end) {
                if (this.byte >= this.bufferSize) {
                    // End of buffer reached. Fill buffer with new data read from the stream.
                    if (!await this.fill()) {
                        // End of stream reached. Stop reading.
                        end = true;

                        // When no bytes have been read so far then return null to indicate the end of stream
                        if (read === 0) {
                            return null;
                        }
                        break;
                    }
                }

                // Find the stop value within the current buffer
                let index = this.buffer.indexOf(stopValue, this.byte);
                const found = index !== -1;

                // Increase index if stop value was found and must be included in result
                if (found && includeStopValue) {
                    index++;
                }

                // Determine the number of bytes to copy from the buffer. This is the current read position up to the
                // position of the found stop value or (when stop value not found) this current read position up to the
                // end of the buffer.
                let size = found ? (index - this.byte) : (this.bufferSize - this.byte);

                // When maxBytes are specified then truncate the size accordingly when enough bytes are read
                if (maxBytes != null && size > maxBytes - read) {
                    size = Math.min(size, maxBytes - read);
                    end = true;
                }

                // Copy bytes from buffer to sink.
                sink.write(this.buffer.subarray(this.byte, this.byte + size));

                // When stop value has been found then skip the stop value (if not included) and end reading
                if (found) {
                    if (!includeStopValue) {
                        size++;
                    }
                    end = true;
                }

                // Increase stream position and counters
                this.byte += size;
                this.read += size;
                read += size;
            }
        } else {
            while (maxBytes == null || read < maxBytes) {
                const value = await this.readUint8();
                if (value == null) {
                    if (read === 0) {
                        return null;
                    }
                    break;
                }
                if (value === stopValue && !includeStopValue) {
                    break;
                }
                read++;
                sink.write(value);
                if (value === stopValue) {
                    break;
                }
            }
        }
        return sink;
    }

    /**
     * Reads 16 bit values until the given stop value is found or the end of the stream has been reached or the
     * maximum number of bytes to read has been reached.
     *
     * This method has an optimized path when reading at byte boundary. When stream is not at byte boundary then
     * single bytes are read until finished.
     *
     * @param stopValue        - The value to stop at.
     * @param bigEndian        - True if big endian, false if little endian.
     * @param initialCapacity  - Optional initial capacity of the byte sink used to store read bytes.
     * @param maxBytes         - Optional maximum number of bytes to read. Default is reading until end of stream.
     * @param includeStopValue - Set to true to include stop value in result array.
     * @returns The read bytes or null when end of stream has been reached without reading any bytes. The returned
     *          array is volatile because it is reused so process the data immediately before calling other methods
     *          on the reader.
     */
    private async readUntil16(stopValue: number, bigEndian: boolean, initialCapacity?: number, maxBytes?: number,
            includeStopValue = false): Promise<Uint8ArraySink | null> {
        const sink = this.getSink(initialCapacity);
        let read = 0;
        while(maxBytes == null || read < maxBytes) {
            const value = await this.readUint16(bigEndian ? Endianness.BIG : Endianness.LITTLE);
            if (value == null) {
                if (read === 0) {
                    return null;
                }
                break;
            }
            if (value === stopValue && !includeStopValue) {
                break;
            }
            read += 2;
            if (bigEndian) {
                sink.write(value >> 8);
                sink.write(value & 0xff);
            } else {
                sink.write(value & 0xff);
                sink.write(value >> 8);
            }
            if (value === stopValue) {
                break;
            }
        }
        return sink;
    }

    /**
     * Reads a null-terminated string from the stream.
     *
     * @returns the read line. Null when end of stream is reached.
     */
    public async readNullTerminatedString(options: ReadStringOptions = {}): Promise<string | null> {
        let result: Uint8ArraySink | null;
        if (options.encoding?.toLowerCase().startsWith("utf-16") === true) {
            const bigEndian = options.encoding?.toLowerCase().endsWith("be");
            result = await this.readUntil16(0, bigEndian, options.initialCapacity, options.maxBytes);
        } else {
            result = await this.readUntil(0, options.initialCapacity, options.maxBytes);
        }
        if (result == null) {
            // End of stream reached without reading any data
            return null;
        }
        return this.getTextDecoder(options.encoding).decode(result.getData(), {});
    }

    /**
     * Reads a line from the stream. EOL marker can be defined in the options and by default stops at CRLF or LF
     * without including the EOL marker in the returned string.
     *
     * @returns the read line. Null when end of stream is reached.
     */
    public async readLine({ includeEOL = false, initialCapacity, maxBytes, encoding }: ReadLineOptions = {}):
            Promise<string | null> {
        let result: Uint8ArraySink | null;
        const utf16 = encoding?.toLowerCase().startsWith("utf-16") === true;
        const bigEndian = utf16 && encoding?.toLowerCase().endsWith("be");
        if (utf16) {
            result = await this.readUntil16(0x0a, bigEndian, initialCapacity, maxBytes, true);
        } else {
            result = await this.readUntil(0x0a, initialCapacity, maxBytes, true);
        }
        if (result == null) {
            // End of stream reached without reading any data
            return null;
        }
        if (!includeEOL) {
            let len: number;
            const size = result.getSize();
            if (utf16) {
                if (bigEndian) {
                    len = (result.at(size - 1) === 0x0a && result.at(size - 2) === 0x00)
                        ? (result.at(size - 3) === 0x0d && result.at(size - 4) === 0x00)
                        ? 4 : 2 : 0;
                } else {
                    len = (result.at(size - 1) === 0x00 && result.at(size - 2) === 0x0a)
                        ? (result.at(size - 3) === 0x00 && result.at(size - 4) === 0x0d)
                        ? 4 : 2 : 0;
                }
            } else {
                len = result.at(size - 1) === 0x0a ? result.at(size - 2) === 0x0d ? 2 : 1 : 0;
            }
            if (len > 0) {
                result.rewind(len);
            }
        }
        return this.getTextDecoder(encoding).decode(result.getData());
    }
}

/**
 * Creates a data reader for the given stream, passes it to the given callback function and releases the stream reader
 * lock after callback execution.
 *
 * @param stream   - The stream to read from.
 * @param callback - The callback function to call with the created data reader as argument.
 * @param options  - Optional data reader options.
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
