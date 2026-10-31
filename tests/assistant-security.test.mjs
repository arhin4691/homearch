import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";

function load(relativePath, mocks) {
  const filename = path.resolve(relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = mod.require.bind(mod);
  mod.require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name);
  mod._compile(source, filename);
  return mod.exports;
}

const tools = load("src/lib/assistant-tools.ts", {
  "@/lib/constants": { ITEM_CATEGORIES: ["Food", "Drinks", "Other"] },
});
const { parseSpokenQuantity } = load("src/lib/voice-quantity.ts", {});

test("voice quantities require exact numerical evidence", () => {
  for (const [source, expected] of [["兩", 2], ["兩隻", 2], ["6支", 6], ["廿三", 23], ["半打", 6], ["兩打", 24], ["6", 6]]) {
    assert.equal(parseSpokenQuantity(source), expected);
  }
  for (const source of ["幾", "幾隻", "啲", "半", "0", "十百"]) assert.equal(parseSpokenQuantity(source), null);
});

test("assistant tools reject unknown names, family IDs and query operators", () => {
  assert.equal(tools.parseAssistantTool({ name: "drop_database", arguments: {} }), null);
  assert.equal(tools.parseAssistantTool({ name: "list_inventory", arguments: { familyId: "other" } }), null);
  assert.equal(tools.parseAssistantTool({ name: "search_inventory", arguments: { name: { $ne: null } } }), null);
  assert.equal(tools.parseAssistantTool({ name: "deduct_item", arguments: { name: "Egg", quantity: -1 } }), null);
  assert.equal(tools.parseAssistantTool({ name: "increase_item", arguments: { name: "Egg", quantity: 1, familyId: "other" } }), null);
  assert.equal(tools.parseAssistantTool({ name: "increase_item", arguments: { name: "Egg", quantity: "2" } }), null);
  assert.ok(tools.parseAssistantTool({ name: "increase_item", arguments: { name: "Egg", quantity: 2 } }));
  assert.ok(tools.parseAssistantTool({ name: "deduct_item", arguments: { name: "Egg", quantity: 2 } }));
});

const familyA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const familyB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const userId = "cccccccccccccccccccccccc";
const proposalId = "111111111111111111111111";
const itemId = "222222222222222222222222";
const revision = new Date("2026-01-01T00:00:00Z");
let family;
let proposal;
let item;

const scopeMatches = (scope) => scope._id === proposalId && scope.familyId === proposal.familyId && scope.userId === userId;
const AssistantProposal = {
  findOneAndUpdate: (query) => ({ lean: async () => {
    if (!scopeMatches(query) || proposal.status !== "pending" || proposal.expiresAt <= new Date()) return null;
    proposal.status = "executing";
    return { ...proposal };
  } }),
  exists: async (scope) => scopeMatches(scope),
  updateOne: async (scope, update) => {
    if (scopeMatches(scope) && proposal.status === scope.status) proposal.status = update.$set.status;
  },
};
const Item = {
  updateOne: async (filter, update) => {
    if (filter._id !== itemId || filter.familyId !== item.familyId || filter.quantity !== item.quantity ||
        filter.updatedAt.getTime() !== item.updatedAt.getTime()) return { matchedCount: 0 };
    Object.assign(item, update[0].$set);
    item.updatedAt = new Date(item.updatedAt.getTime() + 1);
    return { matchedCount: 1 };
  },
};
const route = load("src/app/api/assistant/confirm/route.ts", {
  "@/lib/session": { getSession: async () => ({ userId }) },
  "@/lib/mongodb": { connectDB: async () => {} },
  "@/lib/api-response": {
    apiSuccess: (data) => ({ status: 200, data }),
    apiError: (error, status = 400) => ({ status, error }),
  },
  "@/models/User": { User: {
    findById: () => ({ select: () => ({ lean: async () => ({ _id: userId, familyId: family }) }) }),
    exists: async (query) => query.familyId === family,
  } },
  "@/models/Item": { Item },
  "@/models/AssistantProposal": { AssistantProposal },
  "@/lib/imagekit": { deleteImageKitFile: async () => {} },
  "@/lib/inventory-update": { inventoryUpdatePipeline: (fields) => [{ $set: fields }] },
});
const request = (body) => ({ json: async () => body });

test.beforeEach(() => {
  family = familyA;
  proposal = {
    _id: proposalId, familyId: familyA, userId, itemId, expectedUpdatedAt: revision, expectedQuantity: 6,
    action: "deduct", fields: { quantity: 4 }, status: "pending",
    expiresAt: new Date(Date.now() + 60000),
  };
  item = { familyId: familyA, quantity: 6, updatedAt: revision };
});

test("confirmation is required and concurrent submissions only apply once", async () => {
  assert.equal((await route.POST(request({ id: proposalId }))).status, 422);
  assert.equal(item.quantity, 6);
  const results = await Promise.all([
    route.POST(request({ id: proposalId, confirm: true })),
    route.POST(request({ id: proposalId, confirm: true })),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal(item.quantity, 4);
});

test("family switch blocks access to old proposals", async () => {
  family = familyB;
  assert.equal((await route.POST(request({ id: proposalId, confirm: true }))).status, 404);
  assert.equal(item.quantity, 6);
});

test("changed inventory cannot be modified using an old preview", async () => {
  item.updatedAt = new Date(revision.getTime() + 10);
  assert.equal((await route.POST(request({ id: proposalId, confirm: true }))).status, 409);
  assert.equal(item.quantity, 6);
  assert.equal(proposal.status, "failed");
});
