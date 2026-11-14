import {PublicClientApplication} from '@azure/msal-browser';
import {states,practiceAreas,validatePortalConfig} from './runtime.mjs';
import {feeTypes,paymentStatusLabels,displayNgn,safeLawyerPaymentUrl,validateServiceRequest,validateLawyerInvoice,validateLawyerPaymentDetails,receiptText} from './engagements-runtime.mjs';

const $=sel=>document.querySelector(sel);
const page=document.body.dataset.page;
const cfg=window.LEXFLOW_PORTAL;
let settings=null,msal=null,selectedLawyerId='',selectedEngagementId='',engagements=[],directory=[],lastReceiptText='';
const apiError=(message,node='#engagementSystemStatus')=>{const n=$(node);if(n){n.textContent=String(message);n.classList.add('error')}};
const notify=(message,node)=>{const n=$(node);if(n){n.textContent=String(message);n.classList.remove('error')}};
const node=(name,value='',className='')=>{const element=document.createElement(name);element.textContent=String(value??'');if(className)element.className=className;return element;};
function row(...children){const r=node('div','','record');r.append(...children);return r}
function labeled(label,value){const p=node('p');p.append(node('strong',label+': '),document.createTextNode(String(value??'—')));return p}
function action(label,click,style='btn outline'){const b=node('button',label,style);b.type='button';b.addEventListener('click',()=>Promise.resolve().then(click).catch(err=>apiError(err.message)));return b}
function download(filename,content){const blob=new Blob([content],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();setTimeout(()=>{URL.revokeObjectURL(url);link.remove()},500)}
function populate(select,choices){for(const value of choices){const o=node('option',value);o.value=value;select.append(o)}}
const account=()=>msal?.getActiveAccount()??msal?.getAllAccounts()?.[0]??null;
function locked(){notify('Staging client–lawyer workflows are disabled pending identity, legal and privacy release approvals. The current public marketplace remains a fictional demonstration.');}
function setAuthUI(){
  const signed=Boolean(account());
  $('#engagementSignIn').disabled=signed;
  $('#engagementSignOut').disabled=!signed;
  notify(signed?'Signed in to staging identity provider; no verified-lawyer status implied.':'Not signed in','#engagementIdentity');
  if(page==='client'){
    $('#findLawyers').disabled=!signed;
    $('#clientRefresh').disabled=!signed;
    $('#clientEnquiryFields').disabled=!signed||!selectedLawyerId;
  }else{
    $('#lawyerRefresh').disabled=!signed;
    $('#paymentDetailsFields').disabled=!signed;
    $('#invoiceFields').disabled=!signed||!selectedEngagementId;
  }
}
async function signIn(){
  const result=await msal.loginPopup({scopes:[settings.apiScope],prompt:'select_account'});
  if(result.account)msal.setActiveAccount(result.account);
  setAuthUI();
  await refresh();
}
async function token(){
  const user=account();
  if(!user)throw Error('Sign in before proceeding');
  try {return (await msal.acquireTokenSilent({account:user,scopes:[settings.apiScope]})).accessToken;}
  catch{return (await msal.acquireTokenPopup({account:user,scopes:[settings.apiScope]})).accessToken;}
}
async function callApi(path,{method='GET',body,publicAccess=false}={}){
  if(!settings?.enabled)throw Error('Portal is not enabled');
  const bearer=publicAccess?null:await token();
  const res=await fetch(settings.apiBaseUrl+path,{method,credentials:'omit',mode:'cors',cache:'no-store',
    headers:{Accept:'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{}),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Request failed ('+res.status+')');
  return data;
}
async function refresh(){
  if(!account())return;
  if(page==='client')await loadClientRequests();
  else {await Promise.all([loadLawyerRequests(),loadPaymentDetails()]);}
}
function fillClientDirectory(records){
  directory=Array.isArray(records)?records:[];
  const box=$('#lawyerResults');box.replaceChildren();
  if(!directory.length){box.append(node('p','No verified and published lawyers match these filters.'));return;}
  for(const profile of directory){
    const info=node('div','','record-main');
    info.append(node('strong',profile.full_name||'Professional'),node('p',
      [profile.city,profile.state,(profile.practice_areas||[]).join(' / ')].filter(Boolean).join(' · ')));
    const b=action('Choose lawyer',()=>{
      selectedLawyerId=profile.id;
      notify([profile.full_name,profile.city,profile.state].filter(Boolean).join(' · '),'#selectedLawyer');
      $('#clientEnquiryFields').disabled=false;
      $('#enquiryCategory').value=profile.practice_areas?.[0]||practiceAreas[0];
      $('#enquiryCategory').focus();
    });
    box.append(row(info,b));
  }
}
async function findLawyers(){
  const params=new URLSearchParams();
  if($('#findState').value)params.set('state',$('#findState').value);
  if($('#findPractice').value)params.set('practice',$('#findPractice').value);
  const r=await callApi('/v1/directory?'+params.toString(),{publicAccess:true});
  fillClientDirectory(r.profiles);
}
function displayClientRequests(records){
  engagements=Array.isArray(records)?records.filter(e=>e.my_role==='client'):[];
  const panel=$('#clientRequests');panel.replaceChildren();
  if(!engagements.length){panel.append(node('p','No client requests associated with this authenticated account.'));return;}
  for(const e of engagements){
    const info=node('div','','record-main');
    info.append(node('strong',e.lawyer_name||'Lawyer'),node('p',[e.service_category,e.lawyer_state,e.id].filter(Boolean).join(' · ')),
      node('div','Status: '+e.status,'record-status'));
    const b=action('Invoices and updates',()=>selectClientEngagement(e));
    const r=row(info,b);
    if(e.status==='requested')r.append(action('Withdraw',async()=>{
      if(!confirm('Withdraw this unanswered service request?'))return;
      await callApi('/v1/engagements/'+encodeURIComponent(e.id)+'/cancel',{method:'POST'});
      await loadClientRequests();notify('Request withdrawn.','#enquiryResult');
    }));
    panel.append(r);
  }
}
async function loadClientRequests(){
  const r=await callApi('/v1/engagements');
  displayClientRequests(r.engagements);
}
async function selectClientEngagement(e){
  selectedEngagementId=e.id;
  $('#receiptPreview').hidden=true;
  await loadInvoices(e.id,'client');
}
function paymentInstruction(invoice,container){
  const pay=invoice.pay_to;
  if(!pay)return;
  container.append(node('strong','Pay the lawyer directly'));
  if(pay.method==='bank_transfer'){
    container.append(labeled('Approved payee name',pay.account_name),labeled('Bank',pay.bank_name),labeled('Account',pay.account_number));
  }else if(pay.method==='paystack_link'){
    const target=safeLawyerPaymentUrl(pay.payment_url);
    if(target){
      const a=node('a','Open the lawyer’s Paystack payment page');
      a.href=target;a.target='_blank';a.rel='noopener noreferrer';container.append(a);
    }else container.append(node('p','Payment link is not approved for display.'));
  }
  container.append(node('p','No legal fees are received or held by LexFlow. This payment instruction belongs to the law firm.','secure-message'));
}
async function loadReceipt(invoiceId,mode){
  const result=await callApi('/v1/invoices/'+encodeURIComponent(invoiceId)+'/receipt');
  lastReceiptText=receiptText(result);
  const panel=mode==='client'?'#receiptPreview':'#lawyerReceiptPreview';
  const body=mode==='client'?'#receiptBody':'#lawyerReceiptBody';
  text(body,lastReceiptText);
  $(panel).hidden=false;
}
function text(selector,value){const n=$(selector);if(n)n.textContent=String(value??'')}
async function loadInvoices(engagementId,mode){
  const result=await callApi('/v1/engagements/'+encodeURIComponent(engagementId)+'/invoices');
  const target=$(mode==='client'?'#clientInvoices':'#lawyerInvoices');
  target.replaceChildren(node('h3','Invoice history','list-heading'));
  if(!result.invoices?.length){target.append(node('p','No invoices have been issued.','empty-state'));return;}
  for(const i of result.invoices){
    const card=node('div','','invoice');
    card.append(node('h3',i.lawyer_reference||'Lawyer invoice'),
      labeled('Fee category',i.fee_type),
      labeled('Amount',displayNgn(i.amount_kobo)),
      labeled('Due date',String(i.due_date??'').slice(0,10)),
      node('p',paymentStatusLabels[i.status]||'Status: '+i.status));
    if(i.status==='issued')paymentInstruction(i,card);
    const actions=node('div','','actions');
    if(mode==='client'){
      if(i.status==='reported_paid'){
        actions.append(action('Confirm my payment',async()=>{await callApi('/v1/invoices/'+i.id+'/client-response',{method:'POST',body:{response:'confirm'}});await loadInvoices(engagementId,'client')}),
        action('Dispute payment report',async()=>{await callApi('/v1/invoices/'+i.id+'/client-response',{method:'POST',body:{response:'dispute'}});await loadInvoices(engagementId,'client')}));
      }
    }else if(i.status==='issued'){
      actions.append(action('Report funds received',async()=>{
        if(!confirm('Confirm that the payment is visible in YOUR LAW FIRM account (not on LexFlow)?'))return;
        await callApi('/v1/invoices/'+i.id+'/report-paid',{method:'POST',body:{received_on:new Date().toISOString().slice(0,10),funds_received_confirmed:true}});
        await loadInvoices(engagementId,'lawyer');
      }),
      action('Void unpaid invoice',async()=>{
        if(!confirm('Void this unpaid invoice?'))return;
        await callApi('/v1/invoices/'+i.id+'/void',{method:'POST'});
        await loadInvoices(engagementId,'lawyer');
      }));
    }
    if(i.receipt_number && i.status!=='void')actions.append(action('View reported receipt',()=>loadReceipt(i.id,mode)));
    card.append(actions);target.append(card);
  }
}
function wireClient(){
  populate($('#findState'),states);populate($('#findPractice'),practiceAreas);populate($('#enquiryCategory'),practiceAreas);
  $('#findLawyers').addEventListener('click',()=>findLawyers().catch(e=>apiError(e.message,'#lawyerResults')));
  $('#clientRefresh').addEventListener('click',()=>loadClientRequests().catch(e=>apiError(e.message,'#clientRequests')));
  $('#clientEnquiryForm').addEventListener('submit',async event=>{
    event.preventDefault();
    try{
      const payload=validateServiceRequest({
        application_id:selectedLawyerId,service_category:$('#enquiryCategory').value,
        client_name:$('#enquiryName').value,client_contact:$('#enquiryContact').value,
        direct_payment_acknowledged:$('#directFeeAck').checked});
      const result=await callApi('/v1/engagements',{method:'POST',body:payload});
      notify('Request '+result.id+' submitted. The lawyer must independently accept the engagement.','#enquiryResult');
      $('#clientEnquiryForm').reset();
      await loadClientRequests();
    }catch(e){apiError(e.message,'#enquiryResult');}
  });
  $('#downloadReceipt').addEventListener('click',()=>{if(lastReceiptText)download('lexflow-lawyer-reported-receipt.txt',lastReceiptText)});
}
function renderLawyerRequests(records){
  engagements=Array.isArray(records)?records.filter(e=>e.my_role==='lawyer'):[];
  const panel=$('#lawyerRequests');panel.replaceChildren();
  if(!engagements.length){panel.append(node('p','There are no assigned client requests.','empty-state'));return;}
  for(const e of engagements){
    const info=node('div','','record-main');
    info.append(node('strong',e.client_name||'Client'),node('p',[e.service_category,e.id].filter(Boolean).join(' · ')),
      node('div','Status: '+e.status,'record-status'));
    panel.append(row(info,action('Open request',()=>selectLawyerEngagement(e))));
  }
}
async function loadLawyerRequests(){
  const result=await callApi('/v1/engagements');renderLawyerRequests(result.engagements);
}
async function selectLawyerEngagement(e){
  selectedEngagementId=e.id;
  $('#selectedEngagementSection').hidden=false;
  $('#lawyerReceiptPreview').hidden=true;
  text('#selectedEngagementTitle','Engagement '+e.id);
  text('#selectedEngagementInfo',[e.client_name,e.client_contact,e.service_category,e.status].filter(Boolean).join(' · '));
  const pending=e.status==='requested',active=e.status==='accepted';
  $('#acceptEngagement').disabled=!pending;
  $('#declineEngagement').disabled=!pending;
  $('#completeEngagement').disabled=!active;
  $('#invoiceFields').disabled=!active;
  text('#invoiceEngagement',e.id);
  await loadInvoices(e.id,'lawyer');
}
async function lawyerRespond(decision){
  if(!selectedEngagementId)return;
  if(decision==='accept'&&!$('#conflictCheck').checked)throw Error('Complete your independent conflict check before accepting');
  const result=await callApi('/v1/engagements/'+selectedEngagementId+'/respond',{
    method:'POST',body:{decision,...(decision==='accept'?{conflict_check_confirmed:true}:{})}});
  notify('Engagement updated: '+result.status,'#engagementActionResult');
  await loadLawyerRequests();
  const e=engagements.find(x=>x.id===selectedEngagementId);if(e)await selectLawyerEngagement(e);
}
async function loadPaymentDetails(){
  const r=await callApi('/v1/payment-details/me');
  notify(r.payment_details?'Payment instructions status: '+r.payment_details.status+'; changes require independent review.':
    'No payment instructions. Submit details only after professional verification.','#paymentDetailsStatus');
}
function wireLawyer(){
  populate($('#invoiceFeeType'),feeTypes);
  const payChange=()=>{const isBank=$('#payMethod').value==='bank_transfer';$('#bankFields').hidden=!isBank;$('#paystackFields').hidden=isBank;};
  $('#payMethod').addEventListener('change',payChange);payChange();
  $('#paymentDetailsForm').addEventListener('submit',async event=>{
    event.preventDefault();
    try{
      const method=$('#payMethod').value;
      const data=validateLawyerPaymentDetails({method,account_name:$('#payAccountName').value,
        ...(method==='bank_transfer'?{bank_name:$('#payBankName').value,account_number:$('#payAccountNumber').value}:
          {payment_url:$('#payUrl').value})});
      const result=await callApi('/v1/payment-details',{method:'PUT',body:data});
      notify('Payment instructions submitted for review: '+result.status+'; no fees have moved.','#paymentDetailsStatus');
    }catch(e){apiError(e.message,'#paymentDetailsStatus')}
  });
  $('#lawyerRefresh').addEventListener('click',()=>loadLawyerRequests().catch(e=>apiError(e.message,'#lawyerRequests')));
  $('#acceptEngagement').addEventListener('click',()=>lawyerRespond('accept').catch(e=>apiError(e.message,'#engagementActionResult')));
  $('#declineEngagement').addEventListener('click',()=>lawyerRespond('decline').catch(e=>apiError(e.message,'#engagementActionResult')));
  $('#completeEngagement').addEventListener('click',async()=>{
    try{
      if(!selectedEngagementId)throw Error('Choose an engagement');
      await callApi('/v1/engagements/'+selectedEngagementId+'/complete',{method:'POST'});
      await loadLawyerRequests();
      const e=engagements.find(x=>x.id===selectedEngagementId);if(e)await selectLawyerEngagement(e);
    }catch(e){apiError(e.message,'#engagementActionResult')}
  });
  $('#invoiceForm').addEventListener('submit',async event=>{
    event.preventDefault();
    try{
      if(!selectedEngagementId)throw Error('Select an accepted engagement');
      const payload=validateLawyerInvoice({lawyer_reference:$('#invoiceReference').value,
        fee_type:$('#invoiceFeeType').value,amount_naira:$('#invoiceAmount').value,due_date:$('#invoiceDueDate').value});
      const inv=await callApi('/v1/engagements/'+selectedEngagementId+'/invoices',{method:'POST',body:payload});
      notify('Lawyer invoice '+inv.lawyer_reference+' issued. Client pays you directly.','#invoiceResult');
      await loadInvoices(selectedEngagementId,'lawyer');
    }catch(e){apiError(e.message,'#invoiceResult')}
  });
  $('#lawyerDownloadReceipt').addEventListener('click',()=>{if(lastReceiptText)download('lexflow-lawyer-reported-receipt.txt',lastReceiptText)});
}
async function start(){
  if(page==='client')wireClient();else wireLawyer();
  $('#engagementSignIn').addEventListener('click',()=>signIn().catch(e=>apiError(e.message)));
  $('#engagementSignOut').addEventListener('click',()=>msal.logoutPopup({account:account()}).then(setAuthUI).catch(e=>apiError(e.message)));
  try{
    settings=validatePortalConfig(cfg,location.origin);
    if(!settings.enabled){locked();return;}
    msal=await PublicClientApplication.createPublicClientApplication({
      auth:{clientId:settings.clientId,authority:settings.authority,
        redirectUri:settings.redirectUri,navigateToLoginRequestUrl:false},
      cache:{cacheLocation:'sessionStorage'}
    });
    await msal.handleRedirectPromise();
    if(account())msal.setActiveAccount(account());
    const meta=await callApi('/v1/meta',{publicAccess:true});
    if(!meta.live_services?.engagements){locked();return;}
    notify('Staging workflow available for authorised synthetic testing. No legal fees are processed by LexFlow.');
    $('#engagementSignIn').disabled=false;
    setAuthUI();
    if(account())await refresh();
  }catch(e){apiError('Staging not ready: '+e.message);}
}
start();
