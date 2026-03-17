import { describe, expect, test } from "bun:test";

import { loadPrompts } from "../prompts.js";

describe("loadPrompts", () => {
  test("returns both prompt templates", async () => {
    const prompts = await loadPrompts();

    expect(prompts.ddl).toContain("FILE_CONTENTS");
    expect(prompts.ddl).toContain("KEYS_CONTENTS");
    expect(prompts.dmlDql).toContain("FILE_CONTENTS");
    expect(prompts.dmlDql).toContain("Poor Man’s Search Engine");
  });
});
