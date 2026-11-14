import test from 'node:test';
import assert from 'node:assert/strict';
import {displayNgn,nairaToKobo,safeLawyerPaymentUrl,validateServiceRequest,validateLawyerInvoice,validateLawyerPaymentDetails,validateReceipt,receiptText,paymentStatusLabels} from '../src/engagements-runtime.mjs';

const lawyer='76d980db-5065-454b-90c0-f5053b6cd7f8';
const service={application_id:lawyer,service_category:'Employment',client_name:'Synthetic Client',client_contact:'client@example.test',direct_payment_acknowledged:true};

test('fee amounts are integer kobo with exact naira display',()=>{
  assert.equal(nairaToKobo('25000.50'),2500050);
  assert.equal(nairaToKobo('100'),10000);
  assert.match(displayNgn(2500050),/25,000\.50/);
  for(const invalid of ['', '1e7', '-100', '50', '25.999', '900000000000', '2500.123', '1,000']) {
    assert.throws(()=>nairaToKobo(invalid),Error);
  }
  assert.throws(()=>displayNgn(-1));
  assert.throws(()=>displayNgn(10.5));
});
test('lawyer payment links cannot redirect outside approved Paystack format',()=>{
  assert.equal(safeLawyerPaymentUrl('https://paystack.shop/pay/firm-name'),'https://paystack.shop/pay/firm-name');
  for(const invalid of ['https://paystack.shop.evil.example/pay/firm','https://paystack.shop/pay/firm?next=https://evil.example','http://paystack.shop/pay/firm','javascript:alert(1)','https://paystack.com/transfer/123','https://paystack.shop@other.example/pay/abc','https://paystack.shop/pay/']) {
    assert.equal(safeLawyerPaymentUrl(invalid),null);
  }
});
test('enquiries are limited to generic metadata and must acknowledge direct lawyer payment',()=>{
  assert.deepEqual(validateServiceRequest(service),service);
  assert.throws(()=>validateServiceRequest({...service,application_id:'unverified'}));
  assert.throws(()=>validateServiceRequest({...service,service_category:'Criminal allegations about X'}));
  assert.throws(()=>validateServiceRequest({...service,direct_payment_acknowledged:false}));
  assert.throws(()=>validateServiceRequest({...service,client_contact:'message me'}));
});
test('lawyer payment instructions are bank account or verified-format Paystack link',()=>{
  assert.equal(validateLawyerPaymentDetails({method:'bank_transfer',account_name:'Synthetic Chambers',bank_name:'Sample Bank',account_number:'0123456789'}).account_number,'0123456789');
  assert.equal(validateLawyerPaymentDetails({method:'paystack_link',account_name:'Synthetic Chambers',payment_url:'https://paystack.com/pay/synthetic-chambers'}).method,'paystack_link');
  assert.throws(()=>validateLawyerPaymentDetails({method:'bank_transfer',account_name:'Synthetic Chambers',bank_name:'Sample Bank',account_number:'12'}));
  assert.throws(()=>validateLawyerPaymentDetails({method:'paystack_link',account_name:'Synthetic Chambers',payment_url:'https://malicious.example/pay/test'}));
});
test('invoices must have supported fee type, safe amount and valid date',()=>{
  const invoice={lawyer_reference:'INV-2026-001',fee_type:'Consultation',amount_naira:'25000.50',due_date:'2026-11-30'};
  assert.equal(validateLawyerInvoice(invoice,new Date('2026-11-14T00:00:00.000Z')).amount_kobo,2500050);
  assert.throws(()=>validateLawyerInvoice({...invoice,fee_type:'Platform escrow fee'},new Date('2026-11-14T00:00:00.000Z')));
  assert.throws(()=>validateLawyerInvoice({...invoice,lawyer_reference:'client secret text'},new Date('2026-11-14T00:00:00.000Z')));
  assert.throws(()=>validateLawyerInvoice({...invoice,due_date:'2026-02-30'},new Date('2026-11-14T00:00:00.000Z')));
  assert.throws(()=>validateLawyerInvoice({...invoice,due_date:'2026-11-13'},new Date('2026-11-14T00:00:00.000Z')));
});
test('a receipt must disclose that payments are reported, not verified by LexFlow',()=>{
  const receipt={receipt_number:'LFR-20261114-ABCDEFAB12',issued_by:'Synthetic Chambers',received_from:'Synthetic Client',
    service_category:'Employment',fee_type:'Consultation',lawyer_reference:'INV-2026-001',
    amount_kobo:2500050,received_on:'2026-11-14',
    client_confirmed:false,disputed_by_client:false,
    notice:'LexFlow did not receive, hold, process or verify this payment.'};
  assert.equal(validateReceipt(receipt),receipt);
  assert.match(receiptText(receipt),/Not confirmed by client/);
  assert.match(receiptText(receipt),/did not receive, hold, process or verify/);
  assert.throws(()=>receiptText({...receipt,notice:'Guaranteed received by platform'}));
  assert.match(paymentStatusLabels.reported_paid,/not confirmed/i);
});
