# WEEX Bot Lab v4 React — Project README

## 1. PROJECT OVERVIEW

Project:

D:\Trading Bots\trading_bot_v4_react

This is a React + Node.js + Express trading bot laboratory for WEEX USDT-M futures.

The project is designed around one important rule:

> React is the UI.
> Backend owns trading state and trading decisions.
> WEEX is the source of truth for the real position.

The project currently contains:

- React frontend
- Node.js / Express backend
- WEEX API integration
- Entry Model engine
- Trade Cycle Manager
- Trade Lifecycle Manager
- Execution services
- Position service
- Order service
- Lightweight Charts
- Bot Management UI
- Entry Model UI

--------------------------------------------------
## 2. CURRENT ARCHITECTURE
--------------------------------------------------

High-level flow:

React UI
   ↓
Express API
   ↓
Bot Management / Entry Model API
   ↓
Entry Model Engine
   ↓
Trade Cycle Manager
   ↓
Execution
   ↓
WEEX

Trade lifecycle:

Entry Model decision
   ↓
ENTER
   ↓
WEEX position #1
   ↓
optional pyramid #2
   ↓
optional pyramid #3
   ↓
WEEX position becomes FLAT
   ↓
Trade Lifecycle calculates final P/L
   ↓
┌───────────────────────────────┐
│ Profit                        │
│ → reset bot position state    │
│ → ACTIVE                      │
│ → restart Entry Model         │
└───────────────────────────────┘

┌───────────────────────────────┐
│ Loss                          │
│ → reset/stop lifecycle        │
│ → KILLED                      │
│ → no automatic restart        │
└───────────────────────────────┘

┌───────────────────────────────┐
│ Zero P/L                      │
│ → reset position state        │
│ → ACTIVE                      │
│ → no automatic restart        │
└───────────────────────────────┘


--------------------------------------------------
## 3. PROJECT STRUCTURE
--------------------------------------------------

Current important structure:

trading_bot_v4_react/
│
├── backend/
│   ├── config/
│   │
│   ├── cycle/
│   │   └── tradeCycleManager.js
│   │
│   ├── entry-models/
│   │   └── entryModelEngine.js
│   │
│   ├── execution/
│   │   ├── account.js
│   │   ├── orders.js
│   │   ├── positions.js
│   │   └── weexClient.js
│   │
│   ├── lifecycle/
│   │   └── tradeLifecycle.js
│   │
│   ├── market/
│   │   └── marketData.js
│   │
│   ├── routes/
│   │   └── bots.js
│   │
│   └── server.js
│
├── frontend/
│   └── src/
│       ├── api.js
│       ├── pages/
│       │   ├── BotManagement.jsx
│       │   ├── EntryModel.jsx
│       │   └── EntryModel.css
│       │
│       └── ...
│
├── .env
├── package.json
└── README.md


IMPORTANT:

The exact project can evolve.

Before modifying anything, inspect the actual current file.

Do not assume that an old version of a file still exists or behaves the same way.


--------------------------------------------------
## 4. DEVELOPMENT STYLE — "CAVEMAN TURBO"
--------------------------------------------------

The preferred development workflow is:

1. One change at a time.
2. Give the complete file when replacing a file.
3. Avoid unrelated refactoring.
4. Start the backend.
5. Perform one test.
6. Read the logs.
7. Verify the result.
8. Only then make the next change.

The user prefers direct implementation instead of long theoretical explanations.

Preferred style:

"Change this file."

"Replace the whole file with this."

"Run the server."

"Do this one test."

"Send me the log."

Avoid:

- huge multi-file refactors
- changing architecture unnecessarily
- speculative fixes
- invented WEEX API behavior
- changing working code while fixing another feature
- mixing several unrelated changes into one test


--------------------------------------------------
## 5. GOLDEN ARCHITECTURE RULE
--------------------------------------------------

DO NOT move trading state into React.

React should:

- display information
- display charts
- display bot state
- allow user controls
- call backend APIs

React should NOT own:

- live trading state
- Entry Model calculations
- trade lifecycle state
- final P/L calculation
- WEEX position truth
- pyramid lifecycle state

Backend owns these things.


--------------------------------------------------
## 6. WEEX IS THE LIVE POSITION SOURCE OF TRUTH
--------------------------------------------------

For a real position:

WEEX position
    ↓
backend positions service
    ↓
Trade Lifecycle / Bot logic

Do not determine whether a position is really open only from React state.

The bot may have internal state, but WEEX must be checked when determining actual live position state.


--------------------------------------------------
## 7. BACKEND SERVER
--------------------------------------------------

File:

backend/server.js

Purpose:

Main Express server entry point.

Current backend runs on:

http://localhost:3001

server.js should remain relatively thin.

It should initialize the backend and mount the routes.

Do not turn server.js into the main trading engine.

Trading logic belongs in the appropriate modules.


--------------------------------------------------
## 8. BOT ROUTES
--------------------------------------------------

File:

backend/routes/bots.js

This is currently the main Bot Management API/controller.

It coordinates:

- bot creation
- bot deletion
- bot lookup
- ENTER
- CLOSE
- PAUSE
- RESUME
- Entry Model START
- Entry Model STOP
- pyramid limits
- trade records
- TP/SL synchronization
- Trade Lifecycle
- Entry Model Engine

Important:

bots.js is a controller/router.

It should NOT become a giant all-purpose trading engine.

When adding functionality, put logic in the correct subsystem whenever possible.


--------------------------------------------------
## 9. BOT STATE
--------------------------------------------------

A bot currently contains important state such as:

- id
- symbol
- direction
- status
- maxPositions
- currentPositionCount
- cycleId
- firstEntryPrice
- averageEntryPrice
- originalStopLoss
- currentTakeProfit
- currentTpOrderId
- trades

Typical bot status:

ACTIVE
PAUSED
KILLED

These are NOT the same thing as Entry Model state.

For example:

Bot:
ACTIVE

Entry Model:
RUNNING

is completely valid.


--------------------------------------------------
## 10. PYRAMID LIMIT
--------------------------------------------------

Current supported pyramid range:

minimum = 1
maximum = 3

The backend clamps the configured value:

1 <= pyramidPositions <= 3

Example:

Pyramid = 3

means one trading cycle can contain:

Entry #1
Entry #2
Entry #3

These are NOT three separate completed trading cycles.

They belong to the same trading lifecycle.

--------------------------------------------------
## 11. VERY IMPORTANT PYRAMID RULE
--------------------------------------------------

When Entry Model opens Entry #1:

DO NOT stop the Entry Model simply because a position opened.

The Entry Model can continue running while the trading position exists.

This is required because additional pyramid entries may be generated.

Example:

Entry Model running
   ↓
LONG decision
   ↓
Entry #1
   ↓
Entry Model CONTINUES
   ↓
Entry #2 if conditions allow
   ↓
Entry Model CONTINUES
   ↓
Entry #3 if conditions allow
   ↓
Position eventually closes
   ↓
Trade Lifecycle finishes the cycle

The Entry Model is therefore NOT:

START → ONE ENTRY → STOP

It is:

START → CONTINUOUS CYCLES

while the bot is allowed to operate.


--------------------------------------------------
## 12. CURRENT ENTRY MODEL SETTINGS
--------------------------------------------------

File:

backend/entry-models/entryModelEngine.js

Current cycle size:

CYCLE_SIZE = 10

Current scan interval:

SCAN_INTERVAL_MS = 60 * 1000

Therefore:

1 scan every 60 seconds.

A complete Entry Model cycle contains:

10 scans.


--------------------------------------------------
## 13. ENTRY MODEL VOTING
--------------------------------------------------

The current required vote percentage is:

60%

With 10 scans:

Math.ceil(10 × 0.60) = 6

Therefore:

6 or more LONG votes
    → LONG

6 or more SHORT votes
    → SHORT

Anything else
    → NEUTRAL


Example:

LONG = 7
SHORT = 2
NEUTRAL = 1

Decision:

LONG


Example:

LONG = 3
SHORT = 4
NEUTRAL = 3

Decision:

NEUTRAL


--------------------------------------------------
## 14. ENTRY MODEL ENGINE OWNERSHIP
--------------------------------------------------

The Entry Model Engine owns:

- running state
- scan timer
- current scan cycle
- orderbook scanning
- votes
- cycle completion
- LONG / SHORT / NEUTRAL decision

React does not calculate these things.

React reads them from the backend.

--------------------------------------------------
## 15. ENTRY MODEL START
--------------------------------------------------

Starting the Entry Model should:

1. set engine running = true
2. perform the first scan immediately
3. schedule future scans
4. continue until explicitly stopped

The engine should not automatically stop simply because an entry was executed.

--------------------------------------------------
## 16. ENTRY MODEL STOP
--------------------------------------------------

Stopping the Entry Model should:

- set running = false
- clear its timer
- stop future scans

It should not automatically close an existing WEEX position.

Stopping the Entry Model and closing a position are two different operations.


--------------------------------------------------
## 17. TRADE CYCLE MANAGER
--------------------------------------------------

File:

backend/cycle/tradeCycleManager.js

This is a singleton manager.

Current pattern:

const tradeCycleManager = new TradeCycleManager();

module.exports = tradeCycleManager;

Its responsibility is Entry Model cycle state.

It should maintain an independent cycle for each bot.

Do not accidentally instantiate multiple Trade Cycle Managers for the same system.


--------------------------------------------------
## 18. ENTRY MODEL CYCLE
--------------------------------------------------

Current Entry Model cycle:

Scan 1
Scan 2
Scan 3
Scan 4
Scan 5
Scan 6
Scan 7
Scan 8
Scan 9
Scan 10
   ↓
vote calculation
   ↓
LONG / SHORT / NEUTRAL
   ↓
new cycle begins

Current UI displays:

Scan count / 10


--------------------------------------------------
## 19. ENTRY MODEL DATA
--------------------------------------------------

A completed cycle currently looks approximately like:

{
  botDirection: "LONG",
  botDirectionVotes: 3,
  botId: "bot_...",
  completedAt: 1790511517955,
  cycleNumber: 1,
  decision: "NEUTRAL",
  percentage15: 51.67,
  percentage20: 42.61,
  percentage30: 41.2,
  percentage60: 40.51,
  scans: [...],
  symbol: "POLUSDT",
  totalScans: 10,
  trend15: "LONG",
  trend20: "SHORT",
  trend30: "SHORT",
  trend60: "LONG"
}

IMPORTANT:

The completed-cycle timestamp is:

completedAt

NOT:

timestamp


--------------------------------------------------
## 20. COMPLETED CYCLE TIMESTAMP
--------------------------------------------------

Backend example:

completedAt: 1790511517955

This is Unix milliseconds.

Frontend should use:

new Date(cycle.completedAt)

when displaying the local time.

For chart timestamps, normalize milliseconds to Unix seconds.

Never assume that completed cycles use a property called timestamp.

--------------------------------------------------
## 21. ENTRY MODEL FRONTEND
--------------------------------------------------

Main file:

frontend/src/pages/EntryModel.jsx

Purpose:

Display Entry Model information.

It currently:

- loads bots
- loads chart data
- loads Entry Model engine state
- displays current cycle
- displays previous cycles
- displays scan count
- displays trend information
- displays signal markers
- updates the chart

It should NOT:

- calculate votes
- calculate Entry Model decisions
- own the trading cycle
- decide when to enter
- calculate final P/L

Those decisions belong to the backend.


--------------------------------------------------
## 22. ENTRY MODEL POLLING
--------------------------------------------------

Current frontend behavior:

Entry Model engine state is polled approximately every:

3 seconds

Chart refresh:

approximately every:

60 seconds

This is UI polling.

It does not mean the Entry Model scan itself happens every 3 seconds.

The actual Entry Model scan remains:

1 minute.


--------------------------------------------------
## 23. CURRENT CYCLE TABLE
--------------------------------------------------

The current cycle table contains information such as:

Time
Coin
Trend15
Trend20
Trend30
Trend60
Decision

There are up to:

10 scans

The current scan counter displays:

