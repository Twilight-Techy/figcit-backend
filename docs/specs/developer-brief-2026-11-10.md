
# FigCit App — Developer Brief
2026-11-10 · Ganiyat Olatorera Kareem
## Purpose and scope
This brief tells the development team what to change in the FigCit web app (figcit.vercel.app) after the founder's 39-minute test run on 10 November 2026. It covers bugs, accounts, check-in, context, the Help menu, the recommendation card, plans and the profile. The app followed the rules closely; several issues come from the rules themselves, so both have been updated.
Read with: NUCCESS Recommendation Rules Engine v5.0 (rules, 2,550 outcome rows, 320 place rows, 201 realistic stories and test cases) and NUCCESS Ordered Activity Tables v4.0 (process order, including Process 15 for return to work, study and training). All three use the same rule IDs, for example FE-1 (a strong unpleasant feeling lowers the colour one step) or LBL-1 (approved labels only). Where this brief and earlier versions disagree, this brief and v5.0 win.
Public name: the app is the FigCit App on every screen. NUCCESS stays the internal name of the rules engine.
## What works well — keep these
The tone, the task tools and the comfort settings are strong and should not change.
- Tone: "Stop anytime. Nothing is counted or scored", "Not now is always OK", "We'll start small, no blame". Keep this voice everywhere.
- Tasks: break it down into five steps, "I've been putting this off", snooze, What matters now (Now / Next / Quick wins / Let go), pausable timer.
- Dump: free capture, then sort into To-do, Notes, Ideas and Worries; worries never become tasks.
- Regulate tools: Breathe, Ground (5-4-3-2-1), Move, Sounds, Step out, Rest — short, with discreet versions.
- Accessibility: text size, dyslexia-friendly font, reduce motion, low stimulation, calm themes.
- Safety: Help on every screen; "How did that go?" after every tool with an optional re-check.
## Fix first: bugs from the test run
Three P0 bugs block the student pilot: internal text on the card, the Google sign-in error page, and the sign-in email. P0 = before any external tester; P1 = before the pilot; P2 = before launch.
ID
Priority
What happened
Fix
Rule
BUG-01
P0
The card's main button read "The user's own rituals, prayers, recitations, schedules and reminders"; the reason included "task list with 'why now'"
Render only user_label / user_description (Tab 17)
LBL-1
BUG-02
P0
Continue with Google opened a raw 501 "not_configured" JSON page
Configure Google sign-in, or hide the button; never show raw errors
SU-2, SU-10
BUG-03
P0
The sign-in email did not appear in the inbox
Check sending, SPF/DKIM/DMARC on figcit.co.uk, spam placement; add Resend and a spam hint
SU-7
BUG-04
P1
Task "Write the project proposal" + "Pray or do my practice" gave a prayer/ritual card for the task
Ask "Which first?"; a practice is never the action for a task
SEQ-1
BUG-05
P1
The reason only repeated feelings; body, senses and place were ignored
Reason cites every completed step
RT-1
BUG-06
P1
Green, no task: "FigCit suggests Open Home"
New pattern 1 card
P1-A
BUG-07
P1
Senses asked twice (Sensory tab and "Is anything bothering your senses")
One Senses tab in Body & senses
Tab 3; Tab 13 step 4
BUG-08
P1
Energy and mood sliders looked pre-set at Very Low and Very Bad
Nothing selected until tapped
A-17
BUG-09
P1
About ten screens before any suggestion; strength on its own screen
Quick and Full check-in, strength inline, results on the same screen
Tab 8
BUG-10
P2
Browse mode: cards led to "This needs an account"; Log out shown without an account
Remove browse mode; Log out only when signed in
SU-1, SI-6
BUG-11
P2
Deleting a dump used the browser's "figcit.vercel.app says" box
In-app confirm dialog
A-44
BUG-12
P2
Plans showed "FigCit Plus £6.99 / £59.99"
Free / Prime £7 / Premium £13 / organisation code
ENT-10
BUG-13
P2
Help lists England-only lines; says "You can do this"
Lines per nation; new copy
HELPLINES, CP-11
BUG-14
P2
A calm, high-energy user was offered "Explore Regulate anyway" and Create
Alternatives must fit the light
ALT-1
BUG-15
P2
"Adapt this" and "Finding your next step" showed empty loaders for several seconds
Load under 1 second or show the previous card
—
BUG-16
P2
Greeting "Good morning, you"
Use the saved name
SI-5
## Sign-up, sign-in and no browse mode
Remove browse mode. Sign-up asks for four things only: a name or nickname, email, age band and country. Help/SOS still works without an account.
Why no browse mode: in testing it led to dead ends ("This needs an account") and a Log out button for someone not signed in. The age rule and data protection both need an account. Without an account a person can open only Welcome, How FigCit works, Help/SOS, Privacy and Terms (SU-1).
Create account (S04 → S04a → S04b → S04c)
- Choose a method: email and password, email one-time code (link plus 6-digit code), or Continue with Google. Hide any method that isn't configured (SU-2).
- Your details (S04a):
- What should we call you? — name or nickname, 1–30 characters, any script, editable later. With Google, pre-fill the first name; the user can change it (SU-6).
- Email — from Google if used.
- How old are you? — 18 or over / 16 or 17 / Under 16. Store the age band only, never a date of birth (SU-4).
- Country — and England, Scotland, Wales or Northern Ireland if in the UK. Sets Help/SOS lines (SU-5).
- Accept Terms and Privacy (required); product-update emails optional and unticked (SU-8).
- Verify (S04b): code or link valid 10 minutes, Resend after 60 seconds, a spam hint, sent from an @figcit.co.uk address (SU-7).
- Welcome (S04c): "Hello, {name}", then one optional comfort screen, then the first check-in (SU-9).
Age rule (one rule for the whole UK)
Answer
What happens
18 or over
Continue
16 or 17
Join only through a college or university (institution code or institution sign-in). Without one: a kind explanation and Help/SOS
Under 16
"FigCit isn't available for under-16s yet", Help/SOS and Childline 0800 1111
Not asked at sign-up: sex, full date of birth, diagnosis, profession or study level. Profession and study level move to the optional profile (Me).
Sign-in: email and password, email code, or Google; "Remember this device"; plain, blame-free errors; brief lock after repeated failures; never reveal whether an email has an account (SI-1 to SI-3). Restore comfort settings before the first screen. Greet by name: "Good morning, Torera" (SI-5). Show Log out only when signed in (SI-6). Admin and institution roles use multi-factor authentication (SI-7).
## Check-in redesign: Quick and Full
Cut the check-in from about ten screens to two (Quick) or four (Full), and show each step's result on the same screen before Continue.
- Capacity (S06): "How's your energy and mood right now?" Nothing pre-selected. As soon as both are chosen, show the state name, icon, one-line meaning and colour on the same screen. Then, continue v
- How you feel (S08): up to two of 20 emotions (ten free on screen, "Something else (type it)" and More for Prime). Each chosen emotion shows one slider only — no scale on screen; the backend reads it as Mild (1–3), Moderate (4–6), Strong (7–8) or Very strong (9–10). The stronger emotion decides. Show the colour and one plain sentence. In Amber or Red offer an optional "Breathe first?" chip that returns to the check-in afterwards.
- Body & senses (S09, Full only, optional): one screen, two tabs. Body: tension, pain, Heaviness, brain fog, crawling movement, fidgeting, rocking, stimming, discomfort, aches, tenderness, (with body map), hunger, thirst, tiredness, hard to hear.                                               Senses: Noise, Sound, Lights, Crowd, Smell, Temperature, Touch, Visual clutter. Senses are the sensitivity flags; delete the second senses screen.
- Where are you now (S10, Full only): place, people, help or devices with me, "Can you step away?" (Yes / Not easily / No). Asked fresh every time; nothing pre-selected (CTX-0). Show the final colour and what changed. 
- Help menu (S11): see below.
Home offers Quick check-in, Full check-in and I need help with… (asks Capacity, then opens the Help menu). Timeline is asked only when there is a task. Re-checks use Quick.
## Emotions, body and where you are
The colour now changes only because of the person: how strongly they feel and what their body is telling them. Where they are and what they have with them decide which route and tools are shown, never the colour.
The 20 emotions (groups are never shown)
Group
Emotions
What helps first
Charged
Angry · Frustrated · Anxious · Overwhelmed · Let down or cheated · All over the place
Settle the body (Regulate), then put it somewhere (Dump or Express)
Low
Teary or sad · Disappointed · Lonely · Unmotivated · Bored · Not good enough
Comfort and connection, then one small, usual step
Shutdown
Numb · Frozen · Shut down
No words needed: tap-only tools, eyes open
Settled
Calm · Happy · Grateful · Clear-headed · Empowered
Use the capacity: tasks, speaking up, creating, connecting
Free shows ten on screen — Calm, Happy, Anxious, Overwhelmed, Angry, Teary or sad, Lonely, Unmotivated, Not good enough, Shut down — plus Something else (type it). The other ten sit under More (Prime). "Something else" opens a short text box (safety-checked) and one optional tap: "Does it feel more wound up, low, switched off or okay?" Free uses it for that check-in only; Prime and Premium can save it as their own emotion for patterns.
Body & senses (S09): Body has 14 signs (6 free: Tension, Aches or pain, Heaviness, Fidgeting, Can't get moving, Shut down). Senses has 8 (4 free: Too loud, Too bright, Too busy or crowded, Hungry or thirsty). A separate row, Something feels wrong, holds the urgent signs and is always free: slurred speech, breathless, chest pain, suddenly can't move part of my body, sudden change in my sight.
Colour rules (Tab 6)
- FE-1: the deciding emotion is Charged, Low or Something else at Strong or Very strong → one step lower.
- FE-2: Numb, Frozen or Shut down at Moderate or above → one step lower and no-words mode.
- FE-3: two emotions → the higher slider decides; a tie goes to the unpleasant one (Shutdown > Charged > Low).
- FE-0: Settled emotions never raise or lower the colour.
- BS-1: a Shutdown body sign, or 3+ body signs → one step lower. Senses never change the colour (BS-2); they put Adapt first.
- CAP-1: feelings and body together lower the colour by one step at most, never below Red.
- SF-4: an urgent sign asks "Is this sudden or new for you?" Yes → urgent screen with 999 and the nation's 111 line. No, it's familiar when I'm overwhelmed → the check-in continues one step lower.
- CX-R and DV-R: place, "Can you step away?" and devices never change the colour; they choose discreet or open tools and unlock tools (headphones → calming sounds; ear defenders, sunglasses, quiet room → Adapt first). Retired: EX-1, CX-1, CX-2, DV-1, DV-2, DV-3.
Places (S10): Home · Work or placement · Class or lecture · Out and about (free) · Exam, interview or assessment · Appointment or meeting · Library or quiet study space · Somewhere else (Prime). Then "Can you step away?" Yes / No. Result line: "Got it — we'll pick things that work at work."
Worked example: Full Flow (green), anxious 8, too busy, on a bus, headphones. Strong anxiety lowers it to yellow (FE-1). The bus does not lower it further; the card starts with the crowd ("It's too busy or crowded — we'll start with that") and offers discreet tools, with calming sounds unlocked by the headphones.
## Help menu and the eight support cards
"What can I help you with?" offers three choices: Something I need to do, Support for how I feel and Just checking in. Support shows one card per pathway in the user's own words, filtered by the light; show the top four for the light first, then More. The 12-card screen in the test build is replaced.
Card the user sees
Hint under it
Pathway
Shown in
Help me calm down
Stress, burnout, fatigue, meltdown or outburst
Regulate
All lights
Too much in my head
Overwhelm, racing, intrusive or tangled thoughts
Dump
All lights
Too much around me
Overload from noise, light, people or the setting
Adapt
Green, Yellow, Amber, Blue
Help me get something done or get somewhere
Start, focus, attend an event
Execute
Green, Yellow, Blue; Amber = one small routine step
Help me find the words
Say, write or ask for something
Express
Green, Yellow, Amber, Blue (in Red, message cards stay inside Get support now)
Help me make sense of things or let go
My day, or something from the past
Reflect
Green, Blue; Yellow at Mild/Moderate
Ground me in my practice
Stillness, meaning, prayer or my own rituals
Meditate · Rituals · Prayer
Green, Yellow, Blue; Amber if calm; own practice any time
I want to talk to someone
Reach a person I trust
Connect
All lights
In Red, show only Help me calm down, Too much in my head, I want to talk to someone and Get support now. Overwhelm means too much inside (thoughts, feelings) and goes to Dump; overload means too much outside (noise, light, people) and goes to Adapt. The picked card sets the pathway unless a safety rule or gate blocks it; then explain the swap in one line (SEQ-2). Tab 8 of the workbook holds the full rule card for each pathway in every light and setting.
## Tasks: chips, sorting and suggestions
Tasks get one optional chip. The words "demand type" and NUCRIPCE are never shown.
Chip
Demand type (hidden)
Example
New
Novelty
First day on a placement
Can't wait
Urgency
Report due today
Hard
Challenge
A difficult essay section
Usual
Routine
Washing up, weekly timesheet
Enjoy
Interest
Reading about a hobby
Matters to me
Passion
Volunteering, faith or family
With others
Collaboration
Team meeting, group project
Try out
Exploration
Looking at courses or jobs
- TK-2 sorting: Green puts Hard, New and Can't wait first; Yellow puts Can't wait, Usual and Enjoy first; Amber shows Can't wait (cut to one small step), Usual and Enjoy, with the rest under "Later"; Red keeps the list but suggests nothing. The card says it plainly: "We've put the usual things first today."
- TK-3: a Can't wait task is never hidden; in Red the app offers "Ask someone to help" or "Move the deadline".
- TK-4 no task: the app still suggests something that fits — Green: start the hardest thing on your mind; Yellow: one usual task or reply to one message; Amber: a drink or snack, one tiny usual thing; Red: rest is the task.
- TK-5: Free holds up to 3 tasks and picks the best fit; Prime and Premium get an unlimited, fully sorted list with Break it down.
## Regulate: Move, Dance and Create · Express: Write · Dump routes
- Move a little and Dance break (Free): 2–5 minutes to the user's own music or a royalty-free track, only where the place allows (home, or "I can step away"). Never in no-words mode.
- Dance sessions and Sleep wind-down movement (Prime): timed sessions the user sets; slow sway and stretches before bed.
- Guided body movement (Premium): shake-out, tense-and-release, slow stretching, swaying — voice or on-screen guide (user chooses), 2–20 minutes. Wording is "eases tension and stress", never "treats pain" or "releases trauma". Every session shows: "Skip any move that hurts. Stop if pain gets worse. If you have ongoing pain or an injury, check with your GP or physiotherapist." A physiotherapist or registered dance movement psychotherapist reviews the sequences before launch.
- Music: the user's own music or royalty-free tracks; no commercial tracks bundled.
- Create (Regulate): draw, paint and design on one canvas with Save and Upload. Free: draw, save up to 10. Prime: paint, design, unlimited saves, upload. Premium: templates. Private and deletable. Later version: a 3D builder (shapes and objects, colour, download a 3D image).
- Write (Express): a writing panel, plus "Ask for what I need" and "Notes for my appointment" templates. Nothing sends automatically.
- Dump routes: To-do → Execute (task) · Note → saved · Idea in words → Express → Write · Idea as an image or diagram → Regulate → Create · Worry → Regulate in Amber/Red, Reflect in Green/Yellow, or Meditate if the user prefers (rumination guard still applies).
## Settings before the first check-in
The first time someone reaches Home, before the first check-in, show a short, skippable Set things up your way sheet: colour theme (Light, Dark, Soft colours, High contrast), language, text size, reduced motion, voice guidance, sounds and vibration, and check-in reminders. A settings icon stays on Home. All accessibility settings are free; extra decorative themes are Prime.
## Return to work, study and training
Turned on in Me ("Getting back to work, study or training"). It adds:
- Morning load check: a Quick check-in, then "Today fits: the usual things and one can't-wait" in chip words.
- Before a shift, class, interview or appointment: a 2-minute settle, a short checklist and "Notes for my appointment" for Jobcentre, GP or review meetings.
- Ask for what I need: turns the user's own words (and, in Premium, their patterns) into a short adjustment request. Never sends automatically.
- My fit summary (Premium): 2–4 weeks of check-ins shown as capacity against the chips worked on. Owned by the user, shared only by choice; links to a Capacity Fit Profile.
- Organisations see anonymised group trends only (minimum group size), never an individual's check-ins.
## Recommendation card
The card must use approved wording only, explain itself using every step the user completed, and never offer a practice as the action for a task.
- Approved labels only (LBL-1): every tool and button has a user_label (5 words or fewer) and user_description (12 words or fewer) in Tab 17. The app renders only these. Internal descriptions, rule text and notes are never shown. A missing label falls back to "Try {pathway}" and logs an error.
- A reason that reflects every step (RT-1 to RT-4): mention the state, the emotions with their level, body or senses if given, why the colour moved (if it did) and what the place changed about the route. At most three short sentences and 60 words. No internal words (band, intervention, NUCRIPCE, cell IDs).
- Task chips in plain words (RT-3): New, Can't wait, Hard, Usual, Enjoy, Matters to me, With others, Try out. The card names the order, e.g. "We've put the thing that can't wait and the usual things first today."
- Pattern 1 (P1-A): Green, no distress, no task. Replace "Open Home" with "You're in a good place. What would you like to do with it?" Primary: Plan something. Alternatives: Explore something new · Just note how I feel.
- Alternatives fit the light (ALT-1): don't offer Regulate in Green unless restlessness or a sense flag is present; at most one labelled paid alternative, and only in Green, Yellow (Mild/Moderate) or Blue.
- Support card plus a task (SEQ-1): in Amber or Red, or at High+, support comes first and the task follows a re-check. In Green, Yellow or Blue, ask "Which first?" with two buttons. A practice or Reflect is never the action for a task.
- New patterns: 42 Quick check-in with unknown place; 43 "Which first?"; 44 Help line safety screen; 50–51 urgent body signs; 52 Something else; 53 no-task suggestion; 54 sorted task list; 55 Ask for what I need; 56 Create; 57 Dance break; 58 Wind down; 59 senses first; 60 morning load check. Pattern 45 is retired.
Example reason (Full check-in, three sentences): "You're in Building Up, feeling anxious (strong) with a racing heart. Feeling this strongly makes things harder, so you're in amber for now. It's too busy or crowded — we'll start with that."
## Plans and pricing
Replace "FigCit Plus £6.99 / £59.99" with the plans in the business plan: Free, Prime at £7 and Premium at £13 a month, plus organisation seats at £10 that unlock Premium. All prices are shown before VAT; checkout adds VAT and shows the total before payment. Every paid plan also has an annual option at 12 months for the price of 10. Prices are configuration (ENT-10).
Plan
For
Price
Free
Everyone with an account
£0
Prime
Students and individuals who want more everyday depth
£7 a month or £70 a year (before VAT)
Premium
Professionals and anyone who wants the full toolkit
£13 a month or £130 a year (before VAT)
Organisation seat
Universities, colleges, employers, Jobcentres and programmes paying for people; Premium automatically, at a lower price because they bring many users at once
£10 per seat a month or £100 a year (before VAT), paid by the organisation
Launch pilot
Six-week free pilot cohort; Premium unlocked, then the user chooses
£0 for six weeks
What each plan adds, by pathway
Pathway
Free
Prime adds
Premium adds
Regulate
Breathe, Ground, Move, core Sounds, Step out, Rest
Full Sounds library and mixer; movement routines including Dance; Create
Sleep wind-down programmes; Attention reset; a personal plan that learns what calms you
Dump
Unlimited text, voice (allowance), manual sorting
Sorting suggestions; search; convert to a task; longer voice with transcription
Photo and document capture; private worry-pattern insights
Express
Quick message cards; help and pause templates; Simplify and Rewrite (daily allowance)
Unlimited Simplify and Rewrite; tone check; structure long messages
Draft from scratch; scripts for calls and meetings; adjustment request drafts
Execute
Task list; smallest step; breakdown; pick one of three; focus timer
Re-plan breakdowns; reminders and scheduling; AI body double; routine builder
Calendar sync; overdue repair; human body-double rooms (when launched)
Adapt
Adaptation library; stop points; re-run the card
Transition planner; saved "what helps me" settings
Adjustment Passport; adjustment templates; capacity summary to share with consent
Reflect
Three-prompt check-out; gratitude; close the day; takeaways
"What helped" insights; monthly summary
Pattern review; self-advocacy preparation; export
Connect
Trusted contacts; one-tap messages; groups the user lists
Scheduled check-in buddy
No extra Premium tools (there is no peer community)
Meditate · Rituals · Prayer
Stillness timer; guided settle 3 and 5 min; gratitude; the user's own practices and reminders
Guided library 10 and 20 min; walking practice; ritual builder
Body-scan series; longer programmes; recitation player offline
Across the app: progress is 30 days on Free, full history on Prime, and full history plus downloadable reports on Premium. Check-in, the engine, Help/SOS, the support plan, accessibility, consent, export and delete are free for everyone (ENT-2). No paid tiles or prompts in Amber, Red, at High+ or after a safety event (ENT-3). The user's own faith practices are never paid (ENT-4). Organisations see no individual data (ENT-7). Messages to trusted contacts are sent from the user's own phone, outside FigCit; the app only prepares the words (MSG-1).
What each plan can select
Free
Prime
Premium and organisation seats
Emotions
10 + Something else (this check-in only)
All 20 + save my own
All + patterns
Body and senses
6 body + 4 senses + urgent signs
All 14 + all 8
All + body patterns
Places
4 + "Can you step away?"
All 8
All 8
Tasks
Up to 3; best fit picked
Unlimited, sorted, Break it down
Same as Prime
Move
Move a little, Dance break
+ Dance sessions, Wind down
+ Guided body movement
Create
Draw, save 10
Paint, design, unlimited, upload
+ templates
Return to work
Morning load check
+ before-a-shift tools, Notes for my appointment
+ Ask for what I need with patterns, My fit summary
Never locked: Anxious, Overwhelmed, Teary or sad, Not good enough, Shut down, the urgent signs and Help/SOS (ENT-13). A locked option shows a small lock; in Green, Yellow or Blue tapping it opens a one-screen plan sheet, in Amber or Red nothing opens (ENT-12).
Organisation seats: build in two steps
- At launch (January 2027): organisation codes. A user enters their organisation's code at sign-up or in Plans and gets Premium straight away (ENT-7, T-22). FigCit staff create each organisation, issue its codes and invoice it by hand from a simple admin screen. Needed from day one for pilots, sponsored places and demos to prospective clients.
- Before the first seat-paying client (target April 2027): organisation dashboard. Seats used, anonymised group trends shown only above a minimum group size, and invoices. Never an individual's check-ins, feelings or fit summary (RW-6). Designed now, built when the first organisation signs or gives a letter of intent.
Self-service seat management (buy, add and remove seats) follows in Year 2.
Native app (later in 2027): the web app comes first; native iOS and Android apps follow later in the year. Plan for app-store review, and for the store's commission on subscriptions bought inside the app (small-business programmes charge less than the standard rate); organisation seats and web sign-ups are not affected.
## Profile (Me) and Life right now
Everything beyond the four sign-up fields is optional and lives in Me, with a gentle prompt. Life right now asks about everyday circumstances only — no health or harm — never changes the colour, and is never shared with organisations.
- Prompt (ME-1): after the first completed check-in, a dismissible Home card "Make FigCit more yours (optional)". If dismissed it may return after 7 days, at most 3 times; never in Amber, Red, Blue or after a safety event.
- Optional details (ME-2): pronouns; what fills most of your week (studying, working, looking for work, training or apprenticeship, caring, other); study level; job or field; help or devices I often carry. Carried devices appear first on Where you are as unselected chips; they are never pre-ticked.
- Life right now (ME-3): "Is anything big going on for you right now?" Losing someone or something (bereavement, break-up) · A big change (moving home, new job, course or role) · Money pressures · Work or study pressure · Left or between a job, course or training · Caring for someone · Feeling alone · Feeling stuck · Being treated unfairly · Prefer not to say. Abuse, neglect, accident or injury, physical health and mental health are not asked.
- Help line (ME-5, SF-3): always shown under the list: "If someone is hurting you or you don't feel safe, tap Help." It opens Help/SOS with 999 and the nation's crisis and domestic abuse lines. Nothing is stored about why. Free text anywhere still passes the safety check (SF-1).
- Use (ME-4, LE-0): a validating line on the card, the order of support cards (for example, losing someone puts Reflect, Connect and Meditate first) and signposting. No effect on the colour; never used to pick faith content.
- Privacy (ME-6): with no health or harm options, and "Being treated unfairly" naming no reason, this is not special category data. It is still private by default, excluded from organisation views and analytics unless the user opts in, and editable or deletable at any time.
## Help/SOS lines by nation
Help/SOS shows the lines for the user's country and nation, works without an account, and needs clinical sign-off before launch. The test build lists England's lines only.
Where
Lines
All UK
Emergency 999 · Samaritans 116 123 (24/7) · Shout: text SHOUT to 85258
England
NHS 111, option 2 (urgent mental health) · National Domestic Abuse Helpline 0808 2000 247
Wales
NHS 111, press 2 (urgent mental health, 24/7) · Live Fear Free 0808 80 10 800
Scotland
NHS 24 on 111 (mental health) · Breathing Space 0800 83 85 87 · Domestic Abuse and Forced Marriage Helpline 0800 027 1234
Northern Ireland
Lifeline 0808 808 8000 (crisis) · Domestic and Sexual Abuse Helpline 0808 802 1414
Under-16 screen
Childline 0800 1111
Outside the UK
"Call your local emergency number" until country lines are added
Numbers were checked on 10 November 2026 against Breathing Space, NHS 111 Wales, nidirect: Lifeline and SafeLives: Get help.
## Copy changes
Replace technical, heavy or health-claim wording with plain, kind words. Tab 17 of the workbook holds the approved label for every tool.
Screen
Current text
Replace with
S06
What's your perceived current state?
How's your energy and mood right now?
S06
Continue to Experience
Continue
S09
Your body was never your enemy. Feel what you were told to suppress.
Notice anything in your body? Skip if not.
S09/S10
Your senses are data, not overreaction. / Is anything bothering your senses right now?
One Senses tab: Is anything around you bothering your senses?
S10
This mediates what you can take on.
Where you are changes what you can do 
S10
Support available right now
Help or devices with me
S16 Dump
Every region that holds chronic tension is a sentence your nervous system never finished speaking. Pour it all out.
Empty your head. Nothing here has to become a task.
S13
FigCit suggests Open Home.
You're in a good place. What would you like to do with it?
S05
Good morning, you
Good morning, {name}
S31 Help
You can do this.
You don't have to deal with this alone.
S02
Check-in · Support · Match · Act · Review
Check in · Choose what you need · Get a suggestion · Try one small step · See what helped
S41 Plans
FigCit Plus £6.99 / month · £59.99 / year
Prime £7 a month or £70 a year · Premium £13 a month or £130 a year · Covered by your organisation? (prices before VAT; VAT added at checkout)
Sustained-low message
…You can do it.
This sounds like a really hard stretch, and you don't have to go through it alone. Would you like help finding the right support?
S09 body list
Contractions; Hot flashes
Review with the clinical adviser (for example Cramps; Hot or flushed)
The Dump line reads as a health claim, so it goes; the app makes no clinical claims.
## Acceptance criteria and open decisions
The build is done when every P0 and P1 bug is fixed and the 25 test cases in workbook Tab 21 pass, and the screens match the expected results in Tabs 18–20. The key cases are below.
- No internal text appears on any card; every button equals a Tab 16 label (T-16)
- Google sign-in works or is hidden; no raw error page anywhere (T-13)
- Sign-up asks only name or nickname, email, age band and country; Google pre-fills the name and still asks age and country (T-12)
- 16–17 without an institution code and under-16s cannot create an account and see Help (T-10, T-11)
- Home greets by name (T-15); Log out appears only when signed in (T-23)
- Quick check-in reaches the Help menu in two steps; each step shows its result on the same screen
- Senses are asked once; energy and mood start unselected
- Strong anxiety on a noisy bus lowers the colour one step; the bus and headphones do not change the colour, only the tools (T-03, T-04, T-33)
- Only two emotions can be picked; one slider each; a tie goes to the unpleasant one (T-31)
- Strong anger plus three body signs lowers the colour only one step (T-32)
- "Breathless" answered "sudden or new" shows the urgent screen with 999 and 111 (T-34)
- A locked option tapped in Amber opens nothing (T-35); the always-free list is never locked
- With no task, a task that fits is suggested; in Amber, Can't wait comes first and Hard and New go under Later (T-30, T-38)
- An idea sorted as a diagram opens Create (T-37); the settings sheet appears before the first check-in (T-39)
- Guided body movement shows the safety line and lets the user choose voice or display and a time (T-40)
- Where you are has nothing pre-selected on a second check-in (T-09)
- Green with no task shows "Plan something", not "Open Home" (T-01)
- Support card plus task asks "Which first?" in Green, Yellow or Blue (T-02)
- Plans show Free, Prime £7 and Premium £13 plus an organisation code; no paid tiles in Amber or Red (T-19, T-21)
- Help/SOS shows the right lines for Scotland, Wales and Northern Ireland (T-14)
- In Me, the fixed line under Life right now ("If someone is hurting you or you don't feel safe, tap Help") opens Help/SOS with 999 and the nation's lines; nothing is stored and the colour does not change (T-17)
Decided by the founder (10 November 2026)
- Organisation seats give Premium automatically, at £10 a seat a month or £100 a year (before VAT). The lower price reflects volume.
- All prices are shown before VAT; VAT is added at checkout and the total is shown before payment.
- Annual plans are 12 months for the price of 10: Prime £70, Premium £130, seat £100. The financial model assumes 15–20% of paying users choose annual (15% in Year 1, 17.5% in Year 2, 20% in Year 3).
- "Life right now" replaces "life events". It holds no health or harm options; a fixed Help line opens Help/SOS instead of a safety question.
- Up to two of 20 emotions, slider only; Free shows ten plus "Something else", which paid users can save as their own emotion.
- Feelings, intensity and body lower the colour by one step at most; place and devices decide the route only.
- Tasks use plain chips and are sorted by colour; with no task, a task that fits is suggested.
- Dance and guided movement sit in Regulate → Move; Create sits in Regulate; Write sits in Express. Users play their own music or royalty-free tracks.
- Settings appear before the first check-in. Free has limited choices so Prime, Premium and organisation seats are worth paying for; safety options are never locked.
- There is no peer community feature for now.
- Messages to trusted contacts are sent from the phone, outside the app.
- Still open: clinical sign-off of the life-event wording, the safety question (SF-3) and the Help/SOS lines.
