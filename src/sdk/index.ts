/**
 * wasm-browser-agent-sdk
 *
 * A browser-native agent SDK that enables:
 * - Agent definition via composition
 * - Execution via WebWorkers
 * - Agent logic in WASM (Rust, Go, JS, Python)
 * - Handoff (triage → specialist) and tool calling
 * - No remote LLM APIs (WebLLM only)
 *
 * This is not a framework. It's a blueprint-level runtime + composition layer.
 *
 * Design principles:
 * - Composition over classes (functional patterns)
 * - Agents are decision engines, not environments
 * - SDK ≠ Runtime ≠ Demo
 */

// Types
export type {
  AgentSpec,
  ModelSpec,
  ToolSpec,
  JSONSchema,
  AgentInputEvent,
  AgentOutputEvent,
  AgentInputEventType,
  AgentOutputKind,
  ValidationResult
} from './types'

// Composition API
export {
  composeAgent,
  withName,
  withInstructions,
  withModel,
  withTools,
  withEvents,
  createAgentSpec
} from './compose'

// Event System
export { createEventBus } from './event-bus'
export type { EventBus, EventHandler, EventSubscription } from './event-bus'
export { AgentEvents } from './events'
export type {
  AgentInitializedEvent,
  AgentReadyEvent,
  AgentErrorEvent,
  AgentDisposedEvent,
  AgentExecutionStartedEvent,
  AgentExecutionCompletedEvent,
  AgentExecutionFailedEvent,
  AgentToolCallEvent,
  AgentToolResultEvent,
  AgentToolErrorEvent,
  AgentRoutingStartedEvent,
  AgentRoutingCompletedEvent,
  AgentHandoffEvent,
  AgentProgressEvent,
  AgentThinkingEvent,
  AgentEventMap,
  EventData
} from './events'

// Validation utilities
export {
  validateInputEvent,
  validateOutputEvent,
  validateAgainstSchema,
  createInputEvent,
  createOutputEvent,
  parseInputEvent,
  parseOutputEvent
} from './validation'

// Runtime (ED-RMAE Architecture)
export { createAgentRuntime } from './runtime'
export type {
  AgentRuntime,
  AgentRuntimeConfig,
  AgentRuntimeState,
  AgentRuntimeEvent,
  AgentStepInput,
  AgentOutput,
  Message,
  ToolExecutor,
  AgentWorker,
  AgentWorkerFactory
} from './runtime-types'
