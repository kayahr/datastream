import { resolve } from "node:path";

import { DataReader } from "../../main/DataReader";
import { FileInputStream } from "../../main/node/FileInputStream";

if ((typeof process !== "undefined") && (process.release?.name === "node")) {
    describe("FileInputStream", () => {
        for (const encoding of [ "utf-8" /* , "utf-16le", "utf-16be" */ ]) {
            it(`can read Iliad in ${encoding}`, async () => {
                const stream = new FileInputStream(resolve(__dirname, `../../../src/test/data/iliad_${encoding}.txt`));
                try {
                    const reader = new DataReader(stream.getReader());
                    let line: string | null;
                    let lines = 0;
                    let chars = 0;
                    let longest = 0;
                    while ((line = await reader.readLine({ encoding })) != null) {
                        lines++;
                        chars += line.length;
                        longest = Math.max(longest, line.length);
                    }
                    expect(lines).toBe(14408);
                    expect(chars).toBe(686996);
                    expect(longest).toBe(76);
                } finally {
                    await stream.close();
                }
            });
        }
    });
}
