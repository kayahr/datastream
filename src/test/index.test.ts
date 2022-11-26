import { DataReader, readDataFromStream } from "../main/DataReader";
import { DataWriter, writeDataToStream } from "../main/DataWriter";
import { Endianness } from "../main/Endianness";
import * as datastream from "../main/index";
import { Uint8ArraySink } from "../main/Uint8ArraySink";
import { Uint8ArraySource } from "../main/Uint8ArraySource";

describe("index", () => {
    it("exports relevant types and functions", () => {
        expect(datastream.DataReader).toBe(DataReader);
        expect(datastream.readDataFromStream).toBe(readDataFromStream);
        expect(datastream.DataWriter).toBe(DataWriter);
        expect(datastream.writeDataToStream).toBe(writeDataToStream);
        expect(datastream.Endianness).toBe(Endianness);
        expect(datastream.Uint8ArraySink).toBe(Uint8ArraySink);
        expect(datastream.Uint8ArraySource).toBe(Uint8ArraySource);
    });
});
