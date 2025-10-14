import { describe, it } from "node:test";

import * as exports from "../main/node.ts";
import { FileInputStream } from "../main/streams/FileInputStream.ts";
import { FileOutputStream } from "../main/streams/FileOutputStream.ts";
import { assertEquals } from "@kayahr/assert";

describe("node", () => {
    it("exports relevant types and functions", () => {
        assertEquals({ ...exports }, {
            FileInputStream,
            FileOutputStream
        });
    });
});
