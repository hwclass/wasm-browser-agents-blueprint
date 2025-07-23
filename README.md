<p align="center">
  <picture>
    <!-- When the user prefers dark mode, show the white logo -->
    <source media="(prefers-color-scheme: dark)" srcset="./images/Blueprint-logo-white.png">
    <!-- When the user prefers light mode, show the black logo -->
    <source media="(prefers-color-scheme: light)" srcset="./images/Blueprint-logo-black.png">
    <!-- Fallback: default to the black logo -->
    <img src="./images/Blueprint-logo-black.png" width="35%" alt="Project logo"/>
  </picture>
</p>

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-20.0%2B-green)
![Rust](https://img.shields.io/badge/Rust-latest-orange)
![Go](https://img.shields.io/badge/Go-1.18%2B-blue)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![](https://dcbadge.limes.pink/api/server/YuMNeuKStr?style=flat)](https://discord.gg/YuMNeuKStr)

[Blueprints Hub](https://developer-hub.mozilla.ai/)
| [Documentation](docs/)
| [Getting Started](#quick-start)
| [Contributing](CONTRIBUTING.md)

</div>

# wasm-browser-agents-blueprint

This blueprint demonstrates how to build browser-native AI agents using WebAssembly (WASM) and WebLLM. It showcases the integration of multiple programming languages (Rust, Go, Python) through WASM to create high-performance, browser-based AI applications that run entirely client-side without server dependencies.

<p align="center">
  <picture>
    <!-- When the user prefers dark mode, show the white logo -->
    <source media="(prefers-color-scheme: dark)" srcset="./images/headline.png">
    <!-- When the user prefers light mode, show the black logo -->
    <source media="(prefers-color-scheme: light)" srcset="./images/headline.png">
    <!-- Fallback: default to the black logo -->
    <img src="./images/headline.png" width="35%" alt="WASM Browser Agents Blueprint"/>
  </picture>
</p>

## Quick-start

```bash
# Clone the repository
git clone https://github.com/mozilla-ai/wasm-browser-agents-blueprint.git
cd wasm-browser-agents-blueprint

# Install dependencies
npm install

# Build WASM modules
chmod +x build.sh
./build.sh

# Start development server
npm run dev

# Build for production
npm run build
```

For Docker deployment:
```bash
docker build -t wasm-browser-agents-app .
docker run -p 5173:5173 wasm-browser-agents-app
```

The Dockerfile handles all necessary setup:
- Installs required language toolchains (Rust, Go, Python)
- Sets up WASM compilation tools
- Builds all WASM modules automatically
- Builds and serves the application

Visit `http://localhost:5173` to see the application in action.

## How it Works

The blueprint implements a multi-language WASM architecture that enables:

1. **Language-Agnostic WASM Integration**
   - Rust modules for high-performance computations
   - Go modules for efficient concurrent operations
   - Python modules via Pyodide for flexible scripting

2. **Browser-Native AI Processing**
   - WebLLM integration for client-side LLM inference
   - Web Workers for non-blocking background processing
   - Comlink for seamless Web Worker communication
   - Real-time text generation and processing

3. **Modern Web Architecture**
   - Vite-based build system
   - ES modules for clean dependency management
   - Web Workers with Comlink for type-safe concurrent processing

## Pre-requisites

- **System requirements**:
  - OS: Windows, macOS, or Linux
  - Node.js 18.0 or higher
  - Modern web browser with WebAssembly support
  - Minimum RAM: 4GB
  - Disk space: 1GB for full development setup

- **Development Dependencies**:
  - Rust toolchain (latest stable)
  - Go 1.18 or higher
  - Python 3.10 or higher
  - npm or yarn package manager

## Project Structure

```
browser-agents-blueprint/
├── demos/
│   └── hello-agent/      # Main demo application
├── src/
│   ├── rust/            # Rust WASM implementation
│   │   └── build.sh     # Rust-specific build script
│   ├── go/              # Go WASM implementation
│   │   └── build.sh     # Go-specific build script
│   └── python/          # Python/Pyodide implementation
│       └── build.sh     # Python-specific build script
├── dist/                # Compiled WASM modules
├── docs/                # Documentation
├── build.sh            # Main build script for all WASM modules
├── package.json         # Node.js dependencies and scripts
└── Dockerfile          # Container configuration
```

## Build Process

The project includes individual build scripts for each language implementation:

1. **Rust Build (`src/rust/build.sh`)**
   - Installs `wasm-pack` if not present
   - Compiles Rust code to WASM using `wasm-pack`
   - Outputs to `dist/rust/`

2. **Go Build (`src/go/build.sh`)**
   - Requires Go 1.18+
   - Compiles Go code to WASM
   - Copies necessary WASM support files
   - Outputs to `dist/go/`

3. **Python Build (`src/python/build.sh`)**
   - Prepares Python files for Pyodide
   - Manages Python dependencies
   - Outputs to `dist/python/`

The root `build.sh` script orchestrates the build process for all modules. When using Docker, these build steps are automatically handled by the Dockerfile.

## Features

- **WebLLM Integration**: Run large language models directly in your browser
- **Multi-Language WASM Support**:
  - 🦀 **Rust**: High-performance, memory-safe systems programming
  - 🐹 **Go**: Simple and efficient compiled language
  - 🐍 **Python**: Running via Pyodide for scripting flexibility
- **Web Workers**: Background processing for smooth UI responsiveness
- **Comlink Integration**: Type-safe and ergonomic Web Worker communication
- **Modern UI/UX**: Clean, responsive interface with consistent styling

## Troubleshooting

Common issues and solutions:

- **WASM Loading Issues**
  - Ensure your browser supports WebAssembly
  - Check console for detailed error messages
  - Verify WASM files are being served with correct MIME types

- **Build Problems**
  - Verify all required toolchains are installed
  - Check Node.js version compatibility
  - Clear npm cache and node_modules if needed

- **Performance Issues**
  - Try different WASM implementations (Rust recommended for best performance)
  - Monitor browser console for memory usage
  - Check Web Worker initialization status

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on:

- Code of Conduct
- Development process
- How to submit changes
- How to report issues
- Community guidelines 