# FajrGames — LuckyBox — Bot specification

**Archetype:** custom

**Voice:** playful and casual — write every user-facing message, button label, error, and empty state in this voice.

A Telegram game-bot where casual players earn Gems, buy and open mystery Boxes to receive collectible Items of four rarities, manage and trade inventory, claim daily rewards, and compete on leaderboards. The bot uses server-side, auditable transactions, an admin channel for configuration, and an extendable model so new games or boxes can be added later.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Casual Telegram users who enjoy mystery-box / gacha mechanics
- Collectors who like rarity-based progression and unique serialised items
- Social players who trade and compete on leaderboards

## Success criteria

- Users can open Boxes and receive Items with inventory updates persisted across restarts
- Trades complete as atomic swaps (no duplication or loss) and expire if not confirmed in time
- Daily reward can be claimed and streaks are tracked and applied correctly
- Admin (ADMIN_CHAT_ID) can create/edit/delete Items and Boxes, grant Gems/items, and receive critical alerts
- Leaderboards show top-100 by collection value and update within minutes of relevant actions
- Audit logs exist for all currency/item grants and admin actions; rate limits prevent obvious abuse

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and onboarding tiles (LuckyBox, Inventory, Shop, Gems, Trade, Profile, Leaderboard, Daily Reward)
  - outputs: Main menu message with inline keyboard (🎁 LuckyBox, 🎒 Inventory, 🛒 Shop, 💎 Gems, 🔄 Trade, 👤 Profile, 🏆 Leaderboard, 🎁 Daily Reward)
- **/help** (command, actor: user, command: /help) — Show short usage tips and admin contact info
  - outputs: Help text in bot voice, links to main menu buttons, brief trade safety and persistence note
- **🎁 LuckyBox** (button, actor: user, callback: boxes:list) — Browse available boxes and start a purchase/open flow
  - outputs: Paginated list of boxes (thumbnail, price, rarity summary) with 'Buy' buttons and 'Details' callbacks
- **🎒 Inventory** (button, actor: user, callback: inventory:view) — Open paginated inventory with filters and item actions
  - outputs: Inventory pages, filter buttons (rarity), item detail callbacks with trade/sell/share actions
- **🔄 Trade** (button, actor: user, callback: trade:start) — Start a two-step secure trade with another user
  - inputs: Opponent username or forwarded message to identify trade target (ForceReply or @username)
  - outputs: Trade proposal created, notifications to proposer and responder, inline Confirm/Cancel buttons
- **🎁 Daily Reward** (button, actor: user, callback: daily:claim) — Claim daily Gems and update streak
  - outputs: Claim result, updated streak and gem balance, next-claim info

## Flows

### Box purchase and open
_Trigger:_ callback: boxes:list -> user taps 'Buy' then confirms

1. Validate user Gems balance and rate limit
2. Show confirmation prompt with 'Confirm' and 'Cancel' buttons
3. On Confirm: start server-side transaction - deduct Gems, sample drop table atomically, create InventoryEntry (with serial if unique), log transaction
4. Send opening animation sequence messages (e.g., '🎁 Opening LuckyBox...', '🔮 Finding your reward...', '✨ You got…') with timed edits or sequential messages
5. Reveal item with image, rarity badge, description and item-specific actions (Share, Open another, Add to trade)
6. If transaction fails, refund or restore balance and notify user + admin if critical

_Data touched:_ User (gems, XP, last_active), Box (price, drop table), Item (id, serials), InventoryEntry, AuditLog

### Inventory browse and item actions
_Trigger:_ callback: inventory:view

1. Fetch paginated inventory entries for user
2. Render page with thumbnails, quantity stacks, filter buttons (All/Common/Rare/Epic/Legendary)
3. Item detail callback shows metadata, serial, tradable flag, and action buttons (Offer for Trade, Sell if enabled, Share)
4. Selecting items for trade marks them in session; confirm sends a trade proposal

_Data touched:_ InventoryEntry, User, Trade (when proposed)

### Secure two-step trade
_Trigger:_ command/button: trade:start or incoming trade proposal

1. Proposer selects opponent and chooses items from inventory (session reservation, short expiry)
2. Create Trade record with offered_items, requested_items (optional), status=PROPOSED, expiry timestamp; notify responder
3. Responder reviews offer, can add counter-offer (creates new offer or updates existing within expiry)
4. When both parties press 'Confirm', server verifies ownership and quantities again and performs atomic swap: remove items from each inventory, create new InventoryEntries, log transaction, mark Trade as COMPLETED
5. If expiry reached or either party cancels, release reservations and mark Trade as EXPIRED/CANCELLED

_Data touched:_ Trade, InventoryEntry, AuditLog, User (last_active)

### Daily reward claim and streak
_Trigger:_ callback: daily:claim

1. Fetch DailyClaim for user, validate last_claim_date against current date
2. If eligible compute reward from configurable reward table and streak logic
3. Server-side add Gems and increment streak or reset, log action
4. Return claim result with streak progress and next reward preview

_Data touched:_ DailyClaim, User (gems, streak_count), AuditLog

### Shop: buy single items or boxes
_Trigger:_ callback: shop:view -> user taps item/box

1. Show item/box detail with Buy button
2. On Buy: confirm funds, perform transaction similar to Box purchase (for single-item purchases: create InventoryEntry directly)
3. Notify user and log transaction

_Data touched:_ User, Box, Item, InventoryEntry, AuditLog

### Admin management via ADMIN_CHAT_ID
_Trigger:_ incoming message from ADMIN_CHAT_ID or admin-only inline menus

