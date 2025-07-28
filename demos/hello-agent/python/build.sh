#!/bin/bash

# Exit on error
set -e

# Create a requirements.txt if it doesn't exist
if [ ! -f "requirements.txt" ]; then
    echo "Creating requirements.txt..."
    echo "pyodide-py>=0.24.1" > requirements.txt
fi

echo "Python agent prepared successfully!"
echo "Python files are ready in the current directory"
echo "Note: Python/Pyodide modules will be loaded at runtime through Pyodide" 