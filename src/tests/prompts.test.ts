import { describe, expect, test } from "bun:test";

import { getPrompts } from "../prompts.js";

describe("getPrompts", () => {
  test("returns both prompt templates", () => {
    const prompts = getPrompts();

    expect(prompts.ddl).toContain("FILE_CONTENTS");
    expect(prompts.ddl).toContain("KEYS_CONTENTS");
    expect(prompts.dmlDql).toContain("FILE_CONTENTS");
    expect(prompts.dmlDql).toContain("Poor Man’s Search Engine");
  });
});
