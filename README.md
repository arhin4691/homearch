This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Inventory access

Inventory and locations are scoped to the current family. External API and MCP
keys also require the key's creator to still belong to the family that issued
the key. If the creator leaves that family, an owner must create a new key.

Run the isolated inventory authorization tests with:

```bash
node --test tests/inventory-isolation.test.mjs
```

These tests use mocked storage and do not replace integration testing with
separate users and families against MongoDB.

## Family AI assistant

The Recipes page includes a household assistant. Conversation messages and
relevant inventory details may be sent to Cloudflare Workers AI using the
existing account credentials. The assistant uses
`@cf/qwen/qwen3.8-27b` for tool calling; it does not create a
Worker. Conversation history and pending previews are scoped to the current
user and family.

Opening the assistant starts a new chat. Start another new chat to clear the current view without deleting earlier
conversations. The history panel shows up to 100 conversations and lets the
creator reopen or delete them within their current family. Existing assistant
messages remain available as the original conversation. Deleting a conversation
also removes its pending, unconfirmed previews.

Assistant replies are streamed from the server as verified results become
available. The Cloudflare tool-selection step must finish before inventory
results can be checked and sent. Inventory write previews continue to require
separate confirmation.

Inventory changes proposed by the assistant require confirmation within 15
minutes. A confirmation is single-use; if its outcome is uncertain, check the
inventory before requesting another preview. A preview is rejected if the
item changed in the meantime. The assistant can also propose adding an explicit
quantity to an existing item. Its on-request restock list includes items at or
below their configured minimum, items with zero quantity, and non-expired items
with stock expiring within seven Hong Kong calendar days, marked SOON. It calculates
`max(0, 2 * minimumQuantity - quantity)` when a minimum is set; otherwise it asks for
the minimum instead of guessing a quantity. Items with no minimum and nonzero
stock are not classified as low. The existing in-app low-stock notifications
continue to trigger below (not at) the configured minimum.
Low-stock and expiry notifications are generated when a user opens the app
notifications or assistant, not by a background scheduler or push service.
Alerts are deduplicated per user and item; after restocking to the minimum or
above, a later drop below the threshold can generate a new alert.

Voice inventory changes require an exact spoken quantity and a separate,
server-generated confirmation preview. Ambiguous matches must be selected
explicitly and new items require category and expiry information. Voice batch
confirmation requires MongoDB transactions (a replica set or sharded cluster);
standalone MongoDB deployments cannot commit these batches. Speech input may be
processed by the browser's speech service, and transcribed text is sent to the
existing Cloudflare Workers AI service.

Marking a generated recipe as cooked no longer guesses and deducts one of each
ingredient. Use the assistant to review and deduct the actual quantities.

Additional assistant tests:

```bash
node --test tests/assistant-security.test.mjs tests/inventory-isolation.test.mjs
```

`tests/assistant-mongodb.test.mjs` additionally exercises two synthetic
families against MongoDB. It runs only when `MONGODB_TEST_URI` points to an
empty, isolated database named `ha_ai_test_` followed by 24 lowercase
hexadecimal characters. It creates and removes only its known test collections.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
