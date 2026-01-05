# wasm-browser-agent-sdk

A browser-native agent SDK that enables agent definition via composition, execution via WebWorkers, and agent logic in WASM (Rust, Go, JavaScript).

## 🎯 Overview

This SDK is **not a framework**. It's a blueprint-level runtime + composition layer that demonstrates:

- **Composition over classes** (functional composition principles)
- **Agents as decision engines** (not environments)
- **Clean separation**: SDK ≠ Runtime ≠ Demo

## 📦 What's Included

### Core Modules

```
src/sdk/
├── types.ts          # Type definitions and contracts
├── compose.ts        # Compositional agent construction
├── validation.ts     # I/O protocol validation
├── event-bus.ts      # Event system core
├── events.ts         # Event type definitions
├── runtime-types.ts  # Runtime type definitions (ED-RMAE)
├── runtime.ts        # Runtime implementation
└── index.ts          # Public API exports
```

### Type Definitions

```typescript
// Agent specification (built via composition)
type AgentSpec = {
  name: string
  instructions: string
  model: ModelSpec
  tools?: ToolSpec[]
}

// Model configuration
type ModelSpec = {
  provider: "webllm"
  model: string
  settings?: {
    temperature?: number
    max_tokens?: number
    timeout?: number
  }
}

// Tool specification
type ToolSpec = {
  name: string
  description: string
  parameters: JSONSchema
  handler: (args: any) => Promise<any>
}
```

### Agent I/O Protocol

All WASM agents implement: `step(input: string) -> string`

**Input Event**:
```json
{
  "type": "USER_TASK | TOOL_RESULT | HANDOFF_RESULT",
  "payload": { ... }
}
```

**Output Event**:
```json
{
  "kind": "respond | tool_call | handoff",
  "message": "...",
  "tool": "...",
  "args": { ... },
  "to": "agent_name"
}
```

## 🔨 Usage

### Compositional Agent Construction

```typescript
import {
  composeAgent,
  withName,
  withInstructions,
  withModel,
  withTools
} from './sdk'

// Build agent via composition (no classes!)
const agent = composeAgent(
  withName("counter_rust"),
  withInstructions("Count how many times a word appears in text."),
  withModel({
    provider: "webllm",
    model: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
    settings: { timeout: 30 }
  })
)
```

### Adding Tools

```typescript
const toolAgent = composeAgent(
  withName("researcher"),
  withInstructions("Research topics using available tools"),
  withModel({ provider: "webllm", model: "Llama-3.2-3B" }),
  withTools([
    {
      name: "search",
      description: "Search for information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      },
      handler: async ({ query }) => {
        // Tool implementation
        return { results: [...] }
      }
    }
  ])
)
```

### Event System

The SDK includes a built-in event bus for real-time agent communication and monitoring.

```typescript
import {
  createEventBus,
  withEvents,
  AgentEvents
} from './sdk'

// Create event bus
const eventBus = createEventBus()

// Add event bus to agent spec
const agent = composeAgent(
  withName("monitored_agent"),
  withInstructions("Agent with event monitoring"),
  withModel({ provider: "webllm", model: "Llama-3.2-3B" }),
  withEvents(eventBus)
)

// Subscribe to events
eventBus.on(AgentEvents.EXECUTION_STARTED, (data) => {
  console.log('Agent started:', data.agentId, data.input)
})

eventBus.on(AgentEvents.TOOL_CALL, (data) => {
  console.log('Tool called:', data.toolName, data.args)
})

eventBus.on(AgentEvents.EXECUTION_COMPLETED, (data) => {
  console.log('Agent completed:', data.output, data.turns)
})
```

**Standard Events**:
- `agent:initialized` - Agent initialized
- `agent:ready` - Agent ready for execution
- `agent:execution:started` - Execution started
- `agent:execution:completed` - Execution completed
- `agent:execution:failed` - Execution failed
- `agent:tool:call` - Tool called
- `agent:tool:result` - Tool result received
- `agent:tool:error` - Tool error occurred
- `agent:routing:started` - Routing started (handoff)
- `agent:routing:completed` - Routing completed
- `agent:handoff` - Agent handoff occurred
- `agent:thinking` - Agent thinking (turn started)
- `agent:progress` - Progress update
- `agent:error` - General error
- `agent:disposed` - Agent disposed

