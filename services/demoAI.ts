import type { AICompletionRequest } from './aiClient';

const DEMO_NOTICE = 'A focused action plan is ready.';
const DEMO_THINKING_DELAY_MS = 3000;

function waitForDemoThinking(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abortError = new Error('The local reply was cancelled.');
    abortError.name = 'AbortError';
    if (signal?.aborted) {
      reject(abortError);
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, DEMO_THINKING_DELAY_MS);
    signal?.addEventListener('abort', onAbort);
  });
}

function studyDetails(text: string) {
  const subject = text.match(/\b(math|mathematics|biology|chemistry|physics|history|english|coding)\b/i)?.[1];
  const distraction = text.match(/\b(instagram|tiktok|youtube|facebook|reddit|snapchat)\b/i)?.[1];
  const deadline = text.match(/\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1];
  return { subject, distraction, deadline };
}

function requestedAlarm(text: string) {
  if (!/\b(alarm|wake me|wake up)\b/i.test(text)) return null;
  const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (!match) return null;
  const twelveHour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3].toLowerCase();
  const hour = (twelveHour % 12) + (meridiem === 'pm' ? 12 : 0);
  return { hour, minute, label: `${twelveHour}:${String(minute).padStart(2, '0')} ${meridiem.toUpperCase()}` };
}

function requestedGuard(text: string) {
  const { distraction } = studyDetails(text);
  if (!distraction || !/\b(block|guard|keep me off|lock out|stop me opening)\b/i.test(text)) return null;
  const duration = text.match(/\b(\d{1,2})\s*(hours?|hrs?|minutes?|mins?)\b/i);
  const amount = duration ? Number(duration[1]) : 25;
  const minutes = duration && /^h/i.test(duration[2]) ? amount * 60 : amount;
  return { app: distraction, minutes: Math.max(5, Math.min(720, minutes)) };
}

function lastUserText(request: AICompletionRequest): string {
  return [...request.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function demoPlan(prompt: string, platform: string) {
  const request = prompt.match(/Their request: "([\s\S]*?)"\s*$/)?.[1] ?? '';
  const studyRequest = /exam|study|studying|focus|revise|revision|plan my week|امتحان|مذاكر/i.test(request);
  const { subject, distraction, deadline } = studyDetails(request);
  const alarm = requestedAlarm(request);
  const requestedBlock = requestedGuard(request);
  if (!studyRequest && !alarm && !requestedBlock) {
    return { understood: 'Tell me what you want to do, and I can suggest a concrete next step.', actions: [] };
  }
  const topic = subject ? `${subject.toLowerCase()} exam` : 'exam';
  const timing = deadline ? ` before ${deadline}` : '';
  const guard = distraction ? ` Keep ${distraction} closed during the block.` : '';
  const actions: Array<Record<string, unknown>> = [];
  if (studyRequest) {
    actions.push({
      kind: 'save_note',
      title: 'Your next study step',
      detail: 'Save a 25-minute study commitment to your Mind.',
      note: `Study the hardest ${topic} topic for 25 minutes${timing}, then test yourself from memory.${guard}`,
      category: 'study',
    });
  }
  if (alarm) {
    actions.push({
      kind: 'alarm',
      title: `Study alarm · ${alarm.label}`,
      detail: 'One-time alarm at the next occurrence of this time.',
      hour: alarm.hour,
      minute: alarm.minute,
    });
  }
  if (platform === 'android' && (requestedBlock || (studyRequest && distraction))) {
    const app = requestedBlock?.app ?? distraction!;
    const minutes = requestedBlock?.minutes ?? 25;
    actions.push({
      kind: 'guard',
      title: `Guard ${app} for ${minutes} minutes`,
      detail: 'Requires Focus Guardian permissions on this Android device.',
      apps: [app],
      durationMinutes: minutes,
    });
  }
  if (platform === 'ios' && (requestedBlock || (studyRequest && distraction))) {
    const app = requestedBlock?.app ?? distraction!;
    const minutes = requestedBlock?.minutes ?? 25;
    actions.push({
      kind: 'focus_preview',
      title: `Focus Shield · ${app}`,
      detail: `Prepare a ${minutes}-minute focus block around your next step.`,
      apps: [app],
      durationMinutes: minutes,
    });
  }
  return {
    understood: studyRequest ? `Protect one focused block for your ${topic}` : alarm ? `Set a ${alarm.label} alarm` : `Guard ${requestedBlock!.app} for ${requestedBlock!.minutes} minutes`,
    why: studyRequest ? 'A small, specific step is easier to start than a whole exam plan.' : undefined,
    actions,
  };
}

function demoObject(prompt: string, platform: string): object {
  if (prompt.includes('You are Mazō\'s Agent')) return demoPlan(prompt, platform);
  if (prompt.includes('You are the memory manager')) return {};
  if (prompt.includes('perceptive inner voice of Mazō')) return { found: false };
  if (prompt.includes('Mazō\'s Day Architect')) return { why: DEMO_NOTICE, actions: [] };
  return {};
}

function demoCoachReply(request: AICompletionRequest, platform: string): string {
  const user = lastUserText(request);
  const { subject, distraction } = studyDetails(user);
  const alarm = requestedAlarm(user);
  const requestedBlock = requestedGuard(user);
  if (user.includes('You are a content validator')) {
    // Local Mode still lets the real custom-coach form validate and save a
    // meaningful set of instructions without a network AI provider.
    return 'VALID';
  }
  if (/i approved your plan/.test(user)) {
    return 'I’ve handled the steps you approved. Check the receipt below for exactly what completed.';
  }
  if (requestedBlock && !/exam|study|studying|focus|revise|revision|امتحان|مذاكر/i.test(user)) {
    return platform === 'android'
      ? `Let’s guard ${requestedBlock.app} for ${requestedBlock.minutes} minutes. Review and approve the action below; Android will ask for Focus Guardian access if needed.`
      : `I’ll prepare a Focus Shield around ${requestedBlock.app} for your next focus block. Review it below, then approve when ready.`;
  }
  if (/exam|study|studying|focus|distract|instagram|امتحان|مذاكر/i.test(user)) {
    const topic = subject ? ` for ${subject.toLowerCase()}` : '';
    const guard = distraction ? ` away from ${distraction}` : '';
    const alarmLine = alarm ? ` I can set your ${alarm.label} study alarm too.` : '';
    return `You do not need to solve the whole week right now. Let’s protect one 25-minute study block${topic}${guard}.${alarmLine} Review the steps below and approve them if they feel right.`;
  }
  if (alarm) return `Let’s set your ${alarm.label} alarm. Review the action below and approve it when ready.`;
  return 'What is the one concrete step you want to take today? Try asking for help with an exam study plan.';
}

/** OpenAI-shaped local response used only when the explicit demo switch is on. */
export async function createDemoCompletionResponse(
  request: AICompletionRequest,
  platform = 'web',
  signal?: AbortSignal,
): Promise<Response> {
  // Only visible streamed chat replies pause. Action proposals, memory work,
  // and custom-coach validation remain immediate in Local Mode.
  if (request.stream && request.response_format?.type !== 'json_object') {
    await waitForDemoThinking(signal);
  }

  const content = request.response_format?.type === 'json_object'
    ? JSON.stringify(demoObject(lastUserText(request), platform))
    : demoCoachReply(request, platform);

  if (request.stream) {
    const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
    return new Response(`data: ${chunk}\n\ndata: [DONE]\n\n`, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
