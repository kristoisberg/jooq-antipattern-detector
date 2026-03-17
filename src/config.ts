import convict from "convict";
import type { Command } from "commander";

export type OutputFormat = "text" | "json";

export type AppConfig = {
  model: string;
  concurrency: number;
  retries: number;
  format: OutputFormat;
  output?: string;
  debug: boolean;
  apiKeys: {
    gemini?: string;
    anthropic?: string;
    openai?: string;
    openrouter?: string;
  };
};

type ConfigProperties = {
  model: string;
  concurrency: number;
  retries: number;
  format: OutputFormat;
  output: string | null;
  debug: boolean;
  apiKeys: {
    gemini: string | null;
    anthropic: string | null;
    openai: string | null;
    openrouter: string | null;
  };
};

type CliOptionDefinition = {
  flags: string;
  description: string;
};

const configSchema: convict.Schema<ConfigProperties> = {
  model: {
    doc: 'Model identifier. Must use an explicit provider prefix: "google:", "anthropic:", "openai:", or "openrouter:".',
    format: nonEmptyString,
    default: "google:gemini-2.5-pro",
    env: "SQL_ANTIPATTERN_DETECTOR_MODEL",
    arg: "model",
  },
  concurrency: {
    doc: "Number of files to analyze concurrently",
    format: positiveInteger,
    default: 8,
    env: "SQL_ANTIPATTERN_DETECTOR_CONCURRENCY",
    arg: "concurrency",
  },
  retries: {
    doc: "Retries per file on transient model failures",
    format: positiveInteger,
    default: 2,
    env: "SQL_ANTIPATTERN_DETECTOR_RETRIES",
    arg: "retries",
  },
  format: {
    doc: "Output format",
    format: ["text", "json"],
    default: "text",
    env: "SQL_ANTIPATTERN_DETECTOR_FORMAT",
    arg: "format",
  },
  output: {
    doc: "Write output to a file instead of stdout",
    format: String,
    default: null,
    nullable: true,
    env: "SQL_ANTIPATTERN_DETECTOR_OUTPUT",
    arg: "output",
  },
  debug: {
    doc: "Print per-file progress and retries to stderr",
    format: Boolean,
    default: false,
    env: "SQL_ANTIPATTERN_DETECTOR_DEBUG",
    arg: "debug",
  },
  apiKeys: {
    gemini: {
      doc: "Google Gemini API key",
      format: String,
      default: null,
      nullable: true,
      env: "GEMINI_API_KEY",
      arg: "gemini-api-key",
      sensitive: true,
    },
    anthropic: {
      doc: "Anthropic API key",
      format: String,
      default: null,
      nullable: true,
      env: "ANTHROPIC_API_KEY",
      arg: "anthropic-api-key",
      sensitive: true,
    },
    openai: {
      doc: "OpenAI API key",
      format: String,
      default: null,
      nullable: true,
      env: "OPENAI_API_KEY",
      arg: "openai-api-key",
      sensitive: true,
    },
    openrouter: {
      doc: "OpenRouter API key",
      format: String,
      default: null,
      nullable: true,
      env: "OPENROUTER_API_KEY",
      arg: "openrouter-api-key",
      sensitive: true,
    },
  },
};

const CLI_OPTION_DEFINITIONS: CliOptionDefinition[] = [
  {
    flags: "--model <model>",
    description: 'Model identifier. Must use an explicit provider prefix: "google:", "anthropic:", "openai:", or "openrouter:".',
  },
  {
    flags: "--concurrency <number>",
    description: "Number of files to analyze concurrently",
  },
  {
    flags: "--retries <number>",
    description: "Retries per file on transient model failures",
  },
  {
    flags: "--format <format>",
    description: "Output format: text or json",
  },
  {
    flags: "--output <file>",
    description: "Write output to a file instead of stdout",
  },
  {
    flags: "--debug",
    description: "Print per-file progress and retries to stderr",
  },
  {
    flags: "--gemini-api-key <key>",
    description: "Google Gemini API key",
  },
  {
    flags: "--anthropic-api-key <key>",
    description: "Anthropic API key",
  },
  {
    flags: "--openai-api-key <key>",
    description: "OpenAI API key",
  },
  {
    flags: "--openrouter-api-key <key>",
    description: "OpenRouter API key",
  },
];

export function registerCliOptions(program: Command): Command {
  for (const option of CLI_OPTION_DEFINITIONS) {
    program.option(option.flags, option.description);
  }

  return program;
}

export function resolveConfig(
  args: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const config = convict<ConfigProperties>(configSchema, {
    args,
    env,
  });
  config.validate({ allowed: "strict" });

  return normalizeConfig(config.getProperties());
}

function normalizeConfig(properties: ConfigProperties): AppConfig {
  return {
    model: properties.model,
    concurrency: properties.concurrency,
    retries: properties.retries,
    format: properties.format,
    output: properties.output ?? undefined,
    debug: properties.debug,
    apiKeys: {
      gemini: properties.apiKeys.gemini ?? undefined,
      anthropic: properties.apiKeys.anthropic ?? undefined,
      openai: properties.apiKeys.openai ?? undefined,
      openrouter: properties.apiKeys.openrouter ?? undefined,
    },
  };
}

function nonEmptyString(value: unknown): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("must be a non-empty string");
  }
}

function positiveInteger(value: unknown): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("must be a positive integer");
  }
}
