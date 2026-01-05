# wasm-browser-agent-sdk Specification

**Version**: 0.4.0
**Status**: Implemented
**Previous Version**: 0.3.2
**Author**: Extended from Mozilla AI WASM Agents Blueprint

---

## 0. Identity & Scope

**Name**: `wasm-browser-agent-sdk`
**Repository**: Embedded in `hwclass/wasm-browser-agents-blueprint`

**Purpose**: A browser-native agent SDK that enables:
- Agent definition via composition
- Execution via WebWorkers
- Agent logic in WASM (Rust, Go, JavaScript, Python)
- Handoff (triage → specialist) and tool calling
- No remote LLM APIs (WebLLM only)
- Clean extraction later into standalone repo

**This SDK is not a framework.** It is a blueprint-level runtime + composition layer.

---

## 1. Design Philosophy (Non-negotiable)

### 1.1 Composition Over Classes (functional composition)

The SDK follows functional composition principles:
- ✅ No deep inheritance trees
- ✅ Prefer pure functions
- ✅ Behavior assembled via small composable units
- ✅ Data + behavior assembled late

**An agent is not a class. An agent is a composition of capabilities.**

### 1.2 Agents Are Decision Engines, Not Environments

Agents **DO NOT**:
- ❌ Call browser APIs
- ❌ Fetch URLs
- ❌ Manage workers

Agents **ONLY**:
- ✅ Receive structured input
- ✅ Decide next action
- ✅ Emit structured output

**All side effects happen in the runtime, not the agent.**

### 1.3 SDK ≠ Runtime ≠ Demo

| Layer | Responsibility |
|-------|---------------|
| SDK | Composition, contracts, orchestration helpers |
| Runtime | WebWorkers, WASM loading, message routing |
| Demo | UI, example flows, visualization |

No demo logic leaks into SDK.
No WASM ABI leaks into SDK.

---

## 2. SDK Public API (Compositional)

### 2.1 Core Types

Location: `src/sdk/types.ts`

```typescript
export type AgentSpec = {
  name: string
  instructions: string
  model: ModelSpec
  tools?: ToolSpec[]
}

export type ModelSpec = {
  provider: "webllm"
  model: string
  settings?: {
    temperature?: number
    max_tokens?: number
    timeout?: number
  }
}

export type ToolSpec = {
  name: string
  description: string
  parameters: JSONSchema
  handler: (args: any) => Promise<any>
}
```

### 2.2 Compositional Construction

Location: `src/sdk/compose.ts`

```typescript
export const withName =
  (name: string) =>
  (agent: Partial<AgentSpec>) =>
    ({ ...agent, name })

export const withInstructions =
  (instructions: string) =>
  (agent: Partial<AgentSpec>) =>
    ({ ...agent, instructions })

export const withModel =
  (model: ModelSpec) =>
  (agent: Partial<AgentSpec>) =>
    ({ ...agent, model })

export const withTools =
  (tools: ToolSpec[]) =>
  (agent: Partial<AgentSpec>) =>
    ({ ...agent, tools })

export const composeAgent =
  (...fns: Array<(a: Partial<AgentSpec>) => Partial<AgentSpec>>) =>
    fns.reduce((acc, fn) => fn(acc), {})
```

**Usage Pattern (MANDATORY)**:

```typescript
const counterAgent = composeAgent(
  withName("counter_rust"),
  withInstructions("Count how many times a word appears in text."),
  withModel({
    provider: "webllm",
    model: "Qwen2.5-1.5B",
    settings: { timeout: 30 }
  })
)
```

This mirrors OpenAI's Agent(...) semantically but remains compositional and browser-native.

---

## 3. WASM Agent Contract (Language-Agnostic)

### 3.1 Exported Interface (MANDATORY)

Every WASM agent must export:

```
step(input: string): string
```

- **input**: JSON string
- **output**: JSON string
- **No browser APIs**
- **No host imports**
- **No global state assumptions**

### 3.2 Agent I/O Protocol

**Input** (runtime → agent):

```json
{
  "type": "USER_TASK | TOOL_RESULT | HANDOFF_RESULT",
  "payload": { ... }
}
```

**Output** (agent → runtime):

```json
{
  "kind": "respond | tool_call | handoff",
  "message": "...",
  "tool": "...",
  "args": { ... },
  "to": "agent_name"
}
```

