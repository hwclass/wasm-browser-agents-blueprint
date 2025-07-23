def greet(name, lang):
    if lang == "fr":
        return f"Bonjour, {name}!"
    elif lang == "de":
        return f"Hallo, {name}!"
    elif lang == "es":
        return f"¡Hola, {name}!"
    else:
        return f"Hello, {name}!"
