# GitHub Actions Workflows

This directory contains GitHub Actions workflows for continuous integration and testing.

## Workflows

### `ci.yml` - Continuous Integration

**Triggers:**

- Pull requests to `main` or `develop` branches
- Pushes to `main` branch

**Jobs:**

#### 1. Code Quality

- Runs ESLint to check for code style issues
- Runs TypeScript type checking
- Ensures code meets quality standards

#### 2. Test (Matrix)

- Runs tests on multiple Node.js versions (18.x, 20.x, 22.x)
- Ensures compatibility across Node versions
- Uploads test results as artifacts
- Uses `--reporter=verbose` for detailed output

#### 3. Build

- Builds the application with Vite
- Runs only after quality checks and tests pass
- Uploads build artifacts
- Verifies production build succeeds

#### 4. Coverage

- Runs only on pull requests
- Generates test coverage reports
- Uploads coverage to Codecov (requires `CODECOV_TOKEN` secret)
- Posts coverage summary to PR as comment
- Adds coverage summary to GitHub job summary

**Status Checks:**

- ✅ All jobs must pass for PR to be mergeable
- 🔄 Jobs run in parallel where possible (quality, test matrix)
- ⏱️ Build runs after tests pass

### `test.yml` - Simple Test Runner

**Triggers:**

- Pull requests to `main` or `develop` branches
- Pushes to `main` or `develop` branches

**Jobs:**

#### 1. Test (Matrix)

- Runs tests on Node.js 18.x, 20.x, and 22.x
- Runs linter and type check if scripts exist
- Builds the application
- Simpler alternative to `ci.yml` for basic testing

#### 2. Test Coverage

- Runs only on pull requests
- Generates and uploads coverage reports
- Posts coverage to PR

## Configuration

### Required Secrets

#### Optional:

- `CODECOV_TOKEN` - For uploading coverage to Codecov (optional, public repos don't need it)

### Node.js Versions

The workflows test against:

- **Node 18.x** - LTS (Active)
- **Node 20.x** - LTS (Recommended)
- **Node 22.x** - Current

Update the matrix in both workflows if you need different versions:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]
```

### Branch Protection

Recommended branch protection rules for `main`:

1. **Require status checks to pass:**

   - Code Quality
   - Test (Node 18.x, 20.x, 22.x)
   - Build

2. **Require branches to be up to date:**

   - Enabled

3. **Require linear history:**

   - Enabled (optional)

4. **Include administrators:**
   - Enabled

## Package Manager

The workflows use **pnpm** for faster and more efficient dependency management:

```yaml
- name: Install pnpm
  uses: pnpm/action-setup@v3
  with:
    version: 8

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: "20.x"
    cache: "pnpm" # Cache pnpm store
```

**Benefits of pnpm:**

- Faster installation (shared dependency store)
- Less disk space usage
- Strict dependency resolution
- Better monorepo support

## Scripts

The workflows use these scripts:

```json
{
  "scripts": {
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "build": "vite build"
  }
}
```

### Test Command

Tests run with these flags:

- `--run` - Run tests once (don't watch)
- `--reporter=verbose` - Detailed test output
- `--coverage` - Generate coverage reports (coverage job only)

## Artifacts

### Test Results

- **Name:** `test-results-node-{version}`
- **Path:** `test-results/`
- **Retention:** 7 days
- **Contains:** Test output and results

### Build Artifacts

- **Name:** `build-artifacts`
- **Path:** `dist/`
- **Retention:** 7 days
- **Contains:** Production build files

## Coverage Reporting

### Codecov Integration

Coverage is automatically uploaded to Codecov on pull requests. To enable:

1. Sign up at [codecov.io](https://codecov.io)
2. Connect your GitHub repository
3. Add `CODECOV_TOKEN` to repository secrets (optional for public repos)

### Coverage Comment

The workflow automatically posts a coverage report as a PR comment using `lcov-reporter-action`. It shows:

- Overall coverage percentage
- Coverage changes compared to base branch
- Line-by-line coverage for changed files

### Coverage Summary

The workflow adds a coverage summary to the GitHub Actions job summary, showing:

- Statement coverage
- Branch coverage
- Function coverage
- Line coverage

## Local Testing

Run the same checks locally before pushing:

```bash
# Type check
pnpm run type-check

# Lint
pnpm run lint

# Run tests
pnpm test -- --run

# Run tests with coverage
pnpm test -- --run --coverage

# Build
pnpm run build
```

## Troubleshooting

### Tests Failing in CI but Pass Locally

1. **Node version mismatch**

   - Check your local Node version: `node --version`
   - Ensure it matches one of the CI versions

2. **Dependencies not locked**

   - Commit `pnpm-lock.yaml`
   - Run `pnpm install --frozen-lockfile` locally

3. **Environment differences**
   - CI runs on Ubuntu Linux
   - Check for OS-specific code or paths

### Build Failing

1. **TypeScript errors**

   - Run `npm run type-check` locally
   - Fix any type errors

2. **Missing dependencies**

   - Ensure all dependencies are in `package.json`
   - Run `npm ci` to verify

3. **Environment variables**
   - CI doesn't have access to `.env` files
   - Use GitHub secrets for sensitive values

### Coverage Upload Failing

1. **Missing CODECOV_TOKEN**

   - Add token to repository secrets
   - Or set `fail_ci_if_error: false` in workflow

2. **Coverage files not generated**
   - Ensure tests run successfully
   - Check that `coverage/` directory exists

## Performance

### Optimization Tips

1. **Cache Dependencies**

   - Workflows use `cache: 'pnpm'` for faster installs
   - pnpm store is automatically cached by GitHub
   - Significantly faster than npm due to content-addressable storage

2. **Parallel Jobs**

   - Test matrix runs in parallel
   - Quality checks run independently

3. **Fail Fast**

   - Set `fail-fast: false` to see all failures
   - Set `fail-fast: true` to stop on first failure

4. **Conditional Jobs**
   - Coverage only runs on PRs
   - Saves CI minutes on direct pushes

## Best Practices

1. **Keep workflows fast**

   - Current setup runs in ~2-3 minutes
   - Consider splitting very large test suites

2. **Test on multiple Node versions**

   - Ensures compatibility
   - Catches version-specific bugs

3. **Require status checks**

   - Don't merge failing PRs
   - Set up branch protection

4. **Monitor CI usage**

   - GitHub provides free minutes for public repos
   - Private repos have usage limits

5. **Keep workflows updated**
   - Update action versions regularly
   - Test with latest Node LTS versions

## Monitoring

### View Workflow Runs

1. Go to **Actions** tab in your repository
2. Select a workflow (CI, Test)
3. Click on a specific run to see details
4. View logs for each job

### Check Status Badges

Add status badges to your README:

```markdown
![CI](https://github.com/username/repo/workflows/CI/badge.svg)
![Test](https://github.com/username/repo/workflows/Test/badge.svg)
```

### Email Notifications

GitHub sends email notifications for:

- Failed workflow runs on your branches
- Failed runs on repositories you watch
- Configure in GitHub settings

## Future Improvements

Potential enhancements:

1. **Deployment workflow**

   - Auto-deploy on merge to main
   - Deploy previews for PRs

2. **Release workflow**

   - Automatic versioning
   - Changelog generation
   - npm package publishing

3. **Dependency updates**

   - Dependabot or Renovate
   - Automated PR for updates

4. **Performance testing**

   - Lighthouse CI
   - Bundle size checks

5. **Visual regression testing**

   - Percy or Chromatic
   - Screenshot comparison

6. **Security scanning**
   - CodeQL
   - npm audit
   - Snyk integration
