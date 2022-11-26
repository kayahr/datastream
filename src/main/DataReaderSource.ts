/*
 * Copyright (C) 2022 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

/**
 * Interface for a data reader source.
 */
export interface DataReaderSource {
    /**
     * Reads a chunk from the source.
     *
     * @returns the read result.
     */
    read(): Promise<ReadableStreamReadResult<Uint8Array>> | ReadableStreamReadResult<Uint8Array>;
}
