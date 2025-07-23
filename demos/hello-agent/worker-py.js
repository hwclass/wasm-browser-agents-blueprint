// Pyodide worker using ES module imports and Comlink
import { expose } from "comlink";
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.mjs";
import { CreateMLCEngine } from "@mlc-ai/web-llm";

let pyodide;
let pythonLoaded = false;
let engine;
let modelInitialized = false;

async function ready() {
  if (!pythonLoaded) {
    try {
      pyodide = await loadPyodide();
      const response = await fetch("./python/main.py");
      if (!response.ok) throw new Error(`Failed to fetch main.py: ${response.statusText}`);
      const pyCode = await response.text();
      await pyodide.runPythonAsync(pyCode);
      pythonLoaded = true;
    } catch (err) {
      console.error("Pyodide/Python initialization failed:", err);
      throw err;
    }
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
  let greeting, llmOutput;
  try {
    greeting = pyodide.runPython(`greet('${name}', '${lang}')`);
  } catch (err) {
    greeting = "[Python error]";
  }

  // Construct a context-aware prompt that includes the greeting
  const languageNames = {
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish'
  };
  const contextPrompt = `The greeting "${greeting}" was generated in ${languageNames[lang] || lang} for ${name}. ${userPrompt}`;

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
    llmOutput = `LLM not available in Python worker (module worker limitation)`;
  }

  return { greeting, llmOutput };
}

expose({ ready, greetWithLLM });
