import { Uint8ArraySink } from "../main/Uint8ArraySink";

describe("Uint8ArraySink", () => {
    describe("capacity", () => {
        it("defaults to 1024", () => {
            const sink = new Uint8ArraySink();
            expect(sink.getCapacity()).toBe(1024);
        });
        it("can be set via constructor", () => {
            const sink = new Uint8ArraySink(2048);
            expect(sink.getCapacity()).toBe(2048);
        });
    });

    describe("write", () => {
        it("can write single bytes to the sink", () => {
            const sink = new Uint8ArraySink();
            sink.write(1);
            sink.write(2);
            sink.write(3);
            expect(sink.getSize()).toBe(3);
            expect(Array.from(sink.getData())).toEqual([ 1, 2, 3 ]);
        });
        it("can write byte arrays to the sink", () => {
            const sink = new Uint8ArraySink();
            sink.write(new Uint8Array([ 1, 2 ]));
            sink.write(new Uint8Array([ 3, 4 ]));
            expect(sink.getSize()).toBe(4);
            expect(Array.from(sink.getData())).toEqual([ 1, 2, 3, 4 ]);
        });
    });

    describe("at", () => {
        it("returns byte at given index", () => {
            const sink = new Uint8ArraySink();
            sink.write(new Uint8Array([ 1, 2 ]));
            expect(sink.at(0)).toBe(1);
            expect(sink.at(1)).toBe(2);
        });
        it("returns byte at given negative index", () => {
            const sink = new Uint8ArraySink();
            sink.write(new Uint8Array([ 1, 2 ]));
            expect(sink.at(-1)).toBe(2);
            expect(sink.at(-2)).toBe(1);
        });
        it("returns undefined when index is out of bounds", () => {
            const sink = new Uint8ArraySink();
            sink.write(new Uint8Array([ 1, 2 ]));
            expect(sink.at(-3)).toBeUndefined();
            expect(sink.at(2)).toBeUndefined();
        });
    });

    describe("reset", () => {
        it("resets to an empty sink without changing capacity", () => {
            const sink = new Uint8ArraySink(1);
            sink.write(new Uint8Array([ 1, 2, 3 ]));
            expect(sink.getCapacity()).toBe(4);
            expect(sink.getSize()).toBe(3);
            sink.reset();
            expect(sink.getCapacity()).toBe(4);
            expect(sink.getSize()).toBe(0);
        });
    });

    describe("rewind", () => {
        it("rewinds the sink by the given number of bytes without changing capacity", () => {
            const sink = new Uint8ArraySink(1);
            sink.write(new Uint8Array([ 1, 2, 3 ]));
            expect(sink.getCapacity()).toBe(4);
            expect(sink.getSize()).toBe(3);
            sink.rewind(2);
            expect(sink.getCapacity()).toBe(4);
            expect(sink.getSize()).toBe(1);
            sink.rewind(2);
            expect(sink.getCapacity()).toBe(4);
            expect(sink.getSize()).toBe(0);
            sink.rewind(2);
            expect(sink.getCapacity()).toBe(4);
            expect(sink.getSize()).toBe(0);
        });
    });

    it("builds a Uint8Array with a growing buffer", () => {
        const sink = new Uint8ArraySink(1);
        expect(sink.getCapacity()).toBe(1);
        sink.write(new Uint8Array([ 1, 2, 3 ]));
        expect(sink.getCapacity()).toBe(4);
        expect(sink.getSize()).toBe(3);
        expect(sink.getData()).toEqual(new Uint8Array([ 1, 2, 3 ]));
        sink.write(new Uint8Array([ 4 ]));
        expect(sink.getCapacity()).toBe(4);
        expect(sink.getSize()).toBe(4);
        expect(sink.getData()).toEqual(new Uint8Array([ 1, 2, 3, 4 ]));
        sink.write(new Uint8Array([ 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
        expect(sink.getCapacity()).toBe(32);
        expect(sink.getSize()).toBe(20);
        expect(sink.getData()).toEqual(new Uint8Array(
            [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
    });

    it("builds a Uint8Array with the default initial capacity", () => {
        const sink = new Uint8ArraySink(1024);
        expect(sink.getCapacity()).toBe(1024);
        sink.write(new Uint8Array([ 1, 2, 3 ]));
        sink.write(new Uint8Array([ 4 ]));
        sink.write(new Uint8Array([ 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
        expect(sink.getSize()).toBe(20);
        expect(sink.getCapacity()).toBe(1024);
        expect(sink.getData()).toEqual(new Uint8Array(
            [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
    });
});
