**NUCCESS**

**Ordered Activity Tables: Process by Process — v2.1 (October 2026)**

One table per process, each self-contained from Admin configuration through to the customer-facing outcome, using the Order / Actor / Activity / Description / Outcome–Next Activity structure. Each process now opens with its **Goal**, its **Outcome**, its **Actors** and its **Key processes**. Descriptions include the key process steps in bold so designers, developers and testers read the same thing. v2.1 adds Process 2 (Sign-In) and Process 11 (Plans, Subscription & Advanced Tools), and every support pathway now has Free and Advanced tools. Aligned to NUCCESS Recommendation Rules Engine v3.3, the Architecture & Screen Specification v3.1 and the PRD/FRD v3.1 (screen IDs S01–S41).

|  |  |
| :-: | :-: |
| **Term** | **Current definition** |
| **Energy axis** | Very Low, Low, Moderate, High |
| **Mood axis** | Very Bad, Bad, Neutral, Good |
| **Predicted state** | Always shown as the state's name, its icon and a simple description of what it means for the customer (e.g. Hibernate 🌙 'Rest is the task right now — everything else can wait'). |
| **Support pathways (8)** | Regulate, Express, Execute, Dump, Adapt, Reflect, Connect, Meditate · Rituals · Prayer. ('Organise' from the earlier draft is covered by Dump sorting and Execute prioritising.) |
| **Demand drivers (NUCRIPCE)** | Novelty, Urgency, Challenge, Routine, Interest, Passion, Collaboration, Exploration — only used when there is a demand. |
| **Traffic lights** | Green (Available), Yellow (Conditional), Amber (Constrained), muted Red (Very Constrained), plus Blue (Recovery after support). |
| **Free and Advanced tools** | Every pathway has free tools (including an always-free safety floor) and Advanced tools paid through NUCCESS Plus or an institution licence. No upgrade prompts in Amber, Red or during distress. |
| **Timeline** | T0 Now, T1 Later today, T2 This week, T3 This month, T4 Months, T5 Long-term, T6 No deadline, TX Overdue, TR Recurring. |

## **Process index**

|  |  |  |
| :-: | :-: | :-: |
| **Process** | **Name** | **Goal (one line)** |
| 1 | Sign-Up & Entry | Let anyone start using Nuccess quickly, comfortably and safely |
| 2 | Sign-In (Returning Customer and Staff) | Let a returning person get back into their space quickly and safely |
| 3 | State Check-in (Capacity Matrix) | Help the customer name how they are right now in one or two taps |
| 4 | Experience & Context Capture | Capture just enough about how the customer is feeling and where they are for the engine to choose realistic support |
| 5 | Support Inference, Band & Need Statement | Work out which of the eight support pathways fit right now, which tools are realistic in this setting, and how much the customer can safely take on |
| 6 | Support Pathway (No Demand Needed) | Give the customer the support that fits right now |
| 7 | Demand Pathway (With Demand) | Turn a task or activity into something the customer can realistically start now, at the right size for their capacity and deadline, with the right kind of help. |
| 8 | Recommendation Orchestration | Turn everything the engine has worked out into one clear, kind, low-burden card |
| 9 | Action, Feedback, Recovery & Learning | Find out whether the support helped, recognise progress without piling demand back on, and learn |
| 10 | Safety Escalation | Make sure nobody in crisis is handled by an ordinary recommendation, and that persistent difficulty is met with a clear, respectful route to human support. |
| 11 | Plans, Subscription & Advanced Tools | Fund Nuccess sustainably by offering Advanced tools in every pathway, while keeping support free for anyone who needs it and never selling to someone under strain. |
| 12 | Governance, Consent & R&D | Keep the customer in control of their data, make every recommendation traceable, and let institutions and the R&D team learn only from what customers have agreed to share. |

# **Process 1 — Sign-Up & Entry**

*Admin defines how a customer can enter → Customer acts → System authenticates*

