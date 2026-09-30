# ChainTrace Health — Complete Application Verification & Testing Guide

**Live Web Application:** [https://chaintrace-health.vercel.app/](https://chaintrace-health.vercel.app/)  
**Smart Contract on Polygon Amoy:** [`0x3E8bBd12a1A614d131Fc227106D2697Df1C0C072`](https://amoy.polygonscan.com/address/0x3E8bBd12a1A614d131Fc227106D2697Df1C0C072)  
**GitHub Repository:** [https://github.com/dharamshiyash/Chaintrace-Health](https://github.com/dharamshiyash/Chaintrace-Health)  
**Word Document (.docx):** [`ChainTrace_Health_Verification_Guide.docx`](file:///Users/yashdharamshi/Desktop/PBL/Blockchain/ChainTrace_Health_Verification_Guide.docx)

---

## 1. System Roles & Multi-Node Directory

ChainTrace Health implements cryptographic provenance with zero-trust organizational isolation. Test using the following simulated nodes:

| Role | Organization / Node Name | Simulated Wallet Address | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Public / Consumer** | Patient / Hospital / Auditor | Any / Anonymous | Universal batch verification, QR scanning, provenance timeline, tampering alerts. |
| **Manufacturer** | Apex BioPharma (Origin Node) | `0x05Db076e1f33575447AC32E3b5401a90e77a9cFD` | Genesis registration, partner whitelisting, dispatch custody handoff, urgent recalls. |
| **Distributor 1** | Novartis Global Logistics (Hub 1) | `0xc26535042E34fDf8E56015f2fB6FE175f9A25365` | Bulk acquisition intake, warehouse storage tracking, wholesale dispatch to pharmacies. |
| **Distributor 2** | Central Wholesale Pharma (Hub 2) | `0x2Bd8a4078832a8C3775685B643442ffA567b47f3` | Independent wholesale node. Verifies organizational isolation (cannot see Hub 1 batches). |
| **Pharmacy 1** | Apollo Pharmacy Delhi (Retail 1) | `0x4e1E0cb18AE2f56F466513c67969cA4E864dF0F3` | Retail intake verification, patient prescription dispensing, quarantined stock containment. |
| **Pharmacy 2** | MedPlus Retail Pharmacy (Retail 2) | `0x9fC40D4eE9B3058866B408Bf1b5A72f8B1751dE4` | Independent retail node. Demonstrates zero-inventory state until shipments are dispatched to it. |

---

## 2. Preloaded Benchmark Batches for Testing

| Batch ID | Medicine Name | Stage | Status | Expected Behavior / Verification Result |
| :--- | :--- | :--- | :--- | :--- |
| **`BATCH-MED-2024-001`** | Amoxicillin 500mg | Dispensed | `Active (0)` | Genesis -> Novartis -> Apollo -> Dispensed to patient. Complete chain of custody, 0 anomalies, fully verified. |
| **`BATCH-MED-2024-002`** | Paracetamol 650mg | Exception | `Recalled (2)` | Recalled by Apex BioPharma for packaging defect. Appears in Quarantined Stock; all transfers strictly blocked. |
| **`BATCH-MED-2024-003`** | Metformin 500mg | Exception | `Suspicious (1)` | Intercepted by unauthorized node (`0x96CA...`); flags Divergence Point immediately on blockchain. |
| **`BATCH-MED-2024-004`** | Lipitor 20mg | Exception | `Recalled (2)` | Apex BioPharma recalled batch due to contamination. Displays active recall reason. |
| **`BATCH-MED-2024-005`** | Azithromycin 250mg | Exception | `Recalled (2)` | Probable expiry recall. Quarantined across all dashboard ledgers. |

---

## 3. Step-by-Step Functional Verification Checklist

### Test Suite 1: Public Batch Verification (`/` or `/verify`)
1. **Authentic Batch Verification:**
   - Go to [https://chaintrace-health.vercel.app/](https://chaintrace-health.vercel.app/) or click **Verify Batch**.
   - Enter `BATCH-MED-2024-001` in the input field and click **Verify Authenticity** (or click the quick-select chip).
   - **Expected Result:** A green **VERIFIED ON-CHAIN** badge appears with contract address linking to PolygonScan. Timeline displays the complete chronological supply-chain handoffs. In **Geographical Route & Ledger Events**, each milestone step displays its relevant operational badge: `Registered` for genesis, `In-Transit` for dispatches, `In Custody` for warehouse/pharmacy intake, and `Dispensed` for retail dispensation (replacing confusing generic "Active" tags). Zero divergence points.
2. **Compromised Batch & Divergence Point:**
   - Enter `BATCH-MED-2024-003` and click **Verify Authenticity**.
   - **Expected Result:** Red **UNAUTHORIZED CUSTODIAN DETECTED** banner. Displays the exact Divergence Point where custody diverged to unauthorized node `0x96ca7fdbf427c815fb50d751b69dd86fe10f1ff1`. The intercepted ledger event is highlighted with an amber **Unauthorized** badge.
3. **Recalled Batch Alert:**
   - Enter `BATCH-MED-2024-002`.
   - **Expected Result:** Displays prominent red **Official Batch Recall Notice** banners with the specific reason: *"Microbial contamination detected in packaging"*. In **Geographical Route & Ledger Events**, historical transit steps show their verified milestones, and the terminal event explicitly flags the **Official Batch Recall Issued** with a red **Recalled** badge.
4. **QR Code Verification:**
   - Click the camera icon or click **QR** next to any batch in the ledger to view and verify via QR code deep-links.

---

### Test Suite 2: Manufacturer Dashboard (`/manufacturer`)
1. **Wholesale Ledger Filter Tabs:**
   - Click **ALL (5)**: Shows all 5 batches without hiding exceptions.
   - Click **EXCEPTIONS (4)**: Displays only the 4 recalled/suspicious batches.
   - Counters match the displayed table rows exactly.
2. **Partner Whitelist:**
   - In the **Partner Whitelist** panel, enter an Ethereum address (e.g. `0x2Bd8a4078832a8C3775685B643442ffA567b47f3`) and click **Authorize Node**.
   - **Expected Result:** Whitelists the address on the smart contract for authorized custody handoffs.
3. **Custody Handoff Dispatch (Live Timeline Update Test):**
   - Select an active batch, choose an authorized distributor partner (e.g. Novartis), enter dispatch location (e.g. *"Mumbai Logistics Terminal 2"*), and submit dispatch.
   - **Expected Result:** Submits custody handoff to the backend and ledger. Navigating to the batch's verification page immediately reflects this new dispatch milestone in **Geographical Route & Ledger Events** under *"Dispatched to Distributor at Mumbai Logistics Terminal 2"* with an **In-Transit** badge.
   - Safety check: If attempting to dispatch a recalled batch, the UI and smart contract will safely reject with *"Cannot perform operations on a recalled batch"*.
4. **Urgent Batch Recall:**
   - In the **Emergency Recall** panel, select a batch, enter a recall reason, and click **Execute Urgent Recall**.
   - **Expected Result:** Instantly flags the batch as `Recalled` on-chain and in the database, automatically updating downstream distributor and pharmacy dashboards, and appending the official recall event to the verification timeline.

---

### Test Suite 3: Wholesale Distributor Dashboard (`/distributor`)
1. **Ledger Integrity:**
   - Click **ALL (2)**: Both `BATCH-MED-2024-001` and `BATCH-MED-2024-002` are visible in the ledger.
   - Click **EXCEPTIONS (1)**: Shows `BATCH-MED-2024-002` (Paracetamol 650mg, Recalled).
   - Red **Quarantined & Compromised Stock** section prominently alerts warehouse operators.
2. **Multi-Node Isolation Check:**
   - Use the dropdown in the header to switch to **Central Wholesale Pharma (Hub 2)**.
   - **Expected Result:** Central Wholesale Pharma displays **0 Records** because Novartis inventory is strictly isolated from other wholesale organizations.
3. **Bulk Acquisition & Wholesale Dispatch:**
   - Accept custody of inbound shipments or dispatch to downstream retail pharmacies.

---

### Test Suite 4: Retail Pharmacy Dashboard (`/pharmacy`)
1. **Inventory Scoping:**
   - Apollo Pharmacy shows batches delivered to Apollo.
   - Switch dropdown to **MedPlus Retail Pharmacy**: Displays **0 Records** (strict zero-trust scoping).
2. **Patient Dispensing:**
   - Under **Dispense to Patient**, enter doctor ID and prescription number to complete the final retail handoff.
   - Safety guard: Recalled stock cannot be dispensed to patients.

---

## 4. API Endpoints Health Check

All API routes return real-time JSON responses:

```bash
# 1. Manufacturer Batches (5 batches)
curl -s "https://chaintrace-health.vercel.app/api/batches?role=manufacturer"

# 2. Distributor Batches (2 batches)
curl -s "https://chaintrace-health.vercel.app/api/batches?role=distributor"

# 3. Pharmacy Batches (2 batches)
curl -s "https://chaintrace-health.vercel.app/api/batches?role=pharmacy"

# 4. Batch On-Chain Verification
curl -s "https://chaintrace-health.vercel.app/api/verify/BATCH-MED-2024-001"

# 5. Cryptographic QR Generation
curl -s -i "https://chaintrace-health.vercel.app/api/qr/BATCH-MED-2024-001"

# 6. Complete Chronological Event History
curl -s "https://chaintrace-health.vercel.app/api/batches/history?id=BATCH-MED-2024-001"
```

---

## 5. Automated Regression Test Suite

Run locally in `btese`:
```bash
npm test
```
**Results:** **50 passing (416ms)**
- Smart Contract Canonical State & Recall Enforcement (5 tests)
- Organization-Scoped Inventory Visibility (4 tests)
- Role-Specific Status Derivation & Filter Integrity (3 tests)
- State Synchronization Across Blockchain, DB, and Verification (1 test)
- Core Contract Whitelist, Verification, and History (37 tests)

---

## 6. Summary of What to Do If You Encounter an Issue

1. **Check the Batch ID:** Verify whether the batch is `Active`, `Recalled`, or `Suspicious`.
2. **Check the Active Node:** Make sure you are viewing the correct organization in the top-right switcher (e.g. Novartis vs Central Wholesale).
3. **Report to Developer:** Provide the Batch ID, active role/node, and browser screenshot.
