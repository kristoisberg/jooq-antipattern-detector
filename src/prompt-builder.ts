import type { FileCandidate } from "./file-discovery.js";
import type { PromptSet } from "./prompts.js";

export function buildPrompt(candidate: FileCandidate, prompts: PromptSet): string {
  const template = candidate.promptType === "ddl" ? prompts.ddl : prompts.dmlDql;
  const numberedContents = formatSourceWithLineNumbers(candidate.contents);
  const keysContents = formatKeysContents(candidate.closestKeysContents);

  return template.replace("FILE_CONTENTS", numberedContents).replace("KEYS_CONTENTS", keysContents);
}

export function formatSourceWithLineNumbers(contents: string): string {
  return contents
    .split(/\r?\n/)
    .map((line, index) => `${index + 1}: ${line.trim()}`)
    .join("\n");
}

export function formatKeysContents(contents: string): string {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");
}
