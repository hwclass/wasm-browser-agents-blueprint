/**
 * wasm-browser-agent-sdk
 *
 * Validation utilities for agent I/O protocol
 *
 * Agents must conform to the contract:
 *   step(input: string): string
 *
 * Where input/output are JSON strings matching the protocol.
 */

import type {
  AgentInputEvent,
  AgentOutputEvent,
  ValidationResult,
  JSONSchema
} from './types'

/**
 * Validates agent input event structure
 */
export function validateInputEvent(input: string): ValidationResult {
  try {
    const parsed = JSON.parse(input)

    if (!parsed.type) {
      return { valid: false, error: "Missing 'type' field" }
    }

    const validTypes = ["USER_TASK", "TOOL_RESULT", "HANDOFF_RESULT"]
    if (!validTypes.includes(parsed.type)) {
      return { valid: false, error: `Invalid type: ${parsed.type}` }
    }

    if (!parsed.payload) {
      return { valid: false, error: "Missing 'payload' field" }
    }

    return { valid: true }
  } catch (e) {
    return { valid: false, error: `Invalid JSON: ${e}` }
  }
}

/**
 * Validates agent output event structure
 */
export function validateOutputEvent(output: string): ValidationResult {
  try {
    const parsed = JSON.parse(output)

    if (!parsed.kind) {
      return { valid: false, error: "Missing 'kind' field" }
    }

    const validKinds = ["respond", "tool_call", "handoff"]
    if (!validKinds.includes(parsed.kind)) {
      return { valid: false, error: `Invalid kind: ${parsed.kind}` }
    }

    // Validate kind-specific requirements
    if (parsed.kind === "tool_call") {
      if (!parsed.tool) {
        return { valid: false, error: "tool_call requires 'tool' field" }
      }
    }

    if (parsed.kind === "handoff") {
      if (!parsed.to) {
        return { valid: false, error: "handoff requires 'to' field" }
      }
    }

    return { valid: true }
  } catch (e) {
    return { valid: false, error: `Invalid JSON: ${e}` }
  }
}

/**
 * Validates object against JSON Schema
 * Simplified validation for demo purposes
 */
export function validateAgainstSchema(
  data: any,
  schema: JSONSchema
): ValidationResult {
  if (schema.type === "object") {
    if (typeof data !== "object" || data === null) {
      return { valid: false, error: "Expected object" }
    }

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data)) {
          return { valid: false, error: `Missing required field: ${field}` }
        }
      }
    }

    // Check enum constraints
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data && propSchema.enum) {
          if (!propSchema.enum.includes(data[key])) {
            return {
              valid: false,
              error: `Invalid value for ${key}: must be one of ${propSchema.enum.join(", ")}`
            }
          }
        }
      }
    }

    // Check additionalProperties
    if (schema.additionalProperties === false && schema.properties) {
      const allowedKeys = Object.keys(schema.properties)
      for (const key of Object.keys(data)) {
        if (!allowedKeys.includes(key)) {
          return {
            valid: false,
            error: `Unexpected property: ${key}`
          }
        }
      }
    }
  }

  return { valid: true }
}

/**
 * Creates a well-formed input event
 */
export function createInputEvent(
  type: AgentInputEvent['type'],
  payload: any
): string {
  const event: AgentInputEvent = { type, payload }
  return JSON.stringify(event)
}

/**
 * Creates a well-formed output event
 */
export function createOutputEvent(
  kind: AgentOutputEvent['kind'],
  data: Partial<AgentOutputEvent>
): string {
  const event: AgentOutputEvent = { kind, ...data }
  return JSON.stringify(event)
}

/**
 * Parses and validates input event
 */
export function parseInputEvent(input: string): AgentInputEvent {
  const validation = validateInputEvent(input)
  if (!validation.valid) {
    throw new Error(`Invalid input event: ${validation.error}`)
  }
  return JSON.parse(input)
}

/**
 * Parses and validates output event
 */
export function parseOutputEvent(output: string): AgentOutputEvent {
  const validation = validateOutputEvent(output)
  if (!validation.valid) {
    throw new Error(`Invalid output event: ${validation.error}`)
  }
  return JSON.parse(output)
}
