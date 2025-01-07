import { isNodeJS } from "@kayahr/vitest-matchers";
import { describe, expect, it } from "vitest";

import { Endianness, getNativeEndianness, swap16, swap32, swap64 } from "../main/Endianness.js";

describe("Endianness", () => {
    if (isNodeJS()) {
        describe("getNative", () => {
            it("returns the native endianness", async () => {
                const { endianness } = await import("node:os");
                if (endianness() === "LE") {
                    expect(getNativeEndianness()).toBe(Endianness.LITTLE);
                } else {
                    expect(getNativeEndianness()).toBe(Endianness.BIG);
                }
            });
        });
    }

    describe("swap16", () => {
        it("swaps 16 bit endianness", () => {
            expect(swap16(0x1234)).toBe(0x3412);
            expect(swap16(0x3412)).toBe(0x1234);
            expect(swap16(0xfedc)).toBe(0xdcfe);
            expect(swap16(0xdcfe)).toBe(0xfedc);
        });
    });

    describe("swap32", () => {
        it("swaps 32 bit endianness", () => {
            expect(swap32(0x12345678)).toBe(0x78563412);
            expect(swap32(0x78563412)).toBe(0x12345678);
            expect(swap32(0xfedcba98)).toBe(0x98badcfe);
            expect(swap32(0x98badcfe)).toBe(0xfedcba98);
        });
    });

    describe("swap64", () => {
        it("swaps 64 bit endianness", () => {
            expect(swap64(0x0123456789abcdefn)).toBe(0xefcdab8967452301n);
            expect(swap64(0xefcdab8967452301n)).toBe(0x0123456789abcdefn);
            expect(swap64(0xfedcba9876543210n)).toBe(0x1032547698badcfen);
            expect(swap64(0x1032547698badcfen)).toBe(0xfedcba9876543210n);
        });
    });
});
