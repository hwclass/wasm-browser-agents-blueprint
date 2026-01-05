# AGENTS.md

## Purpose

This document defines the **software architecture requirements** for this repository.

Any implementation, refactor, or new feature **MUST** be evaluated against this document.

A coding agent (or human contributor) should treat this file as:
- a set of **architectural laws**
- a **compliance checklist**
- a **reasoning reference** for design decisions

If code "works" but violates this document, the code is **architecturally incorrect** and must be rewritten.

---

## 1. Architectural Goal

Build a **browser-native, event-driven, highly decoupled agent execution system** where:

- agents run in isolation (WebWorkers + WASM)
- coordination is centralized, explicit, and deterministic
- control-flow is runtime-owned and observable
- multiple implementation languages (Rust, Go, JS, etc.) are supported
- demos reproduce Mozilla AI's behavior, but with stronger architectural discipline

This document defines **software architecture**, not UI design or modeling.

---

## 2. Core Architectural Principles (Non-Negotiable)

### P1. Event-Driven Everything

All interactions between components happen via **events (messages as data)**.

There must be:
- no direct function calls between agents
- no shared mutable state across agents
- no hidden side effects

Events are **not logs**.
Events are **inputs to control flow**.

If something happens but no event explains why, the architecture is violated.

---

### P2. Centralized Coordination, Decentralized Execution

There is exactly **one coordination authority per execution**: the runtime instance.

- The runtime:
  - owns execution state
  - routes events
  - executes tools
  - performs handoff
  - decides continuation vs termination
- Agents:
  - execute a single decision step
  - return structured output
  - never coordinate directly

Agents must **not know about other agents**.

---

### P3. Workers Execute, They Do Not Orchestrate

WebWorkers exist solely to:
- load WASM or model runtimes
- execute **one agent step**
- emit exactly one output event

Workers must **not**:
- contain execution loops
- track turn counts
- decide termination
- execute tools
- route to other agents
- manage retries or fallbacks

If a worker decides "what happens next", the architecture is violated.

---

### P4. Deterministic Control Flow

Control-flow decisions (routing, tool execution, termination) must be:

- closed-world
- schema-bound
- deterministic
- externally inspectable

Determinism comes from **where decisions live**, not from model parameters.

Models may propose actions; they must never enforce execution order.

---

### P5. Runtime-Controlled Agent Loop

The **agent loop belongs to the runtime**, not to agents.

The runtime decides:
1. when an agent is invoked
2. how agent output is interpreted
3. when tools are executed
4. when context/messages are updated
5. when execution terminates

Agents propose actions only.

---

### P6. Strict Contracts, Loose Implementation

All agent interactions must conform to **strict, explicit contracts**, regardless of backend:

- Rust WASM
- Go WASM
- JavaScript
- other future runtimes

The runtime must not depend on:
- WASM ABI details
- language-specific memory layouts
- model-specific quirks

ABI glue lives **only** in worker adapters.

---

### P7. Observability Is Mandatory

Every meaningful step must be observable and explainable.

Required:
- trace IDs
- ordered event logs
- visible tool execution
- visible routing and termination decisions

If behavior cannot be reconstructed from events, the architecture is incorrect.

---

## 3. Required System Boundaries

### UI Layer

Allowed:
- collect user input
- display outputs
- display trace and metrics
- invoke runtime entrypoints

Disallowed:
- routing logic
- tool execution
- parsing model output
- agent orchestration

The UI must be **passive**.

---

### SDK Layer

The SDK is the **source of truth** for architecture.

It defines:
- agent composition primitives
- event semantics
- runtime factory and orchestration logic
- validation and guardrails

The SDK must **not**:
- hold global execution state
- act as a singleton runtime

---

### Runtime Instance

A runtime instance:
- is created via the SDK
- owns execution state
- runs exactly one agent system execution
- enforces all architectural rules

Multiple runtime instances must be able to coexist without interference.

---

### Agent Workers

Allowed:
- load model or WASM
- execute exactly one decision step
- emit a single structured output

Disallowed:
- talking to other agents
- executing tools
- looping
- deciding termination
- mutating shared state

Workers must be **boring, stateless executors**.

---

## 4. Runtime State and Data Ownership

### AgentRuntimeState

Execution state must be **explicit and inspectable**.

```typescript
type AgentRuntimeState = {
  traceId: string
  currentAgent: string
  stepCount: number
  messages: ReadonlyArray<Message>
  context: unknown
  status: "idle" | "running" | "completed" | "failed"
}

type Message = {
  readonly role: string
  readonly content: string
}
```

Rules:
- State lives only in the runtime instance
- Agents never mutate state directly
- State transitions occur only in response to events
- Messages are immutable snapshots, not evidence of iteration

