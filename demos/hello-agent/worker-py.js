// Pyodide worker using ES module imports and Comlink
import { expose } from "comlink";
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.mjs";

console.log("Worker loaded");

let pyodide;
let engine;
let modelInitialized = false;
let currentModel = null;

const ready = async (modelId) => {
    if (!pyodide) {
        console.log("Initializing Pyodide...");
        try {
            pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
                stdout: console.log,
                stderr: console.error
            });
            
            console.log("Pyodide loaded, loading Python code...");
            
            // Load the Python file from the python directory
            const pythonCode = await fetch('./python/main.py').then(r => r.text());
            pyodide.runPython(pythonCode);
            
            console.log("Python environment ready!");
        } catch (error) {
            console.error("Failed to initialize Pyodide:", error);
            throw error;
        }
    }

    // If model changed or not initialized, set up the engine
    if (!modelInitialized || currentModel !== modelId) {
        if (engine) {
            await engine.dispose(); // Clean up existing model
        }

        console.log(`Initializing model: ${modelId}`);
        engine = await CreateMLCEngine(modelId, {
            initProgressCallback: (progress) => {
                console.log("Model loading progress:", progress.text);
            }
        });
        modelInitialized = true;
        currentModel = modelId;
        console.log("Model initialization complete!");
    }
};

async function greetWithLLM(name, lang, userPrompt) {
    try {
        const greeting = pyodide.runPython(`greet("${name}", "${lang}")`);
        
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
    } catch (error) {
        console.error("Error in greetWithLLM:", error);
        throw error;
    }
}

expose({ ready, greetWithLLM });
