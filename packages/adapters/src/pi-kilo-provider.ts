import {
  createProvider,
  type Model,
  type MutableModels,
  type Provider,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { DEFAULT_MODEL_CONTEXT_WINDOW, DEFAULT_MODEL_MAX_TOKENS } from "@rakazo/contracts";
import { inputModalities } from "./model-modalities.js";

export const KILO_PROVIDER_ID = "kilo";
export const KILO_BASE_URL = "https://api.kilo.ai/api/gateway";

const KILO_MODELS = [
  // Free models (default to free models for zero-credit accounts)
  { id: "kilo-auto/free", name: "Kilo Auto (Free)", reasoning: false, acceptsImages: true },
  { id: "stepfun/step-3.7-flash:free", name: "Step 3.7 Flash (Free)", reasoning: true, acceptsImages: true },
  { id: "qwen/qwen3.8-27b:free", name: "Qwen 3.8 27B (Free)", reasoning: false, acceptsImages: false },
  { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning (Free)", reasoning: false, acceptsImages: false },
  { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1 (Free)", reasoning: false, acceptsImages: false },
  { id: "cohere/north-mini-code:free", name: "North Mini Code (Free)", reasoning: false, acceptsImages: false },
  { id: "z-ai/glm-5.2:free", name: "GLM 5.2 (Free)", reasoning: false, acceptsImages: false },

  // Paid models (require Kilo credits)
  { id: "kilo/auto", name: "Kilo Auto (Paid)", reasoning: false, acceptsImages: true },
  { id: "kilo/gpt-4o", name: "GPT-4o (Paid)", reasoning: false, acceptsImages: true },
  { id: "kilo/gpt-4o-mini", name: "GPT-4o mini (Paid)", reasoning: false, acceptsImages: true },
  { id: "kilo/claude-3-5-sonnet", name: "Claude 3.5 Sonnet (Paid)", reasoning: false, acceptsImages: true },
  { id: "kilo/deepseek-r1", name: "DeepSeek R1 (Paid)", reasoning: true, acceptsImages: false },
  { id: "kilo/llama-3.3-70b", name: "Llama 3.3 70B (Paid)", reasoning: false, acceptsImages: false },
  { id: "kilo/qwen-2.5-coder", name: "Qwen 2.5 Coder 32B (Paid)", reasoning: false, acceptsImages: false },
  { id: "kilo/mistral-large", name: "Mistral Large (Paid)", reasoning: false, acceptsImages: false },
];

export function kiloModel(
  id: string,
  name?: string,
  reasoning = false,
  acceptsImages = true,
  maxTokens = DEFAULT_MODEL_MAX_TOKENS,
  contextWindow = 128_000,
): Model<"openai-completions"> {
  return {
    id,
    name: name || id,
    api: "openai-completions",
    provider: KILO_PROVIDER_ID,
    baseUrl: KILO_BASE_URL,
    reasoning,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: reasoning,
      thinkingFormat: "openai",
    },
    thinkingLevelMap: { off: "none" },
    input: inputModalities(acceptsImages),
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens,
  };
}

export function kiloProvider(): Provider {
  const api = openAICompletionsApi();
  const models = KILO_MODELS.map((m) =>
    kiloModel(m.id, m.name, m.reasoning, m.acceptsImages),
  );
  return createProvider({
    id: KILO_PROVIDER_ID,
    name: "Kilo Gateway",
    baseUrl: KILO_BASE_URL,
    auth: {
      apiKey: {
        name: "Kilo Gateway API key",
        resolve: async () => {
          const envKey = process.env.KILO_API_KEY?.trim();
          if (envKey) return { auth: { apiKey: envKey }, source: "KILO_API_KEY environment variable" };
          return { auth: { apiKey: "" }, source: "Kilo Gateway API key" };
        },
      },
    },
    models,
    api,
  });
}

export function registerKiloCatalog(models: MutableModels): MutableModels {
  models.setProvider(kiloProvider());
  return models;
}
