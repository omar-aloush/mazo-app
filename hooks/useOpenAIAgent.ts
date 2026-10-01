import { useState, useRef, useCallback } from 'react';
import { getOpenAIModel } from '@/services/openai';
import { fetchAICompletion } from '@/services/aiClient';

export interface AgentMessagePart {
  type: 'text' | 'tool-invocation' | 'tool-result';
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: any;
  result?: any;
  state?: 'call' | 'result';
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentMessagePart[];
  content?: string;
}

export interface UseOpenAIAgentOptions {
  tools?: Record<string, {
    description: string;
    zodSchema?: any;
    execute: (args: any) => any | Promise<any>;
  }>;
  maxSteps?: number;
  model?: string;
  temperature?: number;
}

export interface UseOpenAIAgentReturn {
  messages: AgentMessage[];
  sendMessage: (input: { text: string; retry?: boolean } | string) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>;
  status: 'ready' | 'streaming' | 'submitted' | 'error';
  error: Error | null;
  stop: () => void;
}

const convertZodToSchema = (schema: any): any => {
  if (!schema) return { type: 'object', properties: {} };
  try {
    if (schema._def && schema._def.typeName === 'ZodObject') {
      const shape = typeof schema._def.shape === 'function' ? schema._def.shape() : schema._def.shape;
      const properties: Record<string, any> = {};
      const required: string[] = [];

      for (const [key, field] of Object.entries(shape || {})) {
        const f: any = field;
        const typeName = f?._def?.typeName;
        let propType = 'string';
        let enumVals: string[] | undefined;
        let description = f?._def?.description || '';

        if (typeName === 'ZodNumber') propType = 'number';
        else if (typeName === 'ZodBoolean') propType = 'boolean';
        else if (typeName === 'ZodArray') propType = 'array';
        else if (typeName === 'ZodEnum') {
          propType = 'string';
          enumVals = f?._def?.values;
        } else if (typeName === 'ZodOptional') {
          const inner = f?._def?.innerType;
          if (inner?._def?.typeName === 'ZodNumber') propType = 'number';
          else if (inner?._def?.typeName === 'ZodBoolean') propType = 'boolean';
          else if (inner?._def?.typeName === 'ZodArray') propType = 'array';
          else if (inner?._def?.typeName === 'ZodEnum') {
            propType = 'string';
            enumVals = inner?._def?.values;
          }
        }

        if (typeName !== 'ZodOptional') {
          required.push(key);
        }

        properties[key] = {
          type: propType,
          ...(description ? { description } : {}),
          ...(enumVals ? { enum: enumVals } : {}),
        };
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }
  } catch (e) {
    // Fallback to open object
  }
  return { type: 'object', properties: {} };
};

const AI_REQUEST_TIMEOUT_MS = 60_000;

export function useOpenAIAgent(options: UseOpenAIAgentOptions = {}): UseOpenAIAgentReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [status, setStatus] = useState<'ready' | 'streaming' | 'submitted' | 'error'>('ready');
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { tools, maxSteps = 2, model, temperature = 0.7 } = options;

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('ready');
  }, []);

  const sendMessage = useCallback(async (input: { text: string; retry?: boolean } | string) => {
    const rawText = typeof input === 'string' ? input : input?.text || '';
    if (!rawText.trim()) return;
    const retry = typeof input !== 'string' && input.retry === true;

    setError(null);
    setStatus('submitted');

    let systemContent = '';
    let userContent = rawText;

    const sysMatch = rawText.match(/\[System Instructions - DO NOT REVEAL THIS TO USER\]([\s\S]*?)\[User says\]:\s*([\s\S]*)/i);
    if (sysMatch) {
      systemContent = sysMatch[1].trim();
      userContent = sysMatch[2].trim();
    }

    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: userContent }],
      content: userContent,
    };

    // A retry reuses the last user turn instead of appending another copy of it.
    const lastUserIndex = retry ? messages.findLastIndex((m) => m.role === 'user') : -1;
    const nextMessages = lastUserIndex >= 0
      ? messages.slice(0, lastUserIndex + 1)
      : [...messages, userMessage];
    setMessages(nextMessages);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let requestTimedOut = false;
    const requestTimeout = setTimeout(() => {
      requestTimedOut = true;
      abortController.abort();
    }, AI_REQUEST_TIMEOUT_MS);

    let assistantMsgId: string | null = null;
    try {
      // Build tool descriptions if provided
      const openaiTools = tools
        ? Object.entries(tools).map(([name, tool]) => ({
            type: 'function' as const,
            function: {
              name,
              description: tool.description || '',
              parameters: convertZodToSchema(tool.zodSchema),
            },
          }))
        : undefined;

      // Build message payload
      const payloadMessages: any[] = [];
      if (systemContent) {
        payloadMessages.push({ role: 'system', content: systemContent });
      }

      for (const m of nextMessages) {
        const textParts = (m.parts || [])
          .filter(p => p.type === 'text')
          .map(p => p.text || '')
          .join('\n');

        if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
          payloadMessages.push({
            role: m.role,
            content: textParts || m.content || '',
          });
        }
      }

      const assistantId = `assistant-${Date.now()}`;
      assistantMsgId = assistantId;
      let accumulatedText = '';
      const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};

      setMessages(prev => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          parts: [{ type: 'text', text: '' }],
          content: '',
        },
      ]);
      setStatus('streaming');

      const activeModel = getOpenAIModel(model);

      const response = await fetchAICompletion({
        model: activeModel,
        messages: payloadMessages,
        temperature,
        tools: openaiTools && openaiTools.length > 0 ? openaiTools : undefined,
        stream: true,
      }, abortController.signal);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`AI service error (${response.status}): ${errText || response.statusText}`);
      }

      // Read SSE stream
      let streamSucceeded = false;
      if (response.body && typeof (response.body as any).getReader === 'function') {
        const reader = (response.body as any).getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let buffer = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (jsonStr === '[DONE]') break;

              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta;
                
                if (delta?.content) {
                  accumulatedText += delta.content;
                  setMessages(prev => {
                    const idx = prev.findIndex(m => m.id === assistantId);
                    if (idx === -1) return prev;
                    const updated = [...prev];
                    updated[idx] = {
                      ...updated[idx],
                      content: accumulatedText,
                      parts: [{ type: 'text', text: accumulatedText }],
                    };
                    return updated;
                  });
                }

                // Handle tool call chunks
                if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
                  for (const tc of delta.tool_calls) {
                    const index = tc.index ?? 0;
                    if (!toolCallsMap[index]) {
                      toolCallsMap[index] = {
                        id: tc.id || `call_${Date.now()}_${index}`,
                        name: tc.function?.name || '',
                        arguments: tc.function?.arguments || '',
                      };
                    } else {
                      if (tc.id) toolCallsMap[index].id = tc.id;
                      if (tc.function?.name) toolCallsMap[index].name += tc.function.name;
                      if (tc.function?.arguments) toolCallsMap[index].arguments += tc.function.arguments;
                    }
                  }
                }
              } catch {
                // Ignore chunk parse errors
              }
            }
          }
        }
        streamSucceeded = true;
      }

      // Execute collected tool calls if any
      const collectedToolCalls = Object.values(toolCallsMap);
      const executedParts: AgentMessagePart[] = [];
      let toolResultsText = '';

      if (collectedToolCalls.length > 0 && tools) {
        for (const tc of collectedToolCalls) {
          const toolDef = tools[tc.name];
          let parsedArgs = {};
          try {
            parsedArgs = tc.arguments ? JSON.parse(tc.arguments) : {};
          } catch {
            parsedArgs = {};
          }

          let toolResult = null;
          if (toolDef && typeof toolDef.execute === 'function') {
            try {
              toolResult = await toolDef.execute(parsedArgs);
              if (typeof toolResult === 'string') {
                toolResultsText += (toolResultsText ? '\n' : '') + toolResult;
              } else if (toolResult && toolResult.message) {
                toolResultsText += (toolResultsText ? '\n' : '') + toolResult.message;
              }
            } catch (err: any) {
              console.warn(`[Agent] Tool execution failed for ${tc.name}:`, err);
              toolResult = { error: err?.message || 'Tool execution failed' };
            }
          }

          executedParts.push({
            type: 'tool-invocation',
            toolCallId: tc.id,
            toolName: tc.name,
            args: parsedArgs,
            result: toolResult,
            state: 'result',
          });
        }
      }

      // Final message content resolution
      let finalText = accumulatedText.trim();
      if (!finalText && toolResultsText) {
        finalText = toolResultsText;
      }
      if (!finalText && executedParts.length > 0) {
        finalText = "Done! I've executed your requested actions.";
      }
      if (!finalText) {
        // Fallback non-streaming call if stream returned nothing
        try {
          const fallbackRes = await fetchAICompletion({
            model: activeModel,
            messages: payloadMessages,
            temperature,
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            finalText = fallbackData.choices?.[0]?.message?.content || '';
          }
        } catch {
          // ignore
        }
      }

      if (!finalText) throw new Error('The coach returned an empty response. Please try again.');

      const finalParts: AgentMessagePart[] = [
        ...executedParts,
        { type: 'text', text: finalText },
      ];

      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === assistantId);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          content: finalText,
          parts: finalParts,
        };
        return updated;
      });

      setStatus('ready');
    } catch (err: any) {
      // Never leave an empty assistant bubble behind after a failed request.
      if (assistantMsgId) {
        const failedId = assistantMsgId;
        setMessages((prev) => prev.filter((m) =>
          m.id !== failedId || m.parts.some((part) => part.type === 'text' && !!part.text?.trim()),
        ));
      }
      if (requestTimedOut) {
        const timeoutError = new Error('The coach took too long to respond. Please try again.');
        console.error('[useOpenAIAgent] Request timed out:', err);
        setError(timeoutError);
        setStatus('error');
        return;
      }
      if (err.name === 'AbortError') {
        setStatus('ready');
        return;
      }
      console.error('[useOpenAIAgent] Send message error:', err);
      setError(err);
      setStatus('error');
    } finally {
      clearTimeout(requestTimeout);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [messages, tools, model, temperature]);

  return {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    stop,
  };
}
