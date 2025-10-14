import { createTextEncoder } from "@kayahr/text-encoding";
import { toByteArray } from "base64-js";
import { describe, it } from "node:test";
import { assertEquals, assertNull, assertSame } from "@kayahr/assert";

import { Uint8ArraySource } from "../main/core.ts";
import { DataReader, readDataFromStream } from "../main/DataReader.ts";
import type { DataReaderSource } from "../main/DataReaderSource.ts";
import { Endianness, getNativeEndianness } from "../main/Endianness.ts";
import { readFile } from "node:fs/promises";
import { FileInputStream } from "../main/streams/FileInputStream.ts";

class MockDataReaderSource implements DataReaderSource {
    public readonly data: number[];
    public readonly chunkSize: number;
    public constructor(data: number[] = [ 1, 2, 3, 4, 5, 6, 7, 8 ], chunkSize = 3) {
        this.data = data.slice();
        this.chunkSize = chunkSize;
    }

    public read(): ReadableStreamReadResult<Uint8Array> {
        const chunk = this.data.splice(0, this.chunkSize);
        if (chunk.length === 0) {
            return { done: true, value: undefined };
        } else {
            return { done: false, value: new Uint8Array(chunk) };
        }
    }
}

function createTestData(): number[] {
    const data: number[] = [];
    for (let i = 0x00; i <= 0xff; i += 0x11) {
        data.push(i);
    }
    for (let i = 0xff; i >= 0x00; i -= 0x11) {
        data.push(i);
    }
    for (let i = 0x0f; i <= 0xf0; i += 0x0f) {
        data.push(i);
    }
    for (let i = 0xf0; i >= 0x0f; i -= 0x0f) {
        data.push(i);
    }
    return data;
}

function shift4Bits(values: Uint8Array): Uint8Array {
    const shifted = new Uint8Array(values.length + 1);
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        shifted[i] |= (value & 0x0f) << 4;
        shifted[i + 1] |= value >> 4;
    }
    return shifted;
}