scanCount / 10


--------------------------------------------------
## 24. PREVIOUS CYCLES TABLE
--------------------------------------------------

Previous cycles are displayed newest first.

Columns:

Time
Coin
Bot
Trend15
Trend20
Trend30
Trend60
Votes
Scans
Decision

Votes display:

x / 10

Example:

6 / 10

means six votes.

Current UI considers:

6 or more

to satisfy the 60% threshold.


--------------------------------------------------
## 25. PREVIOUS CYCLE SORTING
--------------------------------------------------

Current sorting is based on:

completedAt

Example:

[...previousCycles].sort(
  (a, b) =>
    Number(b?.completedAt || 0) -
    Number(a?.completedAt || 0)
)

This means newest completed cycle appears first.


--------------------------------------------------
## 26. ENTRY MODEL CHART
--------------------------------------------------

Entry Model chart uses:

Lightweight Charts

Current chart timeframe:

15 minute candles

Chart displays Entry Model signal markers.


--------------------------------------------------
## 27. ENTRY MODEL SIGNAL MARKERS
--------------------------------------------------

Signal markers are based ONLY on completed server cycles.

Decision source:

cycle.decision

Time source:

cycle.completedAt

Only:

LONG
SHORT

create markers.

NEUTRAL:

no marker.


LONG marker:

- green
- arrow up
- below candle
- text LONG

SHORT marker:

- red
- arrow down
- above candle
- text SHORT


The marker time is snapped to the nearest available 15-minute candle.

Lightweight Charts markers are sorted chronologically before being applied.


--------------------------------------------------
## 28. MARKER IMPORTANT RULE
--------------------------------------------------

DO NOT use:

cycle.timestamp

for completed Entry Model signal markers.

Use:

cycle.completedAt


--------------------------------------------------
## 29. TIMESTAMP NORMALIZATION
--------------------------------------------------

Frontend has timestamp normalization because APIs may return:

- Unix seconds
- Unix milliseconds
- numeric strings
- ISO date strings

Rule:

If numeric timestamp is extremely large, treat it as milliseconds and convert to seconds.

Lightweight Charts expects Unix seconds.

Example:

milliseconds:

1790511517955

becomes approximately:

1790511517


--------------------------------------------------
## 30. TRADE LIFECYCLE
--------------------------------------------------

File:

backend/lifecycle/tradeLifecycle.js

This module determines when a completed trading position is actually finished.

It is NOT the same thing as the Entry Model.

Entry Model answers:

"What should the bot do?"

Trade Lifecycle answers:

"Has the trading position completely finished, and what was the final P/L?"


--------------------------------------------------
## 31. TRADE LIFECYCLE POLLING
--------------------------------------------------

Current lifecycle polling interval:

30 seconds

The lifecycle repeatedly checks the live WEEX position.

Typical flow:

Trade Lifecycle START
   ↓
check WEEX position
   ↓
position active
   ↓
remember that position was seen
   ↓
check again
   ↓
position flat
   ↓
calculate final P/L
   ↓
profit / loss / zero


--------------------------------------------------
## 32. POSITION MUST BE SEEN FIRST
--------------------------------------------------

The lifecycle should NOT finalize immediately because a position lookup returns zero.

It must first detect an active position.

Internal concept:

wasPositionSeen = true

Only after:

position was seen

AND

later becomes flat

should the lifecycle finalize.


--------------------------------------------------
## 33. POSITION QUANTITY FIELDS
--------------------------------------------------

The lifecycle checks multiple possible WEEX position quantity fields:

total
positionAmt
qty
quantity
size
positionSize
holdVol

This is intentional because exchange response formats can vary.

Do not remove these fields without verifying the actual WEEX response.


--------------------------------------------------
## 34. FINAL P/L
--------------------------------------------------

After the position becomes flat:

Trade Lifecycle requests user trades.

It then finds the relevant closing fills.

For:

LONG

closing side:

SELL


For:

SHORT

closing side:

BUY


Realized P/L is then summed across the relevant closing fills.

This supports:

- multiple fills
- pyramid entries
- partial execution details


--------------------------------------------------
## 35. PYRAMID + LIFECYCLE
--------------------------------------------------

VERY IMPORTANT:

The lifecycle starts on the FIRST entry only.

Example:

Pyramid max = 3

Entry #1:
start Trade Lifecycle

Entry #2:
do NOT start a second lifecycle

Entry #3:
do NOT start a third lifecycle


All three belong to:

ONE trading cycle

The lifecycle ends only when the overall WEEX position becomes flat.


--------------------------------------------------
## 36. PROFIT FLOW
--------------------------------------------------

When final P/L > 0:

1. Trade Lifecycle stops.
2. Position state is reset.
3. Trade state is reset.
4. Bot remains ACTIVE.
5. Entry Model is restarted.

Concept:

PROFIT
→ reset
→ ACTIVE
→ Entry Model restart


--------------------------------------------------
## 37. LOSS FLOW
--------------------------------------------------

When final P/L < 0:

1. Trade Lifecycle stops.
2. Bot becomes KILLED.
3. No automatic Entry Model restart.

Concept:

LOSS
→ KILLED
→ STOP


--------------------------------------------------
## 38. ZERO P/L FLOW
--------------------------------------------------

When final P/L == 0:

1. Trade Lifecycle stops.
2. Position state resets.
3. Bot remains ACTIVE.
4. Entry Model is NOT automatically restarted.

Concept:

ZERO
→ reset
→ ACTIVE
→ no automatic restart


--------------------------------------------------
## 39. SUCCESSFUL LOSS TEST EXAMPLE
--------------------------------------------------

A previously tested loss lifecycle produced:

[TradeLifecycle] WEEX POSITION CHECK | Bot=... | POLUSDT | Positions=1

[TradeLifecycle] ACTIVE POSITION | ... | Side=LONG | Qty=10

[TradeLifecycle] POSITION DETECTED | ... | Qty=10

...

[TradeLifecycle] WEEX POSITION CHECK | ... | Positions=0

[TradeLifecycle] POSITION FLAT

[TradeLifecycle] FINALIZING

[TEST] GET USER TRADES | POLUSDT | Start=... | End=...

[TEST] USER TRADES FOUND=1

[TradeLifecycle] FINAL P/L | ... | P/L=-0.0131 | CloseFills=1

[TradeLifecycle] LOSS | ... | P/L=-0.0131

[Bot:POLUSDT] TRADE CYCLE LOSS | P/L=-0.0131 | KILL

[TradeLifecycle] STOP

[Bot:POLUSDT] BOT KILLED

This confirms the LOSS lifecycle branch has been tested successfully.


--------------------------------------------------
## 40. IMPORTANT LIFECYCLE RULE
--------------------------------------------------

Do not finalize a trade simply because:

Entry Model finished a cycle.

Entry Model cycles and trading lifecycles are separate concepts.

Entry Model cycle:

10 scans → decision

Trading lifecycle:

Entry → position exists → position flat → final P/L


--------------------------------------------------
## 41. CURRENT MAIN PRINCIPLE
--------------------------------------------------

There are three different concepts:

1. Entry Model Cycle
2. Trading Position / Pyramid Cycle
3. Bot Status

They must not be mixed together.

Example:

Bot:

ACTIVE

Entry Model:

RUNNING

Trading Position:

OPEN

Entry Model Cycle:

currently scanning 4 / 10

All four states can exist simultaneously.

--------------------------------------------------
## 42. BOT ENTER FLOW
--------------------------------------------------

The main ENTER flow is handled through:

backend/routes/bots.js

General flow:

ENTER request
   ↓
validate bot
   ↓
check pyramid limit
   ↓
determine trade number
   ↓
open WEEX position
   ↓
record trade
   ↓
increment currentPositionCount
   ↓
if first entry:
    start Trade Lifecycle
   ↓
sync TP/SL
   ↓
return result


--------------------------------------------------
## 43. PYRAMID CHECK
--------------------------------------------------

Before entering:

if:

currentPositionCount >= maxPositions

then no additional entry is allowed.

Current maximum:

3 positions.

Example:

maxPositions = 3

currentPositionCount = 0
→ Entry #1 allowed

currentPositionCount = 1
→ Entry #2 allowed

currentPositionCount = 2
→ Entry #3 allowed

currentPositionCount = 3
→ Entry #4 rejected


--------------------------------------------------
## 44. FIRST ENTRY
--------------------------------------------------

The backend determines:

const tradeNumber =
  bot.currentPositionCount + 1;

Then:

const isFirstEntry =
  tradeNumber === 1;


Only the first entry should start:

tradeLifecycle.start(bot)


--------------------------------------------------
## 45. ENTRY MODEL MUST CONTINUE
--------------------------------------------------

After an entry:

The backend logs approximately:

POSITION OPENED | Entry Model CONTINUES | Trade #...

This is intentional.

DO NOT add:

entryModelEngine.stopEngine(bot.id)

to the normal ENTER flow.

The Entry Model must remain capable of producing the next cycle / pyramid opportunity.


--------------------------------------------------
## 46. CLOSE FLOW
--------------------------------------------------

CLOSE is different from ENTER.

When CLOSE is requested:

- close the WEEX position
- cancel relevant TP/SL protection if required
- allow Trade Lifecycle to detect the WEEX position becoming flat
- let lifecycle perform final P/L processing

Do not prematurely reset all lifecycle state before the lifecycle sees the position become flat.

The exchange is the source of truth.


--------------------------------------------------
## 47. DO NOT FAKE FLAT
--------------------------------------------------

After a manual CLOSE request, it is possible that the API request has succeeded but the position state has not yet propagated through the position endpoint.

Therefore:

CLOSE request
    ≠
position definitely flat at that exact millisecond

The lifecycle should verify the actual WEEX position.


--------------------------------------------------
## 48. BOT PAUSE / RESUME
--------------------------------------------------

Bot status can be:

PAUSED

or:

ACTIVE

Pause is not the same as stopping an already-open WEEX position.

Resume is not the same as starting Entry Model automatically.

These operations must remain separate.


--------------------------------------------------
## 49. MANUAL ENTRY MODEL START
--------------------------------------------------

Bot Management contains a manual Entry Model START/STOP control.

The frontend calls:

POST /api/bots/:id/entry-model/start

or:

POST /api/bots/:id/entry-model/stop


The backend currently prevents manual Entry Model START when a position is already open.

Reason:

A user should not manually start another engine while a live position is already being managed.

Important distinction:

This does NOT mean that the already-running Entry Model should stop after an entry.

It only means:

manual START while a position exists
→ blocked


--------------------------------------------------
## 50. ENTRY MODEL START / STOP API
--------------------------------------------------

Frontend API file:

frontend/src/api.js

Current wrappers:

startEntryModel(botId)

stopEntryModel(botId)


They call:

POST /api/bots/:id/entry-model/start

POST /api/bots/:id/entry-model/stop


--------------------------------------------------
## 51. ENTRY MODEL UI STATE
--------------------------------------------------

Bot Management may determine whether Entry Model is running from fields such as:

bot.entryModelRunning === true

OR

bot.entryModelStatus === "RUNNING"

OR

bot.entryModelState === "RUNNING"


This is frontend display logic.

The backend engine itself remains authoritative.


--------------------------------------------------
## 52. IMPORTANT UI REFRESH ISSUE
--------------------------------------------------

Potential issue to remember:

If getBots() does not attach the current Entry Model engine status to every bot, the Bot Management UI may show:

STOPPED

after a page refresh even though the backend engine is actually running.

Before changing anything:

inspect the actual backend GET /api/bots response.

Do not guess.


--------------------------------------------------
## 53. TP / SL STATE
--------------------------------------------------

Bot currently tracks:

originalStopLoss

currentTakeProfit

currentTpOrderId

averageEntryPrice

firstEntryPrice


These are important because pyramid entries can change the average entry price while the original stop-loss may need to remain unchanged depending on the configured protection logic.


--------------------------------------------------
## 54. FIRST ENTRY TP/SL
--------------------------------------------------

After the first entry:

TP/SL protection is synchronized.

There is currently a delay of approximately:

