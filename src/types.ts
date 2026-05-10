import { z } from "zod";

export const DEFAULT_ANTIPATTERN_NAMES = [
  "ID Required",
  "Keyless Entry",
  "Rounding Errors",
  "31 Flavors",
  "Poor Man's Search Engine",
  "Implicit Columns",
  "Fear of the Unknown",
] as const;

export type AntipatternName = string;

export type AnalysisResponseSchemas = ReturnType<typeof createAnalysisResponseSchemas>;

export function createAnalysisResponseSchemas(antipatternNames: readonly string[]) {
  const antipatternNameSchema = z.enum(toNonEmptyTuple(antipatternNames));
  const antipatternOccurrenceSchema = z.object({
    antipatternName: antipatternNameSchema,
    linesRangeStart: z.number().int().positive(),
    linesRangeEnd: z.number().int().positive(),
    codeFragment: z.string(),
    explanation: z.string(),
  });
  const localisationAnalysisResponseSchema = z.object({
    occurrences: z.array(antipatternOccurrenceSchema),
  });
  const classificationAnalysisResponseSchema = z.object({
    antipatterns: z.array(antipatternNameSchema),
  });

  return {
    antipatternNameSchema,
    antipatternOccurrenceSchema,
    localisationAnalysisResponseSchema,
    classificationAnalysisResponseSchema,
  };
}

const defaultAnalysisResponseSchemas = createAnalysisResponseSchemas(DEFAULT_ANTIPATTERN_NAMES);

export const antipatternNameSchema = defaultAnalysisResponseSchemas.antipatternNameSchema;
export const antipatternOccurrenceSchema = defaultAnalysisResponseSchemas.antipatternOccurrenceSchema;
export const localisationAnalysisResponseSchema = defaultAnalysisResponseSchemas.localisationAnalysisResponseSchema;
export const classificationAnalysisResponseSchema = defaultAnalysisResponseSchemas.classificationAnalysisResponseSchema;

export type AntipatternOccurrence = z.infer<typeof antipatternOccurrenceSchema>;
export type LocalisationAnalysisResponse = z.infer<typeof localisationAnalysisResponseSchema>;
export type ClassificationAnalysisResponse = z.infer<typeof classificationAnalysisResponseSchema>;
export type AnalysisUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

type FileAnalysisBase = {
  filePath: string;
  relativePath: string;
  promptType: "ddl" | "dml-dql";
  error?: string;
  usage?: AnalysisUsage;
};

export type LocalisationFileAnalysis = FileAnalysisBase & {
  occurrences: AntipatternOccurrence[];
};

export type ClassificationFileAnalysis = FileAnalysisBase & {
  antipatterns: AntipatternName[];
};

export type FileAnalysis = LocalisationFileAnalysis | ClassificationFileAnalysis;

export type RunSummary = {
  scannedJavaFiles: number;
  applicableFiles: number;
  analyzedFiles: number;
  failedFiles: number;
  filesWithFindings: number;
  totalOccurrences: number;
  distinctAntipatterns: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

function toNonEmptyTuple(values: readonly string[]): [string, ...string[]] {
  if (values.length === 0) {
    throw new Error("At least one antipattern name is required");
  }

  return values as [string, ...string[]];
}
