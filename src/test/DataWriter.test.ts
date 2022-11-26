import "@kayahr/text-encoding/encodings";

import { readFile, rm } from "node:fs/promises";

import { tmpName } from "tmp-promise";

import { DataWriter, writeDataToStream } from "../main/DataWriter";
import { Endianness, getNativeEndianness } from "../main/Endianness";
import { FileOutputStream } from "../main/node/FileOutputStream";
import { Uint8ArraySink } from "../main/Uint8ArraySink";

describe("DataWriter", () => {
    it("can write to a file", async () => {
        const tmpFile = await tmpName();
        try {
            const stream = new FileOutputStream(tmpFile);
            try {
                await writeDataToStream(stream, async writer => {
                    void writer.writeString("Test text");
                    await writer.flush();
                });
            } finally {
                await stream.close();
            }
            expect(await readFile(tmpFile, { encoding: "utf-8" })).toBe("Test text");
        } finally {
            await rm(tmpFile);
        }
    });

    describe("endianness", () => {
        it("defaults to native endianness", () => {
            expect(new DataWriter(new Uint8ArraySink()).getEndianness()).toBe(getNativeEndianness());
        });
        it("can be set via constructor", () => {
            expect(new DataWriter(new Uint8ArraySink(), { endianness: Endianness.LITTLE })
                .getEndianness()).toBe(Endianness.LITTLE);
            expect(new DataWriter(new Uint8ArraySink(), { endianness: Endianness.BIG })
                .getEndianness()).toBe(Endianness.BIG);
        });
    });

    describe("encoding", () => {
        it("defaults to utf-8", () => {
            expect(new DataWriter(new Uint8ArraySink()).getEncoding()).toBe("utf-8");
        });
        it("can be set via constructor", () => {
            expect(new DataWriter(new Uint8ArraySink(), { encoding: "utf-16be" }).getEncoding()).toBe("utf-16be");
        });
    });

    describe("bufferSize", () => {
        it("defaults to 64KB", () => {
            expect(new DataWriter(new Uint8ArraySink()).getBufferSize()).toBe(65536);
        });
        it("can be set via constructor", () => {
            expect(new DataWriter(new Uint8ArraySink(), { bufferSize: 500 }).getBufferSize()).toBe(500);
        });
    });

    describe("getWritten", () => {
        it("returns the number of written bytes", async () => {
            const writer = new DataWriter(new Uint8ArraySink());
            expect(writer.getWritten()).toBe(0);
            void writer.writeUint8(1);
            expect(writer.getWritten()).toBe(1);
            void writer.writeUint16(1);
            expect(writer.getWritten()).toBe(3);
            void writer.writeUint32(1);
            expect(writer.getWritten()).toBe(7);
            void writer.writeBigUint64(1n);
            expect(writer.getWritten()).toBe(15);
            await writer.flush();
        });
    });

    describe("writeBit", () => {
        it("writes single bits", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            // Byte 1
            void writer.writeBit(1);
            void writer.writeBit(1);
            void writer.writeBit(0);
            void writer.writeBit(0);
            void writer.writeBit(1);
            void writer.writeBit(0);
            void writer.writeBit(1);
            void writer.writeBit(0);
            // Byte 2
            void writer.writeBit(0);
            void writer.writeBit(0);
            void writer.writeBit(1);
            void writer.writeBit(1);
            void writer.writeBit(0);
            void writer.writeBit(1);
            void writer.writeBit(0);
            void writer.writeBit(1);
            // Byte 3 (only 4 bits are written)
            void writer.writeBit(0);
            void writer.writeBit(0);
            void writer.writeBit(1);
            void writer.writeBit(1);
            await writer.flush();
            // Byte 4 (only 3 bits are written)
            void writer.writeBit(1);
            void writer.writeBit(0);
            void writer.writeBit(1);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0b01010011, 0b10101100, 0b1100, 0b101 ]);
        });
    });

    describe("writeUint8", () => {
        it("writes single unsigned bytes at byte boundary", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            void writer.writeUint8(0x17);
            void writer.writeUint8(0x8f);
            void writer.writeUint8(0x4a);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0x17, 0x8f, 0x4a ]);
        });
        it("writes single unsigned bytes outside byte boundary", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            void writer.writeBit(1);
            void writer.writeUint8(0b11001010);
            void writer.writeUint8(0b10100011);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0b10010101, 0b1000111, 0b1 ]);
        });
    });

    describe("writeInt8", () => {
        it("writes single signed bytes at byte boundary", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            void writer.writeInt8(0);
            void writer.writeInt8(1);
            void writer.writeInt8(-1);
            void writer.writeInt8(127);
            void writer.writeInt8(-128);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0x00, 0x01, 0xff, 0x7f, 0x80 ]);
        });
        it("writes single signed bytes outside byte boundary", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            void writer.writeBit(1);
            void writer.writeInt8(0);
            void writer.writeInt8(1);
            void writer.writeInt8(-1);
            void writer.writeInt8(127);
            void writer.writeInt8(-128);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0b00000001,
                0b00000010,
                0b11111110,
                0b11111111,
                0b00000000,
                0b00000001
            ]);
        });
    });

    describe("writeUint16", () => {
        it("writes single unsigned 16 bit value in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.LITTLE });
            void writer.writeUint16(0x1234);
            void writer.writeUint16(0xfedc);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0x34, 0x12, 0xdc, 0xfe ]);
        });
        it("writes single unsigned 16 bit value in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeUint16(0x1234);
            void writer.writeUint16(0xfedc);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0x12, 0x34, 0xfe, 0xdc ]);
        });
    });

    describe("writeInt16", () => {
        it("writes single signed 16 bit value in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.LITTLE });
            void writer.writeInt16(0);
            void writer.writeInt16(1);
            void writer.writeInt16(-1);
            void writer.writeInt16(32767);
            void writer.writeInt16(-32768);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00,
                0x01, 0x00,
                0xff, 0xff,
                0xff, 0x7f,
                0x00, 0x80
            ]);
        });
        it("writes single signed 16 bit value in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeInt16(0);
            void writer.writeInt16(1);
            void writer.writeInt16(-1);
            void writer.writeInt16(32767);
            void writer.writeInt16(-32768);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00,
                0x00, 0x01,
                0xff, 0xff,
                0x7f, 0xff,
                0x80, 0x00
            ]);
        });
    });

    describe("writeUint32", () => {
        it("writes single unsigned 32 bit value in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.LITTLE });
            void writer.writeUint32(0x01234567);
            void writer.writeUint32(0xfedcba98);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x67, 0x45, 0x23, 0x01,
                0x98, 0xba, 0xdc, 0xfe
            ]);
        });
        it("writes single unsigned 32 bit value in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeUint32(0x01234567);
            void writer.writeUint32(0xfedcba98);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x01, 0x23, 0x45, 0x67,
                0xfe, 0xdc, 0xba, 0x98
            ]);
        });
    });

    describe("writeInt32", () => {
        it("writes single signed 32 bit value in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.LITTLE });
            void writer.writeInt32(0);
            void writer.writeInt32(1);
            void writer.writeInt32(-1);
            void writer.writeInt32(2147483647);
            void writer.writeInt32(-2147483648);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00, 0x00, 0x00,
                0x01, 0x00, 0x00, 0x00,
                0xff, 0xff, 0xff, 0xff,
                0xff, 0xff, 0xff, 0x7f,
                0x00, 0x00, 0x00, 0x80
            ]);
        });
        it("writes single signed 32 bit value in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeInt32(0);
            void writer.writeInt32(1);
            void writer.writeInt32(-1);
            void writer.writeInt32(2147483647);
            void writer.writeInt32(-2147483648);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x01,
                0xff, 0xff, 0xff, 0xff,
                0x7f, 0xff, 0xff, 0xff,
                0x80, 0x00, 0x00, 0x00
            ]);
        });
    });

    describe("writeBigUint64", () => {
        it("writes single unsigned 64 bit value in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 5, endianness: Endianness.LITTLE });
            void writer.writeBigUint64(0x0123456789abcdefn);
            void writer.writeBigUint64(0xfedcba9876543210n);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01,
                0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe
            ]);
        });
        it("writes single unsigned 64 bit value in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeBigUint64(0x0123456789abcdefn);
            void writer.writeBigUint64(0xfedcba9876543210n);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
                0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10
            ]);
        });
    });

    describe("writeBigInt64", () => {
        it("writes single signed 64 bit value in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 5, endianness: Endianness.LITTLE });
            void writer.writeBigInt64(0n);
            void writer.writeBigInt64(1n);
            void writer.writeBigInt64(-1n);
            void writer.writeBigInt64(9223372036854775807n);
            void writer.writeBigInt64(-9223372036854775808n);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80
            ]);
        });
        it("writes single signed 64 bit value in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 7, endianness: Endianness.BIG });
            void writer.writeBigInt64(0n);
            void writer.writeBigInt64(1n);
            void writer.writeBigInt64(-1n);
            void writer.writeBigInt64(9223372036854775807n);
            void writer.writeBigInt64(-9223372036854775808n);
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
                0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
        });
    });

    describe("writeUint8Array", () => {
        it("writes unsigned byte array at byte boundary", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            void writer.writeUint8Array(new Uint8Array([ 0x17, 0x8f, 0x4a ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0x17, 0x8f, 0x4a ]);
        });
        it("writes unsigned byte array outside byte boundary", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            void writer.writeBit(1);
            void writer.writeUint8Array(new Uint8Array([ 0b11001010, 0b10100011 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0b10010101, 0b1000111, 0b1 ]);
        });
    });

    describe("writeInt8Array", () => {
        it("writes signed byte array at byte boundary", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            void writer.writeInt8Array(new Int8Array([ 0, 1, -1, 127, -128 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0x00, 0x01, 0xff, 0x7f, 0x80 ]);
        });
        it("writes signed byte array outside byte boundary", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 2 });
            void writer.writeBit(1);
            void writer.writeInt8Array(new Int8Array([ 0, 1, -1, 127, -128 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0b00000001,
                0b00000010,
                0b11111110,
                0b11111111,
                0b00000000,
                0b00000001
            ]);
        });
    });

    describe("writeUint16Array", () => {
        it("writes unsigned 16 bit values in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.LITTLE });
            void writer.writeUint16Array(new Uint16Array([ 0x1234, 0xfedc ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0x34, 0x12, 0xdc, 0xfe ]);
        });
        it("writes unsigned 16 bit values in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeUint16Array(new Uint16Array([ 0x1234, 0xfedc ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([ 0x12, 0x34, 0xfe, 0xdc ]);
        });
    });

    describe("writeInt16Array", () => {
        it("writes signed 16 bit values in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.LITTLE });
            void writer.writeInt16Array(new Int16Array([ 0, 1, -1, 32767, -32768 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00,
                0x01, 0x00,
                0xff, 0xff,
                0xff, 0x7f,
                0x00, 0x80
            ]);
        });
        it("writes signed 16 bit values in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeInt16Array(new Int16Array([ 0, 1, -1, 32767, -32768 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00,
                0x00, 0x01,
                0xff, 0xff,
                0x7f, 0xff,
                0x80, 0x00
            ]);
        });
    });

    describe("writeUint32Array", () => {
        it("writes unsigned 32 bit values in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.LITTLE });
            void writer.writeUint32Array(new Uint32Array([ 0x01234567, 0xfedcba98 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x67, 0x45, 0x23, 0x01,
                0x98, 0xba, 0xdc, 0xfe
            ]);
        });
        it("writes unsigned 32 bit values in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeUint32Array(new Uint32Array([ 0x01234567, 0xfedcba98 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x01, 0x23, 0x45, 0x67,
                0xfe, 0xdc, 0xba, 0x98
            ]);
        });
    });

    describe("writeInt32Array", () => {
        it("writes signed 32 bit values in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.LITTLE });
            void writer.writeInt32Array(new Int32Array([ 0, 1, -1, 2147483647, 2147483648 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00, 0x00, 0x00,
                0x01, 0x00, 0x00, 0x00,
                0xff, 0xff, 0xff, 0xff,
                0xff, 0xff, 0xff, 0x7f,
                0x00, 0x00, 0x00, 0x80
            ]);
        });
        it("writes signed 32 bit values in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeInt32Array(new Int32Array([ 0, 1, -1, 2147483647, 2147483648 ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x01,
                0xff, 0xff, 0xff, 0xff,
                0x7f, 0xff, 0xff, 0xff,
                0x80, 0x00, 0x00, 0x00
            ]);
        });
    });

    describe("writeBigUint64Array", () => {
        it("writes unsigned 64 bit values in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 5, endianness: Endianness.LITTLE });
            void writer.writeBigUint64Array(new BigUint64Array([ 0x0123456789abcdefn, 0xfedcba9876543210n ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0xef, 0xcd, 0xab, 0x89, 0x67, 0x45, 0x23, 0x01,
                0x10, 0x32, 0x54, 0x76, 0x98, 0xba, 0xdc, 0xfe
            ]);
        });
        it("writes unsigned 64 bit values in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, endianness: Endianness.BIG });
            void writer.writeBigUint64Array(new BigUint64Array([ 0x0123456789abcdefn, 0xfedcba9876543210n ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
                0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10
            ]);
        });
    });

    describe("writeBigInt64Array", () => {
        it("writes signed 64 bit values in little endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 5, endianness: Endianness.LITTLE });
            void writer.writeBigInt64Array(new BigInt64Array([ 0n, 1n, -1n, 9223372036854775807n,
                -9223372036854775808n ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80
            ]);
        });
        it("writes signed 64 bit values in big endian", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 7, endianness: Endianness.BIG });
            void writer.writeBigInt64Array(new BigInt64Array([ 0n, 1n, -1n, 9223372036854775807n,
                -9223372036854775808n ]));
            await writer.flush();
            expect(Array.from(sink.getData())).toEqual([
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
                0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
                0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
            ]);
        });
    });

    describe("writeString", () => {
        it("writes a string in default encoding", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, encoding: "utf-16be" });
            void writer.writeString("塵も積もれば山となる。");
            await writer.flush();
            const text = new TextDecoder("utf-16be").decode(sink.getData());
            expect(text).toBe("塵も積もれば山となる。");
        });
        it("writes a string in given encoding", async () => {
            const sink = new Uint8ArraySink();
            const writer = new DataWriter(sink, { bufferSize: 3, encoding: "utf-16be" });
            void writer.writeString("塵も積もれば山となる。", "shift-jis");
            await writer.flush();
            const text = new TextDecoder("shift-jis").decode(sink.getData());
            expect(text).toBe("塵も積もれば山となる。");
        });
    });
});
