import { expose } from 'comlink';
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { JSAgent } from './js/greet.js';

console.log("Worker loaded");

let engine;
let agent;
let modelInitialized = false;
let currentModel = null;

const ready = async (modelId) => {
    if (!agent) {
        agent = new JSAgent();
    }
    
    // If model changed or not initialized, set up the engine
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
        currentModel = modelId;
    }
};

async function greetWithLLM(name, lang, userPrompt) {
    const greeting = agent.greet(name, lang);

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