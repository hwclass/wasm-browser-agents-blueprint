/**
 * Event Type Definitions for SDK
 *
 * Standard event types for agent lifecycle, execution, tools, and routing.
 */

/**
 * Agent lifecycle events
 */
export interface AgentInitializedEvent {
  readonly agentId: string
  readonly timestamp: number
}

export interface AgentReadyEvent {
  readonly agentId: string
  readonly timestamp: number
}

export interface AgentErrorEvent {
  readonly agentId: string
  readonly error: string
  readonly timestamp: number
}

export interface AgentDisposedEvent {
  readonly agentId: string
  readonly timestamp: number
}

/**
 * Agent execution events
 */
export interface AgentExecutionStartedEvent {
  readonly agentId: string
  readonly input: string
  readonly timestamp: number
}

export interface AgentExecutionCompletedEvent {
  readonly agentId: string
  readonly output: string
  readonly turns: number
  readonly timestamp: number
}

export interface AgentExecutionFailedEvent {
  readonly agentId: string
  readonly error: string
  readonly timestamp: number
}

/**
 * Tool calling events
 */
export interface AgentToolCallEvent {
  readonly agentId: string
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly timestamp: number
}

export interface AgentToolResultEvent {
  readonly agentId: string
  readonly toolName: string
  readonly result: unknown
  readonly timestamp: number
}

export interface AgentToolErrorEvent {
  readonly agentId: string
  readonly toolName: string
  readonly error: string
  readonly timestamp: number
}

/**
 * Routing and handoff events
 */
export interface AgentRoutingStartedEvent {
  readonly agentId: string
  readonly input: string
  readonly timestamp: number
}

export interface AgentRoutingCompletedEvent {
  readonly agentId: string
  readonly selectedAgent: string
  readonly timestamp: number
}

export interface AgentHandoffEvent {
  readonly fromAgent: string
  readonly toAgent: string
  readonly context: Record<string, unknown>
  readonly timestamp: number
}

/**
 * Progress and status events
 */
export interface AgentProgressEvent {
  readonly agentId: string
  readonly progress: number
  readonly message: string
  readonly timestamp: number
}

export interface AgentThinkingEvent {
  readonly agentId: string
  readonly turn: number
  readonly timestamp: number
}

/**
 * Standard event names (constants)
 */
export const AgentEvents = {
  // Lifecycle
  INITIALIZED: 'agent:initialized',
  READY: 'agent:ready',
  ERROR: 'agent:error',
  DISPOSED: 'agent:disposed',

  // Execution
  EXECUTION_STARTED: 'agent:execution:started',
  EXECUTION_COMPLETED: 'agent:execution:completed',
  EXECUTION_FAILED: 'agent:execution:failed',

  // Tools
  TOOL_CALL: 'agent:tool:call',
  TOOL_RESULT: 'agent:tool:result',
  TOOL_ERROR: 'agent:tool:error',

  // Routing
  ROUTING_STARTED: 'agent:routing:started',
  ROUTING_COMPLETED: 'agent:routing:completed',
  HANDOFF: 'agent:handoff',

  // Progress
  PROGRESS: 'agent:progress',
  THINKING: 'agent:thinking'
} as const

/**
 * Type-safe event emitter helper
 */
export type AgentEventMap = {
  'agent:initialized': AgentInitializedEvent
  'agent:ready': AgentReadyEvent
  'agent:error': AgentErrorEvent
  'agent:disposed': AgentDisposedEvent
  'agent:execution:started': AgentExecutionStartedEvent
  'agent:execution:completed': AgentExecutionCompletedEvent
  'agent:execution:failed': AgentExecutionFailedEvent
  'agent:tool:call': AgentToolCallEvent
  'agent:tool:result': AgentToolResultEvent
  'agent:tool:error': AgentToolErrorEvent
  'agent:routing:started': AgentRoutingStartedEvent
  'agent:routing:completed': AgentRoutingCompletedEvent
  'agent:handoff': AgentHandoffEvent
  'agent:progress': AgentProgressEvent
  'agent:thinking': AgentThinkingEvent
}

/**
 * Get event type from event name
 */
export type EventData<T extends keyof AgentEventMap> = AgentEventMap[T]
