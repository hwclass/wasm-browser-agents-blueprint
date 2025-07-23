use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str, lang: &str) -> String {
  match lang {
    "fr" => format!("Bonjour, {}!", name),
    "de" => format!("Hallo, {}!", name),
    "en" => format!("Hello, {}!", name),
    "es" => format!("¡Hola, {}!", name),
    _ => format!("Hello, {}!", name)
  }
}