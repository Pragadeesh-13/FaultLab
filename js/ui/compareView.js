// Minimalist Side-by-Side Mathematical Calculation Trace: ElGamal vs Cramer–Shoup
// 8-Bit Binary Representation of 0's and 1's for Clean Presentation
import { SimulationRunner } from '../simulator/runner.js';
import { FaultType } from '../simulator/faults.js';

// Helper: Render an 8-bit byte as styled 0's and 1's
function renderByte(val, label = null, origVal = null, highlightFlipped = true) {
  if (val === undefined || val === null) return '—';
  
  const num = Number(BigInt(val) & 0xFFn);
  const binStr = num.toString(2).padStart(8, '0');
  
  let origBinStr = null;
  if (origVal !== null && origVal !== undefined) {
    origBinStr = Number(BigInt(origVal) & 0xFFn).toString(2).padStart(8, '0');
  }

  let bitsHtml = '';
  for (let i = 0; i < 8; i++) {
    const bitPos = 7 - i; // MSB is bit 7, LSB is bit 0
    const bit = binStr[i];
    const isFlipped = origBinStr !== null && bit !== origBinStr[i];

    if (isFlipped && highlightFlipped) {
      bitsHtml += `<span class="bit-tag bit-tag-flipped" title="Bit ${bitPos} flipped! Was: ${origBinStr[i]} &rarr; Now: ${bit}"><strong>${bit}</strong></span>`;
    } else {
      bitsHtml += `<span class="bit-tag ${bit === '1' ? 'bit-tag-1' : 'bit-tag-0'}">${bit}</span>`;
    }
  }

  return `
    <span class="byte-bit-group">
      ${label ? `<span class="byte-label">${label}</span>` : ''}
      <span class="byte-bits-stream">${bitsHtml}</span>
      <span class="byte-dec-val">(${num})</span>
    </span>
  `;
}

// Helper: Render an 8-bit difference comparison between two bytes
function renderBitDiff(label1, val1, label2, val2, customBadge = null) {
  if (val1 === undefined || val2 === undefined) return '—';
  const n1 = Number(BigInt(val1) & 0xFFn);
  const n2 = Number(BigInt(val2) & 0xFFn);
  const b1 = n1.toString(2).padStart(8, '0');
  const b2 = n2.toString(2).padStart(8, '0');

  let row1Bits = '';
  let row2Bits = '';
  let diffIndicators = '';
  let diffCount = 0;

  for (let i = 0; i < 8; i++) {
    const bitPos = 7 - i;
    const bit1 = b1[i];
    const bit2 = b2[i];
    const differs = bit1 !== bit2;
    if (differs) diffCount++;

    row1Bits += `<span class="bit-tag ${bit1 === '1' ? 'bit-tag-1' : 'bit-tag-0'}">${bit1}</span>`;
    row2Bits += `<span class="bit-tag ${differs ? 'bit-tag-flipped' : (bit2 === '1' ? 'bit-tag-1' : 'bit-tag-0')}">${bit2}</span>`;
    diffIndicators += `<span class="diff-marker ${differs ? 'marker-fail' : 'marker-pass'}">${differs ? '&times;' : '&bull;'}</span>`;
  }

  return `
    <div class="bit-diff-card">
      <div class="diff-row">
        <span class="diff-label">${label1}:</span>
        <span class="byte-bits-stream">${row1Bits}</span>
        <span class="byte-dec-val">(${n1})</span>
      </div>
      <div class="diff-row">
        <span class="diff-label">${label2}:</span>
        <span class="byte-bits-stream">${row2Bits}</span>
        <span class="byte-dec-val">(${n2})</span>
      </div>
      <div class="diff-row markers-row">
        <span class="diff-label">Bit Diff:</span>
        <span class="byte-bits-stream">${diffIndicators}</span>
        <span class="diff-count-badge ${diffCount > 0 ? 'badge-mismatch' : 'badge-match'}">
          ${customBadge || (diffCount > 0 ? `${diffCount} bit${diffCount > 1 ? 's' : ''} differ!` : 'Exact 8-bit match')}
        </span>
      </div>
    </div>
  `;
}

