# WEEX BOT LAB v4 REACT — QUICK MASTER README

PROJECT:
D:\Trading Bots\trading_bot_v4_react

STACK:
React + Node.js + Express + WEEX USDT-M Futures + Lightweight Charts

BACKEND:
http://localhost:3001


============================================================
1. CORE ARCHITECTURE
============================================================

React UI
   ↓
Express API
   ↓
Bot Routes
   ↓
Entry Model / Trade Cycle / Lifecycle
   ↓
Execution
   ↓
WEEX

IMPORTANT:

React = UI only.
Backend = trading logic/state.
WEEX = source of truth for live positions.


============================================================
2. MAIN FILES
============================================================

backend/
├── server.js
├── routes/
│   └── bots.js
├── entry-models/
│   └── entryModelEngine.js
├── cycle/
│   └── tradeCycleManager.js
├── lifecycle/
│   └── tradeLifecycle.js
├── execution/
│   ├── orders.js
│   ├── positions.js
│   ├── account.js
│   └── weexClient.js
└── market/
    └── marketData.js

frontend/src/
├── api.js
└── pages/
    ├── BotManagement.jsx
    ├── EntryModel.jsx
    └── EntryModel.css


============================================================
3. FILE RESPONSIBILITIES
============================================================

server.js
→ Express startup / route mounting.

routes/bots.js
→ Bot controller/API.
→ Create/delete/enter/close/pause/resume.
→ Entry Model start/stop.
→ Coordinates lifecycle and execution.

entryModelEngine.js
→ Entry Model state.
→ Scans.
→ Voting.
→ LONG/SHORT/NEUTRAL.
→ Cycle completion.

tradeCycleManager.js
→ Entry Model cycle state.
→ One cycle per bot.

tradeLifecycle.js
→ Watches real WEEX position.
→ Detects position flat.
→ Gets closing fills.
→ Calculates final P/L.
→ Profit/loss/zero handling.

orders.js
→ WEEX order execution.
→ TP/SL.
→ User trades.

positions.js
→ Live WEEX position.

weexClient.js
→ WEEX API/auth/signing.

marketData.js
→ Candles/ticker/market data.

api.js
→ Frontend API wrappers.

BotManagement.jsx
→ Bot controls/UI.

EntryModel.jsx
→ Entry Model display/chart/UI only.


============================================================
4. ENTRY MODEL
============================================================

Current settings:

CYCLE_SIZE = 10

SCAN_INTERVAL_MS = 60 * 1000

Required votes:

Math.ceil(10 * 0.60) = 6

Therefore:

6+ LONG → LONG
6+ SHORT → SHORT
otherwise → NEUTRAL

One scan every 60 seconds.

10 scans = one completed Entry Model cycle.


ENTRY MODEL FLOW:

START
→ scan 1
→ scan 2
→ ...
→ scan 10
→ vote
→ LONG / SHORT / NEUTRAL
→ reset cycle
→ continue next cycle


IMPORTANT:

Entry Model continues running after an entry.

DO NOT stop Entry Model automatically after Entry #1.


============================================================
5. ENTRY MODEL ENGINE
============================================================

Engine is server-side.

React must NOT own:

- scan state
- votes
- decisions
- timers
- trading lifecycle

Engine supports independent state per bot.

startEngine(bot)
→ running = true
→ immediate scan
→ schedule next scan

stopEngine(bot.id)
→ running = false
→ clear timer

Avoid duplicate timers/engines.

Async scans must not overlap or mutate stopped engines incorrectly.


============================================================
6. ENTRY MODEL → ENTRY
============================================================

Entry Model decides:

LONG / SHORT

Then normal bot ENTER flow handles execution.

Conceptually:

Entry Model
→ decision
→ masterBotBridge.enterBot(botId)
→ bots.js ENTER
→ orders.openTestPosition()
→ record trade
→ increment position count
→ lifecycle if first entry
→ TP/SL


