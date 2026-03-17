type RawCliOptions = {
  directory?: string;
  model?: string;
  concurrency?: number;
  retries?: number;
  format?: string;
  output?: string;
  debug?: boolean;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
};

export type ResolvedConfig = {
  directory: string;
  model: string;
  concurrency: number;
  retries: number;
  format: "text" | "json";
  output?: string;
  debug: boolean;
  apiKeys: {
    gemini?: string;
    anthropic?: string;
    openai?: string;
    openrouter?: string;
  };
};

const DEFAULTS = {
  model: "google:gemini-2.5-pro",
  concurrency: 8,
  retries: 2,
  format: "text" as const,
  debug: false,
};

const ENV_NAMES = {
  directory: "SQL_ANTIPATTERN_DETECTOR_DIRECTORY",
  model: "SQL_ANTIPATTERN_DETECTOR_MODEL",
  concurrency: "SQL_ANTIPATTERN_DETECTOR_CONCURRENCY",
  retries: "SQL_ANTIPATTERN_DETECTOR_RETRIES",
  format: "SQL_ANTIPATTERN_DETECTOR_FORMAT",
  output: "SQL_ANTIPATTERN_DETECTOR_OUTPUT",
  debug: "SQL_ANTIPATTERN_DETECTOR_DEBUG",
  geminiApiKey: "GEMINI_API_KEY",
  anthropicApiKey: "ANTHROPIC_API_KEY",
  openaiApiKey: "OPENAI_API_KEY",
  openrouterApiKey: "OPENROUTER_API_KEY",
} as const;

export function resolveConfig(options: RawCliOptions): ResolvedConfig {
  return {
    directory: resolveRequiredString(options.directory, ENV_NAMES.directory, "directory"),
    model: resolveString(options.model, ENV_NAMES.model, DEFAULTS.model),
    concurrency: resolvePositiveInteger(options.concurrency, ENV_NAMES.concurrency, DEFAULTS.concurrency),
    retries: resolvePositiveInteger(options.retries, ENV_NAMES.retries, DEFAULTS.retries),
    format: normalizeFormat(resolveString(options.format, ENV_NAMES.format, DEFAULTS.format)),
    output: resolveOptionalString(options.output, ENV_NAMES.output),
    debug: resolveBoolean(options.debug, ENV_NAMES.debug, DEFAULTS.debug),
    apiKeys: {
      gemini: resolveOptionalString(options.geminiApiKey, ENV_NAMES.geminiApiKey),
      anthropic: resolveOptionalString(options.anthropicApiKey, ENV_NAMES.anthropicApiKey),
      openai: resolveOptionalString(options.openaiApiKey, ENV_NAMES.openaiApiKey),
      openrouter: resolveOptionalString(options.openrouterApiKey, ENV_NAMES.openrouterApiKey),
    },
  };
}

export function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, received "${value}".`);
  }
  return parsed;
}

function resolveRequiredString(
  cliValue: string | undefined,
  envName: string,
  label: string,
): string {
  const resolved = resolveOptionalString(cliValue, envName);
  if (resolved) {
    return resolved;
  }

  throw new Error(
    `Missing required ${label}. Provide it as a CLI argument or set ${envName}.`,
  );
}

function resolveString(cliValue: string | undefined, envName: string, defaultValue: string): string {
  return resolveOptionalString(cliValue, envName) ?? defaultValue;
}

function resolveOptionalString(cliValue: string | undefined, envName: string): string | undefined {
  const cliCandidate = normalizeString(cliValue);
  if (cliCandidate) {
    return cliCandidate;
  }

  return normalizeString(process.env[envName]);
}

function resolvePositiveInteger(
  cliValue: number | undefined,
  envName: string,
  defaultValue: number,
): number {
  if (cliValue !== undefined) {
    return cliValue;
  }

  const envValue = normalizeString(process.env[envName]);
  return envValue ? parseInteger(envValue) : defaultValue;
}

function resolveBoolean(cliValue: boolean | undefined, envName: string, defaultValue: boolean): boolean {
  if (cliValue !== undefined) {
    return cliValue;
  }

  const envValue = normalizeString(process.env[envName]);
  return envValue ? parseBoolean(envValue, envName) : defaultValue;
}

function parseBoolean(value: string, envName: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`Expected ${envName} to be a boolean, received "${value}".`);
}

function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeFormat(value: string): "text" | "json" {
  if (value === "text" || value === "json") {
    return value;
  }

  throw new Error(`Unsupported format "${value}". Use "text" or "json".`);
}
