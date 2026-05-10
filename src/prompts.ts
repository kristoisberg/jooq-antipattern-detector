import { readFileSync } from "node:fs";

import { z } from "zod";

import { DEFAULT_ANTIPATTERN_NAMES } from "./types.js";

export type PromptSet = {
  ddl: string;
  dmlDql: string;
};

export type PromptPack = {
  antipatterns: string[];
  prompts: {
    localisation: PromptSet;
    classification: PromptSet;
  };
};

type PromptPackLoaderDeps = {
  readFileSync: (filePath: string, encoding: BufferEncoding) => string;
};

const defaultPromptPackLoaderDeps: PromptPackLoaderDeps = {
  readFileSync,
};

const LOCALISATION_PROMPTS: PromptSet = {
  ddl: `You are a senior software developer with expertise in Java, jOOQ and SQL. Analyze the provided Java class and check for the following database design antipatterns, as defined by Bill Karwin:

- ID Required: Never identify this issue in classes representing views, as views cannot contain primary keys. If the class represents a table, always detect the antipattern, if the name of the primary key is just "id" (case-insensitive). Also detect the issue if a synthetic primary key column exists, even though another unique constraint exists, which is suitable as a primary key (the constraint is on columns, which are virtually immutable by nature), and which does not complicate foreign keys referencing the table too much. Only include the lines of the primary key column definition in the line range, do not include comments or anything else.
- Keyless Entry: A column, which refers to another table, is missing its foreign key. Never identify this issue in classes representing views, as views cannot contain foreign keys. Only report this issue if the "Keys" class provided at the end contains a primary key that this is appropriate for this column to refer to.
- Rounding Errors: Storing fixed-precision values in floating-point type columns, such as FLOAT and REAL, rather than using fixed-precision types like DECIMAL and NUMERIC.
- 31 Flavors: Specifying allowed values in the column definition, i.e. with a CHECK constraint or an ENUM type, rather than using a lookup table. Only include the lines of the column definition in the line range, do not include comments or anything else. Do not report the issue if the CHECK constraint is used to check the value for emptyness or against a range of values (including greater/lesser than comparisons).
- Fear of the Unknown: A special default value, such as an empty string, is used to mark a missing value, rather than NULL, and the special value does not hold a semantic meaning. A column, which can never be NULL in practice (e.g. it has a default value), is marked as NULLABLE.

For every occurrence, write the \`explanation\` as a user-friendly 1-2 sentence description of why the antipattern is a problem in this specific code and include at least one concrete suggestion for fixing it.

If the file does not contain any antipatterns, leave the list of occurrences empty.

<analyzed_class>
FILE_CONTENTS
</analyzed_class>

<key_definitions_for_reference>
KEYS_CONTENTS
</key_definitions_for_reference>
`,
  dmlDql: `You are a senior software developer with expertise in Java, jOOQ and SQL. Analyze the provided Java class and check for the following SQL query antipatterns, as defined by Bill Karwin:

- Poor Man's Search Engine: Usage of LIKE, ILIKE or regular expressions to perform full-text search. Report the issue if it isn't obvious from the method input parameters, whether the patterns contain wildcards used for full-text search. Do not report the issue if LIKE, ILIKE or regex is used for prefix search. Only include the line(s) where the full-text search condition is created in the line range.
- Implicit Columns: A query fetching all columns from a database table. In addition to obvious violations, report cases where jOOQ fetches all columns of a table into records or generated DAOs (located in a package ending with \`tables.daos\`). Do not report this issue if it occurs within a \`fetchCount\` or \`fetchExists\` call. Only include the line(s) where the blind projection is selected in the line range, do not include the rest of the query.
- Fear of the Unknown: Query logic uses a NULLABLE column in a way that produces incorrect results with NULL. Do not report issues that arise from insufficient null-handling in Java code. Also do not report the issue if you're unsure if the column is NULLABLE.

For every occurrence, write the \`explanation\` as a user-friendly 1-2 sentence description of why the antipattern is a problem in this specific code and include at least one concrete suggestion for fixing it.

Only identify problems in code, which interacts directly with the jOOQ DSL or generated DAOs (located in a package ending with \`tables.daos\`). Do not identify problems in code, which interacts with higher level abstractions. In case of multiple consecutive issues, report them separately, even if they are on consecutive lines. If the file does not contain any antipatterns, leave the list of occurrences empty.

<analyzed_class>
FILE_CONTENTS
</analyzed_class>
`,
};

