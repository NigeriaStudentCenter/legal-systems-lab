# LexFlow NG — limited launch, then broad registration (runbook, not started)

**Nothing in this runbook may begin until the final line of `RELEASE-SIGN-OFF-PACK.md` is signed and production hosting exists.** It describes how to launch; it is not a record that a launch happened.

## Stage 0 — Entry conditions
- Sign-off pack complete; production environment built and tested as in the hosting plan.
- Privacy notice approved, published, and its version recorded at acknowledgement.
- Reviewers, a separate publisher and a compliance administrator named, trained, and enrolled with MFA.
- Monitoring and alerts live; incident contact reachable; rollback rehearsed.

## Stage 1 — Closed pilot (suggested 4–6 weeks)
- **Who:** a small invited group, for example 10–25 lawyers in Lagos and the FCT, and no public clients at first.
- **How accounts are made:** public sign-up stays **off**; an administrator creates each invited account.
- **Switched on:** `ENABLE_APPLICATIONS`, `ENABLE_VERIFICATION`, `ENABLE_PUBLICATION`. Directory and engagements stay off until the first listings are verified and reviewed.
- **Then, by separate decision:** `ENABLE_DIRECTORY`, and later `ENABLE_ENGAGEMENTS` with a handful of invited clients.
- **Watch daily:** applications received and time to decision; rejections and appeals; payment-detail changes and their reviews; sign-in failures and lockouts; any 5xx errors; disputes on invoices; data-subject requests; anything a reviewer could not verify.
- **Stop and close the gates if:** a verification is found to be wrong; payment details are changed without two reviews; any unauthorised access to another person's record; a personal-data breach; a regulator or the NBA raises a concern; reviewers cannot keep up.
- **Rollback:** set all `ENABLE_*` flags to `false` through the release workflow; run the read-only acceptance; keep records; notify as the incident runbook requires.
- **Exit:** a written pilot review covering the measures above, issues found and fixed, and counsel's and the data protection officer's confirmation that nothing needs to change, or what must.

## Stage 2 — Wider invited access
- More states and more lawyers by invitation; clients admitted by invitation or referral.
- Second penetration test if the code changed materially.
- Capacity check on reviewers: do not admit applicants faster than they can be verified.

## Stage 3 — Open registration
- Requires its own owner decision recorded in the sign-off pack, after the Stage 1 and 2 reviews.
- Switch public sign-up **on** in the production tenant; keep MFA enforced.
- Publish the service terms, privacy notice, complaints and appeal routes.
- Keep the stop conditions and rollback from Stage 1 in force permanently.

## What stays off at every stage
Custody of legal fees, commission or referral fees on legal work, emergency dispatch, storage of client case facts or documents, and AI legal advice.
