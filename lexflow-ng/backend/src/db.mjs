import pg from 'pg';
import { InputError, reviewOutcome } from './domain.mjs';
const { Pool } = pg;
const expose = row => row ? {
  id: row.id, full_name: row.full_name, state: row.state, city: row.city,
  year_of_call: row.year_of_call, practice_areas: row.practice_areas,
  languages: row.languages, summary: row.summary,
  verification_valid_until: row.verification_valid_until,
  // Never put source references, reviewer identities or user IDs in a public profile.
} : null;

export function makeDb(config) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5000,
    ssl: config.databaseSsl ? {rejectUnauthorized:true} : false
  });
  async function transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve original failure */ }
      throw err;
    } finally { client.release(); }
  }
  async function audit(q, actor, target, action, metadata={}) {
    await q.query(
      'INSERT INTO audit_events(actor_user_id,target_application_id,action,metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [actor,target,action,JSON.stringify(metadata)]
    );
  }
  async function principal(q, subject) {
    const r = await q.query('SELECT id,role,is_active FROM app_users WHERE oidc_subject=$1', [subject]);
    if (!r.rows[0] || !r.rows[0].is_active) throw new InputError('Account not registered or inactive',403);
    return r.rows[0];
  }
  async function requireRole(q, subject, roles) {
    const user = await principal(q,subject);
    if (!roles.includes(user.role)) throw new InputError('Insufficient permissions',403);
    return user;
  }
  return {
    pool,
    async close() { await pool.end(); },
    async ready() { await pool.query('SELECT 1'); },
    async listPublic(filters) {
      const {state,practice,language,limit,offset} = filters;
      const query = `SELECT id,full_name,state,city,year_of_call,practice_areas,languages,summary,verification_valid_until
        FROM lawyer_applications
        WHERE published=true AND status='verified' AND verification_valid_until > CURRENT_DATE
          AND ($1::text IS NULL OR state=$1)
          AND ($2::text IS NULL OR $2=ANY(practice_areas))
          AND ($3::text IS NULL OR $3=ANY(languages))
        ORDER BY full_name COLLATE "C" ASC, id ASC LIMIT $4 OFFSET $5`;
      const rows = await pool.query(query,[state,practice,language,limit+1,offset]);
      return {profiles:rows.rows.slice(0,limit).map(expose),has_more:rows.rows.length>limit};
    },
    async apply(subject,data) {
      return transaction(async q => {
        const created = await q.query(`
          INSERT INTO app_users(oidc_subject,role) VALUES ($1,'applicant')
          ON CONFLICT(oidc_subject) DO NOTHING
          RETURNING id`,[subject]);
        let actor;
        if (created.rows[0]) actor = created.rows[0];
        else actor = await principal(q,subject);
        // Reviewer / publisher / compliance identities cannot become applicants.
        const check = await q.query('SELECT role FROM app_users WHERE id=$1',[actor.id]);
        if (check.rows[0].role !== 'applicant') throw new InputError('Administrative users cannot apply',403);
        const existing = await q.query('SELECT id FROM lawyer_applications WHERE user_id=$1',[actor.id]);
        if (existing.rows[0]) throw new InputError('Application already exists',409);
        const inserted = await q.query(`
          INSERT INTO lawyer_applications(user_id,full_name,state,city,year_of_call,practice_areas,languages,summary,privacy_acknowledged_at,verification_authorised_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
          RETURNING id,status,created_at`,
          [actor.id,data.full_name,data.state,data.city,data.year_of_call,data.practice_areas,data.languages,data.summary]);
        await audit(q,actor.id,inserted.rows[0].id,'application_submitted');
        return inserted.rows[0];
      });
    },
    async myApplication(subject) {
      const r=await pool.query(`SELECT a.id,a.full_name,a.state,a.city,a.year_of_call,a.practice_areas,a.languages,a.summary,
        a.status,a.published,a.verification_valid_until,a.created_at,a.updated_at
        FROM lawyer_applications a JOIN app_users u ON u.id=a.user_id
        WHERE u.oidc_subject=$1 AND u.is_active=true`,[subject]);
      return r.rows[0]||null;
    },
    async queue(subject) {
      await requireRole(pool,subject,['reviewer','publisher','compliance_admin']);
      const r=await pool.query(`SELECT id,full_name,state,city,year_of_call,practice_areas,languages,summary,
        status,published,verification_valid_until,created_at FROM lawyer_applications
        WHERE status IN ('pending','verified') ORDER BY created_at ASC LIMIT 100`);
      return r.rows;
    },
    async review(subject,id,review) {
      return transaction(async q => {
        const actor=await requireRole(q,subject,['reviewer','compliance_admin']);
        const lock=await q.query('SELECT * FROM lawyer_applications WHERE id=$1 FOR UPDATE',[id]);
        const a=lock.rows[0];
        if (!a) throw new InputError('Application not found',404);
        if (a.user_id === actor.id) throw new InputError('Self-verification prohibited',403);
        if (a.status !== 'pending' || a.published) throw new InputError('Application no longer reviewable',409);
        const existing=await q.query('SELECT id FROM verification_reviews WHERE application_id=$1 AND reviewer_user_id=$2',[id,actor.id]);
        if (existing.rows[0]) throw new InputError('Reviewer already decided',409);
        await q.query(`INSERT INTO verification_reviews(application_id,reviewer_user_id,decision,verification_source,source_reference,checked_on,valid_until,rejection_reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[id,actor.id,review.decision,review.source??null,review.reference??null,review.checked_on??null,review.valid_until??null,review.reason??null]);
        const checks=await q.query('SELECT decision,valid_until FROM verification_reviews WHERE application_id=$1',[id]);
        const status=reviewOutcome(checks.rows.map(x=>x.decision));
        let until=null;
        if (status==='verified') {
          const valid=checks.rows.filter(x=>x.decision==='approve').map(x=>String(x.valid_until instanceof Date?x.valid_until.toISOString().slice(0,10):x.valid_until));
          until=valid.sort()[0];
          if(until <= new Date().toISOString().slice(0,10)) throw new InputError('Verification expired during review',409);
        }
        await q.query(`UPDATE lawyer_applications SET status=$2,verification_valid_until=$3::date,
          verified_at=CASE WHEN $2='verified' THEN now() ELSE null END,
          updated_at=now(),version=version+1 WHERE id=$1`,[id,status,until]);
        await audit(q,actor.id,id,review.decision==='approve'?'verification_approved':'verification_rejected',{new_status:status});
        return {id,status,verification_valid_until:until};
      });
    },
    async publish(subject,id) {
      return transaction(async q => {
        const actor=await requireRole(q,subject,['publisher','compliance_admin']);
        const lock=await q.query('SELECT * FROM lawyer_applications WHERE id=$1 FOR UPDATE',[id]);
        const a=lock.rows[0];
        if (!a) throw new InputError('Application not found',404);
        if(a.user_id===actor.id)throw new InputError('Cannot publish own profile',403);
        if(a.status!=='verified'||!a.verification_valid_until||
          String(a.verification_valid_until instanceof Date?a.verification_valid_until.toISOString().slice(0,10):a.verification_valid_until) <=new Date().toISOString().slice(0,10))
          throw new InputError('Current independent verification required',409);
        if(a.published) throw new InputError('Already published',409);
        const prior=await q.query('SELECT id FROM verification_reviews WHERE application_id=$1 AND reviewer_user_id=$2',[id,actor.id]);
        if(prior.rows[0])throw new InputError('Publication requires independent reviewer',403);
        const reviews=await q.query('SELECT count(*)::integer AS approved FROM verification_reviews WHERE application_id=$1 AND decision=$2',[id,'approve']);
        if(reviews.rows[0].approved<2)throw new InputError('Two distinct independent reviews required',409);
        await q.query(`UPDATE lawyer_applications SET published=true,published_at=now(),
          approved_for_publication_by=$2,updated_at=now(),version=version+1 WHERE id=$1`,[id,actor.id]);
        await audit(q,actor.id,id,'profile_published',{professional_rules_checked:true,remuneration_checked:true});
        return {id,published:true};
      });
    },
    async suspend(subject,id,details) {
      return transaction(async q => {
        const actor=await requireRole(q,subject,['compliance_admin']);
        const lock=await q.query('SELECT id,status,published FROM lawyer_applications WHERE id=$1 FOR UPDATE',[id]);
        const a=lock.rows[0];
        if (!a)throw new InputError('Application not found',404);
        if(a.status==='suspended')throw new InputError('Already suspended',409);
        await q.query(`UPDATE lawyer_applications SET status='suspended',published=false,
          verification_valid_until=null,updated_at=now(),version=version+1 WHERE id=$1`,[id]);
        // Reasons remain in restricted audit records; never expose to public.
        await audit(q,actor.id,id,'profile_suspended',{reason:details.reason});
        return {id,suspended:true,published:false};
      });
    }
  };
}
