import { describe, expect, it } from "vitest";

import * as exports from "../main/core.js";
import { DataReader, readDataFromStream } from "../main/DataReader.js";
import { DataWriter, writeDataToStream } from "../main/DataWriter.js";
import { Endianness, getNativeEndianness, swap16, swap32, swap64 } from "../main/Endianness.js";
import { Uint8ArraySink } from "../main/sinks/Uint8ArraySink.js";
import { Uint8ArraySource } from "../main/sources/Uint8ArraySource.js";

describe("core", () => {
    it("exports relevant types and functions", () => {
        expect({ ...exports }).toEqual({
            DataReader,
            readDataFromStream,
            DataWriter,
            writeDataToStream,
            Endianness,
            getNativeEndianness,
            swap16,
            swap32,
            swap64,
            Uint8ArraySink,
            Uint8ArraySource
        });
    });
});
