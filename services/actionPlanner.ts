import { z } from 'zod';
import type { Memory, MindInsight, ActionPlan, MazoAction } from '@/types';

/**
 * The Agent's planner. Turns a free-text (or voice) request into an ordered
 * ActionPlan of concrete phone actions, informed by the user's Mind. The AI SDK
 * is lazy-loaded so importing this never boots the native toolkit. Returns null
 * when nothing actionable could be derived.
 */

const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * Fast, dependency-free gate that decides whether a chat message is asking Mazō
 * to DO something on the phone (so the chat should run the planner), versus pure
 * venting or reflection. Multilingual (English + Arabic) and deliberately
 * permissive — generateActionPlan itself returns null when nothing concrete
 * follows, so a false positive only costs one call, while a miss leaves the chat
 * feeling "boring". This is what lets the chat conclude actions from context
 * without depending on the model choosing to call a tool.
 */
const ACTIONABLE_PATTERNS: RegExp[] = [
  // English — device + agentic verbs/nouns
  /\b(open|launch|play|fire up)\b/i,
  /\b(call|ring|dial|phone)\b/i,
  /\b(text|message|whatsapp|sms|dm|email)\b/i,
  /\b(remind|reminder)\b/i,
  /\b(alarm|wake me|wake up|snooze)\b/i,
  /\b(timer|pomodoro)\b/i,
  /\b(block|guard|silence|mute|detox|lockdown|lock out)\b/i,
  /\b(focus|study|studying|revise|revision|deep work|grind)\b/i,
  /\b(exam|deadline|finals|midterm|assignment)\b/i,
  /\b(schedule|calendar|meeting|appointment|book (a|an))\b/i,
  /\b(plan (my|the|a|out)|organi[sz]e|set up my|map out|map my)\b/i,
  /\b(navigate|directions|take me to|drive to|route to)\b/i,
  /\b(set (a|an|up)|start (a|my))\b/i,
  /\b(help me (focus|study|stop|plan)|get me through|keep me off)\b/i,
  /\bat\s?\d{1,2}(:\d{2})?\s?(am|pm)?\b/i,
  /\b\d{1,2}\s?(am|pm)\b/i,
  /\b(tonight|tomorrow|every (day|morning|night))\b/i,
  // Arabic — device + agentic verbs/nouns
  /(افتح|شغّل|شغل|فتّح|فتح)/,
  /(اتصل|اتّصل|كلّم|كلم|رنّ|رن)/,
  /(رسالة|رساله|ابعت|بعت|واتس|واتساب)/,
  /(ذكّرني|ذكرني|تذكير|فكّرني|فكرني)/,
  /(منبّه|منبه|صحّيني|صحيني|صحني|نبّهني|نبهني)/,
  /(مؤقت|مؤقّت|تايمر)/,
  /(احجب|امنع|اقفل|اقفلي|اغلق|سكّر|سكر)/,
  /(ركّز|ركز|تركيز|ذاكر|أذاكر|مذاكرة|المذاكرة|راجع|مراجعة)/,
  /(امتحان|الامتحان|امتحانات|ديتوكس)/,
  /(خطة|خطّة|خطط|خطّط|نظّم|نظم|رتّب|رتب|جدول|جدّول)/,
  /(موعد|اجتماع|محاضرة)/,
  /(نظّملي|نظملي|رتّبلي|رتبلي|يومي)/,
  /(الليلة|بكرة|بكره|غدًا|غدا|كل يوم|كل صباح)/,
];

export function detectActionableIntent(text: string): boolean {
  const t = (text ?? '').trim();
  if (t.length < 3) return false;
  return ACTIONABLE_PATTERNS.some((re) => re.test(t));
}

