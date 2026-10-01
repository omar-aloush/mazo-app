export interface FocusCheckIn {
  stage: 'reflection' | 'topic';
  task: string;
  completed: boolean;
  nextBlockMinutes: number;
  cue: 'restart' | 'distraction' | 'smaller' | 'break' | 'progress';
}

export interface FocusCheckInReply {
  message: string;
  checkIn: FocusCheckIn | null;
  nextStep?: { task: string; nextStep: string; durationMinutes: number };
}

/** A device-local reflection flow; it never repeats an approved phone action. */
export function startFocusCheckIn(
  task: string,
  completed: boolean,
  rating?: 'great' | 'okay' | 'hard',
): FocusCheckInReply {
  return {
    message: completed
      ? rating === 'hard'
        ? 'You finished the block, even though it felt hard. What made it difficult: distraction, the task felt too big, or you need a break?'
        : 'You finished your focus block. What changed: did you make progress, get stuck, or need a break?'
      : 'You paused your focus block. Let’s make the next move easier. What got in the way: distraction, the task felt too big, or you needed a break?',
    checkIn: {
      stage: 'reflection', task, completed,
      nextBlockMinutes: completed && rating !== 'hard' ? 10 : 5,
      cue: completed ? 'progress' : 'restart',
    },
  };
}

export function focusCheckInOptions(checkIn: FocusCheckIn): string[] {
  if (checkIn.stage === 'reflection') {
    return checkIn.completed
      ? ['I made progress', 'I got stuck', 'I need a break']
      : ['I got distracted', 'It felt too big', 'I need a break', 'I made progress'];
  }
  if (/math|mathematics|algebra|geometry|calculus/i.test(checkIn.task)) {
    return ['Algebra', 'Geometry', 'Calculus'];
  }
  if (/exam|study|revision/i.test(checkIn.task)) {
    return ['One practice question', 'My hardest topic', 'Review my notes'];
  }
  return ['The first small task', 'The part I got stuck on'];
}

export function advanceFocusCheckIn(checkIn: FocusCheckIn, answer: string): FocusCheckInReply {
  const text = answer.trim();
  if (checkIn.stage === 'reflection') {
    let cue = checkIn.cue;
    let nextBlockMinutes = checkIn.nextBlockMinutes;
    let response = 'Let’s use that to choose a smaller, clearer next move.';
    if (/break|tired|rest|exhaust|pause/i.test(text)) {
      cue = 'break';
      nextBlockMinutes = 5;
      response = 'A short break is okay. Before you step away, let’s choose one small thing to return to.';
    } else if (/distract|phone|instagram|tiktok|youtube|scroll/i.test(text)) {
      cue = 'distraction';
      nextBlockMinutes = 5;
      response = 'Thanks for noticing it. Put your phone out of reach and make the restart just five minutes.';
    } else if (/big|hard|stuck|overwhelm|confus|difficult|understand/i.test(text)) {
      cue = 'smaller';
      nextBlockMinutes = 5;
      response = 'Then we’ll shrink the task. One question is enough for a five-minute restart.';
    } else if (/progress|finished|solved|learned|better|got it|good|great/i.test(text)) {
      cue = 'progress';
      nextBlockMinutes = 10;
      response = 'Good—let’s build on what moved forward with one focused ten-minute step.';
    }
    return {
      message: `${response}\n\nWhich topic or small task do you want to work on next?`,
      checkIn: { ...checkIn, stage: 'topic', cue, nextBlockMinutes },
    };
  }

  if (/^(?:i (?:don'?t|do not) know|not sure|anything|whatever)[.!?]*$/i.test(text)) {
    return {
      message: 'Let’s start with one question you got stuck on, or the first small part of your task. Pick an option below or name it in your own words.',
      checkIn,
    };
  }

  const topic = text
    .replace(/^(?:i (?:want|need|would like) to (?:study|practice|work on|review)|(?:study|practice|work on|review))\s+/i, '')
    .replace(/[.!?]+$/, '')
    .slice(0, 100)
    .trim() || 'one small part of my task';
  const minutes = checkIn.nextBlockMinutes;
  const isStudy = /exam|study|studying|revision|math|biology|chemistry|physics/i.test(checkIn.task);
  const prefix = checkIn.cue === 'distraction' ? 'Put your phone out of reach. ' : '';
  const nextStep = isStudy
    ? `${prefix}Spend ${minutes} minutes on ${topic}: try one question from memory, check your answer, and note one gap.`
    : `${prefix}Spend ${minutes} minutes on ${topic}. Finish one small part, then write down what to do next.`;
  return {
    message: `Here’s your next step:\n\n**${nextStep}**\n\n${checkIn.cue === 'break'
      ? 'Take your break, then return to this step. Save it to Journey below so it’s waiting for you.'
      : `Start the ${minutes}-minute block below, or save the step to Journey and come back when you’re ready.`}`,
    checkIn: null,
    nextStep: { task: `Work on ${topic}`, nextStep, durationMinutes: minutes },
  };
}
