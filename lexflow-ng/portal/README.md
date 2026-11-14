# LexFlow NG portal — staging, NOT live registration

The portal has separate pages for professional application, applicant status and restricted staff review:

- `register.html`, `status.html`, `review.html`.
- `src/main.mjs` uses MSAL Browser sign-in with an organisation-managed Microsoft Entra External ID tenant.
- `config.js` is publicly readable and defaults to **enabled: false**; it must never contain client secrets.
- The backend checks OIDC tokens and permissions independently.

## Build
Run `npm install && npm run check && npm test && npm run build` from `lexflow-ng/portal`. The bundle is produced at `dist/portal.js` and requires approval before publishing.

A public GitHub Pages site is **not** a private identity or legal-record storage location. Configure an approved domain, production identity provider, API URL and cross-origin policies before enabling anything. A lawyer who completes BSOE training must still independently qualify to practise Nigerian law.

## Security and UX limitations
No production authentication provider, privacy notice, authorised professional verification source, Azure deployment, operational review team or client database exists yet. The portal is a closed staging proof of concept. Use fictional test records. The reviewer UI relies on backend roles: a UI tab does not confer permission.

MSAL popup sign-in requires testing on supported browsers and mobile devices and may need an approved redirect URI for each HTML page. More robust production flows should use a dedicated same-origin client portal and thorough authentication testing.
