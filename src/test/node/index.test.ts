import * as node from "../../node";
import { FileInputStream } from "../../node/streams/FileInputStream";
import { FileOutputStream } from "../../node/streams/FileOutputStream";

describe("index", () => {
    it("exports relevant types and functions", () => {
        expect(node).toEqual({
            FileInputStream,
            FileOutputStream
        });
    });
});
