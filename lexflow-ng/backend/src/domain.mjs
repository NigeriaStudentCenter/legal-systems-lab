export class InputError extends Error {
  constructor(message, statusCode = 400) { super(message); this.name = 'InputError'; this.statusCode = statusCode; }
}
export const zones = Object.freeze({
  'North Central': ['Benue','Kogi','Kwara','Nasarawa','Niger','Plateau','Federal Capital Territory'],
  'North East': ['Adamawa','Bauchi','Borno','Gombe','Taraba','Yobe'],
  'North West': ['Jigawa','Kaduna','Kano','Katsina','Kebbi','Sokoto','Zamfara'],
  'South East': ['Abia','Anambra','Ebonyi','Enugu','Imo'],
  'South South': ['Akwa Ibom','Bayelsa','Cross River','Delta','Edo','Rivers'],
  'South West': ['Ekiti','Lagos','Ogun','Ondo','Osun','Oyo']
});
export const states = Object.freeze(Object.values(zones).flat());
export const practiceAreas = Object.freeze([
  'Criminal defence & rights','Property & tenancy','Family & succession',
  'Business & CAC','Employment','Dispute resolution','Technology & IP'
]);
export const languages = Object.freeze(['English','Hausa','Yoruba','Igbo','Pidgin','Other']);
const isPlain = x => Boolean(x) && typeof x === 'object' && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const fail = x => { throw new InputError(x); };
const unique = items => [...new Set(items)];

