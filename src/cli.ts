#!/usr/bin/env bun

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { Command } from "commander";

import { runAnalysis } from "./app.js";
import { registerCliOptions, resolveConfig } from "./config.js";
import { renderOutput } from "./output.js";

type CliDeps = {
  runAnalysis: typeof runAnalysis;
  mkdir: typeof mkdir;
  stat: typeof stat;
  writeFile: typeof writeFile;
  writeStdout: typeof writeStdout;
};

const defaultCliDeps: CliDeps = {
  runAnalysis,
  mkdir,
  stat,
  writeFile,
  writeStdout,
};

export function renderCliOutput(
  output: Parameters<typeof renderOutput>[0],
  format: Parameters<typeof renderOutput>[1],
) {
  return `${renderOutput(output, format)}\n`;
}

export function resolveOutputTarget(
  outputPath?: string,
): { type: "stdout" } | { type: "file"; path: string; dir: string } {
  if (!outputPath) {
    return { type: "stdout" };
  }

  const resolvedPath = path.resolve(outputPath);

  return {
    type: "file",
    path: resolvedPath,
    dir: path.dirname(resolvedPath),
  };
}

function writeStdout(message: string): void {
  process.stdout.write(message);
}

export async function executeCli(
  directory: string,
  args: string[] = process.argv.slice(2),
  deps: CliDeps = defaultCliDeps,
): Promise<void> {
  const resolvedDirectory = path.resolve(directory);
  await assertDirectoryExists(resolvedDirectory, deps);
  const config = resolveConfig(args);
  const output = await deps.runAnalysis(resolvedDirectory, config);
  const renderedOutput = renderCliOutput(output, config.format);
  const target = resolveOutputTarget(config.output);

  if (target.type === "file") {
    await deps.mkdir(target.dir, { recursive: true });
    await deps.writeFile(target.path, renderedOutput, "utf8");
    return;
  }

  deps.writeStdout(renderedOutput);
}

async function assertDirectoryExists(directory: string, deps: Pick<CliDeps, "stat">): Promise<void> {
  try {
    const stats = await deps.stat(directory);

    if (!stats.isDirectory()) {
      throw new Error(`Input directory is not a directory: ${directory}`);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Input directory does not exist: ${directory}`);
    }

    throw error;
  }
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
