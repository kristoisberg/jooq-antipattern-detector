import { describe, expect, test } from "bun:test";

import { renderOutput, type CliOutput } from "../output.js";

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
    distinctAntipatterns: 2,
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
    const rendered = stripAnsi(
      renderOutput(
        {
          ...sampleOutput,
          results: [],
        },
        "text",
      ),
    );

    expect(rendered).toContain("SQL Antipattern Detector");
    expect(rendered).toContain("google:gemini-2.5-pro");
    expect(rendered).toContain("No applicable Java files were found.");
  });

  test("renders text output for findings and failures, while skipping successful no-findings files", () => {
    const rendered = stripAnsi(
      renderOutput(
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
      ),
    );

    expect(rendered).toContain("Summary");
    expect(rendered).toContain("Distinct antipatterns");
    expect(rendered).toContain("Findings");
    expect(rendered).toContain("Failures");
    expect(rendered).toContain("  ----------------------------------------\nsrc/Alpha.java");
    expect(rendered).toContain("src/Alpha.java");
    expect(rendered).toContain("ID Required (10-12)");
    expect(rendered).toContain("Code      id BIGINT");
    expect(rendered).toContain('Comment   Primary key uses "id", which is too generic.');
    expect(rendered).toContain('Comment   Primary key uses "id", which is too generic.\n\n  31 Flavors (20-20)');
    expect(rendered).not.toContain("src/Gamma.java");
    expect(rendered).not.toContain("[ddl]");
    expect(rendered).not.toContain("[dml-dql]");
    expect(rendered).toContain("  ----------------------------------------\nsrc/Beta.java");
    expect(rendered).toContain("src/Beta.java");
    expect(rendered).toContain("Analysis failed: Model timeout");
  });

  test("renders a compact success message when analyses complete without findings", () => {
    const rendered = stripAnsi(
      renderOutput(
        {
          ...sampleOutput,
          results: [
            {
              filePath: "/tmp/my-project/src/Gamma.java",
              relativePath: "src/Gamma.java",
              promptType: "dml-dql",
              occurrences: [],
            },
          ],
          summary: {
            ...sampleOutput.summary,
            filesWithFindings: 0,
            totalOccurrences: 0,
            distinctAntipatterns: 0,
          },
        },
        "text",
      ),
    );

    expect(rendered).toContain("No antipatterns detected.");
    expect(rendered).not.toContain("src/Gamma.java");
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

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}
