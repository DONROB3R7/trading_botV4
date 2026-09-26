# WEEX Bot Lab — V4 React

## IMPORTANT — CHAT HANDOFF

This README is also the **project memory / handoff document**.

If a new ChatGPT conversation is started, paste this README into the chat and say:

> **"Continue WEEX Bot Lab from this README. Caveman Turbo mode. Continue from CURRENT STATUS."**

Do NOT redesign the architecture unless explicitly requested.

---

# 1. Project

Project:

`trading_bot_v4_react`

Location:

text
D:\Trading Bots\trading_bot_v4_react


Stack:

* Frontend: React + Vite
* Backend: Node.js + Express
* Exchange: WEEX
* Backend port: `3001`
* Frontend: Vite
* Execution: existing WEEX execution modules
* Chart: Lightweight Charts

User development style:

**CAVEMAN TURBO**

Meaning:

* Give complete files when changing a file.
* Prefer copy/paste-ready code.
* Change one thing at a time.
* Test after each change.
* Do not rewrite unrelated working code.
* Do not introduce unnecessary abstractions.
* Explain briefly.
* Keep existing working execution logic untouched unless explicitly requested.

---

# 2. CURRENT ARCHITECTURE

The important design decision:

text
ENTRY MODEL
     |
     | FINAL SIGNAL
     v
BOT
     |
     | checks
     |
     +---- Trigger
     +---- Pyramid
     +---- Bot Status
     +---- Entry Rules
     |
     v
EXECUTION
     |
     v
WEEX


The system is intentionally separated.

## Entry Model

The Entry Model answers:

> "Should this bot receive an entry signal?"

It does NOT directly contain WEEX execution logic.

Examples:

text
Orderbook Model
Price Model
EMA Model
RSI Model
Future Models


All models can eventually produce the same type of signal:

text
LONG
SHORT
NEUTRAL


---

# 3. BOT

The Bot answers:

> "Am I allowed to enter?"

The bot is responsible for:

* Bot status
* Trigger Line
* Trigger state
* Pyramid limits
* Direction
* Position state
* Entry protection
* Execution
* TP/SL lifecycle
* Closing
* Existing WEEX logic

The bot should remain the central authority for whether an entry is allowed.

---

# 4. CHARTBOT

File:

text
frontend/src/pages/ChartBot.jsx


ChartBot is the bot control / monitoring page.

It currently contains:

* Bot selector
* Price chart
* Entry markers
* Bot status
* Trigger information
* Pyramid information
* ENTER button
* CLOSE button

## IMPORTANT

The ENTER button stays.

It is useful for manual testing.

The button uses:

js
enterBot(selectedBot.id)


This allows us to manually test the bot independently from Entry Models.

Example:

text
Trigger = NEUTRAL
        |
        v
ENTER
        |
        v
BLOCKED


Then:

text
Trigger = ARMED
        |
        v
ENTER
        |
        v
Entry


Then pyramid:

text
Pyramid 0/2
    |
    v
ENTER
    |
    v
1/2
    |
    v
ENTER
    |
    v
2/2
    |
    v
ENTER
    |
    v
BLOCKED — PYRAMID FULL


This is an important testing tool.

---

# 5. ENTRY MODEL

Frontend:

text
frontend/src/pages/EntryModel.jsx


Backend:

text
backend/entry-models/orderbookEntryModel.js
backend/routes/entryModels.js


Current Entry Model is an **Orderbook Entry Model**.

It currently does NOT directly execute trades.

---

# 6. ORDERBOOK ENTRY MODEL

Current WEEX orderbook design:

text
Request ONE 200-level snapshot
        |
        v
Same snapshot
        |
        +---- depth 15
        +---- depth 20
        +---- depth 30
        +---- depth 60


Important:

**Do NOT make four separate API requests.**

One 200-level snapshot is taken and split locally.

---

# 7. ORDERBOOK RULES

Current constants:

js
WEEX_REQUEST_DEPTH = 200

CONFIRMATION_DEPTHS = [15, 20, 30, 60]

REQUIRED_CONFIRMATIONS = 3

LONG_MIN_IMBALANCE = 0.005

SHORT_MAX_IMBALANCE = -0.005

MIN_BID_ASK_RATIO = 0.90

MIN_ASK_BID_RATIO = 0.90


Imbalance:

text
(bidLiquidity - askLiquidity)
/
(bidLiquidity + askLiquidity)


LONG depth condition:

text
imbalance >= 0.005
AND
bid/ask >= 0.90


SHORT depth condition:

text
imbalance <= -0.005
AND
ask/bid >= 0.90


---

# 8. BOT DIRECTION IS THE TREND

The bot direction is fixed.

Example:

text
Bot = LONG


The Entry Model looks for an orderbook pullback:

text
Bot direction = LONG
Opposite orderbook direction = SHORT


If 3 of 4 depths confirm SHORT:

text
Entry Model decision = LONG


For a SHORT bot:

text
Bot direction = SHORT
Opposite orderbook direction = LONG


