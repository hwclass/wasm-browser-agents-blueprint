#!/bin/bash

# Exit on error
set -e

# Create dist directory
mkdir -p ../dist/js

# Copy JavaScript files
echo "Preparing JavaScript agent..."
cp *.js ../dist/js/

# Copy package.json if it exists
if [ -f "package.json" ]; then
    cp package.json ../dist/js/
fi

echo "JavaScript agent prepared successfully!" 