/**
 * Tool-Calling Demo - Main Application Logic (Runtime-Controlled)
 *
 * Architecture (ED-RMAE compliant):
 * 1. Runtime controls all orchestration (no worker loops)
 * 2. Worker executes ONE step per invocation
 * 3. Runtime executes tools (not worker)
 * 4. Events drive all control flow
 * 5. State is explicit and inspectable
 *
 * Flow:
 * 1. User submits request
 * 2. Runtime invokes agent worker with conversation context
 * 3. Worker returns single decision (tool_call | respond)
 * 4. Runtime executes tools and updates state
 * 5. Runtime decides continuation vs termination
 * 6. Results displayed to user
 *
 * SDK Integration:
 * - Uses `createAgentRuntime()` to create runtime instance
 * - Runtime controls execution loop (AGENTS.md P5)
 * - Tools owned by runtime (AGENTS.md P2)
 * - Worker is pure executor (AGENTS.md P3)
 */

import { wrap, proxy } from 'comlink'
import {
  composeAgent,
  withName,
  withInstructions,
  withModel,
  withTools,
  createEventBus,
  createAgentRuntime
} from '../../src/sdk/index.ts'
import { TOOLS, toolExecutor } from './tools.js'

// Agent specification using SDK
const toolCallingAgentSpec = composeAgent(
  withName('tool_calling_agent'),
  withInstructions('Analyze user requests and autonomously use available tools to provide helpful responses'),
  withModel({
    provider: 'webllm',
    model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    settings: {
      temperature: 0.0,
      max_tokens: 512
    }
  }),
  withTools(TOOLS)
)

// Global state
let agentWorker = null  // WebWorker instance (Comlink-wrapped)
let runtime = null       // Runtime instance
let eventBus = null      // Event bus for observability

/**
 * Initialize the application
 */
async function init() {
  const runBtn = document.getElementById('run-btn')
  const modelSelect = document.getElementById('model-select')
  const userInput = document.getElementById('user-input')
  const progressDiv = document.getElementById('progress')
  const progressBar = document.getElementById('progress-bar')
  const progressText = document.getElementById('progress-text')
  const resultDiv = document.getElementById('result')
  const errorDiv = document.getElementById('error')

  // Example query click handlers
  const exampleQueries = document.querySelectorAll('.example-query')
  exampleQueries.forEach(example => {
    example.addEventListener('click', () => {
      const query = example.getAttribute('data-query')
      userInput.value = query
    })
  })

  runBtn.addEventListener('click', async () => {
    // Clear previous results
    resultDiv.style.display = 'none'
    errorDiv.style.display = 'none'

    // Clear and show activity log
    const activityLogDiv = document.getElementById('activity-log')
    const activityLogEntries = document.getElementById('activity-log-entries')
    activityLogEntries.innerHTML = ''
    activityLogDiv.classList.add('active')

    const request = userInput.value.trim()
    const modelId = modelSelect.value

    if (!request) {
      showError('Please enter a request')
      return
    }

    // Update SDK agent spec with user-selected model
    toolCallingAgentSpec.model.model = modelId
    console.log('[Main] Updated agent spec with model:', modelId)

    runBtn.disabled = true
    progressDiv.classList.add('active')

    try {
      // Initialize agent worker and runtime
      progressText.textContent = 'Initializing agent with WebLLM...'
      await initAgentAndRuntime(toolCallingAgentSpec, proxy((progress) => {
        const percent = Math.round(progress.progress * 100)
        progressBar.style.width = `${percent}%`
        progressText.textContent = progress.text || `Loading model... ${percent}%`
      }))

      // Execute via runtime (runtime-controlled execution)
      progressText.textContent = 'Runtime executing agent...'
      progressBar.style.width = '100%'

      console.log('[Main] Runtime executing with request:', request)
      const response = await runtime.run(request)

      console.log('[Main] Runtime execution complete:', response)

      // Get execution state for display
      const state = runtime.getState()

      // Display results
      displayRuntimeResult(response, state)

      progressDiv.classList.remove('active')
      runBtn.disabled = false
    } catch (error) {
      console.error('[Main] Error during execution:', error)
      showError(error.message)
      progressDiv.classList.remove('active')
      runBtn.disabled = false
    }
  })
}