describe("DataReader", () => {
    describe("getEndianness", () => {
        it("returns native endianness if not set via constructor", () => {
            assertSame(new DataReader(new MockDataReaderSource()).getEndianness(), getNativeEndianness());
        });
        it("returns endianness set via constructor", () => {
            assertSame(new DataReader(new MockDataReaderSource(), { endianness: Endianness.LITTLE }).getEndianness(), Endianness.LITTLE);
            assertSame(new DataReader(new MockDataReaderSource(), { endianness: Endianness.BIG }).getEndianness(), Endianness.BIG);
        });
    });

    describe("getEncoding", () => {
        it("returns 'utf-8' if not set via constructor", () => {
            assertSame(new DataReader(new MockDataReaderSource()).getEncoding(), "utf-8");
        });
        it("returns encoding set via constructor", () => {
            assertSame(new DataReader(new MockDataReaderSource(), { encoding: "utf-16le" }).getEncoding(), "utf-16le");
        });
    });

    describe("getBytesRead", () => {
        it("returns the number of full read bytes", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3 ], 2));
            assertSame(reader.getBytesRead(), 0);
            await reader.readUint8();
            assertSame(reader.getBytesRead(), 1);
            await reader.readBit();
            assertSame(reader.getBytesRead(), 1);
            await reader.skipBits(6);
            assertSame(reader.getBytesRead(), 1);
            await reader.readBit();
            assertSame(reader.getBytesRead(), 2);
            await reader.readUint8();
            assertSame(reader.getBytesRead(), 3);
            await reader.readUint8();
            assertSame(reader.getBytesRead(), 3);
        });
    });

    describe("getBitsRead", () => {
        it("returns the number of read bits", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3 ], 2));
            assertSame(reader.getBitsRead(), 0);
            await reader.readUint8();
            assertSame(reader.getBitsRead(), 8);
            await reader.readBit();
            assertSame(reader.getBitsRead(), 9);
            await reader.skipBits(6);
            assertSame(reader.getBitsRead(), 15);
            await reader.readBit();
            assertSame(reader.getBitsRead(), 16);
        });
    });

    describe("readBit", () => {
        it("reads single bits", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0b11001010, 0b00110101, 255, 0 ], 2));
            // Byte 1
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 1);
            // Byte 2
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            // Byte 3
            for (let i = 0; i < 8; i++) {
                assertSame(await reader.readBit(), 1);
            }
            // Byte 4
            for (let i = 0; i < 8; i++) {
                assertSame(await reader.readBit(), 0);
            }
            // EOF
            assertNull(await reader.readBit(), );
        });
    });

    describe("readUint8", () => {
        it("reads single unsigned 8 bit integer at byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3 ], 2));
            assertSame(await reader.readUint8(), 1);
            assertSame(await reader.readUint8(), 2);
            assertSame(await reader.readUint8(), 3);
            assertNull(await reader.readUint8(), );
        });
        it("reads single unsigned 8 bit integer outside byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource(
                [ 0b11001010, 0b00110101, 0b01011100, 0b10100011 ], 2));
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readUint8(), 0b01110010);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readUint8(), 0b11100001);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readUint8(), 0b01000110);
            assertNull(await reader.readUint8(), );
        });
        it("returns null if less than 8 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255 ]));
            assertSame(await reader.readBit(), 1);
            assertNull(await reader.readUint8(), );
        });
    });

    describe("readInt8", () => {
        it("reads single signed 8 bit integer", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0, 1, -1, 127, -128, 255, 128 ]));
            assertSame(await reader.readInt8(), 0);
            assertSame(await reader.readInt8(), 1);
            assertSame(await reader.readInt8(), -1);
            assertSame(await reader.readInt8(), 127);
            assertSame(await reader.readInt8(), -128);
            assertSame(await reader.readInt8(), -1);
            assertSame(await reader.readInt8(), -128);
            assertNull(await reader.readInt8(), );
        });
    });

    describe("readUint16", () => {
        it("reads single unsigned 16 bit integer", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0x01, 0x02, 0x03, 0x04, 0xFF, 0xFE ], 2),
                { endianness: Endianness.LITTLE });
            assertSame(await reader.readUint16(), 0x0201);
            assertSame(await reader.readUint16(Endianness.LITTLE), 0x0403);
            assertSame(await reader.readUint16(Endianness.BIG), 0xFFFE);
            assertNull(await reader.readUint16(), );
        });
        it("returns null if less than 16 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255 ]));
            assertNull(await reader.readUint16(), );
        });
    });

    describe("readInt16", () => {
        it("reads single signed 16 bit integer", async () => {
            const data = new Int16Array([ 0, 1, -1, 32767, -32768 ]);
            const reader = new DataReader(new MockDataReaderSource(Array.from(new Uint8Array(data.buffer)), 2));
            assertSame(await reader.readInt16(), 0);
            assertSame(await reader.readInt16(), 1);
            assertSame(await reader.readInt16(), -1);
            assertSame(await reader.readInt16(), 32767);
            assertSame(await reader.readInt16(), -32768);
            assertNull(await reader.readInt16(), );
        });
        it("returns null if less than 16 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255 ]));
            assertNull(await reader.readInt16(), );
        });
    });

    describe("readUint32", () => {
        it("reads single unsigned 32 bit integer", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0x01, 0x02, 0x03, 0x04,
                0x05, 0x06, 0x07, 0x08, 0xff, 0xfe, 0xfd, 0xfc ], 2), { endianness: Endianness.LITTLE });
            assertSame(await reader.readUint32(), 0x04030201);
            assertSame(await reader.readUint32(Endianness.LITTLE), 0x08070605);
            assertSame(await reader.readUint32(Endianness.BIG), 0xFFFEFDFC);
            assertNull(await reader.readUint32(), );
        });
        it("returns null if less than 32 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255, 255, 255 ]));
            assertNull(await reader.readUint32(), );
        });
    });

    describe("readInt32", () => {
        it("reads single signed 32 bit integer", async () => {
            const data = new Int32Array([ 0, 1, -1, 2147483647, -2147483648 ]);
            const reader = new DataReader(new MockDataReaderSource(Array.from(new Uint8Array(data.buffer)), 2));
            assertSame(await reader.readInt32(), 0);
            assertSame(await reader.readInt32(), 1);
            assertSame(await reader.readInt32(), -1);
            assertSame(await reader.readInt32(), 2147483647);
            assertSame(await reader.readInt32(), -2147483648);
            assertNull(await reader.readInt32(), );
        });
        it("returns null if less than 32 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255, 255, 255 ]));
            assertNull(await reader.readInt32(), );
        });
    });

    describe("readBigUint64", () => {
        it("reads single unsigned 64 bit integer", async () => {
            const reader = new DataReader(new MockDataReaderSource([
                0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
                0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7
            ], 2), { endianness: Endianness.LITTLE });
            assertSame(await reader.readBigUint64(), 0x0706050403020100n);
            assertSame(await reader.readBigUint64(Endianness.LITTLE), 0x0f0e0d0c0b0a0908n);
            assertSame(await reader.readBigUint64(Endianness.BIG), 0xf0f1f2f3f4f5f6f7n);
            assertNull(await reader.readBigUint64(), );
        });
        it("returns null if less than 64 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3, 4, 5, 6, 7 ]));
            assertNull(await reader.readBigUint64(), );
        });
    });

    describe("readBigInt64", () => {
        it("reads single signed 64 bit integer", async () => {
            const data = new BigInt64Array([ 0n, 1n, -1n, 9223372036854775807n, -9223372036854775808n ]);
            const reader = new DataReader(new MockDataReaderSource(Array.from(new Uint8Array(data.buffer)), 2));
            assertSame(await reader.readBigInt64(), 0n);
            assertSame(await reader.readBigInt64(), 1n);
            assertSame(await reader.readBigInt64(), -1n);
            assertSame(await reader.readBigInt64(), 9223372036854775807n);
            assertSame(await reader.readBigInt64(), -9223372036854775808n);
            assertNull(await reader.readBigInt64(), );
        });
        it("returns null if less than 32 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3, 4, 5, 6, 7 ]));
            assertNull(await reader.readBigInt64(), );
        });
    });

    describe("readUint8Array", () => {
        it("reads a block of 8 bit unsigned integers at byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ], 2));
            const buffer = new Uint8Array(12);
            assertSame(await reader.readUint8Array(buffer, 1, 3), 3);
            assertEquals(Array.from(buffer), [ 0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0 ]);
            assertSame(await reader.readUint8Array(buffer, 4, 4), 4);
            assertEquals(Array.from(buffer), [ 0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0 ]);
            assertSame(await reader.readUint8Array(buffer, 8, 2), 2);
            assertEquals(Array.from(buffer), [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0 ]);
            assertSame(await reader.readUint8Array(buffer, 10, 6), 1);
            assertEquals(Array.from(buffer), [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0 ]);
            assertSame(await reader.readUint8Array(buffer, 0, 1), 0);
        });
        it("reads a block of 8 bit unsigned integers outside of byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0x01, 0x23, 0x45, 0x67, 0x89 ], 2));
            const buffer = new Uint8Array(4);
            assertSame(await reader.readBit(), 1);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readUint8Array(buffer), 4);
            assertEquals(Array.from(buffer), [ 0x30, 0x52, 0x74, 0x96 ]);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readUint8Array(buffer), 0);
        });
    });

    describe("readInt8Array", () => {
        it("reads a block of 8 bit signed integers at byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, -1, 127, -128, 255, 128 ], 2));
            const buffer = new Int8Array(9);
            assertSame(await reader.readInt8Array(buffer, 1, 3), 3);
            assertSame(await reader.readInt8Array(buffer, 5), 3);
            assertEquals(Array.from(buffer), [ 0, 1, -1, 127, 0, -128, -1, -128, 0 ]);
            assertSame(await reader.readInt8Array(buffer), 0);
        });
    });

    describe("readUint16Array", () => {
        const numBytes = 2;
        const data = createTestData();
        const numValues = data.length / numBytes;
        const view = new DataView(new Uint8Array(data).buffer);
        for (const endianness of [ Endianness.LITTLE, Endianness.BIG ]) {
            const endian = endianness === Endianness.LITTLE ? "little" : "big";
            it(`reads 16 bit unsigned integers with ${endian} endian`, async () => {
                const reader = new DataReader(new MockDataReaderSource(data, numBytes - 1));
                const buffer = new Uint16Array(numValues);
                assertSame(await reader.readUint16Array(buffer, { endianness }), numValues);
                for (let i = 0; i < numValues; i++) {
                    const value = view.getUint16(i * numBytes, endianness === Endianness.LITTLE);
                    assertSame(buffer[i], value);
                }
                assertSame(await reader.readUint16Array(buffer), 0);
            });
            for (const size of [ 1, 2, 4, 8 ]) {
                it(`reads 16 bit unsigned integers with ${endian} endian and block size ${size}`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(data, numBytes + (size >> 1)));
                    const buffer = new Uint16Array(numValues);
                    for (let offset = 0; offset < numValues; offset += size) {
                        assertSame(await reader.readUint16Array(buffer, { offset, size, endianness }), size);
                    }
                    for (let i = 0; i < numValues; i++) {
                        const value = view.getUint16(i * numBytes, endianness === Endianness.LITTLE);
                        assertSame(buffer[i], value);
                    }
                    assertSame(await reader.readUint16Array(buffer, { offset: 0, size: numValues }), 0);
                });
            }
        }
    });

    describe("readInt16Array", () => {
        const numBytes = 2;
        const data = createTestData();
        const numValues = data.length / numBytes;
        const view = new DataView(new Uint8Array(data).buffer);
        for (const endianness of [ Endianness.LITTLE, Endianness.BIG ]) {
            const endian = endianness === Endianness.LITTLE ? "little" : "big";
            it(`reads 16 bit signed integers with ${endian} endian`, async () => {
                const reader = new DataReader(new MockDataReaderSource(data, numBytes - 1));
                const buffer = new Int16Array(numValues);
                assertSame(await reader.readInt16Array(buffer, { endianness }), numValues);
                for (let i = 0; i < numValues; i++) {
                    const value = view.getInt16(i * numBytes, endianness === Endianness.LITTLE);
                    assertSame(buffer[i], value);
                }
                assertSame(await reader.readInt16Array(buffer), 0);
            });
            for (const size of [ 1, 2, 4, 8 ]) {
                it(`reads 16 bit signed integers with ${endian} endian and block size ${size}`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(data, numBytes + (size >> 1)));
                    const buffer = new Int16Array(numValues);
                    for (let offset = 0; offset < numValues; offset += size) {
                        assertSame(await reader.readInt16Array(buffer, { offset, size, endianness }), size);
                    }
                    for (let i = 0; i < numValues; i++) {
                        const value = view.getInt16(i * numBytes, endianness === Endianness.LITTLE);
                        assertSame(buffer[i], value);
                    }
                    assertSame(await reader.readInt16Array(buffer, { offset: 0, size: numValues }), 0);
                });
            }
        }
    });

    describe("readUint32Array", () => {
        const numBytes = 4;
        const data = createTestData();
        const numValues = data.length / numBytes;
        const view = new DataView(new Uint8Array(data).buffer);
        for (const endianness of [ Endianness.LITTLE, Endianness.BIG ]) {
            const endian = endianness === Endianness.LITTLE ? "little" : "big";
            it(`reads 32 bit unsigned integers with ${endian} endian`, async () => {
                const reader = new DataReader(new MockDataReaderSource(data, numBytes - 1));
                const buffer = new Uint32Array(numValues);
                assertSame(await reader.readUint32Array(buffer, { endianness }), numValues);
                for (let i = 0; i < numValues; i++) {
                    const value = view.getUint32(i * numBytes, endianness === Endianness.LITTLE);
                    assertSame(buffer[i], value);
                }
                assertSame(await reader.readUint32Array(buffer), 0);
            });
            for (const size of [ 1, 2, 4, 8 ]) {
                it(`reads 32 bit unsigned integers with ${endian} endian and block size ${size}`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(data, numBytes + (size >> 1)));
                    const buffer = new Uint32Array(numValues);
                    for (let offset = 0; offset < numValues; offset += size) {
                        assertSame(await reader.readUint32Array(buffer, { offset, size, endianness }), size);
                    }
                    for (let i = 0; i < numValues; i++) {
                        const value = view.getUint32(i * numBytes, endianness === Endianness.LITTLE);
                        assertSame(buffer[i], value);
                    }
                    assertSame(await reader.readUint32Array(buffer, { offset: 0, size: numValues }), 0);
                });
            }
        }
    });

    describe("readInt32Array", () => {
        const numBytes = 4;
        const data = createTestData();
        const numValues = data.length / numBytes;
        const view = new DataView(new Uint8Array(data).buffer);
        for (const endianness of [ Endianness.LITTLE, Endianness.BIG ]) {
            const endian = endianness === Endianness.LITTLE ? "little" : "big";
            it(`reads 32 bit signed integers with ${endian} endian`, async () => {
                const reader = new DataReader(new MockDataReaderSource(data, numBytes - 1));
                const buffer = new Int32Array(numValues);
                assertSame(await reader.readInt32Array(buffer, { endianness }), numValues);
                for (let i = 0; i < numValues; i++) {
                    const value = view.getInt32(i * numBytes, endianness === Endianness.LITTLE);
                    assertSame(buffer[i], value);
                }
                assertSame(await reader.readInt32Array(buffer), 0);
            });
            for (const size of [ 1, 2, 4, 8 ]) {
                it(`reads 32 bit signed integers with ${endian} endian and block size ${size}`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(data, numBytes + (size >> 1)));
                    const buffer = new Int32Array(numValues);
                    for (let offset = 0; offset < numValues; offset += size) {
                        assertSame(await reader.readInt32Array(buffer, { offset, size, endianness }), size);
                    }
                    for (let i = 0; i < numValues; i++) {
                        const value = view.getInt32(i * numBytes, endianness === Endianness.LITTLE);
                        assertSame(buffer[i], value);
                    }
                    assertSame(await reader.readInt32Array(buffer, { offset: 0, size: numValues }), 0);
                });
            }
        }
    });

    describe("readBigUint64Array", () => {
        const numBytes = 8;
        const data = createTestData();
        const numValues = data.length / numBytes;
        const view = new DataView(new Uint8Array(data).buffer);
        for (const endianness of [ Endianness.LITTLE, Endianness.BIG ]) {
            const endian = endianness === Endianness.LITTLE ? "little" : "big";
            it(`reads 64 bit unsigned integers with ${endian} endian`, async () => {
                const reader = new DataReader(new MockDataReaderSource(data, numBytes - 1));
                const buffer = new BigUint64Array(numValues);
                assertSame(await reader.readBigUint64Array(buffer, { endianness }), numValues);
                for (let i = 0; i < numValues; i++) {
                    const value = view.getBigUint64(i * numBytes, endianness === Endianness.LITTLE);
                    assertSame(buffer[i], value);
                }
                assertSame(await reader.readBigUint64Array(buffer), 0);
            });
            for (const size of [ 1, 2, 4, 8 ]) {
                it(`reads 64 bit unsigned integers with ${endian} endian and block size ${size}`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(data, numBytes + (size >> 1)));
                    const buffer = new BigUint64Array(numValues);
                    for (let offset = 0; offset < numValues; offset += size) {
                        assertSame(await reader.readBigUint64Array(buffer, { offset, size, endianness }), size);
                    }
                    for (let i = 0; i < numValues; i++) {
                        const value = view.getBigUint64(i * numBytes, endianness === Endianness.LITTLE);
                        assertSame(buffer[i], value);
                    }
                    assertSame(await reader.readBigUint64Array(buffer, { offset: 0, size: numValues }), 0);
                });
            }
        }
    });

    describe("readBigInt64Array", () => {
        const numBytes = 8;
        const data = createTestData();
        const numValues = data.length / numBytes;
        const view = new DataView(new Uint8Array(data).buffer);
        for (const endianness of [ Endianness.LITTLE, Endianness.BIG ]) {
            const endian = endianness === Endianness.LITTLE ? "little" : "big";
            it(`reads 64 bit signed integers with ${endian} endian`, async () => {
                const reader = new DataReader(new MockDataReaderSource(data, numBytes - 1));
                const buffer = new BigInt64Array(numValues);
                assertSame(await reader.readBigInt64Array(buffer, { endianness }), numValues);
                for (let i = 0; i < numValues; i++) {
                    const value = view.getBigInt64(i * numBytes, endianness === Endianness.LITTLE);
                    assertSame(buffer[i], value);
                }
                assertSame(await reader.readBigInt64Array(buffer), 0);
            });
            for (const size of [ 1, 2, 4, 8 ]) {
                it(`reads 64 bit signed integers with ${endian} endian and block size ${size}`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(data, numBytes + (size >> 1)));
                    const buffer = new BigInt64Array(numValues);
                    for (let offset = 0; offset < numValues; offset += size) {
                        assertSame(await reader.readBigInt64Array(buffer, { offset, size, endianness }), size);
                    }
                    for (let i = 0; i < numValues; i++) {
                        const value = view.getBigInt64(i * numBytes, endianness === Endianness.LITTLE);
                        assertSame(buffer[i], value);
                    }
                    assertSame(await reader.readBigInt64Array(buffer, { offset: 0, size: numValues }), 0);
                });
            }
        }
    });

    describe("readString", () => {
        it("reads strings", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(
                "The five boxing wizards jump quickly.")), 2));
            assertSame(await reader.readString(8), "The five");
            assertSame(await reader.readString(0), "");
            assertSame(await reader.readString(1), " ");
            assertSame(await reader.readString(256), "boxing wizards jump quickly.");
            assertSame(await reader.readString(16), "");
        });
        it("reads a string in Shift-JIS encoding", async () => {
            const reader = new DataReader(new MockDataReaderSource([
                0x89, 0xc2, 0x88, 0xa4, 0x82, 0xb3, 0x97, 0x5d, 0x82, 0xc1,
                0x82, 0xc4, 0x91, 0x9e, 0x82, 0xb3, 0x95, 0x53, 0x94, 0x7b
            ]));
            assertSame(await reader.readString(256, "Shift-JIS"), "可愛さ余って憎さ百倍");
        });
        it("reads a string in default encoding of the reader", async () => {
            const reader = new DataReader(new MockDataReaderSource([
                0x89, 0xc2, 0x88, 0xa4, 0x82, 0xb3, 0x97, 0x5d, 0x82, 0xc1,
                0x82, 0xc4, 0x91, 0x9e, 0x82, 0xb3, 0x95, 0x53, 0x94, 0x7b
            ]), { encoding: "Shift-JIS" });
            assertSame(await reader.readString(256), "可愛さ余って憎さ百倍");
        });
    });

    describe("readNullTerminatedString", () => {
        const strings = "String 1\0\0a\0String 2\0String 3";

        it("reads null-terminated strings at byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(strings))));
            assertSame(await reader.readNullTerminatedString(), "String 1");
            assertSame(await reader.readNullTerminatedString(), "");
            assertSame(await reader.readNullTerminatedString(), "a");
            assertSame(await reader.readNullTerminatedString(), "String 2");
            assertSame(await reader.readNullTerminatedString(), "String 3");
            assertNull(await reader.readNullTerminatedString(), );
        });
        it("reads null-terminated strings outside of byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource(
                Array.from(shift4Bits(new TextEncoder().encode(strings)))));
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readNullTerminatedString(), "String 1");
            assertSame(await reader.readNullTerminatedString(), "");
            assertSame(await reader.readNullTerminatedString(), "a");
            assertSame(await reader.readNullTerminatedString(), "String 2");
            assertSame(await reader.readNullTerminatedString(), "String 3");
            assertNull(await reader.readNullTerminatedString(), );
        });
        it("can limit the number of read bytes on byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(strings))));
            assertSame(await reader.readNullTerminatedString({ maxBytes: 3 }), "Str");
            assertSame(await reader.readNullTerminatedString(), "ing 1");
        });
        it("can limit the number of read bytes outside byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(shift4Bits(
                new TextEncoder().encode(strings)))));
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readBit(), 0);
            assertSame(await reader.readNullTerminatedString({ maxBytes: 3 }), "Str");
            assertSame(await reader.readNullTerminatedString(), "ing 1");
        });
        it("can read Shift-JIS encoded lines", async () => {
            const text = "灯台もと暗し。\0蛙の子は蛙。\0塵も積もれば山となる。";
            const reader = new DataReader(new MockDataReaderSource(Array.from(createTextEncoder("Shift-JIS")
                .encode(text))));
            assertSame(await reader.readNullTerminatedString({ encoding: "Shift-JIS" }), "灯台もと暗し。");
            assertSame(await reader.readNullTerminatedString({ encoding: "Shift-JIS" }), "蛙の子は蛙。");
            assertSame(await reader.readNullTerminatedString({ encoding: "Shift-JIS" }), "塵も積もれば山となる。");
            assertNull(await reader.readNullTerminatedString({ encoding: "Shift-JIS" }), );
        });
        for (const encoding of [ "UTF-8", "UTF-16BE", "UTF-16LE" ]) {
            it(`can read ${encoding} encoded lines`, async () => {
                const text = "á©ðéíïœøµñóöäëßþú®𡝳\0åœüæÁ¢ÐÉЀÍÏŒØµÑԀÓÖÄË§Þ𡝳Ú\0𡝳®ÅŒÜÆ"; // cspell:disable-line
                const reader = new DataReader(new MockDataReaderSource(Array.from(createTextEncoder(encoding)
                    .encode(text))));
                assertSame(await reader.readNullTerminatedString({ encoding }), "á©ðéíïœøµñóöäëßþú®𡝳");  // cspell:disable-line
                assertSame(await reader.readNullTerminatedString({ encoding }), "åœüæÁ¢ÐÉЀÍÏŒØµÑԀÓÖÄË§Þ𡝳Ú");  // cspell:disable-line
                assertSame(await reader.readNullTerminatedString({ encoding }), "𡝳®ÅŒÜÆ");  // cspell:disable-line
                assertNull(await reader.readNullTerminatedString({ encoding }), );
            });
        }
    });

    describe("readLine", () => {
        const linesLF = "Line 1\nLine 2\n\nEmpty line";
        const linesCRLF = "Line 1\r\nLine 2\r\n\r\nEmpty line";

        for (const encoding of [ "utf-8", "utf-16le", "utf-16be" ]) {
            describe(`with encoding ${encoding}`, () => {
                it("read LF terminated lines", async () => {
                    const reader = new DataReader(new MockDataReaderSource(Array.from(
                        createTextEncoder(encoding).encode(linesLF))));
                    const options = encoding === "utf-8" ? undefined : { encoding };
                    assertSame(await reader.readLine(options), "Line 1");
                    assertSame(await reader.readLine(options), "Line 2");
                    assertSame(await reader.readLine(options), "");
                    assertSame(await reader.readLine(options), "Empty line");
                    assertNull(await reader.readLine(options), );
                });
                it("read LF terminated lines outside of byte boundary", async () => {
                    const reader = new DataReader(new MockDataReaderSource(Array.from(shift4Bits(
                        createTextEncoder(encoding).encode(linesLF)))));
                    assertSame(await reader.readBit(), 0);
                    assertSame(await reader.readBit(), 0);
                    assertSame(await reader.readBit(), 0);
                    assertSame(await reader.readBit(), 0);
                    assertSame(await reader.readLine({ encoding }), "Line 1");
                    assertSame(await reader.readLine({ encoding }), "Line 2");
                    assertSame(await reader.readLine({ encoding }), "");
                    assertSame(await reader.readLine({ encoding }), "Empty line");
                    assertNull(await reader.readLine({ encoding }), );
                });
                it("read CRLF terminated lines", async () => {
                    const reader = new DataReader(new MockDataReaderSource(Array.from(
                        createTextEncoder(encoding).encode(linesCRLF))));
                    assertSame(await reader.readLine({ encoding }), "Line 1");
                    assertSame(await reader.readLine({ encoding }), "Line 2");
                    assertSame(await reader.readLine({ encoding }), "");
                    assertSame(await reader.readLine({ encoding }), "Empty line");
                    assertNull(await reader.readLine({ encoding }), );
                });
                it("can keep EOL markers in CR terminated lines", async () => {
                    const reader = new DataReader(new MockDataReaderSource(Array.from(
                        createTextEncoder(encoding).encode(linesLF))));
                    assertSame(await reader.readLine({ includeEOL: true, encoding }), "Line 1\n");
                    assertSame(await reader.readLine({ includeEOL: true, encoding }), "Line 2\n");
                    assertSame(await reader.readLine({ includeEOL: true, encoding }), "\n");
                    assertSame(await reader.readLine({ includeEOL: true, encoding }), "Empty line");
                    assertNull(await reader.readLine({ includeEOL: true, encoding }), );
                });
                it("can keep EOL markers in CRLF terminated lines", async () => {
                    const reader = new DataReader(new MockDataReaderSource(Array.from(
                        createTextEncoder(encoding).encode(linesCRLF))));
                    assertSame(await reader.readLine({ includeEOL: true, encoding }), "Line 1\r\n");
                    assertSame(await reader.readLine({ includeEOL: true, encoding }), "Line 2\r\n");
                    assertSame(await reader.readLine({ includeEOL: true, encoding }), "\r\n");
                    assertSame(await reader.readLine({ includeEOL: true, encoding }), "Empty line");
                    assertNull(await reader.readLine({ includeEOL: true, encoding }), );
                });
                it("does not stop at null character by default", async () => {
                    const reader = new DataReader(new MockDataReaderSource(
                        Array.from(createTextEncoder(encoding).encode("Foo\0Bar"))));
                    assertSame(await reader.readLine({ encoding }), "Foo\0Bar");
                    assertNull(await reader.readLine({ encoding }), );
                });
                it(`can read Iliad`, async () => {
                    const data = await readFile(`src/test/data/iliad_${encoding}.txt`);
                    const reader = new DataReader(new Uint8ArraySource(data));
                    let line: string | null;
                    let lines = 0;
                    let chars = 0;
                    let longest = 0;
                    while ((line = await reader.readLine({ encoding })) != null) {
                        lines++;
                        chars += line.length;
                        longest = Math.max(longest, line.length);
                    }
                    assertSame(lines, 14408);
                    assertSame(chars, 686996);
                    assertSame(longest, 76);
                });
            });
        }
        it("can limit the number of read bytes", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(linesLF))));
            assertSame(await reader.readLine({ maxBytes: 4 }), "Line");
            assertSame(await reader.readLine({ maxBytes: 10 }), " 1");
            assertSame(await reader.readLine({ maxBytes: 10 }), "Line 2");
        });
        it("can read Shift-JIS lines", async () => {
            const text = "灯台もと暗し。\n蛙の子は蛙。\n塵も積もれば山となる。";
            const reader = new DataReader(new MockDataReaderSource(Array.from(createTextEncoder("Shift-JIS")
                .encode(text))));
            assertSame(await reader.readLine({ encoding: "Shift-JIS" }), "灯台もと暗し。");
            assertSame(await reader.readLine({ encoding: "Shift-JIS" }), "蛙の子は蛙。");
            assertSame(await reader.readLine({ encoding: "Shift-JIS" }), "塵も積もれば山となる。");
            assertNull(await reader.readLine({ encoding: "Shift-JIS" }), );
        });
        it("can read UTF-16 line with specified maximum size", async () => {
            const data = toByteArray(await readFile(`src/test/data/iliad_utf-16le.txt`, "base64"));
            const reader = new DataReader(new Uint8ArraySource(data));
            assertSame(await reader.readLine({ maxBytes: 24, encoding: "utf-16le" }), "The Project");
        });
    });

    describe("skipBits", () => {
        const data = createTestData();
        for (const bufferSize of [ 1, 5, 32, 1024 ]) {
            it(`skips given number of bits when reading with buffer size ${bufferSize}`, async () => {
                const reader1 = new DataReader(new MockDataReaderSource(data, bufferSize));
                const reader2 = new DataReader(new MockDataReaderSource(data, bufferSize));
                for (let skip = 1; skip < 27; skip++) {
                    const read1 = await reader1.skipBits(skip);
                    const read2 = await reader2.readBits(skip);
                    assertSame(read1, read2?.length ?? 0);
                    const byte1 = await reader1.readUint8();
                    const byte2 = await reader2.readUint8();
                    assertSame(byte1, byte2);
                }
            });
        }
    });

    describe("skipBytes", () => {
        const data = createTestData();
        for (const bufferSize of [ 1, 5, 32, 1024 ]) {
            it(`skips given number of bytes when reading with buffer size ${bufferSize} at byte boundary`,
                    async () => {
                const reader1 = new DataReader(new MockDataReaderSource(data, bufferSize));
                const reader2 = new DataReader(new MockDataReaderSource(data, bufferSize));
                for (let skip = 1; skip < 11; skip++) {
                    const read1 = await reader1.skipBytes(skip);
                    const read2 = await reader2.readUint8Array(new Uint8Array(skip));
                    assertSame(read1, read2);
                    const byte1 = await reader1.readUint8();
                    const byte2 = await reader2.readUint8();
                    assertSame(byte1, byte2);
                }
            });
            it(`skips given number of bytes when reading with buffer size ${bufferSize} outside byte boundary`,
                    async () => {
                const reader1 = new DataReader(new MockDataReaderSource(data, bufferSize));
                const reader2 = new DataReader(new MockDataReaderSource(data, bufferSize));
                await reader1.skipBits(3);
                await reader2.skipBits(3);
                for (let skip = 1; skip < 11; skip++) {
                    const read1 = await reader1.skipBytes(skip);
                    const read2 = await reader2.readUint8Array(new Uint8Array(skip));
                    assertSame(read1, read2);
                    const byte1 = await reader1.readUint8();
                    const byte2 = await reader2.readUint8();
                    assertSame(byte1, byte2);
                }
            });
        }
    });

    describe("lookAhead", () => {
        const text = "Line 1\nLine 2\nAnother line 3\nYet another line 4\nWhat about another line 5\nLast line 6";
        const bytes = new TextEncoder().encode(text);
        for (const bufferSize of [ 1, 5, 32, 1024 ]) {
            describe(`with buffer size ${bufferSize}`, () => {
                it(`can look ahead in a stream`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(Array.from(bytes), bufferSize));
                    assertSame(await reader.readLine(), "Line 1");
                    assertSame(await reader.lookAhead(async () => {
                        assertSame(await reader.readLine(), "Line 2");
                        assertSame(await reader.lookAhead(async () => {
                            assertSame(await reader.readLine(), "Another line 3");
                            assertSame(await reader.readLine(), "Yet another line 4");
                            return reader.getBytesRead();
                        }), 48);
                        assertSame(reader.getBytesRead(), 14);
                        assertSame(await reader.readLine(), "Another line 3");
                        assertSame(await reader.readLine(), "Yet another line 4");
                        assertSame(await reader.readLine(), "What about another line 5");
                        assertSame(await reader.readLine(), "Last line 6");
                        assertSame(await reader.readLine(), null);
                        return reader.getBytesRead();
                    }), bytes.length);
                    assertSame(reader.getBytesRead(), 7);
                    assertSame(await reader.readLine(), "Line 2");
                    assertSame(await reader.readLine(), "Another line 3");
                    assertSame(await reader.readLine(), "Yet another line 4");
                    assertSame(await reader.readLine(), "What about another line 5");
                    assertSame(await reader.readLine(), "Last line 6");
                    assertSame(await reader.readLine(), null);
                });
                it(`can look ahead in a stream and can commit specific number of bytes`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(Array.from(bytes), bufferSize));
                    assertSame(await reader.readLine(), "Line 1");
                    assertSame(await reader.lookAhead(async commit => {
                        assertSame(await reader.readLine(), "Line 2");
                        assertSame(await reader.lookAhead(async commit => {
                            assertSame(await reader.readLine(), "Another line 3");
                            assertSame(await reader.readLine(), "Yet another line 4");
                            commit(27);
                            return reader.getBytesRead();
                        }), 48);
                        assertSame(reader.getBytesRead(), 14 + 27);
                        assertSame(await reader.readLine(), "line 4");
                        assertSame(await reader.readLine(), "What about another line 5");
                        assertSame(await reader.readLine(), "Last line 6");
                        assertSame(await reader.readLine(), null);
                        commit(7);
                        return reader.getBytesRead();
                    }), bytes.length);
                    assertSame(reader.getBytesRead(), 7 + 7);
                    assertSame(await reader.readLine(), "Another line 3");
                    assertSame(await reader.readLine(), "Yet another line 4");
                    assertSame(await reader.readLine(), "What about another line 5");
                    assertSame(await reader.readLine(), "Last line 6");
                    assertSame(await reader.readLine(), null);
                });
                it(`can look ahead in a stream and can commit all read data`, async () => {
                    const reader = new DataReader(new MockDataReaderSource(Array.from(bytes), bufferSize));
                    assertSame(await reader.readLine(), "Line 1");
                    assertSame(await reader.lookAhead(async commit => {
                        assertSame(await reader.readLine(), "Line 2");
                        assertSame(await reader.lookAhead(async commit => {
                            assertSame(await reader.readLine(), "Another line 3");
                            assertSame(await reader.readLine(), "Yet another line 4");
                            commit();
                            return reader.getBytesRead();
                        }), 48);
                        assertSame(reader.getBytesRead(), 48);
                        assertSame(await reader.readLine(), "What about another line 5");
                        assertSame(await reader.readLine(), "Last line 6");
                        assertSame(await reader.readLine(), null);
                        commit();
                        return reader.getBytesRead();
                    }), bytes.length);
                    assertSame(reader.getBytesRead(), bytes.length);
                    assertSame(await reader.readLine(), null);
                });
            });
        }
    });
});

describe("readDataFromStream", () => {
    for (const encoding of [ "utf-8", "utf-16le", "utf-16be" ]) {
        describe(`with encoding ${encoding}`, () => {
            it(`can read Iliad`, async () => {
                const stream = new FileInputStream(`src/test/data/iliad_${encoding}.txt`);
                try {
                    await readDataFromStream(stream, async reader => {
                        let line: string | null;
                        let lines = 0;
                        let chars = 0;
                        let longest = 0;
                        while ((line = await reader.readLine({ encoding })) != null) {
                            lines++;
                            chars += line.length;
                            longest = Math.max(longest, line.length);
                        }
                        assertSame(lines, 14408);
                        assertSame(chars, 686996);
                        assertSame(longest, 76);
                    });
                } finally {
                    await stream.close();
                }
            });
        });
    }
});