**Wildcard Support**:
```typescript
// Listen to all agent events
eventBus.on('agent:*', (data) => {
  console.log('Any agent event:', data)
})

// Listen to all tool events
eventBus.on('agent:tool:*', (data) => {
  console.log('Tool event:', data)
})
```

### Validation

```typescript
import {
  validateInputEvent,
  validateOutputEvent,
  createInputEvent,
  parseOutputEvent
} from './sdk'

// Create valid input
const input = createInputEvent('USER_TASK', {
  text: "hello world",
  word: "hello"
})

// Validate agent output
const validation = validateOutputEvent(outputJson)
if (!validation.valid) {
  console.error(validation.error)
}

// Parse and validate
const output = parseOutputEvent(outputJson)
console.log(output.kind) // "respond" | "tool_call" | "handoff"
```

### Runtime (ED-RMAE Architecture)

The SDK provides a **runtime factory** that creates instances following the Event-Driven, Runtime-Mediated Agent Execution (ED-RMAE) architecture.

#### Creating a Runtime

```typescript
import {
  createAgentRuntime,
  composeAgent,
  withName,
  withInstructions,
  withModel,
  createEventBus
} from './sdk'

// Define agents
const agents = {
  tool_agent: composeAgent(
    withName('tool_agent'),
    withInstructions('Use tools to answer questions'),
    withModel({ provider: 'webllm', model: 'Llama-3.2-3B' })
  )
}

// Define tools
const tools = {
  search: {
    name: 'search',
    description: 'Search for information',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    handler: async (args) => ({ results: ['result1', 'result2'] })
  }
}

// Create tool executor
const toolExecutor = {
  execute: async (toolName, args, meta) => {
    const tool = tools[toolName]
    if (!tool) throw new Error(`Tool ${toolName} not found`)
    return await tool.handler(args)
  }
}

// Create worker factory
const workerFactory = async (agentName) => {
  // Return worker instance with step() method
  // See Phase 2 refactoring for worker implementation
  return {
    step: async (input) => {
      // Worker executes ONE step and returns ONE decision
      return { kind: 'respond', message: 'Hello!' }
    },
    dispose: async () => {}
  }
}

// Create runtime instance
const runtime = createAgentRuntime({
  agents,
  tools,
  entryAgent: 'tool_agent',
  maxSteps: 50,
  eventBus: createEventBus(),
  toolExecutor,
  workerFactory
})

// Run execution
const response = await runtime.run('Search for WebAssembly')
console.log(response)

// Get execution state
const state = runtime.getState()
console.log(state.stepCount, state.messages)
```

#### Runtime Principles

The runtime enforces these architectural rules:

1. **Runtime Controls the Loop** - Workers execute ONE step, runtime decides continuation
2. **Runtime Executes Tools** - Workers propose tool calls, runtime executes them
3. **Runtime Manages State** - All state is explicit and inspectable via `getState()`
4. **Events Drive Flow** - Every decision emits events that can trigger reactions
5. **No Agent-to-Agent Communication** - Handoff goes through runtime

#### Runtime Events

```typescript
runtime.config.eventBus?.on('runtime.event', (event) => {
  switch (event.type) {
    case 'runtime.started':
      console.log('Started:', event.state.traceId)
      break
    case 'agent.invoked':
      console.log('Agent invoked:', event.agent, 'Step:', event.step)
      break
    case 'agent.output':
      console.log('Agent output:', event.output.kind)
      break
    case 'tool.executed':
      console.log('Tool executed:', event.tool, 'Result:', event.result)
      break
    case 'runtime.completed':
      console.log('Completed:', event.result)
      break
    case 'runtime.failed':
      console.error('Failed:', event.error)
      break
  }
})
```

## 🏗️ Architecture Principles

### 1. Composition Over Classes

**Don't** do this:
```typescript
class Agent {
  constructor(name, instructions, model) { ... }
}
const agent = new Agent("name", "instructions", model)
```

**Do** this:
```typescript
const agent = composeAgent(
  withName("name"),
  withInstructions("instructions"),
  withModel(model)
)
```

### 2. Agents Are Decision Engines

Agents **only**:
- ✅ Receive structured input
- ✅ Decide next action
- ✅ Emit structured output