30 seconds

before TP/SL synchronization.

Constant:

TP_SL_DELAY_MS = 30 * 1000


--------------------------------------------------
## 55. ADDITIONAL PYRAMID TP/SL
--------------------------------------------------

When additional entries occur:

Entry #2
Entry #3

the backend can update the take-profit based on the new average entry.

The configured original stop-loss may remain preserved according to the current logic.

Do not rewrite TP/SL behavior when working on unrelated Entry Model or lifecycle changes.


--------------------------------------------------
## 56. EXECUTION LAYER
--------------------------------------------------

Important execution files:

backend/execution/weexClient.js

backend/execution/orders.js

backend/execution/positions.js

backend/execution/account.js


Responsibilities:

weexClient.js
→ communication/authentication/signing with WEEX

orders.js
→ order creation / cancellation / user trades / execution operations

positions.js
→ current live WEEX positions

account.js
→ account/balance information


--------------------------------------------------
## 57. WEEX CLIENT
--------------------------------------------------

File:

backend/execution/weexClient.js

This is the exchange communication layer.

It handles the actual WEEX API requests.

Do not modify authentication/signing while trying to fix:

- React UI
- Entry Model display
- lifecycle state
- chart markers
- bot management UI

Only touch the WEEX client when the actual exchange communication is the problem.


--------------------------------------------------
## 58. POSITION SERVICE
--------------------------------------------------

File:

backend/execution/positions.js

This service is the backend's interface for reading current WEEX positions.

Trade Lifecycle depends on it.

Important:

Do not replace the live position check with a frontend state variable.

WEEX remains the source of truth.


--------------------------------------------------
## 59. ORDER SERVICE
--------------------------------------------------

File:

backend/execution/orders.js

Handles:

- opening positions
- closing positions
- TP
- SL
- user trades
- order operations


Current execution sizing is intentionally small for testing.


--------------------------------------------------
## 60. CURRENT TEST SIZING
--------------------------------------------------

Current defaults are approximately:

margin:

1 USDT

leverage:

10x

target notional:

10 USDT

margin type:

ISOLATED


The general sizing idea is:

targetNotional / markPrice

then quantity is adjusted to the symbol's allowed quantity step.


--------------------------------------------------
## 61. DO NOT REINTRODUCE CONTRACT VALUE
--------------------------------------------------

Current sizing logic should NOT blindly use:

contractVal

unless the actual WEEX endpoint and symbol metadata have been verified.

Previous testing showed that direct:

targetNotional / markPrice

with the correct quantity step works for the current test setup.


--------------------------------------------------
## 62. EXAMPLE POL QUANTITY
--------------------------------------------------

Example:

POL price ≈ 0.1184

Target notional ≈ 10 USDT

Raw quantity:

10 / 0.1184
≈ 84.45

If the symbol quantity step requires multiples of 10:

84.45
→ 90


Approximate resulting notional:

90 × 0.1184
≈ 10.656 USDT


Approximate 10x isolated margin:

≈ 1.066 USDT


This behavior is intentional for the current testing configuration.


--------------------------------------------------
## 63. DO NOT CHANGE SIZING DURING UNRELATED FIXES
--------------------------------------------------

If the current task is:

- Entry Model
- lifecycle
- chart
- bot management
- cycle manager

do NOT change:

- leverage
- margin
- target notional
- quantity rounding
- symbol discovery

unless the task specifically requires it.


--------------------------------------------------
## 64. MARKET DATA
--------------------------------------------------

File:

backend/market/marketData.js

Used for market information such as:

- candles
- ticker
- market data

Frontend chart data ultimately comes from the backend API.

Do not create a second independent market-data implementation in React.


--------------------------------------------------
## 65. FRONTEND API LAYER
--------------------------------------------------

File:

frontend/src/api.js

This file contains frontend wrappers around backend endpoints.

Examples:

getBots()

getChart()

getEntryModelEngine()

startEntryModel(botId)

stopEntryModel(botId)


React pages should generally call these wrappers instead of manually constructing backend requests everywhere.


--------------------------------------------------
## 66. BOT MANAGEMENT PAGE
--------------------------------------------------

File:

frontend/src/pages/BotManagement.jsx

Purpose:

Main bot control UI.

It handles/display things such as:

- bot list
- bot status
- bot direction
- pyramid settings
- Entry Model START/STOP
- ENTER
- CLOSE
- PAUSE
- RESUME


Important:

Bot Management is a controller UI.

It should not become a second trading engine.


--------------------------------------------------
## 67. BOT STATUS VS ENTRY MODEL STATUS
--------------------------------------------------

These are separate.

Bot status:

ACTIVE
PAUSED
KILLED


Entry Model:

RUNNING
STOPPED


Possible valid state:

Bot = ACTIVE
Entry Model = RUNNING
Position = OPEN


Possible valid state:

Bot = KILLED
Entry Model = STOPPED
Position = FLAT


Do not collapse these states into one variable.


--------------------------------------------------
## 68. TRIGGER STATE
--------------------------------------------------

The system also has trigger state.

Typical states:

ARMED
NEUTRAL


Trigger logic is backend-controlled.

React displays the state.

Do not make React the authority for trigger state.


--------------------------------------------------
## 69. TRADE CYCLE VS ENTRY MODEL CYCLE
--------------------------------------------------

This distinction is extremely important.

ENTRY MODEL CYCLE:

10 orderbook scans
→ votes
→ LONG / SHORT / NEUTRAL


TRADING CYCLE:

Entry #1
→ optional Entry #2
→ optional Entry #3
→ position closes
→ final P/L


They are NOT the same cycle.

One trading cycle can contain multiple Entry Model cycles.


--------------------------------------------------
## 70. EXAMPLE
--------------------------------------------------

Suppose:

Pyramid max = 3

Entry Model Cycle #1:

10 scans
→ LONG

Bot enters:

Trade #1

Entry Model continues.

Entry Model Cycle #2:

10 scans
→ LONG

Bot enters:

Trade #2

Entry Model continues.

Entry Model Cycle #3:

10 scans
→ LONG

Bot enters:

Trade #3

Now:

currentPositionCount = 3

No more entries allowed.

The Entry Model can continue scanning, but ENTER attempts are rejected by the pyramid limit.

Eventually:

WEEX position = FLAT

Trade Lifecycle:

calculates final P/L

Only then is the trading cycle completed.


--------------------------------------------------
## 71. ENTRY MODEL ENGINE SHOULD NOT BE STOPPED AFTER PYRAMID ENTRY
--------------------------------------------------

This was an important architecture correction.

Wrong:

Entry Model
→ LONG
→ Entry #1
→ STOP ENGINE


Correct:

Entry Model
→ LONG
→ Entry #1
→ KEEP ENGINE RUNNING


Then potentially:

Entry Model
→ LONG
→ Entry #2
→ KEEP ENGINE RUNNING


Then:

Entry Model
→ LONG
→ Entry #3
→ max reached


The engine and the pyramid limit are separate mechanisms.


--------------------------------------------------
## 72. TRADE LIFECYCLE SHOULD NOT START FOR EVERY PYRAMID ENTRY
--------------------------------------------------

Wrong:

Entry #1
→ lifecycle #1

Entry #2
→ lifecycle #2

Entry #3
→ lifecycle #3


Correct:

Entry #1
→ lifecycle starts

Entry #2
→ same lifecycle

Entry #3
→ same lifecycle

Position flat
→ lifecycle finishes


--------------------------------------------------
## 73. TRADE RECORDS
--------------------------------------------------

The bot maintains:

bot.trades

Each entry can be recorded separately.

The final lifecycle P/L can still represent the whole trading cycle because closing fills are collected from the exchange after the position becomes flat.


--------------------------------------------------
## 74. DO NOT CALCULATE FINAL P/L IN REACT
--------------------------------------------------

Final P/L belongs to:

backend/lifecycle/tradeLifecycle.js

React should display the backend result.

Do not recreate the P/L calculation in:

BotManagement.jsx

or:

EntryModel.jsx


--------------------------------------------------
## 75. LIFECYCLE FINALIZATION IS EXCHANGE-BASED
--------------------------------------------------

The correct sequence is:

1. Entry happens.
2. WEEX position becomes active.
3. Lifecycle records that the position was seen.
4. Position later becomes flat.
5. Lifecycle fetches user trades.
6. Closing fills are identified.
7. Realized P/L is summed.
8. Profit/loss/zero branch is executed.


--------------------------------------------------
## 76. WHY THIS MATTERS
--------------------------------------------------

Without waiting for WEEX to become flat:

the bot could incorrectly:

- finalize too early
- calculate incomplete P/L
- restart Entry Model while a position is still open
- kill a bot incorrectly
- reset pyramid state too early


The lifecycle must therefore follow the exchange state.


--------------------------------------------------
## 77. BOT DELETE
--------------------------------------------------

Deleting a bot should clean up its active backend resources.

Current deletion flow stops:

- TP timers
- trigger monitor
- Trade Lifecycle
- Entry Model Engine

Then removes the bot.


--------------------------------------------------
## 78. SINGLETON MANAGERS
--------------------------------------------------

Important managers currently use singleton-style instances.

Trade Cycle Manager:

one shared manager

Entry Model Engine:

one manager containing independent engine state per bot

Trade Lifecycle:

one shared lifecycle manager with independent bot lifecycle state


Do not accidentally create duplicate manager instances in different files.

Otherwise:

one part of the application may think the engine is running

while another manager thinks it is stopped.


--------------------------------------------------
## 79. ENGINE PER BOT
--------------------------------------------------

The Entry Model architecture is designed around:

one independent engine per bot.

Example:

Bot A
→ Engine A

Bot B
→ Engine B

Bot C
→ Engine C


Starting Bot A's Entry Model must not start Bot B's Entry Model.


--------------------------------------------------
## 80. CURRENT ENTRY MODEL ENGINE MODEL
--------------------------------------------------

Conceptually:

entryModelEngine.engines

contains independent state per bot.

Each engine knows things such as:

- botId
- symbol
- direction
- running
- timer
- cycle scans
- cycle number
- latest result


--------------------------------------------------
## 81. ENGINE START
--------------------------------------------------

Conceptual flow:

startEngine(bot)

→ find/create engine for bot

→ running = true

→ run immediate scan

→ schedule next scan


--------------------------------------------------
## 82. ENGINE STOP
--------------------------------------------------

Conceptual flow:

stopEngine(bot.id)

→ find engine

→ running = false

→ clear timer


No exchange position is automatically closed by stopping the Entry Model.


--------------------------------------------------
## 83. ENGINE SCAN SAFETY
--------------------------------------------------

The engine should verify before scanning:

- engine is still running
- trigger is appropriate
- bot exists
- symbol exists
- direction exists
- another scan is not already running

This prevents stale asynchronous work from continuing after the engine is stopped.


--------------------------------------------------
## 84. SCAN OVERLAP
--------------------------------------------------

Because orderbook requests are asynchronous:

scan #1 must not still be running when scan #2 starts.

The engine should prevent overlapping scans.

This avoids:

- duplicate requests
- duplicate votes
- inconsistent cycle state
- race conditions


--------------------------------------------------
## 85. ENTRY MODEL DECISION
--------------------------------------------------

After scan #10:

calculate votes.

Then:

LONG votes >= 6
→ LONG


SHORT votes >= 6
→ SHORT


otherwise:

NEUTRAL


After completing the cycle:

cycle scan state resets

and the engine can begin the next cycle.


--------------------------------------------------
## 86. ENTRY MODEL → BOT BRIDGE
--------------------------------------------------

When the Entry Model reaches:

LONG

or:

SHORT

the engine can call the bot ENTER bridge.

Conceptually:

masterBotBridge.enterBot(botId)


The actual bot ENTER route then handles:

- pyramid check
- order execution
- trade record
- lifecycle start if first entry
- TP/SL synchronization


--------------------------------------------------
## 87. IMPORTANT RESPONSIBILITY SPLIT
--------------------------------------------------

Entry Model Engine decides:

"ENTRY SIGNAL"

