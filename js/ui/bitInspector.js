// Interactive Bit-Level Register Inspector and Manual Bit-Flipper
import { BigMath } from '../crypto/bigmath.js';

export class BitInspector {
  constructor(containerElement, onBitToggled = null) {
    this.container = containerElement;
    this.onBitToggled = onBitToggled;
    this.currentValue = 0n;
    this.goldenValue = null;
    this.bitWidth = 16;
  }

  update(currentVal, goldenVal = null, bitWidth = 16) {
    this.currentValue = BigInt(currentVal);
    this.goldenValue = goldenVal !== null ? BigInt(goldenVal) : null;
    this.bitWidth = bitWidth;
    this.render();
  }

  render() {
    const curBin = BigMath.toBinary(this.currentValue, this.bitWidth);
    const goldBin = this.goldenValue !== null ? BigMath.toBinary(this.goldenValue, this.bitWidth) : curBin;

    let hammingDist = 0;
    if (this.goldenValue !== null) {
      hammingDist = BigMath.hammingDistance(this.currentValue, this.goldenValue);
    }

    let html = `
      <div class="bit-inspector-card">
        <div class="bit-inspector-header">
          <div class="bit-readout-group">
            <span class="readout-label">HEX:</span>
            <span class="readout-val hex-val">${BigMath.toHex(this.currentValue, Math.ceil(this.bitWidth / 4))}</span>
          </div>
          <div class="bit-readout-group">
            <span class="readout-label">DEC:</span>
            <span class="readout-val dec-val">${this.currentValue.toString()}</span>
          </div>
          <div class="bit-readout-group">
            <span class="readout-label">8-BIT BIN:</span>
            <span class="readout-val bin-val" style="font-family: var(--font-mono); color: #a78bfa; border: 1px solid rgba(167, 139, 250, 0.3);">${curBin}</span>
          </div>
          <div class="bit-readout-group">
            <span class="readout-label">HAMMING DIST:</span>
            <span class="readout-val ${hammingDist > 0 ? 'diff-val' : 'norm-val'}">${hammingDist} bit(s)</span>
          </div>
        </div>

        <div class="bit-register-grid" role="group" aria-label="Register Bits">
    `;

    // Render bits from MSB (left) to LSB (right)
    for (let i = 0; i < this.bitWidth; i++) {
      const bitPos = this.bitWidth - 1 - i; // LSB index
      const curBit = curBin[i];
      const goldBit = goldBin[i];
      const isFlipped = this.goldenValue !== null && curBit !== goldBit;

      html += `
        <button type="button" 
                class="bit-cell ${curBit === '1' ? 'bit-one' : 'bit-zero'} ${isFlipped ? 'bit-flipped' : ''}" 
                data-bit-pos="${bitPos}" 
                title="Bit ${bitPos} (Weight: 2^${bitPos}). Click to flip!">
          <span class="bit-index">${bitPos}</span>
          <span class="bit-val">${curBit}</span>
        </button>
      `;
    }

    html += `
        </div>
        <div class="bit-inspector-footer">
          <span class="hint-text"><span class="material-symbols-outlined icon-inline">info</span> Click any bit cell above to manually toggle a single-bit physical fault</span>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    // Attach click events to bit cells
    const buttons = this.container.querySelectorAll('.bit-cell');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bitPos = parseInt(btn.dataset.bitPos, 10);
        if (this.onBitToggled) {
          this.onBitToggled(bitPos);
        }
      });
    });
  }
}
