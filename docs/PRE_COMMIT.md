# Pre-commit Hooks Setup

This project uses pre-commit hooks to automatically format and validate code before commits.

## What happens on commit?

When you run `git commit`, the following checks and formatting will be applied automatically:

### 🦀 Rust Code

- **Auto-format** with `cargo fmt`
- **Check** for compilation errors with `cargo check`

### 🌐 TypeScript/JavaScript

- **Auto-format** with Prettier
- **Type check** with TypeScript compiler

### 📄 Other Files

- **Auto-format** JSON, YAML, Markdown, CSS with Prettier
- **Validate** file syntax
- **Fix** line endings and trailing whitespace

### 🐚 Shell Scripts

- **Lint** with ShellCheck

## Installation

The pre-commit hooks are automatically installed when you clone the repository. If they're not working, run:

```bash
make setup-hooks
```

Or manually:

```bash
pre-commit install
```

## Manual Usage

### Format all files

```bash
make format
# or
./format.sh
```

### Check formatting without fixing

```bash
make format-check
```

### Run pre-commit checks manually

```bash
make pre-commit
# or
pre-commit run --all-files
```

### Run specific hooks

```bash
pre-commit run cargo-fmt
pre-commit run prettier
pre-commit run typescript-check
```

## Skipping Hooks (Not Recommended)

If you need to skip the pre-commit hooks for a specific commit:

```bash
git commit --no-verify -m "emergency fix"
```

## Configuration Files

- `.pre-commit-config.yaml` - Pre-commit configuration
- `.prettierrc` - Prettier formatting rules
- `.markdownlint.json` - Markdown linting rules
- `.yamllint.yml` - YAML linting rules
- `.editorconfig` - Editor configuration
- `server-rs/rustfmt.toml` - Rust formatting configuration

## Tools Used

- **pre-commit** - Git hook management
- **Prettier** - JavaScript/TypeScript/JSON/YAML/Markdown formatting
- **cargo fmt** - Rust formatting
- **TypeScript** - Type checking
- **ShellCheck** - Shell script linting

## Troubleshooting

### Pre-commit hooks not running

```bash
# Check if hooks are installed
ls -la .git/hooks/

# Reinstall hooks
pre-commit uninstall
pre-commit install
```

### Formatting tools not found

```bash
# Install missing tools
make setup
```

### Slow first run

The first time pre-commit runs, it needs to download and install environments for each hook. This is normal and subsequent runs will be much faster.

### Failed checks

If pre-commit fails, it will show you what's wrong. Fix the issues and commit again. In most cases, auto-formatting will fix the issues for you automatically.
