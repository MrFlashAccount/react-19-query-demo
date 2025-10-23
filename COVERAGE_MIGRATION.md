# Coverage Migration from Codecov to Vitest GitHub Reporter

## Summary

Migrated from Codecov to Vitest's built-in GitHub coverage reporter for better integration and reduced dependency on external services.

## Changes Made

### 1. Package Dependencies

**File: `package.json`**

- Added `@vitest/coverage-v8` v4.0.1 to devDependencies

### 2. Vitest Configuration

**File: `vitest.config.ts`**

- Added coverage configuration with v8 provider
- Configured reporters: text, json, html, json-summary
- Defined coverage include/exclude patterns
- Excluded test files, test directories, and setup files from coverage

### 3. CI Workflows

#### File: `.github/workflows/ci.yml`

- Replaced Codecov action with `davelosert/vitest-coverage-report-action@v2`
- Added `permissions` section for pull request writing
- Updated test command to include GitHub Actions reporter
- Removed Codecov token requirement
- Removed `romeovs/lcov-reporter-action` (no longer needed)
- Removed custom coverage summary generation (handled by Vitest action)

#### File: `.github/workflows/test.yml`

- Same changes as ci.yml for consistency
- Replaced Codecov integration with Vitest coverage report action

## Benefits

1. **Native Integration**: Uses Vitest's built-in coverage tools
2. **No External Service**: No dependency on Codecov or tokens
3. **PR Comments**: Automatically posts coverage reports to PRs
4. **Simpler Setup**: Fewer steps and dependencies
5. **Consistent Experience**: Same tool for local and CI coverage

## Coverage Command

Run coverage locally:

```bash
npm test -- --run --coverage
```

Run with GitHub Actions reporter (for CI):

```bash
npm test -- --run --coverage --reporter=default --reporter=github-actions
```

## Coverage Configuration

Coverage includes:

- All TypeScript/TSX files in `src/`

Coverage excludes:

- Test files (`*.test.{ts,tsx}`)
- Test directories (`__tests__`)
- Test setup files (`src/test/`)
- Entry point (`src/main.tsx`)
- Type definitions (`src/vite-env.d.ts`)

## Output Files

Coverage generates:

- `coverage/coverage-final.json` - Detailed coverage data
- `coverage/coverage-summary.json` - Summary statistics
- `coverage/index.html` - HTML report (viewable in browser)
- `coverage/` directory with detailed file-by-file reports
