/**
 * Browser bundle source for the KAIZEN wallet connection UI.
 *
 * Built with:  npm run build:wallet-bundle
 * Output:      public/vendor/stacks-connect.js  (exposes window.StacksConnect)
 *
 * Only the functions the UI actually uses are exported, which keeps the
 * committed bundle as small as possible.
 */
export { openSignatureRequestPopup } from '@stacks/connect';
