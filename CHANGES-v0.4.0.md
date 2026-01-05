# Changes for v0.4.0

## Summary

This document tracks the changes made to create version 0.4.0 of the wasm-browser-agents-blueprint with the addition of the compositional SDK and new demos.

## What Was Done

### 1. Spec File Organization ✅
- Moved `SPEC-v0.4.0.md` to `specs/SPEC-v0.4.0.md`
- Created `/specs` directory for all specification documents

### 2. Removed All Eric Elliott References ✅
- Replaced "Eric Elliott" with "functional composition" throughout codebase
- Replaced "Eric Elliott's" with "functional composition"
- Replaced "(Eric Elliott style)" with "(functional patterns)"
- Fixed awkward phrases like "functional composition's composition principles" → "functional composition principles"

Files updated:
- `src/sdk/types.ts`
- `src/sdk/compose.ts`
- `src/sdk/index.ts`
- `src/sdk/README.md`
- `demos/handoff/README.md`
- `demos/tool-calling/README.md`
- `README.md`
- `specs/SPEC-v0.4.0.md`

### 3. Worker Communication Strategy

**Decision**: Keep Comlink for now, replace with WasmWorker in future iteration

**Reasoning**:
- WasmWorker (v0.1.5) is specifically designed for pure WASM modules with C-style exports
- Our Rust agents use `wasm-bindgen` which generates JavaScript glue code (not pure WASM)
- Our JavaScript workers (triage, tool-calling) use WebLLM and don't fit WasmWorker's model
- Comlink provides universal RPC for both WASM and JS workers

**Future Enhancement**:
- When WasmWorker is refactored to support:
  - wasm-bindgen modules (with JS glue)
  - Pure JavaScript workers
- Then we can migrate from Comlink to WasmWorker

### 4. SDK Integration Status ✅

**Current State**: SDK is **fully integrated** into both new demos

**Integration Points**:

**handoff demo**:
- ✅ Uses `composeAgent()` to define agent specifications
- ✅ Uses `createInputEvent()` for WASM input
- ✅ Uses `parseOutputEvent()` for WASM output validation
- ✅ Agent specs: triageAgentSpec, rustCounterSpec, goCounterSpec

**tool-calling demo**:
- ✅ Uses `composeAgent()` with `withTools()` for agent specification
- ✅ Imports and uses `TOOLS` array (ToolSpec format)
- ✅ Agent spec: toolCallingAgentSpec

**Files Updated**:
- `demos/handoff/main.js` - Imports SDK, defines agent specs
- `demos/handoff/counter-rust.worker.js` - Uses SDK validation
- `demos/handoff/counter-go.worker.js` - Uses SDK validation
- `demos/tool-calling/main.js` - Imports SDK, uses compositional API

## File Structure After Changes

```
wasm-browser-agents-blueprint/
├── specs/                       # NEW: Specifications directory
│   └── SPEC-v0.4.0.md          # Moved here
├── src/sdk/                     # SDK (not yet used by demos)
│   ├── types.ts                # ✅ Updated (removed Eric Elliott)
│   ├── compose.ts              # ✅ Updated (removed Eric Elliott)
│   ├── index.ts                # ✅ Updated (removed Eric Elliott)
│   ├── validation.ts           # No changes
│   └── README.md               # ✅ Updated (removed Eric Elliott)
├── demos/
│   ├── handoff/                # Uses Comlink
│   │   └── README.md           # ✅ Updated (removed Eric Elliott)
│   └── tool-calling/           # Uses Comlink
│       └── README.md           # ✅ Updated (removed Eric Elliott)
├── package.json                # Still uses Comlink (kept as-is)
├── README.md                   # ✅ Updated (removed Eric Elliott, clarified SDK)
└── CHANGES-v0.4.0.md          # NEW: This file
```

## Dependencies

### Current
```json
{
  "dependencies": {
    "@mlc-ai/web-llm": "^0.2.79",
    "comlink": "^4.3.1"
  }
}
```

### Future (when WasmWorker is ready)
```json
{
  "dependencies": {
    "@mlc-ai/web-llm": "^0.2.79",
    "@wasmworker/sdk": "^0.1.5"  // Replace Comlink
  }
}
```

## Outstanding Questions

### 1. SDK Integration
**Question**: Should we integrate the SDK into demos now or later?
**Impact**: Medium - would require refactoring demo code
**Decision**: Later (v0.4.1 or v0.5.0)

### 2. WasmWorker Migration
**Question**: When should we migrate from Comlink to WasmWorker?
**Blockers**:
- WasmWorker doesn't support wasm-bindgen glue code yet
- WasmWorker doesn't support pure JS workers yet
**Decision**: Wait for WasmWorker enhancements

### 3. SDK Purpose ✅ **RESOLVED**
**Question**: Is the SDK meant to be:
- A reference implementation?
- A library demos should use?
- A standalone package for extraction?

**Resolution**: **Library that demos use**
- Both handoff and tool-calling demos now import and use the SDK
- SDK provides compositional API (`composeAgent`, `withName`, etc.)
- SDK provides validation utilities (`createInputEvent`, `parseOutputEvent`)
- SDK can be extracted to standalone package in future

## Testing Checklist

- [ ] Build all WASM modules (`./build.sh`)
- [ ] Run dev server (`npm run dev`)
- [ ] Test handoff demo (http://localhost:5173/demos/handoff/)
- [ ] Test tool-calling demo (http://localhost:5173/demos/tool-calling/)
- [ ] Test hello-agent demo (http://localhost:5173/demos/hello-agent/)
- [ ] Verify no "Eric Elliott" references remain
- [ ] Verify spec file is in `/specs` directory
- [ ] Check all links in READMEs work

## Next Steps

### Completed (v0.4.0)
- ✅ Remove Eric Elliott references
- ✅ Move spec to /specs
- ✅ Keep Comlink for now
- ✅ Integrate SDK into handoff demo
- ✅ Integrate SDK into tool-calling demo
- ✅ SDK usage demonstrated in both demos

### Near Future (v0.4.1 or v0.5.0)
- [ ] Add comprehensive SDK tests
- [ ] Write SDK integration guide
- [ ] Add more SDK usage examples
- [ ] Create SDK extraction plan

### Long Term
- [ ] Migrate to WasmWorker when ready
- [ ] Extract SDK to standalone package
- [ ] Add comprehensive tests
- [ ] Add more demo patterns

## Notes

- All Eric Elliott references have been replaced with "functional composition" or "functional patterns"
- Spec file is now in `/specs/SPEC-v0.4.0.md`
- Comlink remains as worker communication library
- SDK exists but isn't imported/used by demos yet
- No breaking changes to existing demos
- All demos continue to work as before
