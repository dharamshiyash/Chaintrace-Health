# ChainTrace Health — Setup Guide

> This guide assumes you have completed nothing on Supabase or Vercel yet.
> Follow every step in order. Do not skip ahead.

---

## What you will have at the end

- A live Supabase database with 3 tables
- A live Vercel URL where the full app works (including the Verify page)
- The smart contract connected to the live frontend via environment variables

---

## Step 1 — Create a Supabase Account and Project

### 1.1 — Sign up

1. Open your browser and go to **https://supabase.com**
2. Click **Start your project** (top right)
3. Click **Sign up with GitHub** (recommended) or create an email account
4. If using GitHub: click **Authorize supabase** when prompted
5. You will land on the Supabase dashboard

### 1.2 — Create a new project

1. On the dashboard, click the green **New project** button
2. Fill in the form:
   - **Name:** `chaintrace-health`
   - **Database Password:** click **Generate a password**, then **copy it and save it somewhere safe** (you will need it if you ever connect directly via psql — not needed for this guide but good to have)
   - **Region:** choose the one closest to you (e.g. `Southeast Asia (Singapore)` for India)
3. Click **Create new project**
4. Wait about 60 seconds while Supabase provisions your database. You will see a loading spinner. Do not close the tab.

### 1.3 — Run the schema SQL

