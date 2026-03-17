# SQL Antipattern Detector

LLM-backed command line tool for detecting SQL antipatterns in Java projects that use jOOQ. The detection flow is based on the logic in [`08-test-prompting-strategy.ipynb`](/home/kristo/detecty-thingy/08-test-prompting-strategy.ipynb), [`ddl.md`](/home/kristo/detecty-thingy/ddl.md), and [`dml-dql.md`](/home/kristo/detecty-thingy/dml-dql.md).

## What it does

- Recursively scans a directory for `.java` files.
- Filters files with the same jOOQ-oriented inclusion and exclusion heuristics used in the notebook.
- Classifies each candidate as DDL-style or DML/DQL-style analysis.
- Finds the closest generated `Keys` class and injects it into the prompt when available.
- Uses an AI SDK model with structured output validation to report antipattern occurrences.
- Produces either human-readable text or JSON.

The tool intentionally does not implement the notebook's accuracy calculation because the input directory can be any arbitrary project.

## Supported providers

Use a model name with one of these prefixes:

- `google:` uses `GEMINI_API_KEY`
- `anthropic:` uses `ANTHROPIC_API_KEY`
- `openai:` uses `OPENAI_API_KEY`
- `openrouter:` uses `OPENROUTER_API_KEY`

Examples:

```bash
sql-antipattern-detector ./my-project --model google:gemini-2.5-pro
sql-antipattern-detector ./my-project --model anthropic:claude-3-7-sonnet-latest
sql-antipattern-detector ./my-project --model openai:gpt-4.1
sql-antipattern-detector ./my-project --model openrouter:openai/gpt-4.1
```

If no prefix is provided, the CLI infers one from the model name:

- `gemini*` -> Google
- `claude*` -> Anthropic
- everything else -> OpenAI

API keys can be provided either as CLI options or environment variables:

- `--gemini-api-key` or `GEMINI_API_KEY`
- `--anthropic-api-key` or `ANTHROPIC_API_KEY`
- `--openai-api-key` or `OPENAI_API_KEY`
- `--openrouter-api-key` or `OPENROUTER_API_KEY`

## Install dependencies

```bash
bun install
```

## Run

```bash
bun run src/cli.ts ./path/to/project
```

Useful options:

```bash
bun run src/cli.ts ./path/to/project --format json
bun run src/cli.ts ./path/to/project --output reports/findings.json --format json
bun run src/cli.ts ./path/to/project --concurrency 4 --retries 3 --debug
```

Every configuration parameter supports the same precedence:

```text
CLI parameter -> environment variable -> default
```

Environment variables:

- `SQL_ANTIPATTERN_DETECTOR_DIRECTORY`
- `SQL_ANTIPATTERN_DETECTOR_MODEL`
- `SQL_ANTIPATTERN_DETECTOR_CONCURRENCY`
- `SQL_ANTIPATTERN_DETECTOR_RETRIES`
- `SQL_ANTIPATTERN_DETECTOR_FORMAT`
- `SQL_ANTIPATTERN_DETECTOR_OUTPUT`
- `SQL_ANTIPATTERN_DETECTOR_DEBUG`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`

Examples:

```bash
SQL_ANTIPATTERN_DETECTOR_DIRECTORY=./path/to/project bun run src/cli.ts
SQL_ANTIPATTERN_DETECTOR_FORMAT=json SQL_ANTIPATTERN_DETECTOR_OUTPUT=reports/findings.json bun run src/cli.ts
GEMINI_API_KEY=... bun run src/cli.ts ./path/to/project --model google:gemini-2.5-pro
OPENROUTER_API_KEY=... bun run src/cli.ts ./path/to/project --model openrouter:openai/gpt-4.1
```

## Build a native binary

```bash
bun run build:native
```

This produces:

```text
dist/sql-antipattern-detector
```

## Output shape

JSON output contains:

- `rootDirectory`
- `model`
- `generatedAt`
- `results`
- `summary`

Each result includes:

- `filePath`
- `relativePath`
- `promptType`
- `occurrences`
- `usage`
