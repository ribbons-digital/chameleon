# WebMCP is here, and we built a demo to prove it: a blank page your agent turns into working software

*By Ribbons Digital · August 2026*

We just shipped [Chameleon](https://chameleon-webmcp.ryan-970.workers.dev), our entry for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/). It is a nearly blank web page that an AI agent turns into a working app, live, in front of you. A wedding planner, a job-search tracker, a diabetes log. Same URL, different software, depending on what you ask for.

Building it taught us more about WebMCP than any explainer we had read. This post covers what WebMCP is, where it stands right now, how you can try it (and our demo) today, and whether your business should care. Spoiler on that last one: probably yes, and sooner than you think.

## What is WebMCP and what does it do

WebMCP is a JavaScript API that lets a web page hand AI agents a set of tools. A tool is a plain function with a name, a natural-language description, and a typed input schema. The page registers it like this:

```js
document.modelContext.registerTool({
  name: "add_to_cart",
  description: "Add a product to the shopping cart by SKU.",
  inputSchema: {
    type: "object",
    properties: { sku: { type: "string" }, quantity: { type: "number" } },
    required: ["sku"],
  },
  execute: async ({ sku, quantity = 1 }) => addToCart(sku, quantity),
});
```

Any agent that understands WebMCP, whether that is the browser's built-in assistant or ChatGPT driving its own browser, can now discover `add_to_cart`, read its schema, and call it. The `execute` function is your existing client-side code. No rewrite, no separate service.

If you know the Model Context Protocol (MCP), the mental model is simple: a WebMCP page is an MCP server implemented in client-side script instead of on a backend. That difference matters more than it sounds. The tools run in the live tab, so the agent operates on the same DOM, the same session, the same state the human is looking at. The user watches every action happen on screen and can intervene at any point.

Compare that to what agents do today on sites without WebMCP. They screenshot the page, guess where buttons are, click, and hope. It works often enough to be tantalising and fails often enough to be unshippable for anything that matters. WebMCP replaces guessing with a contract. You decide which actions exist, what inputs they accept, and what the agent is told about them.

The spec lives in the [W3C Web Machine Learning Community Group](https://webmachinelearning.github.io/webmcp/). It is a draft, not a standards-track recommendation yet, and it is moving fast.

## Where WebMCP stands today

The short version: it went from proposal to production-testable in about a year, and August 2026 was the month it got real.

- **Chrome** shipped a developer preview behind a flag in Chromium 146 and is now running a public [origin trial from Chrome 149 through 156](https://developer.chrome.com/docs/ai/webmcp). That means any site can register a token and expose WebMCP tools to real production traffic right now. Stable shipping is slated for Chrome 157, expected late 2026.
- **OpenAI** switched on WebMCP support (they call it "site tools") in the ChatGPT desktop app's built-in browser on August 25, the same day it announced the WebMCP Challenge, a ten-day hackathon with Google Chrome, Cloudflare, Shopify, Vercel, Render, and Netlify as partners. When ChatGPT's browser visits a page that registers tools, the agent sees and calls them automatically.
- **Edge** has experimental support behind a flag, and Microsoft co-authors the spec.
- **Firefox and Safari** are in the discussion threads with no commitments. While every serious agent runs on Chromium or its own embedded browser, this matters less than it normally would.

One warning from the trenches: the API has already had breaking changes. The March 2026 draft removed `provideContext`, and the July draft moved the entry point from `navigator.modelContext` to `document.modelContext`, with Chrome removing the old location shortly after. Tutorials from early 2026 will steer you wrong. If you adopt now, feature-detect both locations and budget for churn until the spec stabilises.

## How to try WebMCP and our demo today

There are two paths, and the first one requires no configuration at all.

### Path 1: ChatGPT's desktop app (easiest)

Open the built-in browser in the ChatGPT desktop app and navigate to [chameleon-webmcp.ryan-970.workers.dev](https://chameleon-webmcp.ryan-970.workers.dev). That is it. The page registers its tools, ChatGPT discovers them, and you can start prompting. Two caveats from OpenAI's docs: site tools require the GPT-5.6 Sol or Terra models (Luna has WebMCP disabled), and the feature is not available in Enterprise or Edu workspaces.

### Path 2: Chrome with the testing flag

1. **Browser version.** You need Chromium 146.0.7672.0 or newer for the flag to exist. In practice, use current stable Chrome (154 at the time of writing) or Chrome Canary, since the tooling around WebMCP assumes 150+.
2. **Enable the flag.** Go to `chrome://flags/#enable-webmcp-testing`, set it to Enabled, and relaunch. This turns on `document.modelContext` for every page you visit.
3. **Install the inspector extension.** Chrome itself does not yet ship an agent that calls WebMCP tools, so install the [WebMCP Model Context Tool Inspector](https://chromewebstore.google.com/detail/gbpdfapgefenggkahomfgkhfehlcenpd) from the Chrome Web Store. It opens a side panel that lists every tool registered on the current page with its schema, updates live as tools appear and disappear, and lets you execute tools manually with JSON input or hand the keyboard to Gemini and drive them with natural language.

If you run a production site and want real visitors' agents to see your tools without any flags, register for the [Chrome origin trial](https://developer.chrome.com/docs/ai/webmcp) token instead.

Stable Chrome without the flag still loads Chameleon fine. You get a dismissable banner explaining that no agent is connected, and everything works by hand.

## What Chameleon does and how to use it

Chameleon ships with no features. Every feature you see gets built by an agent, live in the browser, from a grammar of six widget types: table, kanban, checklist, chart, note, and form.

Open the page in an agent-capable browser and paste one of the suggested prompts. Our favourite:

> I'm planning my wedding for next June, about 80 guests. Set this page up for me.

Watch the agent call `describe_current_state` to read the empty board, then `add_widget`, `bind_data`, `add_rows`, and `set_layout` to assemble a guest-list table, a vendor kanban, a to-do checklist, and budget notes. This is not a mockup. Every cell is editable. Drag widgets around, resize them, check things off, and the agent sees your edits through a shared activity log. Ask it "what did I just change?" and it answers from ground truth, not a guess.

The page exposes 15 static tools covering reads, writes, layout, theming, and undo. The full contract is in [docs/01-tool-spec.md](https://github.com/ribbons-digital/chameleon/blob/main/docs/01-tool-spec.md).

The part we are proudest of is `create_form_tool`. Ask for a health log:

> I'm managing my type 2 diabetes. I want to log blood sugar readings and see trends.

The agent builds a form and a chart, then mints a brand-new WebMCP tool called `log_blood_sugar` whose input schema comes from the form fields it just designed. From then on, "log a reading of 104, taken after lunch" is one validated tool call. The tool persists across reloads, and a future agent in a fresh conversation will discover it and call it correctly. The agent did not just use the app's API. It extended it, for its successor.

Everything either party does flows through one command log that powers undo for both. There is no backend and no account. All state lives in your browser's localStorage.

There is a [2:24 demo video](https://chameleon-webmcp.ryan-970.workers.dev/demo.mp4) if you want to watch the whole loop, and the [source is on GitHub](https://github.com/ribbons-digital/chameleon) under MIT.

## The tech stack, and why

- **Vite + React 19, client-side only.** No SSR and no server framework, on purpose. `modelContext` exists only in the browser, and the app is local-first, so a server would add cost without adding capability. TanStack Router handles navigation; Cloudflare Workers serves the static build.
- **One schema, two consumers.** Every tool's input schema is written once in Zod 4. The same object validates inputs at execute time and, via `z.toJSONSchema()`, ships as the WebMCP `inputSchema` the agent reads. A Vitest suite proves the two accept and reject identical inputs for every tool, including minted ones. We do not trust any browser's schema validation across ChatGPT, Canary, and polyfills, and you should not either.
- **One mutation gate for humans and agents.** Zustand holds the document; every change, whether a human drag or an agent tool call, goes through a single Immer `produceWithPatches` gate. That one choice gives us the unified activity log, inverse-patch undo, and a `stateVersion` counter agents use to notice the board changed under them.
- **Errors are agent UX.** Tools never throw. Every failure returns a stable code plus a `hint` sentence telling the agent what to do next, like "Call describe_current_state to list valid widget ids." We tuned those hints against real agent transcripts, and it made a bigger difference to agent success rates than anything else on this list.
- **Current spec compliance.** `registerTool()` only, tool lifetimes owned by per-tool `AbortController`s, feature detection across both API locations, and types from `@mcp-b/webmcp-types`.

The UI uses the Astryx design system, react-grid-layout for the draggable grid, and Recharts for charts.

## Should your business adopt WebMCP?

Our honest take: yes for most consumer-facing sites, with eyes open about the maturity of the spec.

The case for moving now is stronger than it usually is for a draft standard. Agent traffic to websites is real and growing, and today it arrives as screen-scraping, which is slow, brittle, and completely outside your control. WebMCP flips that. You choose which actions an agent can take, you define the inputs, and you keep destructive operations gated behind confirmation. A site without tools gets guessed at. A site with tools gets used as designed. We would much rather be in the second group when ChatGPT's browser visits.

The cost side is unusually kind too. WebMCP is progressive enhancement in the classic sense. Browsers without it ignore the registration calls, your site works exactly as before, and the `execute` functions mostly wrap code you already have. A first pilot of five to ten read-only tools is a small, contained project, not a replatform.

The honest caveats: the spec is a Community Group draft that has already broken its API twice this year, so whatever you ship needs an owner who tracks the changes. And tool design has a security dimension that deserves adult supervision. The sensible sequence, which we follow ourselves, is read-only tools first, then reversible actions, then gated versions of anything risky, tested inside the ChatGPT desktop app and Chrome's inspector before real traffic sees it.

## What kind of business benefits most

Any business where customers currently fight a multi-step web flow is a candidate. The ones we would move on first:

- **E-commerce.** Product search, filtering, cart, and checkout as tools. Shopify partnering on the WebMCP Challenge is not a coincidence; "agent adds the right variant to the cart" beats "agent clicks a thumbnail and hopes" by a wide margin.
- **Bookings and reservations.** Restaurants, clinics, salons, tradespeople, class schedules. Availability lookup and booking creation are natural, high-value tools, and the many-step date-picker flows agents currently fumble are exactly what WebMCP removes.
- **SaaS products and internal dashboards.** Expose your app's core actions and every assistant your customers use becomes a power user of your product. This is also the cheapest place to start, since the client-side actions usually exist already.
- **Travel, real estate, and marketplaces.** Structured search over inventory is the canonical case. An agent that can call `search_listings` with typed filters gives users answers instead of pagination.
- **Professional services with quote or intake forms.** A form is already a schema. Registering it as a tool means an agent can complete intake accurately from a conversation, which is the difference between a lead and a bounce.

The common thread is structured actions behind a UI. If your site has those, WebMCP is a thin layer that makes them available to the fastest-growing class of visitor you have.

## How Ribbons Digital can help

[Ribbons Digital](https://ribbons.digital) is a Sydney-based software studio specialising in agentic software development, working with clients remotely, worldwide. Chameleon is the kind of thing we build for fun; making your site work with agents is the kind of thing we build for clients.

Here is what an engagement looks like, concretely:

- **Agent-readiness audit.** We walk your key user journeys the way an agent does, in ChatGPT's browser and Chrome's tooling, and show you exactly where agents fail on your site today and which actions are worth exposing as tools.
- **A scoped pilot, priced upfront.** Following our usual process, we scope the smallest tool surface worth shipping, typically read-only tools plus one or two reversible actions on your highest-value flow, and you get a clear price before we build.
- **Implementation done properly.** Single-source schemas with runtime validation, error messages written for agents, feature detection so nothing breaks in browsers without WebMCP, and tests that prove the tools do what their descriptions promise. Everything Chameleon does, applied to your product.
- **Testing with real agents.** We verify the tools against the ChatGPT desktop app and Chrome's origin trial before your customers' agents ever touch them, and we tune descriptions and hints against real transcripts, because that is where agent success is actually won.
- **Staying current for you.** The spec will keep moving through Chrome 157 and beyond. Our retainer clients get migrations handled as drafts change, so the March-2026-style breaking change is our problem, not yours.

As with everything we build, the code lands in your repositories from day one and you own all of it.

If you want to know what your site looks like to an agent, or you have a flow you suspect agents are already fumbling, email [hello@ribbons.digital](mailto:hello@ribbons.digital) or use the [contact form](https://ribbons.digital/contact/). Three sentences is plenty.

---

*Try the demo at [chameleon-webmcp.ryan-970.workers.dev](https://chameleon-webmcp.ryan-970.workers.dev), watch the [demo video](https://chameleon-webmcp.ryan-970.workers.dev/demo.mp4), or read the [source on GitHub](https://github.com/ribbons-digital/chameleon).*
