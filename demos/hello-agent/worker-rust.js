import { expose } from "comlink";
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import initWasm, * as wasm from "./rust/pkg/hello_agent.js";

console.log("Worker loaded");

let engine;
let wasmReady = false;
let modelInitialized = false;

const ready = async () => {
  if (!wasmReady) {
    await initWasm();
    wasmReady = true;
  }
  if (!modelInitialized) {
    engine = await CreateMLCEngine("Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC", {
      initProgressCallback: (progress) => {
        console.log("Model loading progress:", progress.text);
      }
    });
    modelInitialized = true;
  }
};

async function greetWithLLM(name, lang, userPrompt) {
  await ready();
  const greeting = wasm.greet(name, lang);
  
  // Construct a context-aware prompt that includes the greeting
  const languageNames = {
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish'
  };
  const contextPrompt = `The greeting "${greeting}" was generated in ${languageNames[lang] || lang} for ${name}. ${userPrompt}`;
  
  const reply = await engine.chat.completions.create({
    messages: [{ role: "user", content: contextPrompt }]
  });
  return { greeting, llmOutput: reply.choices[0].message.content };
}

expose({ ready, greetWithLLM }); 