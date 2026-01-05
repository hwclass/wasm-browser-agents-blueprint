/**
 * Tool-Calling Agent Worker (ED-RMAE Compliant)
 *
 * This worker is a PURE EXECUTOR that:
 * - Executes exactly ONE decision step
 * - Returns exactly ONE structured output
 * - NEVER contains loops
 * - NEVER executes tools
 * - NEVER decides termination
 *
 * The runtime controls all orchestration.
 *
 * Architectural compliance:
 * - P3: Workers Execute, They Do Not Orchestrate
 * - P5: Runtime-Controlled Agent Loop
 * - P6: Strict Contracts, Loose Implementation
 */

import { expose } from 'comlink'
import { CreateMLCEngine } from '@mlc-ai/web-llm'

let engine = null
let currentModelId = null

// Build system prompt dynamically based on available tools
function buildSystemPrompt(availableTools) {
  const toolDescriptions = availableTools.map((tool, index) => {
    switch (tool) {
      case 'count_character_occurrences':
        return `${index + 1}. count_character_occurrences - Counts how many times a specific character appears in text
   Parameters: {"text": "string to analyze", "character": "single char to count"}
   Example: {"kind":"tool_call","tool":"count_character_occurrences","args":{"text":"hello","character":"l"}}`
      case 'visit_webpage':
        return `${index + 1}. visit_webpage - Fetches webpage content (mocked)
   Parameters: {"url": "https://example.com"}
   Example: {"kind":"tool_call","tool":"visit_webpage","args":{"url":"https://mozilla.org"}}`
      case 'search_web':
        return `${index + 1}. search_web - Searches the web (mocked)
   Parameters: {"query": "search terms"}
   Example: {"kind":"tool_call","tool":"search_web","args":{"query":"WebAssembly"}}`
      default:
        return `${index + 1}. ${tool} - Tool available`
    }
  }).join('\n\n')

  return `You are a helpful assistant with access to tools.

Available tools:
${toolDescriptions}

RULES:
1. If a tool can help answer the user's question, you MUST call the tool.
2. You are NOT allowed to answer directly when a relevant tool exists.
3. You MUST output ONLY valid JSON matching one of these formats:

Tool call (ONE at a time):
{"kind":"tool_call","tool":"<tool_name>","args":{...}}

Final response (only after using tools if applicable):
{"kind":"respond","message":"<text>"}

CRITICAL RULES:
- Output ONE JSON object per response
- If you need multiple tools, call them ONE AT A TIME
- After each tool call, you will receive the result and can make another call
- Use the EXACT parameter names shown in the examples above
- Do NOT output multiple JSON objects in one response
- Do NOT output any other text. Do NOT explain your reasoning. ONLY output JSON.`
}

// Repair prompt used when model outputs invalid JSON
const REPAIR_PROMPT = `Your previous output was invalid.

You MUST output ONLY valid JSON matching one of these formats:

Tool call:
{"kind":"tool_call","tool":"<tool_name>","args":{...}}

Final response:
{"kind":"respond","message":"<text>"}

Do not include any other text.`

/**
 * Safe JSON parsing with validation
 */
function tryParseJSON(text) {
  try {
    const value = JSON.parse(text)
    return { ok: true, value }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

/**
 * Extract JSON from text that might contain markdown code blocks
 */
function extractJSON(text) {
  // Remove markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }

  // Try to find first complete JSON object
  let braceCount = 0
  let startIndex = -1
  let endIndex = -1

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (braceCount === 0) {
        startIndex = i
      }
      braceCount++
    } else if (text[i] === '}') {
      braceCount--
      if (braceCount === 0 && startIndex !== -1) {
        endIndex = i
        break
      }
    }
  }

  if (startIndex !== -1 && endIndex !== -1) {
    return text.substring(startIndex, endIndex + 1)
  }

  return text.trim()
}

/**
 * Initialize WebLLM engine with specified model
 *
 * @param {string} modelId - WebLLM model identifier
 * @param {function} progressCallback - Progress updates during model loading
 */
async function ready(modelId, progressCallback) {
  // Dispose existing engine if model changed
  if (engine && currentModelId !== modelId) {
    console.log('[Agent Worker] Model changed, disposing old engine')
    await engine.unload()
    engine = null
  }

  if (!engine) {
    console.log(`[Agent Worker] Initializing WebLLM engine with model: ${modelId}`)

    engine = await CreateMLCEngine(modelId, {
      initProgressCallback: progressCallback
    })

    currentModelId = modelId
    console.log('[Agent Worker] WebLLM engine ready')
  }
}

