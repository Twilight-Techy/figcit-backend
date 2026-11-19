// Persona seed: accounts that exercise every screen and state of the app (docs/build/SEED.md).
import { DumpService } from '../../../src/modules/dump/dump.service.js';
import { ExpressService } from '../../../src/modules/express/express.service.js';
import { RemindersService } from '../../../src/modules/notifications/reminders.service.js';
import { PracticesService } from '../../../src/modules/practices/practices.service.js';
import { PrivacyService } from '../../../src/modules/privacy/privacy.service.js';
import { ReflectService } from '../../../src/modules/reflect/reflect.service.js';
import { SupportService } from '../../../src/modules/safety/support.service.js';
import { SharesService } from '../../../src/modules/shares/shares.service.js';
import { TasksService } from '../../../src/modules/tasks/tasks.service.js';
import { DUMP_TEXT, HARD_DAY, OK_DAY, pick, rng, TASKS, type CheckInKey } from './data.js';
import { DAY, type Seeder } from './seeder.js';

export const DOMAIN = 'nuccess.test';
const email = (name: string): string => `${name}@${DOMAIN}`;
const at = (daysAgo: number, hour: number, minute = 0): Date => {
  const d = new Date(Date.now() - daysAgo * DAY);
  d.setUTCHours(hour, minute, 0, 0);
  // "Today at 18:00" before 18:00 would be in the future: keep today's order, but in the past.
  const latest = Date.now() - 60_000;
  return d.getTime() <= latest ? d : new Date(latest - (24 * 60 - hour * 60 - minute) * 10_000);
};

/** A few weeks of check-ins with sessions and feedback; harder days follow `hardEvery`. */
async function history(
  s: Seeder,
  userId: string,
  o: { days: number; seed: number; hardEvery: number },
): Promise<void> {
  const { days, seed, hardEvery } = o;
  const r = rng(seed);
  for (let d = days; d >= 1; d -= 1) {
    if (r() < 0.2) continue; // not every day: no streaks
    const hard = d % hardEvery === 0 || r() < 0.15;
    const key: CheckInKey = pick(r, hard ? HARD_DAY : OK_DAY);
    const when = at(d, 8 + Math.floor(r() * 12), Math.floor(r() * 60));
    const c = await s.checkIn(userId, key, when);
    if (r() < 0.75) {
      const primary = c.tool;
      if (primary) {
        const outcome = pick(r, ['helped', 'helped', 'a_bit', 'not_really'] as const);
        await s.session(userId, {
          recId: c.recId ?? undefined,
          pathway: primary.pathway,
          toolId: primary.toolId,
          at: new Date(when.getTime() + 5 * 60_000),
          minutes: 2 + Math.floor(r() * 8),
          outcome,
          ...(c.taskId && primary.pathway === 'execute' ? { taskId: c.taskId } : {}),
        });
        // After a hard moment that helped, a re-check (often Blue, RC-1).
        if (hard && outcome === 'helped' && r() < 0.6)
          await s.checkIn(userId, 'yellow', new Date(when.getTime() + 20 * 60_000), {
            entry: 'recheck',
            recheckOfId: c.checkInId,
            emotions: [{ code: 'tired', intensity: 3 }],
          });
      }
    }
  }
}

async function richWorkLife(s: Seeder, userId: string): Promise<void> {
  const tasks = s.get(TasksService);
  for (const [i, t] of TASKS.entries()) {
    const task = await tasks.create(userId, {
      title: t.title,
      kind: t.kind,
      timeline: t.timeline,
      drivers: [...t.drivers],
      steps: [],
      source: 'manual',
      puttingOff: i === 2,
    });
    if (i === 2) await tasks.breakDown(userId, task.id, { save: true, replace: true });
    if (i === 0) await tasks.update(userId, task.id, { status: 'done' });
    await s.backdate('task', task.id, at(10 - i, 9));
  }
  await tasks.create(userId, {
    title: 'Bins out',
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=19;BYMINUTE=0',
    drivers: ['routine'],
    steps: [],
    source: 'manual',
    puttingOff: false,
  });
  const dumps = s.get(DumpService);
  const dump = await dumps.create(userId, { text: DUMP_TEXT, source: 'text', origin: 'online' });
  const buckets = ['todo', 'worries', 'ideas', 'notes', 'todo', 'todo'] as const;
  for (const [i, item] of dump.items.entries())
    await dumps.updateItem(userId, item.id, { bucket: buckets[i] ?? 'notes' });
  const first = dump.items[0];
  if (first) await dumps.toTask(userId, first.id, {});
  await s.backdate('dump', dump.id, at(3, 21));
  await dumps.create(userId, {
    text: 'Too many tabs open\nNeed a proper lunch break',
    source: 'text',
    origin: 'online',
  });

  const express = s.get(ExpressService);
  const draft = await express.create(userId, {
    body: "I'm so sorry to bother you, I was just wondering if I could possibly have a few extra days for the report?",
    purpose: 'my manager',
    audience: 'manager',
    mode: 'draft',
  });
  await express.assist(userId, draft.id, { mode: 'simplify', level: 'gentle' });
  await express.create(userId, {
    title: 'Reply to the landlord',
    body: 'The boiler is still not working. Can someone come this week?',
    audience: 'other',
    mode: 'draft',
  });
}

