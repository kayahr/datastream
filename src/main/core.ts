/*
 * Copyright (C) 2021 Klaus Reimer <k@ailis.de>
 * See LICENSE.md for licensing information
 */

export {
    type DataReaderOptions, type ReadStringOptions, type ReadLineOptions, type ReadArrayOptions, type ReadMultiByteArrayOptions, DataReader,
    readDataFromStream
} from "./DataReader.ts";
export { type DataReaderSource } from "./DataReaderSource.ts";
export { type DataWriterOptions, DataWriter, writeDataToStream } from "./DataWriter.ts";
export { type  DataWriterSink } from "./DataWriterSink.ts";
export { Endianness, getNativeEndianness, swap16, swap32, swap64 } from "./Endianness.ts";
export { Uint8ArraySink } from "./sinks/Uint8ArraySink.ts";
export { Uint8ArraySource } from "./sources/Uint8ArraySource.ts";
