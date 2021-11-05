/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

import * as fs from "fs";
import { promisify } from "util";
import { WritableStream } from "web-streams-polyfill/ponyfill";

const open = promisify(fs.open);
const write = promisify(fs.write);
const close = promisify(fs.close);

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
        let fd = NaN;
        super({
            async start() {
                fd = await open(file, "w");
            },

            async write(chunk) {
                await write(fd, chunk);
            },

            async close() {
                await close(fd);
            }
        });
    }
}
