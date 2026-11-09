/**
 * KAIZEN Direct PDF Certificate & Trader Dossier Generator.
 *
 * Generates a standalone, valid PDF 1.4 document (application/pdf) in memory
 * with zero external dependencies and zero browser print-dialog blocking.
 * Styled like an elite institutional / prop-firm certificate with:
 *   - Crispy Black & Burnt Blue certificate frame + Double Electric Gold border
 *   - Unmistakable Diagonal & Centered KAIZEN Logo Watermark + Vector Seal Crest
 *     (decision cards use transparent glass frames so the watermark is never covered!)
 *   - Official KAIZEN Crest, Verification ID, Branded Gold Score Percentages
 *   - Auto-Memory Executive Summary & Balanced Defining Trading Decisions
 *   - Founder Signature ("Dennis · Kaizen Mentor") & Vermillion Authentication Seal
 */

function pdfEscape(str) {
  return String(str || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text, maxChars = 88) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function generateDossierPdfBuffer(dossier = {}, options = {}) {
  const redactPairs = Boolean(options.redactPairs);
  const redactDates = Boolean(options.redactDates);
  const redactPnl = Boolean(options.redactPnl);
  const hideQuotes = Boolean(options.hideQuotes);

  const username = dossier.username || 'Trader';
  const verificationId = dossier.verificationId || 'KZN-2026-VERIFIED';
  const memberSince = dossier.memberSince || '2026';
  const kaizenScore = dossier.kaizenScore != null ? dossier.kaizenScore : 0;
  const complianceRate = dossier.complianceRate != null ? dossier.complianceRate : 0;
  const totalSessions = dossier.totalSessions != null ? dossier.totalSessions : 0;
  const brokerVerifiedCount = dossier.brokerVerifiedCount != null ? dossier.brokerVerifiedCount : 0;
  const topInstruments = redactPairs
    ? '[REDACTED BY TRADER]'
    : ((dossier.topInstruments && dossier.topInstruments.length) ? dossier.topInstruments.join(' / ') : 'Multi-Asset');
  const topStrategies = (dossier.topStrategies && dossier.topStrategies.length)
    ? dossier.topStrategies.join(' / ')
    : 'Structured System';

  const ops = [];

  // Page size: A4 Portrait (595 x 842 pt)
  // 1. Deep Crispy Black background (#0A0A0A -> 0.04 0.04 0.05)
  ops.push('0.04 0.04 0.05 rg');
  ops.push('0 0 595 842 re f');

  // 2. Outer & Inner Electric Gold Certificate Frame (#F5C518 -> 0.96 0.77 0.09)
  ops.push('2.0 w 0.96 0.77 0.09 RG');
  ops.push('22 22 551 798 re S');
  ops.push('0.7 w 0.96 0.77 0.09 RG');
  ops.push('28 28 539 786 re S');

  // Corner certificate ornaments
  ops.push('1.6 w 0.96 0.77 0.09 RG');
  ops.push('22 790 m 52 790 l 52 820 l S');
  ops.push('573 790 m 543 790 l 543 820 l S');
  ops.push('22 52 m 52 52 l 52 22 l S');
  ops.push('573 52 m 543 52 l 543 22 l S');

  // 3. UPRIGHT CENTERED KAIZEN KANJI SEAL WATERMARK (Brand Consistent with Site)
  // Upright (zero slant), clean square seal frame with the "改" Kanji emblem in the center,
  // and a single understated upright line directly beneath it: "KAIZEN AUTHENTICATED TRADER".
  ops.push('q');
  // Outer & inner upright square seal frame centered at (297.5, 425)
  ops.push('1.6 w 0.24 0.20 0.08 RG');
  ops.push('217.5 345 160 160 re S');
  ops.push('0.7 w 0.20 0.17 0.07 RG');
  ops.push('224.5 352 146 146 re S');

  // Vector stylized upright "改" (Kaizen) Kanji strokes inside the center seal
  ops.push('3.0 w 0.24 0.20 0.08 RG');
  // Left radical (己)
  ops.push('244 458 m 282 458 l 282 430 l 246 430 l 246 392 l 286 392 l S');
  // Right radical (攵)
  ops.push('306 468 m 296 430 l 348 430 l S');
  ops.push('335 430 m 302 384 l S');
  ops.push('302 422 m 348 384 l S');

  // Single upright subtitle directly below the Kanji seal frame
  ops.push('0.24 0.20 0.08 rg');
  ops.push('BT /F2 11.5 Tf 202 324 Td (KAIZEN AUTHENTICATED TRADER) Tj ET');
  ops.push('Q');

  // 4. Top Certificate Header Banner
  ops.push('0.10 0.18 0.29 rg');
  ops.push('42 742 511 56 re f');
  ops.push('0.9 w 0.96 0.77 0.09 RG');
  ops.push('42 742 511 56 re S');

  // Gold Brand Crest Box on Left with Vector "改"
  ops.push('0.96 0.77 0.09 rg');
  ops.push('54 752 36 36 re f');
  ops.push('1.5 w 0.04 0.04 0.05 RG');
  ops.push('60 778 m 70 778 l 70 770 l 60 770 l 60 760 l 71 760 l S');
  ops.push('75 780 m 73 770 l 84 770 l S');
  ops.push('81 770 m 74 758 l S');
  ops.push('74 768 m 84 758 l S');

  // Header Titles
  ops.push('0.96 0.97 0.98 rg');
  ops.push('BT /F2 13.5 Tf 100 774 Td (KAIZEN OFFICIAL TRADER CERTIFICATE & DOSSIER) Tj ET');
  ops.push('0.96 0.77 0.09 rg');
  ops.push('BT /F1 8.5 Tf 100 758 Td (BEHAVIORAL DISCIPLINE & BROKER-VERIFIED EXECUTION RECORD) Tj ET');

  // Verification ID Pill on Right
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 9 Tf 425 766 Td (${pdfEscape(verificationId)}) Tj ET`);

  // 5. Core Metrics Row (4 Boxes - Framed with Gold/Slate borders)
  const boxY = 668;
  const boxH = 58;
  const boxW = 121;
  const gaps = [42, 172, 302, 432];

  for (const bx of gaps) {
    ops.push('0.07 0.11 0.17 rg');
    ops.push(`${bx} ${boxY} ${boxW} ${boxH} re f`);
    ops.push('0.6 w 0.96 0.77 0.09 RG');
    ops.push(`${bx} ${boxY} ${boxW} ${boxH} re S`);
  }

  // Box 1: Trader Handle
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 50 ${boxY + 43} Td (TRADER HANDLE) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 12 Tf 50 ${boxY + 25} Td (${pdfEscape(username.slice(0, 16))}) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F1 7.5 Tf 50 ${boxY + 10} Td (Since ${pdfEscape(memberSince)}) Tj ET`);

  // Box 2: KAIZEN Score (Branded Gold Percentage)
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 180 ${boxY + 43} Td (KAIZEN SCORE) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 16 Tf 180 ${boxY + 23} Td (${pdfEscape(String(kaizenScore))}%) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F1 7.5 Tf 180 ${boxY + 10} Td (Compliance: ${pdfEscape(String(complianceRate))}%) Tj ET`);

  // Box 3: Logged & Verified Sessions
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 310 ${boxY + 43} Td (LOGGED SESSIONS) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 16 Tf 310 ${boxY + 23} Td (${pdfEscape(String(totalSessions))}) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F1 7.5 Tf 310 ${boxY + 10} Td (Broker-Verified: ${pdfEscape(String(brokerVerifiedCount))}) Tj ET`);

  // Box 4: Primary Focus
  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7.5 Tf 440 ${boxY + 43} Td (PRIMARY FOCUS) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 9 Tf 440 ${boxY + 26} Td (${pdfEscape(topInstruments.slice(0, 20))}) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F1 7.5 Tf 440 ${boxY + 10} Td (${pdfEscape(topStrategies.slice(0, 22))}) Tj ET`);

  let curY = 644;

  // 6. SECTION I: BEHAVIORAL FEEDBACK & KAIZEN MEMORY RECORD
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 9.5 Tf 42 ${curY} Td (SECTION I  |  BEHAVIORAL FEEDBACK & KAIZEN MEMORY SYNTHESIS) Tj ET`);
  curY -= 6;
  ops.push('0.5 w 0.96 0.77 0.09 RG');
  ops.push(`42 ${curY} m 553 ${curY} l S`);
  curY -= 14;

  const summaryText = redactPairs
    ? String(dossier.howITrade || '').replace(/\b(AUDJPY|EURUSD|GBPUSD|USDJPY|XAUUSD|Japan 225|NAS100|US30|US500|GER40)\b/gi, '[REDACTED]')
    : String(dossier.howITrade || '');
  const summaryLines = wrapText(summaryText, 94).slice(0, 3);
  ops.push('0.96 0.97 0.98 rg');
  for (const line of summaryLines) {
    ops.push(`BT /F1 9 Tf 42 ${curY} Td (${pdfEscape(line)}) Tj ET`);
    curY -= 12;
  }

  curY -= 3;
  const behLines = wrapText(dossier.behavioralSummary || '', 94).slice(0, 2);
  ops.push('0.78 0.83 0.88 rg');
  for (const line of behLines) {
    ops.push(`BT /F1 8.5 Tf 42 ${curY} Td (${pdfEscape(line)}) Tj ET`);
    curY -= 11.5;
  }

  curY -= 10;

  // 7. DEFINING TRADING & STUDY DECISIONS (BALANCED GOOD & LESSON SESSIONS)
  // Uses transparent stroked borders (NO opaque rectangle fills) so the centered KAIZEN
  // watermark remains 100% visible behind the decision cards!
  if (!hideQuotes && Array.isArray(dossier.memorableDecisions) && dossier.memorableDecisions.length > 0) {
    ops.push('0.96 0.77 0.09 rg');
    ops.push(`BT /F2 9 Tf 42 ${curY} Td (DEFINING TRADING & STUDY DECISIONS  |  BALANCED RECORD) Tj ET`);
    curY -= 5;
    ops.push('0.5 w 0.96 0.77 0.09 RG');
    ops.push(`42 ${curY} m 553 ${curY} l S`);
    curY -= 12;

    for (const dec of dossier.memorableDecisions.slice(0, 3)) {
      if (curY < 260) break;
      const instLabel = redactPairs ? '[REDACTED PAIR]' : (dec.instrument || 'Session');
      const dateLabel = redactDates ? '[REDACTED DATE]' : (dec.date || 'Recorded');
      const badge = dec.qualityLabel || dec.mode || 'SESSION';
      const headerLine = `${instLabel} - ${dec.strategy || 'System'}  [${badge} | ${dec.mode || 'RECORDED'} | ${dateLabel}]`;

      // Transparent glass card border (allows the KAIZEN watermark underneath to shine through!)
      ops.push('0.5 w 0.24 0.34 0.46 RG');
      ops.push(`42 ${curY - 44} 511 53 re S`);
      // Left accent bar: Emerald/Gold for good sessions, Amber for lesson sessions
      if (dec.isGood) {
        ops.push('0.13 0.72 0.38 rg');
      } else {
        ops.push('0.92 0.45 0.15 rg');
      }
      ops.push(`42 ${curY - 44} 3.5 53 re f`);

      ops.push('0.96 0.77 0.09 rg');
      ops.push(`BT /F2 8.2 Tf 52 ${curY - 4} Td (${pdfEscape(headerLine.slice(0, 95))}) Tj ET`);

      const qLines = wrapText(`"${dec.narrative || ''}"`, 96).slice(0, 2);
      ops.push('0.96 0.97 0.98 rg');
      let qY = curY - 15.5;
      for (const ql of qLines) {
        ops.push(`BT /F1 8.2 Tf 52 ${qY} Td (${pdfEscape(ql)}) Tj ET`);
        qY -= 10.5;
      }

      const lLine = wrapText(`KAIZEN Takeaway: ${dec.lesson || ''}`, 96)[0] || '';
      ops.push('0.76 0.83 0.90 rg');
      ops.push(`BT /F1 7.8 Tf 52 ${curY - 38} Td (${pdfEscape(lLine)}) Tj ET`);

      curY -= 59;
    }
  }

  // 8. SECTION II: VERIFIED PERFORMANCE & P&L RECORD
  const pnl = dossier.pnlSummary || {
    decidedTrades: 0, wins: 0, losses: 0, breakevens: 0, winRate: 0,
    netR: 0, netRLabel: '0.0R', netReturnPct: 0, netReturnPctLabel: '0.0%',
    avgRRLabel: '1 : 2.0', bestTradeLabel: '0.0R', profitFactor: 0, profitFactorLabel: '0.00',
    riskCeiling: dossier.riskPerTrade || '1% per trade',
    narrative: 'Performance and P&L metrics populate automatically from decided live executions and synced read-only broker history.'
  };

  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 9.5 Tf 42 ${curY} Td (SECTION II  |  VERIFIED PERFORMANCE & P&L RECORD) Tj ET`);
  curY -= 6;
  ops.push('0.5 w 0.96 0.77 0.09 RG');
  ops.push(`42 ${curY} m 553 ${curY} l S`);
  curY -= 44;

  // 4-Metric P&L Row (Transparent stroked glass boxes so watermark stays clear)
  const pBoxH = 38;
  for (const bx of gaps) {
    ops.push('0.5 w 0.96 0.77 0.09 RG');
    ops.push(`${bx} ${curY} ${boxW} ${pBoxH} re S`);
  }

  const netLabelText = redactPnl ? '[REDACTED]' : `${pnl.netReturnPctLabel} (${pnl.netRLabel})`;
  const winRateText = redactPnl ? '[REDACTED]' : `${pnl.winRate}% (${pnl.wins}W/${pnl.losses}L)`;
  const avgRrText = redactPnl ? '[REDACTED]' : `${pnl.avgRRLabel} (Best ${pnl.bestTradeLabel})`;
  const pfText = redactPnl ? '[REDACTED]' : `PF ${pnl.profitFactorLabel} (${pnl.decidedTrades} Live)`;

  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7 Tf 50 ${curY + 26} Td (NET P&L RETURN) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 9.5 Tf 50 ${curY + 10} Td (${pdfEscape(netLabelText.slice(0, 20))}) Tj ET`);

  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7 Tf 180 ${curY + 26} Td (LIVE WIN RATE) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 9.5 Tf 180 ${curY + 10} Td (${pdfEscape(winRateText.slice(0, 20))}) Tj ET`);

  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7 Tf 310 ${curY + 26} Td (AVG R:R ACHIEVED) Tj ET`);
  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 9 Tf 310 ${curY + 10} Td (${pdfEscape(avgRrText.slice(0, 22))}) Tj ET`);

  ops.push('0.64 0.69 0.75 rg');
  ops.push(`BT /F1 7 Tf 440 ${curY + 26} Td (PROFIT FACTOR) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F2 9 Tf 440 ${curY + 10} Td (${pdfEscape(pfText.slice(0, 22))}) Tj ET`);

  curY -= 13;
  const pnlNarrativeText = redactPnl
    ? '[PERFORMANCE & P&L SUMMARY REDACTED BY TRADER]'
    : String(pnl.narrative || '');
  const pnlLines = wrapText(pnlNarrativeText, 94).slice(0, 2);
  ops.push('0.84 0.89 0.94 rg');
  for (const pl of pnlLines) {
    if (curY < 114) break;
    ops.push(`BT /F1 8.4 Tf 42 ${curY} Td (${pdfEscape(pl)}) Tj ET`);
    curY -= 11;
  }

  // 8. Bottom Official Authentication Block: Vermillion Seal + Founder Signature ("Dennis · Kaizen Mentor")
  const footY = 54;
  ops.push('0.6 w 0.96 0.77 0.09 RG');
  ops.push(`42 ${footY + 52} m 553 ${footY + 52} l S`);

  // Vermillion Seal Square on Left (#C0392B -> 0.75 0.22 0.17) with Vector "改"
  ops.push('0.75 0.22 0.17 rg');
  ops.push(`42 ${footY + 8} 36 36 re f`);
  ops.push('1.2 w 0.96 0.77 0.09 RG');
  ops.push(`42 ${footY + 8} 36 36 re S`);
  ops.push('1.4 w 0.96 0.97 0.98 RG');
  ops.push(`48 ${footY + 34} m 58 ${footY + 34} l 58 ${footY + 26} l 48 ${footY + 26} l 48 ${footY + 16} l 59 ${footY + 16} l S`);
  ops.push(`63 ${footY + 36} m 61 ${footY + 26} l 72 ${footY + 26} l S`);
  ops.push(`69 ${footY + 26} m 62 ${footY + 14} l S`);
  ops.push(`62 ${footY + 24} m 72 ${footY + 14} l S`);

  ops.push('0.96 0.97 0.98 rg');
  ops.push(`BT /F2 9.5 Tf 88 ${footY + 30} Td (AUTHENTICATED BY KAIZEN  |  OFFICIAL TRADER CREDENTIAL) Tj ET`);
  ops.push('0.72 0.78 0.84 rg');
  ops.push(`BT /F1 8 Tf 88 ${footY + 17} Td (Zero bank details, logins, or account balances collected. Tamper-evident record.) Tj ET`);
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F1 7.5 Tf 88 ${footY + 6} Td (Certificate ID: ${pdfEscape(verificationId)}  |  Issued: ${pdfEscape(new Date().toISOString().slice(0, 10))}) Tj ET`);

  // Founder Signature on Right
  ops.push('0.96 0.77 0.09 rg');
  ops.push(`BT /F3 15 Tf 395 ${footY + 26} Td (Dennis  -  Kaizen Mentor) Tj ET`);
  ops.push('0.4 w 0.96 0.77 0.09 RG');
  ops.push(`390 ${footY + 20} m 553 ${footY + 20} l S`);
  ops.push('0.72 0.78 0.84 rg');
  ops.push(`BT /F1 7.5 Tf 395 ${footY + 9} Td (FOUNDER SIGNATURE & AUTHENTICATION) Tj ET`);

  const contentStream = ops.join('\n');
  const streamBytes = Buffer.byteLength(contentStream, 'utf8');

  // Assemble valid PDF 1.4 objects
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-BoldItalic >>\nendobj\n',
    `7 0 obj\n<< /Length ${streamBytes} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

module.exports = { generateDossierPdfBuffer };
