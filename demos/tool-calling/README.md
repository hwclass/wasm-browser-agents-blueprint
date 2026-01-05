# Tool Calling Demo

This demo showcases **autonomous tool use** with a browser-native agent powered by WebLLM. The agent can analyze requests, decide which tools to call, execute them, and synthesize coherent responses.

## Features

- **Available Tools**:
  - `count_character_occurrences`: Character counting in text
  - `visit_webpage`: Web page content fetching (mocked)
  - `search_web`: Web search (mocked)

- **Autonomous Execution**: LLM-driven tool selection and execution
- **Multi-turn Support**: Agent can call multiple tools in sequence
- **Synthesized Responses**: Coherent answers incorporating tool results

## Architecture

- **Compositional SDK**: Uses `composeAgent()` with `withTools()` for declarative configuration
- **Tool Registry**: JSON Schema-based tool definitions
- **Worker Pattern**: Comlink-based communication between main thread and worker
4. **Error Handling**: Structured error propagation and retry logic
5. **Mock Implementation**: Tools are mocked for browser safety (no actual web requests)

## 🏗️ Architecture

```
User Request
    ↓
Agent (JS + WebLLM)
    ↓
Analyze Request & Select Tools
    ↓
Execute Tool(s) in Runtime
    ↓
Feed Results Back to Agent
    ↓
[Repeat if needed]
    ↓
Final Response
```

### Components

#### 1. Tool-Calling Agent (`agent.worker.js`)
- **Runtime**: JavaScript + WebLLM
- **Purpose**: Autonomous tool selection and execution
- **Capabilities**:
  - Analyzes user requests
  - Decides which tools to call
  - Processes tool results
  - Synthesizes final responses
- **Features**:
  - Multi-turn execution (up to 10 turns)
  - Tool result feedback loop
  - Error recovery

#### 2. Tool Registry (`tools.js`)
- **Purpose**: Centralized tool management
- **Structure**:
  ```javascript
  {
    name: string
    description: string
    parameters: JSONSchema
    handler: async (args) => result
  }
  ```
- **Functions**:
  - `getToolSchemas()`: Formats tools for WebLLM
  - `executeTool()`: Runs tool handler
  - `validateToolArgs()`: Parameter validation

#### 3. Tools

**count_character_occurrences**
```javascript
{
  text: string,
  character: string (single char)
}
→ { count: number, message: string }
```

**visit_webpage**
```javascript
{ url: string }
→ { title: string, content: string, word_count: number }
```
*Note: Mocked for demo. Real implementation would use `fetch()` with CORS.*

**search_web**
```javascript
{ query: string }
→ { results: array, count: number, message: string }
```
*Note: Mocked for demo. Real implementation would use search API.*

## 📋 Tool Protocol

### Tool Schema Format

Tools are defined using JSON Schema and exposed to WebLLM:

```javascript
{
  type: 'function',
  function: {
    name: 'count_character_occurrences',
    description: 'Counts how many times a specific character appears',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to analyze' },
        character: { type: 'string', description: 'Character to count' }
      },
      required: ['text', 'character']
    }
  }
}
```

### Tool Execution Flow

1. **LLM Decision**: WebLLM emits tool call with arguments
2. **Validation**: Arguments validated against schema
3. **Execution**: Tool handler runs asynchronously
4. **Result**: Returned to LLM for processing
5. **Continuation**: LLM decides to call more tools or respond

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18+ for dev server
- **Modern Browser**: With WebGPU or WebGL support
- **Memory**: 2-4GB VRAM recommended for models

### Run Demo

```bash
# From repo root
npm install
npm run dev

# Navigate to:
# http://localhost:5173/demos/tool-calling/
```

No build step required - tools run in JavaScript runtime.

## 🎮 Usage

### 1. Select Model

Choose a WebLLM model with good function calling support:
- **Llama 3.2 3B** (Recommended): Best tool calling, ~2GB
- **Phi-3.5 Mini**: Balanced performance, ~2GB
- **Qwen2.5 3B**: Fast, good accuracy, ~2GB

### 2. Enter Request

Examples:
- "Count how many times 'e' appears in 'elephant'"
- "Visit example.com and tell me what it's about"
- "Search for WebAssembly and summarize the results"
- "Visit mozilla.org, search for Firefox, then count 'o' in the Mozilla content"

### 3. Execute

The agent will:
1. Analyze your request
2. Decide which tools to use
3. Execute tools in sequence
4. Synthesize a final response

### 4. View Results

