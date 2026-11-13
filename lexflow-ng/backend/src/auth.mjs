import { createRemoteJWKSet, jwtVerify } from 'jose';
import { InputError } from './domain.mjs';

// The browser never sends private credentials. Authorisation is supplied by
// an external OIDC identity provider. Reviewer privileges are stored in DB,
// NOT taken from a self-reported JWT role or application payload.
export function makeAuthenticator({issuer, audience, jwksUri}) {
  const remote = createRemoteJWKSet(new URL(jwksUri));
  return async function authenticate(request) {
    const header = request.headers.authorization;
    if (!header || !/^Bearer [^ ]+$/i.test(header)) throw new InputError('Authentication required',401);
    try {
      const {payload} = await jwtVerify(header.slice(7), remote, {
        issuer, audience, algorithms:['RS256','ES256'],
        clockTolerance: 5
      });
      if (typeof payload.sub !== 'string' || payload.sub.length < 3 || payload.sub.length > 250)
        throw Error('Missing subject');
      return {subject:payload.sub};
    } catch {
      // Never expose whether a token was expired, forged, for another app, etc.
      throw new InputError('Invalid authentication token',401);
    }
  };
}
