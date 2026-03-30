import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import convict from "convict";
import type { Command } from "commander";

import { PROVIDER_DEFINITIONS, type ModelApiKeys } from "./providers.js";

export type OutputFormat = "text" | "json" | "csv";
export type ThinkingEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
export type AnalysisMode = "localisation" | "classification";

export type AppConfig = {
  model: string;
  mode: AnalysisMode;
  concurrency: number;
  retries: number;
  thinkingEffort: ThinkingEffort;
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

type ConfigFileOptionDefinition = {
  flags: string;
  description: string;
  env: string;
  arg: string;
};

type ResolveConfigDependencies = {
  existsSync: (filePath: string) => boolean;
  readFileSync: (filePath: string, encoding: BufferEncoding) => string;
  homedir: () => string;
};

type ConfigFileResolution = {
  path: string;
  explicit: boolean;
};

const OPTION_DEFINITIONS = {
  model: {
    flags: "--model <model>",
    description:
      'Model identifier. Must use an explicit provider prefix: "google:", "anthropic:", "openai:", or "openrouter:".',
    schema: {
      doc: 'Model identifier. Must use an explicit provider prefix: "google:", "anthropic:", "openai:", or "openrouter:".',
      format: nonEmptyString,
      default: "anthropic:claude-opus-4-5",
      env: "SQL_ANTIPATTERN_DETECTOR_MODEL",
      arg: "model",
    },
  },
  mode: {
    flags: "--mode <mode>",
    description:
      'Analysis mode: "localisation" for occurrence-level findings or "classification" for distinct antipattern types per file',
    schema: {
      doc: 'Analysis mode: "localisation" for occurrence-level findings or "classification" for distinct antipattern types per file',
      format: ["localisation", "classification"] as AnalysisMode[],
      default: "localisation" as AnalysisMode,
      env: "SQL_ANTIPATTERN_DETECTOR_MODE",
      arg: "mode",
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
  thinkingEffort: {
    flags: "--thinking-effort <effort>",
    description: "Thinking effort for supported reasoning models: none, minimal, low, medium, high, or xhigh",
    schema: {
      doc: "Thinking effort for supported reasoning models",
      format: ["none", "minimal", "low", "medium", "high", "xhigh"] as ThinkingEffort[],
      default: "none" as ThinkingEffort,
      env: "SQL_ANTIPATTERN_DETECTOR_THINKING_EFFORT",
      arg: "thinking-effort",
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

const CONFIG_FILE_OPTION: ConfigFileOptionDefinition = {
  flags: "--config-file <file>",
  description: "Load configuration values from a YAML file",
  env: "SQL_ANTIPATTERN_DETECTOR_CONFIG_FILE",
  arg: "config-file",
};

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
  mode: OPTION_DEFINITIONS.mode.schema,
  concurrency: OPTION_DEFINITIONS.concurrency.schema,
  retries: OPTION_DEFINITIONS.retries.schema,
  thinkingEffort: OPTION_DEFINITIONS.thinkingEffort.schema,
  format: OPTION_DEFINITIONS.format.schema,
  output: OPTION_DEFINITIONS.output.schema,
  debug: OPTION_DEFINITIONS.debug.schema,
  apiKeys: apiKeyConfigSchema,
};

const CLI_OPTION_DEFINITIONS = [
  { flags: CONFIG_FILE_OPTION.flags, description: CONFIG_FILE_OPTION.description },
  ...Object.values(OPTION_DEFINITIONS).map(({ flags, description }) => ({ flags, description })),
  ...apiKeyOptionDefinitions.map(({ flags, description }) => ({ flags, description })),
];

const defaultResolveConfigDependencies: ResolveConfigDependencies = {
  existsSync,
  readFileSync,
  homedir,
};

export function registerCliOptions(program: Command): Command {
  for (const option of CLI_OPTION_DEFINITIONS) {
    program.option(option.flags, option.description);
  }

  return program;
}

export function resolveConfig(
  args: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  deps: ResolveConfigDependencies = defaultResolveConfigDependencies,
): AppConfig {
  const cliOverrides = parseCliOverrides(args);
  const envOverrides = parseEnvironmentOverrides(env);
  const configFile = resolveConfigFile(args, env, deps);
  const fileOverrides = loadConfigFile(configFile, deps);
  const config = convict<ConfigProperties>(configSchema, {
    env: {},
    args: [],
  });

  if (fileOverrides) {
    config.load(fileOverrides);
  }

  config.load(envOverrides);
  config.load(cliOverrides);
  config.validate({ allowed: "strict" });

  return normalizeConfig(config.getProperties());
}

function normalizeConfig(properties: ConfigProperties): AppConfig {
  return {
    model: properties.model,
    mode: properties.mode,
    concurrency: properties.concurrency,
    retries: properties.retries,
    thinkingEffort: properties.thinkingEffort,
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

function parseCliOverrides(args: string[]): Partial<ConfigProperties> {
  const overrides: Partial<ConfigProperties> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const { flag, inlineValue } = splitFlagToken(token);

    if (flag === `--${CONFIG_FILE_OPTION.arg}`) {
      index += consumeOptionValue(flag, inlineValue, args, index).consumedArgs;
      continue;
    }

    const mainEntry = Object.entries(OPTION_DEFINITIONS).find(([, option]) => option.schema.arg === flag.slice(2));

    if (mainEntry) {
      const [propertyName, option] = mainEntry;
      const { value, consumedArgs } = consumeCliValue(flag, inlineValue, option.schema, args, index);
      setConfigProperty(
        overrides,
        propertyName as keyof ConfigProperties,
        value as ConfigProperties[keyof ConfigProperties],
      );
      index += consumedArgs;
      continue;
    }

    const apiKeyEntry = apiKeyOptionDefinitions.find((option) => option.schema.arg === flag.slice(2));

    if (apiKeyEntry) {
      const { value, consumedArgs } = consumeCliValue(flag, inlineValue, apiKeyEntry.schema, args, index);
      setApiKey(overrides, apiKeyEntry.apiKeyField, value as string | null);
      index += consumedArgs;
    }
  }

  return overrides;
}

function parseEnvironmentOverrides(env: NodeJS.ProcessEnv): Partial<ConfigProperties> {
  const overrides: Partial<ConfigProperties> = {};

  for (const [propertyName, option] of Object.entries(OPTION_DEFINITIONS)) {
    if (!option.schema.env) {
      continue;
    }

    const rawValue = env[option.schema.env];

    if (rawValue === undefined) {
      continue;
    }

    setConfigProperty(
      overrides,
      propertyName as keyof ConfigProperties,
      parseStringValue(rawValue, option.schema) as ConfigProperties[keyof ConfigProperties],
    );
  }

  for (const option of apiKeyOptionDefinitions) {
    const rawValue = env[option.schema.env];

    if (rawValue === undefined) {
      continue;
    }

    setApiKey(overrides, option.apiKeyField, parseStringValue(rawValue, option.schema) as string | null);
  }

  return overrides;
}

function resolveConfigFile(
  args: string[],
  env: NodeJS.ProcessEnv,
  deps: ResolveConfigDependencies,
): ConfigFileResolution | null {
  const cliPath = parseConfigFileCliValue(args);

  if (cliPath) {
    return {
      path: path.resolve(cliPath),
      explicit: true,
    };
  }

  const envPath = env[CONFIG_FILE_OPTION.env];

  if (envPath) {
    return {
      path: path.resolve(envPath),
      explicit: true,
    };
  }

  const defaultPath = path.join(deps.homedir(), ".sql-antipattern-detector.yml");

  return {
    path: defaultPath,
    explicit: false,
  };
}

function loadConfigFile(
  configFile: ConfigFileResolution | null,
  deps: ResolveConfigDependencies,
): Partial<ConfigProperties> | null {
  if (!configFile) {
    return null;
  }

  if (!deps.existsSync(configFile.path)) {
    if (configFile.explicit) {
      throw new Error(`Config file does not exist: ${configFile.path}`);
    }

    return null;
  }

  let contents: string;

  try {
    contents = deps.readFileSync(configFile.path, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read config file at ${configFile.path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let parsed: unknown;

  try {
    parsed = Bun.YAML.parse(contents);
  } catch (error) {
    throw new Error(
      `Failed to parse YAML config file at ${configFile.path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (parsed == null) {
    return null;
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Config file must contain a YAML mapping: ${configFile.path}`);
  }

  return parsed as Partial<ConfigProperties>;
}

function parseConfigFileCliValue(args: string[]): string | null {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const { flag, inlineValue } = splitFlagToken(token);

    if (flag !== `--${CONFIG_FILE_OPTION.arg}`) {
      continue;
    }

    return consumeOptionValue(flag, inlineValue, args, index).value;
  }

  return null;
}

function consumeCliValue(
  flag: string,
  inlineValue: string | undefined,
  schema: ConvictPropertyDefinition<unknown>,
  args: string[],
  index: number,
): { value: unknown; consumedArgs: number } {
  if (schema.format === Boolean) {
    const nextToken = args[index + 1];

    if (inlineValue !== undefined) {
      return {
        value: parseBoolean(inlineValue),
        consumedArgs: 0,
      };
    }

    if (nextToken === "true" || nextToken === "false") {
      return {
        value: parseBoolean(nextToken),
        consumedArgs: 1,
      };
    }

    return {
      value: true,
      consumedArgs: 0,
    };
  }

  const { value, consumedArgs } = consumeOptionValue(flag, inlineValue, args, index);

  return {
    value: parseStringValue(value, schema),
    consumedArgs,
  };
}

function consumeOptionValue(
  flag: string,
  inlineValue: string | undefined,
  args: string[],
  index: number,
): { value: string; consumedArgs: number } {
  if (inlineValue !== undefined) {
    return {
      value: inlineValue,
      consumedArgs: 0,
    };
  }

  const nextToken = args[index + 1];

  if (nextToken === undefined || nextToken.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return {
    value: nextToken,
    consumedArgs: 1,
  };
}

function splitFlagToken(token: string): { flag: string; inlineValue: string | undefined } {
  const separatorIndex = token.indexOf("=");

  if (separatorIndex === -1) {
    return {
      flag: token,
      inlineValue: undefined,
    };
  }

  return {
    flag: token.slice(0, separatorIndex),
    inlineValue: token.slice(separatorIndex + 1),
  };
}

function parseStringValue(rawValue: string, schema: ConvictPropertyDefinition<unknown>): unknown {
  if (schema.format === Boolean) {
    return parseBoolean(rawValue);
  }

  if (schema.format === positiveInteger) {
    return Number.parseInt(rawValue, 10);
  }

  return rawValue;
}

function parseBoolean(value: string): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("must be one of: true, false");
}

function setConfigProperty<Key extends keyof ConfigProperties>(
  overrides: Partial<ConfigProperties>,
  propertyName: Key,
  value: ConfigProperties[Key],
): void {
  overrides[propertyName] = value;
}

function setApiKey(
  overrides: Partial<ConfigProperties>,
  apiKeyField: keyof NullableModelApiKeys,
  value: string | null,
): void {
  const apiKeys = (overrides.apiKeys ?? {}) as Partial<NullableModelApiKeys>;

  apiKeys[apiKeyField] = value;
  overrides.apiKeys = apiKeys as NullableModelApiKeys;
}
