// FaultLab Application Coordinator: Hardware Silicon Die & Lab Edition
import { CompareView } from './ui/compareView.js';
import { SiliconDieCanvas } from './ui/dieCanvas.js';
import { OscilloscopeCanvas } from './ui/oscilloscope.js';
import { BitInspector } from './ui/bitInspector.js';
import { FaultType } from './simulator/faults.js';

class FaultLabApp {
  constructor() {
    this.state = {
      inputMode: 'text', // 'text' or 'number'
      message: 'HELLO',
      withFault: false,
      faultType: FaultType.SINGLE_BIT_FLIP,
      bitIndex: 2
    };

    this.initElements();
    this.initViews();
    this.initEventListeners();
    this.runApp();
  }

  initElements() {
    this.inputModeSelect = document.getElementById('input-mode-select');
    this.messageInput = document.getElementById('main-message-input');
    this.btnRunNormal = document.getElementById('btn-pres-normal');
    this.btnInjectFault = document.getElementById('btn-pres-inject');
    this.quickSampleBtns = document.querySelectorAll('.btn-quick-sample');

    this.presCompareContainer = document.getElementById('presentation-compare-container');
    this.dieCanvasElem = document.getElementById('die-canvas');
    this.oscCanvasElem = document.getElementById('oscilloscope-canvas');
    this.bitInspectorContainer = document.getElementById('bit-inspector-container');
  }

  initViews() {
    // 1. Direct Side-by-Side Comparison: ElGamal vs Cramer-Shoup
    this.compareView = new CompareView(this.presCompareContainer);

    // 2. Hardware Silicon Die Canvas — clicking fires laser AND triggers fault injection
    this.dieCanvas = new SiliconDieCanvas(this.dieCanvasElem, (block, coords) => {
      // Randomize the bit position on each laser strike (0-7 for 8-bit)
      this.state.bitIndex = Math.floor(Math.random() * 8);
      this.triggerHardwareGlitch();
    });

    // 3. Digital Oscilloscope — clicking triggers a voltage glitch
    this.oscilloscope = new OscilloscopeCanvas(this.oscCanvasElem);
    this.oscCanvasElem.style.cursor = 'pointer';
    this.oscCanvasElem.addEventListener('click', () => {
      this.state.bitIndex = Math.floor(Math.random() * 8);
      this.oscilloscope.triggerGlitch('voltage');
      this.state.withFault = true;
      this.dieCanvas.fireLaser();
      this.runApp();
    });

    // 4. Bit-Level Register Inspector
    this.bitInspector = new BitInspector(this.bitInspectorContainer, (bitPos) => {
      this.state.bitIndex = bitPos;
      this.triggerHardwareGlitch();
    });
  }

  initEventListeners() {
    // Input mode switch (Text vs Number)
    this.inputModeSelect.addEventListener('change', () => {
      this.state.inputMode = this.inputModeSelect.value;
      if (this.state.inputMode === 'text') {
        this.messageInput.value = 'HELLO';
        this.messageInput.type = 'text';
      } else {
        this.messageInput.value = '123';
        this.messageInput.type = 'number';
      }
      this.state.message = this.messageInput.value;
      this.runApp();
    });

    // Message input change
    this.messageInput.addEventListener('input', () => {
      this.state.message = this.messageInput.value.trim();
      this.runApp();
    });

    // Quick sample buttons
    this.quickSampleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sample = btn.dataset.sample;
        const mode = btn.dataset.mode;
        this.state.inputMode = mode;
        this.inputModeSelect.value = mode;
        this.state.message = sample;
        this.messageInput.value = sample;
        this.messageInput.type = mode === 'number' ? 'number' : 'text';
        this.runApp();
      });
    });

    // Normal run button — clear fault state
    this.btnRunNormal.addEventListener('click', () => {
      this.state.withFault = false;
      this.runApp();
    });

    // Inject fault button — trigger full hardware glitch
    this.btnInjectFault.addEventListener('click', () => {
      this.state.bitIndex = Math.floor(Math.random() * 8);
      this.triggerHardwareGlitch();
    });
  }

  triggerHardwareGlitch() {
    this.state.withFault = true;
    // Trigger both visual animations simultaneously
    if (this.oscilloscope) this.oscilloscope.triggerGlitch('clock');
    if (this.dieCanvas) this.dieCanvas.fireLaser();
    this.runApp();
  }

  runApp() {
    const isText = this.state.inputMode === 'text';
    let inputVal = this.state.message;
    if (!inputVal) {
      inputVal = isText ? 'HELLO' : '123';
    }

    // Clamp bit index to 8-bit range
    const bitPos = Math.min(Math.max(0, this.state.bitIndex), 7);
    this.state.bitIndex = bitPos;

    // Update 2-way comparison: ElGamal vs Cramer-Shoup
    this.compareView.renderPresentation({
      input: inputVal,
      isTextMode: isText,
      withFault: this.state.withFault,
      faultType: this.state.faultType,
      bitIndex: bitPos
    });

    // Update Bit Inspector display with 8-bit register
    const sampleVal = isText ? BigInt(inputVal.charCodeAt(0)) : BigInt(inputVal || 123);
    const corruptedVal = this.state.withFault ? (sampleVal ^ (1n << BigInt(bitPos))) : sampleVal;
    this.bitInspector.update(corruptedVal, sampleVal, 8);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.faultLab = new FaultLabApp();
});
