# LexFlow NG — production hosting plan (proposal, nothing provisioned)

**Status: proposal for the owner's decision. No production resource exists.** Costs are rough monthly estimates in US dollars and must be confirmed in the Azure pricing calculator before committing.

## Why staging cannot become production
- The subscription is a Visual Studio Enterprise subscription: its credit is licensed for development and test, and its spending cap would switch off every product in it if exceeded.
- The database server is shared with other products and is publicly reachable.
- The API has public ingress with no web application firewall.
- The sign-in tenant is a staging tenant with a test-only password client and fictional accounts.

## What production needs
| Piece | Requirement | Lean option | Fuller option |
|---|---|---|---|
| Subscription | Pay-as-you-go in the operating entity's name, with a budget and alerts | Required | Required |
| Database | Dedicated PostgreSQL, private network only, 14+ days of backups, tested restore | Burstable B1ms, about $16–25 | General-purpose with zone redundancy, about $130+ |
| API | Container Apps in a private network, at least one copy always running | About $10–20 | Two copies across zones, about $40+ |
| Edge and firewall | HTTPS, firewall rules, rate limiting, origin locked to the edge | Cloudflare in front, $0–25 | Azure Front Door Standard with firewall, about $35 plus traffic; Premium (private origin) about $330 |
| Secrets | Key Vault, access by managed identity only, private endpoint | About $8 for the endpoint | Same |
| Registry | Private container registry, images pinned by digest | Basic, $5 | Standard, $20 |
| Logs and alerts | Central logs with a daily cap, alerts on errors, sign-in failures and gate changes | About $5–15 | About $30+ |
| Sign-in | A separate production Entra External ID tenant, MFA enforced, no password-only test client | Free up to 50,000 monthly users | Same |
| Portal hosting | Its own address, served with the API under one origin policy, not the public course site | Static hosting, about $0–9 | Same |
| **Rough total** | | **about $50–110 a month** | **about $280–600 a month** |

## Decisions the owner must make
1. **Which entity pays and is the controller.** The subscription, the Entra tenant and the privacy notice should all name the same legal entity.
2. **Region.** Europe (where staging is) or an African region such as South Africa North. This affects latency, price and the cross-border transfer analysis.
3. **Lean or fuller.** Lean is defensible for a small monitored pilot; the fuller option is the target before broad registration.
4. **Addresses.** For example `app.` and `api.` under a LexFlow domain.

## Build order once approved
1. Create the subscription and budget; register resource providers.
2. Deploy from Bicep (`bootstrap.bicep` is the private starting point; it needs the Key Vault private endpoint and ingress added).
3. Create the production tenant, app registrations and user flow; enforce MFA; disable public client flows.
4. Apply the schema with a migration identity; create the least-privilege runtime login.
5. Wire the GitHub release workflow to a `lexflow-production` environment with two required reviewers.
6. Run the read-only acceptance, the full journey with synthetic accounts, a restore test and an external penetration test.
7. Hand the evidence to the people named in the sign-off pack.
