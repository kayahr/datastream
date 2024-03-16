/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import { FileHandle, open } from "fs/promises";

/**
 * File output stream for Node.js.
 */
export class FileOutputStream extends WritableStream<Uint8Array> {
    /**
     * Creates a new file output stream writing to the given file.
     *
     * @param file - The name of the file to write to.
     */
    public constructor(file: string) {
        let fd: FileHandle;
        super({
            async start() {
                fd = await open(file, "w");
            },

            async write(chunk) {
                await fd.write(chunk);
            },

            async close() {
                await fd.close();
            }
        });
    }
}
