export interface Coach {
  id: string;
  name: string;
  role: string;
  tone: string;
  description: string;
  systemPrompt: string;
  isProOnly: boolean;
}

export interface CustomCoach {
  id: string;
  name: string;
  role: string;
  description: string;
  tone: 'calm' | 'direct' | 'warm' | 'wise' | 'reflective';
  specialty: string;
  systemPrompt: string;
  icon: string;
  color: string;
  isCustom: true;
  createdAt: number;
  updatedAt: number;
  mazoConfig?: MazoConfig;
}

export interface CoachTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  tone: 'calm' | 'direct' | 'warm' | 'wise' | 'reflective';
  specialty: string;
  icon: string;
  color: string;
  systemPromptTemplate: string;
  isProOnly: boolean;
}

export interface UserContext {
  name?: string;
  age?: string;
  values: string;
  beliefs: string;           // Core beliefs and principles
  currentProjects: string;   // Active projects/goals they're working on
  currentFocus: string;
  constraints: string;
  workStyle: 'morning' | 'evening' | 'flexible' | '';  // When they work best
  energyLevel: 'high' | 'medium' | 'low' | '';         // Current energy state
  lastUpdated: number;
  customCoach?: CustomCoach;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isVoice?: boolean;
  parts?: Array<{
    type: 'text' | 'tool' | 'tool-invocation' | 'tool-result';
    text?: string;
    toolName?: string;
    state?: string;
    output?: any;
  }>;
}

// Session phases for structured coaching flow
export type SessionPhase = 'opening' | 'exploration' | 'action' | 'exit' | 'freeform';

export interface Session {
  coachId: string;
  messages: Message[];
  lastMessageAt: number;
  currentPhase: SessionPhase;           // Current coaching phase
  phaseHistory: SessionPhase[];         // Track phase transitions
  phaseStartedAt: number;               // When current phase started
  actionIdentified: boolean;            // Whether action block was provided
  sessionStartTime: number;             // When session started (for timeout)
  lastActionBlockAt: number | null;     // When last action was given
  sessionLocked: boolean;               // Whether chat is locked until task completion
  pendingActionTaskId: string | null;   // ID of task that must be completed to unlock
}

export interface SubscriptionState {
  isPro: boolean;
  entitlements: string[];
  lastCheckedAt: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'short-term' | 'long-term';
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'paused';
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  goalId?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: number;
  estimatedMinutes?: number;
  createdAt: number;
}

export interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  createdAt: number;
}

export interface Idea {
  id: string;
  content: string;
  category?: string;
  createdAt: number;
}

export interface Problem {
  id: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  status: 'open' | 'resolved';
  createdAt: number;
}

export interface Constraint {
  id: string;
  type: 'time' | 'energy' | 'deadline' | 'other';
  description: string;
  createdAt: number;
}

export interface Preference {
  id: string;
  key: string;
  value: string;
  category?: 'like' | 'dislike' | 'value' | 'habit' | 'interest' | 'other';
  createdAt: number;
}

export type DetectedIntent =
  | 'scheduling'
  | 'goal_setting'
  | 'reflection'
  | 'preference_sharing'
  | 'problem_solving'
  | 'planning'
  | 'focus_timer'
  | 'general';

export interface IntentAction {
  id: string;
  type: DetectedIntent;
  label: string;
  description: string;
  isReady: boolean;
  data?: Record<string, unknown>;
}

export interface SchedulingData {
  availableTime?: string;
  preferredDays?: string[];
  constraints?: string[];
  activities?: string[];
  isComplete: boolean;
  generatedSchedule?: GeneratedSchedule;
}

export interface GeneratedSchedule {
  id: string;
  title: string;
  timeBlocks: TimeBlock[];
  notes: string;
  generatedAt: number;
}

export interface ScheduleItem {
  id: string;
  title: string;
  description?: string;
  category: 'morning' | 'afternoon' | 'evening' | 'anytime';
  icon?: string;
  isCompleted: boolean;
  completedAt?: number;
  dayIndex: number;
  order: number;
  createdAt: number;
}

