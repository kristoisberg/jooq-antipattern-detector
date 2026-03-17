#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Command } from "commander";

import { runAnalysis } from "./app.js";
import { registerCliOptions, resolveConfig } from "./config.js";
import { renderOutput } from "./output.js";

const program = new Command();

program
  .name("sql-antipattern-detector")
  .description("Detect SQL antipatterns in Java/jOOQ codebases with an LLM-backed analyzer.")
  .argument("<directory>", "Directory to scan recursively for Java files");

registerCliOptions(program);

program.action(async (directory: string) => {
  const config = resolveConfig(process.argv.slice(2));
  const output = await runAnalysis(directory, config);
  const renderedOutput = `${renderOutput(output, config.format)}\n`;

  if (config.output) {
    const outputPath = path.resolve(config.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderedOutput, "utf8");
    return;
  }

  process.stdout.write(renderedOutput);
});

await program.parseAsync(process.argv);
