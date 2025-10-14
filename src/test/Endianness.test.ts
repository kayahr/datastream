import { describe, it } from "node:test";

import { Endianness, getNativeEndianness, swap16, swap32, swap64 } from "../main/Endianness.ts";
import { assertSame } from "@kayahr/assert";

describe("Endianness", () => {
    describe("getNative", () => {
        it("returns the native endianness", async () => {
            const { endianness } = await import("node:os");
            if (endianness() === "LE") {
                assertSame(getNativeEndianness(), Endianness.LITTLE);
            } else {
                assertSame(getNativeEndianness(), Endianness.BIG);
            }
        });
    });

    describe("swap16", () => {
        it("swaps 16 bit endianness", () => {
            assertSame(swap16(0x1234), 0x3412);
            assertSame(swap16(0x3412), 0x1234);
            assertSame(swap16(0xfedc), 0xdcfe);
            assertSame(swap16(0xdcfe), 0xfedc);
        });
    });

    describe("swap32", () => {
        it("swaps 32 bit endianness", () => {
            assertSame(swap32(0x12345678), 0x78563412);
            assertSame(swap32(0x78563412), 0x12345678);
            assertSame(swap32(0xfedcba98), 0x98badcfe);
            assertSame(swap32(0x98badcfe), 0xfedcba98);
        });
    });

    describe("swap64", () => {
        it("swaps 64 bit endianness", () => {
            assertSame(swap64(0x0123456789abcdefn), 0xefcdab8967452301n);
            assertSame(swap64(0xefcdab8967452301n), 0x0123456789abcdefn);
            assertSame(swap64(0xfedcba9876543210n), 0x1032547698badcfen);
            assertSame(swap64(0x1032547698badcfen), 0xfedcba9876543210n);
        });
    });
});