async function innerLife(s: Seeder, userId: string): Promise<void> {
  const reflect = s.get(ReflectService);
  const base = [
    { promptId: 'what_happened', chips: ['A meeting'] },
    {
      promptId: 'what_helped',
      chips: ['Writing it down'],
      text: 'Drafting before the call helped',
    },
    { promptId: 'take_forward', chips: ['Ask earlier'] },
  ];
  for (let i = 0; i < 4; i += 1) {
    const r = await reflect.create(userId, {
      variant: 'make_sense',
      answers: base,
      takeaway: i % 2 ? 'Ask for slides early' : 'Smaller steps made Friday okay',
      topicTag: i < 2 ? 'team_meeting' : 'deadlines',
      saved: true,
      savedForLater: false,
      origin: 'online',
    });
    await s.backdate('reflection', r.id, at(12 - i * 3, 20));
  }
  await reflect.create(userId, {
    variant: 'win',
    answers: [{ promptId: 'win', chips: [], text: "Sent the email I'd been avoiding" }],
    winSize: 'huge',
    saved: true,
    savedForLater: false,
    origin: 'online',
  });
  await reflect.create(userId, {
    variant: 'journal',
    answers: [{ promptId: 'entry', chips: [], text: 'Quiet day. Needed it.' }],
    saved: true,
    savedForLater: false,
    origin: 'online',
  });
  await reflect.create(userId, {
    variant: 'make_sense',
    answers: [],
    saved: false,
    savedForLater: true,
    origin: 'online',
  });
}

async function practicesAndSupport(s: Seeder, userId: string): Promise<void> {
  const practices = s.get(PracticesService);
  const prayer = await practices.create(userId, {
    type: 'prayer',
    name: 'Midday prayer',
    scheduleRule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=12;BYMINUTE=45',
    minutes: 10,
    helpsWhenStruggling: true,
    reminderStyle: 'gentle',
    makesMeWorse: false,
    isTransitionRitual: false,
  });
  await practices.create(userId, {
    type: 'ritual',
    name: 'Tea and window',
    content: 'Make tea. Look outside for five minutes.',
    minutes: 5,
    isTransitionRitual: true,
    helpsWhenStruggling: false,
    makesMeWorse: false,
    reminderStyle: 'silent',
  });
  await s.session(userId, {
    pathway: 'meditate',
    toolId: 'own_practice',
    practiceId: prayer.id,
    at: at(2, 12, 45),
    minutes: 10,
    outcome: 'helped',
  });

  const support = s.get(SupportService);
  await support.addContact(userId, {
    name: 'Ope Adeyemi',
    phone: '+44 7700 900123',
    relationship: 'friend',
    contactWhen: ['connect', 'sos'],
    consentConfirmed: true,
  });
  await support.addContact(userId, {
    name: 'Kemi (sister)',
    email: 'kemi@example.test',
    relationship: 'family',
    contactWhen: ['connect'],
    consentConfirmed: true,
  });
  await support.savePlan(userId, {
    preferredRoutes: ['samaritans', 'shout'],
    signs: 'I stop replying to messages and stay in bed.',
    whatHelps: 'Dim lights, a weighted blanket, someone sitting nearby.',
    whatToAvoid: 'Being asked lots of questions at once.',
    messages: ['Rough day, could you text me later?'],
  });

  const reminders = s.get(RemindersService);
  await reminders.create(userId, {
    subjectType: 'checkin',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=30',
    style: 'gentle',
  });
  await reminders.create(userId, {
    subjectType: 'practice',
    subjectId: prayer.id,
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=12;BYMINUTE=30',
    style: 'silent',
  });
  await s.get(SharesService).create(userId, {
    sections: ['lights', 'did_it_help', 'notes'],
    recipientLabel: 'Dr. M. (therapist)',
    rangeDays: 30,
    expiresInDays: 14,
  });
}

