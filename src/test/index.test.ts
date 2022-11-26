import { DataReader, readDataFromStream } from "../main/DataReader";
import { DataWriter, writeDataToStream } from "../main/DataWriter";
import { Endianness, getNativeEndianness, swap16, swap32, swap64 } from "../main/Endianness";
import * as datastream from "../main/index";
import { Uint8ArraySink } from "../main/Uint8ArraySink";
import { Uint8ArraySource } from "../main/Uint8ArraySource";

describe("index", () => {
    it("exports relevant types and functions", () => {
        expect(datastream).toEqual({
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