1. Once the project is ready, click **SQL Editor** in the left sidebar (the `<>` icon)
2. Click **New query** (top left of the editor)
3. Open the file [`d:\btese\supabase\schema.sql`](file:///d:/btese/supabase/schema.sql) in VS Code
4. Copy the **entire contents** of that file
5. Paste it into the Supabase SQL Editor
6. Click the green **Run** button (or press `Ctrl + Enter`)
7. You should see: `Success. No rows returned.`
8. In the left sidebar click **Table Editor** (the grid icon) — you should now see 3 tables: `profiles`, `batches`, `tx_performance`

### 1.4 — Get your Supabase credentials

You need 3 values from Supabase. Here is exactly where to find each one:

1. In the left sidebar click **Project Settings** (the gear icon at the very bottom)
2. Click **Data API** (under "Configuration")
3. You will see:

   | What you need | Where it is on the page | Variable name |
   |---|---|---|
   | Project URL | "Project URL" field | `SUPABASE_URL` and `VITE_SUPABASE_URL` |
   | Anon / public key | "Project API keys" → `anon` row → `API Key` column | `VITE_SUPABASE_ANON_KEY` |
   | Service role key | "Project API keys" → `service_role` row → `API Key` column (click the eye icon to reveal) | `SUPABASE_SERVICE_ROLE_KEY` |

4. Copy each value into a temporary text file on your desktop — you will paste them into two places: your `.env` file and later into Vercel.

> ⚠️ The **service_role** key has full database access. Never put it in any frontend code or commit it to git.

---

## Step 2 — Update Your Local `.env` File

1. Open `d:\btese\.env` in VS Code
2. It currently looks like this:
   ```
   DEPLOYER_PRIVATE_KEY=0x05Db...
   AMOY_RPC_URL=https://rpc-amoy.polygon.technology
   ETHERAPI_KEY=ZMJWHX...
   ```
3. Add the Supabase values so the file looks like this (replace the placeholder values with your actual ones):
   ```env
   DEPLOYER_PRIVATE_KEY=0x05Db076e1f33575447AC32E3b5401a90e77a9cFD
   AMOY_RPC_URL=https://rpc-amoy.polygon.technology
   ETHERAPI_KEY=ZMJWHXJ1CNSXPM35FIC21BHBUPEG517ART

   SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_service_role_key...

   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key...
   VITE_CONTRACT_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
   VITE_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
   ```
4. Save the file (`Ctrl + S`)

> ℹ️ The `VITE_CONTRACT_ADDRESS` above is the **localhost** address. After you deploy to Amoy in a later step, you will update this to the Amoy address.

---

## Step 3 — Create a GitHub Repository and Push the Code

Vercel deploys from GitHub. You need to push your code there first.

### 3.1 — Create the repo on GitHub

1. Go to **https://github.com** and sign in (create an account if you don't have one)
2. Click the **+** button in the top right → **New repository**
3. Fill in:
   - **Repository name:** `chaintrace-health`
   - **Visibility:** `Private` (recommended — your `.env` is gitignored but keep the repo private anyway)
   - Do **not** tick "Add a README file" (you already have one)
4. Click **Create repository**
5. GitHub shows you a page with setup instructions. **Copy the repo URL** — it looks like:
   ```
   https://github.com/YourUsername/chaintrace-health.git
   ```

### 3.2 — Initialize git and push from your machine

Open a **PowerShell terminal** in VS Code (`Ctrl + `` ` ``), make sure you are in `d:\btese`, then run these commands **one at a time**:

```powershell
# Check you are in the right folder
pwd
# Should print: D:\btese

# Initialize git (skip if already done)
git init

# Check what will be committed — .env should NOT appear
git status

# If .env appears, run this first:
# git rm --cached .env

# Stage all files
git add .

# Make the first commit
git commit -m "Initial commit — ChainTrace Health full stack"

# Connect to your GitHub repo (paste YOUR repo URL here)
git remote add origin https://github.com/YourUsername/chaintrace-health.git

# Push to GitHub
git push -u origin main
```

6. GitHub may ask you to log in — click **Sign in with your browser** and authorize

### 3.3 — Verify the push worked

1. Refresh your GitHub repo page
2. You should see all your files: `contracts/`, `src/`, `api/`, `README.md`, etc.
3. Confirm that **`.env` does NOT appear** in the file list (it should be in `.gitignore`)

---

## Step 4 — Deploy to Vercel

### 4.1 — Create a Vercel account

1. Go to **https://vercel.com**
2. Click **Sign Up**
3. Choose **Continue with GitHub** — this links your Vercel account to your GitHub so it can access your repos
4. Authorize Vercel when prompted
5. When asked "What are you building?", select **Personal** and click **Continue**

### 4.2 — Import your project

1. You will be on the Vercel dashboard. Click **Add New…** → **Project**
2. Under "Import Git Repository" you should see `chaintrace-health` in the list
   - If you don't see it, click **Adjust GitHub App Permissions** and grant Vercel access to the repo
3. Click **Import** next to `chaintrace-health`

### 4.3 — Configure the project

Vercel shows a "Configure Project" screen. Do the following:

1. **Framework Preset** — Vercel should auto-detect **Vite**. If not, select it from the dropdown
2. **Root Directory** — leave as `./` (default)
3. **Build Command** — leave as `npm run build` (default)
4. **Output Directory** — leave as `dist` (default)

### 4.4 — Add environment variables

This is the most important step. Click **Environment Variables** to expand the section. Add each variable below **one at a time** by typing the name in the "Key" field and the value in the "Value" field, then clicking **Add**:

| Key | Value | Where to find it |
|---|---|---|
| `SUPABASE_URL` | `https://doormukbaozrqfwnoizm.supabase.co` | Supabase → Project Settings → Data API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` (long key) | Supabase → Data API → service_role key |
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` | same |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` (different key) | Supabase → Data API → anon key |
| `AMOY_RPC_URL` | `https://polygon-amoy.drpc.org` | type this in directly (matches your .env) |
| `HARDHAT_NETWORK` | `localhost` | type this in directly |
| `VITE_CONTRACT_ADDRESS` | *(paste the address from `deployments/amoy.json` after Step 5)* | written by `npm run deploy:amoy` |

> ℹ️ Do **not** add `DEPLOYER_PRIVATE_KEY` to Vercel. It is only used locally for deploy scripts.

> ⚠️ Set `VITE_CONTRACT_ADDRESS` **after** completing Step 5 (Amoy deploy). The localhost address (`0x5FbDB2315678afecb367f032d93F642f64180aa3`) only works on your machine — it will not work on Vercel's servers.

### 4.5 — Deploy

1. Click the **Deploy** button
2. Vercel will:
   - Clone your repo
   - Run `npm install`
   - Run `npm run build` (Vite)
   - Deploy the `dist/` folder as the frontend
   - Deploy each file in `api/` as a serverless function
3. This takes about 60–90 seconds
4. When done, you will see a confetti screen and a URL like:
   ```
   https://chaintrace-health.vercel.app
   ```
5. Click **Visit** to open your live app

### 4.6 — Verify the deployment works

1. Open the live URL in your browser
2. The **Landing page** should load with the Premium Light Mode design
3. Click **Verify a Batch** in the nav — it will try to call `/api/verify/BATCH-MED-2024-001`
4. This will return an error like "Batch not found on blockchain" because:
   - The contract at `VITE_CONTRACT_ADDRESS` is on **localhost**, not Vercel's internet
   - This is expected until you complete Step 5 below

---

## Step 5 — Deploy the Contract to Polygon Amoy (Live Testnet)

This step makes the Verify page work end-to-end on the live URL.

### 5.1 — Get test POL (free)

You need a tiny amount of test POL to pay for gas on Amoy.

1. Go to **https://faucet.polygon.technology**
2. Select **Amoy** as the network
3. Select **POL** as the token
4. Paste your wallet address: `0x05Db076e1f33575447AC32E3b5401a90e77a9cFD`
5. Complete the verification and click **Submit**
6. Wait 1–2 minutes. You should receive **0.2 POL** — more than enough for several deployments.

Alternatively try: **https://www.alchemy.com/faucets/polygon-amoy** (requires a free Alchemy account but is more reliable).

### 5.2 — Deploy to Amoy

Once you have POL in your wallet, open PowerShell in `d:\btese` and run:

```powershell
npm run deploy:amoy
```

You should see output like:
```
Deploying ChainTraceHealth to amoy...

Deployer address: 0x05Db076e1f33575447AC32E3b5401a90e77a9cFD
Deployer balance: 0.2 MATIC

Transaction hash: 0xabc...
Waiting for confirmation...

✓ Contract deployed successfully
  Address:            0xNEW_CONTRACT_ADDRESS
  Block:              12345678
  Gas used:           1796327
  Confirmation time:  3200 ms

✓ Deployment info written to deployments/amoy.json
✓ ABI written to deployments/ChainTraceHealth.abi.json
```

**Copy the contract address** shown after `Address:`.

### 5.3 — Seed test data on Amoy

```powershell
npm run seed:amoy
```

This registers the 5 test batches on the live Amoy network. Each transaction takes 2–5 seconds. It will cost a total of about 0.02 POL.

### 5.4 — Verify the contract on Polygonscan (optional but recommended)

```powershell
npx hardhat verify --network amoy 0xNEW_CONTRACT_ADDRESS
```

Replace `0xNEW_CONTRACT_ADDRESS` with the address from Step 5.2. After a minute you will get a Polygonscan URL where anyone can read the verified source code.

### 5.5 — Update Vercel with the new contract address

1. Go back to **https://vercel.com/dashboard**
2. Click on your `chaintrace-health` project
3. Click **Settings** → **Environment Variables**
4. Find `VITE_CONTRACT_ADDRESS`
5. Click the **Edit** (pencil) icon
6. Replace the localhost address with your new Amoy address from Step 5.2
7. Click **Save**
8. Go to **Deployments** → click **Redeploy** on the latest deployment (top of list) → confirm **Redeploy**
9. Wait ~60 seconds for the new deployment

### 5.6 — Push the updated deployment files to GitHub

```powershell
git add deployments/amoy.json deployments/ChainTraceHealth.abi.json reports/
git commit -m "Add Amoy deployment info and seed performance report"
git push
```

---

## Step 6 — Test the Full Flow on the Live URL

Open your Vercel URL. Try each of these:

### ✅ Verify a clean batch
1. Go to `https://your-app.vercel.app/verify/BATCH-MED-2024-001`
2. Should show: **Amoxicillin 500mg** with status `Active` and a timeline of 3 events (Manufacturer → Distributor → Pharmacy), all with green authorized markers

### ✅ Verify a suspicious batch
1. Go to `https://your-app.vercel.app/verify/BATCH-MED-2024-003`
2. Should show: **Atorvastatin 10mg** with status `Suspicious`
3. The **Point of Divergence** amber alert panel should appear above the timeline, showing the last authorized and first unauthorized addresses

### ✅ Verify a recalled batch
1. Go to `https://your-app.vercel.app/verify/BATCH-MED-2024-004`
2. Should show: **Metformin 1000mg** with a red **Recalled** badge and reason "Contamination"

### ✅ QR code
1. Go to `https://your-app.vercel.app/dashboard/manufacturer`
2. Click the **QR** button on any batch row (batches won't appear until Supabase has data — see Step 7)
3. A modal opens with the QR image and a Download button

### ✅ Skeleton loaders
1. Open Chrome DevTools (`F12`) → **Network** tab → set throttle to **Slow 3G**
2. Refresh the Verify page
3. You should see the skeleton placeholders animate while data loads, then the content appears with no layout shift

---

## Step 7 — Populate Supabase (for Dashboard Batch Lists)

The on-chain verify flow works without Supabase. But the batch list tables in the dashboards read from Supabase's `batches` table (which acts as a fast search index). To populate it:

1. Go to your Supabase project → **Table Editor** → `batches` table
2. Click **Insert** → **Insert row**
3. Add each batch manually:

| batch_id | medicine_name | manufacturer | status |
|---|---|---|---|
| BATCH-MED-2024-001 | Amoxicillin 500mg | 0x05Db076e1f33575447AC32E3b5401a90e77a9cFD | Active |
| BATCH-MED-2024-002 | Paracetamol 650mg | 0x05Db076e1f33575447AC32E3b5401a90e77a9cFD | Active |
| BATCH-MED-2024-003 | Atorvastatin 10mg | 0x05Db076e1f33575447AC32E3b5401a90e77a9cFD | Suspicious |
| BATCH-MED-2024-004 | Metformin 1000mg | 0x05Db076e1f33575447AC32E3b5401a90e77a9cFD | Recalled |
| BATCH-MED-2024-005 | Azithromycin 250mg | 0x05Db076e1f33575447AC32E3b5401a90e77a9cFD | Recalled |

Alternatively, run this SQL in the Supabase SQL Editor to insert all 5 at once:

```sql
INSERT INTO batches (batch_id, medicine_name, manufacturer, status) VALUES
  ('BATCH-MED-2024-001', 'Amoxicillin 500mg',  '0x05Db076e1f33575447AC32E3b5401a90e77a9cFD', 'Active'),
  ('BATCH-MED-2024-002', 'Paracetamol 650mg',  '0x05Db076e1f33575447AC32E3b5401a90e77a9cFD', 'Active'),
  ('BATCH-MED-2024-003', 'Atorvastatin 10mg',  '0x05Db076e1f33575447AC32E3b5401a90e77a9cFD', 'Suspicious'),
  ('BATCH-MED-2024-004', 'Metformin 1000mg',   '0x05Db076e1f33575447AC32E3b5401a90e77a9cFD', 'Recalled'),
  ('BATCH-MED-2024-005', 'Azithromycin 250mg', '0x05Db076e1f33575447AC32E3b5401a90e77a9cFD', 'Recalled');
```

After this, the Manufacturer Dashboard → **My Batches** tab will show the batch list.

---

## Step 8 — Keep Supabase Active (Free Tier)

Supabase free projects **pause automatically after 7 days of inactivity**. Before any live demo:

1. Go to **https://supabase.com/dashboard**
2. If your project shows a **"Paused"** badge, click **Restore project**
3. Wait ~30 seconds for it to come back online
4. The app will work again immediately after restore

To avoid pausing, you can visit the Supabase dashboard at least once a week, or upgrade to a paid plan ($25/month) which never pauses.

---

## Checklist Summary

Use this as your go / no-go checklist before demo day:

- [ ] Supabase project created and schema SQL executed
- [ ] 3 tables visible in Supabase Table Editor: `profiles`, `batches`, `tx_performance`
- [ ] Supabase credentials (URL, anon key, service role key) noted
- [ ] Code pushed to GitHub (`git push` with no `.env` file included)
- [ ] Vercel project created and linked to GitHub repo
- [ ] All 7 environment variables set in Vercel dashboard
- [ ] First Vercel deployment green (landing page loads)
- [ ] Test POL received at `0x05Db…cFD`
- [ ] Contract deployed to Amoy (`npm run deploy:amoy`)
- [ ] Seed run on Amoy (`npm run seed:amoy`)
- [ ] `VITE_CONTRACT_ADDRESS` updated in Vercel to Amoy address
- [ ] Vercel redeployed after env var update
- [ ] `deployments/amoy.json` pushed to GitHub
- [ ] Supabase `batches` table populated (SQL insert above)
- [ ] `/verify/BATCH-MED-2024-001` shows Active status with timeline ✅
- [ ] `/verify/BATCH-MED-2024-003` shows Suspicious + DivergenceAlert ✅
- [ ] Supabase project is not paused on demo day ✅
