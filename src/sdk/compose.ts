/**
 * wasm-browser-agent-sdk
 *
 * Compositional agent construction using functional composition patterns
 *
 * No classes. No inheritance. Pure composition.
 *
 * Example usage:
 *
 * const counterAgent = composeAgent(
 *   withName("counter_rust"),
 *   withInstructions("Count how many times a word appears in text."),
 *   withModel({
 *     provider: "webllm",
 *     model: "Qwen2.5-1.5B",
 *     settings: { timeout: 30 }
 *   })
 * )
 */

import type { AgentSpec, ModelSpec, ToolSpec } from './types'
import type { EventBus } from './event-bus'

/**
 * Adds name to agent specification
 */
export const withName =
  (name: string) =>
  (agent: Partial<AgentSpec>): Partial<AgentSpec> =>
    ({ ...agent, name })

/**
 * Adds instructions to agent specification
 */
export const withInstructions =
  (instructions: string) =>
  (agent: Partial<AgentSpec>): Partial<AgentSpec> =>
    ({ ...agent, instructions })

/**
 * Adds model configuration to agent specification
 */
export const withModel =
  (model: ModelSpec) =>
  (agent: Partial<AgentSpec>): Partial<AgentSpec> =>
    ({ ...agent, model })

/**
 * Adds tools to agent specification
 */
export const withTools =
  (tools: ToolSpec[]) =>
  (agent: Partial<AgentSpec>): Partial<AgentSpec> =>
    ({ ...agent, tools })

/**
 * Adds event bus to agent specification
 */
export const withEvents =
  (eventBus: EventBus) =>
  (agent: Partial<AgentSpec>): Partial<AgentSpec> =>
    ({ ...agent, eventBus })

/**
 * Composes multiple agent specification functions into a complete agent
 *
 * This is the core composition primitive.
 * Mirrors OpenAI's Agent(...) semantically but remains compositional.
 */
export const composeAgent = (
  ...fns: Array<(a: Partial<AgentSpec>) => Partial<AgentSpec>>
): AgentSpec => {
  const composed = fns.reduce((acc, fn) => fn(acc), {} as Partial<AgentSpec>)

  // Validate required fields
  if (!composed.name) {
    throw new Error("Agent must have a name (use withName)")
  }
  if (!composed.instructions) {
    throw new Error("Agent must have instructions (use withInstructions)")
  }
  if (!composed.model) {
    throw new Error("Agent must have a model (use withModel)")
  }

  return composed as AgentSpec
}

/**
 * Creates a partial agent spec from scratch
 * Useful for building base configurations
 */
export const createAgentSpec = (): Partial<AgentSpec> => ({})
