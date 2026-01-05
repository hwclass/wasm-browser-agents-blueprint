/**
 * Handoff Demo - Main Application Logic (Runtime-Controlled Routing)
 *
 * Architecture (ED-RMAE compliant for routing):
 * 1. Runtime controls triage agent orchestration
 * 2. Triage worker executes ONE routing decision
 * 3. Runtime receives handoff decision
 * 4. Main.js executes selected WASM counter (outside runtime for now)
 * 5. Results displayed to user
 *
 * Note: WASM counters (Rust/Go) are direct executors, not LLM agents,
 * so they remain outside the runtime for simplicity. The key improvement
 * is making the triage routing runtime-controlled.
 *
 * SDK Integration:
 * - Uses `createAgentRuntime()` for triage routing
 * - Triage agent is runtime-controlled (AGENTS.md P5)
 * - Worker is pure executor (AGENTS.md P3)
 * - WASM counters execute directly (they're already pure functions)
 */

import { wrap, proxy } from 'comlink'
import {
  composeAgent,
  withName,
  withInstructions,
  withModel,
  createEventBus,
  createAgentRuntime
} from '../../src/sdk/index.ts'

// Agent specifications using SDK
const triageAgentSpec = composeAgent(
  withName('triage'),
  withInstructions('Route user requests to specialized counter agents'),
  withModel({
    provider: 'webllm',
    model: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'
  })
)

const rustCounterSpec = composeAgent(
  withName('counter_rust'),
  withInstructions('Count word occurrences using high-performance Rust WASM'),
  withModel({
    provider: 'webllm',
    model: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'
  })
)

const goCounterSpec = composeAgent(
  withName('counter_go'),
  withInstructions('Count word occurrences using Go WASM'),
  withModel({
    provider: 'webllm',
    model: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'
  })
)

// Global state
let triageWorker = null  // WebWorker instance (Comlink-wrapped)
let rustWorker = null
let goWorker = null
let runtime = null       // Runtime instance for triage routing
let eventBus = null      // Event bus for observability

// Execution trace for debugging
const trace = []

/**
 * Initialize the application
 */
async function init() {
  const runBtn = document.getElementById('run-btn')
  const modelSelect = document.getElementById('model-select')
  const userQuery = document.getElementById('user-query')
  const textInput = document.getElementById('text-input')
  const wordInput = document.getElementById('word-input')
  const progressDiv = document.getElementById('progress')
  const progressBar = document.getElementById('progress-bar')
  const progressText = document.getElementById('progress-text')
  const resultDiv = document.getElementById('result')
  const errorDiv = document.getElementById('error')

  runBtn.addEventListener('click', async () => {
    // Clear previous results
    resultDiv.style.display = 'none'
    errorDiv.style.display = 'none'
    trace.length = 0

    const query = userQuery.value.trim()
    const text = textInput.value.trim()
    const word = wordInput.value.trim()
    const modelId = modelSelect.value

    if (!query || !text || !word) {
      showError('Please fill in all fields')
      return
    }

    // Update SDK agent specs with user-selected model
    triageAgentSpec.model.model = modelId
    rustCounterSpec.model.model = modelId
    goCounterSpec.model.model = modelId
    console.log('[Handoff Demo] Updated agent specs with model:', modelId)

    runBtn.disabled = true
    progressDiv.classList.add('active')

    try {
      addTrace('Starting agent handoff flow...')

      // Step 1: Initialize triage agent and runtime
      addTrace('Initializing triage agent with WebLLM...')
      await initTriageAgentAndRuntime(triageAgentSpec, proxy((progress) => {
        const percent = Math.round(progress.progress * 100)
        progressBar.style.width = `${percent}%`
        progressText.textContent = progress.text || `Loading model... ${percent}%`
      }))

      addTrace('✓ Triage agent ready')

      // Step 2: Route via runtime (runtime-controlled)
      progressText.textContent = 'Runtime routing request...'
      addTrace(`Triage input: "${query}"`)

      // Use runtime to execute routing (returns handoff decision)
      const routingResponse = await runtime.run(query)

      // Runtime returns the target agent name from handoff
      const selectedAgent = routingResponse

      addTrace(`✓ Selected agent: ${selectedAgent}`)

      // Step 3: Initialize selected agent
      progressText.textContent = `Initializing ${selectedAgent}...`
      addTrace(`Initializing ${selectedAgent} WASM module...`)

      let counterWorker
      if (selectedAgent === 'counter_rust') {
        counterWorker = await initRustCounter()
      } else if (selectedAgent === 'counter_go') {
        counterWorker = await initGoCounter()
      } else {
        throw new Error(`Unknown agent: ${selectedAgent}`)
      }

      addTrace(`✓ ${selectedAgent} ready`)

      // Step 4: Execute counting
      progressText.textContent = 'Counting words...'
      addTrace(`Executing: count("${word}") in text (${text.length} chars)`)

      const result = await counterWorker.execute(text, word)

      addTrace(`✓ Result: ${result.count} occurrences`)

      // Display results
      displayResult(selectedAgent, result.count)

      progressDiv.classList.remove('active')
      runBtn.disabled = false
    } catch (error) {
      console.error('Error during handoff:', error)
      showError(error.message)
      progressDiv.classList.remove('active')
      runBtn.disabled = false
    }
  })
}

/**
 * Initialize triage agent worker and runtime (Runtime-Controlled Architecture)
 */
