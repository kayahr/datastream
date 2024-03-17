/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { FileHandle, open } from "fs/promises";

/**
 * File input stream for Node.js.
 */
export class FileInputStream extends ReadableStream<Uint8Array> implements AsyncDisposable {
    /** The open file handle. Null if not yet opened. */
    private file: FileHandle | null;

    /**
     * Creates a new file input stream reading to the given file.
     *
     * @param filename  - The name of the file to read.
     * @param chunkSize - The size of the chunks to read from the file.
     */
    public constructor(filename: string, chunkSize: number = 8192) {
        let self: this | null = null;
        let file: FileHandle | null = null;
        super({
            async start() {
                file = await open(filename, "r");
                // When constructor already finished then write file handle to property. Otherwise the constructor
                // will do it after super constructor is finished
                if (self != null) {
                    self.file = file;
                }
            },

            async pull(controller: ReadableStreamDefaultController<Uint8Array>) {
                const buffer = new Uint8Array(chunkSize);
                const read = (await self?.file?.read(buffer, 0, chunkSize))?.bytesRead;
                if (read != null && read > 0) {
                    const chunk = buffer.subarray(0, read);
                    controller.enqueue(chunk);
                } else {
                    controller.close();
                }
            }
        });
        self = this;
        this.file = file;
    }

    /**
     * Closes the stream.
     */
    public async close(): Promise<void> {
        if (this.file != null) {
            await this.file.close();
            this.file = null;
        }
    }

    /** @inheritDoc */
    public [Symbol.asyncDispose](): PromiseLike<void> {
        return this.close();
    }
}
