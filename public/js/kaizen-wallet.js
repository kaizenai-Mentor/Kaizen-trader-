/**
 * KAIZEN — Stacks wallet connection (Phase 1)
 *
 * Flow:
 *   1. Ask KAIZEN server for a one-time nonce + exact message to sign.
 *   2. Open the user's Stacks wallet (Leather, Xverse, …) via Stacks Connect
 *      and ask it to sign that exact message with `stx_signMessage`. No keys
 *      ever leave the wallet; KAIZEN never sees a private key.
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
    consentState: $('kz-wallet-consent-state'),
    activity: $('kz-wallet-activity'),
    activityNone: $('kz-wallet-activity-none'),
    activityData: $('kz-wallet-activity-data'),
    syncBtn: $('kz-wallet-sync-btn'),
    syncMsg: $('kz-wallet-sync-msg'),
    mTxs: $('kz-m-txs'),
    mDays: $('kz-m-days'),
    mGap: $('kz-m-gap'),
    mMaxDay: $('kz-m-maxday'),
    mDefi: $('kz-m-defi'),
    mHeavy: $('kz-m-heavy'),
    mProtocols: $('kz-m-protocols'),
    mActions: $('kz-m-actions'),
    mRecent: $('kz-m-recent'),
    mLastSync: $('kz-m-lastsync'),
    credsCard: $('kz-credentials-card'),
    credsList: $('kz-creds-list'),
    credsNone: $('kz-creds-none'),
    credsRefreshBtn: $('kz-creds-refresh-btn'),
    credsMsg: $('kz-creds-msg')
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
      if (els.activity) els.activity.style.display = 'none';
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
    if (els.activity) {
      els.activity.style.display = 'block';
      if (window.feather) window.feather.replace();
      loadActivity();
      loadCredentials();
    }
  }

  function setCredsMsg(text, kind) {
    if (!els.credsMsg) return;
    els.credsMsg.textContent = text || '';
    els.credsMsg.style.color = kind === 'error' ? '#F87171' : kind === 'ok' ? '#4ADE80' : 'var(--ash)';
  }

  function loadCredentials() {
    fetch('/api/wallet/credentials', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.credentials) return;
        renderCredentials(data.credentials);
      })
      .catch(function () { /* ignore */ });
  }

  function renderCredentials(creds) {
    if (!els.credsCard) return;
    els.credsCard.style.display = 'block';
    
    if (!creds || creds.length === 0) {
      els.credsList.style.display = 'none';
      els.credsNone.style.display = 'block';
      return;
    }

    els.credsList.style.display = 'grid';
    els.credsNone.style.display = 'none';

    var html = creds.map(function (c) {
      var date = new Date(c.issuedAt).toLocaleDateString();
      return '<div style="background:var(--bg-surface);border:1px solid rgba(201,168,76,0.15);padding:16px;position:relative;overflow:hidden;">'
        + '<div style="position:absolute;top:-10px;right:-10px;opacity:0.05;transform:rotate(15deg);"><i data-feather="award" width="60" height="60"></i></div>'
        + '<div style="font-family:\'DM Mono\',monospace;font-size:0.5rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">' + c.credentialType.replace('_', ' ') + '</div>'
        + '<div style="font-weight:700;font-size:0.9rem;color:var(--text-primary);margin-bottom:6px;">' + c.name + '</div>'
        + '<div style="font-size:0.72rem;color:var(--text-secondary);line-height:1.5;margin-bottom:12px;">' + c.description + '</div>'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:auto;">'
        + '  <div>'
        + '    <div style="font-family:\'DM Mono\',monospace;font-size:0.5rem;color:var(--ash);text-transform:uppercase;">Evidence</div>'
        + '    <div style="font-family:\'DM Mono\',monospace;font-size:0.65rem;color:var(--gold);">' + c.evidence.metricValue + '</div>'
        + '  </div>'
        + '  <div style="font-family:\'DM Mono\',monospace;font-size:0.5rem;color:rgba(168,160,154,0.5);text-transform:uppercase;">Issued ' + date + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    
    els.credsList.innerHTML = html;
    if (window.feather) window.feather.replace();
  }

  async function refreshCredentials() {
    setCredsMsg('Evaluating rules…');
    if (els.credsRefreshBtn) {
      els.credsRefreshBtn.disabled = true;
      els.credsRefreshBtn.style.opacity = '0.6';
    }
    try {
      var res = await fetch('/api/wallet/credentials/refresh', { method: 'POST', headers: { Accept: 'application/json' } });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evaluation failed.');
      setCredsMsg('Evaluation complete. ' + (data.evaluatedCount || 0) + ' credentials verified.', 'ok');
      renderCredentials(data.credentials);
    } catch (err) {
      setCredsMsg(err && err.message ? err.message : 'Evaluation failed.', 'error');
    } finally {
      if (els.credsRefreshBtn) {
        els.credsRefreshBtn.disabled = false;
        els.credsRefreshBtn.style.opacity = '1';
      }
    }
  }

  function setSyncMsg(text, kind) {
    if (!els.syncMsg) return;
    els.syncMsg.textContent = text || '';
    els.syncMsg.style.color = kind === 'error' ? '#F87171' : kind === 'ok' ? '#4ADE80' : 'var(--ash)';
  }

  function formatMix(obj) {
    var entries = Object.entries(obj || {}).sort(function (a, b) { return b[1] - a[1]; });
    if (!entries.length) return '<span style="color:var(--ash);">—</span>';
    return entries.map(function (e) {
      return '<div>' + e[0] + ' <span style="color:var(--gold);font-family:\'DM Mono\',monospace;">×' + e[1] + '</span></div>';
    }).join('');
  }

  function loadActivity() {
    fetch('/api/wallet/activity', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.connected) return;
        var m = data.metrics || {};
        var hasData = (data.cursor && data.cursor.txCount > 0) || (m.totals && m.totals.transactions > 0);

        if (!hasData) {
          els.activityNone.style.display = 'block';
          els.activityData.style.display = 'none';
          return;
        }
        els.activityNone.style.display = 'none';
        els.activityData.style.display = 'block';

        els.mTxs.textContent = m.totals.transactions;
        els.mDays.textContent = m.totals.activeDays;
        els.mGap.textContent = m.cadence.medianGapHours === null ? '—' : m.cadence.medianGapHours;
        els.mMaxDay.textContent = m.cadence.maxTxInOneDay;
        els.mMaxDay.style.color = m.cadence.maxTxInOneDay >= 10 ? '#F87171' : 'var(--text-primary)';
        els.mDefi.textContent = m.engagement.defiEngagementPct + '%';
        els.mHeavy.style.display = m.cadence.heavyTradingFlag ? 'block' : 'none';
        els.mProtocols.innerHTML = formatMix(m.engagement.protocolMix);
        els.mActions.innerHTML = formatMix(m.engagement.actionMix);

        var recentHtml = (data.recent || []).map(function (tx) {
          var d = new Date(tx.occurredAt);
          var label = (tx.protocolName && tx.protocolName !== 'Other')
            ? tx.protocolName
            : (tx.txType === 'token_transfer' ? 'STX transfer' : tx.txType.replace('_', ' '));
          return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">'
            + '<span>' + label + ' · <span style="color:var(--gold);">' + tx.action + '</span>'
            + (tx.functionName ? ' <span style="color:var(--ash);">(' + tx.functionName + ')</span>' : '') + '</span>'
            + '<span style="color:var(--ash);font-family:\'DM Mono\',monospace;font-size:0.62rem;">'
            + d.toLocaleDateString() + ' · block ' + tx.blockHeight + '</span></div>';
        }).join('');
        els.mRecent.innerHTML = recentHtml || '<div style="color:var(--ash);">—</div>';

        if (data.cursor && data.cursor.lastSyncedAt) {
          els.mLastSync.textContent = 'Last synced ' + new Date(data.cursor.lastSyncedAt).toLocaleString()
            + ' · ' + data.cursor.txCount + ' confirmed transactions indexed';
        }
        if (window.feather) window.feather.replace();
      })
      .catch(function () { /* leave panel as-is */ });
  }

  async function syncNow() {
    setSyncMsg('');
    if (!els.syncBtn) return;
    els.syncBtn.disabled = true;
    els.syncBtn.style.opacity = '0.6';
    try {
      var res = await fetch('/api/wallet/sync', { method: 'POST', headers: { Accept: 'application/json' } });
      var data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Sync failed.');
      setSyncMsg('Sync complete — scanned ' + data.scanned + ' transactions, ' + data.ingested + ' new. Total indexed: ' + data.total + '.', 'ok');
      loadActivity();
    } catch (err) {
      setSyncMsg(err && err.message ? err.message : 'Sync failed. Please try again.', 'error');
    } finally {
      els.syncBtn.disabled = false;
      els.syncBtn.style.opacity = '1';
    }
  }

  function refreshStatus() {
    fetch('/api/wallet/status', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () { /* leave default view */ });
  }

  function providerFromId(id) {
    if (!id) return null;
    try {
      return id.split('.').reduce(function (provider, part) {
        return provider && provider[part];
      }, window);
    } catch (err) {
      return null;
    }
  }

  function hasInjectedWallet() {
    // Xverse injects this object in both its extension and mobile in-app
    // browser. Keep the legacy globals for Leather and older Stacks wallets.
    if (
      (window.XverseProviders && window.XverseProviders.BitcoinProvider) ||
      window.LeatherProvider ||
      window.StacksProvider ||
      window.BlockstackProvider
    ) {
      return true;
    }

    var registries = [
      window.wbip_providers,
      window.webbtc_stx_providers,
      window.webbtc_providers,
      window.btc_providers
    ];
    return registries.some(function (registry) {
      return Array.isArray(registry) && registry.some(function (entry) {
        return entry && providerFromId(entry.id);
      });
    });
  }

  function isMobileDevice() {
    return !!(
      (navigator.userAgentData && navigator.userAgentData.mobile) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  function openInXverseMobile() {
    var target = new URL(window.location.href);
    target.searchParams.set('wallet', 'xverse');

    setMsg('Opening KAIZEN in the Xverse wallet browser…');
    setBusy(true, 'Opening Xverse…');
    window.location.assign(
      'https://connect.xverse.app/browser?url=' + encodeURIComponent(target.toString())
    );
  }

  function getStacksAddress(addresses) {
    return (addresses || []).find(function (entry) {
      return entry && typeof entry.address === 'string' && entry.address.charAt(0) === 'S';
    });
  }

 async function signWithWallet(message, network) {
    if (
      !window.StacksConnect ||
      typeof window.StacksConnect.connect !== 'function' ||
      typeof window.StacksConnect.request !== 'function'
    ) {
      throw new Error('Wallet bridge failed to load. Refresh the page and try again.');
    }

    var connected = await window.StacksConnect.connect({
      network: network || 'mainnet'
    });
    var stxAccount = getStacksAddress(connected && connected.addresses);

    if (!stxAccount || !stxAccount.publicKey) {
      throw new Error('The selected wallet did not return a Stacks account.');
    }

    // Try with publicKey first, then without if it fails
    try {
      var result = await window.StacksConnect.request('stx_signMessage', {
        message: message,
        publicKey: stxAccount.publicKey
      });
      if (!result || !result.signature) throw new Error('No signature');
      if (!result.publicKey) result.publicKey = stxAccount.publicKey;
      return result;
    } catch (e) {
      // Retry without publicKey for Xverse mobile compatibility
      var result = await window.StacksConnect.request('stx_signMessage', {
        message: message
      });
      if (!result || !result.signature) throw new Error('No signature');
      result.publicKey = stxAccount.publicKey;
      return result;
    }
 }

  async function connect() {
    setMsg('');
    if (els.consent && !els.consent.checked) {
      setMsg('Please confirm the ownership statement before connecting.', 'error');
      return;
    }

    // Mobile Safari/Chrome cannot access Xverse's injected provider. Send the
    // user into Xverse's in-app browser through its universal/app link. The
    // marker prevents a redirect loop if provider injection is unavailable.
    var openedFromXverseLink = new URL(window.location.href).searchParams.get('wallet') === 'xverse';
    if (isMobileDevice() && !hasInjectedWallet() && !openedFromXverseLink) {
      openInXverseMobile();
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
          msg = isMobileDevice()
            ? 'No Stacks wallet detected. Open this page in the Xverse mobile app and try again.'
            : 'No Stacks wallet detected. Install Leather or Xverse, then try again.';
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
  if (els.syncBtn) els.syncBtn.addEventListener('click', syncNow);
  if (els.credsRefreshBtn) els.credsRefreshBtn.addEventListener('click', refreshCredentials);

  refreshStatus();
})();
