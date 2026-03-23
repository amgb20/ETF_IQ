#!/usr/bin/env node
/**
 * PostToolUse hook — detects test command execution in Bash
 * and instructs Claude to generate/update a report.md alongside the test files.
 *
 * Input (stdin):  JSON with tool_name, tool_input, tool_result
 * Output (stdout): JSON with additionalContext (or empty for no-op)
 */

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  let raw;
  try {
    raw = await readStdin();
  } catch {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  // Only act on Bash tool
  if (input.tool_name !== "Bash") process.exit(0);

  const command = (input.tool_input && input.tool_input.command) || "";

  // Match common test runner commands
  const TEST_PATTERNS = [
    /\bpytest\b/,
    /python\s+-m\s+pytest\b/,
    /\bnpm\s+test\b/,
    /\bnpm\s+run\s+test\b/,
    /\bnpx\s+(jest|vitest|mocha|playwright)\b/,
    /\bgo\s+test\b/,
    /\bcargo\s+test\b/,
    /\bphpunit\b/,
    /\bphp\s+artisan\s+test\b/,
    /\bdotnet\s+test\b/,
    /\brunittest\b/,
    /\bnose2?\b/,
  ];

  const isTestCommand = TEST_PATTERNS.some((p) => p.test(command));
  if (!isTestCommand) process.exit(0);

  // Build timestamp
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");

  const response = {
    additionalContext: `[TEST REPORT] A test command just ran (\`${command}\`).

**You MUST now generate or update a \`report.md\` in the same directory as the test files that were executed.**

Use this exact template — fill in from the test output above:

\`\`\`markdown
# Test Report

| Field | Value |
|-------|-------|
| **Last Run** | ${ts} |
| **Command** | \`<the command>\` |
| **Status** | <PASS / FAIL / PARTIAL> |
| **Passed** | <N> |
| **Failed** | <N> |
| **Skipped** | <N> |
| **Coverage** | <N% or N/A> |

## Results

| Test | Status | Notes |
|------|--------|-------|
| ... | PASS/FAIL/SKIP | ... |

## Failures

<If any failures, list each with the error message. If all passed, write "None.">

## Observations

<Brief notes: flaky tests, missing coverage, suggestions.>
\`\`\`

Rules:
- **Replace** the entire file content (do not append).
- If coverage data is in the output, include the coverage %.
- Keep it concise — one line per test in the Results table.
- The report.md goes in the **test directory** (e.g. \`tests/auth/report.md\`, not the project root).`,
  };

  console.log(JSON.stringify(response));
}

main();
