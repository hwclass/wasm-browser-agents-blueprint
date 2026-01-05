/**
 * Go Counter Agent Worker
 *
 * Loads the Go WASM counter agent and exposes it via Comlink.
 * Uses wasm-browser-agent-sdk for I/O validation.
 *
 * WASM Contract: globalThis.step(input: string) -> string
 */

import { expose } from 'comlink'
import { createInputEvent, parseOutputEvent } from '../../src/sdk/index.ts'

// Load Go's WASM runtime support
import './wasm/wasm_exec.js'

let isInitialized = false

/**
 * Initialize the Go WASM module
 */
async function ready() {
  if (isInitialized) {
    return
  }

  console.log('[Go Worker] Loading Go WASM module...')

  // Create Go runtime instance
  const go = new globalThis.Go()

  // Fetch WASM binary
  const wasmPath = new URL('./wasm/counter_go.wasm', import.meta.url)
  const response = await fetch(wasmPath)
  const wasmBuffer = await response.arrayBuffer()

  // Instantiate WASM module
  const result = await WebAssembly.instantiate(wasmBuffer, go.importObject)

  // Start Go program (registers step function on globalThis)
  go.run(result.instance)

  isInitialized = true
  console.log('[Go Worker] WASM module initialized')

  // Wait a bit for Go runtime to fully initialize
  await new Promise(resolve => setTimeout(resolve, 100))
}

/**
 * Execute the counter agent
 *
 * @param {string} text - The text to analyze
 * @param {string} word - The word to count
 * @returns {object} - { count: number }
 */
async function execute(text, word) {
  if (!isInitialized) {
    throw new Error('WASM module not initialized. Call ready() first.')
  }

  // Verify step function exists
  if (typeof globalThis.step !== 'function') {
    throw new Error('Go WASM step function not found on globalThis')
  }

  // Create input event using SDK
  const inputJson = createInputEvent('USER_TASK', { text, word })

  console.log('[Go Worker] Calling step() with input')

  // Call WASM step function
  const outputJson = globalThis.step(inputJson)

  console.log('[Go Worker] Received output')

  // Parse and validate output event using SDK
  const outputEvent = parseOutputEvent(outputJson)

  // Check for errors
  if (outputEvent.error) {
    throw new Error(outputEvent.error)
  }

  // Validate response kind
  if (outputEvent.kind !== 'respond') {
    throw new Error(`Unexpected output kind: ${outputEvent.kind}`)
  }

  return { count: outputEvent.count }
}

// Expose worker API via Comlink
expose({ ready, execute })
