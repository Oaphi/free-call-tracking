const nl = (parts: TemplateStringsArray, ...args: string[]) =>
  "\n" + parts.reduce((a, c, i) => a + c + (args[i] || ""), "");

const toEventPair = (category = "Event", event = "Event") =>
  `${category}/${event}`;