/**
 * Initialize agent worker and runtime (Runtime-Controlled Architecture)
 */
async function initAgentAndRuntime(agentSpec, progressCallback) {
  // Initialize worker if needed
  if (!agentWorker) {
    const worker = new Worker(
      new URL('./agent.worker.js', import.meta.url),
      { type: 'module' }
    )
    agentWorker = wrap(worker)
  }

  // Extract model from SDK agent spec
  const modelId = agentSpec.model.model

  // Initialize WebLLM engine in worker
  await agentWorker.ready(modelId, progressCallback)
  console.log('[Main] Worker initialized with model:', modelId)

  // Create event bus for observability
  if (!eventBus) {
    eventBus = createEventBus()
    setupRuntimeEventListeners()
  }

  // Create runtime instance (ED-RMAE Architecture)
  // Runtime owns orchestration, tools, and execution loop
  const toolsRecord = {}
  TOOLS.forEach(tool => {
    toolsRecord[tool.name] = tool
  })

  runtime = createAgentRuntime({
    agents: {
      [agentSpec.name]: agentSpec
    },
    tools: toolsRecord,
    entryAgent: agentSpec.name,
    maxSteps: 50,
    eventBus,
    toolExecutor,
    workerFactory: async (agentName) => {
      console.log('[Main] Creating worker instance for:', agentName)

      // Return worker adapter conforming to AgentWorker interface
      return {
        async step(input) {
          // Delegate to Comlink-wrapped worker
          return await agentWorker.step(input)
        },
        async dispose() {
          await agentWorker.dispose()
        }
      }
    }
  })

  console.log('[Main] Runtime created with config:', {
    name: agentSpec.name,
    instructions: agentSpec.instructions,
    model: modelId,
    tools: agentSpec.tools?.map(t => t.name),
    maxSteps: 50
  })
}

/**
 * Set up event listeners for runtime events
 * (Events drive control flow, not just log it - AGENTS.md P1)
 */
function setupRuntimeEventListeners() {
  // Subscribe to runtime events
  eventBus.on('runtime.event', (event) => {
    console.log('[Runtime Event]', event.type, event)

    switch (event.type) {
      case 'runtime.started':
        addActivityLog('▶️ Runtime started', {
          timestamp: Date.now(),
          traceId: event.state.traceId,
          agent: event.state.currentAgent
        })
        break

      case 'agent.invoked':
        addActivityLog(`💭 Agent invoked (Step ${event.step})`, {
          timestamp: Date.now(),
          agent: event.agent,
          step: event.step
        })
        break

      case 'agent.output':
        addActivityLog(`🔄 Agent decision: ${event.output.kind}`, {
          timestamp: Date.now(),
          kind: event.output.kind,
          step: event.step
        })
        break

      case 'tool.executed':
        addActivityLog(`🔧 Tool executed: ${event.tool}`, {
          timestamp: Date.now(),
          tool: event.tool,
          result: event.result,
          step: event.step
        })
        break

      case 'runtime.completed':
        addActivityLog('✅ Runtime completed', {
          timestamp: Date.now(),
          result: event.result
        })
        break

      case 'runtime.failed':
        addActivityLog('❌ Runtime failed', {
          timestamp: Date.now(),
          error: event.error
        })
        break
    }
  })

  console.log('[Main] Runtime event listeners set up')
}

/**
 * Add entry to activity log
 */
