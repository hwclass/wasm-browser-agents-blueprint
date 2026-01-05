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

This blueprint demonstrates how to build browser-native AI agents using WebAssembly (WASM) and WebLLM. It showcases the integration of multiple programming languages (Rust, Go, Python, JavaScript) to create high-performance, browser-based AI applications that run entirely client-side without server dependencies.

**Extended with:**
- 🤝 **Agent Handoff**: Multi-agent coordination with triage routing
- 🛠️ **Tool Calling**: Autonomous tool use with LLM-driven decision making
- 📦 **Compositional SDK**: functional composition for agent construction

<p align="center">
  <picture>
    <!-- When the user prefers dark mode, show the white logo -->
    <source media="(prefers-color-scheme: dark)" srcset="./images/headline.png">
    <!-- When the user prefers light mode, show the black logo -->
    <source media="(prefers-color-scheme: light)" srcset="./images/headline.png">
    <!-- Fallback: default to the black logo -->
    <img src="./images/headline.png" width="100%" alt="WASM Browser Agents Blueprint"/>
  </picture>
</p>

## Quick Start

### 🐳 Recommended: Docker Deployment
```bash
# Build and run with Docker (Recommended)
docker build -t wasm-browser-agents-app .

# For development with hot-reload
docker run -p 5173:5173 \
  -v $(pwd)/demos:/app/demos \
  -v $(pwd)/src:/app/src \
  wasm-browser-agents-app
```

The Docker setup automatically handles:
- All required language toolchains (Rust, Go, Python)
- WASM compilation tools and dependencies
- Model management and resource allocation
- Development environment configuration

### Docker Requirements and Recommendations

- **Minimum Requirements**:
  - 4GB RAM
  - 10GB disk space
  - Docker 20.10.0 or higher

- **Recommended Setup**:
  - 8GB+ RAM for running larger models
  - NVIDIA GPU with CUDA support
  - Docker Compose for development
  - WSL2 on Windows systems

- **Resource Considerations**:
  - Rust agent with f32 models: 6GB+ VRAM
  - Go agent with balanced models: 4-5GB VRAM
  - Python agent: 2-4GB VRAM
  - JavaScript agent: 1-2GB VRAM

- **Development Tips**:
  - Use volume mounts for hot-reload during development
  - Monitor Docker stats for resource usage
  - Clear Docker cache periodically when switching models

### 🚀 Run from DockerHub

You can quickly run the application using the pre-built Docker image from DockerHub:

```bash
# Pull and run the latest version
docker pull hwclass/wasm-browser-agents-blueprint:latest

# Run the container with development configuration
docker run -p 5173:5173 \
  -v $(pwd)/demos:/app/demos \
  -v $(pwd)/src:/app/src \
  hwclass/wasm-browser-agents-blueprint:latest

# Visit http://localhost:5173 in your browser
```

The DockerHub image includes all necessary dependencies and is pre-configured for development. For production deployment, you can run without volume mounts:

```bash
docker run -p 5173:5173 hwclass/wasm-browser-agents-blueprint:latest
```

### Alternative: Manual Setup
If you prefer to run without Docker, you can set up manually:

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

