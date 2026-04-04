import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { z } from "zod";

import {
  API_KEY_OPTIONS,
  CONFIG_FIELDS,
  defaultConfig,
  partialConfigSchema,
  configSchema,
  type AppConfig,
  type CliOverrides,
  type ConfigProperties,
  type NullableModelApiKeys,
} from "./config-schema.js";
import type { ModelApiKeys } from "./providers.js";

type ResolveConfigDependencies = {
  existsSync: (filePath: string) => boolean;
  readFileSync: (filePath: string, encoding: BufferEncoding) => string;
  homedir: () => string;
};

type ConfigFileResolution = {
  path: string;
  explicit: boolean;
};

const defaultResolveConfigDependencies: ResolveConfigDependencies = {
  existsSync,
  readFileSync,
  homedir,
};

export function resolveConfig(
  cliOverrides: CliOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
  deps: ResolveConfigDependencies = defaultResolveConfigDependencies,
): AppConfig {
  const normalizedCliOverrides = parseCliOverrides(cliOverrides);
  const envOverrides = parseEnvironmentOverrides(env);
  const configFile = resolveConfigFile(normalizedCliOverrides.configFile, deps);
  const fileOverrides = loadConfigFile(configFile, deps);
  const { configFile: _configFile, ...configOverrides } = normalizedCliOverrides;

  return parseConfig(mergeConfigLayers(defaultConfig, fileOverrides, envOverrides, configOverrides));
}

function parseCliOverrides(cliOverrides: CliOverrides): CliOverrides {
  const { configFile, ...configOverrides } = cliOverrides;
  const parsedConfigOverrides = parsePartialConfig(configOverrides);

  return {
    ...parsedConfigOverrides,
    ...(configFile ? { configFile } : {}),
  };
}

function parseEnvironmentOverrides(env: NodeJS.ProcessEnv): Partial<ConfigProperties> {
  const overrides: Partial<ConfigProperties> = {};

  for (const field of CONFIG_FIELDS) {
    const rawValue = env[field.env];

    if (rawValue === undefined) {
      continue;
    }

    setConfigProperty(overrides, field.key, parseEnvValue(rawValue, field.kind));
  }

  for (const option of API_KEY_OPTIONS) {
    const rawValue = env[option.env];

    if (rawValue === undefined) {
      continue;
    }

    setApiKey(overrides, option.key, rawValue);
  }

  return parsePartialConfig(overrides);
}

function resolveConfigFile(cliConfigFile: string | undefined, deps: ResolveConfigDependencies): ConfigFileResolution {
  if (cliConfigFile) {
    return {
      path: path.resolve(cliConfigFile),
      explicit: true,
    };
  }

  return {
    path: path.join(deps.homedir(), ".sql-antipattern-detector.yml"),
    explicit: false,
  };
}

function loadConfigFile(
  configFile: ConfigFileResolution,
  deps: ResolveConfigDependencies,
): Partial<ConfigProperties> | null {
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

  try {
    return parseConfigFileConfig(Bun.YAML.parse(contents));
  } catch (error) {
    if (error instanceof Error && error.message === "Config file must contain a YAML mapping") {
      throw new Error(`${error.message}: ${configFile.path}`);
    }

    if (error instanceof Error && error.message.startsWith("Invalid configuration:")) {
      throw error;
    }

    throw new Error(
      `Failed to parse YAML config file at ${configFile.path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseConfigFileConfig(value: unknown): Partial<ConfigProperties> | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Config file must contain a YAML mapping");
  }

  return parsePartialConfig(value);
}

function parsePartialConfig(value: unknown): Partial<ConfigProperties> {
  return parseWithSchema(partialConfigSchema, normalizeOutputPathInConfig(value));
}

function parseConfig(value: unknown): AppConfig {
  const parsed = parseWithSchema(configSchema, normalizeOutputPathInConfig(value)) as ConfigProperties & {
    apiKeys: Partial<NullableModelApiKeys>;
  };

  return {
    ...parsed,
    apiKeys: normalizeApiKeys(parsed.apiKeys),
  } as AppConfig;
}

function normalizeApiKeys(apiKeys: Partial<NullableModelApiKeys>): ModelApiKeys {
  return Object.fromEntries(Object.entries(apiKeys).filter(([, value]) => value != null)) as ModelApiKeys;
}

function mergeConfigLayers(...layers: Array<Partial<ConfigProperties> | AppConfig | null>): ConfigProperties {
  const merged: ConfigProperties = {
    ...defaultConfig,
    apiKeys: { ...defaultConfig.apiKeys },
  };

  for (const layer of layers) {
    if (!layer) {
      continue;
    }

    const { apiKeys, ...rest } = layer;
    Object.assign(merged, rest);

    if (apiKeys) {
      merged.apiKeys = {
        ...merged.apiKeys,
        ...apiKeys,
      };
    }
  }

  return merged;
}

function normalizeOutputPathInConfig(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  if (!("output" in value)) {
    return value;
  }

  const outputValue = (value as { output?: unknown }).output;

  if (typeof outputValue !== "string" || outputValue.length === 0) {
    return value;
  }

  return {
    ...value,
    output: path.resolve(outputValue),
  };
}

function parseEnvValue(rawValue: string, kind: "string" | "number" | "boolean"): string | number | boolean {
  if (kind === "number") {
    return Number.parseFloat(rawValue);
  }

  if (kind === "boolean") {
    if (rawValue === "true") {
      return true;
    }

    if (rawValue === "false") {
      return false;
    }

    throw new Error("must be one of: true, false");
  }

  return rawValue;
}

function parseWithSchema<Schema extends z.ZodTypeAny>(schema: Schema, value: unknown): z.infer<Schema> {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  throw new Error(`Invalid configuration: ${result.error.issues[0]?.message ?? "unknown error"}`);
}

function setConfigProperty<Key extends keyof ConfigProperties>(
  overrides: Partial<ConfigProperties>,
  propertyName: Key,
  value: ConfigProperties[Key],
): void {
  overrides[propertyName] = value;
}

function setApiKey(overrides: Partial<ConfigProperties>, apiKeyField: keyof NullableModelApiKeys, value: string): void {
  const apiKeys = overrides.apiKeys ?? {};
  apiKeys[apiKeyField] = value;
  overrides.apiKeys = apiKeys;
}
