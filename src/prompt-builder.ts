import type { FileCandidate } from "./file-discovery.js";
import type { PromptSet } from "./prompts.js";

export function buildPrompt(candidate: FileCandidate, prompts: PromptSet): string {
  const template = candidate.promptType === "ddl" ? prompts.ddl : prompts.dmlDql;
  const numberedContents = candidate.contents
    .split(/\r?\n/)
    .map((line, index) => `${index + 1}: ${line.trim()}`)
    .join("\n");
  const keysContents = candidate.closestKeysContents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .join("\n");

  return template
    .replace("FILE_CONTENTS", numberedContents)
    .replace("KEYS_CONTENTS", keysContents);
}