export interface TimeBlock {
  id: string;
  startTime: string;
  endTime: string;
  activity: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DailyPlan {
  date: string;
  focus: string;
  tasks: Task[];
  insights: string[];
  generatedAt: number;
}

export interface WeeklyDirection {
  weekStart: string;
  mainGoals: string[];
  priorities: string[];
  insights: string[];
  generatedAt: number;
}

export type AlarmSoundId = 'gentle' | 'sunrise' | 'classic' | 'birds' | 'ocean' | 'piano' | 'digital' | 'vibrate';

export interface Alarm {
  id: string;
  label: string;
  hour: number;        // 0-23
  minute: number;      // 0-59
  days: number[];      // 0=Sun..6=Sat, empty = one-time
  soundId: AlarmSoundId;
  enabled: boolean;
  notificationId: string | null;
  notificationIds?: string[];   // All scheduled IDs (for recurring alarms)
  createdAt: number;
}

export interface ArchivedChat {
  id: string;
  coachId: string;
  coachName: string;
  lastMessage: string;
  messageCount: number;
  taskIds: string[];         // IDs of tasks assigned during this session
  taskTitles: string[];      // Titles for display
  status: 'open' | 'locked' | 'completed'; // open = still chatting, locked = task pending, completed = task done
  archivedAt: number;
  sessionStartTime: number;
  messages?: Message[];       // Stored messages for viewing archived chats
}

export interface Memory {
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  ideas: Idea[];
  problems: Problem[];
  constraints: Constraint[];
  preferences: Preference[];
  focusSessions: FocusSession[];
  alarms: Alarm[];
  dailyPlan?: DailyPlan;
  weeklyDirection?: WeeklyDirection;
  schedules: GeneratedSchedule[];
  scheduleItems: ScheduleItem[];
  currentDayIndex: number;
  lastExtractedAt: number;
  mindInsights?: MindInsight[];
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface AIQuestion {
  id: string;
  question: string;
  description: string;
  options: QuestionOption[];
  category: 'preferences' | 'goals' | 'lifestyle' | 'personality' | 'general';
}

export interface QuestionsSession {
  questions: AIQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  isActive: boolean;
}

export interface AppState {
  selectedCoachId: string | null;
  userContext: UserContext;
  sessions: Record<string, Session>;
  memory: Memory;
  freeMessagesUsed: number;
  freeSessionsToday: number;
  lastSessionDate: string;
  onboardingComplete: boolean;
  preferredTone: 'direct' | 'supportive' | 'balanced';
  detectedIntents: IntentAction[];
  schedulingData: SchedulingData;
  pendingSchedule: GeneratedSchedule | null;
  questionsSession: QuestionsSession | null;
  showQuestionsPrompt: boolean;
  hasSeenSystemReady: boolean;
  showSystemReadyScreen: boolean;
  customCoaches: CustomCoach[];
  showCelebration: boolean;
  celebrationTaskTitle: string | null;
  communityCoaches: import('@/constants/community-coaches').CommunityCoach[];
  coachRatings: Record<string, number>;
  // Trial
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
  // Streak
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
    totalSessions: number;
  };
  // Referral
  referralCode: string | null;
  // Smart paywall trigger tracking
  smartPaywallTriggers: Record<string, boolean>;
  // Retention: session heatmap
  sessionDates: string[];
  // Growth: pending share moment
  pendingShareMoment: {
    type: 'streak' | 'breakthrough' | 'goal';
    title: string;
    subtitle: string;
    data?: Record<string, any>;
  } | null;
  // Chat history
  chatHistory: ArchivedChat[];
  // Device-unique user ID (persists across reinstalls via Supabase)
  deviceUserId?: string;
  // Auth fields
  authUserId?: string;
  authEmail?: string;
  authDisplayName?: string;
  isAccountLinked?: boolean;
}

export type AIActionType =
  | 'add_schedule_item'
  | 'add_goal'
  | 'add_task'
  | 'complete_task'
  | 'add_preference'
  | 'add_habit'
  | 'add_idea'
  | 'add_problem';

export interface AIActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export type FocusTechnique = 'pomodoro' | 'deep_work' | 'sprint' | 'custom';

export interface FocusSession {
  id: string;
  taskName: string;
  technique: FocusTechnique;
  durationMinutes: number;
  completedAt: number;
  rating: 'great' | 'okay' | 'hard' | null;
  completed: boolean;
}

export type MazoEyeStyle = 'neutral' | 'focused' | 'soft' | 'closed';
export type MazoMouthStyle = 'neutral' | 'slight_smile' | 'calm' | 'thinking' | 'strong';
export type MazoAccessory = 'none' | 'cap' | 'visor' | 'glasses';
export type MazoState = 'idle' | 'listening' | 'thinking' | 'responding' | 'memory_save' | 'plan_ready' | 'happy' | 'empathetic' | 'encouraging' | 'celebrating';

export interface MazoConfig {
  eyeStyle: MazoEyeStyle;
  mouthStyle: MazoMouthStyle;
  accessory: MazoAccessory;
  accentColor?: string;
}

export interface MazoUserPreferences {
  eyeStyle?: MazoEyeStyle;
  accessoryEnabled?: boolean;
}

// ── The Mind: what Mazo learns about the person (Pillar 1) ──
export type MindInsightFace = 'identity' | 'ambition' | 'obstacle' | 'workstyle';
export type MindInsightStatus = 'proposed' | 'confirmed' | 'corrected' | 'dismissed';

export interface MindInsight {
  id: string;
  text: string;                 // perceptive 2nd-person observation
  face: MindInsightFace;
  status: MindInsightStatus;
  confidence: number;           // 0..1
  sourceSessionId?: string;
  learnedAt: number;
  confirmedAt?: number;
  timesUsed: number;
}

export type BondStage = 'stranger' | 'getting_to_know' | 'knows_you_well' | 'gets_you';

// ── The Agent: Mazō turns intent into real phone actions (Pillar 2) ──
// One kind-tagged action shape. Every action carries display fields
// (`title`/`detail`) plus only the execution payload its kind needs.
export type MazoActionKind =
  | 'alarm'        // set a real alarm
  | 'calendar'     // create a calendar event / focus block
  | 'reminder'     // schedule a reminder notification
  | 'open_app'     // launch another app
  | 'message'      // compose a text / WhatsApp message
  | 'call'         // place a call
  | 'navigate'     // open Maps directions
  | 'open_link'    // open a website or web search
  | 'guard'        // block distracting apps for a stretch (Focus Guardian)
  | 'focus_preview' // scripted iOS visual preview; never controls other apps
  | 'save_note';   // save an idea/note into the Mind

export interface MazoAction {
  id: string;
  kind: MazoActionKind;
  title: string;                 // headline, e.g. "Focus alarm · 6:30 AM"
  detail?: string;               // subline, e.g. "Weekdays · gentle"

