import { randomBytes } from 'node:crypto';
import { InputError } from './domain.mjs';

// Direct-to-lawyer model. Nothing here moves, holds or verifies money: invoices are
// issued by the lawyer, paid to the lawyer's own reviewed account, and the payment
// status is what the lawyer reported and what the client then confirmed or disputed.
export const PAYMENT_NOTICE = 'Payment status is reported by the lawyer and confirmed or disputed by the client. LexFlow did not receive, hold, process or verify this payment.';
const naira = kobo => Number(kobo);
const invoiceView = r => ({
  id:r.id, engagement_id:r.engagement_id, lawyer_reference:r.lawyer_reference, fee_type:r.fee_type,
  amount_kobo:naira(r.amount_kobo), currency:r.currency, due_date:r.due_date, status:r.status,
  pay_to:{method:r.pay_method, account_name:r.pay_account_name, bank_name:r.pay_bank_name,
    account_number:r.pay_account_number, payment_url:r.pay_url},
  receipt_number:r.receipt_number, received_on:r.received_on, created_at:r.created_at
});
const INVOICE_COLUMNS = `i.id,i.engagement_id,i.lawyer_reference,i.fee_type,i.amount_kobo,i.currency,i.due_date::text AS due_date,
  i.status,i.pay_method,i.pay_account_name,i.pay_bank_name,i.pay_account_number,i.pay_url,i.receipt_number,
  i.received_on::text AS received_on,i.reported_paid_at,i.client_responded_at,i.created_at`;