Bot route decides:

"CAN I ENTER?"

Execution decides:

"HOW DO I SEND THE ORDER?"

WEEX decides:

"DID THE POSITION ACTUALLY OPEN?"

Trade Lifecycle decides:

"WHEN DID THE COMPLETE POSITION CLOSE AND WHAT WAS THE FINAL P/L?"


This separation should be preserved.


--------------------------------------------------
## 88. HISTORICAL V3 ORDERBOOK ARCHITECTURE
--------------------------------------------------

There is an older TradingView → WEEX Bot V3 architecture.

It is NOT the same project as the current v4 React architecture.

Historical V3 structure included components such as:

server_v3.js
trading.js
weex/weex.js
filters/orderBook.js

and TradingView webhooks.


--------------------------------------------------
## 89. HISTORICAL V3 ORDERBOOK FILTER
--------------------------------------------------

The documented V3 architecture used:

one fresh 200-level WEEX orderbook snapshot

evaluated at confirmation depths:

15
20
30
60


with:

3-of-4

confirmation.

CLOSE actions bypassed the filter.


--------------------------------------------------
## 90. IMPORTANT V3/V4 WARNING
--------------------------------------------------

Do NOT automatically assume that every V3 orderbook rule exists in the current v4 Entry Model.

If a task concerns orderbook behavior:

inspect the current code first.

The README documents architecture and history.

The actual source code remains authoritative.


--------------------------------------------------
## 91. OLD V3 PROJECT SHOULD NOT BE MIXED WITH V4
--------------------------------------------------

Historical V3 files such as:

server_v3.js
trading.js

should not automatically be imported into:

trading_bot_v4_react


unless explicitly required.


--------------------------------------------------
## 92. CLOUD / WEBHOOK HISTORY
--------------------------------------------------

The older V3 project used TradingView webhooks and Cloudflare tunnel infrastructure.

The current v4 React project is a different architecture.

Do not assume that the old webhook architecture is still required for every v4 feature.


--------------------------------------------------
## 93. API / ROUTE RULE
--------------------------------------------------

When adding a new frontend feature:

first check whether the backend already exposes the required data.

Do not create duplicate endpoints if an existing endpoint can provide the data.

Likewise:

do not invent an endpoint without checking the existing route structure.


--------------------------------------------------
## 94. DEBUGGING RULE
--------------------------------------------------

When something is wrong:

FIRST inspect the actual response/log.

Do not immediately rewrite the logic.

Example:

UI says:

Entry Model STOPPED

Possible causes include:

1. engine really stopped
2. API response missing engine state
3. frontend reads wrong field
4. polling stale
5. bot object not updated after refresh

Inspect first.


--------------------------------------------------
## 95. SERVER LOGGING
--------------------------------------------------

Useful log prefixes include:

[Bot:...]

[TradeLifecycle]

[Entry Model]

[WEEX]

[Execution]

[TEST]


Keep logs clear enough to follow one bot through the entire lifecycle.


--------------------------------------------------
## 96. DEBUGGING ONE BOT
--------------------------------------------------

When testing one bot:

follow:

Bot ID
Symbol
Direction

through:

Entry Model
→ ENTER
→ WEEX
→ Lifecycle
→ FLAT
→ P/L
→ final bot state


Do not test five different systems simultaneously unless necessary.


--------------------------------------------------
## 97. TESTING PHILOSOPHY
--------------------------------------------------

Preferred test cycle:

1. Make one code change.
2. Start backend.
3. Perform one action.
4. Read logs.
5. Check frontend.
6. Check WEEX if applicable.
7. Confirm expected state.
8. Stop.
9. Only then make another change.


--------------------------------------------------
## 98. DO NOT STACK UNTESTED CHANGES
--------------------------------------------------

Bad workflow:

change Entry Model
+
change lifecycle
+
change TP/SL
+
change chart
+
change order sizing
+
change API

then test everything.

This makes failures difficult to identify.


Correct:

one change
→ test
→ verify
→ next change


--------------------------------------------------
## 99. GIT CHECKPOINT
--------------------------------------------------

Before a meaningful change:

PowerShell:

cd "D:\Trading Bots\trading_bot_v4_react"

git status

git add .

git commit -m "Checkpoint before <change>"

git log -1 --oneline


This gives a recovery point before experimentation.


--------------------------------------------------
## 100. SECURITY
--------------------------------------------------

NEVER put:

API keys
API secrets
private credentials
WEEX secrets

inside:

README.md

chat messages unnecessarily

frontend code

Git commits


Use:

.env

and keep .env out of Git.


--------------------------------------------------
## 101. FRONTEND MUST NOT CONTAIN API SECRETS
--------------------------------------------------

React code is client-side code.

Never put private WEEX API credentials into:

frontend/src/

API secrets belong on the backend.


--------------------------------------------------
## 102. CURRENT PROJECT TEST MODE
--------------------------------------------------

The system is being developed using very small WEEX positions.

Typical configuration:

~1 USDT margin

10x leverage

~10 USDT notional


The purpose is testing lifecycle behavior and exchange integration without using large positions.


--------------------------------------------------
## 103. IMPORTANT: DO NOT CHANGE WORKING EXECUTION
--------------------------------------------------

If a task is about:

Entry Model

lifecycle

chart

Bot Management

cycle manager

do not casually change:

- order sizing
- leverage
- authentication
- symbol discovery
- quantity rounding
- WEEX endpoints


Working exchange execution should be treated as a protected subsystem unless specifically being fixed.


--------------------------------------------------
## 104. CURRENT DEVELOPMENT PRIORITY
--------------------------------------------------

The current project focus is:

ENTRY MODEL
+
TRADE CYCLE
+
TRADE LIFECYCLE
+
PYRAMIDING
+
BOT MANAGEMENT


The architecture is being stabilized before adding unrelated features.


--------------------------------------------------
## 105. NEXT TASK RULE
--------------------------------------------------

When starting a new task:

1. Read this README.
2. Identify the subsystem.
3. Open the actual current file.
4. Understand the existing implementation.
5. Make the smallest required change.
6. Preserve the architecture.
7. Test immediately.


--------------------------------------------------
## 106. NEVER TRUST README OVER SOURCE CODE
--------------------------------------------------

This README is a project memory / handoff document.

It can become outdated.

If README says:

X

but the actual source code says:

Y

the actual source code is authoritative.

Update the README after important architecture changes.


--------------------------------------------------
## 107. AI CODING INSTRUCTIONS
--------------------------------------------------

Any AI working on this project should follow these rules:

READ README FIRST.

THEN inspect the actual source file.

DO NOT invent:

- functions
- routes
- API fields
- WEEX endpoints
- object properties
- manager methods
- response formats


If uncertain:

inspect the code or actual runtime response.


--------------------------------------------------
## 108. AI SHOULD PRESERVE WORKING ARCHITECTURE
--------------------------------------------------

Do not rewrite a working subsystem simply because another implementation might be cleaner.

Prefer:

smallest safe change

over:

large refactor


Especially protect:

- lifecycle
- execution
- WEEX authentication
- position detection
- pyramid logic


--------------------------------------------------
## 109. COMPLETE FILE REPLACEMENTS
--------------------------------------------------

The user prefers complete-file replacements.

If asked:

"give me the whole file"

provide the complete file.

Do not provide only a small patch unless specifically requested.


--------------------------------------------------
## 110. ONE CHANGE AT A TIME
--------------------------------------------------

If there are five possible problems:

fix #1

test #1

then fix #2

test #2

Do not combine all five fixes into one large uncontrolled change.


--------------------------------------------------
## 111. CAVEMAN TURBO COMMUNICATION STYLE
--------------------------------------------------

Preferred communication:

"YES."

"Change this file."

"Replace it with this."

"Run:

node server.js"

"Do one test."

"Send me the log."


Avoid unnecessary long explanations when the user is actively coding.


--------------------------------------------------
## 112. WHEN A BUG IS FOUND
--------------------------------------------------

State the actual bug clearly.

Example:

"Found it: frontend reads timestamp, backend sends completedAt."

Then provide:

1. exact file
2. exact replacement
3. test


Do not bury the actual fix in theory.


--------------------------------------------------
## 113. WHEN A TEST PASSES
--------------------------------------------------

Do not rewrite working code.

Record what passed.

Then move to the next requested change.


--------------------------------------------------
## 114. CURRENT KNOWN WORKING LIFECYCLE BEHAVIOR
--------------------------------------------------

Known tested branch:

Position opens
→ lifecycle detects it
→ position becomes flat
→ user trades fetched
→ close fills identified
→ P/L calculated
→ negative P/L
→ bot becomes KILLED


This behavior should be preserved.


--------------------------------------------------
## 115. CURRENT KNOWN ENTRY MODEL BEHAVIOR
--------------------------------------------------

Current Entry Model:

10 scans

1 scan per minute

6 votes required

LONG / SHORT / NEUTRAL

completed cycles stored

previous cycles sorted by completedAt

chart markers use completedAt

Entry Model does not automatically stop after every entry.


--------------------------------------------------
## 116. CURRENT KNOWN PYRAMID BEHAVIOR
--------------------------------------------------

Maximum:

3 entries per trading cycle.

First entry:

starts lifecycle.

Additional entries:

same lifecycle.

Position flat:

lifecycle finalizes whole trading cycle.


--------------------------------------------------
## 117. CURRENT KNOWN PROFIT BEHAVIOR
--------------------------------------------------

Positive final P/L:

reset position state

bot ACTIVE

restart Entry Model


--------------------------------------------------
## 118. CURRENT KNOWN LOSS BEHAVIOR
--------------------------------------------------

Negative final P/L:

reset/stop lifecycle

bot KILLED

Entry Model does not automatically restart.


--------------------------------------------------
## 119. CURRENT KNOWN ZERO BEHAVIOR
--------------------------------------------------

Zero P/L:

reset position state

bot ACTIVE

no automatic Entry Model restart.


--------------------------------------------------
## 120. CURRENT MENTAL MODEL
--------------------------------------------------

Think of the system as five separate layers:

1. UI
2. Decision
3. Trading-cycle state
4. Position lifecycle
5. Exchange execution


UI:

"What does the user see?"


Entry Model:

"What signal exists?"


Trade Cycle Manager:

"What Entry Model cycle are we in?"


Trade Lifecycle:

"Is the actual trading position finished?"


Execution:

"How do we communicate with WEEX?"


--------------------------------------------------
## 121. FINAL ARCHITECTURE RULE
--------------------------------------------------

The backend is the source of truth for trading logic.

React visualizes and controls.

WEEX is the source of truth for the actual live position.

Entry Model owns Entry Model state.

Trade Cycle Manager owns Entry Model cycle state.

Trade Lifecycle owns completed-position detection and final P/L.

Execution owns exchange operations.

Do not blur these responsibilities.


--------------------------------------------------
## 122. CURRENT FILE RESPONSIBILITY MAP
--------------------------------------------------

Use this section as the quick "where do I change it?" guide.

--------------------------------------------------
backend/server.js
--------------------------------------------------

Responsible for:

- Express startup
- middleware
- route mounting
- backend initialization

NOT responsible for:

- Entry Model calculations
- P/L calculations
- WEEX order strategy
- pyramid decision logic


--------------------------------------------------
backend/routes/bots.js
--------------------------------------------------

Responsible for:

- Bot API
- bot creation
- bot deletion
- ENTER
- CLOSE
- PAUSE
- RESUME
- Entry Model START
- Entry Model STOP
- coordination between subsystems


--------------------------------------------------
backend/entry-models/entryModelEngine.js
--------------------------------------------------

Responsible for:

- Entry Model engines
- scan timing
- orderbook scan
- scan results
- voting
- cycle completion
- LONG/SHORT/NEUTRAL decision


--------------------------------------------------
backend/cycle/tradeCycleManager.js
--------------------------------------------------

Responsible for:

- Entry Model cycle state
- cycle creation
- cycle tracking
- cycle information


--------------------------------------------------
backend/lifecycle/tradeLifecycle.js
--------------------------------------------------

