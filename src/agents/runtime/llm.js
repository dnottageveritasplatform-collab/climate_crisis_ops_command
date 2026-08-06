/** Shared LLM config + JSON completion helper (MiniMax / Groq / OpenAI / Ollama). */

import "../../config.js";
import { recordLlmCall } from "../../efficiency/index.js";

function resolveApiKey() {
  const raw =
    process.env.LLM_API_KEY ||
    process.env.MINIMAX_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

function isLocalOllama(baseUrl, provider) {
  return (
    provider === "ollama" ||
    baseUrl.includes("11434") ||
    baseUrl.includes("ollama") ||
    baseUrl.includes("127.0.0.1") ||
    baseUrl.includes("localhost")
  );
}

function isMiniMax(llm) {
  return llm.provider === "minimax" || llm.baseUrl.includes("minimax");
}

function minimaxKeyKind(apiKey) {
  if (apiKey.startsWith("sk-cp-")) return "subscription";
  if (apiKey.startsWith("sk-api-")) return "paygo";
  return "unknown";
}

export function getLlmConfig() {
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = resolveApiKey();
  const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const provider =
    process.env.LLM_PROVIDER ||
    (baseUrl.includes("11434") || baseUrl.includes("ollama") ? "ollama" : null) ||
    (baseUrl.includes("minimax") ? "minimax" : null) ||
    (baseUrl.includes("groq.com") ? "groq" : null) ||
    (apiKey ? "openai" : null) ||
    "llm";
  const hasRemoteEndpoint = Boolean(process.env.LLM_BASE_URL || !isLocalOllama(baseUrl, provider));
  const enabled = hasRemoteEndpoint && (isLocalOllama(baseUrl, provider) || Boolean(apiKey));
  return {
    baseUrl,
    apiKey,
    model,
    provider,
    enabled,
    keyConfigured: Boolean(apiKey),
    keyKind: isMiniMax({ provider, baseUrl }) ? minimaxKeyKind(apiKey) : null,
  };
}

export function assertLlmReady(llm) {
  if (isLocalOllama(llm.baseUrl, llm.provider)) return;
  if (llm.apiKey) return;
  throw new Error(
    "LLM_API_KEY is missing. Set LLM_API_KEY in .env (see docs/MINIMAX.txt), then restart the server."
  );
}

function buildChatBody({ llm, system, user, maxTokens }) {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  if (isMiniMax(llm)) {
    return {
      model: llm.model,
      messages,
      max_tokens: maxTokens || 4096,
      temperature: 0.3,
      thinking: { type: "disabled" },
    };
  }

  return {
    model: llm.model,
    messages,
    response_format: { type: "json_object" },
  };
}

/** Strip MiniMax thinking tags / markdown fences before JSON.parse. */
export function parseLlmJsonContent(raw) {
  let text = String(raw || "").trim();
  text = text.replace(/[\s\S]*?<\/think>/gi, "").trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text);
}

function formatMiniMaxError(status, errText) {
  if (status === 402 || errText.includes("1008")) {
    const kind = minimaxKeyKind(resolveApiKey());
    if (kind === "paygo") {
      return (
        "MiniMax pay-as-you-go balance is empty (402). sk-api- keys use Billing > Balance credits. " +
        "Monthly Max subscription quota uses the sk-cp- key from Token Plan (see docs/MINIMAX.txt)."
      );
    }
    return "MiniMax quota/balance error (402). Check Plan Usage in the MiniMax console.";
  }
  if (status === 401 || errText.includes("1004")) {
    return "MiniMax auth failed (401). Verify LLM_API_KEY in .env matches docs/MINIMAX.txt (sk-api-... format, Bearer header). Restart the server after edits.";
  }
  return `minimax error: ${status} ${errText}`;
}

/**
 * @returns {Promise<{ json: object, usage: object, latencyMs: number, model: string, provider: string }>}
 */
export async function callLlmJson({ llm, system, user, agent, maxTokens }) {
  assertLlmReady(llm);
  const headers = { "Content-Type": "application/json" };
  if (llm.apiKey) headers.Authorization = `Bearer ${llm.apiKey}`;

  const t0 = Date.now();
  let data;
  try {
    const res = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(buildChatBody({ llm, system, user, maxTokens })),
    });

    const errText = await res.text();
    if (!res.ok) {
      recordLlmCall({
        agent,
        provider: llm.provider,
        model: llm.model,
        latencyMs: Date.now() - t0,
        usage: {},
        ok: false,
        error: `${res.status} ${errText.slice(0, 120)}`,
      });
      const message = isMiniMax(llm) ? formatMiniMaxError(res.status, errText) : `${llm.provider} error: ${res.status} ${errText}`;
      throw new Error(message);
    }

    data = JSON.parse(errText);
  } catch (err) {
    if (!String(err.message || "").includes("error:") && !err.message.includes("MiniMax")) {
      recordLlmCall({
        agent,
        provider: llm.provider,
        model: llm.model,
        latencyMs: Date.now() - t0,
        usage: {},
        ok: false,
        error: err.message,
      });
    }
    throw err;
  }

  const latencyMs = Date.now() - t0;
  const usage = data.usage || {};
  recordLlmCall({
    agent,
    provider: llm.provider,
    model: llm.model,
    latencyMs,
    usage,
    ok: true,
  });

  const content = data.choices?.[0]?.message?.content;
  let json;
  try {
    json = parseLlmJsonContent(content);
  } catch (parseErr) {
    throw new Error(`MiniMax returned non-JSON content: ${String(content || "").slice(0, 160)}`);
  }

  return {
    json,
    usage,
    latencyMs,
    model: llm.model,
    provider: llm.provider,
  };
}