/** ISO for hour:minute, `dayOffset` days out; if today and already past, roll to tomorrow. */
function occurrenceISO(hour: number, minute: number, dayOffset = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (dayOffset > 0) d.setDate(d.getDate() + dayOffset);
  else if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

const actionSchema = z.object({
  kind: z.enum(['alarm', 'calendar', 'reminder', 'open_app', 'message', 'call', 'navigate', 'open_link', 'guard', 'save_note']),
  title: z.string(),
  detail: z.string().optional(),
  // timing
  hour: z.number().min(0).max(23).optional(),
  minute: z.number().min(0).max(59).optional(),
  endHour: z.number().min(0).max(23).optional(),
  weekdaysOnly: z.boolean().optional(),
  dayOffset: z.number().min(0).max(14).optional(),
  // device
  app: z.string().optional(),
  to: z.string().optional(),
  body: z.string().optional(),
  via: z.enum(['sms', 'whatsapp']).optional(),
  number: z.string().optional(),
  destination: z.string().optional(),
  url: z.string().optional(),
  query: z.string().optional(),
  note: z.string().optional(),
  category: z.string().optional(),
  // guard
  apps: z.array(z.string()).optional(),
  durationMinutes: z.number().min(5).max(720).optional(),
});

const planSchema = z.object({
  understood: z.string(),
  why: z.string().optional(),
  actions: z.array(actionSchema).max(8),
});

type RawAction = z.infer<typeof actionSchema>;

function toMazoAction(a: any, i: number): MazoAction {
  const id = `act-${Date.now()}-${i}`;
  const minute = typeof a.minute === 'number' ? a.minute : 0;
  const title = (a.title || a.name || a.label || a.task || a.action || a.detail || a.kind || `Action ${i + 1}`).trim();
  const detail = a.detail || a.description || a.note || '';
  const base = { id, kind: a.kind || 'reminder', title, detail } as MazoAction;

  switch (a.kind) {
    case 'alarm':
      return { ...base, hour: a.hour ?? 7, minute, days: a.weekdaysOnly ? WEEKDAYS : [] };
    case 'calendar': {
      const startHour = a.hour ?? 9;
      const startISO = occurrenceISO(startHour, minute, a.dayOffset ?? 0);
      const end = new Date(startISO);
      end.setHours(a.endHour ?? startHour + 1, minute, 0, 0);
      return { ...base, startISO, endISO: end.toISOString() };
    }
    case 'reminder': {
      const dueISO = a.hour != null ? occurrenceISO(a.hour, minute, a.dayOffset ?? 0) : new Date(Date.now() + 60 * 60 * 1000).toISOString();
      return { ...base, dueISO };
    }
    case 'open_app':
      return { ...base, app: a.app };
    case 'message':
      return { ...base, to: a.to, body: a.body, via: a.via ?? 'sms' };
    case 'call':
      return { ...base, number: a.number ?? a.to };
    case 'navigate':
      return { ...base, destination: a.destination };
    case 'open_link':
      return { ...base, url: a.url, query: a.query };
    case 'guard':
      return { ...base, apps: a.apps ?? [], durationMinutes: a.durationMinutes ?? 120 };
    case 'save_note':
      return { ...base, note: a.note ?? a.title, category: a.category };
    default:
      return base;
  }
}

export async function generateActionPlan(
  request: string,
  memory: Memory,
  mindInsights: MindInsight[],
  topDistractions: string[] = [],
): Promise<ActionPlan | null> {
  const trimmed = request.trim();
  if (!trimmed) return null;

  const known =
    (mindInsights ?? [])
      .filter((i) => i.status === 'confirmed' || i.status === 'corrected')
      .map((i) => `- ${i.text}`)
      .join('\n') || 'Not much yet';
  const goals = memory.goals.filter((g) => g.status === 'active').map((g) => g.title).join(', ') || 'None';
  const distractions = topDistractions.length ? topDistractions.join(', ') : 'Instagram, TikTok, YouTube';
  const now = new Date();

  const system = `You are Mazō's Agent — you orchestrate a person's phone from one request. Return the FEWEST actions that fully satisfy them, but for a broad goal ("plan my exam week", "get me through today", "detox my phone") produce a complete, coordinated plan of up to 8 actions.

Action kinds and the fields each needs:
- alarm: title, hour, minute, optional weekdaysOnly
- calendar: title, hour, minute, endHour (block end), optional dayOffset (0=today, 1=tomorrow)
- reminder: title, hour, minute, optional dayOffset
- open_app: app — the name of the app to open (spotify, pubg, whatsapp…). For "open/launch/play X" ALWAYS use open_app. Never open_link for an app.
- message: to (name or number, optional), body, via ("sms" or "whatsapp")
- call: number (or to)
- navigate: destination (a place or address)
- open_link: url OR query — ONLY a website or web search, never to open an app
- guard: apps (list of app names to block, e.g. ["Instagram","TikTok"]), durationMinutes. Blocks distractions for a stretch of focus. THIS IS MAZŌ'S SUPERPOWER — use it whenever the user wants to focus, study, work, or detox.
- save_note: note, optional category

Rules:
- Only produce actions that clearly follow from the request. Never invent unrelated steps.
- 24h times. Use the time the user states; otherwise choose sensible ones.
- For focus/study/work plans, ADD a guard action targeting their real distractions so the plan actually protects the time.
- "understood": a short second-person restatement. "why": one short warm sentence (optional), tie it to what you know about them. "title": clear human label. "detail": short subline.

Hero patterns (compose richly):
- "Plan my exam week" → a few calendar study blocks (next days), a wake alarm, a guard over their distractions during study, a reminder to review, a motivating note.
- "Get me through today" → wake alarm, 2-3 calendar blocks today, a guard during the main work block, a wind-down reminder.
- "Detox my phone" → guard their top distractions for a long stretch, a calendar focus block, a reminder to take a real break, a note on why.

Current local time: ${now.toLocaleString()}.
Their top distracting apps (use these for guard): ${distractions}
What you know about them:
${known}
Active goals: ${goals}

Their request: "${trimmed}"`;

  try {
    const { generateObject } = await import('@/services/openai');
    const res = await generateObject({ messages: [{ role: 'user', content: system }], schema: planSchema });
    const r = res?.object || res;
    if (!r || !r.actions || !r.actions.length) return null;
    return { understood: r.understood || 'Understood', why: r.why, actions: r.actions.map(toMazoAction) };
  } catch (e) {
    console.warn('[ActionPlanner] generateActionPlan failed', e);
    return null;
  }
}

