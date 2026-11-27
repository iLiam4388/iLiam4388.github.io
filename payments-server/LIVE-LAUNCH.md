# iLiam live payments staging and launch checklist

**Status: live backend and pilot UI staged, purchases disabled.** Keep the existing sandbox Render service and its environment untouched. No live charges are authorized by this code change.

## Separate Render service

Connect this repository, branch main, root directory payments-server. Name it iliam-payments-live. Node 22+, build command `npm install && npm test`, start command `npm run start:live`, health check path `/health`. The existing sandbox service continues to run `npm start`.

Set these private environment variables on the NEW service:

- STRIPE_API_KEY: restricted live key (rk_live_), Checkout Sessions Write, Payment Intents Read, Charges Read, and Products/Prices Write if required by inline price_data.
- STRIPE_WEBHOOK_SECRET: the NEW live webhook signing secret, not the sandbox secret.
- FIREBASE_PROJECT_ID: iliam-4d0c9
- FIREBASE_SERVICE_ACCOUNT_JSON: service-account JSON from the existing project's secure credential source; use a dedicated least-privilege service account if possible. Alternatively configure the private secret file and GOOGLE_APPLICATION_CREDENTIALS. Never commit any credentials.
- LIVE_PILOT_UIDS: comma-separated approved adult pilot Firebase Authentication UIDs (not emails or usernames).
- LIVE_CHECKOUT_ENABLED: false

Render assigns the PORT automatically. Check the hosting cost. Missing credentials cause startup to fail closed; it is safe to create the service before the webhook secret is configured, then deploy again after saving it.

In Stripe live mode, create a separate snapshot webhook endpoint at the new Render service's actual HTTPS URL plus /webhook. Select checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, charge.refunded, charge.dispute.created, charge.dispute.updated, charge.dispute.closed, charge.dispute.funds_withdrawn, charge.dispute.funds_reinstated. Copy the signing secret directly to Render. Do not use the sandbox endpoint or secret. Verify /health returns mode live and checkoutEnabled false. A healthy endpoint alone does not prove Stripe/Firebase permissions or webhook delivery.

## Activation gates

- Confirm Stripe accepts the disclosed closed-loop virtual credits business and obtain any required approval. See https://stripe.com/legal/restricted-businesses. Account must be operated by eligible accurately identified people, with any required adult representative. See https://stripe.com/legal/ssa.
- Verify charges/payouts eligibility, customer purchase/refund terms, tax classification and any applicable child privacy and parental authorization requirements. The current fixed USD totals do not implement tax calculation; do not enable if tax treatment is unresolved.
- Run both test suites and review the actual deployed Firebase rules and permissions. Live credits modify ONLY balance on existing liamWallets documents, keeping existing ownership/claims fields. Sandbox uses its own collections. Live ledger liamLivePayments must remain client-inaccessible. Verify real wallet spend and reward behavior under concurrent transactions.
- Refunds deduct proportional coins, including creating a negative nonspendable balance if coins have already been spent. Current Firestore rules require client updates to end at zero or above: a large negative balance may require manual resolution. Disputes conservatively revoke credit and remain sticky even when closed/won until an operator manually reconciles; define and review refund/dispute handling and customer support before pilot. Do not edit ledger or wallet separately; use an atomic audited adjustment. No automatic cosmetic revocation is implemented.
- Confirm webhook delivery with a sandbox/staging exercise, signature and wrong-mode checks, duplicate and out-of-order events, declines/cancellations, refunds and disputes. Review API permissions and log handling. Never use test cards in live mode.
- Once all gates are met, set the actual live URL and enabled:true in livePaymentConfig in liam-payment-config.js and set LIVE_CHECKOUT_ENABLED=true on the separate service. The explicit pilot URL is /liam-coins.html?mode=live. Normal /liam-coins.html remains sandbox. Only allowlisted Firebase users may check out. Verify a legitimate authorized purchase and refund/reconciliation before considering public launch. No public checkout link is added by this staging change.

The server continues processing valid live webhooks for existing payments even when new checkout is disabled. Keep the endpoint running for refunds and disputes. Do not remove the pilot allowlist during the pilot. Do not publish restricted keys or service-account JSON.