If 3 of 4 depths confirm LONG:

text
Entry Model decision = SHORT


Otherwise:

text
NEUTRAL


NEUTRAL is expected and is NOT a competing trading direction.

---

# 9. ENTRY MODEL CYCLE

The model scans every:

text
1 minute


Each scan:

text
ONE 200-level orderbook snapshot


The snapshot is evaluated at:

text
15
20
30
60


A scan produces:

text
LONG
SHORT
NEUTRAL


The model stores every scan.

---

# 10. 10-MINUTE FINAL DECISION

One cycle contains:

text
10 scans


At the end:

text
6/10 or more confirmations
        |
        v
Bot direction


Otherwise:

text
NEUTRAL


Example LONG bot:

text
1  NEUTRAL
2  LONG
3  LONG
4  NEUTRAL
5  LONG
6  LONG
7  NEUTRAL
8  LONG
9  LONG
10 NEUTRAL

LONG = 6/10

FINAL = LONG


After completion:

text
Current Cycle
      |
      v
Previous Cycles
      |
      v
New Current Cycle


The cycle continues indefinitely while the bot remains ARMED.

---

# 11. TRIGGER LINE

Current trigger behavior:

## Trigger disabled

Bot starts:

text
ARMED


The Entry Model can scan immediately.

## Trigger enabled

Bot starts:

text
NEUTRAL


until the trigger price is touched/crossed.

After trigger activation:

text
NEUTRAL
   |
   | trigger touched
   v
ARMED


Once ARMED, it stays ARMED unless the bot lifecycle changes it.

---

# 12. IMPORTANT TRIGGER RULE

Trigger Line is a **bot-level protection**.

The Entry Model does not need to duplicate trigger logic.

The bot remains responsible for deciding whether entry is allowed.

This prevents different Entry Models from implementing different versions of trigger protection.

---

# 13. PYRAMID

Pyramid belongs to the bot.

Example:

text
pyramidMax = 2


Positions:

text
0/2
1/2
2/2


At:

text
2/2


another entry must be blocked.

Entry Models should not duplicate pyramid logic.

They simply send a signal.

The bot decides whether the signal can become an entry.

---

# 14. SIGNAL FLOW

The intended final architecture is:

text
                    ENTRY MODELS
                         |
          +--------------+--------------+
          |              |              |
      Orderbook        Price          EMA
          |              |              |
          +--------------+--------------+
                         |
                    FINAL SIGNAL
                         |
                    LONG / SHORT
                         |
                         v
                     SELECTED BOT
                         |
              +----------+----------+
              |          |          |
           Trigger    Pyramid     Status
              |          |          |
              +----------+----------+
                         |
                         v
                    enterBot(botId)
                         |
                         v
                    EXISTING BOT
                      EXECUTION
                         |
                         v
                        WEEX


---

# 15. IMPORTANT DESIGN RULE

Do NOT build separate execution systems for each Entry Model.

Bad:

text
Orderbook Model
   -> own WEEX execution

Price Model
   -> own WEEX execution

EMA Model
   -> own WEEX execution


Correct:

text
Orderbook Model
   \
Price Model ----> Bot ----> Execution ----> WEEX
   /
EMA Model


This keeps execution centralized.

---

# 16. WHY CHARTBOT AND ENTRY MODEL ARE SEPARATE

Original idea was approximately:

text
Chart
 |
 +-- Orderbook
 +-- Entry Model
 +-- Trigger
 +-- Pyramid
 +-- Execution
 +-- everything


That can work initially, but becomes difficult when more models are added.

Future:

text
Orderbook
Price
EMA
RSI
Breakout
Volume


Putting all of these into ChartBot would make ChartBot increasingly large and difficult to maintain.

Instead:

text
ChartBot
    |
    +-- monitor/control bot

Entry Models
    |
    +-- generate signals


This keeps responsibilities clear.

---

# 17. CURRENT BACKEND STRUCTURE

text
backend/
│
├── server.js
│
├── routes/
│   ├── bots.js
│   └── entryModels.js
│
├── entry-models/
│   └── orderbookEntryModel.js
│
└── test-entry-model.js


Main execution remains outside this Entry Model module.

---

# 18. CURRENT EXECUTION STRUCTURE

text
execution/
├── account.js
├── orders.js
├── positions.js
└── weexClient.js


Config:

text
config/
└── weex.js


Market:

text
market/
└── marketData.js


DO NOT rewrite these unless specifically required.

The execution system is already working.

---

# 19. FRONTEND STRUCTURE

text
frontend/
└── src/
    ├── api.js
    ├── App.jsx
    │
    └── pages/
        ├── ChartBot.jsx
        ├── EntryModel.jsx
        └── EntryModel.css


Important API functions include:

js
getBots()
getChart()
enterBot(botId)
closeBot(botId)
pauseBot(botId)
resumeBot(botId)
deleteBot(botId)

scanEntryModel(
  symbol,
  botDirection,
  triggerState
)


Do NOT replace `api.js` wholesale unless specifically requested.

---

