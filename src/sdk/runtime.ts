/**
 * Agent Runtime Implementation
 *
 * Event-Driven, Runtime-Mediated Agent Execution (ED-RMAE)
 *
 * Key principles enforced:
 * - P1: Event-Driven Everything
 * - P2: Centralized Coordination, Decentralized Execution
 * - P3: Workers Execute, They Do Not Orchestrate
 * - P4: Deterministic Control Flow
 * - P5: Runtime-Controlled Agent Loop
 * - P6: Strict Contracts, Loose Implementation
 * - P7: Observability Is Mandatory
 *
 * The runtime owns:
 * - Execution loop
 * - Tool execution
 * - State management
 * - Event emission
 * - Termination decisions
 *
 * Agents propose actions; runtime decides what happens.
 */

import type {
  AgentRuntime,
  AgentRuntimeConfig,
  AgentRuntimeState,
  AgentRuntimeEvent,
  AgentStepInput,
  AgentOutput,
  Message
} from './runtime-types'
import type { EventBus } from './event-bus'

/**
 * Generate unique trace ID
 */
function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create initial runtime state
 */
function createInitialState(
  config: AgentRuntimeConfig,
  userInput: string
): AgentRuntimeState {
  const traceId = generateTraceId()

  return {
    traceId,
    currentAgent: config.entryAgent,
    stepCount: 0,
    messages: [
      { role: 'user', content: userInput }
    ],
    context: null,
    status: 'idle'
  }
}

/**
 * Transition state immutably
 */
function transitionState(
  state: AgentRuntimeState,
  updates: Partial<AgentRuntimeState>
): AgentRuntimeState {
  return { ...state, ...updates }
}

/**
 * Append message immutably
 */
function appendMessage(
  state: AgentRuntimeState,
  message: Message
): AgentRuntimeState {
  return {
    ...state,
    messages: [...state.messages, message]
  }
}

/**
 * Create agent runtime instance
 *
 * Factory function that returns a runtime with closure-scoped state.
 * No stateful OOP - pure functional composition.
 *
 * @param config - Runtime configuration
 * @returns Runtime instance
 */
