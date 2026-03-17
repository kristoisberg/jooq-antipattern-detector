import path from "node:path";

import type { OutputFormat } from "./config.js";
import type { FileAnalysis, RunSummary } from "./types.js";

export type CliOutput = {
  rootDirectory: string;
  model: string;
  generatedAt: string;
  results: FileAnalysis[];
  summary: RunSummary;
};

type OutputDefinition = {
  render: (output: CliOutput) => string;
};

const outputDefinitions: Record<OutputFormat, OutputDefinition> = {
  text: {
    render: renderTextReport,
  },
  json: {
    render: (output) => JSON.stringify(output, null, 2),
  },
  csv: {
    render: renderCsvReport,
  },
};

export function renderOutput(output: CliOutput, format: OutputFormat): string {
  return outputDefinitions[format].render(output);
}

export function renderTextReport(output: CliOutput): string {
  const lines: string[] = [];

  lines.push(`Model: ${output.model}`);
  lines.push(`Directory: ${output.rootDirectory}`);
  lines.push(`Scanned Java files: ${output.summary.scannedJavaFiles}`);
  lines.push(`Applicable files: ${output.summary.applicableFiles}`);
  lines.push(`Analyzed files: ${output.summary.analyzedFiles}`);
  lines.push(`Failed files: ${output.summary.failedFiles}`);
  lines.push(`Files with findings: ${output.summary.filesWithFindings}`);
  lines.push(`Total occurrences: ${output.summary.totalOccurrences}`);
  lines.push(`Input tokens: ${output.summary.inputTokens}`);
  lines.push(`Output tokens: ${output.summary.outputTokens}`);
  lines.push(`Total tokens: ${output.summary.totalTokens}`);

  if (output.results.length === 0) {
    lines.push("");
    lines.push("No applicable Java files were found.");
    return lines.join("\n");
  }

  for (const result of output.results) {
    lines.push("");
    lines.push(renderResultHeader(result));
    if (result.error) {
      lines.push(`  Analysis failed: ${result.error}`);
      continue;
    }
    if (result.occurrences.length === 0) {
      lines.push("  No antipatterns found.");
      continue;
    }

    for (const occurrence of result.occurrences) {
      lines.push(`  ${occurrence.antipatternName} (${occurrence.linesRangeStart}-${occurrence.linesRangeEnd})`);
      lines.push(`  Code: ${occurrence.codeFragment}`);
      lines.push(`  Reasoning: ${occurrence.reasoning}`);
    }
  }

  return lines.join("\n");
}

function renderCsvReport(output: CliOutput): string {
  const projectName = path.basename(output.rootDirectory);
  const rows = [
    ["Project", "Antipattern", "File", "Line from", "Line to", "Comment"],
    ...output.results.flatMap((result) =>
      result.error
        ? []
        : result.occurrences.map((occurrence) => [
            projectName,
            occurrence.antipatternName,
            result.relativePath,
            String(occurrence.linesRangeStart),
            String(occurrence.linesRangeEnd),
            occurrence.reasoning,
          ]),
    ),
  ];

  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

function renderResultHeader(result: FileAnalysis): string {
  return `${result.relativePath} [${result.promptType}]`;
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
