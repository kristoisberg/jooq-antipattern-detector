import { describe, expect, test } from "bun:test";

import { buildPrompt, formatKeysContents, formatSourceWithLineNumbers } from "../prompt-builder.js";
import type { FileCandidate } from "../file-discovery.js";
import type { PromptSet } from "../prompts.js";

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

  test("truncates oversized source while preserving head and tail line numbers", () => {
    const candidate: FileCandidate = {
      absolutePath: "/tmp/project/Large.java",
      relativePath: "Large.java",
      contents: Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join("\n"),
      promptType: "ddl",
      closestKeysContents: "key one\nkey two",
    };

    const prompt = buildPrompt(candidate, prompts, 260);

    expect(prompt.length).toBeLessThanOrEqual(260);
    expect(prompt).toContain("1: line 1");
    expect(prompt).toContain("40: line 40");
    expect(prompt).toContain("lines omitted due to prompt size");
  });

  test("truncates keys contents only when the remaining budget is exhausted", () => {
    const candidate: FileCandidate = {
      absolutePath: "/tmp/project/Small.java",
      relativePath: "Small.java",
      contents: "short",
      promptType: "ddl",
      closestKeysContents: "very long keys payload that should be truncated",
    };

    const prompt = buildPrompt(candidate, prompts, 40);

    expect(prompt.length).toBeLessThanOrEqual(40);
    expect(prompt).toContain("1: short");
    expect(prompt).toContain("...");
  });

  test("formats numbered source lines independently", () => {
    expect(formatSourceWithLineNumbers("  first line  \n\tsecond line\t")).toBe("1: first line\n2: second line");
  });

  test("formats keys contents independently", () => {
    expect(formatKeysContents("  key one  \n\tkey two\t")).toBe("key one\nkey two");
  });
});
