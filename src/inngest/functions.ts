import { gemini, createAgent } from "@inngest/agent-kit";

import { inngest } from "./client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world " },
  { event: "test/hello.world" },
  async ({ event }) => {
    // downlaod step
    const codeAgent = createAgent({
      name: "code-agent",
      system: "You are an expert next.js developer. You write readable, maintainable code. You write simple next.js & react snippets.",
      model: gemini({ model: "gemini-2.5-flash"}),
    });

    const { output } = await codeAgent.run(
      `Write the following snippet: ${event.data.value}`,
    );
console.log(output);
// [{ role: 'assistant', content: 'function removeUnecessaryWhitespace(...' }]

    return { output};
  },
);
