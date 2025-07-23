#!/bin/bash

# Exit on error
set -e

# Create dist directory
mkdir -p ../../dist/python

# Copy Python source files to dist
echo "Preparing Python agent..."
cp *.py ../../dist/python/

# Create a requirements.txt if it doesn't exist
if [ ! -f "requirements.txt" ]; then
    echo "Creating requirements.txt..."
    echo "pyodide-py>=0.24.1" > requirements.txt
fi

# Copy requirements.txt to dist
cp requirements.txt ../../dist/python/

echo "Python agent prepared successfully!"
echo "Note: Python/Pyodide modules will be loaded at runtime through Pyodide" 