Responsible for:

- detecting live position
- detecting position flat
- user trade lookup
- close-fill filtering
- final realized P/L
- profit/loss/zero branch


--------------------------------------------------
backend/execution/orders.js
--------------------------------------------------

Responsible for:

- opening
- closing
- TP
- SL
- user trades
- order-related exchange operations


--------------------------------------------------
backend/execution/positions.js
--------------------------------------------------

Responsible for:

- current WEEX position lookup


--------------------------------------------------
backend/execution/weexClient.js
--------------------------------------------------

Responsible for:

- WEEX API
- authentication
- request signing
- exchange communication


--------------------------------------------------
backend/execution/account.js
--------------------------------------------------

Responsible for:

- account information
- balance-related operations


--------------------------------------------------
backend/market/marketData.js
--------------------------------------------------

Responsible for:

- ticker
- candles
- market data


--------------------------------------------------
frontend/src/api.js
--------------------------------------------------

Responsible for:

- frontend → backend API wrappers


--------------------------------------------------
frontend/src/pages/BotManagement.jsx
--------------------------------------------------

Responsible for:

- bot controls
- bot display
- Entry Model controls
- position controls
- status display


--------------------------------------------------
frontend/src/pages/EntryModel.jsx
--------------------------------------------------

Responsible for:

- Entry Model display
- current cycle display
- previous cycles
- chart
- signal markers
- engine status display


--------------------------------------------------
frontend/src/pages/EntryModel.css
--------------------------------------------------

Responsible for:

- Entry Model UI styling


--------------------------------------------------
## 123. QUICK DECISION TREE
--------------------------------------------------

If the problem is:

"Entry Model doesn't scan"

→ inspect:

backend/entry-models/entryModelEngine.js


If:

"10 scans don't complete"

→ inspect:

entryModelEngine.js
tradeCycleManager.js


If:

"LONG/SHORT decision is wrong"

→ inspect:

entryModelEngine.js


If:

"Previous cycle isn't displayed"

→ inspect:

entryModelEngine.js
bots API response
EntryModel.jsx


If:

"Previous cycles are in wrong order"

→ inspect:

EntryModel.jsx

especially:

completedAt sorting


If:

"Chart marker doesn't appear"

→ inspect:

EntryModel.jsx

especially:

cycle.decision

cycle.completedAt


If:

"Position is not detected"

→ inspect:

positions.js

then:

tradeLifecycle.js


If:

"Position became flat but lifecycle didn't finish"

→ inspect:

tradeLifecycle.js


If:

"P/L is wrong"

→ inspect:

tradeLifecycle.js

and:

orders.getUserTrades()


If:

"Bot didn't become KILLED after loss"

→ inspect:

tradeLifecycle.js

then:

bot.onTradeLoss


If:

"Bot didn't restart after profit"

→ inspect:

bot.onTradeProfit


If:

"Bot starts another lifecycle on pyramid #2"

→ inspect:

bots.js

first-entry logic


If:

"Entry Model stops after entry"

→ inspect:

bots.js

and:

entryModelEngine.js

DO NOT add automatic stop behavior.


If:

"Fourth pyramid entry happens"

→ inspect:

bots.js

maxPositions check


If:

"Order quantity is wrong"

→ inspect:

orders.js


If:

"WEEX request fails"

→ inspect:

weexClient.js

and:

orders.js


If:

"UI says Entry Model stopped after page refresh"

→ inspect:

GET bots response

then:

BotManagement.jsx


--------------------------------------------------
## 124. CURRENT ENTRY MODEL ENGINE LOGIC
--------------------------------------------------

The conceptual engine looks like:

startEngine(bot)
    ↓
running = true
    ↓
immediate scan
    ↓
schedule next scan
    ↓
scan every 60 seconds
    ↓
collect scan result
    ↓
after scan #10:
    calculate votes
    ↓
LONG / SHORT / NEUTRAL
    ↓
record completed cycle
    ↓
reset scan state
    ↓
continue next cycle


--------------------------------------------------
## 125. ENGINE SCAN INTERVAL
--------------------------------------------------

Current:

const SCAN_INTERVAL_MS =
  60 * 1000;


This means:

60,000 ms

=

60 seconds

=

1 minute


--------------------------------------------------
## 126. ENGINE CYCLE SIZE
--------------------------------------------------

Current:

const CYCLE_SIZE = 10;


Therefore:

10 scans per completed Entry Model cycle.


--------------------------------------------------
## 127. REQUIRED VOTES
--------------------------------------------------

Current logic is effectively:

const requiredVotes =
  Math.ceil(
    CYCLE_SIZE * 0.60
  );


With:

CYCLE_SIZE = 10

result:

6


--------------------------------------------------
## 128. ENGINE DECISION EXAMPLES
--------------------------------------------------

LONG:

LONG = 6
SHORT = 3
NEUTRAL = 1

→ LONG


LONG:

LONG = 8
SHORT = 1
NEUTRAL = 1

→ LONG


SHORT:

LONG = 2
SHORT = 7
NEUTRAL = 1

→ SHORT


NEUTRAL:

LONG = 5
SHORT = 4
NEUTRAL = 1

→ NEUTRAL


NEUTRAL:

LONG = 3
SHORT = 3
NEUTRAL = 4

→ NEUTRAL


--------------------------------------------------
## 129. ENGINE CYCLE RESET
--------------------------------------------------

After a completed cycle:

cycle.cycleScans

is reset.

The engine then begins collecting scans for the next cycle.

Do not accidentally stop the engine when resetting a cycle.


--------------------------------------------------
## 130. ENGINE TIMER
--------------------------------------------------

The engine has a timer for future scans.

When stopping:

the timer must be cleared.

When restarting:

a new timer must be created.

Do not allow duplicate timers.

Potential bad state:

one bot

two active timers

Result:

two scans every minute

which corrupts the intended cycle.


--------------------------------------------------
## 131. START SHOULD BE IDEMPOTENT
--------------------------------------------------

If possible within the current implementation:

starting an already-running engine should not create duplicate timers.

Conceptually:

RUNNING
+
START

should not produce:

two engines

or:

two scan loops.


--------------------------------------------------
## 132. STOP SHOULD BE SAFE
--------------------------------------------------

Stopping an engine that is already stopped should not crash the application.

Expected behavior:

running = false

timer cleared if present

no future scans


--------------------------------------------------
## 133. ASYNC SCAN SAFETY
--------------------------------------------------

A scan may involve asynchronous WEEX/orderbook operations.

Therefore:

start scan
→ await orderbook
→ process result

must not accidentally allow another scan to mutate the same cycle simultaneously.

Use an internal guard if the current engine already has one.

Do not remove it casually.


--------------------------------------------------
## 134. STALE SCAN SAFETY
--------------------------------------------------

If:

scan starts

then:

engine is stopped

then:

WEEX request returns

the old scan should not continue modifying a stopped engine if the current implementation guards against that.

When changing async code:

always consider:

"What happens if stopEngine() happens while this request is waiting?"


--------------------------------------------------
## 135. MASTER BOT BRIDGE
--------------------------------------------------

The Entry Model Engine can communicate with the bot layer through the configured bridge.

Conceptually:

masterBotBridge.enterBot(botId)


The bridge should result in the normal bot ENTER flow.

Do not duplicate order execution directly inside Entry Model Engine unless explicitly designed.


--------------------------------------------------
## 136. ENTRY MODEL SHOULD NOT DIRECTLY OWN WEEX ORDERS
--------------------------------------------------

The Entry Model determines:

LONG / SHORT / NEUTRAL

The bot/execution layer determines:

whether entry is allowed

and:

how the order is executed.


This protects the separation between:

signal

and:

execution.


--------------------------------------------------
## 137. PYRAMID ENTRY DECISION
--------------------------------------------------

When Entry Model generates another matching entry:

the normal ENTER path handles:

currentPositionCount

maxPositions


Example:

currentPositionCount = 1

maxPositions = 3

new LONG signal:

→ Entry #2 allowed


currentPositionCount = 3

new LONG signal:

→ rejected


The Entry Model does not need to manually manage the pyramid counter.


--------------------------------------------------
## 138. POSITION SIDE
--------------------------------------------------

Bot has a configured direction.

Examples:

LONG

SHORT


Entry execution follows the bot direction.

Do not assume a LONG bot can silently reverse to SHORT through a normal pyramid entry.

Reversal behavior must be explicitly implemented if ever required.


--------------------------------------------------
## 139. REVERSAL VS PYRAMID
--------------------------------------------------

A reversal is NOT the same as a pyramid entry.

Pyramid:

LONG
→ LONG
→ LONG


Reversal:

LONG
→ close LONG
→ wait until flat
→ open SHORT


Do not implement reversal logic as simply:

"if opposite signal, open opposite order."

The existing architecture requires live position handling.


--------------------------------------------------
## 140. WEEX POSITION CHECK BEFORE SENSITIVE ACTIONS
--------------------------------------------------

For operations where live state matters:

check the actual WEEX position.

Especially important for:

- reversal
- close
- lifecycle finalization
- pyramid management


Never assume internal bot state perfectly represents the exchange.


--------------------------------------------------
## 141. TP/SL DELAY
--------------------------------------------------

Current configured delay:

30 seconds

This gives the exchange/order state time to settle after the initial position is opened before TP/SL synchronization.

Do not remove the delay simply because the order endpoint returns successfully.


--------------------------------------------------
## 142. TP/SL FIRST ENTRY
--------------------------------------------------

First entry stores important information such as:

firstEntryPrice

originalStopLoss

averageEntryPrice

currentTakeProfit


This information can be required later when handling pyramids.


--------------------------------------------------
## 143. AVERAGE ENTRY PRICE
--------------------------------------------------

With pyramid entries:

the exchange's actual average entry price becomes important.

Do not calculate the final average manually from assumptions if WEEX can provide the live position average.

The current architecture prefers the live position data.


--------------------------------------------------
## 144. ORIGINAL STOP LOSS
--------------------------------------------------

The bot tracks:

originalStopLoss


This exists so later operations do not accidentally lose the original protection configuration.

When changing TP/SL logic:

verify whether the intended behavior is:

- preserve original SL
- modify TP
- replace both
- cancel protection

Do not assume.


--------------------------------------------------
## 145. CURRENT TAKE PROFIT
--------------------------------------------------

The bot tracks:

currentTakeProfit


This can change after a pyramid entry if the average entry changes.

TP state is therefore separate from:

originalStopLoss


--------------------------------------------------
## 146. CURRENT TP ORDER ID
--------------------------------------------------

The bot tracks:

currentTpOrderId


This allows the system to identify/manage the active TP order.

When replacing TP:

the old TP may need cancellation before a new one is created.

Always inspect the existing implementation before changing this.


--------------------------------------------------
## 147. USER TRADES
--------------------------------------------------

Final P/L uses:

orders.getUserTrades(...)


The lifecycle supplies:

symbol
start time
end time
limit


The returned trades are then filtered.

Do not simply sum every trade for the symbol.

Only relevant closing fills should be included.


--------------------------------------------------
## 148. CLOSE-FILL FILTER
--------------------------------------------------

For a LONG:

close side = SELL


For a SHORT:

close side = BUY


This prevents opening fills from being incorrectly counted as realized closing P/L.


--------------------------------------------------
## 149. MULTIPLE CLOSE FILLS
--------------------------------------------------

One position can generate multiple closing fills.

Example:

Position:

10 contracts

Closing fills:

4
3
3


Lifecycle should be able to sum the realized P/L across all relevant close fills.


--------------------------------------------------
## 150. PYRAMID + MULTIPLE CLOSE FILLS
--------------------------------------------------

Example:

Entry #1
→ 10 contracts

Entry #2
→ 10 contracts

Entry #3
→ 10 contracts

Total:

30


Closing execution could contain:

10
5
15


The lifecycle should still calculate the complete trading-cycle result.


--------------------------------------------------
## 151. LIFECYCLE START TIME
--------------------------------------------------

Trade Lifecycle stores a start time.

This is used when requesting user trades so unrelated historical trades are less likely to be included.


