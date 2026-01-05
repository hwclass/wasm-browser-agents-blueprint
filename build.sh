#!/bin/bash

# Exit on error
set -e

echo "Building all WASM agents for demos..."

# Make all build scripts executable
chmod +x demos/hello-agent/rust/build.sh
chmod +x demos/hello-agent/go/build.sh
chmod +x demos/hello-agent/python/build.sh
chmod +x demos/hello-agent/js/build.sh
chmod +x demos/handoff/rust/build.sh
chmod +x demos/handoff/go/build.sh

echo ""
echo "=== Building hello-agent demo ==="
echo ""

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

echo ""
echo "=== Building handoff demo ==="
echo ""

# Build Rust counter agent
echo "Building Rust counter agent..."
cd demos/handoff/rust && ./build.sh
cd ../../..

# Build Go counter agent
echo "Building Go counter agent..."
cd demos/handoff/go && ./build.sh
cd ../../..

echo ""
echo "=== Build Summary ==="
echo ""
echo "✓ hello-agent demo:"
echo "  - Rust: demos/hello-agent/rust/pkg/"
echo "  - Go: demos/hello-agent/go/"
echo "  - Python: demos/hello-agent/python/"
echo "  - JavaScript: demos/hello-agent/js/"
echo ""
echo "✓ handoff demo:"
echo "  - Rust counter: demos/handoff/wasm/counter_rust.wasm"
echo "  - Go counter: demos/handoff/wasm/counter_go.wasm"
echo ""
echo "✓ tool-calling demo:"
echo "  - No WASM build required (JavaScript tools)"
echo ""
echo "All agents built successfully!" 