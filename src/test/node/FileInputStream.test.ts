import { resolve } from "node:path";

import { FileInputStream } from "../../main/node/FileInputStream";

describe("FileInputStream", () => {
    async function testStream(stream: FileInputStream, chunkSize = 8192): Promise<void> {
        try {
            const reader = stream.getReader();
            try {
                let read = 0;
                const expectedSize = 1212964;
                let result;
                while (!(result = await reader.read()).done) {
                    const dataSize = result.value.length;
                    expect(dataSize).toBe(Math.min(expectedSize - read, chunkSize));
                    read += dataSize;
                }
                expect(read).toBe(expectedSize);
            } finally {
                reader.releaseLock();
            }
        } finally {
            await stream.close();
        }
    }
    it("can read bytes from given file with default chunk size (8192)", async () => {
        await testStream(new FileInputStream(resolve(__dirname, `../../../src/test/data/iliad_utf-8.txt`)), 8192);
    });

    it("can read bytes from given file with custom chunk size (500)", async () => {
        await testStream(new FileInputStream(resolve(__dirname, `../../../src/test/data/iliad_utf-8.txt`), 500), 500);
    });

    it("is disposable", async () => {
        let spy: jest.SpyInstance | null = null;
        if (spy == null /* Always true, just here to create a block on which end the stream is disposed */) {
            await using stream = new FileInputStream(resolve(__dirname, `../../../src/test/data/iliad_utf-8.txt`));
            spy = jest.spyOn(stream, "close");
        }
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