const CLASSIFICATION_PROMPTS: PromptSet = {
  ddl: `You are a senior software developer with expertise in Java, jOOQ and SQL. Analyze the provided Java class and determine which of the following database design antipatterns, as defined by Bill Karwin, are present:

- ID Required: Never identify this issue in classes representing views, as views cannot contain primary keys. If the class represents a table, always detect the antipattern, if the name of the primary key is just "id" (case-insensitive). Also detect the issue if a synthetic primary key column exists, even though another unique constraint exists, which is suitable as a primary key (the constraint is on columns, which are virtually immutable by nature), and which does not complicate foreign keys referencing the table too much.
- Keyless Entry: A column, which refers to another table, is missing its foreign key. Never identify this issue in classes representing views, as views cannot contain foreign keys. Only report this issue if the "Keys" class provided at the end contains a primary key that this is appropriate for this column to refer to.
- Rounding Errors: Storing fixed-precision values in floating-point type columns, such as FLOAT and REAL, rather than using fixed-precision types like DECIMAL and NUMERIC.
- 31 Flavors: Specifying allowed values in the column definition, i.e. with a CHECK constraint or an ENUM type, rather than using a lookup table. Do not report the issue if the CHECK constraint is used to check the value for emptyness or against a range of values (including greater/lesser than comparisons).
- Fear of the Unknown: A special default value, such as an empty string, is used to mark a missing value, rather than NULL, and the special value does not hold a semantic meaning. A column, which can never be NULL in practice (e.g. it has a default value), is marked as NULLABLE.

Return only the distinct antipattern names present in this file. Do not include locations, code fragments, explanations, or duplicate antipattern names. If the file does not contain any antipatterns, return an empty list.

<analyzed_class>
FILE_CONTENTS
</analyzed_class>

<key_definitions_for_reference>
KEYS_CONTENTS
</key_definitions_for_reference>
`,
  dmlDql: `You are a senior software developer with expertise in Java, jOOQ and SQL. Analyze the provided Java class and determine which of the following SQL query antipatterns, as defined by Bill Karwin, are present:

- Poor Man's Search Engine: Usage of LIKE, ILIKE or regular expressions to perform full-text search. Report the issue if it isn't obvious from the method input parameters, whether the patterns contain wildcards used for full-text search. Do not report the issue if LIKE, ILIKE or regex is used for prefix search.
- Implicit Columns: A query fetching all columns from a database table. In addition to obvious violations, report cases where jOOQ fetches all columns of a table into records or generated DAOs (located in a package ending with \`tables.daos\`). Do not report this issue if it occurs within a \`fetchCount\` or \`fetchExists\` call.
- Fear of the Unknown: Query logic uses a NULLABLE column in a way that produces incorrect results with NULL. Do not report issues that arise from insufficient null-handling in Java code. Also do not report the issue if you're unsure if the column is NULLABLE.

Only identify problems in code, which interacts directly with the jOOQ DSL or generated DAOs (located in a package ending with \`tables.daos\`). Do not identify problems in code, which interacts with higher level abstractions.

Return only the distinct antipattern names present in this file. Do not include locations, code fragments, explanations, or duplicate antipattern names. If the file does not contain any antipatterns, return an empty list.

<analyzed_class>
FILE_CONTENTS
</analyzed_class>
`,
};

export const DEFAULT_PROMPT_PACK: PromptPack = {
  antipatterns: [...DEFAULT_ANTIPATTERN_NAMES],
  prompts: {
    localisation: LOCALISATION_PROMPTS,
    classification: CLASSIFICATION_PROMPTS,
  },
};

export function getPrompts(mode: "localisation" | "classification" = "localisation"): PromptSet {
  return DEFAULT_PROMPT_PACK.prompts[mode];
}

export function loadPromptPack(
  promptsFile: string | undefined,
  deps: PromptPackLoaderDeps = defaultPromptPackLoaderDeps,
): PromptPack {
  if (!promptsFile) {
    return DEFAULT_PROMPT_PACK;
  }

  let contents: string;

  try {
    contents = deps.readFileSync(promptsFile, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to read prompts file at ${promptsFile}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON prompts file at ${promptsFile}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    return promptPackSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      throw new Error(`Invalid prompts file at ${promptsFile}: ${path}${issue?.message ?? "unknown error"}`);
    }

    throw error;
  }
}

const promptSetSchema = z.object({
  ddl: promptTemplateSchema("ddl"),
  dmlDql: promptTemplateSchema("dmlDql"),
});

const promptPackSchema = z
  .object({
    antipatterns: z
      .array(z.string().min(1, { message: "must be a non-empty string" }))
      .min(1, { message: "must contain at least one antipattern" })
      .superRefine((antipatterns, ctx) => {
        const seen = new Set<string>();

        antipatterns.forEach((antipattern, index) => {
          if (seen.has(antipattern)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message: "must be unique",
            });
          }

          seen.add(antipattern);
        });
      }),
    prompts: z.object({
      localisation: promptSetSchema,
      classification: promptSetSchema,
    }),
  })
  .strict();

function promptTemplateSchema(templateName: string): z.ZodType<string> {
  return z
    .string()
    .min(1, { message: "must be a non-empty string" })
    .refine((template) => template.includes("FILE_CONTENTS"), {
      message: `${templateName} must contain FILE_CONTENTS`,
    });
}