async function initTriageAgentAndRuntime(agentSpec, progressCallback) {
  // Initialize worker if needed
  if (!triageWorker) {
    const worker = new Worker(
      new URL('./triage.worker.js', import.meta.url),
      { type: 'module' }
    )
    triageWorker = wrap(worker)
  }

  // Extract model from SDK agent spec
  const modelId = agentSpec.model.model

  // Initialize WebLLM engine in worker
  await triageWorker.ready(modelId, progressCallback)
  console.log('[Handoff Demo] Triage worker initialized with model:', modelId)

  // Create event bus for observability
  if (!eventBus) {
    eventBus = createEventBus()
    setupRuntimeEventListeners()
  }

  // Create runtime instance for triage routing
  // Runtime will handle the handoff decision, then we execute WASM counter outside runtime
  runtime = createAgentRuntime({
    agents: {
      [agentSpec.name]: agentSpec
    },
    entryAgent: agentSpec.name,
    maxSteps: 10,  // Single routing decision + response
    eventBus,
    workerFactory: async (agentName) => {
      console.log('[Handoff Demo] Creating worker instance for:', agentName)

      // Return worker adapter conforming to AgentWorker interface
      return {
        async step(input) {
          // Delegate to Comlink-wrapped worker
          return await triageWorker.step(input)
        },
        async dispose() {
          await triageWorker.dispose()
        }
      }
    }
  })

  console.log('[Handoff Demo] Runtime created for triage routing:', {
    name: agentSpec.name,
    model: modelId
  })
}

/**
 * Set up event listeners for runtime events
 */
function setupRuntimeEventListeners() {
  // Subscribe to runtime events
  eventBus.on('runtime.event', (event) => {
    console.log('[Runtime Event]', event.type, event)

    switch (event.type) {
      case 'runtime.started':
        addTrace('▶️ Runtime started (routing)')
        break

      case 'agent.invoked':
        addTrace(`💭 Triage agent invoked (Step ${event.step})`)
        break

      case 'agent.output':
        if (event.output.kind === 'handoff') {
          addTrace(`🔄 Handoff decision: → ${event.output.target}`)
          displayRoutingDecision(event.output.target)
        }
        break

      case 'runtime.completed':
        addTrace('✅ Routing completed')
        break

      case 'runtime.failed':
        addTrace(`❌ Runtime failed: ${event.error}`)
        break
    }
  })

  console.log('[Handoff Demo] Runtime event listeners set up')
}

/**
 * Initialize Rust counter worker
 */
async function initRustCounter() {
  if (!rustWorker) {
    const worker = new Worker(
      new URL('./counter-rust.worker.js', import.meta.url),
      { type: 'module' }
    )
    rustWorker = wrap(worker)
  }

  await rustWorker.ready()
  return rustWorker
}

/**
 * Initialize Go counter worker
 */
async function initGoCounter() {
  if (!goWorker) {
    const worker = new Worker(
      new URL('./counter-go.worker.js', import.meta.url),
      { type: 'module' }
    )
    goWorker = wrap(worker)
  }

  await goWorker.ready()
  return goWorker
}

/**
 * Add item to execution trace
 */
function addTrace(message) {
  trace.push({
    timestamp: new Date().toISOString(),
    message
  })
  console.log('[Trace]', message)
}

/**
 * Display routing decision visualization
 */
function displayRoutingDecision(selectedAgent) {
  const routingDecisionDiv = document.getElementById('routing-decision')
  const routingFlow = document.getElementById('routing-flow')
  const routingReason = document.getElementById('routing-reason')

  const agentLabel = selectedAgent === 'counter_rust' ? 'Rust Counter' : 'Go Counter'
  const agentType = selectedAgent.includes('rust') ? 'rust' : 'go'

  routingFlow.innerHTML = `
    <div class="routing-box triage">Triage Agent</div>
    <div class="routing-arrow">→</div>
    <div class="routing-box selected ${agentType}">${agentLabel}</div>
  `

  const reasons = {
    counter_rust: 'Selected for high-performance requirements, large text processing, or explicit performance mentions in the query',
    counter_go: 'Selected for simplicity, portability, small text processing, or when ease of use is prioritized'
  }

  routingReason.innerHTML = `<strong>Why this agent?</strong> ${reasons[selectedAgent]}`
  routingDecisionDiv.classList.add('active')
}

/**
 * Display successful result
 */
function displayResult(selectedAgent, count) {
  const resultDiv = document.getElementById('result')
  const selectedAgentDiv = document.getElementById('selected-agent')
  const countDisplay = document.getElementById('count-display')
  const traceDiv = document.getElementById('trace')

  // Agent badge
  const agentType = selectedAgent.includes('rust') ? 'rust' : 'go'
  const agentLabel = selectedAgent === 'counter_rust' ? 'Rust Counter' : 'Go Counter'

  selectedAgentDiv.innerHTML = `
    <span class="agent-badge ${agentType}">
      ${agentLabel}
    </span>
  `

  // Count result
  countDisplay.innerHTML = `
    <div class="count-result">${count}</div>
    <p>occurrence(s) found</p>
  `

  // Execution trace
  traceDiv.innerHTML = '<strong>Execution Trace:</strong><br>' +
    trace.map(item => `
      <div class="trace-item">
        <small>${item.timestamp.split('T')[1].split('.')[0]}</small> ${item.message}
      </div>
    `).join('')

  resultDiv.style.display = 'block'
}

/**
 * Display error message
 */
function showError(message) {
  const errorDiv = document.getElementById('error')
  errorDiv.textContent = `Error: ${message}`
  errorDiv.style.display = 'block'
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