Entry Model should NOT directly own exchange order execution.


============================================================
7. PYRAMID
============================================================

Current supported:

minimum = 1
maximum = 3

Example:

maxPositions = 3

Entry #1 → allowed
Entry #2 → allowed
Entry #3 → allowed
Entry #4 → rejected

Position count:

currentPositionCount


IMPORTANT:

One trading cycle can contain up to 3 entries.

Pyramid entries are NOT separate lifecycles.


============================================================
8. TRADE LIFECYCLE
============================================================

File:

backend/lifecycle/tradeLifecycle.js

Polling:

30 seconds


FLOW:

Entry #1
→ lifecycle START
→ check WEEX
→ position detected
→ continue checking
→ WEEX position becomes FLAT
→ get user trades
→ identify close fills
→ calculate final P/L
→ profit/loss/zero


IMPORTANT:

Lifecycle must first SEE an active position.

Do not finalize just because initial position check returns zero.


============================================================
9. PYRAMID + LIFECYCLE
============================================================

ONLY Entry #1 starts lifecycle.

Entry #1:
→ lifecycle starts

Entry #2:
→ same lifecycle

Entry #3:
→ same lifecycle

WEEX becomes flat:
→ one final P/L calculation


DO NOT create one lifecycle per pyramid entry.


============================================================
10. POSITION QUANTITY FIELDS
============================================================

Lifecycle checks possible WEEX quantity fields:

total
positionAmt
qty
quantity
size
positionSize
holdVol

Do not remove these without checking actual WEEX responses.


============================================================
11. FINAL P/L
============================================================

After WEEX becomes flat:

orders.getUserTrades(...)

Relevant closing sides:

LONG → SELL
SHORT → BUY

Sum realizedPnl from relevant closing fills.

Supports multiple fills and pyramid trades.


============================================================
12. FINAL P/L BEHAVIOR
============================================================

PROFIT:

P/L > 0

→ lifecycle stops
→ reset position state
→ reset trade state
→ bot ACTIVE
→ restart Entry Model


LOSS:

P/L < 0

→ lifecycle stops
→ bot KILLED
→ no automatic Entry Model restart


ZERO:

P/L = 0

→ lifecycle stops
→ reset position state
→ bot ACTIVE
→ no automatic Entry Model restart


============================================================
13. BOT STATUS
============================================================

Bot status:

ACTIVE
PAUSED
KILLED

Entry Model state:

RUNNING
STOPPED

Position state:

OPEN
FLAT

These are separate states.

Example:

Bot ACTIVE
+
Entry Model RUNNING
+
Position OPEN

is valid.


============================================================
14. CLOSE
============================================================

CLOSE:

→ close WEEX position
→ cancel relevant TP/SL if required
→ lifecycle detects actual WEEX FLAT
→ lifecycle calculates final P/L

Do NOT assume a successful close request means the exchange is already flat.


============================================================
15. MANUAL ENTRY MODEL START
============================================================

API:

POST /api/bots/:id/entry-model/start

STOP:

POST /api/bots/:id/entry-model/stop

Current design:

manual START while a position is already open
→ blocked.

BUT:

This does NOT mean a running Entry Model should stop after an entry.


============================================================
16. TP/SL
============================================================

Bot tracks:

firstEntryPrice
averageEntryPrice
originalStopLoss
currentTakeProfit
currentTpOrderId

Current TP/SL sync delay:

30 seconds

Additional pyramid entries can update TP based on average entry.

Do not casually change TP/SL while fixing unrelated features.


============================================================
17. ORDER SIZING
============================================================

Current testing configuration approximately:

Margin:
1 USDT

Leverage:
10x

Target notional:
10 USDT

Margin:
ISOLATED

General quantity concept:

targetNotional / markPrice

then round to symbol quantity step.

Example POL:

price ≈ 0.1184

10 / 0.1184 ≈ 84.45

step 10
→ quantity 90

