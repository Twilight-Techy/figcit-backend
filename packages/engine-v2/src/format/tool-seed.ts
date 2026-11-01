/**
 * The tools of each pathway, as Tab 6d section A names them in its prose cells (DECISION_LOG E-49).
 * The workbook gives no codes, so each tool gets one here; where v1 had a code for the same tool
 * it is kept, so records and the v1 adapter line up. The tier (free, advanced, safety floor) is
 * not a property of the tool here: it is the Tab 6d rows' rule (ENT), applied by the engine.
 * Rows: [code, label as Tab 6d writes it, pathway code].
 */
export const TOOL_SEED: readonly (readonly [string, string, string])[] = [
  // Regulate: free, then advanced.
  ['breathe', 'Breathe (core paced patterns, 1–5 min)', 'regulate'],
  ['ground', 'Ground (5-4-3-2-1, feet on floor, cold-water cue)', 'regulate'],
  ['move', 'Move (shake-out, stretch, short walk prompt)', 'regulate'],
  ['sounds', 'Sounds (core set: brown/white noise, rain, quiet timer)', 'regulate'],
  ['step_out', 'Step out', 'regulate'],
  ['rest', 'Recovery/rest timer', 'regulate'],
  ['sounds_plus', 'Advanced Sounds', 'regulate'],
  ['movement_plus', 'Advanced Movement', 'regulate'],
  ['create', 'Create (drawing, colouring, rhythm and music-making, fidget canvas)', 'regulate'],
  ['attention_games', 'Attention reset games', 'regulate'],
  ['sleep_winddown', 'Sleep wind-down programmes', 'regulate'],
  ['regulation_toolkit', 'Personal regulation toolkit', 'regulate'],
  // Express.
  ['simplify_rewrite', 'Simplify and Rewrite', 'express'],
  ['comm_cards', 'Communication cards', 'express'],
  ['help_templates', 'Ready templates for asking for help or a pause', 'express'],
  ['draft', 'Draft from scratch', 'express'],
  ['structure', 'Structure long documents and emails', 'express'],
  ['scripts', 'Scripts for meetings, calls and presentations', 'express'],
  ['tone_check', "Tone check ('how might this land?')", 'express'],
  ['simplify_resource', 'Simplify a resource', 'express'],
  ['voice_message', 'Voice-to-structured message', 'express'],
  ['send_later', 'Send-later scheduling', 'express'],
  // Execute.
  ['task_list', "Task list with 'why now'", 'execute'],
  ['smallest_step', 'Smallest next step', 'execute'],
  ['breakdown', 'Basic breakdown (up to the timeline cap)', 'execute'],
  ['pick_one', 'Pick-one-of-three', 'execute'],
  ['focus_timer', 'Simple focus timer', 'execute'],
  ['full_breakdown', 'Full breakdown with editing and re-planning', 'execute'],
  ['ai_body_double', 'AI body double', 'execute'],
  ['body_double_rooms', 'Human body-double rooms', 'execute'],
  ['routine_builder', 'Recurring routine builder', 'execute'],
  ['calendar_sync', 'Calendar sync', 'execute'],
  ['overdue_repair', 'Overdue repair assistant', 'execute'],
  // Dump.
  ['dump_text', 'Unlimited text capture', 'dump'],
  ['dump_voice', 'Voice capture', 'dump'],
  ['dump_sort', 'Manual sorting into Ideas, Notes, Worries, To-do', 'dump'],
  ['dump_to_task', 'Move an item to a task by hand', 'dump'],
  ['ai_sort', 'AI sorting suggestions', 'dump'],
  ['photo_capture', 'Photo and document capture with text recognition', 'dump'],
  ['dump_search', 'Search across all dumps', 'dump'],
  ['long_voice', 'Longer voice notes with transcription', 'dump'],
  ['one_tap_convert', 'One-tap convert to task, draft or reflection', 'dump'],
  // Adapt.
  ['adaptation_library', 'Adaptation library', 'adapt'],
  ['stop_points', 'Stop points', 'adapt'],
  ['rerun', 'One-tap re-run of the recommendation', 'adapt'],
  ['adjustment_passport', 'Personal Adjustment Passport', 'adapt'],
  ['adjustment_templates', 'Reasonable-adjustment request templates', 'adapt'],
  ['transition_planner', 'Transition planner using saved rituals', 'adapt'],
  ['context_plans', 'Context plans (workplace, exams, travel, events)', 'adapt'],
  // Reflect.
  ['reflect_checkout', '3-prompt check-out', 'reflect'],
  ['gratitude_note', 'Gratitude note', 'reflect'],
  ['end_of_day', 'End-of-day close', 'reflect'],
  ['my_patterns', 'Save takeaways to My Patterns', 'reflect'],
  ['what_helped', 'What helped insights', 'reflect'],
  ['pattern_review', 'Pattern review with plain-language trend cards', 'reflect'],
  ['self_advocacy', 'Self-advocacy prep', 'reflect'],
  ['monthly_summary', 'Monthly reflection summary', 'reflect'],
  ['reflect_export', 'Export reflections into a report', 'reflect'],
  // Connect.
  ['trusted_contact', 'Trusted contacts', 'connect'],
  ['quick_message', 'One-tap pre-written messages', 'connect'],
  ['async_message', 'Async messaging via the device', 'connect'],
  ['groups', 'Groups the user has listed', 'connect'],
  ['peer_spaces', 'Moderated peer community spaces', 'connect'],
  ['checkin_buddy', 'Scheduled check-in buddy', 'connect'],
  ['hosted_sessions', 'Hosted group sessions', 'connect'],
  // Meditate · Rituals · Prayer.
  ['stillness', 'Stillness timer', 'meditate'],
  ['settle_3', 'Guided settle (3 min)', 'meditate'],
  ['settle_5', 'Guided settle (5 min)', 'meditate'],
  ['gratitude_practice', 'Gratitude practice', 'meditate'],
  [
    'own_practice',
    "The user's own rituals, prayers, recitations, schedules and reminders",
    'meditate',
  ],
  ['in_worship', "'In worship' mode", 'meditate'],
  ['settle_10', 'Guided settle (10 min)', 'meditate'],
  ['settle_20', 'Guided settle (20 min)', 'meditate'],
  ['walking_practice', 'Walking practice', 'meditate'],
  ['body_scan', 'Body-scan series', 'meditate'],
  ['ritual_builder', 'Multi-step ritual builder', 'meditate'],
  ['recitation_player', 'Recitation player', 'meditate'],
  ['programmes', 'Themed programmes (exam season, transitions, sleep)', 'meditate'],
  ['practice_insights', 'Practice insights', 'meditate'],
];

/** What may be available right now (Figma S10; Tabs 3a, 3b and 6c read headphones). */
export const SUPPORT_SEED: readonly (readonly [string, string])[] = [
  ['just_me', 'Just me'],
  ['can_call', 'Can call someone'],
  ['someone_with_me', 'Someone with me'],
  ['headphones', 'Headphones / headset'],
];
