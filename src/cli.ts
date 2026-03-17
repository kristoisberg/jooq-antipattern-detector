#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Command } from "commander";

import { runAnalysis } from "./app.js";
import type { AppConfig } from "./config.js";
import { registerCliOptions, resolveConfig } from "./config.js";
import type { CliOutput } from "./output.js";
import { renderOutput } from "./output.js";

export type CliDeps = {
  resolveConfig: (args?: string[], env?: NodeJS.ProcessEnv) => AppConfig;
  runAnalysis: typeof runAnalysis;
  renderOutput: typeof renderOutput;
  mkdir: typeof mkdir;
  writeFile: typeof writeFile;
  writeStdout: (message: string) => void;
};

const defaultCliDeps: CliDeps = {
  resolveConfig,
  runAnalysis,
  renderOutput,
  mkdir,
  writeFile,
  writeStdout: (message) => {
    process.stdout.write(message);
  },
};

export async function executeCli(
  directory: string,
  args: string[] = process.argv.slice(2),
  deps: CliDeps = defaultCliDeps,
): Promise<void> {
  const config = deps.resolveConfig(args);
  const output = await deps.runAnalysis(directory, config);
  const renderedOutput = `${deps.renderOutput(output, config.format)}\n`;

  if (config.output) {
    const outputPath = path.resolve(config.output);
    await deps.mkdir(path.dirname(outputPath), { recursive: true });
    await deps.writeFile(outputPath, renderedOutput, "utf8");
    return;
  }

  deps.writeStdout(renderedOutput);
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("sql-antipattern-detector")
    .description("Detect SQL antipatterns in Java/jOOQ codebases with an LLM-backed analyzer.")
    .argument("<directory>", "Directory to scan recursively for Java files");

  registerCliOptions(program);

  program.action(async (directory: string) => {
    await executeCli(directory);
  });

  return program;
}

if (import.meta.main) {
  await createProgram().parseAsync(process.argv);
}
