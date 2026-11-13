export const states = Object.freeze([
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Federal Capital Territory',
  'Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara',
  'Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers',
  'Sokoto','Taraba','Yobe','Zamfara'
]);
export const practiceAreas = Object.freeze([
  'Criminal defence & rights','Property & tenancy','Family & succession',
  'Business & CAC','Employment','Dispute resolution','Technology & IP'
]);
export const languages = Object.freeze(['English','Hausa','Yoruba','Igbo','Pidgin','Other']);
export function validatePortalConfig(config, browserOrigin) {
  if (!config || config.enabled !== true) return {enabled:false};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.clientId || ''))
    throw Error('The client ID is not configured');
  const authority = new URL(config.authority);
  const api = new URL(config.apiBaseUrl);
  const redirect = new URL(config.redirectUri);
  if (authority.protocol !== 'https:' || api.protocol !== 'https:' || redirect.protocol !== 'https:')
    throw Error('HTTPS is required for identity and API');
  if (redirect.origin !== browserOrigin) throw Error('Login redirect must match this website origin');
  if (redirect.search || redirect.hash) throw Error('Login redirect must not contain query or fragment');
  if (!authority.hostname.endsWith('.ciamlogin.com') && !authority.hostname.endsWith('.b2clogin.com'))
    throw Error('Use the approved Microsoft Entra External ID authority');
  if (typeof config.apiScope !== 'string' || !config.apiScope.startsWith('api://'))
    throw Error('An Entra API scope is required');
  if (api.pathname !== '/' || api.search || api.hash || api.username || api.password) throw Error('API base must be a pure origin');
  if (!['portal','staging'].some(()=>true)) throw Error('Unreachable'); // no secrets are consumed by this validator
  return {enabled:true,authority:authority.href,apiBaseUrl:api.origin,clientId:config.clientId,apiScope:config.apiScope,redirectUri:redirect.href};
}
export function validateApplication(form) {
  if (!form || typeof form !== 'object') throw Error('Invalid application');
  if (!form.privacy_acknowledged || !form.verification_authorised)
    throw Error('Please read the privacy notice and authorise a professional credential check');
  if (!states.includes(form.state)) throw Error('Select a Nigerian state or the FCT');
  if (typeof form.full_name !== 'string' || form.full_name.trim().length < 3 || form.full_name.length > 110)
    throw Error('Enter the professional full name');
  if (typeof form.city !== 'string' || form.city.trim().length < 2 || form.city.length > 75)
    throw Error('Enter a city');
  if (!Number.isInteger(form.year_of_call) || form.year_of_call < 1960 || form.year_of_call > new Date().getFullYear())
    throw Error('Enter a valid year of call');
  if (!Array.isArray(form.practice_areas) || form.practice_areas.length < 1 || form.practice_areas.length > 5 ||
      !form.practice_areas.every(x => practiceAreas.includes(x))) throw Error('Select one to five practice areas');
  if (!Array.isArray(form.languages) || form.languages.length < 1 || form.languages.length > 5 ||
      !form.languages.every(x => languages.includes(x))) throw Error('Select one to five languages');
  if (typeof form.summary !== 'string' || form.summary.trim().length < 25 || form.summary.length > 350)
    throw Error('Write a factual professional summary (25–350 characters)');
  return form;
}