Do not reintroduce contractVal unless verified against actual WEEX behavior.


============================================================
18. IMPORTANT EXECUTION RULE
============================================================

If task is about:

Entry Model
Lifecycle
Chart
Bot Management
Cycle Manager

DO NOT casually change:

- leverage
- margin
- quantity sizing
- authentication
- symbol discovery
- WEEX signing


Protect working execution code.


============================================================
19. ENTRY MODEL FRONTEND
============================================================

EntryModel.jsx is display/UI.

It currently:

- loads bots
- loads chart
- polls engine state
- displays current cycle
- displays previous cycles
- displays markers

Engine polling:

~3 seconds

Chart refresh:

~60 seconds

Actual Entry Model scan:

60 seconds


============================================================
20. PREVIOUS CYCLES
============================================================

Completed cycle timestamp:

completedAt

NOT:

timestamp

Previous cycles sort:

newest completedAt first.


Example:

new Date(cycle.completedAt)


Votes display:

x / 10


============================================================
21. CHART MARKERS
============================================================

Markers use SERVER DATA ONLY.

Decision:

cycle.decision

Time:

cycle.completedAt

LONG:

green arrow up
below candle

SHORT:

red arrow down
above candle

NEUTRAL:

no marker

Marker is snapped to nearest 15m candle.

Lightweight Charts requires Unix seconds.

If completedAt is milliseconds:

1790511517955

convert to approximately:

1790511517


IMPORTANT:

Do NOT use cycle.timestamp.


============================================================
22. TRADE CYCLE VS ENTRY MODEL CYCLE
============================================================

ENTRY MODEL CYCLE:

10 scans
→ decision


TRADING CYCLE:

Entry #1
→ optional #2
→ optional #3
→ WEEX flat
→ final P/L


They are different.

One trading cycle can contain multiple Entry Model cycles.


============================================================
23. WEEX = LIVE TRUTH
============================================================

If internal bot state says:

OPEN

but WEEX says:

FLAT

WEEX must be investigated as the source of truth.

If UI says:

OPEN

but WEEX says:

FLAT

do not fix it by changing React state first.


============================================================
24. HISTORICAL V3 WARNING
============================================================

Older V3 project used things like:

server_v3.js
trading.js
weex/weex.js
filters/orderBook.js
TradingView webhooks

Current project is V4 React.

DO NOT automatically copy V3 architecture into V4.


Historical V3 orderbook system:

one fresh 200-level snapshot

evaluated at:

15
20
30
60

with:

3-of-4

CLOSE bypassed the filter.

For V4:

inspect actual current code before assuming these exact rules.


============================================================
25. DEBUGGING RULE
============================================================

When something breaks:

1. Read backend logs.
2. Read browser console.
3. Inspect actual API response.
4. Identify subsystem.
5. Inspect actual source file.
6. Make ONE change.
7. Test.
8. Read logs again.


Never guess an API field or function.


============================================================
26. COMMON BUGS
============================================================

BUG:

Entry Model stops after Entry #1.

CHECK:

bots.js
entryModelEngine.js

Look for accidental:

stopEngine()


BUG:

multiple lifecycle instances.

CHECK:

Only tradeNumber === 1 should start lifecycle.


BUG:

lifecycle finalizes immediately.

CHECK:

wasPositionSeen


BUG:

chart marker missing.

CHECK:

cycle.decision
cycle.completedAt
timestamp normalization
nearest candle


BUG:

UI says Entry Model STOPPED after refresh.

CHECK:

GET /api/bots response
then frontend field mapping.


BUG:

scans happen twice.

CHECK:

duplicate engine/timer.


BUG:

P/L is zero unexpectedly.

CHECK:

user trades
symbol
time range
closing side
realizedPnl


============================================================
27. TESTING STYLE
============================================================

CAVEMAN TURBO:

ONE CHANGE
→ ONE TEST
→ ONE RESULT


Preferred workflow:

