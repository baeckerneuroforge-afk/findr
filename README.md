# Klymeo

AI-powered multi-tenant SaaS, built on Next.js (App Router), Clerk, Supabase, and Anthropic Claude.

## Tech Stack

| Layer            | Choice                                                      |
| ---------------- | ----------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Turbopack, React 19) — `next@latest`, App Router API is v15-compatible |
| Language         | TypeScript (strict)                                         |
| Styling          | Tailwind CSS v4 (CSS-first config in `globals.css`)         |
| Auth             | Clerk (with Organizations for multi-tenant)                 |
| Database         | Supabase (Postgres + pgvector)                              |
| AI               | Anthropic Claude SDK (`@anthropic-ai/sdk`)                  |
| Billing          | Stripe (planned — not wired yet)                            |
| Background Jobs  | Inngest (planned — not wired yet)                           |
| Package Manager  | pnpm                                                        |

## Prerequisites

- Node.js >= 20 (tested on Node 24)
- pnpm >= 9
- Accounts for: [Clerk](https://dashboard.clerk.com), [Supabase](https://supabase.com/dashboard), [Anthropic](https://console.anthropic.com)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in:

- **Clerk** — Create an app at [dashboard.clerk.com](https://dashboard.clerk.com), copy the publishable + secret keys. Enable **Organizations** under *Configure → Organizations*.
- **Supabase** — Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). From *Settings → API*, copy the project URL, anon key, and service role key. Enable the `pgvector` extension under *Database → Extensions*.
- **Anthropic** — Get an API key from [console.anthropic.com](https://console.anthropic.com).

### 3. Wire Clerk <-> Supabase (third-party auth)

The Supabase clients in `src/lib/supabase/` authenticate against Supabase using Clerk-issued JWTs. To make this work end-to-end:

1. In the **Clerk dashboard** → *Configure → JWT Templates*, create a template named `supabase` (or use Clerk's native Supabase integration if available on your plan).
2. In **Supabase** → *Authentication → Providers → Third-party Auth*, add Clerk as a provider (paste your Clerk issuer URL).
3. Add RLS policies on your tables that reference `auth.jwt()->>'sub'` for the Clerk user ID and `auth.jwt()->>'org_id'` for the active Clerk organization.

Until this is wired, server-side admin operations still work via the service role key in `createAdminSupabaseClient()`.

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk <SignIn />
│   │   └── sign-up/[[...sign-up]]/page.tsx   # Clerk <SignUp />
│   ├── (dashboard)/
│   │   └── dashboard/page.tsx                # Protected — requires Clerk session
│   ├── globals.css                           # Tailwind v4 + Klymeo theme tokens
│   ├── layout.tsx                            # ClerkProvider + dark theme
│   └── page.tsx                              # Public landing
│
├── components/
│   ├── auth/                                 # Auth-adjacent UI
│   └── ui/                                   # Reusable UI primitives
│
├── lib/
│   ├── anthropic/client.ts                   # Anthropic SDK singleton + model constants
│   ├── clerk/                                # (reserved for Clerk helpers)
│   ├── supabase/
│   │   ├── client.ts                         # Browser client (useSupabaseClient hook)
│   │   └── server.ts                         # Server + admin clients
│   └── utils/                                # Shared utilities
│
├── types/
│   └── database.ts                           # Supabase-generated DB types (stub)
│
└── middleware.ts                             # Clerk middleware, protects /dashboard
```

## Brand Tokens

Tailwind v4 uses a CSS-first `@theme` block in `src/app/globals.css`. The Klymeo palette:

| Token             | Hex       | Tailwind utility                     |
| ----------------- | --------- | ------------------------------------ |
| Violet (primary)  | `#6D28D9` | `bg-primary`, `bg-violet-600`        |
| Alert (accent)    | `#EF4444` | `bg-accent`, `bg-alert-500`          |
| Obsidian (bg)     | `#16101E` | `bg-background`, `bg-obsidian-950`   |

Full scales (50–950) are available for `violet-*`, `alert-*`, and `obsidian-*`.

## Scripts

```bash
pnpm dev          # Start dev server with Turbopack
pnpm build        # Production build
pnpm start        # Run production build
pnpm lint         # ESLint
```

## Next steps (not yet wired)

- [ ] Stripe billing — install `stripe`, add webhook handler at `app/api/stripe/webhook/route.ts`
- [ ] Inngest — install `inngest`, add `/api/inngest/route.ts` handler
- [ ] Generate Supabase DB types into `src/types/database.ts`
- [ ] Add RLS policies once schema is defined
- [ ] Configure Clerk's `supabase` JWT template

## License

Private — all rights reserved.
