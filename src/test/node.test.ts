import { describe, expect, it } from "vitest";

import * as exports from "../main/node.js";
import { FileInputStream } from "../main/streams/FileInputStream.js";
import { FileOutputStream } from "../main/streams/FileOutputStream.js";

describe("node", () => {
    it("exports relevant types and functions", () => {
        expect({ ...exports }).toEqual({
            FileInputStream,
            FileOutputStream
        });
    });
});
