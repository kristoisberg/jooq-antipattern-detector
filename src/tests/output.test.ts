import { describe, expect, test } from "bun:test";

import { renderOutput, type CliOutput } from "../output.js";

const sampleOutput: CliOutput = {
  rootDirectory: "/tmp/my-project",
  model: "google:gemini-2.5-pro",
  mode: "localisation",
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
          explanation:
            'This table uses a generic "id" primary key, which hides the real business identifier. Rename the key to something domain-specific or promote an existing stable unique column to be the primary key.',
        },
        {
          antipatternName: "31 Flavors",
          linesRangeStart: 20,
          linesRangeEnd: 20,
          codeFragment: "status ENUM(...)",
          explanation:
            'This enum hard-codes allowed values in the schema, which makes changes harder to roll out. Move the values into a lookup table and reference it with a foreign key,\nand escape "quotes" correctly.',
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

const [sampleFinding, sampleFailure] = sampleOutput.results;

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
    expect(rendered).toContain("localisation");
    expect(rendered).toContain("No applicable Java files were found.");
  });

  test("renders text output for findings and failures, while skipping successful no-findings files", () => {
    const rendered = stripAnsi(
      renderOutput(
        {
          ...sampleOutput,
          results: [
            sampleFinding,
            {
              filePath: "/tmp/my-project/src/Gamma.java",
              relativePath: "src/Gamma.java",
              promptType: "dml-dql",
              occurrences: [],
            },
            sampleFailure,
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
    expect(rendered).toContain("Code        id BIGINT");
    expect(rendered).toContain(
      'Explanation This table uses a generic "id" primary key, which hides the real business identifier.',
    );
    expect(rendered).toContain("primary key.\n\n  31 Flavors (20-20)");
    expect(rendered).toContain("Code        status ENUM(...)");
    expect(rendered).toContain('foreign key,\n              and escape "quotes" correctly.');
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
        "Project,Antipattern,File,Line from,Line to,Explanation",
        'my-project,ID Required,src/Alpha.java,10,12,"This table uses a generic ""id"" primary key, which hides the real business identifier. Rename the key to something domain-specific or promote an existing stable unique column to be the primary key."',
        'my-project,31 Flavors,src/Alpha.java,20,20,"This enum hard-codes allowed values in the schema, which makes changes harder to roll out. Move the values into a lookup table and reference it with a foreign key,',
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

    expect(rendered).toBe("Project,Antipattern,File,Line from,Line to,Explanation");
  });

  test("renders classification text and csv output using per-file antipattern names", () => {
    const classificationOutput: CliOutput = {
      ...sampleOutput,
      mode: "classification",
      summary: {
        ...sampleOutput.summary,
        filesWithFindings: 2,
        totalOccurrences: 3,
        distinctAntipatterns: 2,
      },
      results: [
        {
          filePath: "/tmp/my-project/src/Alpha.java",
          relativePath: "src/Alpha.java",
          promptType: "ddl",
          antipatterns: ["ID Required", "31 Flavors"],
        },
        {
          filePath: "/tmp/my-project/src/Beta.java",
          relativePath: "src/Beta.java",
          promptType: "dml-dql",
          antipatterns: ["Beware of the Unknown"],
        },
      ],
    };

    const renderedText = stripAnsi(renderOutput(classificationOutput, "text"));
    expect(renderedText).toContain("Mode");
    expect(renderedText).toContain("classification");
    expect(renderedText).toContain("src/Alpha.java");
    expect(renderedText).toContain("ID Required");
    expect(renderedText).toContain("31 Flavors");
    expect(renderedText).not.toContain("Code        ");
    expect(renderedText).not.toContain("Explanation ");

    const renderedCsv = renderOutput(classificationOutput, "csv");
    expect(renderedCsv).toBe(
      [
        "Project,Antipattern,File",
        "my-project,ID Required,src/Alpha.java",
        "my-project,31 Flavors,src/Alpha.java",
        "my-project,Beware of the Unknown,src/Beta.java",
      ].join("\n"),
    );
  });
});

function stripAnsi(value: string): string {
  let result = "";
  let index = 0;

  while (index < value.length) {
    if (value[index] === "\u001B" && value[index + 1] === "[") {
      index += 2;

      while (index < value.length && value[index] !== "m") {
        index += 1;
      }

      if (index < value.length) {
        index += 1;
      }

      continue;
    }

    result += value[index];
    index += 1;
  }

  return result;
}
