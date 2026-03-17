import { describe, expect, test } from "bun:test";

import { renderOutput, type CliOutput } from "./output.js";

const sampleOutput: CliOutput = {
  rootDirectory: "/tmp/my-project",
  model: "google:gemini-2.5-pro",
  generatedAt: "2025-01-01T00:00:00.000Z",
  summary: {
    scannedJavaFiles: 3,
    applicableFiles: 2,
    analyzedFiles: 2,
    failedFiles: 0,
    filesWithFindings: 1,
    totalOccurrences: 2,
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
  },
  results: [
    {
      filePath: "/tmp/my-project/src/Alpha.java",
      relativePath: "src/Alpha.java",
      promptType: "ddl",
      occurrences: [
        {
          antipatternName: "ID Required",
          linesRangeStart: 10,
          linesRangeEnd: 12,
          codeFragment: "id BIGINT",
          reasoning: 'Primary key uses "id", which is too generic.',
        },
        {
          antipatternName: "31 Flavors",
          linesRangeStart: 20,
          linesRangeEnd: 20,
          codeFragment: "status ENUM(...)",
          reasoning: 'Use a lookup table, not enum,\nand escape "quotes" correctly.',
        },
      ],
    },
    {
      filePath: "/tmp/my-project/src/Beta.java",
      relativePath: "src/Beta.java",
      promptType: "dml-dql",
      occurrences: [],
      error: "Model timeout",
    },
  ],
};

describe("renderOutput", () => {
  test("renders text output for empty results", () => {
    const rendered = renderOutput(
      {
        ...sampleOutput,
        results: [],
      },
      "text",
    );

    expect(rendered).toContain("Model: google:gemini-2.5-pro");
    expect(rendered).toContain("No applicable Java files were found.");
  });

  test("renders text output for findings, failures, and no-findings files", () => {
    const rendered = renderOutput(
      {
        ...sampleOutput,
        results: [
          sampleOutput.results[0]!,
          {
            filePath: "/tmp/my-project/src/Gamma.java",
            relativePath: "src/Gamma.java",
            promptType: "dml-dql",
            occurrences: [],
          },
          sampleOutput.results[1]!,
        ],
      },
      "text",
    );

    expect(rendered).toContain("src/Alpha.java [ddl]");
    expect(rendered).toContain("ID Required (10-12)");
    expect(rendered).toContain("src/Gamma.java [dml-dql]");
    expect(rendered).toContain("No antipatterns found.");
    expect(rendered).toContain("src/Beta.java [dml-dql]");
    expect(rendered).toContain("Analysis failed: Model timeout");
  });

  test("renders csv as one row per occurrence", () => {
    const rendered = renderOutput(sampleOutput, "csv");

    expect(rendered).toBe(
      [
        "Project,Antipattern,File,Line from,Line to,Comment",
        'my-project,ID Required,src/Alpha.java,10,12,"Primary key uses ""id"", which is too generic."',
        'my-project,31 Flavors,src/Alpha.java,20,20,"Use a lookup table, not enum,',
        'and escape ""quotes"" correctly."',
      ].join("\n"),
    );
  });

  test("renders csv header even when there are no findings", () => {
    const rendered = renderOutput(
      {
        ...sampleOutput,
        results: sampleOutput.results.map((result) => ({
          ...result,
          occurrences: [],
          error: undefined,
        })),
      },
      "csv",
    );

    expect(rendered).toBe("Project,Antipattern,File,Line from,Line to,Comment");
  });
});
