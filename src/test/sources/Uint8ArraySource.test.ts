import { describe, expect, it } from "vitest";

import { Uint8ArraySource } from "../../main/sources/Uint8ArraySource.js";

describe("Uint8ArraySource", () => {
    it("reads from the given array", () => {
        const data = new Uint8Array([ 1, 2, 3, 4, 5 ]);
        const source = new Uint8ArraySource(data);
        expect(source.read()).toEqual({ value: data, done: false });
        expect(source.read()).toEqual({ done: true });
    });
});
