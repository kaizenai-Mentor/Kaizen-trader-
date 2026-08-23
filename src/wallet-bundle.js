/**
 * Browser bundle source for the KAIZEN wallet connection UI.
 *
 * Built with:  npm run build:wallet-bundle
 * Output:      public/vendor/stacks-connect.js  (exposes window.StacksConnect)
 *
 * Use the current SIP-030 request API rather than the deprecated popup API.
 * The request API discovers Xverse's injected provider (including its mobile
 * in-app browser) and applies the wallet-specific compatibility overrides.
 */
export { connect, request } from '@stacks/connect';