/**
 * Execute ONE agent step (P3: Workers Execute, They Do Not Orchestrate)
 *
 * This function:
 * - Receives immutable conversation context
 * - Calls LLM ONCE
 * - Returns exactly ONE decision
 * - NEVER loops
 * - NEVER executes tools
 * - NEVER decides termination
 *
 * The runtime controls what happens next.
 *
 * @param {object} input - Agent step input from runtime
 * @param {Array<{role: string, content: string}>} input.messages - Conversation history (immutable)
 * @param {Array<string>} input.availableTools - Tool names (advisory only)
 * @returns {Promise<object>} - Single agent output decision
 */
async function step(input) {
  if (!engine) {
    throw new Error('WebLLM engine not initialized. Call ready() first.')
  }

  const { messages, availableTools } = input

  console.log('[Agent Worker] Executing step with', messages.length, 'messages')

  // Build system prompt with available tools
  const systemPrompt = buildSystemPrompt(availableTools)

  // Build messages for LLM (system + conversation history)
  const llmMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ]

  // Call LLM ONCE (no loop!)
  let response
  try {
    response = await engine.chat.completions.create({
      messages: llmMessages,
      temperature: 0.0,  // Deterministic
      max_tokens: 512
    })
  } catch (error) {
    console.error('[Agent Worker] LLM call failed:', error)
    throw new Error(`LLM call failed: ${error.message}`)
  }

  const rawOutput = response.choices[0].message.content
  console.log('[Agent Worker] Raw LLM output:', rawOutput)

  // Extract and parse JSON
  const jsonText = extractJSON(rawOutput)
  let parseResult = tryParseJSON(jsonText)

  // Single-retry repair flow (if initial parse fails)
  if (!parseResult.ok) {
    console.warn('[Agent Worker] Initial parse failed, attempting repair')

    // Retry with repair prompt
    const repairMessages = [
      ...llmMessages,
      { role: 'assistant', content: rawOutput },
      { role: 'user', content: REPAIR_PROMPT }
    ]

    try {
      response = await engine.chat.completions.create({
        messages: repairMessages,
        temperature: 0.0,
        max_tokens: 512
      })

      const repairOutput = response.choices[0].message.content
      console.log('[Agent Worker] Repair output:', repairOutput)

      const repairJSON = extractJSON(repairOutput)
      parseResult = tryParseJSON(repairJSON)

      if (parseResult.ok) {
        console.log('[Agent Worker] Repair successful')
      }
    } catch (error) {
      console.error('[Agent Worker] Repair attempt failed:', error)
    }
  }

  // Deterministic fallback - never crash (P4: Deterministic Control Flow)
  if (!parseResult.ok) {
    console.warn('[Agent Worker] All parsing attempts failed, returning fallback response')
    return {
      kind: 'respond',
      message: rawOutput  // Return raw output as final response
    }
  }

  const output = parseResult.value

  // Validate output has required 'kind' field
  if (!output.kind) {
    console.warn('[Agent Worker] Missing "kind" field, treating as respond')
    return {
      kind: 'respond',
      message: output.message || JSON.stringify(output)
    }
  }

  // Validate kind is one of the expected values
  if (!['tool_call', 'handoff', 'respond'].includes(output.kind)) {
    console.warn('[Agent Worker] Unknown output kind:', output.kind)
    return {
      kind: 'respond',
      message: output.message || JSON.stringify(output)
    }
  }

  // Return the single decision
  // Runtime will decide what happens next
  console.log('[Agent Worker] Returning decision:', output.kind)
  return output
}

/**
 * Dispose of WebLLM engine and free resources
 */
async function dispose() {
  if (engine) {
    console.log('[Agent Worker] Disposing WebLLM engine')
    await engine.unload()
    engine = null
    currentModelId = null
  }
}

/**
 * Expose worker API via Comlink
 *
 * Note: Event subscription methods removed - runtime handles events
 * Worker is now a pure executor with minimal API:
 * - ready() - Initialize engine
 * - step() - Execute ONE decision step
 * - dispose() - Clean up resources
 */
expose({ ready, step, dispose })
