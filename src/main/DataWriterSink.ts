/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

/**
 * Interface for a data writer sink.
 */
export interface DataWriterSink {
    /**
     * Writes the given chunk to the sink.
     *
     * @param chunk - Thunk of data to write to the sink.
     */
    write(chunk: Uint8Array): Promise<void>;
}
