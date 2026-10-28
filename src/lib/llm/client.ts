// Minimal OpenAI-compatible chat client (works with Ollama, vLLM, Groq,
// OpenRouter, Together, OpenAI …). Base URL, key and model come from env vars.
//
// Resilience:
//  - retries with backoff on 429 / 5xx / network errors
//  - Ollama sometimes answers a gpt-oss tool call with HTTP 500
//    "error parsing tool call" (ollama/ollama#17638). We retry once, then
//    switch this client to TEXT TOOL MODE: tools are described in the prompt
//    and the model replies with a JSON object that we parse ourselves.
import "server-only";
import { config } from "../config";
import { HttpError, Semaphore, fetchWithTimeout, sleep } from "../limiter";
import { extractJson } from "./json";

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
  /** True when the tool calls were parsed from plain text (fallback mode). */
  viaText: boolean;
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

const llmGate = new Semaphore(Math.max(1, config.llm.maxConcurrency));

function isToolParseError(err: unknown): boolean {
  return err instanceof HttpError && err.status >= 500 && /error parsing tool call|tool call/i.test(err.body);
}

let idCounter = 0;
const newId = () => `call_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

export class LlmClient {
  readonly stats = { calls: 0, retries: 0, toolParseErrors: 0, textMode: false };

  /** Switch to text tool mode for the rest of this client's life. */
  private textToolMode = false;

  get usingTextTools() {
    return this.textToolMode;
  }

  async chat(opts: {
    messages: ChatMessage[];
    tools?: ToolSpec[];
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<ChatResult> {
    const { tools } = opts;
    if (tools?.length && this.textToolMode) return this.chatTextTools(opts);

    let parseFailures = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const msg = await this.request(opts.messages, tools, opts);
        const content = typeof msg.content === "string" ? msg.content : "";
        const native: ToolCall[] = Array.isArray(msg.tool_calls)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            msg.tool_calls.map((tc: any) => ({ id: tc.id || newId(), name: tc.function?.name ?? "", args: parseArgs(tc.function?.arguments) }))
          : [];
        if (native.length) return { content, toolCalls: native.filter((t) => t.name), viaText: false };
        // Some models put the tool call in the content instead.
        if (tools?.length) {
          const fromText = parseTextToolCalls(content, tools);
          if (fromText.length) return { content: "", toolCalls: fromText, viaText: true };
        }
        return { content, toolCalls: [], viaText: false };
      } catch (err) {
        if (isToolParseError(err) && tools?.length) {
          this.stats.toolParseErrors++;
          parseFailures++;
          if (parseFailures >= 2) {
            this.textToolMode = true;
            this.stats.textMode = true;
            return this.chatTextTools(opts);
          }
          this.stats.retries++;
          continue;
        }
        // Endpoints without native tool support usually answer 400: describe tools in text instead.
        if (err instanceof HttpError && err.status === 400 && tools?.length) {
          this.textToolMode = true;
          this.stats.textMode = true;
          return this.chatTextTools(opts);
        }
        if (attempt < 2 && isRetryableLlm(err)) {
          this.stats.retries++;
          await sleep(800 * 2 ** attempt + Math.random() * 300);
          continue;
        }
        throw toUnavailable(err);
      }
    }
    throw new LlmUnavailableError("The language model did not return a usable answer.");
  }

  /** Plain completion with no tools. */
  async complete(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}): Promise<string> {
    const r = await this.chat({ messages, ...opts });
    return r.content;
  }

  private async chatTextTools(opts: { messages: ChatMessage[]; tools?: ToolSpec[]; temperature?: number; maxTokens?: number; signal?: AbortSignal }): Promise<ChatResult> {
    const tools = opts.tools ?? [];
    const toolDoc = tools
      .map((t) => `- ${t.function.name}: ${t.function.description}\n  arguments JSON schema: ${JSON.stringify(t.function.parameters)}`)
      .join("\n");
    const instruction =
      `You can call these tools:\n${toolDoc}\n\n` +
      `Reply with ONLY one JSON object and nothing else, in one of these forms:\n` +
      `{"tool_calls":[{"name":"<tool name>","arguments":{...}}]}  (one or more calls)\n` +
      `{"final":"<your final answer>"}`;
    const messages = toTextMessages(opts.messages, instruction);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const msg = await this.request(messages, undefined, opts);
        const content = typeof msg.content === "string" ? msg.content : "";
        const calls = parseTextToolCalls(content, tools);
        if (calls.length) return { content: "", toolCalls: calls, viaText: true };
        const parsed = extractJson(content) as { final?: unknown } | undefined;
        if (parsed && typeof parsed === "object" && typeof parsed.final === "string") return { content: parsed.final, toolCalls: [], viaText: true };
        return { content, toolCalls: [], viaText: true };
      } catch (err) {
        if (attempt < 2 && isRetryableLlm(err)) {
          this.stats.retries++;
          await sleep(800 * 2 ** attempt);
          continue;
        }
        throw toUnavailable(err);
      }
    }
    throw new LlmUnavailableError("The language model did not return a usable answer.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async request(messages: ChatMessage[], tools: ToolSpec[] | undefined, opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal }): Promise<any> {
    const body: Record<string, unknown> = {
      model: config.llm.model,
      messages: messages.map(toWire),
      temperature: opts.temperature ?? config.llm.temperature,
      max_tokens: opts.maxTokens ?? 2000,
      stream: false,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    if (config.llm.reasoningEffort) body.reasoning_effort = config.llm.reasoningEffort;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.llm.apiKey) headers.Authorization = `Bearer ${config.llm.apiKey}`;
    return llmGate.run(async () => {
      this.stats.calls++;
      const res = await fetchWithTimeout(
        `${config.llm.baseUrl}/chat/completions`,
        { method: "POST", headers, body: JSON.stringify(body), signal: opts.signal, cache: "no-store" },
        config.llm.timeoutMs,
      );
      const text = await res.text();
      if (!res.ok) throw new HttpError(`LLM ${res.status}`, res.status, text.slice(0, 500));
      const json = JSON.parse(text);
      const msg = json?.choices?.[0]?.message;
      if (!msg) throw new HttpError("LLM returned no message", 502, text.slice(0, 200));
      return msg;
    });
  }
}

function isRetryableLlm(err: unknown): boolean {
  if (err instanceof HttpError) return err.status === 429 || err.status >= 500;
  if (err instanceof Error) return err.name === "AbortError" || /fetch failed|ECONNRESET|socket|ETIMEDOUT/i.test(err.message);
  return false;
}

function toUnavailable(err: unknown): LlmUnavailableError {
  if (err instanceof LlmUnavailableError) return err;
  if (err instanceof HttpError) return new LlmUnavailableError(`Language model error (${err.status}).`);
  if (err instanceof Error && /ECONNREFUSED|fetch failed/i.test(err.message + String((err as Error & { cause?: unknown }).cause ?? ""))) {
    return new LlmUnavailableError("The language model endpoint is unreachable.");
  }
  if (err instanceof Error && err.name === "AbortError") return new LlmUnavailableError("The language model timed out.");
  return new LlmUnavailableError(err instanceof Error ? err.message : "Language model error.");
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string" || !raw.trim()) return {};
  const v = extractJson(raw);
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Parse {"tool_calls":[…]} / {"tool":…, "arguments":…} / {"name":…, "arguments":…} from text. */
export function parseTextToolCalls(content: string, tools: ToolSpec[]): ToolCall[] {
  const names = new Set(tools.map((t) => t.function.name));
  const v = extractJson(content);
  if (!v || typeof v !== "object") return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = v as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = Array.isArray(o) ? o : Array.isArray(o.tool_calls) ? o.tool_calls : [o];
  return list
    .map((c) => ({
      id: newId(),
      name: String(c?.name ?? c?.tool ?? c?.function?.name ?? ""),
      args: parseArgs(c?.arguments ?? c?.args ?? c?.parameters ?? c?.function?.arguments ?? {}),
    }))
    .filter((c) => names.has(c.name));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWire(m: ChatMessage): any {
  if (m.role === "assistant") {
    return {
      role: "assistant",
      content: m.content ?? "",
      ...(m.tool_calls?.length
        ? { tool_calls: m.tool_calls.map((t) => ({ id: t.id, type: "function", function: { name: t.name, arguments: JSON.stringify(t.args) } })) }
        : {}),
    };
  }
  if (m.role === "tool") return { role: "tool", tool_call_id: m.tool_call_id, name: m.name, content: m.content };
  return m;
}

/** Rewrite a native tool conversation into plain messages for text tool mode. */
function toTextMessages(messages: ChatMessage[], instruction: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") out.push({ role: "system", content: `${m.content}\n\n${instruction}` });
    else if (m.role === "assistant") {
      const calls = m.tool_calls?.length ? JSON.stringify({ tool_calls: m.tool_calls.map((t) => ({ name: t.name, arguments: t.args })) }) : m.content ?? "";
      out.push({ role: "assistant", content: calls });
    } else if (m.role === "tool") out.push({ role: "user", content: `Result of ${m.name}:\n${m.content}` });
    else out.push(m);
  }
  if (!messages.some((m) => m.role === "system")) out.unshift({ role: "system", content: instruction });
  return out;
}
