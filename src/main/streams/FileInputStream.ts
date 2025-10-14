/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { type FileHandle, open } from "node:fs/promises";

/**
 * File input stream for Node.js.
 */
export class FileInputStream extends ReadableStream<Uint8Array> implements AsyncDisposable {
    /** The open file handle. Null if not yet opened. */
    private state: { file: FileHandle | null };

    /**
     * Creates a new file input stream reading to the given file.
     *
     * @param filename  - The name of the file to read.
     * @param chunkSize - The size of the chunks to read from the file.
     */
    public constructor(filename: string, chunkSize = 8192) {
        const state: { file: FileHandle | null } = {
            file: null
        };
        super({
            start: async () => {
                state.file = await open(filename, "r");
            },
            pull: async (controller: ReadableStreamDefaultController<Uint8Array>) => {
                const buffer = new Uint8Array(chunkSize);
                const read = (await state.file?.read(buffer, 0, chunkSize))?.bytesRead;
                if (read != null && read > 0) {
                    controller.enqueue(buffer.subarray(0, read));
                } else {
                    controller.close();
                }
            }
        });
        this.state = state;
    }

    /**
     * Closes the stream.
     */
    public async close(): Promise<void> {
        if (this.state.file != null) {
            await this.state.file.close();
            this.state.file = null;
        }
    }

    /** @inheritdoc */
    public [Symbol.asyncDispose](): PromiseLike<void> {
        return this.close();
    }
}
