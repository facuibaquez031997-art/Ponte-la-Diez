# Feature: marketplace-mp

Objective: Mercado Pago Marketplace payments (each owner links their own account; platform takes a commission).
Branch: feat/marketplace-mp (from feat/bloqueo-al-pagar) · Delivery: ask-on-risk · Test runner: Vitest (apps/server, `npx vitest run`)

## Specs

- S1. Platform commission, verbatim: "la comision de la plataforma es el 10% de cada ingreso a la cuenta". Applies to each amount charged (deposit or full payment). Configurable via `MP_MARKETPLACE_FEE_PERCENT`, default 10 (assumption: the user did not ask for configurability).
- S2. From PENDIENTES #35, verbatim: "vincular la cuenta de cada dueño (OAuth), cobrar a su cuenta con la comisión de la plataforma, y que las devoluciones salgan de esa cuenta por la API".
- S3. Decision (2026-11-15), verbatim: "tu jefe confirmó Marketplace de Mercado Pago".
- S4. Assumption (not asked): an owner's court cannot be paid until that owner has linked their account. Owner tokens are credentials: stored encrypted, never logged.
- S5. Related pending items to revisit: #32, #36, #38, #42, #43, #60.

## Tasks

- T1 · S2, S4 · inline · Schema + OAuth link: owner MP account fields on the data model, authorize/callback endpoints, token refresh · commit: pending
- T2 · S1, S2 · inline · Create the preference with the owner's token and `marketplace_fee` = 10% of the charged amount; block payment when the owner is not linked · commit: pending
- T3 · S2 · inline · Webhook and `getPayment` read the payment with the owner's token (open question: how to find the owner from the notification; verify against Mercado Pago docs first) · commit: pending
- T4 · S2 · inline · Refunds from the owner's account through the API (owner cancellation and ESPACIO_OCUPADO), replacing the manual "devolución hecha" · commit: pending
- T5 · S2 · inline · Client: owner "Cuenta Mercado Pago vinculada" screen (Stitch), link status, docs and PENDIENTES update · commit: pending

## Log

- L1 (2026-11-16): "arranquemos con el marketplace"
- L2 (2026-11-16): "la comision de la plataforma es el 10% de cada ingreso a la cuenta"
- L3 (2026-11-17): "sigamos donde nos quedamos". T1 design (assumptions, not asked): separate `MpCuenta` model 1:1 with `User` so tokens never travel in user queries; tokens encrypted with AES-256-GCM (`MP_TOKEN_ENCRYPTION_KEY`, 64 hex chars); OAuth `state` signed to prevent CSRF; new env vars `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`. Runner is Vitest, not Jest (header corrected).
- L4 (2026-11-17): T1 in progress. Done: `token-crypto.ts` + spec (RED observed: module missing; GREEN: 6/6). Next: `MpCuenta` in schema.prisma + migration, signed-state helper, authorize/callback endpoints, token refresh.
- L5 (2026-11-17): `MpCuenta` added (userId unique, mpUserId, accessTokenEnc, refreshTokenEnc, expiresAt, cascade on user delete) + migration `20261117194846_add_mp_cuenta` (additive, applied to dev DB). Pre-existing, unrelated: `tsc` fails on `test/app.e2e-spec.ts` (missing `supertest/types`). Work-unit 1 committed: schema + crypto.
