import type { Ctx } from "./bot.js";

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";
export interface Item { id: string; name: string; rarity: Rarity; value: number; description: string; tradable: boolean; unique: boolean; imageUrl?: string }
export interface Box { id: string; name: string; price: number; drops: { itemId: string; probability: number }[] }
export interface User { id: number; username?: string; name: string; gems: number; xp: number; boxesOpened: number; joined: string; lastClaim?: string; streak: number; collectionValue: number; boxOpens?: number[]; tradeStarts?: number[] }
export interface Inventory { id: string; userId: number; itemId: string; quantity: number; serials: string[]; acquired: string }
export interface Trade { id: string; proposer: number; responder: number; offered: string[]; status: "PROPOSED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "EXPIRED"; created: string; expires: string; proposerConfirmed?: boolean; responderConfirmed?: boolean }
export interface Audit { id: string; at: string; actor: number; action: string; detail: string }
export interface GameState { users: Record<string, User>; items: Record<string, Item>; boxes: Record<string, Box>; inventory: Record<string, Inventory>; trades: Record<string, Trade>; audits: Audit[]; paused: Record<string, boolean>; userIds: number[] }

const DEFAULT_ITEMS: Item[] = [
  { id: "spark", name: "Tiny Spark", rarity: "Common", value: 10, description: "A little glow with big collector energy.", tradable: true, unique: false },
  { id: "moon", name: "Moon Chip", rarity: "Rare", value: 40, description: "A cool chip cut from moonlight.", tradable: true, unique: false },
  { id: "comet", name: "Comet Core", rarity: "Epic", value: 120, description: "Still warm from a very fast trip.", tradable: true, unique: true },
  { id: "crown", name: "Star Crown", rarity: "Legendary", value: 500, description: "The crown every lucky collector wants.", tradable: true, unique: true },
];
const DEFAULT_BOXES: Box[] = [{ id: "lucky", name: "LuckyBox", price: 50, drops: [{ itemId: "spark", probability: .75 }, { itemId: "moon", probability: .20 }, { itemId: "comet", probability: .045 }, { itemId: "crown", probability: .005 }] }];

export function now(): Date { return new Date(); }
function iso(): string { return now().toISOString(); }
function day(): string { return iso().slice(0, 10); }
function id(prefix: string): string { const bytes = new Uint8Array(10); crypto.getRandomValues(bytes); return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`; }
function seed(): GameState { return { users: {}, items: Object.fromEntries(DEFAULT_ITEMS.map((x) => [x.id, x])), boxes: Object.fromEntries(DEFAULT_BOXES.map((x) => [x.id, x])), inventory: {}, trades: {}, audits: [], paused: {}, userIds: [] }; }

type RuntimeCtx = Ctx & { env?: { DB?: { prepare(sql: string): { run(): Promise<unknown>; bind(...args: unknown[]): { first<T>(): Promise<T | undefined>; run(): Promise<unknown> } } } } };
async function readState(ctx: RuntimeCtx): Promise<GameState> {
  const db = ctx.env?.DB;
  if (db) {
    try {
      await db.prepare("CREATE TABLE IF NOT EXISTS luckybox_state (id TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
      const row = await db.prepare("SELECT value FROM luckybox_state WHERE id=?").bind("global").first<{ value: string }>();
      return row ? JSON.parse(row.value) as GameState : seed();
    } catch { /* A local harness may expose no D1 schema. */ }
  }
  return ctx.session.gameState ?? seed();
}
async function writeState(ctx: RuntimeCtx, state: GameState): Promise<void> {
  const db = ctx.env?.DB;
  if (db) {
    try { await db.prepare("INSERT INTO luckybox_state(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind("global", JSON.stringify(state)).run(); return; } catch { /* fall through for a tokenless harness */ }
  }
  ctx.session.gameState = state;
}
export async function withState<T>(ctx: Ctx, fn: (state: GameState, user: User) => Promise<T> | T): Promise<T> {
  const c = ctx as RuntimeCtx;
  const state = await readState(c);
  const from = ctx.from;
  const uid = from?.id ?? ctx.chat?.id ?? 0;
  const key = String(uid);
  let user = state.users[key];
  if (!user) { user = { id: uid, username: from?.username, name: [from?.first_name, from?.last_name].filter(Boolean).join(" ") || "Player", gems: 100, xp: 0, boxesOpened: 0, joined: iso(), streak: 0, collectionValue: 0, boxOpens: [], tradeStarts: [] }; state.users[key] = user; state.userIds.push(uid); }
  user.boxOpens ??= []; user.tradeStarts ??= [];
  user.username = from?.username ?? user.username;
  user.name = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || user.name;
  const result = await fn(state, user);
  await writeState(c, state);
  return result;
}
export function inventoryFor(state: GameState, userId: number): Inventory[] { return Object.values(state.inventory).filter((x) => x.userId === userId); }
export function addAudit(state: GameState, actor: number, action: string, detail: string): void { state.audits.push({ id: id("audit"), at: iso(), actor, action, detail }); if (state.audits.length > 500) state.audits.splice(0, state.audits.length - 500); }
export function addItem(state: GameState, user: User, item: Item, quantity = 1): Inventory { const existing = Object.values(state.inventory).find((x) => x.userId === user.id && x.itemId === item.id && !item.unique); if (existing) { existing.quantity += quantity; return existing; } const entry: Inventory = { id: id("inv"), userId: user.id, itemId: item.id, quantity, serials: item.unique ? Array.from({ length: quantity }, () => id("serial")) : [], acquired: iso() }; state.inventory[entry.id] = entry; return entry; }
export function choose(box: Box): string { const r = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; let total = 0; for (const drop of box.drops) { total += drop.probability; if (r < total) return drop.itemId; } return box.drops[box.drops.length - 1]?.itemId ?? ""; }
export function publicName(user: User): string { return user.username ? `@${user.username}` : user.name; }
export function today(): string { return day(); }
