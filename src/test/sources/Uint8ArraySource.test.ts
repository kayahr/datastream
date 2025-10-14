import { describe, it } from "node:test";

import { Uint8ArraySource } from "../../main/sources/Uint8ArraySource.ts";
import { assertEquals } from "@kayahr/assert";

describe("Uint8ArraySource", () => {
    it("reads from the given array", () => {
        const data = new Uint8Array([ 1, 2, 3, 4, 5 ]);
        const source = new Uint8ArraySource(data);
        assertEquals(source.read(), { value: data, done: false });
        assertEquals(source.read(), { value: undefined, done: true });
    });
});