--------------------------------------------------
## 152. LIFECYCLE END TIME
--------------------------------------------------

When WEEX becomes flat:

the lifecycle records the close/finalization time.

Then user trades are queried for the relevant period.


--------------------------------------------------
## 153. LIFECYCLE STOP
--------------------------------------------------

When lifecycle completes:

stop the lifecycle timer.

Do not leave an old lifecycle polling forever.

Otherwise a completed bot could continue checking WEEX unnecessarily.


--------------------------------------------------
## 154. LIFECYCLE ERROR HANDLING
--------------------------------------------------

If a user-trade request fails:

do not invent a P/L value.

The system should report the failure and retain enough state for safe handling/retry according to the actual implementation.

Never silently assume:

P/L = 0


--------------------------------------------------
## 155. ZERO P/L IS A REAL STATE
--------------------------------------------------

Do not automatically treat:

P/L = 0

as:

profit


or:

loss


It is its own branch.


--------------------------------------------------
## 156. BOT KILLED STATE
--------------------------------------------------

KILLED is an intentional terminal bot state after a loss.

A killed bot should not automatically resume Entry Model.

If a manual recovery/reset mechanism exists later, that should be explicit.


--------------------------------------------------
## 157. BOT ACTIVE STATE
--------------------------------------------------

ACTIVE means the bot is allowed to operate according to its other conditions.

It does not automatically mean:

Entry Model is running.


For example:

ACTIVE + STOPPED

can be valid.

--------------------------------------------------
## 158. BOT PAUSED STATE
--------------------------------------------------

PAUSED means bot operation is paused.

Do not interpret PAUSED as:

WEEX position closed.

The live exchange position must still be checked separately.


--------------------------------------------------
## 159. CURRENT STATE MATRIX
--------------------------------------------------

Example valid combinations:

Bot ACTIVE
Entry Model RUNNING
Position FLAT


Bot ACTIVE
Entry Model RUNNING
Position OPEN


Bot ACTIVE
Entry Model STOPPED
Position FLAT


Bot PAUSED
Entry Model STOPPED
Position FLAT


Bot KILLED
Entry Model STOPPED
Position FLAT


A position being OPEN does not automatically imply Entry Model must be STOPPED.


--------------------------------------------------
## 160. IMPORTANT DIFFERENCE: ENGINE VS POSITION
--------------------------------------------------

Engine state:

RUNNING / STOPPED


Position state:

OPEN / FLAT


Bot state:

ACTIVE / PAUSED / KILLED


These are three independent dimensions.

Do not create one universal status variable to represent all three.


--------------------------------------------------
## 161. CURRENT BOT CREATION
--------------------------------------------------

When a bot is created:

- pyramidPositions is clamped to 1–3
- currentPositionCount starts at 0
- trade state starts empty
- bot status starts ACTIVE
- cycle is created
- Entry Model is NOT automatically started unless the current implementation explicitly requests it


--------------------------------------------------
## 162. BOT CREATION CYCLE
--------------------------------------------------

Current cycle creation concept:

tradeCycleManager.create(
  bot.id,
  {
    direction: bot.direction,
    position: null
  }
)


Bot also receives:

cycleId = bot.id


Do not assume cycleId is a random separate ID unless the actual code changes.


--------------------------------------------------
## 163. BOT CREATION DOES NOT EQUAL ENTRY
--------------------------------------------------

Creating a bot:

does not open a WEEX position.

It only creates/configures the bot and its backend state.


--------------------------------------------------
## 164. BOT ENTER DOES NOT EQUAL COMPLETED TRADE
--------------------------------------------------

ENTER means:

position opened / entry attempted.

Completed trading cycle means:

position eventually becomes flat and final P/L has been calculated.


--------------------------------------------------
## 165. BOT CLOSE DOES NOT EQUAL FINAL P/L
--------------------------------------------------

CLOSE requests a position close.

Final P/L is calculated only after the lifecycle verifies the position is flat and processes the closing fills.


--------------------------------------------------
## 166. ENTRY MODEL DECISION DOES NOT EQUAL ORDER FILLED
--------------------------------------------------

LONG decision:

means:

Entry Model wants LONG.


It does NOT guarantee:

WEEX order succeeded.


Execution and exchange state determine what actually happened.


--------------------------------------------------
## 167. ORDER FAILURE
--------------------------------------------------

If an order fails:

do not increment:

currentPositionCount

as if the trade succeeded.

Do not start lifecycle as if the position exists.

Do not invent an entry price.

The bot should reflect actual execution.


--------------------------------------------------
## 168. POSITION SUCCESS
--------------------------------------------------

After a successful position opening:

record the actual trade state according to the current execution response.

Then:

increment currentPositionCount

and:

start lifecycle only if this was Entry #1.


--------------------------------------------------
## 169. CURRENT ENTER SEQUENCE
--------------------------------------------------

The intended sequence is:

tradeNumber =
currentPositionCount + 1

isFirstEntry =
tradeNumber === 1

open WEEX position

if successful:

record trade

increment currentPositionCount

if first:

start lifecycle

then:

TP/SL synchronization


--------------------------------------------------
## 170. DO NOT START LIFECYCLE BEFORE SUCCESSFUL ENTRY
--------------------------------------------------

Wrong:

start lifecycle
→ send order


Correct:

send order
→ confirm successful opening
→ start lifecycle


The lifecycle exists to monitor a real position.


--------------------------------------------------
## 171. DO NOT INCREMENT PYRAMID COUNT BEFORE SUCCESS
--------------------------------------------------

Wrong:

currentPositionCount++

then:

open order


Correct:

open order

if successful:

currentPositionCount++


--------------------------------------------------
## 172. FRONTEND ENTRY MODEL RESPONSIBILITY
--------------------------------------------------

EntryModel.jsx should display server truth.

For current engine state:

read backend engine state.

For completed cycles:

read backend completed cycles.

For chart markers:

use backend decision and completedAt.


--------------------------------------------------
## 173. CURRENT MARKER LOGIC
--------------------------------------------------

The current intended marker logic is:

for each previous cycle:

read:

cycle.decision

if:

LONG or SHORT

read:

cycle.completedAt

normalize timestamp

find nearest 15m candle

create marker

sort markers chronologically

set markers on chart


--------------------------------------------------
## 174. MARKER EXAMPLE
--------------------------------------------------

LONG:

{
  time: nearestCandle.time,
  position: "belowBar",
  color: "#22c55e",
  shape: "arrowUp",
  text: "LONG"
}


SHORT:

{
  time: nearestCandle.time,
  position: "aboveBar",
  color: "#ef4444",
  shape: "arrowDown",
  text: "SHORT"
}


NEUTRAL:

no marker.


--------------------------------------------------
## 175. MARKER COLOR
--------------------------------------------------

Current UI implementation uses:

LONG:

#22c55e


SHORT:

#ef4444


This is visual UI only.

The color does not determine the trading decision.


--------------------------------------------------
## 176. MARKER SOURCE
--------------------------------------------------

Signal marker source:

server cycle decision

NOT:

- frontend prediction
- chart indicator
- current candle direction
- manually inferred signal


--------------------------------------------------
## 177. MARKER TIME
--------------------------------------------------

Marker time source:

cycle.completedAt


Then:

nearest 15m candle


This avoids placing markers at timestamps where no candle exists.


--------------------------------------------------
## 178. PREVIOUS CYCLES ARE HISTORICAL
--------------------------------------------------

The Previous Cycles table represents completed Entry Model cycles.

It does NOT automatically represent completed trading positions.

A completed Entry Model cycle can result in:

LONG
→ entry

or:

LONG
→ no entry because pyramid max reached

or:

LONG
→ entry rejected

Therefore Entry Model history and trading history are different datasets.


--------------------------------------------------
## 179. ENTRY MODEL NEUTRAL
--------------------------------------------------

NEUTRAL means:

the completed 10-scan cycle did not reach the required LONG or SHORT threshold.

It does not mean:

trade loss

position flat

bot paused

bot killed


It is only an Entry Model decision.


--------------------------------------------------
## 180. FINAL ARCHITECTURE SUMMARY
--------------------------------------------------

Signal layer:

Entry Model Engine

Cycle layer:

Trade Cycle Manager

Bot control layer:

bots.js

Position lifecycle:

Trade Lifecycle

Exchange execution:

Execution services

Exchange truth:

WEEX

UI:

React


--------------------------------------------------
## 181. ONE-LINE RULE FOR EACH LAYER
--------------------------------------------------

Entry Model:

"What is the signal?"


Trade Cycle:

"Where are we in the signal cycle?"


Bot:

"Is this entry allowed?"


Execution:

"How do we execute it?"


WEEX:

"What actually happened?"


Lifecycle:

"Is the complete trading position finished?"


React:

"How do we show/control it?"


--------------------------------------------------
## 182. DO NOT MIX THESE QUESTIONS
--------------------------------------------------

If a bug belongs to:

"What is the signal?"

do not fix it in React.

If a bug belongs to:

"Is the position flat?"

do not fix it in EntryModel.jsx.

If a bug belongs to:

"How is quantity calculated?"

do not fix it in tradeLifecycle.js.

If a bug belongs to:

"Why is the chart marker missing?"

do not modify WEEX execution.


--------------------------------------------------
## 183. CURRENT DEVELOPMENT RULE
--------------------------------------------------

Before changing code, identify:

WHO OWNS THIS STATE?

Then modify that subsystem.


--------------------------------------------------
## 184. PROJECT PHILOSOPHY
--------------------------------------------------

The project is intentionally modular.

The goal is not to make one giant bot file.

The goal is:

small modules

clear ownership

live exchange verification

testable state transitions

predictable lifecycle behavior


--------------------------------------------------
## 185. END OF PART 3
--------------------------------------------------


--------------------------------------------------
## 186. DEBUGGING CHECKLIST
--------------------------------------------------

When something breaks, use this order.

1. Read the browser console.
2. Read the backend terminal.
3. Identify the exact subsystem.
4. Check the actual API response.
5. Check WEEX if the issue involves a live position.
6. Change only one thing.
7. Restart backend if required.
8. Repeat the exact test.
9. Compare logs before/after.


--------------------------------------------------
## 187. ENTRY MODEL DEBUG CHECKLIST
--------------------------------------------------

If Entry Model is not working:

CHECK:

[ ] Bot exists

[ ] Symbol exists

[ ] Direction exists

[ ] Engine exists

[ ] Engine running = true

[ ] Trigger is valid

[ ] Scan timer exists

[ ] Orderbook request succeeds

[ ] Scan result is produced

[ ] Scan counter increments

[ ] Cycle reaches 10 scans

[ ] Vote calculation runs

[ ] Decision is LONG / SHORT / NEUTRAL

[ ] Completed cycle is stored

[ ] Next cycle starts


--------------------------------------------------
## 188. ENTRY MODEL LOGS
--------------------------------------------------

Useful logs:

[Entry Model] START

[Entry Model] SCAN

[Entry Model] ORDERBOOK

[Entry Model] RESULT

[Entry Model] CYCLE COMPLETE

[Entry Model] DECISION

[Entry Model] STOP


Exact log wording may vary in the current source.

Always inspect the actual current logs rather than assuming a message exists.


--------------------------------------------------
## 189. ENTRY MODEL 10-SCAN TEST
--------------------------------------------------

Basic test:

Start Entry Model.

Expected:

scan 1 / 10

scan 2 / 10

...

scan 10 / 10


After scan 10:

completed cycle appears.

Then:

new cycle begins.


Expected:

cycle #1 completed

cycle #2 starts collecting scans


--------------------------------------------------
## 190. ENTRY MODEL VOTE TEST
--------------------------------------------------

Test LONG:

at least:

6 LONG votes

Expected:

LONG


Test SHORT:

at least:

6 SHORT votes

Expected:

SHORT


Test mixed:

5 LONG

4 SHORT

1 NEUTRAL

Expected:

NEUTRAL


--------------------------------------------------
## 191. ENTRY MODEL CONTINUATION TEST
--------------------------------------------------

