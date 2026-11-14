// Pure browser-safe checks, mirrored by stricter backend validation.
// Nothing in this module treats a lawyer's report as independently verified payment.
import {practiceAreas} from './runtime.mjs';

export const feeTypes=Object.freeze(['Consultation','Fixed-fee service','Retainer deposit','Disbursements','Other professional fees']);
export const paymentStatusLabels=Object.freeze({
  issued:'Invoice issued — payment not confirmed',
  reported_paid:'Lawyer reports receiving payment — client has not confirmed',
  client_confirmed:'Client agrees payment was made — not independently verified by LexFlow',
  disputed:'Payment disputed — resolve with the lawyer directly',
  void:'Invoice voided'
});
export function displayNgn(kobo){
  if(!Number.isSafeInteger(kobo)||kobo<0)throw Error('Invalid amount');
  return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2}).format(kobo/100);
}
export function nairaToKobo(value){
  if(typeof value!=='string'||!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(value.trim()))throw Error('Enter an amount in naira with up to two decimal places');
  const [naira,decimal='']=value.trim().split('.');
  const kobo=Number(naira)*100+Number(decimal.padEnd(2,'0'));
  if(!Number.isSafeInteger(kobo)||kobo<10000||kobo>1000000000000)throw Error('Amount must be between ₦100 and ₦10 billion');
  return kobo;
}
export function safeLawyerPaymentUrl(value){
  if(typeof value!=='string')return null;
  if(!/^https:\/\/(paystack\.com|paystack\.shop)\/pay\/[A-Za-z0-9_-]{2,80}$/.test(value))return null;
  return value;
}
export function validateServiceRequest(input){
  const out={application_id:input?.application_id,service_category:input?.service_category,
    client_name:String(input?.client_name||'').trim(),client_contact:String(input?.client_contact||'').trim(),
    direct_payment_acknowledged:input?.direct_payment_acknowledged===true};
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(out.application_id||''))throw Error('Select a verified lawyer');
  if(!practiceAreas.includes(out.service_category))throw Error('Choose a legal service category');
  if(out.client_name.length<3||out.client_name.length>110)throw Error('Enter your name');
  if(out.client_contact.length<7||out.client_contact.length>120||
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.client_contact)&&!/^\+?[0-9][0-9 ]{8,17}$/.test(out.client_contact)))throw Error('Use a valid email address or phone number');
  if(!out.direct_payment_acknowledged)throw Error('Please acknowledge that legal fees go to the lawyer, not LexFlow');
  return out;
}
export function validateLawyerInvoice(input,today=new Date()){
  const out={lawyer_reference:String(input?.lawyer_reference||'').trim(),fee_type:input?.fee_type,
    amount_kobo:nairaToKobo(input?.amount_naira),due_date:input?.due_date};
  if(!/^[A-Z0-9][A-Z0-9\/-]{2,39}$/.test(out.lawyer_reference))throw Error('Use an uppercase invoice reference (letters, numbers, slash or dash)');
  if(!feeTypes.includes(out.fee_type))throw Error('Choose an approved fee category');
  if(typeof out.due_date!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(out.due_date) ||
      Number.isNaN(Date.parse(out.due_date+'T00:00:00Z'))||
      new Date(out.due_date+'T00:00:00Z').toISOString().slice(0,10)!==out.due_date ||
      out.due_date<today.toISOString().slice(0,10))throw Error('Use a valid future or current due date');
  return out;
}
export function validateLawyerPaymentDetails(input){
  const account_name=String(input?.account_name||'').trim();
  if(account_name.length<3||account_name.length>110)throw Error('Enter the verified lawyer or firm payee name');
  if(input?.method==='bank_transfer'){
    const account_number=String(input?.account_number||'').trim();
    const bank_name=String(input?.bank_name||'').trim();
    if(!/^\d{10}$/.test(account_number))throw Error('Use a 10-digit Nigerian account number');
    if(bank_name.length<2||bank_name.length>80)throw Error('Enter the bank name');
    return {method:'bank_transfer',account_name,bank_name,account_number};
  }
  if(input?.method==='paystack_link'){
    const url=safeLawyerPaymentUrl(input?.payment_url);
    if(!url)throw Error('Use an approved Paystack payment-page URL belonging to the lawyer or firm');
    return {method:'paystack_link',account_name,payment_url:url};
  }
  throw Error('Choose a supported payment method');
}
export function validateReceipt(record){
  if(!record||typeof record!=='object'||typeof record.notice!=='string'||!record.notice.includes('did not receive, hold, process or verify'))throw Error('Receipt transparency notice missing');
  if(!record.receipt_number||!Number.isSafeInteger(record.amount_kobo))throw Error('Invalid receipt record');
  return record;
}
export function receiptText(receipt){
  const r=validateReceipt(receipt);
  return ['LEXFLOW NG — LAWYER-ISSUED RECEIPT RECORD',
    'Receipt number: '+r.receipt_number,
    'Issued by: '+(r.issued_by||''),
    'Client: '+(r.received_from||''),
    'Lawyer invoice reference: '+(r.lawyer_reference||''),
    'Service category: '+(r.service_category||''),
    'Amount: '+displayNgn(r.amount_kobo),
    'Lawyer-reported receipt date: '+(r.received_on||''),
    'Client confirmation: '+(r.client_confirmed?'Confirmed by client':r.disputed_by_client?'Disputed by client':'Not confirmed by client'),
    '',r.notice].join('\n');
}
