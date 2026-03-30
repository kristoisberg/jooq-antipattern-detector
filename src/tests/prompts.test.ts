import { describe, expect, test } from "bun:test";

import { getPrompts } from "../prompts.js";

describe("getPrompts", () => {
  test("returns localisation prompt templates by default", () => {
    const prompts = getPrompts();

    expect(prompts.ddl).toContain("FILE_CONTENTS");
    expect(prompts.ddl).toContain("KEYS_CONTENTS");
    expect(prompts.dmlDql).toContain("FILE_CONTENTS");
    expect(prompts.dmlDql).toContain("Poor Man’s Search Engine");
    expect(prompts.ddl).toContain("For every occurrence");
  });

  test("returns classification prompt templates when requested", () => {
    const prompts = getPrompts("classification");

    expect(prompts.ddl).toContain("Return only the distinct antipattern names");
    expect(prompts.ddl).not.toContain("For every occurrence");
    expect(prompts.dmlDql).toContain("Return only the distinct antipattern names");
  });
});
