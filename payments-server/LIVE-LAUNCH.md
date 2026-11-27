# iLiam live payments launch checklist

**Status: sandbox only.** Do not replace the existing sandbox credentials or enable public live checkout until the following gates are complete.

## Before implementation
- Confirm Stripe supports the actual closed-loop virtual credits and cosmetic purchases; disclose how credits are earned, spent, transferred, refunded and whether redemption is possible. Obtain any required approval. See https://stripe.com/legal/restricted-businesses.
- The Stripe account must be held and operated by eligible, accurately identified people with any required adult representative. See https://stripe.com/legal/ssa.
- Verify live account charges/payouts eligibility, customer purchase and refund terms, tax classification and any applicable child privacy and parental authorization requirements.

## Technical migration
- Existing embedded checkout is on `liam-coins.html` with `liam-payments.js` and `liam-payment-config.js`; backend is `payments-server/server.mjs` on Render. `payment-core.mjs` validates the fixed server-side packages. All currently intentionally reject live mode.
- Preserve sandbox service and its `liamSandboxWallets`/`liamSandboxPayments` collections. Build a separate live deployment with a default-off activation flag and an authenticated pilot allowlist. Never let a test event credit a real wallet.
- Existing package pricing uses inline server-side `price_data` (no manually created Price IDs are required by this approach). Review actual live tax handling and product category before enabling automated tax.
- Store live `STRIPE_API_KEY` and independent `STRIPE_WEBHOOK_SECRET` only in the live Render service's private environment. Never commit secrets or Firebase admin credentials. Expose only the live publishable key and backend URL to the browser once approved.
- Keep secure Stripe embedded checkout, authenticated session ownership, exact server-side amount/currency/package verification, signed webhooks, atomic idempotent payment ledger and separate live event namespace. Configure a live snapshot webhook for checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded and design dispute handling.
- Review integration with the existing `liamWallets` spend/unlock rules. Design refund/dispute handling when credits have already been spent; prevent double credit, unauthorized coin creation, and mixing sandbox with real balances. Review Firebase Admin least privilege and client-side rules.
- Test unpaid/declined/canceled purchases, wrong mode/key/signature, mismatched currency or amount, duplicate or out-of-order delivery, spent-credit refunds, disputes, user changes during checkout and tax totals. Confirm fail-closed behavior and preserve existing sandbox tests.
- Only after approval and review, deploy live backend with pilot access; verify a legitimate authorized purchase and reconciliation before opening checkout more widely. Never use test cards in live mode.

No live payment activation, credentials, catalog changes or webhook configuration are performed by this documentation commit.