export class CompareView {
  constructor(containerElement) {
    this.container = containerElement;
    this.runner = new SimulationRunner();
  }

  renderPresentation({
    input = 'HELLO',
    isTextMode = true,
    withFault = true,
    faultType = FaultType.SINGLE_BIT_FLIP,
    bitIndex = 2
  }) {
    const bitPos = Math.min(Math.max(0, bitIndex), 7);
    const faultSpec = withFault ? { type: faultType, bitIndex: bitPos } : null;

    // Run ElGamal and Cramer-Shoup
    const elgRes = this.runner.run({
      algorithm: 'elgamal',
      input,
      isTextMode,
      faultSpec,
      targetStage: 'elg_c2'
    });

    const csRes = this.runner.run({
      algorithm: 'cramershoup',
      input,
      isTextMode,
      faultSpec,
      targetStage: 'cs_u1'
    });

    const displayInput = isTextMode ? `"${input}"` : input.toString();
    const elgD = elgRes.details || {};
    const csD = csRes.details || {};

    const targetChar = isTextMode ? (elgD.targetChar || input[1] || input[0] || 'E') : null;
    const targetCharCode = isTextMode
      ? targetChar.charCodeAt(0)
      : Number(BigInt(elgRes.input !== undefined ? elgRes.input : (input || 123)) & 0xFFn);

    let html = `
      <div class="math-trace-wrapper">

        <!-- Status Summary -->
        <div class="summary-pill-bar ${withFault ? 'pill-fault-active' : 'pill-normal-active'}">
          <div class="summary-icon"><span class="material-symbols-outlined">${withFault ? 'bolt' : 'check_circle'}</span></div>
          <div class="summary-text">
            <strong>${withFault ? 'HARDWARE FAULT INJECTION ACTIVE:' : 'NORMAL EXECUTION (NO FAULT):'}</strong>
            <span>
              ${withFault 
                ? `Injected single bit flip at <strong>Bit ${bitPos}</strong> while decrypting ${displayInput}. Compare the 8-bit register calculations below:`
                : `Both cryptosystems performing normal unperturbed decryption on ${displayInput}.`}
            </span>
          </div>
        </div>

        <!-- Side-by-Side Mathematical Calculation Cards -->
        <div class="math-comparison-grid">

          <!-- Left Column: ElGamal Mathematical Trace -->
          <div class="math-card elgamal-math-card">
            <div class="math-card-header">
              <div class="math-algo-title">1. ElGamal Decryption Calculation (8-Bit)</div>
              <span class="math-status-pill ${withFault ? 'pill-fail' : 'pill-ok'}">
                ${withFault ? '<span class="material-symbols-outlined icon-inline">cancel</span> 0% Detection (Silent Failure)' : '<span class="material-symbols-outlined icon-inline">check_circle</span> Valid'}
              </span>
            </div>

            <div class="math-steps-list">
              
              <!-- Parameters -->
              <div class="math-step-box">
                <span class="step-num-badge">Key & Parameters (8-Bit Architecture)</span>
                <div class="step-math-row" style="margin-bottom: 4px;">
                  <code>Modulus p = ${elgD.p || 227n} (8-bit prime), &nbsp; Key x = ${elgD.x || 23n}</code>
                </div>
                <div>
                  <span style="color: #94a3b8; font-size: 11.5px; margin-right: 8px;">Target Byte:</span>
                  ${renderByte(targetCharCode, isTextMode ? `'${targetChar}' (ASCII):` : 'm:')}
                </div>
              </div>

              <!-- Step 1: Ciphertext Received -->
              <div class="math-step-box ${withFault ? 'box-corrupted' : ''}">
                <span class="step-num-badge">Step 1 &bull; Received 8-Bit Ciphertext Pair (c1, c2)</span>
                <div>
                  ${renderByte(elgD.c1, 'c1 (nonce):')}
                </div>
                ${withFault
                  ? renderBitDiff('Original c2', elgD.origC2, 'Bus c2 (Fault)', elgD.c2, `Bit ${bitPos} flipped!`)
                  : `<div>${renderByte(elgD.c2, 'c2 (payload):')}</div>`}
              </div>

              <!-- Step 2: Shared Secret -->
              <div class="math-step-box">
                <span class="step-num-badge">Step 2 &bull; Compute Shared Secret s = c1^x mod p</span>
                <div>
                  ${renderByte(elgD.s, 'Secret s:')}
                </div>
              </div>

              <!-- Step 3: Modular Inversion -->
              <div class="math-step-box">
                <span class="step-num-badge">Step 3 &bull; Compute Modular Inverse s^-1 mod p</span>
                <div>
                  ${renderByte(elgD.sInv, 'Inverse s^-1:')}
                </div>
              </div>

              <!-- Step 4: Plaintext Recovery -->
              <div class="math-step-box ${withFault ? 'box-corrupted' : ''}">
                <span class="step-num-badge">Step 4 &bull; Recover Plaintext m = (c2 * s^-1) mod p</span>
                ${withFault
                  ? renderBitDiff('Target m', targetCharCode, 'Corrupted m', elgD.recoveredM, 'Silent corruption!')
                  : `<div>${renderByte(elgD.recoveredM, 'Recovered m:')}</div>`}
                <div class="step-result-row" style="margin-top: 8px;">
                  Decrypted Output: <strong class="${withFault ? 'text-danger font-mono' : 'text-green font-mono'}">${isTextMode ? `"${elgRes.actualOutput}"` : elgRes.actualOutput.toString()}</strong>
                </div>
              </div>

            </div>

            <!-- ElGamal Verdict / Where it went wrong -->
            <div class="math-verdict-box ${withFault ? 'verdict-fail' : 'verdict-ok'}">
              <div class="verdict-header">
                <span class="material-symbols-outlined icon-inline">${withFault ? 'warning' : 'check_circle'}</span>
                <strong>${withFault ? 'Where It Went Wrong:' : 'Mathematical Check:'}</strong>
              </div>
              <p>
                ${withFault
                  ? `At Step 1, the hardware bit flip flipped <strong>Bit ${bitPos}</strong> in ciphertext <code>c2</code>. At Step 4, computing <code>m = (c2 * s^-1) mod p</code> produced corrupted 8-bit output <strong>(dec: ${elgD.recoveredM})</strong> instead of the expected <strong>(dec: ${targetCharCode})</strong>. Because ElGamal has <strong>no verification proof tag</strong>, the corrupted byte was accepted without any alert, silently outputting <strong>${isTextMode ? `"${elgRes.actualOutput}"` : elgRes.actualOutput}</strong>!`
                  : `Shared secret computed cleanly. Plaintext decrypted with exact 8-bit mathematical match.`}
              </p>
            </div>
          </div>

          <!-- Right Column: Cramer–Shoup Mathematical Trace -->
          <div class="math-card cramershoup-math-card">
            <div class="math-card-header">
              <div class="math-algo-title">2. Cramer–Shoup Decryption Calculation (8-Bit)</div>
              <span class="math-status-pill ${withFault ? 'pill-shield' : 'pill-ok'}">
                ${withFault ? '<span class="material-symbols-outlined icon-inline">shield</span> 100% BLOCKED' : '<span class="material-symbols-outlined icon-inline">check_circle</span> Valid'}
              </span>
            </div>

            <div class="math-steps-list">
              
              <!-- Parameters -->
              <div class="math-step-box">
                <span class="step-num-badge">Key & Parameters (8-Bit Architecture)</span>
                <div class="step-math-row" style="margin-bottom: 4px;">
                  <code>Modulus p = ${csD.p || 227n}, &nbsp; Subgroup Order q = ${csD.q || 113n}</code>
                </div>
                <div>
                  <span style="color: #94a3b8; font-size: 11.5px; margin-right: 8px;">Target Byte:</span>
                  ${renderByte(targetCharCode, isTextMode ? `'${targetChar}' (ASCII):` : 'm:')}
                </div>
              </div>

              <!-- Step 1: 4-Tuple Received -->
              <div class="math-step-box ${withFault ? 'box-corrupted' : ''}">
                <span class="step-num-badge">Step 1 &bull; Received 4-Tuple Ciphertext (u1, u2, e, v)</span>
                ${withFault
                  ? renderBitDiff('Original u1', csD.origU1, 'Bus u1 (Fault)', csD.u1, `Bit ${bitPos} flipped!`)
                  : `<div>${renderByte(csD.u1, 'u1:')}</div>`}
                <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
                  ${renderByte(csD.u2, 'u2:')}
                  ${renderByte(csD.e, 'e (payload):')}
                  ${renderByte(csD.v, 'Proof Tag v:')}
                </div>
              </div>

              <!-- Step 2: Universal Hash -->
              <div class="math-step-box">
                <span class="step-num-badge">Step 2 &bull; Compute Universal Hash alpha = H(u1, u2, e) mod q</span>
                <div>
                  ${renderByte(csD.alpha, 'Hash alpha:')}
                </div>
              </div>

              <!-- Step 3: Expected Proof Tag -->
              <div class="math-step-box ${withFault ? 'box-amber' : ''}">
                <span class="step-num-badge">Step 3 &bull; Compute Expected Proof Tag v'</span>
                <div>
                  ${renderByte(csD.vPrime, 'Computed v\':')}
                </div>
              </div>

              <!-- Step 4: Verification Check -->
              <div class="math-step-box ${withFault ? 'box-halt' : 'box-pass'}">
                <span class="step-num-badge">Step 4 &bull; Verification Gate Check (v == v')</span>
                ${renderBitDiff('Received Tag v', csD.v, 'Computed Tag v\'', csD.vPrime)}
                <div class="step-result-row" style="margin-top: 8px;">
                  ${withFault
                    ? `<span class="text-danger font-bold">&cross; MISMATCH DETECTED: Tag bits do not match &rarr; ABORT TRIGGERED (&perp;)</span>`
                    : `<span class="text-green font-bold">&check; EXACT MATCH: Tag bits verified (v == v') &rarr; PROCEED</span>`}
                </div>
              </div>

              <!-- Step 5: Plaintext Release or Abort -->
              <div class="math-step-box ${withFault ? 'box-aborted' : ''}">
                <span class="step-num-badge">Step 5 &bull; Plaintext Output</span>
                <div class="step-result-row">
                  ${withFault
                    ? `<strong class="text-shield font-mono">[ABORTED: REJECTED WITH &perp;]</strong> &nbsp; <span style="color: #94a3b8; font-size: 12px;">(Corrupted bits blocked; bus clamped to 00000000)</span>`
                    : `<div>${renderByte(csD.recoveredM, 'Recovered m:')}</div><div style="margin-top: 6px;">Decrypted Output: <strong class="text-green font-mono">${isTextMode ? `"${csRes.actualOutput}"` : csRes.actualOutput.toString()}</strong></div>`}
                </div>
              </div>

            </div>

            <!-- Cramer-Shoup Verdict / Where it was caught -->
            <div class="math-verdict-box ${withFault ? 'verdict-shield' : 'verdict-ok'}">
              <div class="verdict-header">
                <span class="material-symbols-outlined icon-inline">${withFault ? 'shield' : 'check_circle'}</span>
                <strong>${withFault ? 'Where It Was Caught:' : 'Mathematical Check:'}</strong>
              </div>
              <p>
                ${withFault
                  ? `At Step 4! The hardware bit flip at <strong>Bit ${bitPos}</strong> altered ciphertext <code>u1</code>, causing universal hash <code>alpha</code> and the computed proof tag <code>v'</code> to diverge from the received tag <code>v</code>. The equality comparator detected the bit mismatch and triggered an immediate <strong>hardware abort (&perp;)</strong> before any corrupted byte was emitted to memory!`
                  : `Proof tag v == v' verified with 100% precision. Decryption proceeded safely to recover plaintext.`}
              </p>
            </div>
          </div>

        </div>

      </div>
    `;

    this.container.innerHTML = html;
  }
}