Agents **never**:
- ❌ Call browser APIs
- ❌ Fetch URLs
- ❌ Manage workers
- ❌ Handle file I/O

All side effects happen in the **runtime**, not the agent.

### 3. SDK ≠ Runtime ≠ Demo

| Layer | Responsibility | Files |
|-------|----------------|-------|
| SDK | Composition, contracts, orchestration helpers | `src/sdk/` |
| Runtime | WebWorkers, WASM loading, message routing | `*.worker.js` |
| Demo | UI, example flows, visualization | `demos/*/index.html` |

No demo logic leaks into SDK.
No WASM ABI leaks into SDK.

## 🔌 Runtime Integration

The SDK provides contracts and composition. The runtime handles execution.

### Worker Pattern

```javascript
// agent.worker.js
import { expose } from 'comlink'
import initWasm, * as wasm from './wasm/agent.js'

async function ready() {
  await initWasm()
}

async function execute(input) {
  const inputEvent = createInputEvent('USER_TASK', input)
  const outputJson = wasm.step(inputEvent)
  return parseOutputEvent(outputJson)
}

expose({ ready, execute })
```

### Main Thread

```javascript
import { wrap } from 'comlink'

const worker = new Worker('./agent.worker.js', { type: 'module' })
const agent = wrap(worker)

await agent.ready()
const result = await agent.execute({ text: "...", word: "..." })
```

## 📚 Examples

See working implementations:

- **[handoff demo](../../demos/handoff/)**: Multi-agent coordination with triage
- **[tool-calling demo](../../demos/tool-calling/)**: Autonomous tool use with WebLLM
- **[hello-agent demo](../../demos/hello-agent/)**: Multi-language WASM agents

## 🎓 Design Philosophy

This SDK follows functional composition principles:

1. **No deep inheritance** - Flat composition trees
2. **Pure functions** - Predictable, testable
3. **Small composable units** - Each function does one thing
4. **Data + behavior assembled late** - Flexibility at call site

It mirrors OpenAI's Agent semantics but remains:
- Browser-native (WebLLM, no API calls)
- Compositional (no classes)
- WASM-ready (polyglot agent support)

## 🚀 Extending the SDK

### Adding New Composition Functions

```typescript
// Custom composition function
export const withMemory =
  (memoryConfig: MemoryConfig) =>
  (agent: Partial<AgentSpec>): Partial<AgentSpec> =>
    ({ ...agent, memory: memoryConfig })

// Usage
const agent = composeAgent(
  withName("persistent_agent"),
  withInstructions("..."),
  withModel(model),
  withMemory({ type: "vector", size: 1000 })
)
```

### Custom Validators

```typescript
export function validateAgentOutput(
  output: string,
  expectedKind: AgentOutputKind
): ValidationResult {
  const validation = validateOutputEvent(output)
  if (!validation.valid) return validation

  const parsed = JSON.parse(output)
  if (parsed.kind !== expectedKind) {
    return {
      valid: false,
      error: `Expected kind '${expectedKind}', got '${parsed.kind}'`
    }
  }

  return { valid: true }
}
```

## 🔍 Type Safety

This SDK is written in TypeScript for:
- Clear contracts
- IDE autocomplete
- Compile-time validation
- Self-documenting APIs

Runtime validation complements type safety for dynamic I/O.

## ⚠️ Non-Goals

This SDK **does not**:
- Provide WASM compilation tooling (use wasm-pack, Go compiler, etc.)
- Manage WebLLM model loading (runtime responsibility)
- Handle worker lifecycle (demo/app responsibility)
- Implement tools (demo-specific)
- Provide UI components (demo-specific)

It's a **contract layer** and **composition API**, not a full framework.

## 📄 License

Same as parent repository.

## 🤝 Contributing

This is a blueprint for learning. Contributions should:
- Maintain composition-first approach
- Keep SDK minimal (no runtime logic)
- Follow separation of concerns
- Add tests for new validators
- Update demos to showcase new features

## 🔗 Related Resources

- [Composing Software](https://medium.com/javascript-scene/composing-software-the-book-f31c77fc3ddc)
- [Mozilla AI WASM Agents Blog](https://blog.mozilla.ai/wasm-agents-ai-agents-running-in-your-browser/)
- [WebLLM Documentation](https://webllm.mlc.ai/)
