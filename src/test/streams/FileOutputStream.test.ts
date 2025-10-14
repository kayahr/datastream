import { readFile, rm } from "node:fs/promises";

import { tmpName } from "tmp-promise";
import { describe, it } from "node:test";

import { FileOutputStream } from "../../main/streams/FileOutputStream.ts";
import { assertSame } from "@kayahr/assert";

describe("FileOutputStream", () => {
    it("can write bytes to given file", async () => {
        const tmpFile = await tmpName();
        try {
            const stream = new FileOutputStream(tmpFile);
            try {
                const writer = stream.getWriter();
                try {
                    await writer.write(new TextEncoder().encode("Test text"));
                } finally {
                    writer.releaseLock();
                }
            } finally {
                await stream.close();
            }
            const text = await readFile(tmpFile, { encoding: "utf-8" });
            assertSame(text, "Test text");
        } finally {
            await rm(tmpFile);
        }
    });

    it("is disposable", async (t) => {
        let spy: it.Mock<() => Promise<void>>;
        const tmpFile = await tmpName();
        try {
            await using stream = new FileOutputStream(tmpFile);
            spy = t.mock.method(stream, "close");
        } finally {
            await rm(tmpFile);
        }
        assertSame(spy.mock.callCount(), 1);
    });
});
