import { describe, expect, test } from "bun:test";

import { buildPrompt } from "./prompt-builder.js";
import type { FileCandidate } from "./file-discovery.js";
import type { PromptSet } from "./prompts.js";

const prompts: PromptSet = {
  ddl: "DDL\nFILE_CONTENTS\nKEYS_CONTENTS",
  dmlDql: "DML\nFILE_CONTENTS\nKEYS_CONTENTS",
};

describe("buildPrompt", () => {
  test("uses the ddl template and numbers trimmed source lines", () => {
    const candidate: FileCandidate = {
      absolutePath: "/tmp/project/Table.java",
      relativePath: "Table.java",
      contents: "  first line  \n\tsecond line\t",
      promptType: "ddl",
      closestKeysContents: "  key one  \n\tkey two\t",
    };

    const prompt = buildPrompt(candidate, prompts);

    expect(prompt).toContain("DDL");
    expect(prompt).toContain("1: first line\n2: second line");
    expect(prompt).toContain("key one\nkey two");
  });

  test("uses the dml/dql template", () => {
    const candidate: FileCandidate = {
      absolutePath: "/tmp/project/Query.java",
      relativePath: "Query.java",
      contents: "query()",
      promptType: "dml-dql",
      closestKeysContents: "",
    };

    const prompt = buildPrompt(candidate, prompts);

    expect(prompt).toContain("DML");
    expect(prompt).not.toContain("DDL");
    expect(prompt).toContain("1: query()");
  });
});
