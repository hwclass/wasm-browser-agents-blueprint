#!/bin/bash

# Exit on error
set -e

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build the WASM agent
echo "Building Rust WASM agent..."
wasm-pack build --target web

echo "Rust WASM agent built successfully!"
echo "Generated files are in pkg/ directory" 