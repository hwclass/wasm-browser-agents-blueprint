package main

import (
	"encoding/json"
	"strings"
	"syscall/js"
)

// InputEvent represents the input structure (runtime → agent)
type InputEvent struct {
	Type    string  `json:"type"`
	Payload Payload `json:"payload"`
}

// Payload contains the task data
type Payload struct {
	Text string `json:"text"`
	Word string `json:"word"`
}

// OutputEvent represents successful response (agent → runtime)
type OutputEvent struct {
	Kind  string `json:"kind"`
	Count int    `json:"count"`
}

// ErrorEvent represents error response
type ErrorEvent struct {
	Kind  string `json:"kind"`
	Error string `json:"error"`
}

// step is the WASM agent contract implementation
//
// All WASM agents must export: step(input: string) -> string
//
// Input JSON schema:
//
//	{
//	  "type": "USER_TASK",
//	  "payload": {
//	    "text": "hello world hello",
//	    "word": "hello"
//	  }
//	}
//
// Output JSON schema:
//
//	{
//	  "kind": "respond",
//	  "count": 2
//	}
func step(this js.Value, args []js.Value) interface{} {
	// Validate argument count
	if len(args) != 1 {
		return errorResponse("expected one argument")
	}

	// Get input JSON string
	input := args[0].String()

	// Parse input event
	var event InputEvent
	if err := json.Unmarshal([]byte(input), &event); err != nil {
		return errorResponse("invalid input JSON: " + err.Error())
	}

	// Validate event type
	if event.Type != "USER_TASK" {
		return errorResponse("unsupported event type: " + event.Type)
	}

	// Count word occurrences
	count := countOccurrences(event.Payload.Text, event.Payload.Word)

	// Create response
	output := OutputEvent{
		Kind:  "respond",
		Count: count,
	}

	// Serialize output
	outBytes, err := json.Marshal(output)
	if err != nil {
		return errorResponse("failed to serialize output: " + err.Error())
	}

	return string(outBytes)
}

// countOccurrences counts how many times a word appears in text
//
// Uses whitespace-based word splitting.
// Case-sensitive exact match.
func countOccurrences(text, word string) int {
	if word == "" {
		return 0
	}

	count := 0
	words := strings.Fields(text)

	for _, w := range words {
		if w == word {
			count++
		}
	}

	return count
}

// errorResponse creates a JSON error response
func errorResponse(msg string) string {
	errEvent := ErrorEvent{
		Kind:  "respond",
		Error: msg,
	}

	bytes, err := json.Marshal(errEvent)
	if err != nil {
		// Fallback if error serialization fails
		return `{"kind":"respond","error":"fatal error serializing error response"}`
	}

	return string(bytes)
}

func main() {
	// Register step function on global object
	// This allows JavaScript to call: globalThis.step(inputJson)
	js.Global().Set("step", js.FuncOf(step))

	// Keep the Go program running
	// WASM module must stay alive to handle calls
	select {}
}
