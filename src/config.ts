import convict from "convict";
import type { Command } from "commander";

import { PROVIDER_DEFINITIONS, type ModelApiKeys } from "./providers.js";

export type OutputFormat = "text" | "json" | "csv";

export type AppConfig = {
  model: string;
  concurrency: number;
  retries: number;
  format: OutputFormat;
  output?: string;
  debug: boolean;
  apiKeys: ModelApiKeys;
};

type NullableModelApiKeys = {
  [Key in keyof ModelApiKeys]-?: string | null;
};

type ConfigProperties = Omit<AppConfig, "output" | "apiKeys"> & {
  output: string | null;
  apiKeys: NullableModelApiKeys;
};

type ConvictPropertyDefinition<Value> = {
  doc: string;
  format: Value[] | StringConstructor | BooleanConstructor | ((value: unknown) => void);
  default: Value;
  env?: string;
  arg: string;
  nullable?: boolean;
  sensitive?: boolean;
};

type OptionDefinition<Value> = {
  flags: string;
  description: string;
  schema: ConvictPropertyDefinition<Value>;
};

const OPTION_DEFINITIONS = {
  model: {
    flags: "--model <model>",
    description:
      'Model identifier. Must use an explicit provider prefix: "google:", "anthropic:", "openai:", or "openrouter:".',
    schema: {
      doc: 'Model identifier. Must use an explicit provider prefix: "google:", "anthropic:", "openai:", or "openrouter:".',
      format: nonEmptyString,
      default: "google:gemini-2.5-pro",
      env: "SQL_ANTIPATTERN_DETECTOR_MODEL",
      arg: "model",
    },
  },
  concurrency: {
    flags: "--concurrency <number>",
    description: "Number of files to analyze concurrently",
    schema: {
      doc: "Number of files to analyze concurrently",
      format: positiveInteger,
      default: 8,
      env: "SQL_ANTIPATTERN_DETECTOR_CONCURRENCY",
      arg: "concurrency",
    },
  },
  retries: {
    flags: "--retries <number>",
    description: "Retries per file on transient model failures",
    schema: {
      doc: "Retries per file on transient model failures",
      format: positiveInteger,
      default: 2,
      env: "SQL_ANTIPATTERN_DETECTOR_RETRIES",
      arg: "retries",
    },
  },
  format: {
    flags: "--format <format>",
    description: "Output format: text, json, or csv",
    schema: {
      doc: "Output format",
      format: ["text", "json", "csv"] as OutputFormat[],
      default: "text" as OutputFormat,
      env: "SQL_ANTIPATTERN_DETECTOR_FORMAT",
      arg: "format",
    },
  },
  output: {
    flags: "--output <file>",
    description: "Write output to a file instead of stdout",
    schema: {
      doc: "Write output to a file instead of stdout",
      format: String,
      default: null as string | null,
      nullable: true,
      env: "SQL_ANTIPATTERN_DETECTOR_OUTPUT",
      arg: "output",
    },
  },
  debug: {
    flags: "--debug",
    description: "Print per-file progress and retries to stderr",
    schema: {
      doc: "Print per-file progress and retries to stderr",
      format: Boolean,
      default: false,
      env: "SQL_ANTIPATTERN_DETECTOR_DEBUG",
      arg: "debug",
    },
  },
} as const satisfies Record<string, OptionDefinition<unknown>>;

const apiKeyOptionDefinitions = PROVIDER_DEFINITIONS.map((provider) => ({
  flags: `${provider.cliFlag} <key>`,
  description: provider.apiKeyDescription,
  schema: {
    doc: provider.apiKeyDescription,
    format: String,
    default: null as string | null,
    nullable: true,
    env: provider.envName,
    arg: provider.cliFlag.slice(2),
    sensitive: true,
  } satisfies ConvictPropertyDefinition<string | null>,
  apiKeyField: provider.apiKeyField,
}));

const apiKeyConfigSchema = Object.fromEntries(
  apiKeyOptionDefinitions.map((option) => [option.apiKeyField, option.schema]),
) as unknown as convict.Schema<NullableModelApiKeys>;

const configSchema: convict.Schema<ConfigProperties> = {
  model: OPTION_DEFINITIONS.model.schema,
  concurrency: OPTION_DEFINITIONS.concurrency.schema,
  retries: OPTION_DEFINITIONS.retries.schema,
  format: OPTION_DEFINITIONS.format.schema,
  output: OPTION_DEFINITIONS.output.schema,
  debug: OPTION_DEFINITIONS.debug.schema,
  apiKeys: apiKeyConfigSchema,
};

const CLI_OPTION_DEFINITIONS = [
  ...Object.values(OPTION_DEFINITIONS).map(({ flags, description }) => ({ flags, description })),
  ...apiKeyOptionDefinitions.map(({ flags, description }) => ({ flags, description })),
];

export function registerCliOptions(program: Command): Command {
  for (const option of CLI_OPTION_DEFINITIONS) {
    program.option(option.flags, option.description);
  }

  return program;
}

export function resolveConfig(args: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): AppConfig {
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
    apiKeys: Object.fromEntries(
      Object.entries(properties.apiKeys).map(([key, value]) => [key, value ?? undefined]),
    ) as ModelApiKeys,
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
