/**
 * Runtime Type Definitions
 *
 * Defines the core types for the Event-Driven, Runtime-Mediated Agent Execution (ED-RMAE) architecture.
 *
 * Key principles:
 * - State is explicit and immutable
 * - Events drive control flow
 * - No agent-to-agent communication
 * - Runtime owns orchestration
 */

import type { AgentSpec, ToolSpec, AgentOutputKind } from './types'
import type { EventBus } from './event-bus'

/**
 * Message in conversation history
 * Immutable snapshot of conversation state
 */
export type Message = {
  readonly role: string
  readonly content: string
}

/**
 * Agent step input (passed to worker on each invocation)
 * Workers treat this as immutable context, NOT loop state
 */
export type AgentStepInput = {
  readonly messages: ReadonlyArray<Message>
  readonly availableTools: ReadonlyArray<string>
}

/**
 * Agent output (returned by worker on each step)
 * Exactly one action per output
 *
 * Note: AgentOutputKind is imported from types.ts to avoid duplication
 */
export type AgentOutput =
  | { kind: 'tool_call'; tool: string; args: unknown }
  | { kind: 'handoff'; target: string }
  | { kind: 'respond'; message: string }

/**
 * Runtime execution state
 * Explicit, inspectable, owned by runtime only
 */
export type AgentRuntimeState = {
  readonly traceId: string
  readonly currentAgent: string
  readonly stepCount: number
  readonly messages: ReadonlyArray<Message>
  readonly context: unknown
  readonly status: 'idle' | 'running' | 'completed' | 'failed'
}

/**
 * Runtime event types
 * Events as data, not callbacks
 * Events drive execution, not merely log it
 */
export type AgentRuntimeEvent =
  | { type: 'runtime.started'; state: AgentRuntimeState }
  | { type: 'agent.invoked'; agent: string; step: number }
  | { type: 'agent.output'; output: AgentOutput; step: number }
  | { type: 'tool.executed'; tool: string; result: unknown; step: number }
  | { type: 'runtime.completed'; result: unknown; finalState: AgentRuntimeState }
  | { type: 'runtime.failed'; error: string; finalState: AgentRuntimeState }

/**
 * Tool executor interface
 * Tools are runtime-owned, not agent-owned
 * Execution is observable via events
 */
export type ToolExecutor = {
  execute(
    toolName: string,
    args: unknown,
    meta: { traceId: string; step: number }
  ): Promise<unknown>
}

/**
 * Agent worker interface
 * Workers are stateless executors that perform exactly one step
 *
 * CRITICAL: Workers must NOT:
 * - contain loops
 * - execute tools
 * - decide termination
 * - route to other agents
 * - mutate state
 */
export type AgentWorker = {
  /**
   * Execute exactly one decision step
   * Returns a single structured output
   */
  step(input: AgentStepInput): Promise<AgentOutput>

  /**
   * Dispose of worker resources
   */
  dispose(): Promise<void>
}

/**
 * Agent worker factory
 * Creates worker instances on demand
 */
export type AgentWorkerFactory = (agentName: string) => Promise<AgentWorker>

/**
 * Runtime configuration
 * Pure data, no functions
 */
export type AgentRuntimeConfig = {
  /**
   * Agent specifications by name
   */
  readonly agents: Record<string, AgentSpec>

  /**
   * Tool specifications (optional)
   */
  readonly tools?: Record<string, ToolSpec>

  /**
   * Entry agent name (where execution starts)
   */
  readonly entryAgent: string

  /**
   * Maximum execution steps (prevents infinite loops)
   * Default: 50
   */
  readonly maxSteps?: number

  /**
   * Event bus for observability
   */
  readonly eventBus?: EventBus

  /**
   * Tool executor (injected from demo)
   */
  readonly toolExecutor?: ToolExecutor

  /**
   * Agent worker factory
   * Creates worker instances for agents
   */
  readonly workerFactory: AgentWorkerFactory
}

/**
 * Runtime capability interface
 * State lives in closures, not object fields
 * No stateful OOP - functional composition only
 */
export type AgentRuntime = {
  /**
   * Configuration (immutable reference)
   */
  readonly config: AgentRuntimeConfig

  /**
   * Get current execution state
   * State is explicit and inspectable
   */
  getState(): AgentRuntimeState

  /**
   * Dispatch a runtime event
   * Events drive control flow
   */
  dispatch(event: AgentRuntimeEvent): void

  /**
   * Run agent execution
   * Runtime controls the loop, not agents
   *
   * @param input - Initial user input
   * @returns Final response
   */
  run(input: string): Promise<string>

  /**
   * Dispose of runtime resources
   */
  dispose(): Promise<void>
}
