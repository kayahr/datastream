import { createTextEncoder } from "@kayahr/text-encoding";

import { Endianness } from "../main";
import { DataReader, EOL } from "../main/DataReader";
import { DataReaderSource } from "../main/DataReaderSource";

class MockDataReaderSource implements DataReaderSource {
    public constructor(
        public readonly data: number[] = [ 1, 2, 3, 4, 5, 6, 7, 8 ],
        public readonly chunkSize = 3
    ) {}

    public read(): ReadableStreamReadResult<Uint8Array> {
        const chunk = this.data.splice(0, this.chunkSize);
        if (chunk.length === 0) {
            return { done: true };
        } else {
            return { done: false, value: new Uint8Array(chunk) };
        }
    }
}

describe("DataReader", () => {
    describe("getEndianness", () => {
        it("returns native endianness if not set via constructor", () => {
            expect(new DataReader(new MockDataReaderSource()).getEndianness()).toBe(Endianness.getNative());
        });
        it("returns endianness set via constructor", () => {
            expect(new DataReader(new MockDataReaderSource(), { endianness: Endianness.LITTLE })
                .getEndianness()).toBe(Endianness.LITTLE);
            expect(new DataReader(new MockDataReaderSource(), { endianness: Endianness.BIG })
                .getEndianness()).toBe(Endianness.BIG);
        });
    });

    describe("getRead", () => {
        it("returns the number of read bytes", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3 ], 2));
            expect(reader.getRead()).toBe(0);
            await reader.readUint8();
            expect(reader.getRead()).toBe(1);
            await reader.readUint8();
            expect(reader.getRead()).toBe(2);
            await reader.readUint8();
            expect(reader.getRead()).toBe(3);
            await reader.readUint8();
            expect(reader.getRead()).toBe(3);
        });
    });

    describe("readBit", () => {
        it("reads single bits", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0b11001010, 0b00110101, 255, 0 ], 2));
            // Byte 1
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(1);
            // Byte 2
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(0);
            // Byte 3
            for (let i = 0; i < 8; i++) {
                expect(await reader.readBit()).toBe(1);
            }
            // Byte 4
            for (let i = 0; i < 8; i++) {
                expect(await reader.readBit()).toBe(0);
            }
            // EOF
            expect(await reader.readUint8()).toBeNull();
        });
    });

    describe("readUint8", () => {
        it("reads single unsigned 8 bit integer at byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3 ], 2));
            expect(await reader.readUint8()).toBe(1);
            expect(await reader.readUint8()).toBe(2);
            expect(await reader.readUint8()).toBe(3);
            expect(await reader.readUint8()).toBeNull();
        });
        it("reads single unsigned 8 bit integer outside byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource(
                [ 0b11001010, 0b00110101, 0b01011100, 0b10100011 ], 2));
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readUint8()).toBe(0b01110010);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readUint8()).toBe(0b11100001);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readUint8()).toBe(0b01000110);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBeNull();
        });
        it("returns null if less than 8 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255 ]));
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readUint8()).toBeNull();
        });
    });

    describe("readInt8", () => {
        it("reads single signed 8 bit integer", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0, 1, -1, 127, -128, 255, 128 ]));
            expect(await reader.readInt8()).toBe(0);
            expect(await reader.readInt8()).toBe(1);
            expect(await reader.readInt8()).toBe(-1);
            expect(await reader.readInt8()).toBe(127);
            expect(await reader.readInt8()).toBe(-128);
            expect(await reader.readInt8()).toBe(-1);
            expect(await reader.readInt8()).toBe(-128);
            expect(await reader.readInt8()).toBeNull();
        });
    });

    describe("readUint8s", () => {
        it("reads a block of 8 bit unsigned integers at byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ], 2));
            const buffer = new Uint8Array(12);
            expect(await reader.readUint8Array(buffer, 1, 3)).toBe(3);
            expect(Array.from(buffer)).toEqual([ 0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0 ]);
            expect(await reader.readUint8Array(buffer, 4, 4)).toBe(4);
            expect(Array.from(buffer)).toEqual([ 0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0 ]);
            expect(await reader.readUint8Array(buffer, 8, 2)).toBe(2);
            expect(Array.from(buffer)).toEqual([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0 ]);
            expect(await reader.readUint8Array(buffer, 10, 6)).toBe(1);
            expect(Array.from(buffer)).toEqual([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0 ]);
            expect(await reader.readUint8()).toBeNull();
        });
        it("reads a block of 8 bit unsigned integers outside of byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0x01, 0x23, 0x45, 0x67, 0x89 ], 2));
            const buffer = new Uint8Array(4);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readUint8Array(buffer)).toBe(4);
            expect(Array.from(buffer)).toEqual([ 0x30, 0x52, 0x74, 0x96 ]);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(0);
            expect(await reader.readBit()).toBe(1);
            expect(await reader.readBit()).toBeNull();
        });
    });

    describe("readInt8s", () => {
        it("reads a block of 8 bit signed integers at byte boundary", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, -1, 127, -128, 255, 128 ], 2));
            const buffer = new Int8Array(9);
            expect(await reader.readInt8Array(buffer, 1, 3)).toBe(3);
            expect(await reader.readInt8Array(buffer, 5)).toBe(3);
            expect(Array.from(buffer)).toEqual([ 0, 1, -1, 127, 0, -128, -1, -128, 0 ]);
        });
    });

    describe("readUint16", () => {
        it("reads single unsigned 16 bit integer", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0x01, 0x02, 0x03, 0x04, 0xFF, 0xFE ], 2),
                { endianness: Endianness.LITTLE });
            expect(await reader.readUint16()).toBe(0x0201);
            expect(await reader.readUint16(Endianness.LITTLE)).toBe(0x0403);
            expect(await reader.readUint16(Endianness.BIG)).toBe(0xFFFE);
            expect(await reader.readUint16()).toBeNull();
        });
        it("returns null if less than 16 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255 ]));
            expect(await reader.readUint16()).toBeNull();
        });
    });

    describe("readInt16", () => {
        it("reads single signed 16 bit integer", async () => {
            const data = new Int16Array([ 0, 1, -1, 32767, -32768 ]);
            const reader = new DataReader(new MockDataReaderSource(Array.from(new Uint8Array(data.buffer)), 2));
            expect(await reader.readInt16()).toBe(0);
            expect(await reader.readInt16()).toBe(1);
            expect(await reader.readInt16()).toBe(-1);
            expect(await reader.readInt16()).toBe(32767);
            expect(await reader.readInt16()).toBe(-32768);
            expect(await reader.readInt16()).toBeNull();
        });
        it("returns null if less than 16 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255 ]));
            expect(await reader.readInt16()).toBeNull();
        });
    });

    describe("readUint32", () => {
        it("reads single unsigned 32 bit integer", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0x01, 0x02, 0x03, 0x04,
                0x05, 0x06, 0x07, 0x08, 0xff, 0xfe, 0xfd, 0xfc ], 2), { endianness: Endianness.LITTLE });
            expect(await reader.readUint32()).toBe(0x04030201);
            expect(await reader.readUint32(Endianness.LITTLE)).toBe(0x08070605);
            expect(await reader.readUint32(Endianness.BIG)).toBe(0xFFFEFDFC);
            expect(await reader.readUint32()).toBeNull();
        });
        it("returns null if less than 32 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255, 255, 255 ]));
            expect(await reader.readUint32()).toBeNull();
        });
    });

    describe("readInt32", () => {
        it("reads single signed 32 bit integer", async () => {
            const data = new Int32Array([ 0, 1, -1, 2147483647, -2147483648 ]);
            const reader = new DataReader(new MockDataReaderSource(Array.from(new Uint8Array(data.buffer)), 2));
            expect(await reader.readInt32()).toBe(0);
            expect(await reader.readInt32()).toBe(1);
            expect(await reader.readInt32()).toBe(-1);
            expect(await reader.readInt32()).toBe(2147483647);
            expect(await reader.readInt32()).toBe(-2147483648);
            expect(await reader.readInt32()).toBeNull();
        });
        it("returns null if less than 32 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 255, 255, 255 ]));
            expect(await reader.readInt32()).toBeNull();
        });
    });

    describe("readBigUint64", () => {
        it("reads single unsigned 64 bit integer", async () => {
            const reader = new DataReader(new MockDataReaderSource([
                0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
                0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
                0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7
            ], 2), { endianness: Endianness.LITTLE });
            expect(await reader.readBigUint64()).toBe(0x0706050403020100n);
            expect(await reader.readBigUint64(Endianness.LITTLE)).toBe(0x0f0e0d0c0b0a0908n);
            expect(await reader.readBigUint64(Endianness.BIG)).toBe(0xf0f1f2f3f4f5f6f7n);
            expect(await reader.readBigUint64()).toBeNull();
        });
        it("returns null if less than 64 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3, 4, 5, 6, 7 ]));
            expect(await reader.readBigUint64()).toBeNull();
        });
    });

    describe("readBigInt64", () => {
        it("reads single signed 64 bit integer", async () => {
            const data = new BigInt64Array([ 0n, 1n, -1n, 9223372036854775807n, -9223372036854775808n ]);
            const reader = new DataReader(new MockDataReaderSource(Array.from(new Uint8Array(data.buffer)), 2));
            expect(await reader.readBigInt64()).toBe(0n);
            expect(await reader.readBigInt64()).toBe(1n);
            expect(await reader.readBigInt64()).toBe(-1n);
            expect(await reader.readBigInt64()).toBe(9223372036854775807n);
            expect(await reader.readBigInt64()).toBe(-9223372036854775808n);
            expect(await reader.readBigInt64()).toBeNull();
        });
        it("returns null if less than 32 bits are available", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 1, 2, 3, 4, 5, 6, 7 ]));
            expect(await reader.readBigInt64()).toBeNull();
        });
    });

    describe("readUint16s", () => {
        it("reads a block of 16 bit unsigned integers", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
                0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10 ], 2));
            const buffer = new Uint16Array(10).fill(0x1234);
            expect(await reader.readUint16Array(buffer, 1, 2)).toBe(2);
            expect(Array.from(buffer)).toEqual([ 0x1234, 0x2301, 0x6745, 0x1234, 0x1234, 0x1234, 0x1234, 0x1234,
                0x1234, 0x1234 ]);
            expect(await reader.readUint16Array(buffer, 3, 2, Endianness.BIG)).toBe(2);
            expect(Array.from(buffer)).toEqual([ 0x1234, 0x2301, 0x6745, 0x89ab, 0xcdef, 0x1234, 0x1234, 0x1234,
                0x1234, 0x1234 ]);
            expect(await reader.readUint16Array(buffer, 5, 2, Endianness.BIG)).toBe(2);
            expect(Array.from(buffer)).toEqual([ 0x1234, 0x2301, 0x6745, 0x89ab, 0xcdef, 0xfedc, 0xba98, 0x1234,
                0x1234, 0x1234 ]);
            expect(await reader.readUint16Array(buffer, 7, 3)).toBe(2);
            expect(Array.from(buffer)).toEqual([ 0x1234, 0x2301, 0x6745, 0x89ab, 0xcdef, 0xfedc, 0xba98, 0x5476,
                0x1032, 0x1234 ]);
        });
    });

    describe("readInt16s", () => {
        it("reads a block of 16 bit signed integers", async () => {
            const data = new Int16Array([ 0, 1, -1, 32767, -32768, 0x1234 ]);
            const otherEndianness = Endianness.getNative() === Endianness.BIG ? Endianness.LITTLE : Endianness.BIG;
            const reader = new DataReader(new MockDataReaderSource(Array.from(new Uint8Array(data.buffer))));
            const buffer = new Int16Array(8);
            expect(await reader.readInt16Array(buffer, 1, 5)).toBe(5);
            expect(Array.from(buffer)).toEqual([ 0, 0, 1, -1, 32767, -32768, 0, 0 ]);
            expect(await reader.readInt16Array(buffer, 6, 2, otherEndianness)).toBe(1);
            expect(Array.from(buffer)).toEqual([ 0, 0, 1, -1, 32767, -32768, 0x3412, 0 ]);
        });
    });

    describe("readUint32s", () => {
        it("reads a block of 32 bit unsigned integers", async () => {
            const reader = new DataReader(new MockDataReaderSource([ 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
                0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10 ], 2));
            const buffer = new Uint32Array(6);
            expect(await reader.readUint32Array(buffer, 1, 2)).toBe(2);
            expect(Array.from(buffer)).toEqual([ 0, 0x67452301, 0xefcdab89, 0, 0, 0 ]);
            expect(await reader.readUint32Array(buffer, 3, 3, Endianness.BIG)).toBe(2);
            expect(Array.from(buffer)).toEqual([ 0, 0x67452301, 0xefcdab89, 0xfedcba98, 0x76543210, 0 ]);
        });
    });

    describe("readInt32s", () => {
        it("reads a block of 32 bit signed integers", async () => {
            const data = new Int32Array([ 0, 1, -1, 2147483647, -2147483648, 0x12345678 ]);
            const otherEndianness = Endianness.getNative() === Endianness.BIG ? Endianness.LITTLE : Endianness.BIG;
            const reader = new DataReader(new MockDataReaderSource(Array.from(new Uint8Array(data.buffer))));
            const buffer = new Int32Array(8);
            expect(await reader.readInt32Array(buffer, 1, 5)).toBe(5);
            expect(Array.from(buffer)).toEqual([ 0, 0, 1, -1, 2147483647, -2147483648, 0, 0 ]);
            expect(await reader.readInt32Array(buffer, 6, 2, otherEndianness)).toBe(1);
            expect(Array.from(buffer)).toEqual([ 0, 0, 1, -1, 2147483647, -2147483648, 0x78563412, 0 ]);
        });
    });

    describe("readString", () => {
        it("reads strings", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(
                "The five boxing wizards jump quickly.")), 2));
            expect(await reader.readString(8)).toBe("The five");
            expect(await reader.readString(0)).toBe("");
            expect(await reader.readString(1)).toBe(" ");
            expect(await reader.readString(256)).toBe("boxing wizards jump quickly.");
            expect(await reader.readString(16)).toBe("");
        });
        it("reads a string in Shift-JIS encoding", async () => {
            const reader = new DataReader(new MockDataReaderSource([
                0x89, 0xc2, 0x88, 0xa4, 0x82, 0xb3, 0x97, 0x5d, 0x82, 0xc1,
                0x82, 0xc4, 0x91, 0x9e, 0x82, 0xb3, 0x95, 0x53, 0x94, 0x7b
            ]));
            expect(await reader.readString(256, "Shift-JIS")).toBe("可愛さ余って憎さ百倍");
        });
    });

    describe("readLine", () => {
        const linesLF = "Line 1\nLine 2\n\nEmpty line";
        const linesCRLF = "Line 1\r\nLine 2\r\n\r\nEmpty line";
        const linesCR = "Line 1\rLine 2\r\rEmpty line";

        it("read LF terminated lines", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(linesLF))));
            expect(await reader.readLine()).toBe("Line 1");
            expect(await reader.readLine({ eol: EOL.LF })).toBe("Line 2");
            expect(await reader.readLine({ eol: EOL.CR_OR_LF })).toBe("");
            expect(await reader.readLine()).toBe("Empty line");
            expect(await reader.readLine()).toBeNull();
        });
        it("read CRLF terminated lines", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(linesCRLF))));
            expect(await reader.readLine()).toBe("Line 1");
            expect(await reader.readLine({ eol: EOL.CRLF })).toBe("Line 2");
            expect(await reader.readLine()).toBe("");
            expect(await reader.readLine()).toBe("Empty line");
            expect(await reader.readLine()).toBeNull();
        });
        it("read CR terminated lines", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(linesCR))));
            expect(await reader.readLine({ eol: EOL.CR })).toBe("Line 1");
            expect(await reader.readLine({ eol: EOL.CR_OR_LF })).toBe("Line 2");
            expect(await reader.readLine({ eol: EOL.CR })).toBe("");
            expect(await reader.readLine({ eol: EOL.CR })).toBe("Empty line");
            expect(await reader.readLine({ eol: EOL.CR })).toBeNull();
        });
        it("does not stop on wrong EOL markers", async () => {
            const readerCR = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(linesCR))));
            const readerLF = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(linesLF))));
            const readerCRLF = new DataReader(new MockDataReaderSource(Array.from(
                new TextEncoder().encode(linesCRLF))));
            expect(await readerCR.readLine({ eol: EOL.LF })).toBe("Line 1\rLine 2\r\rEmpty line");
            expect(await readerLF.readLine({ eol: EOL.CRLF })).toBe("Line 1\nLine 2\n\nEmpty line");
            expect(await readerCRLF.readLine({ eol: EOL.LF })).toBe("Line 1\r");
            expect(await readerCRLF.readLine({ eol: EOL.LF })).toBe("Line 2\r");
            expect(await readerCRLF.readLine({ eol: EOL.LF })).toBe("\r");
            expect(await readerCRLF.readLine({ eol: EOL.LF })).toBe("Empty line");
        });
        it("can keep EOL markers", async () => {
            const readerLF = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(linesLF))));
            const readerCRLF = new DataReader(new MockDataReaderSource(Array.from(
                new TextEncoder().encode(linesCRLF))));
            expect(await readerLF.readLine({ includeEOL: true })).toBe("Line 1\n");
            expect(await readerLF.readLine({ includeEOL: true })).toBe("Line 2\n");
            expect(await readerLF.readLine({ includeEOL: true })).toBe("\n");
            expect(await readerLF.readLine({ includeEOL: true })).toBe("Empty line");
            expect(await readerLF.readLine({ includeEOL: true })).toBeNull();
            expect(await readerCRLF.readLine({ includeEOL: true })).toBe("Line 1\r\n");
            expect(await readerCRLF.readLine({ includeEOL: true })).toBe("Line 2\r\n");
            expect(await readerCRLF.readLine({ includeEOL: true })).toBe("\r\n");
            expect(await readerCRLF.readLine({ includeEOL: true })).toBe("Empty line");
            expect(await readerCRLF.readLine({ includeEOL: true })).toBeNull();
        });
        it("can limit the number of read bytes", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(linesLF))));
            expect(await reader.readLine({ maxBytes: 4 })).toBe("Line");
            expect(await reader.readLine({ maxBytes: 10 })).toBe(" 1");
            expect(await reader.readLine({ maxBytes: 10 })).toBe("Line 2");
        });
        it("can read Shift-JIS lines", async () => {
            const text = "灯台もと暗し。\n蛙の子は蛙。\n塵も積もれば山となる。";
            const reader = new DataReader(new MockDataReaderSource(Array.from(createTextEncoder("Shift-JIS")
                .encode(text))));
            expect(await reader.readLine({ encoding: "Shift-JIS" })).toBe("灯台もと暗し。");
            expect(await reader.readLine({ encoding: "Shift-JIS" })).toBe("蛙の子は蛙。");
            expect(await reader.readLine({ encoding: "Shift-JIS" })).toBe("塵も積もれば山となる。");
            expect(await reader.readLine({ encoding: "Shift-JIS" })).toBeNull();
        });
        it("does not stop at null character by default", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode("Foo\0Bar"))));
            expect(await reader.readLine()).toBe("Foo\0Bar");
            expect(await reader.readLine()).toBeNull();
        });
        it("does stop at null character if specified", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode("Foo\0Bar"))));
            expect(await reader.readLine({ nullTerminated: true })).toBe("Foo");
            expect(await reader.readLine({ nullTerminated: true })).toBe("Bar");
            expect(await reader.readLine({ nullTerminated: true })).toBeNull();
        });
    });

    describe("readNullTerminatedString", () => {
        const strings = "String 1\0String 2\0String 3";

        it("reads null-terminated strings", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(strings))));
            expect(await reader.readNullTerminatedString()).toBe("String 1");
            expect(await reader.readNullTerminatedString()).toBe("String 2");
            expect(await reader.readNullTerminatedString()).toBe("String 3");
            expect(await reader.readNullTerminatedString()).toBeNull();
        });
        it("can limit the number of read bytes", async () => {
            const reader = new DataReader(new MockDataReaderSource(Array.from(new TextEncoder().encode(strings))));
            expect(await reader.readNullTerminatedString({ maxBytes: 3 })).toBe("Str");
            expect(await reader.readNullTerminatedString()).toBe("ing 1");
        });
        it("can read Shift-JIS lines", async () => {
            const text = "灯台もと暗し。\0蛙の子は蛙。\0塵も積もれば山となる。";
            const reader = new DataReader(new MockDataReaderSource(Array.from(createTextEncoder("Shift-JIS")
                .encode(text))));
            expect(await reader.readNullTerminatedString({ encoding: "Shift-JIS" })).toBe("灯台もと暗し。");
            expect(await reader.readNullTerminatedString({ encoding: "Shift-JIS" })).toBe("蛙の子は蛙。");
            expect(await reader.readNullTerminatedString({ encoding: "Shift-JIS" })).toBe("塵も積もれば山となる。");
            expect(await reader.readNullTerminatedString({ encoding: "Shift-JIS" })).toBeNull();
        });
    });
});
