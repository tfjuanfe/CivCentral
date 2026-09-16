# Deploying WikiCiv (Vercel + Neon Postgres + Namecheap domain)

This gets `wikiciv.xyz` live. Steps marked **[you]** need your account login;
the rest can be driven from the CLI.

## 0. Prerequisites
- GitHub repo: `tfjuanfe/wikiciv` (already pushed)
- A Vercel account (free) — sign up with your GitHub
- The domain `wikiciv.xyz` at Namecheap
- Vercel CLI installed locally (`npm i -g vercel`)

## 1. Create the database (Neon) **[you]**
Easiest path is Vercel's built-in Postgres (Neon under the hood):

1. In the Vercel dashboard: **Storage → Create Database → Postgres**, name it
   `wikiciv-db`, pick a region near your users.
2. Vercel auto-creates the connection strings. You need two:
   - **Pooled** url (host contains `-pooler`) → use as `DATABASE_URL`
   - **Direct / non-pooling** url → use as `DIRECT_URL`
   (If using neon.tech directly instead, copy the "Pooled connection" and the
   "Direct connection" strings from the Neon dashboard.)

## 2. Environment variables (Vercel project) **[you]**
The Vercel/Neon integration auto-creates the database variables, including the
two the app uses: `POSTGRES_PRISMA_URL` (pooled runtime) and
`POSTGRES_URL_NON_POOLING` (direct, for migrations). You only add one by hand,
under **Project → Settings → Environment Variables** (all environments):

```
AUTH_SECRET = <generate-a-new-random-secret-for-this-deployment>
```

(Never reuse an example secret or a secret from Git history. Rotate any previously published value. Generate a fresh AUTH_SECRET with:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

## 3. Create the schema on the database
With the same two URLs in your local `.env`, run once:

```
npx prisma db push
```

This creates all tables on Neon. Re-run after any schema change.

## 4. Deploy the app
Link and deploy from the project folder:

```
vercel link          # link to the Vercel project (first time)
vercel --prod        # build + deploy to production
```

The build runs `prisma generate && next build`. You'll get a
`*.vercel.app` URL to confirm it works.

## 5. Create the first archivist
Production ships with NO accounts (no demo credentials). Bootstrap your admin
against the live database (URLs in local `.env`):

```
npm run create-admin -- <your_username> <a_strong_password>
```

Log in at the `*.vercel.app` URL, then create your first server and event.

## 6. Point the domain **[you]**
1. Vercel: **Project → Settings → Domains → Add** `wikiciv.xyz`
   (add `www.wikiciv.xyz` too if you want it).
2. Vercel shows the DNS records to set. At **Namecheap → Domain List →
   Manage → Advanced DNS**, add what Vercel asks for, typically:
   - `A` record, host `@`, value `76.76.21.21`
   - `CNAME` record, host `www`, value `cname.vercel-dns.com`
   (Use whatever Vercel displays; it is authoritative.)
   Make sure Namecheap is set to **Namecheap BasicDNS** (not Custom DNS).
3. Wait for DNS to propagate (minutes up to a couple of hours). Vercel issues
   the HTTPS certificate automatically.

## 7. Verify
- `https://wikiciv.xyz` loads.
- You can log in as the archivist, create a server/event, and add lore.

---

## Redeploys
With the GitHub integration enabled (Vercel → Project → Git), every push to
`main` auto-deploys. Otherwise run `vercel --prod` again.

## Local development now uses Postgres
The app no longer uses SQLite. For local dev, put the same `DATABASE_URL` /
`DIRECT_URL` (a Neon dev branch is ideal) in your local `.env`, then
`npm run dev`. The old `wikiciv123` demo seed is for throwaway local data only —
do not run `npm run db:seed` against production.
