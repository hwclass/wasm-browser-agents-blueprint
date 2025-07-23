// Convert to module worker with ES6 imports
import { expose } from "comlink";
import { CreateMLCEngine } from "@mlc-ai/web-llm";

let go;
let wasmLoaded = false;
let engine;
let modelInitialized = false;

async function ready() {
  if (!wasmLoaded) {
    // Load Go WASM - import the script which sets up globalThis.Go
    await import('./go/wasm_exec.js');
    // Now access Go from the global scope
    go = new globalThis.Go();
    const wasmResp = await fetch('./go/hello_agent.wasm');
    const wasmBuf = await wasmResp.arrayBuffer();
    await WebAssembly.instantiate(wasmBuf, go.importObject).then(result => {
      go.run(result.instance);
    });
    wasmLoaded = true;
  }
  
  if (!modelInitialized) {
    engine = await CreateMLCEngine("Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC", {
      initProgressCallback: (progress) => {
        console.log("Model loading progress:", progress.text);
      }
    });
    modelInitialized = true;
  }
}

async function greetWithLLM(name, lang, userPrompt) {
  await ready();
  
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
