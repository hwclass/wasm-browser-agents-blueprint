#!/bin/bash

# Exit on error
set -e

# Make all build scripts executable
chmod +x demos/hello-agent/rust/build.sh
chmod +x demos/hello-agent/go/build.sh
chmod +x demos/hello-agent/python/build.sh
chmod +x demos/hello-agent/js/build.sh

echo "Building all WASM agents..."

# Build Rust agent
echo "Building Rust agent..."
cd demos/hello-agent/rust && ./build.sh
cd ../../..

# Build Go agent
echo "Building Go agent..."
cd demos/hello-agent/go && ./build.sh
cd ../../..

# Build Python agent
echo "Building Python agent..."
cd demos/hello-agent/python && ./build.sh
cd ../../..

# Build JavaScript agent
echo "Building JavaScript agent..."
cd demos/hello-agent/js && ./build.sh
cd ../../..

echo "All agents built successfully!"
echo "Built files are organized in their respective language directories:"
echo "  - Rust: demos/hello-agent/rust/pkg/"
echo "  - Go: demos/hello-agent/go/"
echo "  - Python: demos/hello-agent/python/"
echo "  - JavaScript: demos/hello-agent/js/" 