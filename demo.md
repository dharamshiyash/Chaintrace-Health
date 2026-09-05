# ChainTrace Health - Demo Workflow

This document outlines the ideal step-by-step script for demonstrating the ChainTrace Health platform to stakeholders, investors, or users. It highlights the platform's core value propositions: **Immutability, Transparency, and Security.**

---

## 🎬 Pre-Demo Setup
1. Ensure the local Hardhat blockchain node is running (`npm run node`).
2. Ensure the API server is running (`npm run api:local`).
3. Ensure the Vite frontend is running (`npm run dev`).
4. Open four separate browser windows/tabs:
   - **Tab 1:** Landing Page (`http://localhost:5173/`)
   - **Tab 2:** Manufacturer Dashboard (`http://localhost:5173/dashboard/manufacturer`)
   - **Tab 3:** Distributor Dashboard (`http://localhost:5173/dashboard/distributor`)
   - **Tab 4:** Pharmacy Dashboard (`http://localhost:5173/dashboard/pharmacy`)

---

## 🚀 The Demo Script

### Step 1: The Landing Page (The Hook)
* **Action:** Start on the Landing Page.
* **Talking Points:**
  - Introduce ChainTrace Health as a premium SaaS platform backed by blockchain technology.
  - Emphasize the problem: Counterfeit medicines cost lives and billions of dollars.
  - Highlight the solution: "We record every single custody handoff on an immutable ledger. No retroactive edits, no gaps."
  - Scroll through the features, pointing out the clean, modern aesthetic and the "End-to-end transparency" panels.

### Step 2: The Manufacturer (Genesis)
* **Action:** Switch to the Manufacturer Dashboard.
* **Talking Points:**
  - Explain that every journey starts at the manufacturing facility.
  - Point out the metrics at the top (Total Issued, Divergence Rate).
  - Use the **Register Batch** form to create a new medicine batch:
    - **Batch ID:** `BATCH-DEMO-001`
    - **Medicine:** `Amoxicillin 500mg`
    - **Location:** `Pfizer Facility, NY`
    - **Mfg Date / Exp Date:** Pick relevant dates.
    - **Quantity:** `10000`
  - Click **Issue to Blockchain**. Highlight the success toast and explain that the data is now cryptographically secured on the ledger.
  - Add the Distributor's wallet address (`0x2Bd...7f3`) to the **Partner Whitelist** to authorize them.

### Step 3: The Distributor (Custody Transfer)
* **Action:** Switch to the Distributor Dashboard.
* **Talking Points:**
  - The medicine is now on a truck and arrives at the distribution center.
  - Under **Accept Custody**, enter `BATCH-DEMO-001` and Location `Midwest Hub, IL`.
  - Click **Sign Receipt on Chain**.
  - Explain that this action mathematically proves the distributor took custody of the specific batch at a specific  time.
  - Now, transfer it to the pharmacy: Under **Transfer Batch**, enter the batch ID, the Pharmacy's wallet address (`0x9fC...2a1`), and Location `In-transit to Pharmacy`.

### Step 4: The Pharmacy (Final Destination)
* **Action:** Switch to the Pharmacy Dashboard.
* **Talking Points:**
  - The shipment arrives at the local pharmacy.
  - Under **Receive Shipment**, enter `BATCH-DEMO-001` and Location `CVS Pharmacy, Austin TX`.
  - Click **Sign Receipt on Chain**. 
  - Finally, a patient comes in with a prescription. Use the **Dispense to Patient** form to complete the journey.
  - Emphasize that the medicine has successfully reached the consumer through a 100% verified, unbroken chain of custody.

### Step 5: Public Verification (The Proof)
* **Action:** Open a new tab and go to `http://localhost:5173/verify/BATCH-DEMO-001` (or click "Verify" on any dashboard table).
* **Talking Points:**
  - Act as a consumer or a regulatory auditor scanning the QR code on the medicine box.
  - Show the **Verify Page**. 
  - Point out the green **"Authentic Supply Chain"** badge.
  - Scroll down to the **Supply Chain Journey** timeline.
  - Show how every single step (Manufacturer → Distributor → Pharmacy) is permanently logged with timestamps, organizational identities, and wallet addresses.
  - Explain that because this is on a blockchain, it is mathematically impossible for anyone to have altered this history.

---

## 🛑 The "Divergence" Scenario (Optional but Powerful)
To demonstrate the platform's security, create a counterfeit/divergence scenario:
1. Go back to the Manufacturer.
2. Register a new batch: `BATCH-DIVERGE-002`.
3. Switch to the **Pharmacy Dashboard** (skipping the authorized distributor).
4. Try to accept custody of `BATCH-DIVERGE-002`.
5. Open the Verify page for `BATCH-DIVERGE-002`.
6. Highlight the red **Point of Divergence Detected** alert.
7. Explain how the system automatically caught the unauthorized handoff and flagged the batch as suspicious, protecting the consumer.
