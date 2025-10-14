import { describe, it } from "node:test";
import { FileInputStream } from "../../main/streams/FileInputStream.ts";
import { assertSame } from "@kayahr/assert";

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
                    assertSame(dataSize, Math.min(expectedSize - read, chunkSize));
                    read += dataSize;
                }
                assertSame(read, expectedSize);
            } finally {
                reader.releaseLock();
            }
        } finally {
            await stream.close();
        }
    }
    it("can read bytes from given file with default chunk size (8192)", async () => {
        await testStream(new FileInputStream(`src/test/data/iliad_utf-8.txt`), 8192);
    });

    it("can read bytes from given file with custom chunk size (500)", async () => {
        await testStream(new FileInputStream(`src/test/data/iliad_utf-8.txt`, 500), 500);
    });

    it("is disposable", async (t) => {
        let spy: it.Mock<() => Promise<void>> | null = null;
        if (spy == null /* Always true, just here to create a block on which end the stream is disposed */) {
            await using stream = new FileInputStream(`src/test/data/iliad_utf-8.txt`);
            spy = t.mock.method(stream, "close");
        }
        assertSame(spy.mock.callCount(), 1);
    });
});
