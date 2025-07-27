// Convert to module worker with ES6 imports
import { expose } from "comlink";
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import "./go/wasm_exec.js";

console.log("Worker loaded");

let go;
let wasmLoaded = false;
let engine;
let modelInitialized = false;
let currentModel = null;  // Track the current model ID

async function ready(modelId) {
  if (!wasmLoaded) {
    // Load Go WASM - import the script which sets up globalThis.Go
    go = new globalThis.Go();
    const wasmResp = await fetch('./go/hello_agent.wasm');
    const wasmBuf = await wasmResp.arrayBuffer();
    await WebAssembly.instantiate(wasmBuf, go.importObject).then(result => {
      go.run(result.instance);
    });
    wasmLoaded = true;
  }
  
  if (!modelInitialized || currentModel !== modelId) {
    if (engine) {
      await engine.dispose(); // Clean up existing model
    }
    
    engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (progress) => {
        console.log("Model loading progress:", progress.text);
      }
    });
    modelInitialized = true;
    currentModel = modelId;  // Update the current model ID
  }
}

async function greetWithLLM(name, lang, userPrompt) {
  // Call Go's greet exported function - this is the actual WASM call
  const greeting = self.greet(name, lang);
  
  // Construct a context-aware prompt that includes the greeting
  const languageNames = {
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish'
  };
  const contextPrompt = `The greeting "${greeting}" was generated in ${languageNames[lang] || lang} for ${name}. ${userPrompt}`;
  
  // Use the actual LLM engine if available
  let llmOutput;
  if (engine) {
    try {
      const reply = await engine.chat.completions.create({
        messages: [{ role: "user", content: contextPrompt }]
      });
      llmOutput = reply.choices[0].message.content;
    } catch (error) {
      console.error("LLM call failed:", error);
      llmOutput = `Error calling LLM: ${error.message}`;
    }
  } else {
    // Fallback if engine is not available
    llmOutput = `LLM not available in Go worker (module worker limitation)`;
  }
  
  return { greeting, llmOutput };
}

expose({ ready, greetWithLLM });
