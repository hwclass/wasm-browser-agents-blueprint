/**
 * Event Bus - Core pub/sub implementation for SDK
 *
 * Lightweight, type-safe event system for agent communication.
 * Synchronous by design to ensure deterministic behavior.
 *
 * @example
 * ```ts
 * const bus = createEventBus()
 * bus.on('agent:ready', (data) => console.log('Agent ready:', data))
 * bus.emit('agent:ready', { agentId: 'triage' })
 * ```
 */

export type EventHandler<TData> = (data: TData) => void

export interface EventSubscription<TData> {
  readonly event: string
  readonly handler: EventHandler<TData>
  readonly once: boolean
}

export interface EventBus {
  readonly on: <TData>(event: string, handler: EventHandler<TData>) => () => void
  readonly once: <TData>(event: string, handler: EventHandler<TData>) => () => void
  readonly off: <TData>(event: string, handler: EventHandler<TData>) => void
  readonly emit: <TData>(event: string, data: TData) => void
  readonly clear: () => void
  readonly listenerCount: (event: string) => number
  readonly eventNames: () => string[]
}

/**
 * Create a new event bus instance
 * @returns EventBus instance
 */
export function createEventBus(): EventBus {
  const handlers = new Map<string, EventSubscription<unknown>[]>()

  /**
   * Subscribe to an event
   */
  function on<TData>(event: string, handler: EventHandler<TData>): () => void {
    if (!handlers.has(event)) {
      handlers.set(event, [])
    }

    const subscription: EventSubscription<TData> = {
      event,
      handler,
      once: false
    }

    handlers.get(event)!.push(subscription as EventSubscription<unknown>)

    // Return unsubscribe function
    return () => off(event, handler)
  }

  /**
   * Subscribe to an event (one-time)
   */
  function once<TData>(event: string, handler: EventHandler<TData>): () => void {
    if (!handlers.has(event)) {
      handlers.set(event, [])
    }

    const subscription: EventSubscription<TData> = {
      event,
      handler,
      once: true
    }

    handlers.get(event)!.push(subscription as EventSubscription<unknown>)

    return () => off(event, handler)
  }

  /**
   * Unsubscribe from an event
   */
  function off<TData>(event: string, handler: EventHandler<TData>): void {
    const subscriptions = handlers.get(event)
    if (!subscriptions) {
      return
    }

    const index = subscriptions.findIndex((sub) => sub.handler === handler)
    if (index !== -1) {
      subscriptions.splice(index, 1)
    }

    // Clean up empty handler arrays
    if (subscriptions.length === 0) {
      handlers.delete(event)
    }
  }

  /**
   * Emit an event to all subscribers (synchronous)
   */
  function emit<TData>(event: string, data: TData): void {
    // Find exact matches
    const exactSubscriptions = handlers.get(event) || []

    // Find wildcard matches (e.g., 'agent:*' matches 'agent:ready')
    const wildcardSubscriptions: EventSubscription<unknown>[] = []
    for (const [pattern, subs] of handlers.entries()) {
      if (matchesPattern(event, pattern)) {
        wildcardSubscriptions.push(...subs)
      }
    }

    const allSubscriptions = [...exactSubscriptions, ...wildcardSubscriptions]

    // Track one-time handlers to remove
    const onceHandlers: EventSubscription<unknown>[] = []

    // Execute all handlers synchronously
    for (const sub of allSubscriptions) {
      try {
        sub.handler(data)

        if (sub.once) {
          onceHandlers.push(sub)
        }
      } catch (error) {
        console.error(`[EventBus] Error in handler for event "${event}":`, error)
      }
    }

    // Remove one-time handlers
    for (const sub of onceHandlers) {
      off(sub.event, sub.handler)
    }
  }

  /**
   * Remove all event handlers
   */
  function clear(): void {
    handlers.clear()
  }

  /**
   * Get count of handlers for an event
   */
  function listenerCount(event: string): number {
    return handlers.get(event)?.length || 0
  }

  /**
   * Get all event names with registered handlers
   */
  function eventNames(): string[] {
    return Array.from(handlers.keys())
  }

  /**
   * Check if event name matches a pattern (supports wildcards)
   */
  function matchesPattern(event: string, pattern: string): boolean {
    if (pattern === event) {
      return false // Already handled by exact match
    }

    if (!pattern.includes('*')) {
      return false
    }

    // Convert wildcard pattern to regex
    // 'agent:*' -> /^agent:[^:]+$/
    // 'agent:*:error' -> /^agent:[^:]+:error$/
    const regexPattern = pattern
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^:]+')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(event)
  }

  return {
    on,
    once,
    off,
    emit,
    clear,
    listenerCount,
    eventNames
  }
}
