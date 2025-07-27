// Language-specific greetings
const GREETINGS = {
    en: "Hello",
    fr: "Bonjour",
    de: "Hallo",
    es: "Hola"
};

export class JSAgent {
    constructor() {
        console.log("JavaScript agent initialized");
    }

    async ready() {
        return true;
    }

    greet(name, lang = 'en') {
        const greeting = GREETINGS[lang] || GREETINGS.en;
        return `${greeting}, ${name}!`;
    }
} 