function addActivityLog(message, data) {
  console.log('[Activity Log]', message, data)

  const activityLogEntries = document.getElementById('activity-log-entries')
  if (!activityLogEntries) return

  const entry = document.createElement('div')
  entry.className = 'activity-entry'

  const time = new Date(data.timestamp).toLocaleTimeString()
  entry.innerHTML = `
    <span class="time">${time}</span>
    <span class="message">${message}</span>
  `

  activityLogEntries.appendChild(entry)

  // Auto-scroll to bottom
  activityLogEntries.scrollTop = activityLogEntries.scrollHeight
}

/**
 * Display runtime execution results
 * (Displays results from runtime-controlled execution)
 */
function displayRuntimeResult(response, state) {
  const resultDiv = document.getElementById('result')
  const responseDiv = document.getElementById('response')
  const toolCallsSection = document.getElementById('tool-calls-section')
  const toolCallsDiv = document.getElementById('tool-calls')
  const statTools = document.getElementById('stat-tools')
  const statTurns = document.getElementById('stat-turns')

  // Display response
  responseDiv.innerHTML = formatResponse(response)

  // Extract tool calls from conversation messages
  const toolCalls = []
  for (let i = 0; i < state.messages.length; i++) {
    const msg = state.messages[i]
    if (msg.role === 'assistant' && msg.content.includes('"kind":"tool_call"')) {
      try {
        const decision = JSON.parse(msg.content)
        if (decision.kind === 'tool_call') {
          // Find corresponding tool result
          let result = null
          if (i + 1 < state.messages.length && state.messages[i + 1].role === 'user') {
            try {
              const resultMsg = JSON.parse(state.messages[i + 1].content)
              if (resultMsg.type === 'TOOL_RESULT') {
                result = resultMsg.payload.result
              }
            } catch (e) {
              // Not a tool result message
            }
          }

          toolCalls.push({
            name: decision.tool,
            args: decision.args,
            result
          })
        }
      } catch (e) {
        // Not a tool call message
      }
    }
  }

  // Display tool calls
  if (toolCalls.length > 0) {
    toolCallsSection.style.display = 'block'
    toolCallsDiv.innerHTML = toolCalls.map((call, index) => {
      return `
        <div class="tool-call">
          <div class="tool-call-header">
            ${index + 1}. ${call.name}
          </div>
          <div>
            <strong>Arguments:</strong>
            <div class="tool-call-args">${JSON.stringify(call.args, null, 2)}</div>
          </div>
          <div>
            <strong>Result:</strong>
            <div class="tool-call-result">${formatToolResult(call.result)}</div>
          </div>
        </div>
      `
    }).join('')
  } else {
    toolCallsSection.style.display = 'none'
  }

  // Display stats
  statTools.textContent = toolCalls.length
  statTurns.textContent = state.stepCount

  // Show warning if max steps reached
  if (state.stepCount >= 50) {
    responseDiv.innerHTML += `
      <div style="margin-top: 1em; padding: 1em; background: #fff3cd; border-radius: 4px; color: #856404;">
        ⚠️ Maximum execution steps reached (${state.stepCount}). The agent may not have completed the task fully.
      </div>
    `
  }

  resultDiv.style.display = 'block'
}

/**
 * Format response text with markdown-like rendering
 */
function formatResponse(text) {
  if (!text) {
    return '<em>No response generated</em>'
  }

  // Simple formatting
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/`(.*?)`/g, '<code>$1</code>') // Code
    .replace(/\n/g, '<br>') // Line breaks

  return formatted
}

/**
 * Format tool result for display
 */
function formatToolResult(result) {
  if (!result) {
    return '<em>No result</em>'
  }

  if (result.error) {
    return `<span style="color: #dc3545;">❌ Error: ${result.error}</span>`
  }

  // Extract message if available
  if (result.message) {
    return result.message
  }

  // Pretty-print JSON
  return `<pre style="margin: 0; white-space: pre-wrap;">${JSON.stringify(result, null, 2)}</pre>`
}

/**
 * Display error message
 */
function showError(message) {
  const errorDiv = document.getElementById('error')
  errorDiv.innerHTML = `
    <strong>Error:</strong> ${message}
  `
  errorDiv.style.display = 'block'
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
