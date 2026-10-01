import { createRorkTool } from '@/services/openai';
import { z } from 'zod';
import { Goal, Task, ScheduleItem, Habit, Idea, Problem, Preference, AIActionResult, AlarmSoundId } from '@/types';

export const createCoachTools = (actions: {
  addScheduleItem: (item: Omit<ScheduleItem, 'id' | 'createdAt'>) => ScheduleItem;
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => AIActionResult;
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => AIActionResult;
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => AIActionResult;
  addIdea: (idea: Omit<Idea, 'id' | 'createdAt'>) => AIActionResult;
  addProblem: (problem: Omit<Problem, 'id' | 'createdAt'>) => AIActionResult;
  addPreference: (pref: Omit<Preference, 'id' | 'createdAt'>) => AIActionResult;
  completeTaskByTitle: (title: string) => AIActionResult;
  onSwitchCoach: (coachId: string) => boolean;
  startFocusTimer: (durationMinutes: number, taskName: string, technique: 'pomodoro' | 'deep_work' | 'sprint' | 'custom') => string;
  setAlarm: (alarm: { hour: number; minute: number; days: number[]; label: string; soundId: AlarmSoundId; enabled: boolean }) => string;
  deleteAlarmByLabel: (label: string) => AIActionResult;
  getPhoneUsage: (days: number) => string;
  proposePhoneActions: (request: string) => string;
  findDocument: (query: string) => Promise<string>;
  availableCoachIds: string[];
  currentDayIndex: number;
}) => ({
  addToSchedule: createRorkTool({
    description: 'Add a specific, timed task to the user\'s schedule. IMPORTANT: Before using this tool, you MUST first ask the user about their available free time, existing commitments, and preferences. Never add schedule items without discussing the plan first. Only use after the user has agreed to a specific task and time. Categories: morning (before noon), afternoon (noon to evening), evening (after 6pm), anytime (flexible timing).',
    zodSchema: z.object({
      title: z.string().describe('Short, specific title for the scheduled task (e.g. "30 min workout" not "Get healthier")'),
      description: z.string().optional().describe('Optional longer description'),
      category: z.enum(['morning', 'afternoon', 'evening', 'anytime']).describe('Time of day for this task'),
      dayIndex: z.number().optional().describe('Day index (0 for today). Leave empty to use current day.'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Adding to schedule:', input);
      const item = actions.addScheduleItem({
        title: input.title,
        description: input.description,
        category: input.category,
        dayIndex: input.dayIndex ?? actions.currentDayIndex,
        order: Date.now(),
        isCompleted: false,
      });
      return `Added "${input.title}" to your schedule (ID: ${item.id})`;
    },
  }),

  addGoal: createRorkTool({
    description: 'Create a new goal for the user. Use this when the user wants to set a goal, objective, or target they want to achieve.',
    zodSchema: z.object({
      title: z.string().describe('Goal title'),
      description: z.string().describe('Goal description with details'),
      type: z.enum(['short-term', 'long-term']).describe('Whether this is a short-term or long-term goal'),
      priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Adding goal:', input);
      const result = actions.addGoal({
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        status: 'active',
      });
      return result.message;
    },
  }),

  addTask: createRorkTool({
    description: 'Create a new task for the user. Use this when the user wants to add a task, to-do item, or action item.',
    zodSchema: z.object({
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Optional task description'),
      priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
      estimatedMinutes: z.number().optional().describe('Estimated time in minutes'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Adding task:', input);
      const result = actions.addTask({
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: 'pending',
        estimatedMinutes: input.estimatedMinutes,
      });
      return result.message;
    },
  }),

  completeTask: createRorkTool({
    description: 'Mark a task as completed. Use this when the user says they finished or completed a task.',
    zodSchema: z.object({
      taskTitle: z.string().describe('The title or part of the title of the task to complete'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Completing task:', input);
      const result = actions.completeTaskByTitle(input.taskTitle);
      return result.message;
    },
  }),

  addHabit: createRorkTool({
    description: 'Create a new habit for the user to track. Use this when the user wants to build a new habit or routine.',
    zodSchema: z.object({
      title: z.string().describe('Habit title'),
      frequency: z.enum(['daily', 'weekly', 'monthly']).describe('How often the habit should be done'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Adding habit:', input);
      const result = actions.addHabit({
        title: input.title,
        frequency: input.frequency,
      });
      return result.message;
    },
  }),

  saveIdea: createRorkTool({
    description: 'Save an idea or thought the user wants to remember. Use this when the user shares an idea, insight, or thought they want to keep.',
    zodSchema: z.object({
      content: z.string().describe('The idea or thought to save'),
      category: z.string().optional().describe('Optional category for the idea'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Saving idea:', input);
      const result = actions.addIdea({
        content: input.content,
        category: input.category,
      });
      return result.message;
    },
  }),

  trackChallenge: createRorkTool({
    description: 'Track a problem or challenge the user is facing. Use this when the user describes a challenge, obstacle, or problem they need to address.',
    zodSchema: z.object({
      description: z.string().describe('Description of the challenge or problem'),
      urgency: z.enum(['high', 'medium', 'low']).describe('How urgent is this challenge'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Tracking challenge:', input);
      const result = actions.addProblem({
        description: input.description,
        urgency: input.urgency,
        status: 'open',
      });
      return result.message;
    },
  }),

  rememberPreference: createRorkTool({
    description: 'Remember something about the user - their preferences, likes, dislikes, values, or interests. Use this to save things the user mentions about themselves.',
    zodSchema: z.object({
      key: z.string().describe('Short label for what this preference is about'),
      value: z.string().describe('The actual preference or information'),
      category: z.enum(['like', 'dislike', 'value', 'habit', 'interest', 'other']).describe('Category of preference'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Remembering preference:', input);
      const result = actions.addPreference({
        key: input.key,
        value: input.value,
        category: input.category,
      });
      return result.message;
    },
  }),

  switchCoach: createRorkTool({
    description: 'Switch the user to a different coach that would be better suited for the current topic. Use this when the user asks to switch coaches or when their needs clearly align better with another coach. Only switch when the user agrees or explicitly asks. Only switch to coaches the user has available.',
    zodSchema: z.object({
      coachId: z.string().describe('ID of the coach to switch to'),
      reason: z.string().describe('Brief reason why this coach would be better'),
    }),
    execute(input) {
      // Validate the coach is available to the user
      if (!actions.availableCoachIds.includes(input.coachId)) {
        return `Cannot switch: coach "${input.coachId}" is not available. Available coaches: ${actions.availableCoachIds.join(', ')}`;
      }
      if (__DEV__) console.log('AI Tool: Switching coach to:', input.coachId);
      // Defer the switch so it doesn't disrupt the current AI message stream
      setTimeout(() => {
        actions.onSwitchCoach(input.coachId);
      }, 500);
      return `Switched to coach "${input.coachId}". ${input.reason}`;
    },
  }),

  suggestQuickQuestion: createRorkTool({
    description: 'Suggest a contextual question with tappable options to quickly gather info from the user. Use when you need specific info before giving advice. Max 4 options.',
    zodSchema: z.object({
      question: z.string().describe('The question to ask'),
      options: z.array(z.string()).describe('2-4 tappable response options'),
    }),
    execute(input) {
      return JSON.stringify({ type: 'quick_question', question: input.question, options: input.options });
    },
  }),

  triggerSelfDiscovery: createRorkTool({
    description: 'Generate a set of customized questions to gather specific data from the user. Use when you need deeper understanding of the user\'s preferences or situation.',
    zodSchema: z.object({
      topic: z.string().describe('What topic these questions are about'),
      questions: z.array(z.object({
        question: z.string(),
        options: z.array(z.string()),
      })).describe('Array of questions with options'),
    }),
    execute(input) {
      return JSON.stringify({ type: 'discovery', topic: input.topic, questions: input.questions });
    },
  }),

  startFocusTimer: createRorkTool({
    description: 'Start a focus session timer. IMPORTANT: Do NOT call this tool immediately. First ask the user what they want to focus on, suggest a technique (Pomodoro 25/5, Deep Work 45min, Quick Sprint 15min), and confirm the duration. Only call this AFTER the user agrees to start.',
    zodSchema: z.object({
      durationMinutes: z.number().describe('Duration of the focus session in minutes'),
      taskName: z.string().describe('The name of the task the user is focusing on'),
      technique: z.enum(['pomodoro', 'deep_work', 'sprint', 'custom']).describe('The focus technique selected by the user.'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Starting focus timer:', input);
      const msg = actions.startFocusTimer(input.durationMinutes, input.taskName, input.technique as any);
      return msg;
    },
  }),

  setAlarm: createRorkTool({
    description: 'Set an alarm for the user. Accepts hour (0-23), minute (0-59), or time string (e.g. "07:00", "7:00 AM"), days of week array (0=Sun, 1=Mon...6=Sat), label, and soundId.',
    zodSchema: z.object({
      hour: z.number().min(0).max(23).optional().describe('Hour in 24-hour format (0-23)'),
      minute: z.number().min(0).max(59).optional().describe('Minute (0-59)'),
      time: z.string().optional().describe('Time in 24h or 12h format, e.g. "07:00" or "7:00 AM"'),
      days: z.any().optional().describe('Days of week: array of numbers [0..6], or 7 for every day, or "everyday" / "weekdays"'),
      label: z.string().optional().describe('Short label for the alarm, e.g. "Wake Up", "School"'),
      soundId: z.string().optional().describe('Sound ID: gentle, sunrise, classic, birds, ocean, piano, digital, vibrate'),
    }),
    execute(input: any) {
      if (__DEV__) console.log('AI Tool: Setting alarm:', input);
      let hour = typeof input.hour === 'number' && !isNaN(input.hour) ? input.hour : 7;
      let minute = typeof input.minute === 'number' && !isNaN(input.minute) ? input.minute : 0;

      if (input.time && typeof input.time === 'string') {
        const match = input.time.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
        if (match) {
          hour = parseInt(match[1], 10);
          minute = parseInt(match[2], 10);
          if (match[3]?.toLowerCase() === 'pm' && hour < 12) hour += 12;
          if (match[3]?.toLowerCase() === 'am' && hour === 12) hour = 0;
        }
      }

      let days: number[] = [];
      if (Array.isArray(input.days)) {
        days = input.days;
      } else if (typeof input.days === 'number') {
        days = input.days === 5 ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
      } else if (typeof input.days === 'string') {
        const d = input.days.toLowerCase();
        if (d.includes('weekday')) days = [1, 2, 3, 4, 5];
        else if (d.includes('every') || d.includes('all') || d.includes('daily')) days = [0, 1, 2, 3, 4, 5, 6];
      }

      const label = input.label || input.title || 'Alarm';
      const soundId = input.soundId || input.sound || 'gentle';

      const msg = actions.setAlarm({
        hour,
        minute,
        days,
        label,
        soundId,
        enabled: true,
      });
      return msg;
    },
  }),

  deleteAlarmByLabel: createRorkTool({
    description: 'Delete an alarm by its label. Use when the user asks to remove or cancel an alarm.',
    zodSchema: z.object({
      label: z.string().describe('The label of the alarm to delete'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Deleting alarm:', input);
      const result = actions.deleteAlarmByLabel(input.label);
      return result.message;
    },
  }),

  getPhoneUsage: createRorkTool({
    description: "Get the user's REAL phone app-usage (top apps by screen time) for the last N days. Call this when the user asks about their screen time, phone habits, what they waste time on, focus/distraction, or whenever concrete usage data would make your coaching specific instead of generic. This is Mazō's edge — you can see what they actually do. Android only; returns a note if unavailable.",
    zodSchema: z.object({
      days: z.number().min(1).max(30).optional().describe('How many days back to summarize (default 7)'),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Reading phone usage:', input);
      return actions.getPhoneUsage(input.days ?? 7);
    },
  }),

  proposePhoneActions: createRorkTool({
    description: "Mazō's agent — actually DO things on the user's phone. Call this when the user wants real actions taken: set alarms, add calendar/study blocks, set reminders, block/guard distracting apps, open an app, message or call someone, get directions, or a multi-step plan ('plan my exam week', 'get me through today', 'detox my phone'). Pass their full request in natural language; Mazō turns it into a concrete plan and shows the user an approval card — they tap to run it. Do NOT use this just to talk; use it to act.",
    zodSchema: z.object({
      request: z.string().describe("The user's request in plain language, e.g. 'plan my exam week' or 'wake me at 7 and block Instagram for 2 hours'"),
    }),
    execute(input) {
      if (__DEV__) console.log('AI Tool: Proposing phone actions:', input);
      return actions.proposePhoneActions(input.request);
    },
  }),

  findDocument: createRorkTool({
    description: "Find a file on the user's device by its name or by what's written inside it. Call this when the user asks WHERE something is or to find a file/note/document — 'where's my thesis budget', 'find my notes about the trip', 'which file has my scholarship deadline'. Searches only folders the user has granted, all on-device. Returns matching files with a snippet; then tell the user the file name and where it is.",
    zodSchema: z.object({
      query: z.string().describe("What the user is looking for, e.g. 'thesis budget' or 'scholarship deadline notes'"),
    }),
    async execute(input) {
      if (__DEV__) console.log('AI Tool: Finding document:', input);
      return actions.findDocument(input.query);
    },
  }),
});

export const COACH_SYSTEM_PROMPT_ADDON = `
[TOOLS — use PROACTIVELY and silently, never announce]
Available: addToSchedule, addGoal, addTask, completeTask, addHabit, saveIdea, trackChallenge, rememberPreference, switchCoach, suggestQuickQuestion, startFocusTimer, setAlarm, deleteAlarmByLabel, getPhoneUsage, proposePhoneActions, findDocument.

proposePhoneActions RULE (Mazō's superpower — "I run your phone"):
- When the user wants you to actually DO something on their phone — set alarms/reminders, add calendar or study blocks, BLOCK/guard distracting apps, open an app, text or call someone (by name is fine), get directions, or any multi-step plan like "plan my exam week" / "get me through today" / "detox my phone" — call proposePhoneActions with their request in plain language.
- It shows the user a single approval card and runs everything they approve. Prefer it over many separate tool calls when they want a coordinated plan.
- Then tell them in one short line that their plan is ready to approve. Don't list the steps yourself — the card shows them.

getPhoneUsage RULE:
- When the user asks about screen time, phone habits, distraction, "where does my time go", or you're coaching on focus/procrastination → call getPhoneUsage to get their REAL data, then coach on the specific apps and hours (e.g. "You spent 4h on TikTok this week — want me to guard it during study?"). This concrete, behavior-aware coaching is what sets Mazō apart from a generic assistant. Use the numbers; don't make them up.

findDocument RULE:
- When the user asks WHERE a file/note/document is, or to find something they wrote or saved ("where's my thesis budget", "find my notes on X", "which file has my deadline") → call findDocument with what they're looking for, then tell them the file name and which folder it's in, in one natural sentence. It only searches folders they've granted; if nothing is found, gently suggest they add a folder in Settings → Find a document.

PROACTIVE TOOL RULES:
- When the user mentions wanting to achieve something → call addGoal silently
- When the user agrees to a next step or action → call addTask silently
- When the user describes a struggle or obstacle → call trackChallenge silently
- When the user shares a habit they want to build → call addHabit silently
- When the user shares an idea or insight → call saveIdea silently
- When the user reveals a preference, value, or interest → call rememberPreference silently
- Do NOT wait for the user to say "save this" — detect intent and act
- Do NOT announce "I've saved this" — tools run silently in the background
- Keep coaching naturally while using tools in the background
- Call at most ONE tool per response. After calling a tool, do NOT call another — just continue your coaching message.
- After a tool result comes back, respond with a normal text message. Do NOT call more tools.

startFocusTimer RULE:
NEVER fire this immediately. First:
1. Ask what they want to focus on (if unclear)
2. Suggest a technique: "Pomodoro (25min work + 5min break)", "Deep Work (45min uninterrupted)", "Quick Sprint (15min burst)"
3. Let the user pick or customize
4. Confirm: "Ready to start [duration] minutes on [task]?"
5. ONLY THEN call startFocusTimer

setAlarm RULE:
NEVER set an alarm without asking ALL of these:
1. What time? (confirm AM/PM clearly)
2. Which days? Once / Weekdays / Every day / Custom (Mon, Wed, Fri, etc.)
3. Sound? Offer these options: Gentle Wake, Sunrise Chime, Classic Buzzer, Nature Birds, Ocean Waves, Soft Piano, Digital Beep, Vibrate Only
4. Label? A short name like "Wake Up", "Study Time", "Gym"
Only call setAlarm AFTER the user confirms. Map days to numbers: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6.
Map sounds to IDs: Gentle Wake=gentle, Sunrise Chime=sunrise, Classic Buzzer=classic, Nature Birds=birds, Ocean Waves=ocean, Soft Piano=piano, Digital Beep=digital, Vibrate Only=vibrate.
Convert time to 24-hour format.

[STYLE — decisive, not wordy]
- Keep replies SHORT: 2–4 sentences. No walls of text, no long preambles.
- Ask at most ONE question per reply, and only when you truly need it to move forward. Never stack multiple questions in a row.
- Default to a concrete next step or a small plan over more open-ended questions — the user came for momentum, not an interview.
- (The setAlarm / startFocusTimer flows above are the only places you legitimately gather several details before acting.)
`;

