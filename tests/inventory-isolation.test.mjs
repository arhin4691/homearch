import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";

const familyA = "aaaaaaaaaaaaaaaaaaaaaaaa";
const familyB = "bbbbbbbbbbbbbbbbbbbbbbbb";
const itemId = "111111111111111111111111";
const locationA = "222222222222222222222222";
const locationB = "333333333333333333333333";
let family = familyA;
let items;

const user = () => ({ _id: "444444444444444444444444", familyId: family });
const match = (item, query) => item._id === query._id && item.familyId === query.familyId;
const Item = {
  exists: async (query) => items.some((item) => match(item, query)),
  create: async (data) => {
    const item = { ...data, _id: "555555555555555555555555" };
    items.push(item);
    return item;
  },
  findOneAndUpdate: async (query, update) => {
    const item = items.find((entry) => match(entry, query));
    if (!item) return null;
    if (Array.isArray(update)) {
      const fields = update[0].$set;
      if (fields.quantity?.$add) {
        const delta = fields.quantity.$add[1];
        if (item.quantity + delta < 0) return null;
        item.quantity += delta;
      } else {
        Object.assign(item, fields);
        if (item.locationId) item.locationId = item.locationId.toString();
      }
    } else {
      Object.assign(item, update.$set);
    }
    return item;
  },
  findOneAndDelete: async (query) => {
    const index = items.findIndex((entry) => match(entry, query));
    return index < 0 ? null : items.splice(index, 1)[0];
  },
};

function loadRoute(relativePath) {
  const filename = path.resolve(relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = mod.require.bind(mod);
  const mocks = {
    "@/lib/session": { getSession: async () => ({ userId: "444444444444444444444444" }) },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/models/Item": { Item, ITEM_CATEGORIES: ["Food", "Drinks", "Other"] },
    "@/models/User": { User: {
      findById: () => ({ lean: async () => user() }),
      find: () => ({ select: () => ({ lean: async () => [] }) }),
    } },
    "@/models/Location": {
      Location: { exists: async (query) =>
        (query._id === locationA && query.familyId === familyA) ||
        (query._id === locationB && query.familyId === familyB) },
    },
    "@/models/Notification": { Notification: {
      findOne: async () => ({}),
      insertMany: async () => {},
    } },
    "@/models/ProductDictionary": { ProductDictionary: {} },
    "@/lib/notify-family": { notifyFamily: async () => {} },
    "@/lib/imagekit": { deleteImageKitFile: async () => {} },
    "@/lib/inventory-update": {
      inventoryUpdatePipeline: (fields, expressions = {}) => [{ $set: { ...fields, ...expressions } }],
    },
    "@/lib/api-response": {
      apiSuccess: (data, status = 200) => ({ status, data }),
      apiError: (error, status = 500) => ({ status, error }),
    },
  };
  mod.require = (name) => Object.hasOwn(mocks, name) ? mocks[name] : nativeRequire(name);
  mod._compile(source, filename);
  return mod.exports;
}

const itemRoute = loadRoute("src/app/api/items/[id]/route.ts");
const itemsRoute = loadRoute("src/app/api/items/route.ts");
const quantityRoute = loadRoute("src/app/api/items/[id]/quantity/route.ts");
const params = { params: Promise.resolve({ id: itemId }) };
const request = (body) => ({ json: async () => body });

test.beforeEach(() => {
  family = familyA;
  items = [{ _id: itemId, familyId: familyA, name: "Water", quantity: 6 }];
});

test("another family cannot update, deduct or delete an item", async () => {
  family = familyB;
  assert.equal((await itemRoute.PATCH(request({ name: "Changed", familyId: familyA }), params)).status, 404);
  assert.equal((await quantityRoute.POST(request({ delta: -1, familyId: familyA }), params)).status, 404);
  assert.equal((await itemRoute.DELETE(request({}), params)).status, 404);
  assert.deepEqual(items[0], { _id: itemId, familyId: familyA, name: "Water", quantity: 6 });
});

test("creation uses the authenticated family and rejects a foreign location", async () => {
  const foreign = await itemsRoute.POST(request({ name: "Milk", familyId: familyB, locationId: locationB }));
  assert.equal(foreign.status, 404);
  assert.equal(items.length, 1);
  const created = await itemsRoute.POST(request({ name: "Milk", familyId: familyB, locationId: locationA }));
  assert.equal(created.status, 201);
  assert.equal(items[1].familyId, familyA);
});

test("location must belong to the item's family", async () => {
  assert.equal((await itemRoute.PATCH(request({ locationId: locationB }), params)).status, 404);
  assert.equal(items[0].locationId, undefined);
  assert.equal((await itemRoute.PATCH(request({ locationId: locationA }), params)).status, 200);
  assert.equal(items[0].locationId, locationA);
});

test("deduction is family-scoped and rejects insufficient stock", async () => {
  assert.equal((await quantityRoute.POST(request({ delta: -7 }), params)).status, 409);
  assert.equal(items[0].quantity, 6);
  assert.equal((await quantityRoute.POST(request({ delta: -2 }), params)).status, 200);
  assert.equal(items[0].quantity, 4);
});
