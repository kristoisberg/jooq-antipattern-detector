import type { FileCandidate } from "./file-discovery.js";
import type { PromptSet } from "./prompts.js";

const FILE_CONTENTS_PLACEHOLDER = "FILE_CONTENTS";
const KEYS_CONTENTS_PLACEHOLDER = "KEYS_CONTENTS";

export function buildPrompt(candidate: FileCandidate, prompts: PromptSet, maxPromptChars?: number): string {
  const template = candidate.promptType === "ddl" ? prompts.ddl : prompts.dmlDql;
  const numberedContents = formatSourceWithLineNumbers(candidate.contents);
  const keysContents = formatKeysContents(candidate.closestKeysContents);

  if (maxPromptChars === undefined) {
    return template
      .replace(FILE_CONTENTS_PLACEHOLDER, numberedContents)
      .replace(KEYS_CONTENTS_PLACEHOLDER, keysContents);
  }

  return buildTruncatedPrompt(template, numberedContents, keysContents, maxPromptChars);
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

function buildTruncatedPrompt(
  template: string,
  numberedContents: string,
  keysContents: string,
  maxPromptChars: number,
): string {
  const templateWithoutSource = template.replace(FILE_CONTENTS_PLACEHOLDER, "").replace(KEYS_CONTENTS_PLACEHOLDER, "");

  if (templateWithoutSource.length >= maxPromptChars) {
    return templateWithoutSource.slice(0, maxPromptChars);
  }

  const sourceBudget = Math.max(0, maxPromptChars - templateWithoutSource.length);
  const truncatedSource = truncateNumberedSource(numberedContents, sourceBudget);
  const keysBudget = Math.max(0, maxPromptChars - templateWithoutSource.length - truncatedSource.length);
  const truncatedKeys = truncatePlainText(keysContents, keysBudget);

  return template.replace(FILE_CONTENTS_PLACEHOLDER, truncatedSource).replace(KEYS_CONTENTS_PLACEHOLDER, truncatedKeys);
}

function truncateNumberedSource(numberedContents: string, maxChars: number): string {
  if (numberedContents.length <= maxChars) {
    return numberedContents;
  }

  if (maxChars <= 0) {
    return "";
  }

  const lines = numberedContents.split("\n");

  if (lines.length <= 1) {
    return numberedContents.slice(0, maxChars);
  }

  let best = truncatePlainText(numberedContents, maxChars);

  for (let headCount = 1; headCount < lines.length; headCount += 1) {
    const omittedLines = lines.length - headCount;
    const omissionMarker = `... [${omittedLines} lines omitted due to prompt size] ...`;
    const candidate = [...lines.slice(0, headCount), omissionMarker].join("\n");

    if (candidate.length > maxChars) {
      continue;
    }

    best = candidate;
  }

  return best;
}

function truncatePlainText(contents: string, maxChars: number): string {
  if (contents.length <= maxChars) {
    return contents;
  }

  if (maxChars <= 0) {
    return "";
  }

  if (maxChars <= 3) {
    return contents.slice(0, maxChars);
  }

  return `${contents.slice(0, maxChars - 3)}...`;
}