function string(value, name, min, max, pattern) {
  if (typeof value !== 'string') return fail(name + ' is required');
  const s = value.trim().replace(/\s+/gu, ' ');
  if (s.length < min || s.length > max || /[\u0000-\u001f\u007f]/u.test(s) || (pattern && !pattern.test(s)))
    return fail('Invalid ' + name);
  return s;
}
function enumeration(value, choices, field) {
  if (!choices.includes(value)) return fail('Unsupported ' + field);
  return value;
}
function selection(value, choices, field, max) {
  if (!Array.isArray(value) || value.length < 1 || value.length > max || value.some(x => typeof x !== 'string' || !choices.includes(x)))
    return fail('Invalid ' + field);
  if (unique(value).length !== value.length) return fail('Duplicate ' + field);
  return value;
}
function exactFields(obj, allowed) {
  if (!isPlain(obj)) return fail('Expected a JSON object');
  if (Object.keys(obj).some(k => !allowed.includes(k))) return fail('Unrecognised field');
}
export function parseApplication(value, year = new Date().getUTCFullYear()) {
  exactFields(value, ['full_name','state','city','year_of_call','practice_areas','languages','summary','privacy_acknowledged','verification_authorised']);
  if (value.privacy_acknowledged !== true || value.verification_authorised !== true)
    return fail('Privacy acknowledgment and verification consent are required');
  const y = value.year_of_call;
  if (!Number.isInteger(y) || y < 1960 || y > year) return fail('Invalid year_of_call');
  const summary = string(value.summary, 'summary', 25, 350);
  if (/(?:https?:\/\/|www\.|\b(?:guaranteed|100% success)\b)/iu.test(summary)) return fail('Promotional claims and web links need separate review');
  return Object.freeze({
    full_name: string(value.full_name,'full_name',3,110,/^[\p{L} .\-']+$/u),
    state: enumeration(value.state, states, 'state'),
    city: string(value.city,'city',2,75,/^[\p{L}\p{N} ,.\-']+$/u),
    year_of_call: y,
    practice_areas: selection(value.practice_areas, practiceAreas, 'practice_areas', 5),
    languages: selection(value.languages, languages, 'languages', 5),
    summary,
    privacy_acknowledged: true, verification_authorised: true
  });
}
export function parseFilters(raw) {
  if (!isPlain(raw)) return fail('Invalid search');
  const allowed = ['state', 'practice', 'language', 'page', 'limit'];
  if (Object.keys(raw).some(k => !allowed.includes(k))) return fail('Unsupported search parameter');
  const state = raw.state ? enumeration(raw.state, states, 'state') : null;
  const practice = raw.practice ? enumeration(raw.practice, practiceAreas, 'practice') : null;
  const language = raw.language ? enumeration(raw.language, languages, 'language') : null;
  const page = raw.page === undefined ? 1 : Number(raw.page);
  const limit = raw.limit === undefined ? 20 : Number(raw.limit);
  if (!Number.isInteger(page) || page < 1 || page > 100 || !Number.isInteger(limit) || limit < 1 || limit > 30)
    return fail('Invalid pagination');
  return {state, practice, language, limit, offset: (page - 1) * limit};
}
function isoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fail('Date must use YYYY-MM-DD');
  const d = new Date(s + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== s) return fail('Invalid date');
  return s;
}
export function parseReview(raw, now = new Date()) {
  exactFields(raw, ['decision','source','reference','checked_on','valid_until','reason']);
  if (!['approve','reject'].includes(raw.decision)) return fail('Invalid review decision');
  if (raw.decision === 'reject') {
    return {decision:'reject',reason:string(raw.reason,'reason',8,220)};
  }
  if (!['nba_digital_licence','nba_annual_list','other_official'].includes(raw.source)) return fail('Unsupported verification source');
  const checked_on = isoDate(raw.checked_on), valid_until = isoDate(raw.valid_until);
  const today = now.toISOString().slice(0,10);
  if (checked_on > today || valid_until <= today || valid_until < checked_on) return fail('Verification must be current');
  return {decision:'approve',source:raw.source,
    reference:string(raw.reference,'reference',4,100,/^[\p{L}\p{N}\-_.\/ ]+$/u),
    checked_on,valid_until};
}
export function parsePublication(raw) {
  exactFields(raw, ['profile_reviewed','remuneration_reviewed']);
  if (raw.profile_reviewed !== true || raw.remuneration_reviewed !== true)
    return fail('Publication requires professional conduct and remuneration review');
  return {profile_reviewed:true,remuneration_reviewed:true};
}
export function parseSuspension(raw) {
  exactFields(raw,['reason']);
  return {reason:string(raw.reason,'reason',10,220)};
}
export function reviewOutcome(reviewDecisions) {
  if (!Array.isArray(reviewDecisions)) throw new InputError('Invalid review history');
  if (reviewDecisions.includes('reject')) return 'rejected';
  return reviewDecisions.filter(x=>x==='approve').length >= 2 ? 'verified' : 'pending';
}

// ---- Direct-to-lawyer engagements, invoices and receipts ----
// LexFlow records what was invoiced and what each party reported. It never handles the money.
export const feeTypes = Object.freeze(['Consultation','Fixed-fee service','Retainer deposit','Disbursements','Other professional fees']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parsePaymentDetails(raw) {
  exactFields(raw, ['method','account_name','bank_name','account_number','payment_url']);
  const account_name = string(raw.account_name,'account_name',3,110,/^[\p{L}\p{N} .,&\-']+$/u);
  if (raw.method === 'bank_transfer') {
    if (raw.payment_url !== undefined) return fail('Unrecognised field');
    if (typeof raw.account_number !== 'string' || !/^[0-9]{10}$/.test(raw.account_number)) return fail('Invalid account_number');
    return {method:'bank_transfer',account_name,
      bank_name:string(raw.bank_name,'bank_name',2,80,/^[\p{L}\p{N} .&\-']+$/u),
      account_number:raw.account_number,payment_url:null};
  }
  if (raw.method === 'paystack_link') {
    if (raw.bank_name !== undefined || raw.account_number !== undefined) return fail('Unrecognised field');
    // The lawyer's OWN Paystack page. Only Paystack-hosted pages; no query strings or redirects.
    if (typeof raw.payment_url !== 'string' || !/^https:\/\/(paystack\.com|paystack\.shop)\/pay\/[A-Za-z0-9_-]{2,80}$/.test(raw.payment_url))
      return fail('Invalid payment_url');
    return {method:'paystack_link',account_name,bank_name:null,account_number:null,payment_url:raw.payment_url};
  }
  return fail('Unsupported method');
}
export function parsePaymentDetailReview(raw) {
  exactFields(raw, ['decision','name_match_confirmed','reason']);
  if (raw.decision === 'reject') return {decision:'reject',name_match_confirmed:false,reason:string(raw.reason,'reason',8,220)};
  if (raw.decision !== 'approve') return fail('Invalid review decision');
  if (raw.name_match_confirmed !== true) return fail('Approval requires confirming the account name matches the verified lawyer or firm');
  return {decision:'approve',name_match_confirmed:true};
}
export function parseEngagementRequest(raw) {
  exactFields(raw, ['application_id','service_category','client_name','client_contact','direct_payment_acknowledged']);
  if (typeof raw.application_id !== 'string' || !uuidPattern.test(raw.application_id)) return fail('Invalid application_id');
  if (raw.direct_payment_acknowledged !== true)
    return fail('Acknowledge that fees are paid directly to the lawyer and are not held by LexFlow');
  const contact = string(raw.client_contact,'client_contact',7,120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && !/^\+?[0-9][0-9 ]{8,17}$/.test(contact)) return fail('Invalid client_contact');
  return {application_id:raw.application_id.toLowerCase(),
    service_category:enumeration(raw.service_category, practiceAreas, 'service_category'),
    client_name:string(raw.client_name,'client_name',3,110,/^[\p{L} .\-']+$/u),
    client_contact:contact};
}
export function parseEngagementResponse(raw) {
  exactFields(raw, ['decision','conflict_check_confirmed']);
  if (raw.decision === 'decline') return {decision:'decline'};
  if (raw.decision !== 'accept') return fail('Invalid decision');
  if (raw.conflict_check_confirmed !== true) return fail('Acceptance requires a completed conflict check');
  return {decision:'accept'};
}
export function parseInvoice(raw, now = new Date()) {
  exactFields(raw, ['lawyer_reference','fee_type','amount_kobo','due_date']);
  const amount = raw.amount_kobo;
  if (!Number.isSafeInteger(amount) || amount < 10000 || amount > 1000000000000) return fail('Invalid amount_kobo');
  const due_date = isoDate(raw.due_date);
  if (due_date < now.toISOString().slice(0,10)) return fail('Due date cannot be in the past');
  return {lawyer_reference:string(raw.lawyer_reference,'lawyer_reference',3,40,/^[A-Z0-9][A-Z0-9\-\/]+$/),
    fee_type:enumeration(raw.fee_type, feeTypes, 'fee_type'),amount_kobo:amount,due_date};
}
export function parsePaidReport(raw, now = new Date()) {
  exactFields(raw, ['received_on','funds_received_confirmed']);
  if (raw.funds_received_confirmed !== true) return fail('Confirm that the funds have reached your account');
  const received_on = isoDate(raw.received_on);
  if (received_on > now.toISOString().slice(0,10)) return fail('Receipt date cannot be in the future');
  return {received_on};
}
export function parseClientResponse(raw) {
  exactFields(raw, ['response']);
  if (!['confirm','dispute'].includes(raw.response)) return fail('Invalid response');
  return {response:raw.response};
}
