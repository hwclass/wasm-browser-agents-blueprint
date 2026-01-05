/**
 * Triage Agent Worker (ED-RMAE Compliant)
 *
 * This worker is a PURE EXECUTOR that:
 * - Executes exactly ONE routing decision
 * - Returns exactly ONE structured output (handoff decision)
 * - NEVER contains loops
 * - NEVER calls other agents
 * - NEVER decides continuation
 *
 * The runtime controls handoff execution.
 *
 * Architectural compliance:
 * - P3: Workers Execute, They Do Not Orchestrate
 * - P5: Runtime-Controlled Agent Loop
 * - P6: Strict Contracts, Loose Implementation
 *
 * Available routes:
 * - counter_rust: Rust-based word counter (performance-focused)
 * - counter_go: Go-based word counter (simplicity-focused)
 */

import { expose } from 'comlink'
import { CreateMLCEngine } from '@mlc-ai/web-llm'

let engine = null
let currentModelId = null

// JSON schema for triage routing (MANDATORY validation)
const ROUTING_SCHEMA = {
  type: 'object',
  properties: {
    selected_agent: {
      type: 'string',
      enum: ['counter_rust', 'counter_go']
    }
  },
  required: ['selected_agent'],
  additionalProperties: false
}

// System prompt for triage agent
const SYSTEM_PROMPT = `You are a routing agent that distributes work between two specialized word-counting agents.

Your task: select which agent should handle the user's request.

Available agents:
- counter_rust: Rust-based word counter (high performance, memory safe, best for large texts or when speed is mentioned)
- counter_go: Go-based word counter (simple, portable, best for general use or when simplicity is mentioned)

Routing rules:
1. If the request mentions "performance", "fast", "speed", "large text", or "optimize" → choose counter_rust
2. If the request mentions "simple", "easy", "portable", "demo", or "Go" → choose counter_go
3. If the text to analyze is longer than 100 characters → choose counter_rust (better for large texts)
4. If the text to analyze is shorter than 100 characters → choose counter_go (overhead not worth it)
5. If none of the above apply, alternate based on request content to demonstrate both agents

You MUST output ONLY valid JSON matching this exact format:
{"selected_agent":"counter_rust"}
or
{"selected_agent":"counter_go"}

No explanation. No markdown. No extra text. Just the JSON object.`

// Repair prompt (used if first attempt fails validation)
const REPAIR_PROMPT = `Your previous response was invalid.

You must output ONLY a JSON object matching this schema:
{"selected_agent":"counter_rust" | "counter_go"}

No explanation. No extra text.`

/**
 * Initialize WebLLM engine with specified model
 *
 * @param {string} modelId - WebLLM model identifier
 * @param {function} progressCallback - Progress updates during model loading
 */
async function ready(modelId, progressCallback) {
  // Dispose existing engine if model changed
  if (engine && currentModelId !== modelId) {
    console.log('[Triage Worker] Model changed, disposing old engine')
    await engine.unload()
    engine = null
  }

  if (!engine) {
    console.log(`[Triage Worker] Initializing WebLLM engine with model: ${modelId}`)

    engine = await CreateMLCEngine(modelId, {
      initProgressCallback: progressCallback
    })

    currentModelId = modelId
    console.log('[Triage Worker] WebLLM engine ready')
  }
}

/**
 * Execute ONE routing decision step (P3: Workers Execute, They Do Not Orchestrate)
 *
 * This function:
 * - Receives user request from conversation context
 * - Calls LLM ONCE to make routing decision
 * - Returns exactly ONE handoff decision
 * - NEVER loops
 * - NEVER calls other agents
 *
 * The runtime decides what happens after routing.
 *
 * @param {object} input - Agent step input from runtime
 * @param {Array<{role: string, content: string}>} input.messages - Conversation history (immutable)
 * @param {Array<string>} input.availableTools - Not used for triage (no tools)
 * @returns {Promise<object>} - Single routing decision: { kind: 'handoff', target: 'counter_rust' | 'counter_go' }
 */