1. Change one file.
2. Start backend.
3. Perform one test.
4. Read logs.
5. Verify result.
6. Continue.


Do NOT combine:

Entry Model
+
Lifecycle
+
TP/SL
+
Sizing
+
UI

into one uncontrolled change.


============================================================
28. LIVE TEST SAFETY
============================================================

Before live WEEX test:

[ ] correct account
[ ] correct symbol
[ ] correct direction
[ ] correct quantity
[ ] correct leverage
[ ] correct margin mode
[ ] correct pyramid max
[ ] no duplicate backend
[ ] no duplicate engine


Use the smallest practical test position.


============================================================
29. GIT CHECKPOINT
============================================================

Before meaningful changes:

cd "D:\Trading Bots\trading_bot_v4_react"

git status

git add .

git commit -m "Checkpoint before <change>"

git log -1 --oneline


============================================================
30. AI CODING RULES
============================================================

READ THIS README FIRST.

Then inspect the actual current source.

The actual source code is more authoritative than this README.

DO NOT INVENT:

- routes
- functions
- API fields
- WEEX endpoints
- response formats
- manager methods


If uncertain:

inspect the code or actual runtime response.


Preferred coding style:

- one change
- minimal modification
- preserve working architecture
- complete-file replacement when requested
- test immediately


============================================================
31. RESPONSIBILITY MAP
============================================================

ENTRY MODEL:

"What is the signal?"


TRADE CYCLE:

"Where are we in the Entry Model cycle?"


BOT ROUTE:

"Is this entry allowed?"


EXECUTION:

"How do we send the order?"


WEEX:

"What actually happened?"


LIFECYCLE:

"Is the complete trading position finished?"


REACT:

"How do we display/control it?"


============================================================
32. NON-NEGOTIABLE RULES
============================================================

1. Backend owns trading logic.

2. React does not own trading state.

3. WEEX is source of truth for live position.

4. Entry Model ≠ Trade Lifecycle.

5. One lifecycle per trading cycle.

6. Lifecycle starts on first entry only.

7. Lifecycle ends only after position was seen and becomes flat.

8. Final P/L comes from relevant closing fills.

9. Profit → ACTIVE + restart Entry Model.

10. Loss → KILLED + no automatic restart.

11. Zero → ACTIVE + no automatic restart.

12. Entry Model does not automatically stop after Entry #1.

13. Maximum pyramid = 3.

14. Do not calculate final P/L in React.

15. Do not casually modify working execution.

16. Do not mix V3 architecture into V4 without checking.

17. One change at a time.

18. Test after every change.

19. Inspect actual code before assuming behavior.

20. Source code > README.


============================================================
33. CURRENT PROJECT STATE
============================================================

Project:

WEEX Bot Lab v4 React

Path:

D:\Trading Bots\trading_bot_v4_react

Backend:

Node.js + Express

Frontend:

React

Exchange:

WEEX USDT-M Futures

Backend:

localhost:3001

Entry Model:

10 scans
60 sec/scan
6 votes required

Pyramid:

1–3

Lifecycle:

30 sec polling

Test sizing:

~1 USDT margin
10x
~10 USDT notional
ISOLATED


============================================================
34. QUICK MENTAL MODEL
============================================================

ENTRY MODEL:

START
→ 10 scans
→ 6+ votes
→ LONG/SHORT
→ ENTER
→ continue scanning


TRADING:

Entry #1
→ optional #2
→ optional #3
→ WEEX FLAT
→ final P/L


PROFIT:

ACTIVE
→ Entry Model restart


LOSS:

KILLED
→ stop


ZERO:

ACTIVE
→ no automatic restart


============================================================
35. CURRENT DEVELOPMENT STYLE
============================================================

CAVEMAN TURBO:

"ONE CHANGE."

"REPLACE THIS FILE."

"RUN SERVER."

"DO ONE TEST."

"SEND LOG."

Avoid unnecessary theory and unrelated refactoring.

============================================================
END
============================================================