export function createAgentRuntime(
  config: AgentRuntimeConfig
): AgentRuntime {
  // Validate configuration
  if (!config.entryAgent) {
    throw new Error('Runtime config must specify entryAgent')
  }

  if (!config.agents[config.entryAgent]) {
    throw new Error(`Entry agent "${config.entryAgent}" not found in agents config`)
  }

  if (!config.workerFactory) {
    throw new Error('Runtime config must provide workerFactory')
  }

  // Closure-scoped state (not object fields!)
  let currentState: AgentRuntimeState | null = null
  const eventBus: EventBus | undefined = config.eventBus
  const maxSteps = config.maxSteps ?? 50

  /**
   * Get current state (inspectable)
   */
  function getState(): AgentRuntimeState {
    if (!currentState) {
      throw new Error('Runtime not started. Call run() first.')
    }
    return currentState
  }

  /**
   * Dispatch event
   * Events drive control flow, not merely log
   */
  function dispatch(event: AgentRuntimeEvent): void {
    if (eventBus) {
      eventBus.emit('runtime.event', event)
    }

    // Log for debugging
    console.log(`[Runtime Event] ${event.type}`, event)
  }

  /**
   * Execute a tool
   * Runtime owns tool execution, not workers
   */
  async function executeTool(
    toolName: string,
    args: unknown,
    state: AgentRuntimeState
  ): Promise<unknown> {
    console.log(`[Runtime] Executing tool: ${toolName}`, args)

    // Validate tool exists
    if (config.tools && !config.tools[toolName]) {
      throw new Error(`Tool "${toolName}" not found in runtime config`)
    }

    // Execute tool
    let result: unknown
    if (config.toolExecutor) {
      result = await config.toolExecutor.execute(toolName, args, {
        traceId: state.traceId,
        step: state.stepCount
      })
    } else {
      throw new Error('No toolExecutor configured')
    }

    // Emit tool executed event
    dispatch({
      type: 'tool.executed',
      tool: toolName,
      result,
      step: state.stepCount
    })

    return result
  }

  /**
   * Invoke agent worker for one step
   * Worker returns exactly one decision
   */
  async function invokeAgent(
    agentName: string,
    state: AgentRuntimeState
  ): Promise<AgentOutput> {
    console.log(`[Runtime] Invoking agent: ${agentName} (step ${state.stepCount})`)

    // Emit agent invoked event
    dispatch({
      type: 'agent.invoked',
      agent: agentName,
      step: state.stepCount
    })

    // Get agent worker
    const worker = await config.workerFactory(agentName)

    // Build step input (immutable snapshot)
    const availableTools = config.tools ? Object.keys(config.tools) : []
    const input: AgentStepInput = {
      messages: state.messages,
      availableTools
    }

    // Execute exactly one step
    const output = await worker.step(input)

    // Emit agent output event
    dispatch({
      type: 'agent.output',
      output,
      step: state.stepCount
    })

    console.log(`[Runtime] Agent output:`, output)

    return output
  }

  /**
   * Process tool call output
   * Runtime decides what happens after tool execution
   */
  async function handleToolCall(
    output: AgentOutput & { kind: 'tool_call' },
    state: AgentRuntimeState
  ): Promise<AgentRuntimeState> {
    // Add agent's tool call to messages
    let newState = appendMessage(state, {
      role: 'assistant',
      content: JSON.stringify(output)
    })

    // Execute tool (runtime controls this)
    const result = await executeTool(output.tool, output.args, newState)

    // Add tool result to messages
    newState = appendMessage(newState, {
      role: 'user',
      content: `Tool result: ${JSON.stringify(result)}`
    })

    return newState
  }

  /**
   * Process handoff output
   * Runtime switches current agent
   */
  function handleHandoff(
    output: AgentOutput & { kind: 'handoff' },
    state: AgentRuntimeState
  ): AgentRuntimeState {
    console.log(`[Runtime] Handoff: ${state.currentAgent} → ${output.target}`)

    // Add handoff decision to messages (critical for extraction!)
    let newState = appendMessage(state, {
      role: 'assistant',
      content: JSON.stringify(output)
    })

    // Check if target agent exists in runtime
    if (!config.agents[output.target]) {
      // External handoff (to agent outside runtime)
      // Treat as completion and return the target agent name
      console.log(`[Runtime] External handoff to "${output.target}" - completing execution`)

      return transitionState(newState, {
        status: 'completed'
      })
    }

    // Internal handoff (to agent within runtime)
    // Switch current agent
    return transitionState(newState, {
      currentAgent: output.target
    })
  }

  /**
   * Process respond output
   * Runtime terminates execution
   */
  function handleRespond(
    output: AgentOutput & { kind: 'respond' },
    state: AgentRuntimeState
  ): AgentRuntimeState {
    console.log('[Runtime] Agent responded, terminating execution')

    // Add final response to messages
    const newState = appendMessage(state, {
      role: 'assistant',
      content: output.message
    })

    // Mark as completed
    return transitionState(newState, {
      status: 'completed'
    })
  }

  /**
   * Runtime-controlled execution loop
   * This is THE ONLY execution loop in the system
   * Workers NEVER contain loops
   */
  async function run(userInput: string): Promise<string> {
    // Initialize state
    currentState = createInitialState(config, userInput)
    currentState = transitionState(currentState, { status: 'running' })

    // Emit runtime started event
    dispatch({
      type: 'runtime.started',
      state: currentState
    })

    console.log('[Runtime] Starting execution', {
      traceId: currentState.traceId,
      entryAgent: currentState.currentAgent,
      maxSteps
    })

    // THE RUNTIME LOOP (P5: Runtime-Controlled Agent Loop)
    while (currentState.status === 'running' && currentState.stepCount < maxSteps) {
      currentState = transitionState(currentState, {
        stepCount: currentState.stepCount + 1
      })

      try {
        // Invoke agent (P3: Workers Execute, They Do Not Orchestrate)
        const output = await invokeAgent(currentState.currentAgent, currentState)

        // Runtime decides what happens next (P2: Centralized Coordination)
        switch (output.kind) {
          case 'tool_call':
            // Runtime executes tool (P7: Observability)
            currentState = await handleToolCall(output, currentState)
            break

          case 'handoff':
            // Runtime performs handoff (P4: Deterministic Control Flow)
            currentState = handleHandoff(output, currentState)
            break

          case 'respond':
            // Runtime terminates execution
            currentState = handleRespond(output, currentState)
            break

          default:
            throw new Error(`Unknown output kind: ${(output as any).kind}`)
        }
      } catch (error) {
        console.error('[Runtime] Execution error:', error)

        // Errors become events, not silent failures
        currentState = transitionState(currentState, { status: 'failed' })

        dispatch({
          type: 'runtime.failed',
          error: error instanceof Error ? error.message : String(error),
          finalState: currentState
        })

        throw error
      }
    }

    // Check if max steps reached
    if (currentState.stepCount >= maxSteps && currentState.status === 'running') {
      console.warn('[Runtime] Max steps reached')

      currentState = transitionState(currentState, { status: 'failed' })

      dispatch({
        type: 'runtime.failed',
        error: 'Maximum execution steps reached',
        finalState: currentState
      })

      throw new Error('Maximum execution steps reached')
    }

    // Extract final response
    const lastMessage = currentState.messages[currentState.messages.length - 1]
    let finalResponse = lastMessage.role === 'assistant' ? lastMessage.content : ''

    console.log('[Runtime] Last message:', lastMessage)

    // If last message is a handoff decision, extract the target agent name
    if (lastMessage && lastMessage.role === 'assistant') {
      try {
        // Try to parse as JSON (could be a structured decision)
        const decision = JSON.parse(lastMessage.content)
        if (decision.kind === 'handoff' && decision.target) {
          console.log('[Runtime] Extracted handoff target:', decision.target)
          finalResponse = decision.target
        } else if (decision.kind === 'respond' && decision.message) {
          finalResponse = decision.message
        }
      } catch (e) {
        // Not JSON, use content as-is
        console.log('[Runtime] Using raw message content as response')
      }
    }

    // Emit runtime completed event
    dispatch({
      type: 'runtime.completed',
      result: finalResponse,
      finalState: currentState
    })

    console.log('[Runtime] Execution completed', {
      traceId: currentState.traceId,
      steps: currentState.stepCount,
      status: currentState.status
    })

    return finalResponse
  }

  /**
   * Dispose of runtime resources
   */
  async function dispose(): Promise<void> {
    console.log('[Runtime] Disposing resources')
    currentState = null
  }

  // Return runtime instance (capability interface, not a class!)
  return {
    config,
    getState,
    dispatch,
    run,
    dispose
  }
}