Note: Manual setup requires installing all language toolchains and dependencies separately. See [Pre-requisites](#pre-requisites) section for details.

Visit `http://localhost:5173` to see the application in action.

## 🎯 Demos

### 1. hello-agent (Original)
Multi-language greeting agents demonstrating WASM integration.

**Location**: `demos/hello-agent/`
**What it does**: Generates greetings in multiple languages, passes to LLM for elaboration
**Languages**: Rust, Go, Python, JavaScript

[View Demo Documentation](demos/hello-agent/)

### 2. handoff (New)
Multi-agent coordination with intelligent routing.

**Location**: `demos/handoff/`
**What it does**: Triage agent routes requests to specialized WASM counter agents
**Agents**: Triage (JS+WebLLM), Rust Counter, Go Counter
**Pattern**: Closed-world routing with JSON schema validation

[View Demo Documentation](demos/handoff/README.md)

### 3. tool-calling (New)
Autonomous tool use with LLM-driven decision making.

**Location**: `demos/tool-calling/`
**What it does**: Agent analyzes requests, selects tools, executes them autonomously
**Tools**: Character counting, webpage visiting, web search
**Pattern**: Multi-turn tool execution with result feedback

[View Demo Documentation](demos/tool-calling/README.md)

## 📦 wasm-browser-agent-sdk

This repository includes a compositional SDK for building browser-native agents:

```typescript
import { composeAgent, withName, withInstructions, withModel } from './src/sdk'

const agent = composeAgent(
  withName("counter_rust"),
  withInstructions("Count word occurrences"),
  withModel({ provider: "webllm", model: "Qwen2.5-1.5B" })
)
```

**Key Principles**:
- **Composition over classes** (functional patterns)
- **Agents as decision engines** (not environments)
- **Clean separation**: SDK ≠ Runtime ≠ Demo

[View SDK Documentation](src/sdk/README.md)

## How it Works

The blueprint implements a multi-language WASM architecture that enables:

1. **Language-Agnostic WASM Integration**
   - Rust modules for high-performance computations
   - Go modules for efficient concurrent operations
   - Python modules via Pyodide for flexible scripting

2. **Browser-Native AI Processing**
   - WebLLM integration for client-side LLM inference
   - Agent-specific LLM model selection:
     - Rust: High-precision models optimized for performance (e.g., DeepSeek 8B f32)
     - Go: Balanced models for concurrent operations (e.g., Qwen2 7B)
     - Python: Research and experimental models (e.g., Phi-2)
     - JavaScript: Lightweight, responsive models (e.g., TinyLlama)
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
wasm-browser-agents-blueprint/
├── demos/
│   ├── hello-agent/         # Multi-language greeting agents
│   │   ├── rust/            # Rust WASM implementation
│   │   ├── go/              # Go WASM implementation
│   │   ├── python/          # Python/Pyodide implementation
│   │   └── js/              # JavaScript implementation
│   ├── handoff/             # Multi-agent coordination demo
│   │   ├── rust/            # Rust counter agent
│   │   ├── go/              # Go counter agent
│   │   ├── wasm/            # Compiled WASM binaries
│   │   ├── triage.worker.js # Triage routing agent
│   │   └── *.worker.js      # Counter workers
│   └── tool-calling/        # Autonomous tool use demo
│       ├── tools.js         # Tool registry and implementations
│       ├── agent.worker.js  # Tool-calling agent
│       └── index.html       # Demo UI
├── src/
│   └── sdk/                 # wasm-browser-agent-sdk
│       ├── types.ts         # Type definitions
│       ├── compose.ts       # Compositional API
│       ├── validation.ts    # I/O protocol validation
│       └── index.ts         # Public exports
├── build.sh                # Main build script for all demos
├── package.json            # Node.js dependencies
├── vite.config.mjs         # Build configuration
└── Dockerfile             # Complete build environment
```

## Build Process

The project includes individual build scripts for each demo:

### hello-agent
- **Rust**: `demos/hello-agent/rust/build.sh` → Compiles to `pkg/`
- **Go**: `demos/hello-agent/go/build.sh` → Compiles to `main.wasm`
- **Python**: `demos/hello-agent/python/build.sh` → Prepares for Pyodide
- **JavaScript**: `demos/hello-agent/js/build.sh` → No compilation

### handoff
- **Rust Counter**: `demos/handoff/rust/build.sh` → `wasm/counter_rust.wasm` (~15KB)
- **Go Counter**: `demos/handoff/go/build.sh` → `wasm/counter_go.wasm` (~2.4MB)

### tool-calling
- No WASM build required (JavaScript tools)

**Build All**:
```bash
./build.sh  # Builds all WASM modules for all demos
```

When using Docker, all build steps are automatically handled by the Dockerfile.

## Features

- **WebLLM Integration**:
  - Run large language models directly in your browser
  - Agent-specific model optimization
  - Dynamic model switching with automatic resource management
- **Multi-Language WASM Support**:
  - 🦀 **Rust**: High-performance, memory-safe systems programming with f32 precision models
  - 🐹 **Go**: Simple and efficient concurrent language with balanced model performance
  - 🐍 **Python**: Running via Pyodide for flexible scripting and experimental models
  - 📜 **JavaScript**: Native browser implementation with lightweight models
- **Multi-Agent Patterns**:
  - 🤝 **Handoff**: Triage routing to specialized agents
  - 🛠️ **Tool Calling**: Autonomous tool selection and execution
  - 🔄 **Multi-Turn Execution**: Iterative tool use with result feedback
- **Compositional SDK**:
  - No classes, pure composition (functional patterns)
  - Standardized `step(input: string) -> string` agent contract
  - JSON Schema validation for agent I/O
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