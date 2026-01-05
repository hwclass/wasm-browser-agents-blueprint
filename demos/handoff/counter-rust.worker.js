/**
 * Rust Counter Agent Worker
 *
 * Loads the Rust WASM counter agent using wasm-bindgen
 * Uses wasm-browser-agent-sdk for I/O validation
 *
 * WASM Contract: step(input: string) -> string
 */

import { expose } from 'comlink'
import initWasm, * as wasm from './rust/pkg/counter_rust.js'
import { createInputEvent, parseOutputEvent } from '../../src/sdk/index.ts'

let isInitialized = false

/**
 * Initialize the Rust WASM module
 */
async function ready() {
  if (!isInitialized) {
    await initWasm()
    isInitialized = true
    console.log('[Rust Worker] WASM module initialized')
  }
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

  // Create input event using SDK
  const inputJson = createInputEvent('USER_TASK', { text, word })

  console.log('[Rust Worker] Calling step() with input')

  // Call WASM step function
  const outputJson = wasm.step(inputJson)

  console.log('[Rust Worker] Received output')

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
