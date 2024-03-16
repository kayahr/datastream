import { readFile, rm } from "node:fs/promises";

import { tmpName } from "tmp-promise";

import { FileOutputStream } from "../../main/node/FileOutputStream";

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
            expect(text).toBe("Test text");
        } finally {
            await rm(tmpFile);
        }
    });

    it("is disposable", async () => {
        let spy: jest.SpyInstance;
        const tmpFile = await tmpName();
        try {
            await using stream = new FileOutputStream(tmpFile);
            spy = jest.spyOn(stream, "close");
        } finally {
            await rm(tmpFile);
        }
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
