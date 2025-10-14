import { describe, it } from "node:test";

import * as exports from "../main/core.ts";
import { DataReader, readDataFromStream } from "../main/DataReader.ts";
import { DataWriter, writeDataToStream } from "../main/DataWriter.ts";
import { Endianness, getNativeEndianness, swap16, swap32, swap64 } from "../main/Endianness.ts";
import { Uint8ArraySink } from "../main/sinks/Uint8ArraySink.ts";
import { Uint8ArraySource } from "../main/sources/Uint8ArraySource.ts";
import { assertEquals } from "@kayahr/assert";

describe("core", () => {
    it("exports relevant types and functions", () => {
        assertEquals({ ...exports }, {
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
