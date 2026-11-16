# Vendored browser libraries

Served from this site so that sign-in never depends on a third-party CDN, and so the pages'
Content-Security-Policy can allow scripts from this site only.

| File | Source | How it was built | SHA-256 |
|---|---|---|---|
| `msal-browser-4.25.1.mjs` | npm `@azure/msal-browser@4.25.1` (integrity `sha512-kAdOSNjvMbeBmEyd5WnddGmIpKCbAAGj4Gg/1iURtF+nHmIfS0+QUBBO3uaHl7CBB2R1SEAbpOgxycEwrHOkFA==`) | `esbuild@0.25.10` bundling `export {PublicClientApplication,InteractionRequiredAuthError} from "@azure/msal-browser"` with `--bundle --format=esm --minify --target=es2020 --legal-comments=eof` | `d4bad5053aff4ceb208c1a7729f293f8d032fea8204e2a8e0bab63107c94676c` |

To upgrade: rebuild the same way from the new version, update the file name in `../auth.js` and
`../staff.js`, update this table, and test sign-in on both pages.
