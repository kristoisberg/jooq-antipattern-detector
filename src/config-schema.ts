import path from "node:path";

import { z } from "zod";

import { PROVIDER_DEFINITIONS, type ModelApiKeys } from "./providers.js";

export type OutputFormat = "text" | "json" | "csv";
export type ThinkingEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type AnalysisMode = "localisation" | "classification";

export type AppConfig = {
  model: string;
  mode: AnalysisMode;
  concurrency: number;
  retries: number;
  temperature: number;
  thinkingEffort: ThinkingEffort;
  maxPromptChars?: number;
  format: OutputFormat;
  output?: string;
  debug: boolean;
  apiKeys: ModelApiKeys;
};

export type NullableModelApiKeys = {
  [Key in keyof ModelApiKeys]-?: string | null;
};

export type ConfigProperties = Omit<AppConfig, "output" | "apiKeys"> & {
  output?: string;
  apiKeys?: Partial<NullableModelApiKeys>;
};

type OptionKind = "string" | "number" | "boolean";

export type ConfigFieldDefinition<Key extends keyof Omit<AppConfig, "apiKeys">> = {
  key: Key;
  flags: string;
  description: string;
  env: string;
  kind: OptionKind;
  default: AppConfig[Key];
  schema: z.ZodType<AppConfig[Key]>;
};

export type ApiKeyOptionDefinition = {
  key: keyof ModelApiKeys;
  cliFlag: string;
  description: string;
  env: string;
  optionName: string;
};

export type ConfigFileOptionDefinition = {
  flags: string;
  description: string;
  optionName: string;
};

export type CliOverrides = Partial<ConfigProperties> & {
  configFile?: string;
};

const analysisModeValues = ["localisation", "classification"] as const satisfies readonly AnalysisMode[];
const thinkingEffortValues = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const satisfies readonly ThinkingEffort[];
const outputFormatValues = ["text", "json", "csv"] as const satisfies readonly OutputFormat[];

const nonEmptyStringSchema = z.string().min(1, { message: "must be a non-empty string" });
const positiveIntegerSchema = z.number().int().min(1, { message: "must be a positive integer" });
const finiteNumberSchema = z.number().finite({ message: "must be a finite number" });

export const CONFIG_FIELDS = [
  {
    key: "model",
    flags: "--model <model>",
    description:
      'Model identifier. Must use an explicit provider prefix: "google:", "anthropic:", "openai:", or "openrouter:".',
    env: "JOOQ_ANTIPATTERN_DETECTOR_MODEL",
    kind: "string",
    default: "anthropic:claude-opus-4-5",
    schema: nonEmptyStringSchema,
  },
  {
    key: "mode",
    flags: "--mode <mode>",
    description:
      'Analysis mode: "localisation" for occurrence-level findings or "classification" for distinct antipattern types per file',
    env: "JOOQ_ANTIPATTERN_DETECTOR_MODE",
    kind: "string",
    default: "localisation",
    schema: z.enum(analysisModeValues),
  },
  {
    key: "concurrency",
    flags: "--concurrency <number>",
    description: "Number of files to analyze concurrently",
    env: "JOOQ_ANTIPATTERN_DETECTOR_CONCURRENCY",
    kind: "number",
    default: 8,
    schema: positiveIntegerSchema,
  },
  {
    key: "retries",
    flags: "--retries <number>",
    description: "Retries per file on transient model failures",
    env: "JOOQ_ANTIPATTERN_DETECTOR_RETRIES",
    kind: "number",
    default: 2,
    schema: positiveIntegerSchema,
  },
  {
    key: "temperature",
    flags: "--temperature <number>",
    description: "Model sampling temperature",
    env: "JOOQ_ANTIPATTERN_DETECTOR_TEMPERATURE",
    kind: "number",
    default: 0.0,
    schema: finiteNumberSchema,
  },
  {
    key: "thinkingEffort",
    flags: "--thinking-effort <effort>",
    description: "Thinking effort for supported reasoning models: none, minimal, low, medium, high, or xhigh",
    env: "JOOQ_ANTIPATTERN_DETECTOR_THINKING_EFFORT",
    kind: "string",
    default: "none",
    schema: z.enum(thinkingEffortValues),
  },
  {
    key: "maxPromptChars",
    flags: "--max-prompt-chars <number>",
    description: "Maximum prompt characters per analyzed file; defaults to an automatic model-aware budget",
    env: "JOOQ_ANTIPATTERN_DETECTOR_MAX_PROMPT_CHARS",
    kind: "number",
    default: undefined,
    schema: positiveIntegerSchema.optional(),
  },
  {
    key: "format",
    flags: "--format <format>",
    description: "Output format: text, json, or csv",
    env: "JOOQ_ANTIPATTERN_DETECTOR_FORMAT",
    kind: "string",
    default: "text",
    schema: z.enum(outputFormatValues),
  },
  {
    key: "output",
    flags: "--output <file>",
    description: "Write output to a file instead of stdout",
    env: "JOOQ_ANTIPATTERN_DETECTOR_OUTPUT",
    kind: "string",
    default: undefined,
    schema: nonEmptyStringSchema.optional(),
  },
  {
    key: "debug",
    flags: "--debug",
    description: "Print per-file progress and retries to stderr",
    env: "JOOQ_ANTIPATTERN_DETECTOR_DEBUG",
    kind: "boolean",
    default: false,
    schema: z.boolean(),
  },
] as const satisfies readonly ConfigFieldDefinition<keyof Omit<AppConfig, "apiKeys">>[];

export const API_KEY_OPTIONS = PROVIDER_DEFINITIONS.map((provider) => ({
  key: provider.apiKeyField,
  cliFlag: provider.cliFlag,
  description: provider.apiKeyDescription,
  env: provider.envName,
  optionName: toOptionName(provider.cliFlag),
})) as readonly ApiKeyOptionDefinition[];

export const CONFIG_FILE_OPTION: ConfigFileOptionDefinition = {
  flags: "--config-file <file>",
  description: "Load configuration values from a YAML file",
  optionName: "configFile",
};

const apiKeysSchema = z
  .object({
    gemini: nonEmptyStringSchema.nullable().optional(),
    anthropic: nonEmptyStringSchema.nullable().optional(),
    openai: nonEmptyStringSchema.nullable().optional(),
    openrouter: nonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const configFieldSchemaShape = Object.fromEntries(CONFIG_FIELDS.map((field) => [field.key, field.schema])) as Record<
  keyof Omit<AppConfig, "apiKeys">,
  z.ZodTypeAny
>;

export const configSchema = z
  .object({
    ...configFieldSchemaShape,
    apiKeys: apiKeysSchema.default({}),
  })
  .strict();

export const partialConfigSchema = configSchema.deepPartial();

export const defaultConfig = {
  ...Object.fromEntries(CONFIG_FIELDS.map((field) => [field.key, normalizeDefaultValue(field.key, field.default)])),
  apiKeys: {},
} as AppConfig;

function normalizeDefaultValue(key: string, value: unknown): unknown {
  if (key === "output" && typeof value === "string") {
    return path.resolve(value);
  }

  return value;
}

function toOptionName(flag: string): string {
  return flag
    .slice(2)
    .split("-")
    .map((segment, index) => (index === 0 ? segment : `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`))
    .join("");
}
