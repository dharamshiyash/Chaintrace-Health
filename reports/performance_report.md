# ChainTrace Health — Performance Report

> Numbers captured from `scripts/seed.js` running against a local Hardhat node (localhost:8545).
> Network: `localhost` (EDR simulated, block time ~100ms).
> Contract: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`

---

## Write Transactions

| Function | Gas Used | Confirmation Time |
|---|---|---|
| `addApprovedPartner` (first call) | 90,322 | 80 ms |
| `addApprovedPartner` (subsequent) | 73,222 | 76 ms |
| `registerBatch` (first for address) | 368,235 | 93 ms |
| `registerBatch` (subsequent) | ~351,111 | 79–93 ms |
| `addSupplyChainEvent` (authorized) | ~153,500 | 63–93 ms |
| `addSupplyChainEvent` (unauthorized) | 136,852 | 78 ms |
| `recallBatch` | ~55,730 | 77–100 ms |

> **Note:** The unauthorized `addSupplyChainEvent` uses ~16,000 less gas than the authorized path because it skips the SSTORE for status when the batch is already Suspicious.

---

## Read Operations (off-chain calls)

| Function | Execution Time |
|---|---|
| `verifyBatch` | 17 ms |
| `verifyBatch` (Suspicious batch) | 1 ms |
| `getBatchHistory` | 14–15 ms |
| `getDivergencePoint` | 15 ms |

---

## Divergence Detection Accuracy

| Metric | Result |
|---|---|
| Injected unauthorized actor | Detected |
| `lastAuthorized` returned | 0x70997970…79C8 (Distributor 1) |
| `firstUnauthorized` returned | 0x3C44CdDd…3BC (Distributor 2) |
| Detection accurate | YES |

---

## Summary

| Metric | Value |
|---|---|
| Total write transactions | 16 |
| Total read calls | 5 |
| Success rate | 21/21 (100%) |
