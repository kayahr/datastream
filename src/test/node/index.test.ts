import { FileInputStream } from "../../main/node/FileInputStream";
import { FileOutputStream } from "../../main/node/FileOutputStream";
import * as node from "../../main/node/index";

describe("index", () => {
    it("exports relevant types and functions", () => {
        expect(node).toEqual({
            FileInputStream,
            FileOutputStream
        });
    });
});
