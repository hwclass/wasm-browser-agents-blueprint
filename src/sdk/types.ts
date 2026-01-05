/**
 * wasm-browser-agent-sdk
 *
 * Core type definitions for compositional agent construction.
 * This SDK follows functional composition principles:
 * - No deep inheritance
 * - Pure functions
 * - Behavior assembled via small composable units
 */

import type { EventBus } from './event-bus'

/**
 * JSON Schema type for tool parameters
 */
export type JSONSchema = {
  type: string
  properties?: Record<string, any>
  required?: string[]
  additionalProperties?: boolean
  [key: string]: any
}

/**
 * Tool specification for agent capabilities
 */
export type ToolSpec = {
  name: string
  description: string
  parameters: JSONSchema
  handler: (args: any) => Promise<any>
}

/**
 * Model configuration for WebLLM
 */
export type ModelSpec = {
  provider: "webllm"
  model: string
  settings?: {
    temperature?: number
    max_tokens?: number
    timeout?: number
  }
}

/**
 * Complete agent specification
 * Constructed via composition, not classes
 */
export type AgentSpec = {
  name: string
  instructions: string
  model: ModelSpec
  tools?: ToolSpec[]
  eventBus?: EventBus
}

/**
 * Agent input event types
 */
export type AgentInputEventType = "USER_TASK" | "TOOL_RESULT" | "HANDOFF_RESULT"

/**
 * Agent output action kinds
 */
export type AgentOutputKind = "respond" | "tool_call" | "handoff"

/**
 * Input event structure (runtime → agent)
 */
export type AgentInputEvent = {
  type: AgentInputEventType
  payload: any
}

/**
 * Output event structure (agent → runtime)
 */
export type AgentOutputEvent = {
  kind: AgentOutputKind
  message?: string
  tool?: string
  args?: any
  to?: string
  count?: number
  error?: string
  [key: string]: any
}

/**
 * Validation result for agent I/O
 */
export type ValidationResult = {
  valid: boolean
  error?: string
}