**Agents never directly call tools or other agents.**

---

## 4. Runtime Architecture

### 4.1 Workers

- Each agent runs in its own WebWorker
- Workers use patterns from `demos/hello-agent/worker-*.js`
- Communication via Comlink for type-safe RPC

### 4.2 Runtime Responsibilities

The runtime (inside workers):
- ✅ Loads WASM modules
- ✅ Loads WebLLM models
- ✅ Executes `agent.step(...)`
- ✅ Validates agent outputs
- ✅ Routes tool calls and handoff requests
- ✅ Returns final responses to UI

**The SDK does not load WASM or models. That stays runtime-specific.**

---

## 5. Demos

### 5.1 handoff Demo

**Location**: `demos/handoff/`

**Agents**:

| Agent | Role | Language |
|-------|------|----------|
| triage | Selects which agent handles task | JS + WebLLM |
| counter_rust | Word occurrence counting | Rust → WASM |
| counter_go | Word occurrence counting | Go → WASM |

**Behavior** (Mozilla Parity):
1. User provides: text + word
2. Triage agent decides: `{ "selected_agent": "counter_rust" }`
3. Only that agent runs
4. Result returned: `{ "count": 5 }`

**No tools. No retries. No streaming.**

**Triage System Prompt**:

```
You are a routing agent.

Your only task is to select which specialized agent should handle the user request.

Available agents:
- counter_rust: counts word occurrences using a Rust-based agent
- counter_go: counts word occurrences using a Go-based agent

Routing rules:
- Performance/speed mentions → "counter_rust"
- Simplicity/portability mentions → "counter_go"
- Default → "counter_rust"

Output ONLY valid JSON: {"selected_agent":"counter_rust"}
```

**JSON Schema Enforcement**:

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

If validation fails → repair prompt → if still invalid → hard error.

### 5.2 tool-calling Demo

**Location**: `demos/tool-calling/`

**Tools** (Mozilla Parity):
- `count_character_occurrences(text, character)`
- `visit_webpage(url)` (mocked for browser safety)
- `search_web(query)` (mocked for browser safety)

**Agent**:
- Single agent using WebLLM
- Emits tool calls based on LLM decision
- Receives tool results
- Emits final response

**Multi-Turn Execution**:

```javascript
while (turnCount < maxTurns) {
  const response = await llm.chat.completions.create({
    messages,
    tools: toolSchemas,
    tool_choice: 'auto'
  })

  if (response.tool_calls) {
    // Execute tools
    for (const toolCall of response.tool_calls) {
      const result = await executeTool(toolCall.name, toolCall.args)
      messages.push({ role: 'tool', content: JSON.stringify(result) })
    }
  } else {
    // Final response
    return response.content
  }
}
```

---

## 6. WASM Implementations

### 6.1 Rust Counter Agent

**Location**: `demos/handoff/rust/`

**Build**:
```bash
wasm-pack build --target web
```

**Output**: `pkg/counter_rust_bg.wasm` (~15KB)

**Contract Implementation**:

```rust
#[wasm_bindgen]
pub fn step(input: String) -> String {
    let event: InputEvent = serde_json::from_str(&input)?;

    if event.event_type != "USER_TASK" {
        return error("Unsupported event type");
    }

    let count = count_occurrences(&event.payload.text, &event.payload.word);

    let output = OutputEvent {
        kind: "respond".to_string(),
        count,
    };

    serde_json::to_string(&output).unwrap()
}
```

### 6.2 Go Counter Agent

**Location**: `demos/handoff/go/`

**Build**:
```bash
GOOS=js GOARCH=wasm go build -o counter_go.wasm
```

**Output**: `counter_go.wasm` (~2.4MB, includes Go runtime)

**Contract Implementation**:

```go
func step(this js.Value, args []js.Value) interface{} {
    input := args[0].String()

    var event InputEvent
    json.Unmarshal([]byte(input), &event)

    if event.Type != "USER_TASK" {
        return errorResponse("unsupported event type")
    }

    count := countOccurrences(event.Payload.Text, event.Payload.Word)

    output := OutputEvent{
        Kind:  "respond",
        Count: count,
    }

    bytes, _ := json.Marshal(output)
    return string(bytes)
}

func main() {
    js.Global().Set("step", js.FuncOf(step))
    select {} // Keep alive
}
```

