#!/bin/bash

# Installation script for pre-commit hooks
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up pre-commit hooks...${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ This is not a git repository. Please run this script from the root of your git repository.${NC}"
    exit 1
fi

# Install using pre-commit tool if available
if command -v pre-commit >/dev/null 2>&1; then
    echo -e "${BLUE}📦 Installing pre-commit hooks using pre-commit tool...${NC}"

    # Install the hooks
    if pre-commit install; then
        echo -e "${GREEN}✅ Pre-commit hooks installed successfully using pre-commit tool${NC}"

        # Run pre-commit on all files to initialize
        echo -e "${BLUE}🧹 Running pre-commit on all files to initialize...${NC}"
        pre-commit run --all-files || {
            echo -e "${YELLOW}⚠️  Some initial checks failed, but that's normal for the first run${NC}"
        }

        echo -e "${GREEN}🎉 Pre-commit setup complete!${NC}"
        echo -e "${BLUE}ℹ️  From now on, your code will be automatically checked and formatted before each commit.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Pre-commit tool installation failed, falling back to manual installation...${NC}"
    fi
fi

# Manual installation as fallback
echo -e "${BLUE}📋 Installing custom pre-commit hook manually...${NC}"

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy our custom pre-commit script
if [ -f ".git-hooks/pre-commit" ]; then
    cp .git-hooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo -e "${GREEN}✅ Custom pre-commit hook installed successfully${NC}"
else
    echo -e "${RED}❌ Pre-commit script not found at .git-hooks/pre-commit${NC}"
    exit 1
fi

# Install required tools
echo -e "${BLUE}📦 Checking and installing required tools...${NC}"

# Check for required tools and provide installation instructions
MISSING_TOOLS=()

if ! command -v cargo >/dev/null 2>&1; then
    MISSING_TOOLS+=("cargo (Rust toolchain)")
fi

if ! command -v npm >/dev/null 2>&1; then
    MISSING_TOOLS+=("npm (Node.js)")
fi

if ! command -v npx >/dev/null 2>&1; then
    MISSING_TOOLS+=("npx (Node.js)")
fi

# Optional tools
if ! command -v shfmt >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  shfmt not found. Shell script formatting will be limited.${NC}"
    echo -e "${BLUE}ℹ️  Install with: go install mvdan.cc/sh/v3/cmd/shfmt@latest${NC}"
fi

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required tools:${NC}"
    for tool in "${MISSING_TOOLS[@]}"; do
        echo -e "${RED}   - $tool${NC}"
    done
    echo -e "${BLUE}ℹ️  Please install the missing tools and run this script again.${NC}"
    exit 1
fi

# Install npm dependencies if needed
if [ -f "web/package.json" ]; then
    echo -e "${BLUE}📦 Installing web dependencies...${NC}"
    cd web
    npm install
    cd ..
fi

# Test the pre-commit hook
echo -e "${BLUE}🧪 Testing pre-commit hook...${NC}"
if .git/hooks/pre-commit --version >/dev/null 2>&1 || true; then
    echo -e "${GREEN}✅ Pre-commit hook is working${NC}"
else
    echo -e "${YELLOW}⚠️  Pre-commit hook test completed (warnings are normal)${NC}"
fi

echo -e "${GREEN}🎉 Pre-commit setup complete!${NC}"
echo -e "${BLUE}ℹ️  Your code will now be automatically checked and formatted before each commit.${NC}"
echo -e "${BLUE}ℹ️  To run checks manually: ./format.sh${NC}"
echo -e "${BLUE}ℹ️  To skip pre-commit checks (not recommended): git commit --no-verify${NC}"
