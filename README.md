# jOOQ Antipattern Detector

LLM-backed command line tool for detecting SQL antipatterns in Java projects that use jOOQ.

## What it does

- Recursively scans a directory for `.java` files.
- Filters files with the same jOOQ-oriented inclusion and exclusion heuristics used in the notebook.
- Classifies each candidate as DDL-style or DML/DQL-style analysis.
- Finds the closest generated `Keys` class and injects it into the prompt when available.
- Uses an AI SDK model with structured output validation to report antipattern occurrences.
- Supports `localisation` mode for occurrence-level findings and `classification` mode for per-file antipattern classification.
- Produces text, JSON, or CSV output.

The tool intentionally does not implement the notebook's accuracy calculation because the input directory can be any arbitrary project.

## Supported providers

Use a model name with one of these prefixes:

- `google:` uses `GEMINI_API_KEY`
- `anthropic:` uses `ANTHROPIC_API_KEY`
- `openai:` uses `OPENAI_API_KEY`
- `openrouter:` uses `OPENROUTER_API_KEY`

Examples:

```bash
jooq-antipattern-detector ./my-project --model anthropic:claude-opus-4-5
jooq-antipattern-detector ./my-project --model anthropic:claude-3-7-sonnet-latest
jooq-antipattern-detector ./my-project --model openai:gpt-4.1
jooq-antipattern-detector ./my-project --model openrouter:openai/gpt-4.1
```

API keys can be provided either as CLI options or environment variables:

- `--gemini-api-key` or `GEMINI_API_KEY`
- `--anthropic-api-key` or `ANTHROPIC_API_KEY`
- `--openai-api-key` or `OPENAI_API_KEY`
- `--openrouter-api-key` or `OPENROUTER_API_KEY`

## Install dependencies

```bash
bun install
```

## Development

```bash
bun run format
bun run lint
bun run check
```

To run the full verification flow:

```bash
bun run check:all
```

## Run

```bash
bun run src/cli.ts ./path/to/project
```

Useful options:

```bash
bun run src/cli.ts ./path/to/project --config-file ./detector.yml
bun run src/cli.ts ./path/to/project --format json
bun run src/cli.ts ./path/to/project --format csv
bun run src/cli.ts ./path/to/project --output reports/findings.json --format json
bun run src/cli.ts ./path/to/project --temperature 0.2
bun run src/cli.ts ./path/to/project --model openai:o3-mini --thinking-effort high
bun run src/cli.ts ./path/to/project --max-prompt-chars 150000
bun run src/cli.ts ./path/to/project --prompts-file ./prompt-pack.json
bun run src/cli.ts ./path/to/project --mode classification --format csv
bun run src/cli.ts ./path/to/project --concurrency 4 --retries 3 --debug
```

All option-style configuration parameters support the same precedence:

```text
CLI parameter -> environment variable -> YAML config file -> default
```

Configuration file lookup:

- explicit path from `--config-file <file>`
- otherwise `~/.jooq-antipattern-detector.yml` if it exists

Example YAML config:

```yaml
model: openai:gpt-4.1
mode: localisation
concurrency: 4
retries: 3
temperature: 0.0
thinkingEffort: high
maxPromptChars: 150000
promptsFile: ./prompt-pack.json
format: json
output: reports/findings.json
debug: false
apiKeys:
  openai: your-api-key
```

Environment variables:

- `JOOQ_ANTIPATTERN_DETECTOR_MODEL`
- `JOOQ_ANTIPATTERN_DETECTOR_MODE`
- `JOOQ_ANTIPATTERN_DETECTOR_CONCURRENCY`
- `JOOQ_ANTIPATTERN_DETECTOR_RETRIES`
- `JOOQ_ANTIPATTERN_DETECTOR_TEMPERATURE`
- `JOOQ_ANTIPATTERN_DETECTOR_THINKING_EFFORT`
- `JOOQ_ANTIPATTERN_DETECTOR_MAX_PROMPT_CHARS`
- `JOOQ_ANTIPATTERN_DETECTOR_PROMPTS_FILE`
- `JOOQ_ANTIPATTERN_DETECTOR_FORMAT`
- `JOOQ_ANTIPATTERN_DETECTOR_OUTPUT`
- `JOOQ_ANTIPATTERN_DETECTOR_DEBUG`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`

Examples:

```bash
JOOQ_ANTIPATTERN_DETECTOR_FORMAT=json JOOQ_ANTIPATTERN_DETECTOR_OUTPUT=reports/findings.json bun run src/cli.ts ./path/to/project
ANTHROPIC_API_KEY=... bun run src/cli.ts ./path/to/project --model anthropic:claude-opus-4-5
OPENROUTER_API_KEY=... bun run src/cli.ts ./path/to/project --model openrouter:openai/gpt-4.1
```

`thinking-effort` accepts `none`, `minimal`, `low`, `medium`, `high`, or `xhigh`. It is forwarded for `openai:` and `openrouter:` models.

`max-prompt-chars` sets a hard cap on prompt size per file. When omitted, the tool uses a conservative automatic budget based on the configured model when it recognizes the model family, and otherwise falls back to a default cap.

`mode` accepts `localisation` or `classification`. `localisation` is the default and keeps the current occurrence-level behavior. `classification` returns only the distinct antipattern types present in each file.

`prompts-file` points to a JSON prompt pack. When omitted, the embedded default prompts are used, so native binary distribution remains self-contained. A custom prompt pack fully replaces the embedded prompts and controls the antipattern names accepted in model output.

Example prompt pack:

```json
{
  "antipatterns": ["Custom Pattern"],
  "prompts": {
    "localisation": {
      "ddl": "Analyze this DDL-oriented Java class for Custom Pattern.\n\n<analyzed_class>\nFILE_CONTENTS\n</analyzed_class>\n\n<key_definitions_for_reference>\nKEYS_CONTENTS\n</key_definitions_for_reference>",
      "dmlDql": "Analyze this query-oriented Java class for Custom Pattern.\n\n<analyzed_class>\nFILE_CONTENTS\n</analyzed_class>"
    },
    "classification": {
      "ddl": "Return only the distinct custom antipattern names present in this DDL-oriented Java class.\n\n<analyzed_class>\nFILE_CONTENTS\n</analyzed_class>\n\n<key_definitions_for_reference>\nKEYS_CONTENTS\n</key_definitions_for_reference>",
      "dmlDql": "Return only the distinct custom antipattern names present in this query-oriented Java class.\n\n<analyzed_class>\nFILE_CONTENTS\n</analyzed_class>"
    }
  }
}
```

The `antipatterns` list must contain at least one unique non-empty name. All four templates are required and must contain `FILE_CONTENTS`; `KEYS_CONTENTS` is optional. Model responses are validated against the configured names, so unknown antipattern names are rejected and retried like other structured-output validation failures.

## Build a native binary

```bash
bun run build:native
```

Output: `dist/jooq-antipattern-detector`

## Output formats

JSON output contains:

- `rootDirectory`
- `model`
- `mode`
- `generatedAt`
- `results`
- `summary`

The `summary` object includes aggregate counts such as total findings and distinct antipatterns found. In `classification` mode, `totalOccurrences` represents the sum of distinct antipattern types reported across files.

Each result includes:

- `filePath`
- `relativePath`
- `promptType`
- `occurrences` in `localisation` mode
- `antipatterns` in `classification` mode
- `usage`

CSV output contains:

- one row per antipattern occurrence in `localisation` mode with columns `Project`, `Antipattern`, `File`, `Line from`, `Line to`, `Code fragment`, `Explanation`
- one row per `(file, antipattern)` pair in `classification` mode with columns `Project`, `Antipattern`, `File`