async function step(input) {
  if (!engine) {
    throw new Error('WebLLM engine not initialized. Call ready() first.')
  }

  const { messages } = input

  console.log('[Triage Worker] Executing routing step with', messages.length, 'messages')

  // Extract user input from first message
  const userMessage = messages.find(m => m.role === 'user')
  if (!userMessage) {
    throw new Error('No user message found in conversation')
  }

  const userInput = userMessage.content
  console.log('[Triage Worker] Routing request:', userInput)

  // Call LLM ONCE (no loop!)
  let response
  try {
    response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userInput }
      ],
      temperature: 0.0, // Deterministic routing
      max_tokens: 50
    })
  } catch (error) {
    console.error('[Triage Worker] LLM call failed:', error)
    throw new Error(`Failed to call LLM: ${error.message}`)
  }

  const rawOutput = response.choices[0].message.content.trim()
  console.log('[Triage Worker] Raw LLM output:', rawOutput)

  // Extract JSON from response (handle markdown code blocks)
  let jsonText = extractJSON(rawOutput)

  // Parse JSON
  let routing
  try {
    routing = JSON.parse(jsonText)
  } catch (error) {
    console.error('[Triage Worker] Failed to parse JSON:', jsonText)

    // Attempt repair with second LLM call (single retry)
    console.log('[Triage Worker] Attempting repair...')
    routing = await attemptRepair(rawOutput)
  }

  // Validate against schema
  const validation = validateRouting(routing)
  if (!validation.valid) {
    console.error('[Triage Worker] Validation failed:', validation.error)

    // If initial parse succeeded but validation failed, try repair
    if (routing) {
      console.log('[Triage Worker] Attempting repair...')
      routing = await attemptRepair(rawOutput)

      // Re-validate after repair
      const revalidation = validateRouting(routing)
      if (!revalidation.valid) {
        // Fallback: return default routing
        console.warn('[Triage Worker] Repair failed, using fallback routing')
        return {
          kind: 'handoff',
          target: 'counter_rust' // Default fallback
        }
      }
    }
  }

  const selectedAgent = routing.selected_agent
  console.log('[Triage Worker] Selected agent:', selectedAgent)

  // Return handoff decision (runtime will handle the handoff)
  return {
    kind: 'handoff',
    target: selectedAgent
  }
}

/**
 * Extract JSON from text that might contain markdown code blocks
 */
function extractJSON(text) {
  // Remove markdown code blocks if present
  if (text.includes('```json')) {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (match) {
      return match[1].trim()
    }
  } else if (text.includes('```')) {
    const match = text.match(/```\s*([\s\S]*?)\s*```/)
    if (match) {
      return match[1].trim()
    }
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
 * Attempt to repair invalid routing response
 *
 * @param {string} previousOutput - The invalid output from first attempt
 * @returns {Promise<object>} - Routing decision object
 */
async function attemptRepair(previousOutput) {
  console.log('[Triage Worker] Sending repair prompt')

  const response = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'assistant', content: previousOutput },
      { role: 'user', content: REPAIR_PROMPT }
    ],
    temperature: 0.0,
    max_tokens: 50
  })

  const rawOutput = response.choices[0].message.content.trim()
  console.log('[Triage Worker] Repair output:', rawOutput)

  // Extract JSON
  const jsonText = extractJSON(rawOutput)

  // Parse and validate
  let routing
  try {
    routing = JSON.parse(jsonText)
  } catch (error) {
    throw new Error(`Repair failed: invalid JSON after repair attempt`)
  }

  const validation = validateRouting(routing)
  if (!validation.valid) {
    throw new Error(`Repair failed: ${validation.error}`)
  }

  console.log('[Triage Worker] Repair successful:', routing.selected_agent)
  return routing
}

/**
 * Validate routing decision against schema
 *
 * @param {any} routing - Parsed routing decision
 * @returns {object} - { valid: boolean, error?: string }
 */
function validateRouting(routing) {
  if (typeof routing !== 'object' || routing === null) {
    return { valid: false, error: 'Expected object' }
  }

  if (!('selected_agent' in routing)) {
    return { valid: false, error: 'Missing required field: selected_agent' }
  }

  const validAgents = ROUTING_SCHEMA.properties.selected_agent.enum
  if (!validAgents.includes(routing.selected_agent)) {
    return {
      valid: false,
      error: `Invalid agent: must be one of ${validAgents.join(', ')}`
    }
  }

  // Check for additional properties
  const allowedKeys = ['selected_agent']
  for (const key of Object.keys(routing)) {
    if (!allowedKeys.includes(key)) {
      return { valid: false, error: `Unexpected property: ${key}` }
    }
  }

  return { valid: true }
}

/**
 * Dispose of WebLLM engine and free resources
 */
async function dispose() {
  if (engine) {
    console.log('[Triage Worker] Disposing WebLLM engine')
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
 * - step() - Execute ONE routing decision
 * - dispose() - Clean up resources
 */
expose({ ready, step, dispose })