export async function seedPersonas(s: Seeder): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  // Ada: Plus, two months of varied use. Every screen has something in it.
  ids['ada'] = await s.user(email('ada'), {
    nickname: 'Ada',
    consents: ['wellbeing_data', 'personalisation', 'analytics'],
    createdDaysAgo: 70,
  });
  await s.prisma.entitlement.create({
    data: {
      userId: ids['ada'],
      planCode: 'prime_monthly',
      source: 'web',
      status: 'active',
      renewsAt: new Date(Date.now() + 18 * DAY),
    },
  });
  await history(s, ids['ada'], { days: 45, seed: 1, hardEvery: 4 });
  await richWorkLife(s, ids['ada']);
  await innerLife(s, ids['ada']);
  await practicesAndSupport(s, ids['ada']);

  // Ben: Free and new. Two check-ins, nothing else: empty states.
  ids['ben'] = await s.user(email('ben'), { nickname: 'Ben', createdDaysAgo: 2 });
  await s.checkIn(ids['ben'], 'green', at(1, 10));
  await s.checkIn(ids['ben'], 'notSure', at(0, 8));

  // Chi: Free, a hard fortnight in Lagos. Red most days (SF-2), a safety phrase, support plan.
  ids['chi'] = await s.user(email('chi'), {
    nickname: 'Chi',
    timezone: 'Africa/Lagos',
    region: 'GB',
    createdDaysAgo: 30,
  });
  for (let d = 15; d >= 1; d -= 1) await s.checkIn(ids['chi'], d % 4 ? 'red' : 'amber', at(d, 21));
  await s.checkIn(ids['chi'], 'red', at(0, 7), {
    ownWords: 'I feel like I want to disappear and end it',
  });
  await s.get(SupportService).addContact(ids['chi'], {
    name: 'Tolu',
    phone: '+234 802 000 0000',
    relationship: 'family',
    contactWhen: ['sos'],
    consentConfirmed: true,
  });

  return { ...ids, ...(await seedOthers(s)) };
}

async function seedOthers(s: Seeder): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  // Hana: comfort settings at their strongest; meditation makes things worse; prompts off.
  ids['hana'] = await s.user(email('hana'), {
    nickname: 'Hana',
    preferences: {
      textSize: 3,
      theme: 'midnight_bergamot',
      reduceMotion: true,
      dyslexicFont: true,
      lowStimulation: true,
      highContrast: true,
      sound: false,
      haptics: false,
      patternPrompts: false,
      personalisation: false,
      quietHoursStart: 20 * 60,
      quietHoursEnd: 9 * 60,
      notificationStyle: 'silent',
    },
  });
  await s.get(PracticesService).create(ids['hana'], {
    type: 'meditation',
    name: 'Body scan (not for me)',
    makesMeWorse: true,
    helpsWhenStruggling: false,
    isTransitionRitual: false,
    reminderStyle: 'none',
  });
  await history(s, ids['hana'], { days: 14, seed: 7, hardEvery: 3 });

  // Fin: Premium yearly, cancelled, ends in 10 days. Gus: asked to delete, in the grace period.
  ids['fin'] = await s.user(email('fin'), { nickname: 'Fin' });
  await s.prisma.entitlement.create({
    data: {
      userId: ids['fin'],
      planCode: 'premium_yearly',
      source: 'web',
      status: 'active',
      endsAt: new Date(Date.now() + 10 * DAY),
    },
  });
  await history(s, ids['fin'], { days: 10, seed: 3, hardEvery: 5 });
  ids['gus'] = await s.user(email('gus'), { nickname: 'Gus' });
  await s.checkIn(ids['gus'], 'yellow', at(3, 11));
  await s.get(PrivacyService).requestDeletion(ids['gus']);

  // Staff (two-step sign-in with the shared demo authenticator secret).
  ids['admin'] = await s.user(email('admin'), { nickname: 'Asha (admin)', roles: ['admin'] });
  ids['safety'] = await s.user(email('safety'), {
    nickname: 'Sam (safety)',
    roles: ['safety_reviewer'],
  });
  ids['editor'] = await s.user(email('editor'), {
    nickname: 'Eli (content)',
    roles: ['content_editor'],
  });
  ids['supporter'] = await s.user(email('supporter'), {
    nickname: 'Ina (institutions)',
    roles: ['institution_supporter'],
  });
  return ids;
}