|  |  |
| :-: | :-: |
| **Goal** | Let anyone start using Nuccess quickly, comfortably and safely — with or without an account, without disclosing a diagnosis, and with their support plan and comfort settings in place before anything else is asked. |
| **Outcome** | The customer is in the app with an account or an anonymous session, their accessibility preferences are applied, and (if they chose) trusted contacts and support routes are saved for Connect and Help/SOS. |
| **Actors** | Admin, System, Customer |
| **Key processes** | Configure entry options and the Free/Advanced tool tiers → validate and publish → customer enters (Sign up, Register or Browse) → authenticate and create session → set comfort preferences → set up support plan. Returning customers use Process 2 (Sign-In). |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Admin** | **Create entry options** | Define the three ways a customer can enter. **Key process:** (1) Sign up with email or a social/identity login; (2) Register a full profile; (3) Browse without an account. Mark which profile fields are optional — none may be mandatory beyond login. | Entry options are prepared |
| 2 | **Admin** | **Configure plan and tool-tier rules** | Load the Free and Advanced tool tiers for all eight pathways from the rules workbook (Tab 6d) and set which features need an account. **Key process:** every pathway keeps free tools; the safety floor (core Regulate, communication cards, trusted contacts, the user's own practices), the engine, check-in and Help/SOS stay free, and Help/SOS works without an account. | Plan and tier rules are established |
| 3 | **Admin** | **Activate configuration** | Submit the entry, plan and tier configuration for validation. | System begins validation |
| 4 | **System** | **Validate configuration** | Check that at least one entry option is live, every pathway has at least one free tool in every light and context (ENT-1), no safety-floor tool is marked Advanced (ENT-2), and no profile field is mandatory. | Valid configuration is published; invalid configuration is returned |
| 5 | **Admin** | **Correct invalid configuration** | Fix missing or inconsistent rules flagged by validation. | Updated configuration is validated again |
| 6 | **System** | **Publish configuration** | Save the configuration with a version number and make it live. | Sign-up and entry become available (S01–S04) |
| 7 | **Customer** | **Enter the app** | Open Nuccess, with or without a task in mind. **Key process:** see Welcome (S01) and the Journey Map (S02), or skip both. | System loads the active entry configuration |
| 8 | **System** | **Display entry options** | Show Sign up, Register and Browse on 'Enter Your Space' (S04). | Customer chooses how to enter |
| 9 | **Customer** | **Choose an entry path and submit** | **Key process:** Sign up = email/auth only. Register = optional profile (name, nickname, date of birth, location, neurotype, status). Browse = no account. Nothing about diagnosis is required. | Entry request is sent |
| 10 | **System** | **Authenticate and create session** | Validate credentials or create an anonymous session; save any profile fields given. Apply the age rule (adults 18+ by default; 16–17 only through an approved institution). | Account or anonymous session is created |
| 11 | **System** | **Display Home** | Route the customer to Home / Now (S05). | Free tools in every pathway are available immediately; an account is needed to save history and to buy Advanced tools |
| 12 | **Admin** | **Create accessibility options** | Define comfort controls: text size, fonts, contrast/theme, motion, volume, haptics, language, notification style. Set calm defaults. | Accessibility options are prepared |
| 13 | **System** | **Publish accessibility options** | Make the comfort controls available in Quick Setup (S03) and Settings (S36). | Comfort controls become available |
| 14 | **Customer** | **Set comfort preferences** | Adjust or skip each control. **Key process:** every control has a sensible default so skipping is safe. | Preferences are stored |
| 15 | **System** | **Apply preferences** | Adapt the whole interface to the stored preferences before anything else is asked. | Interface adapts first |
| 16 | **Admin** | **Configure support routes** | Enter escalation thresholds and UK support routes (GP, 999, NHS 111 mental health option, Samaritans 116 123, Shout 85258) for clinical sign-off. | Support-route configuration is prepared |
| 17 | **Customer** | **Set up a support plan** | Optionally save trusted contacts, preferred routes and pre-written messages (e.g. 'I need quiet'), with consent for each (S32). | Support plan is submitted |
| 18 | **System** | **Save support plan** | Store contacts and consent scope; make them available to Connect, the one-tap shutdown message and Help/SOS. | Support plan is ready for use |

# **Process 2 — Sign-In (Returning Customer and Staff)**

*Returning customer, institution supporter or admin signs in → System verifies identity → restores session, preferences and plan*

|  |  |
| :-: | :-: |
| **Goal** | Let a returning person get back into their space quickly and safely — without being asked to re-enter anything — with their comfort settings, support plan and plan entitlement restored before the first screen appears. |
| **Outcome** | The person is signed in on this device with a secure session; preferences, support plan, saved practices and plan (Free, Plus or institution licence) are restored; any offline check-ins are synced; they land on Home / Now (customers) or their role dashboard (staff). Help/SOS was reachable throughout, even before sign-in. |
| **Actors** | Admin, Customer, Institution supporter, System, Identity provider |
| **Key processes** | Configure sign-in methods and security rules → customer chooses Sign in on S04 → email/password, passkey, social login or institution single sign-on → verify (plus MFA for staff) → handle failure, lockout or forgotten password → restore session, preferences, support plan and entitlement → sync offline data → route by role. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Admin** | **Configure sign-in methods** | Enable the sign-in methods: email and password, passkey or device biometrics, social login, and institution single sign-on (per institution). **Key process:** set the security rules — password policy, failed-attempt limit and lockout time, session length, 'remember this device', and mandatory multi-factor authentication (MFA) for Admin and Institution roles. | Sign-in configuration is prepared |
| 2 | **System** | **Validate and publish sign-in configuration** | Check every enabled method has a working provider, MFA is enforced for staff roles, and Help/SOS remains reachable without signing in. | Sign-in options are live on S04 |
| 3 | **Customer** | **Choose Sign in** | Open the app and tap **Sign in** on 'Enter Your Space' (S04). A device that is still signed in skips straight to Home. Help/SOS is visible on this screen. | Sign-in options are shown |
| 4 | **Customer** | **Enter credentials** | **Key process:** email and password, passkey/biometrics, social login, or 'Sign in with my institution' (SSO). Show-password and paste are allowed; error messages are plain and never blame. | Credentials are submitted |
| 5 | **Identity provider** | **Authenticate (SSO / social)** | For social or institution sign-in, verify the person and return a signed token to Nuccess with only the agreed fields (name, email, institution ID). | Token is returned |
| 6 | **System** | **Verify identity** | Check credentials or token. **Key process:** for Admin and Institution roles, require MFA; for customers, MFA is optional and offered in Settings. | Identity is verified, or sign-in fails |
| 7 | **System** | **Handle failed sign-in** | Show a calm message and the option to try again or reset the password. After the configured number of failures, lock the account for a short period and email the owner. Never reveal whether an email address has an account. | Customer retries, resets the password or waits |
| 8 | **Customer** | **Reset a forgotten password** | Tap 'Forgot password', enter email, open the time-limited link, set a new password. All other sessions are signed out. | Password is reset; customer signs in |
| 9 | **System** | **Check age and account status** | Confirm the account is active and the age rule still applies (16–17 only through an approved institution licence). Suspended or deleted accounts receive a plain explanation and a route to support. | Account is cleared to continue |
| 10 | **System** | **Create a secure session** | Issue a session with the configured length; if 'remember this device' is chosen, store a device token securely. | Session is active |
| 11 | **System** | **Restore the customer's space** | **Key process:** load comfort preferences (applied before the first screen renders), support plan, saved practices and reminders, quiet hours and 'In worship' settings, consent choices, and last state name and icon. | The interface looks and behaves as the customer left it |
| 12 | **System** | **Restore plan and entitlement** | Read the plan (Free, Plus, concession or institution licence) and its status (trial, active, grace, lapsed). Unlock Advanced tools if entitled. **Key process:** a lapsed plan never hides or deletes the customer's own content (ENT-6). | Correct tools are available |
| 13 | **System** | **Sync offline data** | Upload any check-ins, dumps or practice sessions recorded offline; resolve conflicts by keeping both versions and asking only if needed. | Records are up to date |
| 14 | **System** | **Route by role** | Customers go to Home / Now (S05); Institution supporters to the Institution Dashboard (S38); Admins to the Admin Console (S37). A pending reminder or queued next step is shown gently on Home. | Person is in the right place |
| 15 | **System** | **Log sign-in** | Record time, method, device type and result in the security log (no passwords). Notify the person of sign-in from a new device. | Sign-in is auditable |
| 16 | **Customer** | **Sign out (any time)** | Log Out (S40) confirms once, saves unsynced data and ends the session on this device; 'Sign out of all devices' is available in Settings. | Session ends safely; app returns to S01 |

# **Process 3 — State Check-in (Capacity Matrix)**

*Energy × Mood → predicted wellbeing state → baseline band*

|  |  |
| :-: | :-: |
| **Goal** | Help the customer name how they are right now in one or two taps — even when they can't find words — and turn that into one of 16 states the rest of the engine can use. |
| **Outcome** | A confirmed state (name, icon, plain meaning) is shown to the customer, and the system holds the cell ID and baseline capacity band for the next steps. Nobody is ever silently assigned a state. |
| **Actors** | Admin, System, Customer |
| **Key processes** | Configure 16 states → validate and publish → customer selects Energy and Mood (or uses 'Not sure') → system maps to a cell → shows name, icon and meaning → stores result with version. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Admin** | **Create energy levels** | Define Energy: Very Low (1), Low (2), Moderate (3), High (4). | Energy levels are prepared |
| 2 | **Admin** | **Create mood levels** | Define Mood: Very Bad (1), Bad (2), Neutral (3), Good (4). | Mood levels are prepared |
| 3 | **Admin** | **Configure the Capacity Matrix** | Map all 16 combinations (E1M1–E4M4) to a state with a name, icon and plain-language meaning (e.g. E1M1 Hibernate 🌙 'Rest is the task right now — everything else can wait'). **Key process:** each cell also gets a baseline band (Available, Conditional, Constrained, Very Constrained) and a default lean per support pathway. | State rules are established |
| 4 | **Admin** | **Configure the 'Not sure' path** | Set up three picture-based questions (body, energy, comfort) and how answers suggest a state. | Not-sure rules are established |
| 5 | **Admin** | **Activate configuration** | Submit levels, matrix and Not-sure rules. | System begins validation |
| 6 | **System** | **Validate configuration** | Check every one of the 16 combinations resolves to exactly one state, icon, meaning and band; no duplicates. | Valid configuration is published; invalid configuration is returned |
| 7 | **Admin** | **Correct invalid configuration** | Fix missing, duplicate or inconsistent values. | Updated configuration is validated again |
| 8 | **System** | **Publish configuration** | Save with a version (engine_version) and make it live. | Check-in becomes available |
| 9 | **Customer** | **Start check-in** | Tap 'Check in' on Home (S05), or arrive here after 'I need help with something'. | System loads the active configuration |
| 10 | **System** | **Display check-in** | Show Energy and Mood options on the Capacity Matrix screen (S06), plus a 'Not sure' link. Never show cell IDs, band names or the word 'grid'. | Customer can make selections |
| 11 | **Customer** | **Select energy level** | Choose Very Low, Low, Moderate or High. | Energy is held temporarily |
| 12 | **Customer** | **Select mood level** | Choose Very Bad, Bad, Neutral or Good. | Mood is held temporarily |
| 13 | **Customer** | **Or: choose 'Not sure'** | **Key process:** answer three picture taps (S07) → system suggests a state → customer confirms it or picks one anyway. If still unsure, the engine treats the state as Conditional (rule NS-1). | A confirmed or 'unconfirmed' state is recorded |
| 14 | **Customer** | **Submit check-in** | Submit the selections. | System begins validation |
| 15 | **System** | **Validate selections** | Confirm both selections exist and are active options. | Valid input proceeds to mapping |
| 16 | **Customer** | **Correct selections** | Replace missing or invalid choices. | Corrected check-in is submitted again |
| 17 | **System** | **Apply the Capacity Matrix** | Match the Energy × Mood coordinate to its cell. **Key process:** the coordinate is the identity — never multiply or add the two numbers (E4M1 ≠ E1M4). | Cell ID and baseline band are identified |
| 18 | **System** | **Show the state** | Display the state name, icon and one-line meaning. | Customer sees where they are |
| 19 | **System** | **Save check-in result** | Store energy, mood, cell ID, source (grid or Not sure), confirmed flag, timestamp and version. | Check-in history is updated; flow continues to Process 4 |

# **Process 4 — Experience & Context Capture**

*Emotion + intensity + sensations + context (environment, social, time/transition, available support, sensitivity flags)*

|  |  |
| :-: | :-: |
| **Goal** | Capture just enough about how the customer is feeling and where they are for the engine to choose realistic support — while keeping every part optional so it never becomes a questionnaire. |
| **Outcome** | An experience record (up to three emotions with intensity, the peak intensity, optional sensations including pain and body signals) and a context record (setting, people, time, support and sensitivity flags) are stored and passed to Process 5. |
| **Actors** | Admin, System, Customer |
| **Key processes** | Configure emotions, sensations, contexts and flags → customer selects emotions + intensity → optional sensations and body map → context and sensitivity flags → validate → hand to support inference. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Admin** | **Create / manage emotion options** | Define emotion words with emoji, grouped into families (e.g. Distress/overwhelm, Anxious, Shame, Shutdown, Task paralysis, Anticipatory unease, Wanting to make sense, Spiritual/faith need, Rumination). **Key process:** intensity bands are Mild (0–3), Moderate (4–6), High (7–8), Very High (9–10). | Emotion options are stored |
| 2 | **Admin** | **Create / manage sensation categories and body map** | Define six categories, each with selectable tags: **Sensory, Cognitive, Body (pain has its own intensity), Communication, Movement, Interoception** (hunger, thirst, toilet, sleepiness, too hot/cold). Store the body map regions (head, chest, stomach, arms, legs, etc.). | Sensation categories, tags and body map are stored |
| 3 | **Admin** | **Create / manage context tags** | Define: (1) **Environment** — home, work, school/library, lecture hall, exam hall, placement ward, lab, bus/transit, public venue, waiting room, in bed, online meeting, caring for a dependant, gym/outdoors, prayer/quiet room, place of worship; (2) **Social** — alone, friends, family, colleagues, strangers; (3) **Time/transition** — start of shift, between lectures, end of day, etc.; (4) **Available support** — can call, can use headphones, in-person help, quiet room bookable, none right now. | Context options are stored |
| 4 | **Admin** | **Create / manage sensitivity flags** | Define flags: Sound, Noise, Lights, Crowd, Smell, Temperature, Touch/texture, Visual clutter — separate from sensations (what the body feels) and context (where the user is). | Sensitivity flags are stored |
| 5 | **Customer** | **Select up to three emotions** | Choose emotion words with emoji (S08), or add a custom one. Skippable. | Emotion set is recorded |
| 6 | **Customer** | **Set intensity** | Set 0–10 for each emotion. **Key process:** the highest (peak) intensity carries forward, not the average. | Intensity per emotion and peak intensity are recorded |
| 7 | **Customer** | **Add sensations (optional)** | Tag what the body, senses, thinking, speech, movement or internal signals are doing (S09); tap the body map; give pain its own intensity if present. | Sensation set is recorded |
| 8 | **Customer** | **Capture context** | Confirm or edit environment, social setting, time/transition and available support; tick any sensitivity flags (S10). Suggestions (e.g. from a connected calendar) are editable and need confirmation. | Context record is recorded |
| 9 | **System** | **Classify the context** | Label the setting as private, public, formal/observed, unfamiliar, caring, prayer/quiet room or worship — used later to filter tools (e.g. eyes-closed practice is removed in public). | Context class is set |
| 10 | **System** | **Validate entries** | Check intensities are 0–10 and tags are recognised. Run any free text through the Safety screen classifier. | Valid entries proceed; risk language opens Help/SOS (Process 10) |
| 11 | **Customer** | **Correct entries** | Replace a missing or invalid selection. | Corrected entries are resubmitted |

# **Process 5 — Support Inference, Band & Need Statement**

*System chooses realistic support pathways and the traffic light; customer states what support is wanted*

|  |  |
| :-: | :-: |
| **Goal** | Work out which of the eight support pathways fit right now, which tools are realistic in this setting, and how much the customer can safely take on — then let the customer say, in plain words, what they want. |
| **Outcome** | One or more support pathways (or none) with a filtered tool list, a final capacity band and traffic light, gate decisions for Reflect and Meditate, and the customer's stated need. Support-only journeys go straight to the recommendation; others also go to Process 7. |
| **Actors** | Admin, System, Customer |
| **Key processes** | Configure pathways, tools, filters, needs and gates → match experience to pathways → apply Reflect/Meditate gates → filter tools by context → apply band safety modifiers → customer states a need → decide if a demand also exists. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Admin** | **Configure the eight support pathways** | Map each pathway to its tools: **Regulate** (Breathe, Ground, Move, Sounds, Create, Step out, Recovery, Sleep wind-down); **Express** (draft, rewrite, simplify, script); **Execute** (smallest step, breakdown, focus, body double); **Dump** (capture, optional sort); **Adapt** (environment, format, pace, scope, stop points); **Reflect** (3-prompt check-out, what helped, pattern review, self-advocacy prep); **Connect** (trusted contact, async message, groups); **Meditate · Rituals · Prayer** (stillness, guided settle, gratitude, walking practice, the user's own rituals and prayers). | Pathway configuration is prepared |
| 2 | **Admin** | **Configure trigger rules** | Link each emotion family, intensity band and sensation to pathways (e.g. Distress High → Regulate forced; Racing thoughts → Dump; Anticipatory unease Mild/Moderate → Meditate; Wanting to make sense → Reflect; Rumination → Reflect blocked). | Trigger rules are established |
| 3 | **Admin** | **Configure Reflect and Meditate gates** | Enter rules RF-1 to RF-5 (Reflect only in Green, Blue, or Yellow at Mild/Moderate; rumination guard; time limit; privacy; safety check) and MD-1 to MD-6 (band rules; no eyes-closed practice in shutdown or sensory overload; faith neutrality; public-setting variants; no streaks; never replaces support). | Gate rules are established |
| 4 | **Admin** | **Configure tool filters** | Map each context class and sensitivity flag to the tools it allows and excludes (e.g. bus: discreet Breathe, Ground, headphones; excludes Move, Create, eyes-closed practice, spoken prayer). | Tool filter rules are established |
| 5 | **Admin** | **Configure band safety modifiers** | Enter EX-1 (High negative experience, shutdown, High pain or sensory overload: −1), CX-1 (2+ flags in a public/formal/unfamiliar setting with a negative experience: −1), CAP-1 (max −2), UP-0 (never raise in a check-in), DEM-0 (demand never changes the band). | Band rules are established |
| 6 | **Admin** | **Configure the needs list** | Define plain-language needs and their routes (e.g. 'Help me feel calmer' → Regulate; 'There's too much in my head' → Dump; 'Make sense of today' → Reflect; 'Find stillness' → Meditate; 'Pray or do my practice' → Meditate + Adapt; 'Prepare to speak up for myself' → Reflect → Express). | Needs list is prepared |
| 7 | **System** | **Validate configuration** | Check every pathway resolves to at least one tool, every need maps to a route, and every gate has a fallback route. | Valid configuration is published; invalid is returned |
| 8 | **Admin** | **Correct invalid configuration** | Fix missing or unreachable rules. | Updated configuration is validated again |
| 9 | **System** | **Publish configuration** | Save with a rule_version and make it live. | Support inference becomes available |
| 10 | **System** | **Match experience to pathways** | Compare emotion families, peak intensity and sensations with the trigger rules. | Zero or more pathways are identified |
| 11 | **System** | **Apply Reflect and Meditate gates** | **Key process:** check band, intensity, rumination history and user flags. If a gate fails, swap to the safe route (e.g. Reflect → Dump; Meditate → tap-only Breathe) and log the gate result. | Gate results are recorded |
| 12 | **System** | **Apply the context filter** | Remove tools the setting or flags make unrealistic. The pathway itself never changes. | Only realistic tools remain |
| 13 | **System** | **Set the final band and traffic light** | Start from the cell's baseline band; apply EX-1, CX-1, CAP-1. Map to Green, Yellow, Amber or muted Red. | Final band and light are set |
| 14 | **Customer** | **State a need** | Pick from the plain-language needs list (S11), type or speak it, or choose 'I just want support'. | Need is submitted |
| 15 | **System** | **Record the need** | Store the need and map it to its route; decide whether a demand also exists. | Support-only journeys go to Process 6 and 8; others also go to Process 7 |

# **Process 6 — Support Pathway (No Demand Needed)**

*Always available, whether or not a demand exists*

|  |  |
| :-: | :-: |
| **Goal** | Give the customer the support that fits right now — calming the body, getting thoughts out, finding words, changing the setting, reaching people, making sense of something, or finding stillness through their own practice — without ever needing a task. |
| **Outcome** | The customer has used (or declined) one support pathway session, nothing has been sent or turned into a task without their choice, and the system offers a re-check (Process 9). |
| **Actors** | System, Customer, Trusted contact |
| **Key processes** | Present the recommended pathway → customer starts it or picks another → run the session with context-safe tools → hand off where useful (e.g. Reflect → Express) → offer a re-check. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **System** | **Present the support recommendation** | Show one primary suggestion, up to two alternatives and a plain-language reason (S13). In Red, 'Get support now' is always visible. | Customer chooses |
| 2 | **System** | **Show Free and Advanced tools** | Inside each pathway screen, list the free tools first and the Advanced tools labelled 'Advanced' (e.g. Regulate: Breathe, Ground, Move and core Sounds are free; Advanced Sounds, Advanced Movement and Create are Advanced). **Key process:** in Amber or Red, at High+ intensity or during a session, Advanced tiles are hidden entirely; a free user tapping an Advanced tile in Green/Yellow/Blue sees Plans & Advanced Tools (S41) and can choose 'Not now'. | Customer opens a free tool, or an Advanced tool if their plan includes it |
| 3 | **Customer** | **Regulate** | Choose a free tool (Breathe, Ground, Move, core Sounds, Step out, Recovery/rest) or, with Plus, an Advanced tool (Advanced Sounds, Advanced Movement, Create, Attention reset, Sleep wind-down programmes) (S14–S15). **Key process:** discreet variants first in public; tap-only, non-verbal mode during shutdown; stop anytime. | Session runs; a re-check is offered afterwards |
| 4 | **Customer** | **Dump** | Capture racing or overwhelming thoughts by text, voice or photo (S16), then optionally sort into Ideas, Notes, Worries and To-do (S17). | Content is captured; nothing becomes a task unless the customer says so |
| 5 | **Customer** | **Express** | Draft, rewrite, simplify, structure or script a communication (S18–S19). **Key process:** when angry, 'send later' is offered; nothing sends automatically. | Editable output is produced |
| 6 | **Customer** | **Adapt** | Change environment, format, sequence, scope, pace or communication method; set a stop point; plan a transition (S23). A transition can use one of the customer's saved rituals. | Conditions are revised |
| 7 | **System** | **Re-run the recommendation** | Recalculate using the adapted conditions. | New recommendation is presented |
| 8 | **Customer** | **Connect** | Reach a trusted contact, send a one-tap pre-written message, or choose a peer, community or faith group the customer has listed (S24). Text/async by default when Crowd is flagged; not offered during social hangover. | Contact request is sent |
| 9 | **Trusted contact** | **Receive contact** | Receive the message on the customer's terms. | Response is outside the system's control |
| 10 | **Customer** | **Reflect** | Answer three short prompts (What happened? What helped? What would I keep or change?) by chips, voice or short text (S25); see one takeaway; optionally save to My Patterns (S26). **Key process:** only offered in Green, Blue, or Yellow at Mild/Moderate intensity; time-limited; stop anytime; blocked during a replay loop. | A private reflection is saved (if chosen); hand-off to Express, Adapt or Execute is offered |
| 11 | **System** | **Run the rumination guard** | If the customer has reflected on the same topic 3+ times in 7 days without improvement, or felt worse afterwards, stop offering Reflect for that topic and offer Dump or Regulate. | Reflect is paused for that topic; the guard decision is logged |
| 12 | **Customer** | **Meditate · Rituals · Prayer** | Choose a practice (S27): **Meditate** (stillness timer, guided settle, gratitude, walking practice), **Rituals** (the customer's own opening, closing or transition rituals) or **Prayer** (the customer's own prayer times, texts or audio). Run it in Practice Session (S28). **Key process:** in public, only silent, eyes-open, headphone variants; 'In practice' mode pauses notifications; no streaks. | Practice session runs; a re-check is offered afterwards |
| 13 | **Customer** | **Set up My Practices (optional)** | Add personal rituals (steps), prayers or recitations (text, audio or link), a schedule, a reminder style, and flags such as 'helps me when I'm struggling' or 'meditation makes me feel worse' (S29). | Personal practices are saved privately |
| 14 | **System** | **Keep faith content neutral** | Show only practices from My Practices or the neutral library. Never use profile data (e.g. religion) to choose content. | No faith content is ever assumed |

# **Process 7 — Demand Pathway (With Demand)**

*Only runs when the customer's need includes a task or activity*

|  |  |
| :-: | :-: |
| **Goal** | Turn a task or activity into something the customer can realistically start now, at the right size for their capacity and deadline, with the right kind of help. |
| **Outcome** | The demand is tagged with NUCRIPCE drivers and a timeline code, checked against the band, and either started (in capped micro-steps, with optional body double), capped to Routine, or deferred until a re-check improves. |
| **Actors** | Admin, Customer, System, Body double |
| **Key processes** | Configure drivers and timeline codes → customer states one or more demands and a timeline → system derives urgency and step cap → tags NUCRIPCE → checks capacity–demand fit → presents the demand action → breakdown → focus with optional body double. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Admin** | **Create the driver taxonomy** | Define the eight NUCRIPCE drivers: **Novelty, Urgency, Challenge, Routine, Interest, Passion, Collaboration, Exploration**. | Driver options are prepared |
| 2 | **Admin** | **Create timeline codes** | Define T0 Now (within 60 min), T1 Later today, T2 This week, T3 This month, T4 Months, T5 Long-term, T6 No deadline, TX Overdue, TR Recurring — each with an urgency weight and a step cap (T0: 1–3 steps; T1: 3–5). | Timeline options are prepared |
| 3 | **Admin** | **Create demand types** | Define how a demand is classified (first-time, time-bound, complex, familiar, interest, values, involves others, research, several demands, imposed by someone, long-avoided, switching, stopping, asking for help, recurring practice, reflective coursework, preparing for an event). | Demand types are prepared |
| 4 | **System** | **Validate configuration** | Check every timeline code has an urgency weight and step cap and every demand type maps to drivers. | Valid configuration is published; invalid is returned |
| 5 | **Admin** | **Correct invalid configuration** | Fix missing or inconsistent values. | Updated configuration is validated again |
| 6 | **Customer** | **State a demand** | Describe one or more tasks or activities (S12). Toggle 'I've been putting this off' if relevant. | Demand list is recorded |
| 7 | **System** | **Narrow several demands** | **Key process:** if more than one demand, Dump the list → show the top 3 by deadline/effort → customer picks ONE; the rest are parked, not lost. | One demand proceeds |
| 8 | **Customer** | **Set the timeline** | Choose a plain-words time horizon (Now … No deadline, Overdue, Recurring). | Timeline code is recorded |
| 9 | **System** | **Derive urgency and step cap** | Convert the timeline code into an urgency weight and a maximum number of steps. | Urgency and step cap are set |
| 10 | **System** | **Tag NUCRIPCE drivers** | Detect which drivers the demand carries (e.g. a presentation in 5 hours = Urgency + Collaboration + Challenge). | Driver tags are assigned |
| 11 | **System** | **Compute capacity–demand fit** | Compare the final band with the demand. **Key process:** Green — go; Yellow — light support first, never blocking; Amber — support first, demand capped to Routine; Red — demand deferred until a re-check improves. Overdue (TX) starts with a repair message, not catch-up. | Demand proceeds, is capped, or is deferred |
| 12 | **System** | **Present the demand action** | Show one action with a timeline-aware reason, often after a support step (e.g. 'Let's reduce the load first', then the breakdown auto-surfaces). | Customer chooses |
| 13 | **Customer** | **Break down the task** | Reduce the task to its smallest steps within the cap (S21). | Step sequence is produced |
| 14 | **Customer** | **Execute with support** | Work one step at a time (S22) with an optional timer and body double; pause, adapt or complete at any time. | Progress is recorded |
| 15 | **Body double** | **Accompany the session** | AI companion by default for T0/T1; a person can be invited when the timeline allows (T2+). | Starting feels easier |

# **Process 8 — Recommendation Orchestration**

*Combines support and/or demand output into one card the customer sees*

|  |  |
| :-: | :-: |
| **Goal** | Turn everything the engine has worked out into one clear, kind, low-burden card — never a menu — with a reason the customer can understand. |
| **Outcome** | One recommendation card (S13) showing the state name and icon, the traffic light, one primary action, up to two alternatives and a 'Because …' reason; any second step is queued, and the decision is logged with its pattern and rule version. |
| **Actors** | System |
| **Key processes** | Select the matching pattern (1–41) → order support before demand where needed → apply guards (Safety, rumination, meditation) → render the reason from an approved template → show the card → log. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **System** | **Select the pattern** | Choose the matching recommendation pattern from the rules (patterns 1–41), e.g. pattern 33 'Want to note what helped today?' (Reflect) or pattern 36 'Want to settle in before you go?' (Meditate). | Pattern ID is selected |
| 2 | **System** | **Combine the layers** | Assemble support and/or demand output into ONE primary action plus at most two alternatives. | A single recommendation is produced |
| 3 | **System** | **Sequence a two-part recommendation** | Where support and a demand both exist, offer support first; the demand surfaces only after the support step and re-check. | Ordered sequence is queued |
| 4 | **System** | **Apply guards** | **Key process:** Safety override first (any risk language → Help/SOS); then the rumination guard (pattern 40) and meditation guard (pattern 41); the entitlement filter runs next; after 3 declines in a session, stop suggesting (pattern 30). | Unsafe or unwanted suggestions are removed |
| 5 | **System** | **Apply the entitlement filter** | **Key process:** keep the primary within the customer's plan (ENT-1). If the best fit is an Advanced tool and the customer is on Free, use the best free tool in the same pathway and, in Green/Yellow/Blue only, add the Advanced tool as one labelled alternative. In Amber/Red use safety-floor tools only — no Advanced tiles (ENT-3). | Card contains only actions the customer can open, plus at most one labelled Advanced option |
| 6 | **System** | **Render the reason** | Fill the approved template: 'Because \\\<your state\\\> and \\\<what you're feeling\\\>, Nuccess suggests \\\<action\\\>. \\\<what comes next\\\>.' AI may rephrase only inside the template. | Reason is produced; this step never chooses the recommendation |
| 7 | **System** | **Show the card** | Display state name and icon, traffic light, one action, alternatives and the reason. Never show the grid, cell IDs, band names, 'intervention' or 'NUCRIPCE'. | Card is displayed |
| 8 | **System** | **Log the decision** | Record pattern_id, CTA, alternatives, gate results, rule_version and model_version. | Decision is auditable |

# **Process 9 — Action, Feedback, Recovery & Learning**

*Closes the loop after a recommendation is shown*

|  |  |
| :-: | :-: |
| **Goal** | Find out whether the support helped, recognise progress without piling demand back on, and learn — over time and only from permitted data — which options work best for this customer. |
| **Outcome** | The outcome is logged; if a re-check improved after support, the Blue Recovery light shows and gentle next steps resurface; if not, a different route is offered; personalisation improves without overriding the current state or safety. |
| **Actors** | Customer, System |
| **Key processes** | Customer accepts, changes or declines → feedback (helped? effort?) → optional re-check → Blue Recovery or a different route → queued step resurfaces → optional Reflect or Meditate → progress and personalisation. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Customer** | **Accept, change or decline** | Start the action, pick an alternative, or say 'Not now'. | Outcome is logged; declining is never penalised |
| 2 | **Customer** | **Give feedback** | Say whether it helped (yes / a bit / no) and how much effort it took (S30). | Feedback is recorded |
| 3 | **Customer** | **Re-check** | Optionally re-run the check-in after the action. | Post-action state is recorded (returns to Process 3) |
| 4 | **System** | **Show Blue Recovery (if improved)** | **Key process:** if the light was Yellow, Amber or Red, support was completed and the re-check improved (better cell, or intensity down by 2+), show Blue for the recovery window (default 45 min). Demand stays gentle; the band rises at most one step per re-check. | Customer sees progress without being pushed |
| 5 | **System** | **Offer a different route (if not improved)** | If the re-check is the same or worse, keep the light, offer a different pathway rather than repeating the one that didn't help; make Support visible in Red. | Honest feedback; no false reassurance |
| 6 | **System** | **Surface the queued step** | Release the second half of a sequenced recommendation (e.g. the task breakdown after Regulate). | Loop returns to Process 8 |
| 7 | **System** | **Offer Reflect or Meditate (optional)** | In Blue or Green, offer 'Note what helped' (Reflect) or quiet time (Meditate) as alternatives — never as the main suggestion after a hard moment. | Customer may capture what helped |
| 8 | **Customer** | **Correct the system** | Reject or amend what the system concluded (state, tags, suggestions). | Correction always outranks the system's inference |
| 9 | **Customer** | **Review progress** | View trends in state, pathways used, what helped, and tasks completed (S33). | Customer understands their own patterns |
| 10 | **System** | **Personalise** | Use only validated, repeated, permitted outcomes to re-order alternatives over time. | Personalisation never overrides safety rules or bands |

# **Process 10 — Safety Escalation**

*Runs continuously, independent of which other process is active*

|  |  |
| :-: | :-: |
| **Goal** | Make sure nobody in crisis is handled by an ordinary recommendation, and that persistent difficulty is met with a clear, respectful route to human support. |
| **Outcome** | Immediate-risk input always opens the support screen with fixed, clinically reviewed copy; sustained very-low states trigger a gentle prompt to institutional or professional support; every support event is logged and declining is respected. |
| **Actors** | System, Customer, Services |
| **Key processes** | Watch every screen for risk input → immediate risk: pause everything and show the support screen → sustained Very Constrained state: prompt support routes in week 1, then professional help and crisis routes → customer chooses → services take over. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **System** | **Watch for immediate risk** | On every screen, watch the 'I need help now' button and any free text (including Reflect and Dump) using a high-recall classifier that only flags — it never replies or decides. | Risk flag is set when triggered |
| 2 | **System** | **Open the support screen** | **Key process:** pause all other layers and show Help/SOS (S31) with fixed copy: 999 if in immediate danger, NHS 111 mental health option, Samaritans 116 123, Shout 85258, and the saved trusted contact. Breathe may stay available in the background, never instead of support. Meditate and Reflect never replace this screen. | Support routes are shown; never hidden or demoted |
| 3 | **System** | **Monitor sustained low states** | Watch for a Very Constrained state sustained 7+ days, or 14+ days without improvement from support pathways. | Escalation flag is set |
| 4 | **System** | **Surface institutional support** | Within the first week, offer GP, institution, local authority or self-referral routes — never framed as a diagnosis. | Support routes are presented |
| 5 | **System** | **Escalate to professional and crisis routes** | After one to two weeks without improvement, prompt professional help and show crisis routes. | Crisis routes are visible |
| 6 | **Customer** | **Choose a support route** | Select a route, contact a trusted person, or decline. | Support event is logged; declining is not penalised |
| 7 | **Services** | **Receive the contact** | Take the contact through the chosen route. | Support continues outside the system |
| 8 | **System** | **Follow-up after a crisis** | Do not show Blue Recovery automatically after a safety override; follow the clinical pathway set by the Clinical Safety Director (rule RC-5). | Recovery after crisis is human-led |

# **Process 11 — Plans, Subscription & Advanced Tools**

*Admin sets plans and tiers → customer chooses a plan when ready → System manages entitlement fairly*

|  |  |
| :-: | :-: |
| **Goal** | Fund Nuccess sustainably by offering Advanced tools in every pathway, while keeping support free for anyone who needs it and never selling to someone under strain. |
| **Outcome** | Customers who want more depth can buy NUCCESS Plus (or receive it through an institution licence); free customers keep full access to free tools and the safety floor; nobody sees an upgrade prompt in Amber, Red or during distress; billing is honest, cancellable and auditable. |
| **Actors** | Admin, Clinical Safety Director, Customer, System, Payment provider, Institution |
| **Key processes** | Configure plans and tool tiers (with safety approval) → publish → customer meets an Advanced tile only when steady → views Plans (S41) → buys through the app store or web payment provider → entitlement unlocks Advanced tools → renew, cancel, lapse or institution licence handled without losing data. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Admin** | **Define plans** | Create Free, NUCCESS Plus (monthly and annual), Plus concession and Institution licence. Enter prices, trial length and concession eligibility as configuration (set in the financial plan; never hard-coded). | Plans are drafted |
| 2 | **Admin** | **Assign tool tiers** | Mark each tool in every pathway as Free or Advanced using workbook Tab 6d. **Key process:** each pathway must keep free tools; safety-floor tools cannot be marked Advanced. | Tier list is drafted |
| 3 | **Clinical Safety Director** | **Approve safety-relevant tiers** | Review any tier change touching Regulate, Connect, communication cards or the safety floor (ENT-9). | Tiers are approved or returned |
| 4 | **System** | **Validate and publish** | Check ENT-1 (free tool in every pathway for every light and context) and ENT-2 (safety items free); publish with a version. | Plans and tiers are live |
| 5 | **System** | **Decide when Advanced may appear** | **Key process:** show Advanced tiles only in Green, Yellow (Mild/Moderate) or Blue, never during a session, after a safety event or at High+ negative intensity; at most one Advanced alternative on the card; remember 'Not now' for the session (ENT-3). | Advanced options appear only when the customer is steady |
| 6 | **Customer** | **Explore Advanced tools** | Tap an Advanced tile or open Plans & Advanced Tools (S41) from Settings. See, in plain words, what is free and what Advanced adds in each pathway, the price and how to cancel. | Customer decides: Upgrade or Not now |
| 7 | **Customer** | **Buy NUCCESS Plus** | Confirm the plan through the app store or the web payment provider. Adults only; under-18s can only receive Plus through an approved institution licence (ENT-8). | Payment request is sent |
| 8 | **Payment provider** | **Process payment** | Take payment and return a receipt and subscription status to Nuccess. Card details stay with the provider. | Status is returned |
| 9 | **System** | **Grant entitlement** | Set the plan to active (or trial), unlock Advanced tools across all eight pathways, record a billing event and confirm calmly. | Advanced tools are available |
| 10 | **Institution** | **Provide an institution licence** | Purchase seats or a site licence; covered users who join through the institution receive Plus. **Key process:** paying gives the institution no extra access to individual data (ENT-7). | Covered users are entitled |
| 11 | **System** | **Handle renewal, cancellation and lapse** | Renew automatically unless cancelled; cancel in two taps; after a failed payment, keep a grace period, then lapse. **Key process:** on lapse, Advanced tools lock, but every reflection, dump, practice and report the customer created stays readable and exportable (ENT-6). | Customer keeps their data and free tools |
| 12 | **System** | **Report and audit** | Log billing events; show Admin aggregate free, trial, paid and institution counts and conversion by pathway; monitor that no upgrade prompts were shown in Amber/Red. | Revenue and fairness are measurable |

# **Process 12 — Governance, Consent & R\&D**

*Consent governs what every other process may record or expose*

|  |  |
| :-: | :-: |
| **Goal** | Keep the customer in control of their data, make every recommendation traceable, and let institutions and the R&D team learn only from what customers have agreed to share. |
| **Outcome** | Consent records govern every write and share; every material decision is auditable to a rule and model version; institutions see only consented, aggregate or consent-scoped views; reflections and personal practices stay private unless the customer chooses otherwise. |
| **Actors** | Customer, System, Institution |
| **Key processes** | Customer sets consent and sharing → system logs decisions with versions → institutions see consented aggregates only → consented, versioned data feeds R&D. |

  

|  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: |
| **Order** | **Actor** | **Activity** | **Description (key process in bold)** | **Outcome / Next Activity** |
| 1 | **Customer** | **Manage consent and data** | Set sharing scope per data use; export or delete data (S36). | Consent record is updated; it governs everything the system may record |
| 2 | **System** | **Protect private records** | Keep reflection entries, Dump content and personal practices (rituals, prayers) private by default and out of institutional and admin views. | Sensitive personal content stays private |
| 3 | **System** | **Log the decision** | Record every material recommendation against its pattern, gate results, rule_version and model_version. | Audit record is created |
| 4 | **Institution** | **View consented aggregates** | See role-gated, consent-scoped analytics (S38) with a minimum cohort size; a consented user summary only for users who opted in (S39). | Individual data is never shown without consent |
| 5 | **System** | **Feed R&D** | Pass versioned, consented outcome data (e.g. did Reflect or Meditate help, by band and context) to the evidence base, separate from operational analytics. | Rules improve without overriding the customer's current state
