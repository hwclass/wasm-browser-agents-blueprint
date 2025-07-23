import initWasm, * as wasmAgent from './rust/pkg/hello_agent.js';

(async () => {  
await initWasm();
})();