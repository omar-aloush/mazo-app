import { z } from 'zod';
import { fetchAICompletion } from '@/services/aiClient';

export const OPENAI_MODELS = {
  DEFAULT: process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini',
  FAST: 'gpt-4o-mini',
  SMART: 'gpt-4o',
  REASONING: 'o3-mini',
} as const;

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface GenerateTextOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface GenerateObjectOptions<T extends z.ZodTypeAny> {
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  prompt?: string;
  schema: T;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export interface OpenAIToolDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  description: string;
  zodSchema: T;
  execute: (input: z.infer<T>) => any | Promise<any>;
}

export const createOpenAITool = <T extends z.ZodTypeAny>(
  tool: OpenAIToolDefinition<T>
): OpenAIToolDefinition<T> => {
  return tool;
};

export const createRorkTool = createOpenAITool;

export const getOpenAIModel = (preferredModel?: string): string => {
  return preferredModel || process.env.EXPO_PUBLIC_OPENAI_MODEL || OPENAI_MODELS.FAST;
};

/**
 * Sends a chat completion request to OpenAI API
 */
export async function generateText(options: GenerateTextOptions): Promise<string> {
  const messages: OpenAIMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  for (const m of options.messages) {
    messages.push({ role: m.role, content: m.content });
  }

  const response = await fetchAICompletion({
    model: getOpenAIModel(options.model),
    messages,
    temperature: options.temperature ?? 0.7,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`AI service error (${response.status}): ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  return choice?.message?.content || '';
}

/**
 * Generates a structured JSON object validated against a Zod schema using OpenAI JSON Mode
 */
export async function generateObject<T extends z.ZodTypeAny>(
  options: GenerateObjectOptions<T>
): Promise<z.infer<T> & { object: z.infer<T> }> {
  const messages: OpenAIMessage[] = [];

  const schemaInstruction = `You are a structured data extractor. You MUST respond with a valid JSON object strictly conforming to the requested schema. Do not include markdown codeblocks or extra text. Output raw JSON only.`;

  const systemContent = options.systemPrompt
    ? `${options.systemPrompt}\n\n${schemaInstruction}`
    : schemaInstruction;

  messages.push({ role: 'system', content: systemContent });

  if (options.messages && options.messages.length > 0) {
    for (const m of options.messages) {
      messages.push({ role: m.role, content: m.content });
    }
  } else if (options.prompt) {
    messages.push({ role: 'user', content: options.prompt });
  }

  const response = await fetchAICompletion({
    model: getOpenAIModel(options.model),
    messages,
    response_format: { type: 'json_object' },
    temperature: options.temperature ?? 0.2,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`AI service error (${response.status}): ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  let rawJson: any;
  try {
    rawJson = JSON.parse(content);
  } catch (err: any) {
    throw new Error(`Failed to parse OpenAI JSON response: ${err.message}. Content: ${content}`);
  }

  const parsed = options.schema.safeParse(rawJson);
  const finalData = parsed.success ? parsed.data : rawJson;

  if (typeof finalData === 'object' && finalData !== null && !Array.isArray(finalData)) {
    return Object.assign({}, finalData, { object: finalData });
  }

  return { object: finalData } as any;
}
