# ESLint TypeScript Review Checklist

This project-owned supplement supplies the reference named by the upstream skill entrypoint.
It is not an additional activation signal. Apply the active project profile, routing gate,
`.codex/rules/eslint_typescript.md` and `eslint-typescript` before using it.

## Configuration and scope

- Read the complete applicable ESLint configuration, package scripts, dependency versions and TypeScript configs.
- Verify that file patterns cover the intended TypeScript and Vue SFC scope without including generated output.
- Match runtime globals to the affected browser or Node.js files; do not broaden globals to suppress a finding.
- Preserve the existing Vue parser and plugin integration rather than replacing it with generic TypeScript config.
- Check whether type-aware linting is already configured; do not enable it by implication.
- Keep exceptions narrow and supported by the actual code or platform contract.

## Formatting and execution

- Keep the project's Prettier conflict-resolution configuration after the relevant lint presets.
- Use only commands declared by `CODEX_PROJECT.md` or package scripts.
- Distinguish a check from a write: `--fix-dry-run` does not edit source but an output option still writes a report.
- Run the required check against the relevant stable snapshot; record the actual exit status and findings.
- Report unavailable tools or version/configuration mismatches without installing dependencies automatically.
- Do not infer clean TypeScript types, successful builds or passing tests solely from ESLint success.
