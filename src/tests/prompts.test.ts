import { describe, expect, test } from "bun:test";

import { getPrompts, loadPromptPack } from "../prompts.js";

describe("getPrompts", () => {
  test("returns localisation prompt templates by default", () => {
    const prompts = getPrompts();

    expect(prompts.ddl).toContain("FILE_CONTENTS");
    expect(prompts.ddl).toContain("KEYS_CONTENTS");
    expect(prompts.dmlDql).toContain("FILE_CONTENTS");
    expect(prompts.dmlDql).toContain("Poor Man's Search Engine");
    expect(prompts.ddl).toContain("For every occurrence");
  });

  test("returns classification prompt templates when requested", () => {
    const prompts = getPrompts("classification");

    expect(prompts.ddl).toContain("Return only the distinct antipattern names");
    expect(prompts.ddl).not.toContain("For every occurrence");
    expect(prompts.dmlDql).toContain("Return only the distinct antipattern names");
  });
});

describe("loadPromptPack", () => {
  const validPromptPackJson = JSON.stringify({
    antipatterns: ["Custom Pattern"],
    prompts: {
      localisation: {
        ddl: "local ddl FILE_CONTENTS KEYS_CONTENTS",
        dmlDql: "local dml FILE_CONTENTS",
      },
      classification: {
        ddl: "classification ddl FILE_CONTENTS KEYS_CONTENTS",
        dmlDql: "classification dml FILE_CONTENTS",
      },
    },
  });

  test("returns embedded defaults when no prompts file is configured", () => {
    const promptPack = loadPromptPack(undefined);

    expect(promptPack.antipatterns).toContain("ID Required");
    expect(promptPack.prompts.localisation.dmlDql).toContain("Poor Man's Search Engine");
  });

  test("loads a valid custom JSON prompt pack", () => {
    const promptPack = loadPromptPack("/tmp/prompts.json", {
      readFileSync: () => validPromptPackJson,
    });

    expect(promptPack.antipatterns).toEqual(["Custom Pattern"]);
    expect(promptPack.prompts.classification.ddl).toBe("classification ddl FILE_CONTENTS KEYS_CONTENTS");
  });

  test("throws a clear error when the prompts file cannot be read", () => {
    expect(() =>
      loadPromptPack("/tmp/missing-prompts.json", {
        readFileSync: () => {
          throw new Error("missing");
        },
      }),
    ).toThrow("Failed to read prompts file at /tmp/missing-prompts.json: missing");
  });

  test("throws a clear error when the prompts file is not valid JSON", () => {
    expect(() =>
      loadPromptPack("/tmp/prompts.json", {
        readFileSync: () => "{",
      }),
    ).toThrow("Failed to parse JSON prompts file at /tmp/prompts.json:");
  });

  test("rejects duplicate antipattern names", () => {
    const promptPackJson = JSON.stringify({
      antipatterns: ["Duplicate", "Duplicate"],
      prompts: JSON.parse(validPromptPackJson).prompts,
    });

    expect(() =>
      loadPromptPack("/tmp/prompts.json", {
        readFileSync: () => promptPackJson,
      }),
    ).toThrow("Invalid prompts file at /tmp/prompts.json: antipatterns.1: must be unique");
  });

  test("rejects templates without FILE_CONTENTS", () => {
    const promptPackJson = JSON.stringify({
      antipatterns: ["Custom Pattern"],
      prompts: {
        localisation: {
          ddl: "missing placeholder",
          dmlDql: "local dml FILE_CONTENTS",
        },
        classification: {
          ddl: "classification ddl FILE_CONTENTS",
          dmlDql: "classification dml FILE_CONTENTS",
        },
      },
    });

    expect(() =>
      loadPromptPack("/tmp/prompts.json", {
        readFileSync: () => promptPackJson,
      }),
    ).toThrow("Invalid prompts file at /tmp/prompts.json: prompts.localisation.ddl: ddl must contain FILE_CONTENTS");
  });
});
