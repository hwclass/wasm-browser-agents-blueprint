# Agent Handoff Demo

This demo showcases **multi-agent coordination** using a triage pattern, where a routing agent analyzes user requests and delegates tasks to specialized WASM agents.

## Features

- **Multi-Agent System**: Triage agent + specialized worker agents
- **Task**: Count word occurrences in text
- **Intelligent Routing**: LLM-based agent selection based on query context
- **WASM Integration**: Rust and Go agents running natively in the browser
- **User Flow**: Query → Routing → Execution → Result

## Architecture

- **Compositional SDK**: Uses `composeAgent()` to define agent specifications
- **Closed-World Routing**: Triage agent selects from predefined set of specialists
- **Worker Pattern**: Comlink-based communication between agents
- **WASM Contract**: Standardized `step(input: string) -> string` interface
- **Multi-Language Support**: Rust and Go implementations (extensible to Python/JS)

## 🏗️ Architecture

```
User Request
    ↓
Triage Agent (JS + WebLLM)
    ↓
JSON Schema Validation
    ↓
Selected Specialized Agent
    ├─ counter_rust (Rust → WASM)
    └─ counter_go (Go → WASM)
    ↓
Word Count Result
```

### Components

#### 1. Triage Agent (`triage.worker.js`)
- **Runtime**: JavaScript + WebLLM
- **Purpose**: Analyze user query and route to appropriate agent
- **Routing Rules**:
  - Performance/speed mentions → `counter_rust`
  - Simplicity/portability mentions → `counter_go`
  - Default → `counter_rust`
- **Validation**: JSON schema enforcement with repair logic

#### 2. Rust Counter (`rust/`)
- **Language**: Rust
- **Compilation**: `wasm-pack build --target web`
- **Output**: ~15KB WASM binary
- **Contract**: `step(inputJson) -> outputJson`
- **Advantages**: Minimal size, maximum performance

#### 3. Go Counter (`go/`)
- **Language**: Go
- **Compilation**: `GOOS=js GOARCH=wasm go build`
- **Output**: ~2.4MB WASM binary (includes Go runtime)
- **Contract**: `step(inputJson) -> outputJson` via `globalThis`
- **Advantages**: Familiar syntax, standard library

## 📋 Agent Protocol

All WASM agents implement the same contract:

### Input Event
```json
{
  "type": "USER_TASK",
  "payload": {
    "text": "hello world hello",
    "word": "hello"
  }
}
```

### Output Event
```json
{
  "kind": "respond",
  "count": 2
}
```

### Error Event
```json
{
  "kind": "respond",
  "error": "Invalid input JSON"
}
```

## 🚀 Getting Started

### Prerequisites

- **Rust**: Install via [rustup](https://rustup.rs/)
- **wasm-pack**: `curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`
- **Go**: Version 1.22+ from [golang.org](https://golang.org/dl/)
- **Node.js**: Version 18+ for dev server

### Build WASM Agents

```bash
# Build Rust counter
cd rust
./build.sh

# Build Go counter
cd ../go
./build.sh
```

This creates:
- `wasm/counter_rust.wasm` (~15KB)
- `wasm/counter_go.wasm` (~2.4MB)
- `wasm/wasm_exec.js` (Go runtime support)

### Run Demo

```bash
# From repo root
npm install
npm run dev

# Navigate to:
# http://localhost:5173/demos/handoff/
```

## 🎮 Usage

1. **Select Triage Model**: Choose WebLLM model for routing
   - Qwen2.5 1.5B: Fast, ~1GB VRAM
   - Phi-3.5 Mini: Balanced, ~2GB VRAM
   - Llama 3.2 3B: Most accurate, ~2GB VRAM

2. **Enter Query**: Describe your request
   - "I need fast word counting" → Routes to Rust
   - "Simple word counting demo" → Routes to Go
   - Generic query → Default to Rust

3. **Provide Text**: Enter text to analyze

4. **Specify Word**: Word to count

5. **Run**: Agent handoff executes automatically

## 🔧 Technical Details

### Triage Routing

The triage agent uses a **closed-world routing** pattern:

```typescript
type Route = "counter_rust" | "counter_go"
```

JSON Schema enforcement:
```json
{
  "type": "object",
  "properties": {
    "selected_agent": {
      "type": "string",
      "enum": ["counter_rust", "counter_go"]
    }
  },
  "required": ["selected_agent"],
  "additionalProperties": false
}
```

If validation fails, a **repair prompt** is sent for one retry attempt.

### WASM Loading Patterns

**Rust**:
```javascript
import initWasm, * as wasm from './rust/pkg/counter_rust.js'
await initWasm()
const result = wasm.step(inputJson)
```

**Go**:
```javascript
const go = new globalThis.Go()
const wasmBuf = await fetch('./wasm/counter_go.wasm').then(r => r.arrayBuffer())
const instance = await WebAssembly.instantiate(wasmBuf, go.importObject)
go.run(instance.instance)
const result = globalThis.step(inputJson)
```

### Worker Communication

All workers use **Comlink** for type-safe RPC:

```javascript
import { wrap } from 'comlink'

const worker = new Worker('./triage.worker.js', { type: 'module' })
const api = wrap(worker)

await api.ready(modelId, progressCallback)
const routing = await api.route(userQuery)
```

## 📊 Performance Comparison

| Agent | WASM Size | Init Time | Execution Speed |
|-------|-----------|-----------|-----------------|
| Rust  | ~15KB     | <100ms    | Fastest         |
| Go    | ~2.4MB    | ~200ms    | Fast            |

## 🎓 Why This Matters

### Composition Over Classes

This demo uses functional composition principles:

```javascript
// No classes, pure composition
const agent = composeAgent(
  withName("counter_rust"),
  withInstructions("Count word occurrences"),
  withModel({ provider: "webllm", model: "Qwen2.5-1.5B" })
)
```

### Agents as Decision Engines

Agents **only**:
- Receive structured input
- Decide next action
- Emit structured output

They **never**:
- Call browser APIs
- Manage workers
- Handle side effects

Runtime handles all I/O and orchestration.

### SDK ≠ Runtime ≠ Demo

Clear separation of concerns:
- **SDK** (`src/sdk/`): Compositional API, contracts
- **Runtime** (workers): WASM loading, message routing
- **Demo** (UI): User interaction, visualization

## 🔍 Debugging

Enable verbose logging:
```javascript
// In browser console
localStorage.debug = '*'
```

Check execution trace in UI after running.

## 🚧 Limitations

1. **Mocked Triage**: Real-world triage would consider task complexity, latency requirements, etc.
2. **Simple Task**: Word counting is trivial; demonstrates pattern, not agent sophistication
3. **No Context Passing**: Agents don't share state or memory
4. **Browser-Only**: No file system, limited by WebLLM model support

## 📚 Related Demos

- [hello-agent](../hello-agent/): Multi-language greeting agents
- [tool-calling](../tool-calling/): Autonomous tool use with WebLLM

## 🤝 Contributing

This is a blueprint for learning. To extend:

1. Add new specialized agents (e.g., sentiment analysis, translation)
2. Implement context passing between agents
3. Add agent memory/state management
4. Create more sophisticated triage logic

## 📄 License

Same as parent repository.
