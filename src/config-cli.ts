import type { Command } from "commander";

import {
  API_KEY_OPTIONS,
  CONFIG_FIELDS,
  CONFIG_FILE_OPTION,
  type CliOverrides,
  type ConfigProperties,
  type NullableModelApiKeys,
} from "./config-schema.js";

export function registerCliOptions(program: Command): Command {
  program.option(CONFIG_FILE_OPTION.flags, CONFIG_FILE_OPTION.description);

  for (const field of CONFIG_FIELDS) {
    program.option(field.flags, field.description);
  }

  for (const option of API_KEY_OPTIONS) {
    program.option(`${option.cliFlag} <key>`, option.description);
  }

  return program;
}

export function getCliOverrides(options: Record<string, unknown>): CliOverrides {
  const overrides: CliOverrides = {};

  for (const field of CONFIG_FIELDS) {
    const value = options[field.key];

    if (value !== undefined) {
      setConfigProperty(overrides, field.key, normalizeCliValue(value, field.kind) as ConfigProperties[typeof field.key]);
    }
  }

  const configFile = options[CONFIG_FILE_OPTION.optionName];

  if (typeof configFile === "string" && configFile.length > 0) {
    overrides.configFile = configFile;
  }

  for (const option of API_KEY_OPTIONS) {
    const value = options[option.optionName];

    if (typeof value === "string" && value.length > 0) {
      setApiKey(overrides, option.key, value);
    }
  }

  return overrides;
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

function normalizeCliValue(value: unknown, kind: "string" | "number" | "boolean"): unknown {
  if (kind === "number" && typeof value === "string") {
    return Number.parseFloat(value);
  }

  return value;
}