Important test:

1. Start Entry Model.
2. Allow LONG/SHORT decision.
3. Entry opens.
4. Check Entry Model engine.
5. Verify engine remains RUNNING.
6. Wait for next scan/cycle.

Expected:

POSITION OPEN

AND:

ENTRY MODEL RUNNING


If the engine becomes STOPPED immediately after Entry #1:

inspect bots.js / entryModelEngine.js.

Do not automatically accept that as correct behavior.


--------------------------------------------------
## 192. PYRAMID TEST
--------------------------------------------------

Configure:

maxPositions = 3


Then:

Entry #1

Expected:

currentPositionCount = 1

Lifecycle starts.


Entry #2

Expected:

currentPositionCount = 2

Same lifecycle.


Entry #3

Expected:

currentPositionCount = 3

Same lifecycle.


Entry #4

Expected:

rejected.


--------------------------------------------------
## 193. PYRAMID LIFECYCLE TEST
--------------------------------------------------

After three entries:

DO NOT expect three lifecycle finalizations.

Expected:

ONE lifecycle


Then:

WEEX position becomes flat

ONE final P/L calculation


--------------------------------------------------
## 194. PROFIT TEST
--------------------------------------------------

Test:

open position

close with positive realized P/L

wait until WEEX reports flat


Expected:

Trade Lifecycle:

FINAL P/L > 0


Then:

lifecycle stops

position state resets

trade state resets

bot ACTIVE

Entry Model restarts


--------------------------------------------------
## 195. LOSS TEST
--------------------------------------------------

Test:

open position

close with negative realized P/L

wait until WEEX reports flat


Expected:

FINAL P/L < 0

Then:

lifecycle stops

bot KILLED

Entry Model remains stopped


--------------------------------------------------
## 196. ZERO P/L TEST
--------------------------------------------------

Test:

position closes with approximately zero realized P/L.


Expected:

lifecycle stops

position state resets

bot ACTIVE

Entry Model does NOT automatically restart


--------------------------------------------------
## 197. FLAT-WITHOUT-SEEN-POSITION TEST
--------------------------------------------------

Start lifecycle.

If WEEX immediately reports:

position = 0

but lifecycle never saw an active position:

it should NOT falsely finalize the trading cycle.


This protects against:

- startup races
- delayed exchange state
- stale bot state


--------------------------------------------------
## 198. POSITION DETECTION TEST
--------------------------------------------------

Expected sequence:

Lifecycle starts

↓

WEEX position = 0

↓

continue monitoring

↓

WEEX position = active

↓

POSITION DETECTED

↓

continue monitoring

↓

WEEX position = 0

↓

POSITION FLAT

↓

FINALIZING


--------------------------------------------------
## 199. USER TRADE TEST
--------------------------------------------------

When position becomes flat:

verify logs show:

GET USER TRADES

then:

USER TRADES FOUND

then:

FINAL P/L


If no closing fills are found:

do not blindly assume the P/L.


--------------------------------------------------
## 200. LONG P/L TEST
--------------------------------------------------

For LONG:

Entry:

BUY


Close:

SELL


Lifecycle should identify SELL closing fills.


--------------------------------------------------
## 201. SHORT P/L TEST
--------------------------------------------------

For SHORT:

Entry:

SELL


Close:

BUY


Lifecycle should identify BUY closing fills.


--------------------------------------------------
## 202. CHART MARKER TEST
--------------------------------------------------

Create/complete:

LONG cycle

Expected:

green upward arrow

below nearest 15m candle


Create/complete:

SHORT cycle

Expected:

red downward arrow

above nearest 15m candle


Create:

NEUTRAL cycle

Expected:

no marker


--------------------------------------------------
## 203. CHART MARKER TIMESTAMP TEST
--------------------------------------------------

Backend cycle example:

completedAt:

1790511517955


Frontend must:

1. read completedAt
2. normalize to Unix seconds
3. find nearest 15m candle
4. place marker there


If marker does not appear:

check:

cycle.decision

cycle.completedAt

chartData

normalized timestamp

nearest candle


--------------------------------------------------
## 204. PREVIOUS CYCLE SORT TEST
--------------------------------------------------

Create multiple completed cycles.

Expected:

newest completedAt first.

Oldest:

bottom


If order is wrong:

check:

Number(b.completedAt) -
Number(a.completedAt)


--------------------------------------------------
## 205. BOT MANAGEMENT TEST
--------------------------------------------------

Manual Entry Model START:

Bot flat

→ START allowed


Manual Entry Model STOP:

Engine running

→ STOP


Page refresh:

verify backend still reports actual engine state.


If UI says STOPPED but backend says RUNNING:

fix API/UI synchronization.

Do not stop the actual engine just to make the UI display correct.


--------------------------------------------------
## 206. BOT MANAGEMENT OPEN POSITION TEST
--------------------------------------------------

If position is already open:

manual Entry Model START should be blocked according to current design.

Expected:

Cannot start Entry Model while a position is open.


This does NOT mean:

an already-running Entry Model should be stopped.


--------------------------------------------------
## 207. DELETE BOT TEST
--------------------------------------------------

Delete bot.

Expected cleanup:

[ ] Entry Model stopped

[ ] lifecycle stopped

[ ] TP timers stopped

[ ] trigger timer stopped

[ ] bot removed


No background timer should continue running for the deleted bot.


--------------------------------------------------
## 208. TIMER DUPLICATION TEST
--------------------------------------------------

Start Entry Model.

Observe scans.

Then click START again if allowed.

Expected:

NO duplicate scan loops.


If scans suddenly occur twice as often:

likely duplicate engine timer.


--------------------------------------------------
## 209. STOP / RESTART TEST
--------------------------------------------------

Start:

Entry Model RUNNING


Stop:

Entry Model STOPPED


Then start again:

Entry Model RUNNING


Expected:

one active scan timer.

Not:

two timers.


--------------------------------------------------
## 210. API RESPONSE DEBUGGING
--------------------------------------------------

When UI state is wrong:

do not immediately modify React.

First inspect:

GET /api/bots


and relevant:

GET /api/bots/:id/...


Compare:

backend response

vs:

frontend property being read.


--------------------------------------------------
## 211. FRONTEND STATE DEBUGGING
--------------------------------------------------

If the UI shows the wrong state:

check:

1. API response
2. React state
3. polling interval
4. derived state
5. rendering condition


Example:

backend:

entryModelRunning = true


frontend:

looks for:

entryModelStatus === "RUNNING"


Then the UI may incorrectly display STOPPED.


--------------------------------------------------
## 212. DO NOT FIX BACKEND STATE WITH FAKE FRONTEND STATE
--------------------------------------------------

Bad:

setEntryModelRunning(true)

just because the button was clicked.


Correct:

call backend

backend starts engine

frontend refreshes engine state

frontend displays backend result.


--------------------------------------------------
## 213. WEEX DEBUG CHECKLIST
--------------------------------------------------

If an order fails:

CHECK:

[ ] symbol

[ ] direction

[ ] mark price

[ ] quantity

[ ] quantity step

[ ] leverage

[ ] margin mode

[ ] account balance

[ ] API response

[ ] WEEX error code

[ ] actual position


Do not guess the error.


--------------------------------------------------
## 214. ORDER SIZE DEBUG
--------------------------------------------------

Log:

symbol

markPrice

targetNotional

rawQuantity

roundedQuantity

stepSize

final quantity


Example:

POLUSDT

price = 0.1184

target = 10

raw = 84.45

step = 10

final = 90


This makes quantity problems easy to identify.


--------------------------------------------------
## 215. POSITION DEBUG
--------------------------------------------------

When checking a position:

log:

symbol

side

quantity

entry price

average price if available

number of positions returned


Trade Lifecycle should make it obvious whether it sees:

OPEN

or:

FLAT


--------------------------------------------------
## 216. IMPORTANT LIVE POSITION DEBUG
--------------------------------------------------

If the UI says:

OPEN

but WEEX says:

FLAT


trust the WEEX position endpoint.

Then investigate why internal state is stale.


--------------------------------------------------
## 217. IMPORTANT BOT STATE DEBUG
--------------------------------------------------

If the bot says:

currentPositionCount = 1

but WEEX says:

flat


do not automatically open another position.

First determine whether lifecycle reset has happened.

The internal state may simply be waiting for lifecycle finalization.


--------------------------------------------------
## 218. COMMON BUG: WRONG TIMESTAMP FIELD
--------------------------------------------------

Symptom:

previous cycle time appears empty

or:

chart markers don't appear.


Possible bug:

frontend uses:

cycle.timestamp


while backend provides:

cycle.completedAt


Fix:

use:

cycle.completedAt


--------------------------------------------------
## 219. COMMON BUG: MILLIS VS SECONDS
--------------------------------------------------

Symptom:

chart marker is far in the wrong location

or:

doesn't appear.


Possible cause:

using:

1790511517955

directly

where Lightweight Charts expects:

1790511517


Normalize milliseconds → seconds.


--------------------------------------------------
## 220. COMMON BUG: ENTRY MODEL STOPS AFTER ENTRY
--------------------------------------------------

Symptom:

LONG decision

→ Entry #1

→ Entry Model STOPPED


Check:

bots.js

for:

entryModelEngine.stopEngine(...)


The normal ENTER flow should not stop the Entry Model.


--------------------------------------------------
## 221. COMMON BUG: MULTIPLE LIFECYCLES
--------------------------------------------------

Symptom:

Entry #1 starts lifecycle

Entry #2 starts another lifecycle

Entry #3 starts another lifecycle


This is wrong.

Only:

tradeNumber === 1

should start the lifecycle.


--------------------------------------------------
## 222. COMMON BUG: FINALIZE TOO EARLY
--------------------------------------------------

Symptom:

lifecycle calculates P/L immediately after START.

Check:

wasPositionSeen


Lifecycle must first see a real active position.

Then:

active → flat


--------------------------------------------------
## 223. COMMON BUG: P/L = 0
--------------------------------------------------

Symptom:

final P/L unexpectedly zero.


Check:

- user trade query
- time range
- symbol
- close side
- realizedPnl field
- fills returned by WEEX


Do not immediately change lifecycle math.


--------------------------------------------------
## 224. COMMON BUG: UI STATE AFTER REFRESH
--------------------------------------------------

Symptom:

Before refresh:

Entry Model RUNNING


After refresh:

Entry Model STOPPED


Possible reason:

GET /api/bots does not expose live engine state.


Inspect API first.


--------------------------------------------------
## 225. COMMON BUG: DUPLICATE MANAGER
--------------------------------------------------

Symptom:

one component sees:

RUNNING


another sees:

STOPPED


or:

two cycle counters exist.


Possible cause:

multiple instances of a manager.


Check singleton imports and exports.


--------------------------------------------------
## 226. COMMON BUG: DUPLICATE TIMER
--------------------------------------------------

Symptom:

scans happen twice.

Possible cause:

startEngine called twice without safely handling an already-running engine.


Check timer lifecycle.


--------------------------------------------------
## 227. COMMON BUG: STALE ASYNC RESULT
--------------------------------------------------

Symptom:

engine is stopped but a scan result appears afterward.


Possible cause:

an async orderbook request completed after stopEngine().


When changing scan code:

protect against stale asynchronous work.


--------------------------------------------------
## 228. COMMON BUG: FRONTEND BECOMES TRADING ENGINE
--------------------------------------------------

Symptom:

EntryModel.jsx contains:

vote calculations

orderbook decisions

P/L calculations

position lifecycle logic


This is an architecture violation.

Move the logic back to backend ownership.


--------------------------------------------------
## 229. COMMON BUG: BOT ROUTE BECOMES GIANT ENGINE
--------------------------------------------------

Symptom:

bots.js contains:

all orderbook logic

all lifecycle logic

all chart logic

all P/L logic

all execution logic


This makes the project difficult to maintain.

Keep bots.js as the coordinator/controller.


--------------------------------------------------
## 230. COMMON BUG: OLD V3 CODE COPIED INTO V4
--------------------------------------------------

Symptom:

