import { describe, it } from "node:test";

import { Uint8ArraySink } from "../../main/sinks/Uint8ArraySink.ts";
import { assertEquals, assertSame, assertUndefined } from "@kayahr/assert";

describe("Uint8ArraySink", () => {
    describe("capacity", () => {
        it("defaults to 1024", () => {
            const sink = new Uint8ArraySink();
            assertSame(sink.getCapacity(), 1024);
        });
        it("can be set via constructor", () => {
            const sink = new Uint8ArraySink(2048);
            assertSame(sink.getCapacity(), 2048);
        });
    });

    describe("write", () => {
        it("can write single bytes to the sink", () => {
            const sink = new Uint8ArraySink();
            sink.write(1);
            sink.write(2);
            sink.write(3);
            assertSame(sink.getSize(), 3);
            assertEquals(Array.from(sink.getData()), [ 1, 2, 3 ]);
        });
        it("can write byte arrays to the sink", () => {
            const sink = new Uint8ArraySink();
            sink.write(new Uint8Array([ 1, 2 ]));
            sink.write(new Uint8Array([ 3, 4 ]));
            assertSame(sink.getSize(), 4);
            assertEquals(Array.from(sink.getData()), [ 1, 2, 3, 4 ]);
        });
    });

    describe("at", () => {
        it("returns byte at given index", () => {
            const sink = new Uint8ArraySink();
            sink.write(new Uint8Array([ 1, 2 ]));
            assertSame(sink.at(0), 1);
            assertSame(sink.at(1), 2);
        });
        it("returns byte at given negative index", () => {
            const sink = new Uint8ArraySink();
            sink.write(new Uint8Array([ 1, 2 ]));
            assertSame(sink.at(-1), 2);
            assertSame(sink.at(-2), 1);
        });
        it("returns undefined when index is out of bounds", () => {
            const sink = new Uint8ArraySink();
            sink.write(new Uint8Array([ 1, 2 ]));
            assertUndefined(sink.at(-3), );
            assertUndefined(sink.at(2), );
        });
    });

    describe("reset", () => {
        it("resets to an empty sink without changing capacity", () => {
            const sink = new Uint8ArraySink(1);
            sink.write(new Uint8Array([ 1, 2, 3 ]));
            assertSame(sink.getCapacity(), 4);
            assertSame(sink.getSize(), 3);
            sink.reset();
            assertSame(sink.getCapacity(), 4);
            assertSame(sink.getSize(), 0);
        });
    });

    describe("rewind", () => {
        it("rewinds the sink by the given number of bytes without changing capacity", () => {
            const sink = new Uint8ArraySink(1);
            sink.write(new Uint8Array([ 1, 2, 3 ]));
            assertSame(sink.getCapacity(), 4);
            assertSame(sink.getSize(), 3);
            sink.rewind(2);
            assertSame(sink.getCapacity(), 4);
            assertSame(sink.getSize(), 1);
            sink.rewind(2);
            assertSame(sink.getCapacity(), 4);
            assertSame(sink.getSize(), 0);
            sink.rewind(2);
            assertSame(sink.getCapacity(), 4);
            assertSame(sink.getSize(), 0);
        });
    });

    it("builds a Uint8Array with a growing buffer", () => {
        const sink = new Uint8ArraySink(1);
        assertSame(sink.getCapacity(), 1);
        sink.write(new Uint8Array([ 1, 2, 3 ]));
        assertSame(sink.getCapacity(), 4);
        assertSame(sink.getSize(), 3);
        assertEquals(sink.getData(), new Uint8Array([ 1, 2, 3 ]));
        sink.write(new Uint8Array([ 4 ]));
        assertSame(sink.getCapacity(), 4);
        assertSame(sink.getSize(), 4);
        assertEquals(sink.getData(), new Uint8Array([ 1, 2, 3, 4 ]));
        sink.write(new Uint8Array([ 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
        assertSame(sink.getCapacity(), 32);
        assertSame(sink.getSize(), 20);
        assertEquals(sink.getData(), new Uint8Array(
            [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
    });

    it("builds a Uint8Array with the default initial capacity", () => {
        const sink = new Uint8ArraySink(1024);
        assertSame(sink.getCapacity(), 1024);
        sink.write(new Uint8Array([ 1, 2, 3 ]));
        sink.write(new Uint8Array([ 4 ]));
        sink.write(new Uint8Array([ 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
        assertSame(sink.getSize(), 20);
        assertSame(sink.getCapacity(), 1024);
        assertEquals(sink.getData(), new Uint8Array(
            [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
    });
});