export function makeEngagementDb({pool, transaction, audit, principal, requireRole}) {
  async function lawyerApplication(q, actorId) {
    const r = await q.query(`SELECT id,full_name,status,published,
      (verification_valid_until IS NOT NULL AND verification_valid_until > CURRENT_DATE) AS current
      FROM lawyer_applications WHERE user_id=$1`,[actorId]);
    return r.rows[0] || null;
  }
  // Loads an engagement and proves the caller is one of its two parties.
  async function party(q, subject, engagementId, lock=false) {
    const actor = await principal(q, subject);
    const r = await q.query(`SELECT e.*, a.user_id AS lawyer_user_id, a.full_name AS lawyer_name, a.status AS lawyer_status
      FROM engagements e JOIN lawyer_applications a ON a.id=e.application_id WHERE e.id=$1` + (lock?' FOR UPDATE OF e':''),[engagementId]);
    const e = r.rows[0];
    const isClient = e && e.client_user_id === actor.id, isLawyer = e && e.lawyer_user_id === actor.id;
    // Same answer for "does not exist" and "not yours".
    if (!e || (!isClient && !isLawyer)) throw new InputError('Engagement not found',404);
    return {actor, e, isClient, isLawyer};
  }
  async function invoiceParty(q, subject, invoiceId, lock=false) {
    const r = await q.query('SELECT engagement_id FROM invoices WHERE id=$1',[invoiceId]);
    if (!r.rows[0]) { await principal(q, subject); throw new InputError('Invoice not found',404); }
    let ctx;
    try { ctx = await party(q, subject, r.rows[0].engagement_id); }
    catch (err) { if (err.statusCode === 404) throw new InputError('Invoice not found',404); throw err; }
    const i = await q.query(`SELECT ${INVOICE_COLUMNS} FROM invoices i WHERE i.id=$1` + (lock?' FOR UPDATE':''),[invoiceId]);
    return {...ctx, invoice:i.rows[0]};
  }
  return {
    async savePaymentDetails(subject, d) {
      return transaction(async q => {
        const actor = await principal(q, subject);
        const app = await lawyerApplication(q, actor.id);
        if (!app || app.status !== 'verified' || !app.current) throw new InputError('Current professional verification required',403);
        const r = await q.query(`INSERT INTO lawyer_payment_details(application_id,method,account_name,bank_name,account_number,payment_url)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (application_id) DO UPDATE SET method=EXCLUDED.method,account_name=EXCLUDED.account_name,
            bank_name=EXCLUDED.bank_name,account_number=EXCLUDED.account_number,payment_url=EXCLUDED.payment_url,
            status='pending_review',version=lawyer_payment_details.version+1,updated_at=now()
          RETURNING id,status,version`,[app.id,d.method,d.account_name,d.bank_name,d.account_number,d.payment_url]);
        // Any change sends the details back to two-reviewer approval before clients can see them.
        await audit(q,actor.id,app.id,'payment_details_submitted',{version:r.rows[0].version,method:d.method});
        return r.rows[0];
      });
    },
    async myPaymentDetails(subject) {
      const actor = await principal(pool, subject);
      const r = await pool.query(`SELECT d.id,d.method,d.account_name,d.bank_name,d.account_number,d.payment_url,d.status,d.version,d.updated_at
        FROM lawyer_payment_details d JOIN lawyer_applications a ON a.id=d.application_id WHERE a.user_id=$1`,[actor.id]);
      return r.rows[0] || null;
    },
    async paymentDetailQueue(subject) {
      await requireRole(pool,subject,['reviewer','compliance_admin']);
      const r = await pool.query(`SELECT d.id,d.method,d.account_name,d.bank_name,d.account_number,d.payment_url,d.version,
        a.full_name AS verified_name,a.city,a.state,d.updated_at
        FROM lawyer_payment_details d JOIN lawyer_applications a ON a.id=d.application_id
        WHERE d.status='pending_review' ORDER BY d.updated_at ASC LIMIT 100`);
      return r.rows;
    },
    async reviewPaymentDetails(subject, id, review) {
      return transaction(async q => {
        const actor = await requireRole(q,subject,['reviewer','compliance_admin']);
        const lock = await q.query(`SELECT d.id,d.status,d.version,d.application_id,a.user_id FROM lawyer_payment_details d
          JOIN lawyer_applications a ON a.id=d.application_id WHERE d.id=$1 FOR UPDATE OF d`,[id]);
        const d = lock.rows[0];
        if (!d) throw new InputError('Payment details not found',404);
        if (d.user_id === actor.id) throw new InputError('Self-review prohibited',403);
        if (d.status !== 'pending_review') throw new InputError('Payment details no longer reviewable',409);
        const prior = await q.query('SELECT id FROM payment_detail_reviews WHERE detail_id=$1 AND detail_version=$2 AND reviewer_user_id=$3',[id,d.version,actor.id]);
        if (prior.rows[0]) throw new InputError('Reviewer already decided',409);
        await q.query(`INSERT INTO payment_detail_reviews(detail_id,detail_version,reviewer_user_id,decision,name_match_confirmed)
          VALUES ($1,$2,$3,$4,$5)`,[id,d.version,actor.id,review.decision,review.name_match_confirmed]);
        const all = await q.query('SELECT decision FROM payment_detail_reviews WHERE detail_id=$1 AND detail_version=$2',[id,d.version]);
        const decisions = all.rows.map(x=>x.decision);
        const status = decisions.includes('reject') ? 'rejected' : decisions.filter(x=>x==='approve').length >= 2 ? 'approved' : 'pending_review';
        await q.query('UPDATE lawyer_payment_details SET status=$2,updated_at=now() WHERE id=$1',[id,status]);
        await audit(q,actor.id,d.application_id,review.decision==='approve'?'payment_details_approved':'payment_details_rejected',
          {version:d.version,new_status:status,...(review.reason?{reason:review.reason}:{})});
        return {id,status,version:d.version};
      });
    },
    async requestEngagement(subject, data) {
      return transaction(async q => {
        const created = await q.query(`INSERT INTO app_users(oidc_subject,role) VALUES ($1,'client')
          ON CONFLICT(oidc_subject) DO NOTHING RETURNING id,role`,[subject]);
        const actor = created.rows[0] || await principal(q, subject);
        if (!['client','applicant'].includes(actor.role)) throw new InputError('Administrative users cannot engage lawyers here',403);
        const a = await q.query(`SELECT id,user_id FROM lawyer_applications WHERE id=$1 AND published=true AND status='verified'
          AND verification_valid_until > CURRENT_DATE`,[data.application_id]);
        if (!a.rows[0]) throw new InputError('Lawyer is not available',404);
        if (a.rows[0].user_id === actor.id) throw new InputError('Cannot engage yourself',403);
        const open = await q.query(`SELECT id FROM engagements WHERE client_user_id=$1 AND application_id=$2 AND status IN ('requested','accepted')`,[actor.id,data.application_id]);
        if (open.rows[0]) throw new InputError('An open engagement with this lawyer already exists',409);
        const r = await q.query(`INSERT INTO engagements(client_user_id,application_id,service_category,client_name,client_contact,direct_payment_acknowledged_at)
          VALUES ($1,$2,$3,$4,$5,now()) RETURNING id,status,created_at`,[actor.id,data.application_id,data.service_category,data.client_name,data.client_contact]);
        await audit(q,actor.id,data.application_id,'engagement_requested',{engagement_id:r.rows[0].id});
        return r.rows[0];
      });
    },
    async myEngagements(subject) {
      // A newly authenticated client may not have an app_users row until their first
      // enquiry. Return an empty dashboard without creating an account implicitly.
      const registered = await pool.query('SELECT id, is_active FROM app_users WHERE oidc_subject=$1',[subject]);
      if (!registered.rows[0]) return [];
      if (!registered.rows[0].is_active) throw new InputError('Account inactive',403);
      const actor = registered.rows[0];
      const r = await pool.query(`SELECT e.id,e.service_category,e.status,e.created_at,e.responded_at,e.closed_at,
        a.id AS application_id,a.full_name AS lawyer_name,a.city AS lawyer_city,a.state AS lawyer_state,
        CASE WHEN a.user_id=$1 THEN 'lawyer' ELSE 'client' END AS my_role,
        CASE WHEN a.user_id=$1 THEN e.client_name END AS client_name,
        CASE WHEN a.user_id=$1 THEN e.client_contact END AS client_contact
        FROM engagements e JOIN lawyer_applications a ON a.id=e.application_id
        WHERE e.client_user_id=$1 OR a.user_id=$1 ORDER BY e.created_at DESC LIMIT 100`,[actor.id]);
      return r.rows;
    },
    async respondEngagement(subject, id, response) {
      return transaction(async q => {
        const {actor,e,isLawyer} = await party(q,subject,id,true);
        if (!isLawyer) throw new InputError('Only the lawyer can respond',403);
        if (e.status !== 'requested') throw new InputError('Engagement already answered',409);
        if (response.decision === 'accept' && e.lawyer_status !== 'verified') throw new InputError('Current professional verification required',403);
        const status = response.decision === 'accept' ? 'accepted' : 'declined';
        await q.query(`UPDATE engagements SET status=$2,responded_at=now(),updated_at=now(),
          conflict_check_confirmed_at=CASE WHEN $2='accepted' THEN now() ELSE NULL END,
          closed_at=CASE WHEN $2='declined' THEN now() ELSE NULL END WHERE id=$1`,[id,status]);
        await audit(q,actor.id,e.application_id,'engagement_'+status,{engagement_id:id});
        return {id,status};
      });
    },
    async closeEngagement(subject, id, action) {
      return transaction(async q => {
        const {actor,e,isLawyer,isClient} = await party(q,subject,id,true);
        if (action === 'complete') {
          if (!isLawyer) throw new InputError('Only the lawyer can mark work complete',403);
          if (e.status !== 'accepted') throw new InputError('Engagement is not active',409);
        } else {
          if (!isClient) throw new InputError('Only the client can cancel a request',403);
          if (e.status !== 'requested') throw new InputError('Only an unanswered request can be cancelled',409);
        }
        const status = action === 'complete' ? 'completed' : 'cancelled';
        await q.query('UPDATE engagements SET status=$2,closed_at=now(),updated_at=now() WHERE id=$1',[id,status]);
        await audit(q,actor.id,e.application_id,'engagement_'+status,{engagement_id:id});
        return {id,status};
      });
    },
    async issueInvoice(subject, engagementId, inv) {
      return transaction(async q => {
        const {actor,e,isLawyer} = await party(q,subject,engagementId,true);
        if (!isLawyer) throw new InputError('Only the lawyer can issue an invoice',403);
        if (e.status !== 'accepted') throw new InputError('Engagement is not active',409);
        if (e.lawyer_status !== 'verified') throw new InputError('Current professional verification required',403);
        const d = await q.query(`SELECT method,account_name,bank_name,account_number,payment_url FROM lawyer_payment_details
          WHERE application_id=$1 AND status='approved'`,[e.application_id]);
        if (!d.rows[0]) throw new InputError('Approved payment details are required before invoicing',409);
        const dup = await q.query('SELECT id FROM invoices WHERE engagement_id=$1 AND lawyer_reference=$2',[engagementId,inv.lawyer_reference]);
        if (dup.rows[0]) throw new InputError('Invoice reference already used',409);
        const p = d.rows[0];
        const r = await q.query(`INSERT INTO invoices(engagement_id,lawyer_reference,fee_type,amount_kobo,due_date,
          pay_method,pay_account_name,pay_bank_name,pay_account_number,pay_url)
          VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10) RETURNING id`,
          [engagementId,inv.lawyer_reference,inv.fee_type,inv.amount_kobo,inv.due_date,p.method,p.account_name,p.bank_name,p.account_number,p.payment_url]);
        await audit(q,actor.id,e.application_id,'invoice_issued',{engagement_id:engagementId,invoice_id:r.rows[0].id});
        const i = await q.query(`SELECT ${INVOICE_COLUMNS} FROM invoices i WHERE i.id=$1`,[r.rows[0].id]);
        return invoiceView(i.rows[0]);
      });
    },
    async listInvoices(subject, engagementId) {
      await party(pool,subject,engagementId);
      const r = await pool.query(`SELECT ${INVOICE_COLUMNS} FROM invoices i WHERE i.engagement_id=$1 ORDER BY i.created_at`,[engagementId]);
      return r.rows.map(invoiceView);
    },
    async reportPaid(subject, invoiceId, report) {
      return transaction(async q => {
        const {actor,e,isLawyer,invoice} = await invoiceParty(q,subject,invoiceId,true);
        if (!isLawyer) throw new InputError('Only the lawyer can report receipt of funds',403);
        if (invoice.status !== 'issued') throw new InputError('Invoice is not awaiting payment',409);
        const receipt = 'LFR-' + new Date().toISOString().slice(0,10).replaceAll('-','') + '-' + randomBytes(5).toString('hex').toUpperCase();
        await q.query(`UPDATE invoices SET status='reported_paid',receipt_number=$2,received_on=$3::date,
          reported_paid_at=now(),updated_at=now() WHERE id=$1`,[invoiceId,receipt,report.received_on]);
        await audit(q,actor.id,e.application_id,'invoice_reported_paid',{invoice_id:invoiceId});
        return {id:invoiceId,status:'reported_paid',receipt_number:receipt};
      });
    },
    async clientPaymentResponse(subject, invoiceId, answer) {
      return transaction(async q => {
        const {actor,e,isClient,invoice} = await invoiceParty(q,subject,invoiceId,true);
        if (!isClient) throw new InputError('Only the client can confirm or dispute',403);
        if (invoice.status !== 'reported_paid') throw new InputError('Nothing to confirm yet',409);
        const status = answer.response === 'confirm' ? 'client_confirmed' : 'disputed';
        await q.query('UPDATE invoices SET status=$2,client_responded_at=now(),updated_at=now() WHERE id=$1',[invoiceId,status]);
        await audit(q,actor.id,e.application_id,'invoice_'+status,{invoice_id:invoiceId});
        return {id:invoiceId,status};
      });
    },
    async voidInvoice(subject, invoiceId) {
      return transaction(async q => {
        const {actor,e,isLawyer,invoice} = await invoiceParty(q,subject,invoiceId,true);
        if (!isLawyer) throw new InputError('Only the lawyer can void an invoice',403);
        if (invoice.status !== 'issued') throw new InputError('Only an unpaid invoice can be voided',409);
        await q.query(`UPDATE invoices SET status='void',updated_at=now() WHERE id=$1`,[invoiceId]);
        await audit(q,actor.id,e.application_id,'invoice_voided',{invoice_id:invoiceId});
        return {id:invoiceId,status:'void'};
      });
    },
    async receipt(subject, invoiceId) {
      const {e,invoice} = await invoiceParty(pool,subject,invoiceId);
      if (!invoice.receipt_number) throw new InputError('No receipt exists for this invoice',409);
      return {
        receipt_number:invoice.receipt_number, issued_by:e.lawyer_name, received_from:e.client_name,
        service_category:e.service_category, fee_type:invoice.fee_type, lawyer_reference:invoice.lawyer_reference,
        amount_kobo:naira(invoice.amount_kobo), currency:invoice.currency, received_on:invoice.received_on,
        paid_to:{method:invoice.pay_method,account_name:invoice.pay_account_name},
        payment_status:invoice.status, client_confirmed:invoice.status==='client_confirmed',
        disputed_by_client:invoice.status==='disputed', notice:PAYMENT_NOTICE
      };
    }
  };
}
