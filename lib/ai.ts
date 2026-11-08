import "server-only";

type AiMode = "ollama" | "openai" | "template";

function providerMode(): AiMode {
  const configured = process.env.AI_PROVIDER || "template";
  if (configured === "ollama" || configured === "openai" || configured === "template") return configured;
  throw new Error("AI_PROVIDER must be ollama, openai, or template.");
}

export async function generateAiText(system: string, prompt: string, json = false) {
  const mode = providerMode();
  if (mode === "template") throw new Error("AI_PROVIDER=template uses offline templates, not an AI model.");

  if (mode === "ollama") {
    const base = new URL(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
    if (base.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(base.hostname)) {
      throw new Error("OLLAMA_BASE_URL must point to a local Ollama server (localhost).");
    }
    const response = await fetch(new URL("/api/chat", base), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
        stream: false,
        format: json ? "json" : undefined,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        options: { temperature: 0.6 },
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`Ollama request failed (${response.status}): ${result?.error || "Check that Ollama is running and the model is installed."}`);
    const text = result?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new Error("Ollama returned an empty response.");
    return { text: text.slice(0, 50000), mode };
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("AI_PROVIDER=openai requires OPENAI_API_KEY in .env.local.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      temperature: 0.6,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${result?.error?.message || "Check the API key, model, and account."}`);
  const text = result?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("OpenAI returned an empty response.");
  return { text: text.slice(0, 50000), mode };
}
