Generate or update the `report.md` file for the most recently executed tests.

1. Identify which test files were last run (check git status, recent bash history, or ask).
2. Re-run the tests if no recent output is available.
3. Create/overwrite `report.md` **in the same directory as the test files**.

Use this template:

```markdown
# Test Report

| Field | Value |
|-------|-------|
| **Last Run** | <YYYY-MM-DD HH:MM:SS UTC> |
| **Command** | `<command>` |
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

<Detail each failure with error message, or "None.">

## Observations

<Brief notes on test quality, flaky tests, missing coverage, suggestions.>
```

Rules:
- Replace file content entirely (never append).
- One line per test in the Results table.
- Include coverage % if available.
- Place report.md alongside the test files (e.g., `tests/auth/report.md`).