1. Admin authenticates by admin chat id (platform-provided mapping)
2. Admin can create/edit/delete Items and Boxes, set drop rates and prices, grant/revoke Gems or items to users, pause/unpause features
3. All admin actions recorded in AuditLog and send confirmation to ADMIN_CHAT_ID and to affected user(s) if applicable

_Data touched:_ Item, Box, User, AuditLog

### Leaderboard view and paging
_Trigger:_ callback: leaderboard:view

1. Compute top-100 by collection value (cached for short window, e.g., 5 minutes)
2. Return paginated leaderboard with tie-breaker boxes opened; allow tapping a user to view public profile stats
3. Rate-limit leaderboard recompute and cache results

_Data touched:_ User (collection value, boxes_opened), Computed cache

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat id where admin notifications and admin commands are accepted
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User** _(retention: persistent)_ — Player account details and balances
  - fields: id (telegram id), username, display_name, gems_balance, xp, boxes_opened, join_timestamp, last_active_timestamp, settings (notifications, privacy)
- **Item** _(retention: persistent)_ — Catalogue entry for collectible items
  - fields: id, name, image_url, rarity (Common,Rare,Epic,Legendary), value (numeric), description, metadata { tradable: bool, unique_serial_enabled: bool }
- **Box** _(retention: persistent)_ — A purchasable box with a drop table
  - fields: id, name, image_url, price_gems, drop_table (array of {item_id, probability}), open_animation_sequence
- **InventoryEntry** _(retention: persistent)_ — A user's owned item instance or stack
  - fields: id, user_id, item_id, quantity, serials (array of serial ids for unique instances), acquired_at
- **Trade** _(retention: persistent)_ — Trade proposal and lifecycle
  - fields: trade_id, proposer_id, responder_id, offered_items (list of inventory ids and quantities), requested_items (optional), status (PROPOSED, CONFIRMED, COMPLETED, CANCELLED, EXPIRED), created_at, expires_at
- **DailyClaim** _(retention: persistent)_ — Tracks last daily claim and streaks
  - fields: user_id, last_claim_date (ISO date), streak_count
- **AuditLog** _(retention: persistent)_ — Append-only audit records for currency, item grants, admin changes, and trades
  - fields: id, timestamp, actor_id (user or admin), action_type, payload (details), result

## Integrations

- **Telegram** (required) — Bot API messaging, inline keyboards, callback queries, user identity
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set ADMIN_CHAT_ID (admin mailbox for alerts and admin commands)
- Create / edit / delete Item and Box records (name, image_url, value, tradable flag, drop probabilities)
- Adjust box prices and entire economy parameters (default box price and drop rates)
- Configure daily reward table and streak bonuses
- Grant or remove Gems or Items to/from any user
- Pause/unpause specific features (box buying, trading, daily claim)
- View audit logs, user stats, and rate-limit metrics

## Notifications

- Notify ADMIN_CHAT_ID on critical errors (failed transactions, DB errors, potential exploit attempts)
- Notify ADMIN_CHAT_ID on manual grants and admin-initiated item/box changes (audit confirmation)
- User notifications for trade proposals, trade completions, trade expiries, daily-claim success/failure, and box-open results (in chat)
- Optional ephemeral success messages (e.g., 'Gems added') and system rate-limit warnings

## Permissions & privacy

- Store Telegram id, username, and display name to identify accounts and public profiles
- Store inventory, balances, and activity timestamps; this data is used for gameplay and leaderboards
- Admin (ADMIN_CHAT_ID) can view and act on user records; admin actions are logged
- No external personal data sharing or paid-payment integrations by default
- Image URLs for Items are stored; hosting policy (owner-provided or public URLs) must be specified by owner

## Edge cases

- User has insufficient Gems at confirmation time (transactions must revalidate and abort cleanly)
- Concurrent box opens or trades causing race conditions — must be prevented by server-side locks/transactions
- User blocks or deletes bot after a pending trade or admin grant — system must handle unreachable recipients and still log actions
- Trade responder never confirms and trade expires — reservations released; users notified
- Duplicate serial generation risk — require server-side uniqueness check (collision handling)
- Item image URL unreachable — show fallback thumbnail and log incident
- Bot removed from group or message delivery failures — retry policy and admin alert
- Rate-limit triggered (too many opens/trades) — return friendly rate-limit message and advice
- Admin misconfiguration of drop tables creating sum != 1.0 — validation and rejection on save

## Required tests

- Dialog-level acceptance test: buy and open a box end-to-end — gems deducted, item created in inventory, audit log entry created, opening messages displayed in order
- Inventory persistence test: item remains after simulated restart and can be selected for trade
- Trade atomicity test: proposer and responder swap items and quantities precisely; no duplication or loss under concurrent attempts
- Daily claim test: cannot claim twice in same day; streak increments and rewards applied correctly
- Admin action test: ADMIN_CHAT_ID can create/edit a box and change drop rates; change reflected in subsequent box opens
- Rate-limit test: enforce limits on box openings and trade proposals and return correct user-facing errors
- Leaderboards test: top-100 computed and cached; tie-breaker boxes_opened applied consistently

## Assumptions

- Rarity set is exactly Common, Rare, Epic, Legendary and is fixed by default but can be extended via admin
- Default drop rates (Legendary 0.5%, Epic 4.5%, Rare 20%, Common 75%) and default box price (50 Gems) are acceptable starting defaults and editable by admin
- Gems are in-game currency only; no real-money transactions or payment providers are required
- Admin will provide or approve item image URLs; the platform does not host large media without owner consent
- Single ADMIN_CHAT_ID is sufficient for admin workflows at launch
- Free/open-source stack provisioning (DB, host) is handled outside this blueprint
