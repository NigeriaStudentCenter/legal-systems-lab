// One-off operator task. Encrypts any bank account numbers still stored in clear text
// (rows written before sql/003_privacy.sql), then makes clear text impossible.
// Run with an OPERATOR database login (it alters constraints), never the API login:
//   ADMIN_DATABASE_URL=... PAYMENT_DETAILS_KEY=... node scripts/encrypt-account-numbers.mjs
// Safe to run more than once.
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { parseKey, makeAccountCipher } from '../src/crypto.mjs';

export async function encryptExisting(pool, cipher) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const details = await client.query('SELECT id,account_number FROM lawyer_payment_details WHERE account_number IS NOT NULL FOR UPDATE');
    for (const row of details.rows) {
      await client.query('UPDATE lawyer_payment_details SET account_number_enc=$2,account_last4=$3,account_number=NULL WHERE id=$1',
        [row.id, cipher.encrypt(row.account_number), row.account_number.slice(-4)]);
    }
    const invoices = await client.query('SELECT id,pay_account_number FROM invoices WHERE pay_account_number IS NOT NULL FOR UPDATE');
    for (const row of invoices.rows) {
      await client.query('UPDATE invoices SET pay_account_number_enc=$2,pay_account_number=NULL WHERE id=$1',
        [row.id, cipher.encrypt(row.pay_account_number)]);
    }
    await client.query('ALTER TABLE lawyer_payment_details DROP CONSTRAINT IF EXISTS no_clear_account_number');
    await client.query('ALTER TABLE lawyer_payment_details ADD CONSTRAINT no_clear_account_number CHECK (account_number IS NULL)');
    await client.query('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS no_clear_pay_account_number');
    await client.query('ALTER TABLE invoices ADD CONSTRAINT no_clear_pay_account_number CHECK (pay_account_number IS NULL)');
    await client.query('COMMIT');
    return { payment_details: details.rowCount, invoices: invoices.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const key = parseKey(process.env.PAYMENT_DETAILS_KEY);
  if (!key || !process.env.ADMIN_DATABASE_URL) { process.stderr.write('ADMIN_DATABASE_URL and PAYMENT_DETAILS_KEY are required\n'); process.exit(1); }
  const pool = new pg.Pool({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true } });
  try {
    const done = await encryptExisting(pool, makeAccountCipher(key));
    process.stdout.write(`Encrypted ${done.payment_details} payment detail(s) and ${done.invoices} invoice snapshot(s); clear text is now forbidden.\n`);
  } catch { process.stderr.write('Encryption failed; nothing was changed.\n'); process.exitCode = 1; }
  finally { await pool.end(); }
}
