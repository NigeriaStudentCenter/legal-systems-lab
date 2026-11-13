import { InputError } from './domain.mjs';

function required(env, name) {
  const value = (env[name] ?? '').trim();
  if (!value) throw new InputError('Missing configuration: ' + name, 500);
  return value;
}
function httpsUrl(value, name, production) {
  let url;
  try { url = new URL(value); } catch { throw new InputError('Invalid URL in ' + name, 500); }
  if ((production && url.protocol !== 'https:') || !['https:', 'http:'].includes(url.protocol)) {
    throw new InputError(name + ' must be HTTPS in production', 500);
  }
  if (url.username || url.password) throw new InputError('Credentials in URL are forbidden: ' + name, 500);
  return url.href;
}
function bool(env, key) {
  const v = (env[key] ?? 'false').toLowerCase();
  if (!['true', 'false'].includes(v)) throw new InputError('Expected true or false: ' + key, 500);
  return v === 'true';
}
export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const databaseUrl = required(env, 'DATABASE_URL');
  const issuer = httpsUrl(required(env, 'OIDC_ISSUER'), 'OIDC_ISSUER', production);
  const jwksUri = httpsUrl(required(env, 'OIDC_JWKS_URI'), 'OIDC_JWKS_URI', production);
  const origins = required(env, 'ALLOWED_ORIGINS').split(',').map(x => x.trim()).filter(Boolean);
  if (origins.length === 0 || origins.includes('*')) throw new InputError('Explicit CORS origins are required', 500);
  origins.forEach(origin => {
    const parsed = new URL(httpsUrl(origin, 'ALLOWED_ORIGINS', production));
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) throw new InputError('CORS origins cannot have paths', 500);
  });
  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new InputError('Invalid PORT', 500);
  const databaseSsl = bool(env, 'DATABASE_SSL');
  if (production && !databaseSsl) throw new InputError('Production database requires TLS', 500);
  const config = {
    production, port, host: env.HOST || '127.0.0.1', databaseUrl, databaseSsl,
    issuer, audience: required(env, 'OIDC_AUDIENCE'), jwksUri,
    allowedOrigins: origins.map(s => new URL(s).origin),
    gates: {
      applications: bool(env, 'ENABLE_APPLICATIONS'),
      verification: bool(env, 'ENABLE_VERIFICATION'),
      publication: bool(env, 'ENABLE_PUBLICATION'),
      directory: bool(env, 'ENABLE_DIRECTORY')
    }
  };
  // No path in the GitHub Pages origin: the browser's Origin header carries only scheme + host.
  return Object.freeze(config);
}