a fix introduces:

old TradingView webhook behavior

old V3 orderbook assumptions

old server_v3 architecture

old filters


Before copying old code:

verify whether the current v4 architecture actually needs it.


--------------------------------------------------
## 231. CURRENT HISTORICAL V3 CONTEXT
--------------------------------------------------

Older V3 project:

TradingView
→ webhook
→ server_v3.js
→ trading.js
→ WEEX


Current V4 project:

React
→ Express
→ backend engines/services
→ WEEX


These architectures should not be mixed accidentally.


--------------------------------------------------
## 232. ORDERBOOK ARCHITECTURE HISTORY
--------------------------------------------------

Historical V3 orderbook system:

one fresh 200-level snapshot

depths:

15
20
30
60

3-of-4 rule

CLOSE bypasses filter.


For current V4:

inspect actual Entry Model code before assuming this exact behavior.


--------------------------------------------------
## 233. TEST LOG PREFIXES
--------------------------------------------------

Recommended useful prefixes:

[Bot:<symbol>]

[Entry Model]

[TradeLifecycle]

[WEEX]

[Execution]

[TEST]


Example:

[Bot:POLUSDT] POSITION OPENED

[Entry Model] SCAN 4/10

[TradeLifecycle] POSITION DETECTED

[WEEX] GET POSITION

[Execution] OPEN ORDER


--------------------------------------------------
## 234. DEBUGGING WITH ONE SYMBOL
--------------------------------------------------

When debugging:

use one bot

one symbol

one direction

one small position


This keeps logs readable.


--------------------------------------------------
## 235. DEBUGGING WITH ONE PYRAMID
--------------------------------------------------

For first test:

Pyramid = 1


Then test:

Pyramid = 2


Then:

Pyramid = 3


Do not begin lifecycle debugging with all three entries at once.


--------------------------------------------------
## 236. SAFE DEVELOPMENT ORDER
--------------------------------------------------

Recommended:

1. Entry Model scan
2. Entry Model decision
3. Entry Model → ENTER
4. Position detection
5. Position flat detection
6. P/L
7. profit branch
8. loss branch
9. zero branch
10. pyramid #2
11. pyramid #3
12. UI polish


--------------------------------------------------
## 237. WHEN TESTING LIVE WEEX
--------------------------------------------------

Use the smallest practical position.

Confirm:

- symbol
- direction
- quantity
- leverage
- margin mode


before allowing the order.


--------------------------------------------------
## 238. DO NOT ASSUME TEST = SAFE
--------------------------------------------------

Even a tiny position is a real exchange action if connected to live WEEX.

Always verify:

symbol

side

quantity

before testing an order.


--------------------------------------------------
## 239. BEFORE RUNNING A LIVE TEST
--------------------------------------------------

Check:

[ ] Correct .env

[ ] Correct WEEX account

[ ] Correct symbol

[ ] Correct bot direction

[ ] Correct leverage

[ ] Correct margin

[ ] Correct pyramid max

[ ] No duplicate server

[ ] No duplicate Entry Model engine

[ ] No old bot still running


--------------------------------------------------
## 240. BACKEND START
--------------------------------------------------

Typical:

cd "D:\Trading Bots\trading_bot_v4_react\backend"

node server.js


Expected general startup:

WEEX Bot Lab backend running on port 3001


Exact log may vary.


--------------------------------------------------
## 241. FRONTEND START
--------------------------------------------------

Start the React development server using the project's configured package script.

Inspect:

package.json

for the current command.

Do not assume a specific Vite command if package.json has changed.


--------------------------------------------------
## 242. BACKEND HEALTH
--------------------------------------------------

Before testing trading:

confirm:

http://localhost:3001

or the project's health/API endpoint responds correctly.

Then open the frontend.


--------------------------------------------------
## 243. GIT BEFORE MAJOR CHANGE
--------------------------------------------------

Run:

cd "D:\Trading Bots\trading_bot_v4_react"

git status

git add .

git commit -m "Checkpoint before <change>"


Then:

git log -1 --oneline


--------------------------------------------------
## 244. IF SOMETHING BREAKS
--------------------------------------------------

Do not panic-refactor.

First:

git diff


Then identify the changed file.

If necessary:

git restore <file>


or restore from the checkpoint.

Only then continue.


--------------------------------------------------
## 245. AI HANDOFF PROCEDURE
--------------------------------------------------

When moving this project to another AI/chat:

send:

README Part 1
README Part 2
README Part 3
README Part 4


Then provide:

the exact current file

and:

the exact task.


Example:

"Read all four README parts.

Current task:

Fix Entry Model engine status in BotManagement.

I will send BotManagement.jsx next."


--------------------------------------------------
## 246. AI MUST ASK FOR ACTUAL FILE WHEN NECESSARY
--------------------------------------------------

If the README describes a file but the actual implementation is unclear:

ask for the file or inspect the available project files.

Do not reconstruct the file from memory.


--------------------------------------------------
## 247. AI MUST NOT INVENT MISSING CODE
--------------------------------------------------

Never assume:

function names

route names

response properties

class methods

WEEX response fields

unless confirmed by:

actual source

actual API response

or established project documentation.


--------------------------------------------------
## 248. AI SHOULD PRESERVE CURRENT WORKING CODE
--------------------------------------------------

When fixing a bug:

change the smallest possible section.

Do not rewrite unrelated working code.


--------------------------------------------------
## 249. COMPLETE FILE PREFERENCE
--------------------------------------------------

When user says:

"give me the whole file"

return the complete replacement file.

The user prefers this because it reduces:

- missing lines
- incorrect patch placement
- merge mistakes
- accidental partial edits


--------------------------------------------------
## 250. AFTER EVERY CODE CHANGE
--------------------------------------------------

Recommended response sequence:

1. State what changed.
2. Give complete file if requested.
3. Give exact command.
4. Give exact test.
5. Ask for the resulting log/output.


--------------------------------------------------
## 251. EXAMPLE TEST RESPONSE
--------------------------------------------------

Preferred:

"YES. This is the only change.

Replace:

backend/lifecycle/tradeLifecycle.js

with the file below.

Then run:

node server.js

Test:

1. Open POLUSDT position.
2. Close it.
3. Wait for lifecycle check.
4. Send me the logs starting at POSITION CHECK."


--------------------------------------------------
## 252. DO NOT GIVE FIVE TESTS AT ONCE
--------------------------------------------------

If the current task is one bug:

give one test.

After it passes:

move to the next.


--------------------------------------------------
## 253. PROJECT STATE CHECK
--------------------------------------------------

Before declaring a feature finished:

verify:

Backend

[ ] no syntax errors

[ ] server starts

[ ] expected route responds

[ ] timers behave correctly


Frontend

[ ] no console errors

[ ] correct state displayed

[ ] chart works


WEEX

[ ] expected position

[ ] expected quantity

[ ] expected close


Lifecycle

[ ] position detected

[ ] flat detected

[ ] P/L calculated

[ ] correct final state


--------------------------------------------------
## 254. CURRENT KNOWN ARCHITECTURE
--------------------------------------------------

The most important current architecture is:

                ┌───────────────────────┐
                │       React UI        │
                │                       │
                │ Bot Management        │
                │ Entry Model           │
                │ Charts                │
                └───────────┬───────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │    Express Backend    │
                │                       │
                │ routes/bots.js        │
                └───────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
      ┌────────────┐ ┌────────────┐ ┌──────────────┐
      │ Entry      │ │ Trade      │ │ Trade        │
      │ Model      │ │ Cycle      │ │ Lifecycle    │
      │ Engine     │ │ Manager    │ │              │
      └─────┬──────┘ └────────────┘ └──────┬───────┘
            │                               │
            └──────────────┬────────────────┘
                           ▼
                  ┌─────────────────┐
                  │ Execution Layer │
                  │                 │
                  │ orders.js       │
                  │ positions.js    │
                  │ weexClient.js   │
                  └────────┬────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    WEEX     │
                    │             │
                    │ LIVE TRUTH  │
                    └─────────────┘


--------------------------------------------------
## 255. SIMPLE TRADING LIFECYCLE
--------------------------------------------------

              ENTRY MODEL
                   │
                   ▼
             LONG / SHORT
                   │
                   ▼
                ENTER
                   │
                   ▼
             WEEX POSITION
                   │
         ┌─────────┼─────────┐
         │         │         │
         ▼         ▼         ▼
       #1        #2        #3
     Entry     Pyramid   Pyramid
         │         │         │
         └─────────┼─────────┘
                   │
                   ▼
              WEEX FLAT
                   │
                   ▼
             FINAL P/L
                   │
          ┌────────┼─────────┐
          │        │         │
          ▼        ▼         ▼
        PROFIT    LOSS      ZERO
          │        │         │
          ▼        ▼         ▼
       ACTIVE   KILLED     ACTIVE
          │
          ▼
   ENTRY MODEL RESTART


--------------------------------------------------
## 256. SIMPLE ENTRY MODEL LIFECYCLE
--------------------------------------------------

START
  │
  ▼
SCAN 1
  │
  ▼
SCAN 2
  │
  ▼
...
  │
  ▼
SCAN 10
  │
  ▼
VOTE
  │
  ├───────────────┐
  │               │
  ▼               ▼
LONG/SHORT      NEUTRAL
  │               │
  ▼               │
ENTER             │
  │               │
  └───────┬───────┘
          ▼
      NEW CYCLE
          │
          ▼
       SCAN 1...


--------------------------------------------------
## 257. FINAL NON-NEGOTIABLE RULES
--------------------------------------------------

RULE 1:

Backend owns trading state.


RULE 2:

React is not the trading engine.


RULE 3:

WEEX is the source of truth for the live position.


RULE 4:

Entry Model and Trade Lifecycle are different systems.


RULE 5:

One trading lifecycle can contain up to three pyramid entries.


RULE 6:

Lifecycle starts on the first entry only.


RULE 7:

Lifecycle finishes only after a real position was seen and WEEX becomes flat.


RULE 8:

Final P/L comes from relevant exchange trade fills.


RULE 9:

Profit → ACTIVE + Entry Model restart.


RULE 10:

Loss → KILLED + no automatic restart.


RULE 11:

Zero → ACTIVE + no automatic restart.


RULE 12:

Entry Model does not stop automatically after Entry #1.


RULE 13:

Maximum pyramid count is 3.


RULE 14:

Do not calculate final P/L in React.


RULE 15:

Do not invent WEEX API behavior.


RULE 16:

Do not mix old V3 architecture into V4 without verification.


RULE 17:

One code change at a time.


RULE 18:

Test after every change.


RULE 19:

When in doubt, inspect the actual source code.


RULE 20:

The actual current source code is more authoritative than this README.


--------------------------------------------------
## 258. CURRENT PROJECT MEMORY
--------------------------------------------------

Current project:

WEEX Bot Lab v4 React

Location:

D:\Trading Bots\trading_bot_v4_react


Backend:

Node.js + Express


Frontend:

React


Exchange:

WEEX USDT-M Futures


Backend port:

3001


Current Entry Model:

10 scans

60 seconds per scan

6/10 votes required


Current pyramid:

1–3


Current lifecycle:

30-second position polling


Current test sizing:

approximately 1 USDT margin

10x leverage

approximately 10 USDT notional

ISOLATED


Current important frontend:

BotManagement.jsx

EntryModel.jsx


Current important backend:

server.js

routes/bots.js

entry-models/entryModelEngine.js

cycle/tradeCycleManager.js

lifecycle/tradeLifecycle.js

execution/orders.js

execution/positions.js

execution/weexClient.js


--------------------------------------------------
## 259. CURRENT DEVELOPMENT PHILOSOPHY
--------------------------------------------------

Build slowly.

Test every change.

Keep responsibilities separate.

Use live exchange state where it matters.

Do not hide problems with frontend state.

Do not over-engineer.

Do not rewrite working systems unnecessarily.

Caveman Turbo:

ONE CHANGE

ONE TEST

ONE RESULT


--------------------------------------------------
## 260. END OF README
--------------------------------------------------