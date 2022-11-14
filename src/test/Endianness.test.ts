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

    describe("swap16", () => {
        it("swaps 16 bit endianness", () => {
            expect(Endianness.swap16(0x1234)).toBe(0x3412);
            expect(Endianness.swap16(0x3412)).toBe(0x1234);
            expect(Endianness.swap16(0xfedc)).toBe(0xdcfe);
            expect(Endianness.swap16(0xdcfe)).toBe(0xfedc);
        });
    });

    describe("swap32", () => {
        it("swaps 32 bit endianness", () => {
            expect(Endianness.swap32(0x12345678)).toBe(0x78563412);
            expect(Endianness.swap32(0x78563412)).toBe(0x12345678);
            expect(Endianness.swap32(0xfedcba98)).toBe(0x98badcfe);
            expect(Endianness.swap32(0x98badcfe)).toBe(0xfedcba98);
        });
    });

    describe("swap64", () => {
        it("swaps 64 bit endianness", () => {
            expect(Endianness.swap64(0x0123456789abcdefn)).toBe(0xefcdab8967452301n);
            expect(Endianness.swap64(0xefcdab8967452301n)).toBe(0x0123456789abcdefn);
            expect(Endianness.swap64(0xfedcba9876543210n)).toBe(0x1032547698badcfen);
            expect(Endianness.swap64(0x1032547698badcfen)).toBe(0xfedcba9876543210n);
        });
    });
});