# 20. CURRENT ENTRY MODEL API

Route:

text
POST /api/entry-models/orderbook/scan


Input:

json
{
  "symbol": "POLUSDT",
  "botDirection": "LONG",
  "triggerState": "ARMED"
}


If the bot is not ARMED:

json
{
  "scanned": false,
  "reason": "BOT_NOT_ARMED"
}


If ARMED:

text
one WEEX orderbook request
        |
        v
orderbook model
        |
        v
result


Current Entry Model is still configured as:

text
tradingEnabled = false


It does not trade directly.

---

# 21. NEXT MAJOR STEP

The next architectural step is:

text
Entry Model FINAL SIGNAL
          |
          v
selected bot
          |
          v
existing enterBot(botId)


Before enabling real automatic execution, test the signal connection in DRY RUN mode.

Expected log:

text
[Entry Model] FINAL SIGNAL | POLUSDT | LONG | 7/10
[Entry Model] Sending signal -> botId=...
[Bot] Signal received -> POLUSDT LONG


Only after this is confirmed should actual automatic entry be enabled.

---

# 22. IMPORTANT SAFETY RULE FOR AUTOMATIC SIGNALS

Entry Model should NOT bypass:

* Trigger
* Bot status
* Pyramid limit
* Position state
* Existing bot protections

The safest architecture is:

text
Entry Model says:

"I have a LONG signal."

Bot says:

"Am I allowed to enter LONG?"

Execution says:

"Execute the approved entry."


---

# 23. CURRENT TEST BOT

Current testing symbol:

text
POLUSDT


Current successful test history includes:

text
POLUSDT LONG


with existing:

* WEEX execution
* pyramid handling
* TP/SL lifecycle
* trigger handling

Do not break the existing execution path while developing Entry Models.

---

# 24. TESTING PHILOSOPHY

Always test in this order:

### Test 1 — Manual bot

Use ChartBot ENTER button.

Verify:

text
Trigger
Pyramid
Status
Entry


### Test 2 — Entry Model

Run Entry Model without execution.

Verify:

text
1-minute scans
10-minute cycle
6/10 rule
Previous cycles
LONG/SHORT/NEUTRAL


### Test 3 — Signal connection

Use:

text
Entry Model
   |
   v
Bot


but initially DRY RUN.

### Test 4 — Automatic entry

Only after the above works:

text
Entry Model
   |
   v
Bot
   |
   v
enterBot()
   |
   v
WEEX


---

# 25. CURRENT STATUS

## Working

* V4 React project
* Node/Express backend
* WEEX client
* Account
* Positions
* Orders
* Bot creation
* Bot selection
* Manual bot entry
* Manual close
* Trigger Line
* Trigger state
* Pyramid
* TP/SL lifecycle
* ChartBot
* Entry Model page
* Orderbook Entry Model
* 200-level snapshot
* 15/20/30/60 confirmation depths
* 3-of-4 depth rule
* 1-minute scanning
* 10-scan cycles
* Previous Cycles
* Entry Model chart markers

## Not yet connected

text
Entry Model FINAL SIGNAL
        ↓
       Bot


Automatic Entry Model execution is NOT enabled yet.

---

# 26. LAST KNOWN ARCHITECTURAL DECISION

The user originally considered putting everything inside ChartBot:

text
Chart
Orderbook
Entry Model
Trigger
Pyramid
Execution


Decision:

**Do NOT merge everything into ChartBot.**

Keep:

text
ChartBot = Bot control + monitoring

Entry Model = Signal generation

Bot = Entry permission + bot rules

Execution = WEEX execution


This is the current architecture.

---

# 27. FUTURE ENTRY MODELS

Possible future structure:

text
backend/entry-models/

orderbookEntryModel.js
priceEntryModel.js
emaEntryModel.js
rsiEntryModel.js
breakoutEntryModel.js


All produce a common signal concept:

text
LONG
SHORT
NEUTRAL


The bot does not care which model generated the signal.

---

# 28. FUTURE COMBINED MODEL

Eventually we may have:

text
Orderbook ----\
Price ---------\
EMA ------------> Combined Entry Model ---> Bot
RSI -----------/
Volume --------/


But do NOT build this yet.

First make one model work correctly end-to-end.

---

# 29. DEVELOPMENT RULE

When starting a new ChatGPT conversation:

1. Paste this README.
2. Tell ChatGPT the exact thing to continue.
3. If code was changed after this README was updated, paste the latest file too.
4. Do not assume old code that is not included in the current conversation is unchanged.

Recommended message:

text
Continue WEEX Bot Lab from this README.

Caveman Turbo mode.

Current task:
[WRITE TASK HERE]

Do not redesign the architecture.
Do not touch working execution code unless required.
Give me the complete file when changing a file.
One change at a time.


---

# 30. GOLDEN RULE

Keep the system simple:

text
MODEL
  ↓
SIGNAL
  ↓
BOT
  ↓
EXECUTION
  ↓
WEEX


Do not make every component know everything about every other component.

**One job per layer.**
