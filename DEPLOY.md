# Deploy to Vercel + Neon (free)

## 1. Create a free Postgres DB on Neon
- Go to https://neon.tech — sign up (free, no credit card).
- Create a project, copy the connection string. It looks like:
  postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

## 2. Put the connection string in .env
- Open `.env` at the project root.
- Replace the placeholder DATABASE_URL line with your real Neon string.

## 3. Push the schema to Neon
- Run: `npx prisma db push`   (creates all tables; app self-seeds demo cases on first run)

## 4. Push the project to GitHub
- git init && git add . && git commit -m "initial deploy"
- Create a repo on github.com, then:
  git remote add origin https://github.com/<you>/<repo>.git
  git branch -M main && git push -u origin main

## 5. Deploy on Vercel
- Go to https://vercel.com — sign up with GitHub (free Hobby tier).
- "Add New Project" → import the repo. Vercel auto-detects Next.js.
- Under "Environment Variables", add:
    Name:  DATABASE_URL
    Value: (paste your Neon connection string — same as in .env)
- Leave Build Command and Output Directory as defaults. Click "Deploy".
- First build takes ~2-3 min. You get a https://<project>.vercel.app URL.

## 6. Verify
- Open the Vercel URL → dashboard should load with "OP EAGLE CLAW" (15 nodes / 27 edges) as default.
- Click "+ FIR NOTE" and upload any .txt FIR → graph should populate from extracted entities.
- Click "Export BSA 2023 legal report" → a .txt certificate should download.

## Notes
- Vercel Hobby: 100 GB bandwidth + 100k function invocations/month free.
- Neon free: 0.5 GB storage, scales to zero after idle (~1s wake on first request).
- The AI copilot runs fully offline (local graph analytics) — no LLM API key needed.
