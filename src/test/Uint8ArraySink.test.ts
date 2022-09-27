import { Uint8ArraySink } from "../main/Uint8ArraySink";

describe("Uint8ArraySink", () => {
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

    it("builds a Uint8Array with the initial 32 byte", () => {
        const sink = new Uint8ArraySink();
        expect(sink.getCapacity()).toBe(32);
        sink.write(new Uint8Array([ 1, 2, 3 ]));
        sink.write(new Uint8Array([ 4 ]));
        sink.write(new Uint8Array([ 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
        expect(sink.getSize()).toBe(20);
        expect(sink.getCapacity()).toBe(32);
        expect(sink.getData()).toEqual(new Uint8Array(
            [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ]));
    });
});
