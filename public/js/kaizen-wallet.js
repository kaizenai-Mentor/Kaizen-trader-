/**
 * KAIZEN — Stacks wallet connection (Phase 1)
 *
 * Flow:
 *   1. Ask KAIZEN server for a one-time nonce + exact message to sign.
 *   2. Open the user's Stacks wallet (Leather, Xverse, …) via Stacks Connect
 *      and ask it to sign that exact message (SIP-018). No keys ever leave
 *      the wallet; KAIZEN never sees a private key.
 *   3. Send nonce + signature back. The server recovers the signer's address
 *      from the signature — proving ownership cryptographically — and links
 *      the wallet with the user's recorded consent.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    card: $('kz-wallet-card'),
    connectView: $('kz-wallet-connect-view'),
    connectedView: $('kz-wallet-connected-view'),
    connectBtn: $('kz-wallet-connect-btn'),
    disconnectBtn: $('kz-wallet-disconnect-btn'),
    consent: $('kz-wallet-consent'),
    msg: $('kz-wallet-msg'),
    addr: $('kz-wallet-addr'),
    network: $('kz-wallet-network'),
    verifiedAt: $('kz-wallet-verified-at'),
    consentState: $('kz-wallet-consent-state')
  };

  if (!els.card) return; // not on this page

  function setMsg(text, kind) {
    if (!els.msg) return;
    els.msg.textContent = text || '';
    els.msg.style.color = kind === 'error' ? '#F87171' : kind === 'ok' ? '#4ADE80' : 'var(--ash)';
  }

  function setBusy(busy, label) {
    if (!els.connectBtn) return;
    els.connectBtn.disabled = busy;
    els.connectBtn.style.opacity = busy ? '0.6' : '1';
    els.connectBtn.textContent = busy ? (label || 'Waiting for wallet…') : 'Connect Stacks Wallet';
  }

  function render(status) {
    if (!status || !status.connected) {
      els.connectView.style.display = 'block';
      els.connectedView.style.display = 'none';
      return;
    }
    var w = status.wallet || {};
    els.connectView.style.display = 'none';
    els.connectedView.style.display = 'block';
    if (els.addr) els.addr.textContent = w.addressMasked || '';
    if (els.network) els.network.textContent = (w.network || 'mainnet').toUpperCase();
    if (els.verifiedAt) {
      var d = w.verifiedAt ? new Date(w.verifiedAt) : null;
      els.verifiedAt.textContent = d && !isNaN(d) ? d.toLocaleDateString() : '—';
    }
    if (els.consentState) {
      els.consentState.textContent = w.consent && w.consent.activityAnalysis
        ? 'On-chain analysis: CONSENTED'
        : 'On-chain analysis: not consented';
    }
  }

  function refreshStatus() {
    fetch('/api/wallet/status', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () { /* leave default view */ });
  }

  function signWithWallet(message, network) {
    return new Promise(function (resolve, reject) {
      if (!window.StacksConnect || typeof window.StacksConnect.openSignatureRequestPopup !== 'function') {
        return reject(new Error('Wallet bridge failed to load. Refresh the page and try again.'));
      }
      try {
        window.StacksConnect.openSignatureRequestPopup({
          message: message,
          network: network || 'mainnet',
          appDetails: {
            name: 'KAIZEN',
            icon: window.location.origin + '/images/kaizen-icon.png'
          },
          onFinish: function (data) { resolve(data); },
          onCancel: function (err) {
            reject(new Error((err && err.message) || 'Signature request was cancelled.'));
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async function connect() {
    setMsg('');
    if (els.consent && !els.consent.checked) {
      setMsg('Please confirm the ownership statement before connecting.', 'error');
      return;
    }
    setBusy(true, 'Requesting challenge…');
    try {
      var nonceRes = await fetch('/api/wallet/nonce', { method: 'POST', headers: { Accept: 'application/json' } });
      var nonceData = await nonceRes.json();
      if (!nonceRes.ok || !nonceData.nonce) throw new Error(nonceData.error || 'Could not start verification.');

      setBusy(true, 'Confirm in your wallet…');
      var sig;
      try {
        sig = await signWithWallet(nonceData.message, nonceData.network);
      } catch (signErr) {
        var msg = String(signErr && signErr.message ? signErr.message : signErr);
        if (/no wallet|provider|not found|not installed|no provider/i.test(msg)) {
          msg = 'No Stacks wallet detected. Install the Leather or Xverse browser extension, then try again.';
        }
        throw new Error(msg);
      }

      setBusy(true, 'Verifying signature…');
      var verifyRes = await fetch('/api/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nonce: nonceData.nonce,
          publicKey: sig.publicKey,
          signature: sig.signature,
          consent: { activityAnalysis: !!(els.consent && els.consent.checked) }
        })
      });
      var verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.connected) throw new Error(verifyData.error || 'Verification failed.');

      setMsg('Wallet verified and linked. Ownership proven by signature.', 'ok');
      render(verifyData);
    } catch (err) {
      setMsg(err && err.message ? err.message : 'Something went wrong. Please try again.', 'error');
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect your Stacks wallet from KAIZEN? On-chain analysis will stop.')) return;
    try {
      var res = await fetch('/api/wallet/disconnect', { method: 'POST', headers: { Accept: 'application/json' } });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed.');
      setMsg('Wallet disconnected.', 'ok');
      render({ connected: false });
    } catch (err) {
      setMsg(err && err.message ? err.message : 'Disconnect failed.', 'error');
    }
  }

  if (els.connectBtn) els.connectBtn.addEventListener('click', connect);
  if (els.disconnectBtn) els.disconnectBtn.addEventListener('click', disconnect);

  refreshStatus();
})();
