package main

import (
	"fmt"
	"syscall/js"
)

func greet(this js.Value, args []js.Value) interface{} {
	name := args[0].String()
	lang := args[1].String()
	var greeting string
	switch lang {
	case "fr":
		greeting = fmt.Sprintf("Bonjour, %s!", name)
	case "de":
		greeting = fmt.Sprintf("Hallo, %s!", name)
	case "es":
		greeting = fmt.Sprintf("¡Hola, %s!", name)
	default:
		greeting = fmt.Sprintf("Hello, %s!", name)
	}
	return greeting
}

func main() {
	js.Global().Set("greet", js.FuncOf(greet))
	// Prevent the main function from returning, which would terminate the program.
	select {}
}
