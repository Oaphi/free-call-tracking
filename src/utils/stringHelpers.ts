const nl = (parts: TemplateStringsArray, ...args: string[]) =>
    "\n" + parts.reduce((a, c, i) => a + c + (args[i] || ""), "");

const toEventPair = (category = "Call", event = "Call") =>
    `${category}/${event}`;
