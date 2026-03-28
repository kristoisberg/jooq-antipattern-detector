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
  const findings = output.results.filter((result) => result.occurrences.length > 0);
  const failures = output.results.filter((result) => result.error);

  lines.push(style.bold(style.cyan("SQL Antipattern Detector")));
  lines.push(`${style.dim("Model")}      ${output.model}`);
  lines.push(`${style.dim("Directory")}  ${output.rootDirectory}`);
  lines.push("");
  lines.push(style.bold("Summary"));
  lines.push(...renderSummary(output.summary));

  if (output.results.length === 0) {
    lines.push("");
    lines.push(style.dim("No applicable Java files were found."));
    return lines.join("\n");
  }

  if (findings.length === 0 && failures.length === 0) {
    lines.push("");
    lines.push(style.dim("No antipatterns detected."));
    return lines.join("\n");
  }

  if (findings.length > 0) {
    lines.push("");
    lines.push(style.bold(style.yellow("Findings")));

    for (const result of findings) {
      lines.push("");
      lines.push(renderFileDivider());
      lines.push(renderResultHeader(result));

      for (const [index, occurrence] of result.occurrences.entries()) {
        lines.push(
          `  ${style.bold(style.yellow(occurrence.antipatternName))} ${style.dim(
            `(${occurrence.linesRangeStart}-${occurrence.linesRangeEnd})`,
          )}`,
        );
        lines.push(...renderDetailBlock("Code", occurrence.codeFragment));
        lines.push(...renderDetailBlock("Explanation", occurrence.explanation));

        if (index < result.occurrences.length - 1) {
          lines.push("");
        }
      }
    }
  }

  if (failures.length > 0) {
    lines.push("");
    lines.push(style.bold(style.red("Failures")));

    for (const result of failures) {
      lines.push("");
      lines.push(renderFileDivider());
      lines.push(renderResultHeader(result));
      lines.push(`  ${style.red("Analysis failed:")} ${result.error}`);
    }
  }

  return lines.join("\n");
}

function renderCsvReport(output: CliOutput): string {
  const projectName = path.basename(output.rootDirectory);
  const rows = [
    ["Project", "Antipattern", "File", "Line from", "Line to", "Explanation"],
    ...output.results.flatMap((result) =>
      result.error
        ? []
        : result.occurrences.map((occurrence) => [
            projectName,
            occurrence.antipatternName,
            result.relativePath,
            String(occurrence.linesRangeStart),
            String(occurrence.linesRangeEnd),
            occurrence.explanation,
          ]),
    ),
  ];

  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\n");
}

function renderResultHeader(result: FileAnalysis): string {
  return style.bold(style.cyan(result.relativePath));
}

function renderFileDivider(): string {
  return style.dim("  ----------------------------------------");
}

function renderDetailBlock(label: string, value: string): string[] {
  const normalizedLines = value.split(/\r?\n/);
  const [firstLine = "", ...restLines] = normalizedLines;
  const labelColumn = `${style.dim(label)}${" ".repeat(Math.max(1, 12 - label.length))}`;

  return [`  ${labelColumn}${firstLine}`, ...restLines.map((line) => `  ${" ".repeat(12)}${line}`)];
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function renderSummary(summary: RunSummary): string[] {
  return [
    renderSummaryLine("Scanned Java files", summary.scannedJavaFiles),
    renderSummaryLine("Applicable files", summary.applicableFiles),
    renderSummaryLine("Analyzed files", summary.analyzedFiles),
    renderSummaryLine("Failed files", summary.failedFiles),
    renderSummaryLine("Files with findings", summary.filesWithFindings),
    renderSummaryLine("Total occurrences", summary.totalOccurrences),
    renderSummaryLine("Distinct antipatterns", summary.distinctAntipatterns),
    renderSummaryLine("Input tokens", summary.inputTokens),
    renderSummaryLine("Output tokens", summary.outputTokens),
    renderSummaryLine("Total tokens", summary.totalTokens),
  ];
}

function renderSummaryLine(label: string, value: number): string {
  return `${style.dim(label.padEnd(21))} ${String(value).padStart(6)}`;
}

const style = {
  bold: (value: string) => colorize("1", value),
  dim: (value: string) => colorize("2", value),
  red: (value: string) => colorize("31", value),
  yellow: (value: string) => colorize("33", value),
  cyan: (value: string) => colorize("36", value),
};

function colorize(code: string, value: string): string {
  if (!supportsColor()) {
    return value;
  }

  return `\u001B[${code}m${value}\u001B[0m`;
}

function supportsColor(): boolean {
  if ("NO_COLOR" in process.env) {
    return false;
  }

  return Boolean(process.stdout?.isTTY);
}