- **Response**: Agent's final answer
- **Tool Trace**: Detailed execution log showing all tool calls
- **Stats**: Number of tools called and LLM turns

## 🔧 Technical Details

### Multi-Turn Tool Execution

The agent supports **iterative tool use**:

```javascript
async function execute(userMessage, maxTurns = 10) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ]

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
}
```

### Tool Result Format

All tools return structured JSON:

```javascript
{
  // Tool-specific data
  count: 5,
  title: "Example",

  // Standard message field
  message: "Human-readable summary"
}
```

This allows the LLM to:
- Parse structured data for further processing
- Use the message for natural language synthesis

### Error Handling

Tools can fail gracefully:

```javascript
try {
  const result = await executeTool(name, args)
} catch (error) {
  // Error passed back to LLM
  const errorResult = { error: error.message }
  messages.push({ role: 'tool', content: JSON.stringify(errorResult) })
}
```

The LLM can then decide to:
- Retry with different arguments
- Use a different tool
- Inform the user of the limitation

## 🎓 Design Principles

### Declarative Tool Registry

Tools are registered declaratively:

```javascript
export const TOOLS = [
  {
    name: 'my_tool',
    description: 'What it does',
    parameters: { /* JSON Schema */ },
    handler: async (args) => { /* Implementation */ }
  }
]
```

No inheritance, no classes - just data and functions.

### Separation of Concerns

- **Agent** (worker): Decides what to do
- **Tools** (runtime): Execute actions
- **UI** (main thread): Display results

Agents never directly call browser APIs. All side effects happen in tool handlers.

### Runtime, Not Framework

This isn't a framework - it's a pattern:

```javascript
// Agent decides
{ tool: "count_character_occurrences", args: {...} }

// Runtime executes
const result = await tool.handler(args)

// Agent continues
"The character 'e' appears 3 times."
```

Simple, composable, extensible.

## 📊 Example Execution

**Input**: "Count how many times 'o' appears in 'hello world'"

**Trace**:
```
1. LLM analyzes request
   → Decides to use count_character_occurrences

2. Tool executed:
   Args: { text: "hello world", character: "o" }
   Result: { count: 2, message: "..." }

3. LLM synthesizes response:
   "The character 'o' appears 2 times in 'hello world'."
```

**Stats**: 1 tool call, 2 LLM turns

## 🚧 Limitations

### Current Demo Limitations

1. **Mocked Tools**: Web tools don't make real requests (browser security)
2. **Simple Tasks**: Tools are basic demonstrations, not production-ready
3. **No Streaming**: Results shown after full execution
4. **Turn Limit**: Max 10 LLM calls to prevent infinite loops
5. **No Tool Chaining**: Tools can't call other tools directly

### Browser Constraints

1. **CORS**: Real `visit_webpage` would require CORS-enabled servers
2. **API Keys**: Real `search_web` would need API access
3. **File Access**: No local file system access
4. **Network**: Limited to browser-allowed requests

## 💡 Extension Ideas

### Add New Tools

```javascript
{
  name: 'calculate',
  description: 'Evaluate mathematical expressions',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string' }
    },
    required: ['expression']
  },
  handler: async ({ expression }) => {
    // Safe evaluation logic
    const result = evaluateExpression(expression)
    return { result, message: `${expression} = ${result}` }
  }
}
```

### WASM Tool Implementations

Tools could call WASM for performance:

```javascript
{
  name: 'analyze_sentiment',
  handler: async ({ text }) => {
    const result = await wasmSentimentAnalyzer.analyze(text)
    return { sentiment: result.score, message: `Sentiment: ${result.label}` }
  }
}
```

### Real Web Tools

With proper backend:

```javascript
{
  name: 'visit_webpage',
  handler: async ({ url }) => {
    const response = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`)
    const data = await response.json()
    return { title: data.title, content: data.text }
  }
}
```

## 🔍 Debugging

**Enable logging**:
```javascript
localStorage.debug = '*'
```

**Check worker console**:
- Tool execution logs
- LLM responses
- Error details

**Inspect tool trace in UI**:
- Shows all tool calls
- Displays arguments and results
- Highlights errors

## 📚 Related Demos

- [hello-agent](../hello-agent/): Multi-language WASM agents
- [handoff](../handoff/): Multi-agent coordination

## 🤝 Contributing

To extend this demo:

1. Add new tools to `tools.js`
2. Implement real API integrations (requires backend)
3. Create WASM tool implementations for performance
4. Add streaming response support
5. Implement tool composition (tools calling tools)

## 📄 License

Same as parent repository.
