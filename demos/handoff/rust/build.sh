#!/bin/bash

# Build Rust counter agent to WASM
# Output: pkg/counter_rust_bg.wasm

set -e

echo "Building Rust counter agent..."

# Check for wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build for web target
wasm-pack build --target web --release

# Create wasm directory if it doesn't exist
mkdir -p ../wasm

# Copy WASM file to demo directory
cp pkg/counter_rust_bg.wasm ../wasm/counter_rust.wasm

echo "✓ Rust counter agent built successfully"
echo "  Output: demos/handoff/wasm/counter_rust.wasm"
