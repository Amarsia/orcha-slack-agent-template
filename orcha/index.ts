import { orcha } from "orchajs";

orcha.init({
  amarsia: process.env.AMARSIA_PROJECT_KEY
    ? {
        key: process.env.AMARSIA_PROJECT_KEY,
        endpoint: process.env.AMARSIA_API_URL,
      }
    : undefined,
  providers: {
    openai: process.env.OPENAI_API_KEY ?? "",
  },
  agents: {
    assistant: "./assistant",
  },
  storage: {
    strategy: "node-jsonl",
    directory: process.env.ORCHA_SESSION_DIRECTORY ?? ".orcha/sessions",
  },
});

export { orcha };
