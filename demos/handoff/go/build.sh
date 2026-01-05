#!/bin/bash

# Build Go counter agent to WASM
# Output: counter_go.wasm

set -e

echo "Building Go counter agent..."

# Check for Go installation
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed"
    exit 1
fi

# Build for WebAssembly
GOOS=js GOARCH=wasm go build -o counter_go.wasm

# Create wasm directory if it doesn't exist
mkdir -p ../wasm

# Copy WASM file to demo directory
cp counter_go.wasm ../wasm/counter_go.wasm

# Copy wasm_exec.js runtime support
GOROOT=$(go env GOROOT)
cp "$GOROOT/misc/wasm/wasm_exec.js" ../wasm/wasm_exec.js

echo "✓ Go counter agent built successfully"
echo "  Output: demos/handoff/wasm/counter_go.wasm"
echo "  Runtime: demos/handoff/wasm/wasm_exec.js"
