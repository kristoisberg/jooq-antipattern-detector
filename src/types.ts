import { z } from "zod";

export const antipatternNameSchema = z.enum([
  "ID Required",
  "Keyless Entry",
  "Rounding Errors",
  "31 Flavors",
  "Poor Man's Search Engine",
  "Implicit Columns",
  "Beware of the Unknown",
]);

export type AntipatternName = z.infer<typeof antipatternNameSchema>;

export const antipatternOccurrenceSchema = z.object({
  antipatternName: antipatternNameSchema,
  linesRangeStart: z.number().int().positive(),
  linesRangeEnd: z.number().int().positive(),
  codeFragment: z.string(),
  explanation: z.string(),
});

export const localisationAnalysisResponseSchema = z.object({
  occurrences: z.array(antipatternOccurrenceSchema),
});

export const classificationAnalysisResponseSchema = z.object({
  antipatterns: z.array(antipatternNameSchema),
});

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