**Critical constraint**: Workers must treat messages as **immutable context**, not as implicit loop state.

---

## 5. Agent Step Input Contract

Each agent worker invocation receives a snapshot of runtime context.

```typescript
type AgentStepInput = {
  readonly messages: ReadonlyArray<Message>
  readonly availableTools: ReadonlyArray<string>
}
```

Rules:
- Messages are read-only
- Messages are not evidence of a loop
- Workers must not assume they will be called again
- Workers must not append messages themselves
- `availableTools` is advisory; runtime still validates tool calls

---

## 6. Agent Output Contract

Each agent invocation must emit exactly one output:

```typescript
type AgentOutput =
  | { kind: "tool_call"; tool: string; args: unknown }
  | { kind: "handoff"; target: string }
  | { kind: "respond"; message: string }
```

Rules:
- No multiple actions per output
- No prose control flow
- No retries
- No implicit continuation

---

## 7. Tool Calling Architecture

Tool calling is a runtime protocol, not an agent capability.

Required flow:
1. Agent emits `tool_call`
2. Runtime validates tool name and arguments
3. Runtime executes tool
4. Runtime emits `tool.executed` event
5. Runtime updates messages/context
6. Runtime decides next step

Agents must never:
- import tools
- execute tools
- assume tool success

---

## 8. Tool Execution Interface

Tool implementations are injected into the runtime.

```typescript
type ToolExecutor = {
  execute(
    toolName: string,
    args: unknown,
    meta: { traceId: string }
  ): Promise<unknown>
}
```

Rules:
- Tools are runtime-owned
- Tool execution is observable (emits events)
- Tool failures emit events, not crashes
- Demos inject tool implementations; SDK defines interface

---

## 9. Handoff (Routing) Requirements

Structure:
- One triage agent
- Two or more executor agents
- Triage emits exactly one handoff output
- Executors do not know about each other

Routing output must:
- select from a fixed enum
- contain no prose or explanation
- be deterministic and testable

---

## 10. Error Handling

Errors are events, not control shortcuts.

```typescript
try {
  const output = await invokeAgent(currentAgent, state)
  // handle output...
} catch (error) {
  eventBus.emit({ type: "runtime.failed", error: error.message })
  state = transitionToFailed(state, error)
  break
}
```

Rules:
- All errors emit runtime failure events
- No silent retries
- No hidden recovery
- Any retry or fallback must be explicit and event-driven
- Recovery policy is configurable, not ad-hoc

---

## 11. Runtime Event Types

All runtime control flow must be driven by events as data:

```typescript
type AgentRuntimeEvent =
  | { type: "runtime.started"; state: AgentRuntimeState }
  | { type: "agent.invoked"; agent: string }
  | { type: "agent.output"; output: AgentOutput }
  | { type: "tool.executed"; tool: string; result: unknown }
  | { type: "runtime.completed"; result: unknown }
  | { type: "runtime.failed"; error: string }
```

Events must:
- drive execution, not merely log it
- allow reconstruction of entire execution trace
- be inspectable and serializable

---

## 12. Demo Parity Requirements

### `/demos/handoff`
- Must reproduce Mozilla AI's handoff behavior
- triage → specialist execution
- visible routing decision

### `/demos/tool-calling`
- Must reproduce Mozilla AI's tool-calling behavior
- explicit tool calls
- runtime-controlled execution loop

Implementation details may differ; observable behavior must not.

---

## 13. Compliance Checklist (Mandatory)

Before finalizing any change, verify:

- [ ] No worker contains execution loops
- [ ] No worker executes tools
- [ ] Runtime owns the only execution loop
- [ ] SDK is not a singleton runtime
- [ ] State is explicit and inspectable
- [ ] Events drive control flow (not just log it)
- [ ] Agents do not know other agents exist
- [ ] Tool calling follows runtime protocol
- [ ] Messages are immutable snapshots
- [ ] Errors become events, not silent failures
- [ ] Demos still match Mozilla behavior

If any item fails, the implementation is incomplete.

---

## 14. Architectural Methodology

This architecture implements **Event-Driven, Runtime-Mediated Agent Execution (ED-RMAE)**.

Key properties:
- Agents are stateless decision functions
- Runtime is a state machine
- Events are the only control surface
- No sideways communication
- No implicit loops

This is similar to:
- workflow engines
- actor supervision models
- functional interpreters

This is **NOT**:
- agent graphs
- recursive agent calls
- chat-to-chat delegation
- OpenAI Swarm-style agent-to-agent handoff

---

## 15. Final Rule

**Agents propose actions. The runtime decides what actually happens.**

This architecture exists to prevent:
- agent-to-agent coupling
- implicit control flow
- untestable behavior
- accidental orchestration leakage

Correctness always takes priority over convenience.

---

## End of AGENTS.md
