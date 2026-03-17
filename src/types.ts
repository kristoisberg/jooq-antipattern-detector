import { z } from "zod";

export const antipatternNameSchema = z.enum([
  "ID Required",
  "Keyless Entry",
  "Rounding Errors",
  "31 Flavors",
  "Poor Man’s Search Engine",
  "Implicit Columns",
  "Beware of the Unknown",
]);

export const antipatternOccurrenceSchema = z.object({
  antipatternName: antipatternNameSchema,
  linesRangeStart: z.number().int().positive(),
  linesRangeEnd: z.number().int().positive(),
  codeFragment: z.string(),
  reasoning: z.string(),
});

export const analysisResponseSchema = z.object({
  occurrences: z.array(antipatternOccurrenceSchema),
});

export type AntipatternOccurrence = z.infer<typeof antipatternOccurrenceSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;

export type FileAnalysis = {
  filePath: string;
  relativePath: string;
  promptType: "ddl" | "dml-dql";
  occurrences: AntipatternOccurrence[];
  error?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export type RunSummary = {
  scannedJavaFiles: number;
  applicableFiles: number;
  analyzedFiles: number;
  failedFiles: number;
  filesWithFindings: number;
  totalOccurrences: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};