### 6.3 Worker Integration

**Rust Worker**:

```javascript
import initWasm, * as wasm from './rust/pkg/counter_rust.js'

await initWasm()
const result = wasm.step(inputJson)
```

**Go Worker**:

```javascript
const go = new globalThis.Go()
const wasmBuf = await fetch('./wasm/counter_go.wasm').then(r => r.arrayBuffer())
const instance = await WebAssembly.instantiate(wasmBuf, go.importObject)
go.run(instance.instance)

const result = globalThis.step(inputJson)
```

**Difference stays inside worker. SDK and UI never care.**

---

## 7. Tool Registry Pattern

**Location**: `demos/tool-calling/tools.js`

**Structure**:

```javascript
export const TOOLS = [
  {
    name: 'count_character_occurrences',
    description: 'Counts how many times a character appears',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        character: { type: 'string' }
      },
      required: ['text', 'character']
    },
    handler: async (args) => {
      // Implementation
      return { count, message }
    }
  }
]
```

**Functions**:

```javascript
export function getToolByName(name)
export function getToolSchemas() // For WebLLM
export async function executeTool(name, args)
export function validateToolArgs(toolName, args)
```

---

## 8. Directory Structure (Final)

```
wasm-browser-agents-blueprint/
├── src/
│   └── sdk/                         # wasm-browser-agent-sdk
│       ├── types.ts                 # Core type definitions
│       ├── compose.ts               # Compositional API
│       ├── validation.ts            # I/O validation
│       ├── index.ts                 # Public exports
│       └── README.md                # SDK documentation
├── demos/
│   ├── hello-agent/                 # Original multi-language demo
│   ├── handoff/                     # Multi-agent handoff demo
│   │   ├── rust/                    # Rust counter (Cargo.toml, src/lib.rs, build.sh)
│   │   ├── go/                      # Go counter (go.mod, main.go, build.sh)
│   │   ├── wasm/                    # Compiled binaries
│   │   ├── triage.worker.js         # Triage routing agent
│   │   ├── counter-rust.worker.js   # Rust counter worker
│   │   ├── counter-go.worker.js     # Go counter worker
│   │   ├── index.html               # UI
│   │   ├── main.js                  # Orchestration
│   │   └── README.md                # Demo docs
│   └── tool-calling/                # Tool calling demo
│       ├── tools.js                 # Tool registry
│       ├── agent.worker.js          # Tool-calling agent
│       ├── index.html               # UI
│       ├── main.js                  # Orchestration
│       └── README.md                # Demo docs
├── build.sh                         # Build all demos
├── package.json                     # Dependencies (v0.4.0)
├── vite.config.mjs                  # Build config
├── README.md                        # Main documentation
└── SPEC-v0.4.0.md                  # This specification
```

---

## 9. Success Criteria

This implementation is considered successful because:

✅ **Handoff demo uses 3 agents** (triage + 2 executors)
✅ **Tool calling demo matches Mozilla behavior**
✅ **Rust & Go WASM agents work**
✅ **SDK is compositional, class-free**
✅ **Runtime reuses hello-agent + worker patterns**
✅ **SDK can be extracted without refactoring**

---

## 10. Guiding Rule (Critical)

**If a decision can be expressed as composition, do not hardcode it.**
**If a behavior belongs to runtime, do not put it in the SDK.**

This rule keeps the blueprint honest.

---

## 11. Build Process

### Master Build Script

**Location**: `build.sh`

```bash
# Makes all scripts executable
chmod +x demos/handoff/rust/build.sh
chmod +x demos/handoff/go/build.sh

# Builds all demos
./build.sh
```

**Output Summary**:
```
✓ hello-agent demo:
  - Rust: demos/hello-agent/rust/pkg/
  - Go: demos/hello-agent/go/
  - Python: demos/hello-agent/python/
  - JavaScript: demos/hello-agent/js/

✓ handoff demo:
  - Rust counter: demos/handoff/wasm/counter_rust.wasm
  - Go counter: demos/handoff/wasm/counter_go.wasm

✓ tool-calling demo:
  - No WASM build required (JavaScript tools)
```

---

## 12. Testing Strategy

### Unit Tests (Future)
- SDK composition functions
- I/O validation
- Tool registry validation

### Integration Tests (Future)
- WASM agent contract compliance
- Worker communication
- Tool execution

