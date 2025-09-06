#!/bin/bash

# Format script for the entire project
set -e

echo "🎨 Formatting entire project..."

# Format Rust code
echo "📦 Formatting Rust code..."
if command -v cargo &> /dev/null && [ -d "server-rs" ]; then
    cd server-rs
    cargo fmt
    cd ..
    echo "✅ Rust code formatted"
else
    echo "⚠️  Cargo not found or server-rs directory missing, skipping Rust formatting"
fi

# Format TypeScript/JavaScript/JSON/HTML/CSS with Prettier
echo "🌐 Formatting web code (TypeScript, JavaScript, JSON, HTML, CSS)..."
if command -v npx &> /dev/null; then
    # Format web directory
    if [ -d "web" ]; then
        cd web
        if [ -f "package.json" ]; then
            npm run format 2>/dev/null || npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,html,css,scss}"
        fi
        cd ..
    fi

    # Format root level files
    npx prettier --write "*.{json,md,yml,yaml}" 2>/dev/null || echo "⚠️  Some files couldn't be formatted with Prettier"
    echo "✅ Web code formatted"
else
    echo "⚠️  npx not found, skipping Prettier formatting"
fi

# Format YAML files
echo "📄 Formatting YAML files..."
if command -v prettier &> /dev/null; then
    find . -name "*.yml" -o -name "*.yaml" | grep -v node_modules | grep -v target | xargs prettier --write 2>/dev/null || echo "⚠️  Some YAML files couldn't be formatted"
    echo "✅ YAML files formatted"
fi

# Format shell scripts
echo "🐚 Formatting shell scripts..."
if command -v shfmt &> /dev/null; then
    find . -name "*.sh" -print0 | xargs -0 shfmt -i 2 -w 2>/dev/null || echo "⚠️  Some shell scripts couldn't be formatted (install shfmt for better formatting)"
    echo "✅ Shell scripts formatted"
else
    echo "⚠️  shfmt not found, skipping shell script formatting (install with: go install mvdan.cc/sh/v3/cmd/shfmt@latest)"
fi

echo "🎉 Project formatting complete!"
