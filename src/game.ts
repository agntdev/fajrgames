import type { Ctx } from "./bot.js";

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";
export const RARITIES: readonly Rarity[] = ["Common", "Rare", "Epic", "Legendary"];

export interface Item {
  id: string; name: string; imageUrl?: string; rarity: Rarity; value: number;
  description: string; tradable: boolean; unique: boolean;
}
export interface Box { id: string; name: string; imageUrl?: string; price: number; drops: { itemId: string; probability: number }[] }
export interface User {
  id: number; username?: string; name: string; gems: number; xp: number;
  boxesOpened: number; joined: string; lastClaim?: string; streak: number;
  collectionValue: number; lastOpened?: string; boxOpens?: number[]; tradeStarts?: number[];
}
export interface Inventory { id: string; userId: number; itemId: string; quantity: number; serials: string[]; acquired: string }
export interface Trade {
  id: string; proposer: number; responder: number; offered: string[]; status:
  "PROPOSED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  created: string; expires: string; proposerConfirmed?: boolean; responderConfirmed?: boolean;
}
export interface Audit { id: string; at: string; actor: number; action: string; detail: string; idempotencyToken: string }
export interface GameState {
  users: Record<string, User>; items: Record<string, Item>; boxes: Record<string, Box>;
  inventory: Record<string, Inventory>; trades: Record<string, Trade>; audits: Audit[];
  paused: Record<string, boolean>; userIds: number[];
}

const items: Item[] = [
  ["spark", "Tiny Spark", "Common", 10, "A little glow with big collector energy."],
  ["leaf", "Lucky Leaf", "Common", 12, "A tiny leaf that always lands lucky."],
  ["pixel", "Rainbow Pixel", "Common", 15, "A bright little bit of digital confetti."],
  ["pebble", "Moon Pebble", "Common", 18, "Smooth, quiet, and full of moonlight."],
  ["moon", "Moon Chip", "Rare", 40, "A cool chip cut from moonlight."],
  ["feather", "Sky Feather", "Rare", 55, "It remembers every cloud it has visited."],
  ["prism", "Pocket Prism", "Rare", 70, "Catches luck from every direction."],
  ["comet", "Comet Core", "Epic", 120, "Still warm from a very fast trip."],
  ["portal", "Pocket Portal", "Epic", 150, "A tiny doorway to somewhere sparkly."],
  ["dragon", "Dragon Scale", "Epic", 200, "A scale from a very generous dragon."],
  ["crown", "Star Crown", "Legendary", 500, "The crown every lucky collector wants."],
  ["phoenix", "Phoenix Feather", "Legendary", 750, "A one-of-a-kind spark that refuses to fade."],
].map(([id, name, rarity, value, description]) => ({
  id: id as string, name: name as string, rarity: rarity as Rarity, value: value as number,
  imageUrl: `https://placehold.co/600x600/png?text=${encodeURIComponent(name as string)}`,
  description: description as string, tradable: true, unique: rarity === "Epic" || rarity === "Legendary",
}));

const boxes: Box[] = [{
  id: "lucky", name: "LuckyBox", price: 50,
  drops: [
    { itemId: "spark", probability: .30 }, { itemId: "leaf", probability: .20 },
    { itemId: "pixel", probability: .15 }, { itemId: "pebble", probability: .10 },
    { itemId: "moon", probability: .10 }, { itemId: "feather", probability: .05 },
    { itemId: "prism", probability: .03 }, { itemId: "comet", probability: .03 },
    { itemId: "portal", probability: .015 }, { itemId: "dragon", probability: .01 },
    { itemId: "crown", probability: .005 }, { itemId: "phoenix", probability: .005 },
  ],
}];

export let now: () => Date = () => new Date();
export function setNowForTests(clock: () => Date): void { now = clock; }
function iso(): string { return now().toISOString(); }
function day(): string { return iso().slice(0, 10); }
function id(prefix: string): string {
  const bytes = new Uint8Array(12); crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function seed(): GameState {
  return { users: {}, items: Object.fromEntries(items.map((x) => [x.id, x])), boxes: Object.fromEntries(boxes.map((x) => [x.id, x])), inventory: {}, trades: {}, audits: [], paused: {}, userIds: [] };
}

type D1 = { prepare(sql: string): { run(): Promise<unknown>; bind(...args: unknown[]): { first<T>(): Promise<T | undefined>; run(): Promise<unknown> } } };
type RuntimeCtx = Ctx & { env?: { DB?: D1 } };
async function readState(ctx: RuntimeCtx): Promise<GameState> {
  const db = ctx.env?.DB;
  if (db) {
    await db.prepare("CREATE TABLE IF NOT EXISTS fajr_state (id TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
    const row = await db.prepare("SELECT value FROM fajr_state WHERE id=?").bind("global").first<{ value: string }>();
    return row ? JSON.parse(row.value) as GameState : seed();
  }
  // Tokenless tests have no database binding; this is only an ephemeral harness adapter.
  return ctx.session.gameState ?? seed();
}
async function writeState(ctx: RuntimeCtx, state: GameState): Promise<void> {
  const db = ctx.env?.DB;
  if (db) { await db.prepare("INSERT INTO fajr_state(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind("global", JSON.stringify(state)).run(); return; }
  ctx.session.gameState = state;
}

export async function withState<T>(ctx: Ctx, fn: (state: GameState, user: User) => Promise<T> | T): Promise<T> {
  const c = ctx as RuntimeCtx; const state = await readState(c); const from = ctx.from;
  const uid = from?.id ?? ctx.chat?.id ?? 0; const key = String(uid);
  let user = state.users[key];
  if (!user) {
    user = { id: uid, username: from?.username, name: [from?.first_name, from?.last_name].filter(Boolean).join(" ") || "Player", gems: 100, xp: 0, boxesOpened: 0, joined: iso(), streak: 0, collectionValue: 0, boxOpens: [], tradeStarts: [] };
    state.users[key] = user; state.userIds.push(uid);
  }
  user.boxOpens ??= []; user.tradeStarts ??= [];
  user.username = from?.username ?? user.username;
  user.name = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || user.name;
  const result = await fn(state, user); await writeState(c, state); return result;
}
export function inventoryFor(state: GameState, userId: number): Inventory[] { return Object.values(state.inventory).filter((x) => x.userId === userId); }
export function addAudit(state: GameState, actor: number, action: string, detail: string, idempotencyToken = id("op")): void {
  state.audits.push({ id: id("audit"), at: iso(), actor, action, detail, idempotencyToken });
  if (state.audits.length > 500) state.audits.splice(0, state.audits.length - 500);
}
export function addItem(state: GameState, user: User, item: Item, quantity = 1): Inventory {
  const existing = Object.values(state.inventory).find((x) => x.userId === user.id && x.itemId === item.id && !item.unique);
  if (existing) { existing.quantity += quantity; return existing; }
  const entry: Inventory = { id: id("inv"), userId: user.id, itemId: item.id, quantity, serials: Array.from({ length: quantity }, () => id("instance")), acquired: iso() };
  state.inventory[entry.id] = entry; return entry;
}
export function choose(box: Box): string {
  const r = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; let total = 0;
  for (const drop of box.drops) { total += drop.probability; if (r < total) return drop.itemId; }
  return box.drops[box.drops.length - 1]?.itemId ?? "";
}
export function publicName(user: User): string { return user.username ? `@${user.username}` : user.name; }
export function today(): string { return day(); }
export function isValidRarity(value: string): value is Rarity { return RARITIES.includes(value as Rarity); }
