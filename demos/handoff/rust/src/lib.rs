use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

/// Input event structure (runtime → agent)
#[derive(Deserialize)]
struct InputEvent {
    #[serde(rename = "type")]
    event_type: String,
    payload: Payload,
}

/// Payload containing task data
#[derive(Deserialize)]
struct Payload {
    text: String,
    word: String,
}

/// Output event structure (agent → runtime)
#[derive(Serialize)]
struct OutputEvent {
    kind: String,
    count: usize,
}

/// Error response structure
#[derive(Serialize)]
struct ErrorEvent {
    kind: String,
    error: String,
}

/// WASM Agent Contract: step(input: string) -> string
///
/// This is the single exported function that all WASM agents must implement.
/// It receives JSON input and returns JSON output.
///
/// Input JSON schema:
/// {
///   "type": "USER_TASK",
///   "payload": {
///     "text": "hello world hello",
///     "word": "hello"
///   }
/// }
///
/// Output JSON schema:
/// {
///   "kind": "respond",
///   "count": 2
/// }
#[wasm_bindgen]
pub fn step(input: String) -> String {
    // Parse input event
    let parsed: Result<InputEvent, _> = serde_json::from_str(&input);

    if let Err(e) = parsed {
        return error_response(&format!("Invalid input JSON: {}", e));
    }

    let event = parsed.unwrap();

    // Validate event type
    if event.event_type != "USER_TASK" {
        return error_response(&format!("Unsupported event type: {}", event.event_type));
    }

    // Count word occurrences
    let count = count_occurrences(&event.payload.text, &event.payload.word);

    // Create response
    let output = OutputEvent {
        kind: "respond".to_string(),
        count,
    };

    serde_json::to_string(&output).unwrap_or_else(|e| {
        error_response(&format!("Failed to serialize output: {}", e))
    })
}

/// Count occurrences of a word in text
///
/// Uses whitespace-based word splitting.
/// Case-sensitive exact match.
fn count_occurrences(text: &str, word: &str) -> usize {
    if word.is_empty() {
        return 0;
    }

    text
        .split_whitespace()
        .filter(|w| w == &word)
        .count()
}

/// Create error response
fn error_response(msg: &str) -> String {
    let error = ErrorEvent {
        kind: "respond".to_string(),
        error: msg.to_string(),
    };

    serde_json::to_string(&error).unwrap_or_else(|_| {
        r#"{"kind":"respond","error":"Fatal error serializing error response"}"#.to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_occurrences() {
        assert_eq!(count_occurrences("hello world hello", "hello"), 2);
        assert_eq!(count_occurrences("hello world", "goodbye"), 0);
        assert_eq!(count_occurrences("hello", "hello"), 1);
        assert_eq!(count_occurrences("", "hello"), 0);
        assert_eq!(count_occurrences("hello world", ""), 0);
    }

    #[test]
    fn test_step_valid_input() {
        let input = r#"{
            "type": "USER_TASK",
            "payload": {
                "text": "hello world hello",
                "word": "hello"
            }
        }"#;

        let output = step(input.to_string());
        assert!(output.contains(r#""kind":"respond""#));
        assert!(output.contains(r#""count":2"#));
    }

    #[test]
    fn test_step_invalid_event_type() {
        let input = r#"{
            "type": "INVALID_TYPE",
            "payload": {
                "text": "hello",
                "word": "hello"
            }
        }"#;

        let output = step(input.to_string());
        assert!(output.contains(r#""error""#));
        assert!(output.contains("Unsupported event type"));
    }

    #[test]
    fn test_step_invalid_json() {
        let input = "invalid json";
        let output = step(input.to_string());
        assert!(output.contains(r#""error""#));
        assert!(output.contains("Invalid input JSON"));
    }
}