### Manual Testing (Current)
- Run each demo in browser
- Verify agent routing
- Check tool execution
- Monitor console for errors

---

## 13. Performance Characteristics

| Component | Size | Init Time | Execution Speed |
|-----------|------|-----------|-----------------|
| Rust WASM | ~15KB | <100ms | Fastest |
| Go WASM | ~2.4MB | ~200ms | Fast |
| Triage Agent | N/A | 5-30s (model load) | Variable |
| Tool Calling | N/A | 5-30s (model load) | Variable |

**WebLLM Model Sizes**:
- Qwen2.5 1.5B: ~1GB VRAM
- Phi-3.5 Mini: ~2GB VRAM
- Llama 3.2 3B: ~2GB VRAM

---

## 14. Mozilla Parity Matrix

| Feature | Mozilla | This Implementation | Status |
|---------|---------|---------------------|--------|
| Multi-language WASM | ✅ | ✅ | ✅ Parity |
| WebLLM integration | ✅ | ✅ | ✅ Parity |
| Agent handoff | ✅ | ✅ | ✅ Parity |
| Tool calling | ✅ | ✅ | ✅ Parity |
| Compositional SDK | ❌ | ✅ | ✨ Enhancement |
| Standardized contract | ❌ | ✅ | ✨ Enhancement |
| JSON Schema validation | Partial | ✅ | ✨ Enhancement |

---

## 15. Changelog from v0.3.2

### Added
- **wasm-browser-agent-sdk** (`src/sdk/`)
  - Compositional API with functional composition principles
  - Type definitions and agent contracts
  - I/O protocol validation
  - Comprehensive SDK documentation

- **handoff demo** (`demos/handoff/`)
  - Triage agent with WebLLM routing
  - Rust counter agent (WASM)
  - Go counter agent (WASM)
  - JSON schema validation with repair logic
  - Complete demo documentation

- **tool-calling demo** (`demos/tool-calling/`)
  - Tool registry system
  - Multi-turn tool execution
  - 3 tools: count_character_occurrences, visit_webpage, search_web
  - WebLLM agent with autonomous tool selection
  - Complete demo documentation

- **Documentation**
  - Updated main README with demo links
  - Individual demo READMEs
  - SDK documentation
  - This specification (SPEC-v0.4.0.md)

### Changed
- Updated build.sh to include handoff demo builds
- Enhanced project structure documentation
- Added feature matrix comparing to Mozilla implementation

### Technical Improvements
- Standardized WASM agent contract: `step(input: string) -> string`
- Worker-based architecture with Comlink
- Closed-world routing pattern
- Declarative tool registry

---

## 16. Future Enhancements

### Potential SDK Additions
- `withMemory()` - Agent state persistence
- `withContext()` - Conversation history
- `withRetry()` - Error handling policy
- `withStreaming()` - Response streaming

### Potential Runtime Additions
- Agent-to-agent context passing
- Streaming responses from WebLLM
- Performance metrics and monitoring
- Advanced error recovery

### Potential Demo Additions
- Real web tools (with backend proxy)
- WASM tool implementations
- Multi-modal inputs
- Agent memory demonstrations

---

## 17. Known Limitations

### Current Implementation
1. **Mocked Tools**: Web tools don't make real requests (browser security)
2. **No Streaming**: Results shown after full execution
3. **Turn Limit**: Max 10 LLM calls to prevent infinite loops
4. **No Persistence**: No agent memory across sessions

### Browser Constraints
1. **CORS**: Real webpage fetching requires CORS-enabled servers
2. **API Keys**: Real search requires API access
3. **File System**: No local file access
4. **VRAM**: Large models require significant memory

---

## 18. References

- [Mozilla AI WASM Agents Blog](https://blog.mozilla.ai/wasm-agents-ai-agents-running-in-your-browser/)
- [Original Blueprint](https://github.com/mozilla-ai/wasm-agents-blueprint)
- [Composing Software](https://medium.com/javascript-scene/composing-software-the-book-f31c77fc3ddc)
- [WebLLM Documentation](https://webllm.mlc.ai/)
- [wasm-bindgen Book](https://rustwasm.github.io/docs/wasm-bindgen/)
- [Go WebAssembly](https://github.com/golang/go/wiki/WebAssembly)

---

**End of Specification for v0.4.0**
