#!/bin/bash

# Exit on error
set -e

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed. Please install Go 1.18 or higher."
    exit 1
fi

# Set GOOS and GOARCH for WebAssembly
export GOOS=js
export GOARCH=wasm

# Build the WASM module
echo "Building Go WASM agent..."
go build -o main.wasm

# Copy the WebAssembly support JavaScript file
mkdir -p ../../dist/go
cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" ../../dist/go/
cp main.wasm ../../dist/go/

echo "Go WASM agent built successfully!" 