  // timing (alarm / calendar / reminder)
  hour?: number;                 // 0-23
  minute?: number;               // 0-59
  days?: number[];               // alarm recurrence: 0=Sun..6=Sat, empty = one-time
  startISO?: string;             // calendar start
  endISO?: string;               // calendar end
  dueISO?: string;               // reminder due time

  // device actions
  app?: string;                  // open_app: canonical app key ("whatsapp", "spotify"…)
  to?: string;                   // message: recipient (name or number)
  body?: string;                 // message body
  via?: 'sms' | 'whatsapp';      // message channel
  number?: string;               // call: phone number
  destination?: string;          // navigate: place/address
  url?: string;                  // open_link: explicit URL
  query?: string;                // open_link: web search query
  note?: string;                 // save_note: the note text
  category?: string;             // save_note: optional category

  // guard (Focus Guardian)
  apps?: string[];               // guard: app names to block (e.g. ["Instagram","TikTok"])
  durationMinutes?: number;      // guard: how long to block, in minutes
}

export interface ActionPlan {
  understood: string;            // Mazō's restatement of the request
  why?: string;                  // warm one-line reason, often Mind-derived
  actions: MazoAction[];
  sourceInsightId?: string;
}

export interface ActionReceipt {
  id: string;                    // matches the MazoAction id
  title: string;
  kind: MazoActionKind;
  success: boolean;
  message: string;               // human-readable outcome
}
