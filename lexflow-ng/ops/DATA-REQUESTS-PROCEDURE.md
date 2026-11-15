# LexFlow NG — handling data-subject requests (operator procedure, draft)

**Draft for the data protection officer to approve. Time limits and retention rules are for counsel to set.**

## Where requests arrive
A signed-in person can download their own data at `GET /v1/me/data` and record a request at `POST /v1/me/requests` (erasure, correction, restriction, objection). Requests made by email or post must be logged by hand in the same table so there is one record.

## Daily check
```sql
SELECT r.id, r.kind, r.status, r.created_at, u.id AS user_id, u.role
FROM data_requests r JOIN app_users u ON u.id = r.user_id
WHERE r.status IN ('received','in_progress') ORDER BY r.created_at;
```

## Erasure
1. Confirm the request came from the account holder (it was made while signed in; for email requests, verify identity first).
2. Check for a reason to keep data: an open engagement, an unpaid or disputed invoice, a complaint or investigation, a legal retention duty. If one applies, record the decision, set the request to `refused` or leave it `in_progress`, and tell the person why.
3. A second authorised person approves.
4. Run, as a database operator: `SELECT lexflow_erase_user('<user_id>');`
   - A lawyer is unlisted and suspended; name, city, summary, verification references and bank details are removed, including from invoices they issued.
   - A client's name and contact are removed from their engagements.
   - The other party's invoices, amounts and receipt numbers stay. The audit trail stays, without the person's identity.
5. Delete the person's account in the Microsoft Entra tenant. The function does not do this.
6. Record who approved and when in the external change log.

## Correction, restriction, objection
Recorded only. Apply by hand, with a second approver, and set the request to `completed`.

## Not yet in place
Retention schedule; reply time limits; notification templates; automatic Entra deletion; a way to restrict processing without erasing.
