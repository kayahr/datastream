import * as os from "os";

import { Endianness } from "../main/Endianness";

describe("Endianness", () => {
    describe("getNative", () => {
        it("returns the native endianness", () => {
            if (os.endianness() === "LE") {
                expect(Endianness.getNative()).toBe(Endianness.LITTLE);
            } else {
                expect(Endianness.getNative()).toBe(Endianness.BIG);
            }
        });
    });
});
