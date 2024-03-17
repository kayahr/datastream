import * as node from "../main/node";
import { FileInputStream } from "../main/streams/FileInputStream";
import { FileOutputStream } from "../main/streams/FileOutputStream";

describe("index", () => {
    it("exports relevant types and functions", () => {
        expect(node).toEqual({
            FileInputStream,
            FileOutputStream
        });
    });
});
