// Unified Cryptographic Simulation Runner for ElGamal & Cramer-Shoup
import { ElGamalEngine } from '../crypto/elgamal.js';
import { CramerShoupEngine } from '../crypto/cramershoup.js';
import { FaultInjector } from './faults.js';

export class SimulationRunner {
  constructor() {
    this.elgamal = new ElGamalEngine();
    this.cramershoup = new CramerShoupEngine();
  }

  // Dynamic Key Randomization: generates fresh keys for both cryptosystems
  randomizeKeys() {
    const elgKeys = this.elgamal.generateRandomKeys();
    const csKeys = this.cramershoup.generateRandomKeys();
    return { elgKeys, csKeys };
  }

  // Helper: Format raw numeric result back to text if in text mode
  static numToChar(num) {
    const code = Number(BigInt(num) % 256n);
    if (code >= 32 && code <= 126) {
      return String.fromCharCode(code);
    }
    return '';
  }

  // Run a single simulation for a given algorithm and fault specification
  run({
    algorithm = 'cramershoup',
    input = null,
    plaintext = null,
    isTextMode = false,
    faultSpec = null,
    targetStage = null,
    corruptCharIndex = 1
  }) {
    const rawInput = input !== null ? input : (plaintext !== null ? plaintext : (isTextMode ? 'HELLO' : 123n));
    const isText = (isTextMode === true) && (typeof rawInput === 'string');

    if (isText) {
      return this._runTextMode(algorithm, rawInput, faultSpec, targetStage, corruptCharIndex);
    } else {
      const plaintextNum = typeof rawInput === 'bigint' ? rawInput : BigInt(rawInput || 123);
      return this._runNumberMode(algorithm, plaintextNum, faultSpec, targetStage);
    }
  }

  // Execution with String Text (e.g. "HELLO", "CAT", "123")
  _runTextMode(algorithm, text, faultSpec, targetStage, corruptCharIndex) {
    if (!text || text.length === 0) text = 'HELLO';
    const charCodes = text.split('').map(c => BigInt(c.charCodeAt(0)));
    const targetIdx = Math.min(Math.max(0, corruptCharIndex), charCodes.length - 1);

    const charResults = [];
    let anyRejected = false;
    let anyCorrupted = false;
    let primaryStages = [];

    for (let i = 0; i < charCodes.length; i++) {
      const charCode = charCodes[i];
      const shouldFaultThisChar = faultSpec && (i === targetIdx);

      const run = this._runNumberMode(
        algorithm,
        charCode,
        shouldFaultThisChar ? faultSpec : null,
        shouldFaultThisChar ? targetStage : null
      );

      charResults.push(run);
      if (run.rejected) anyRejected = true;
      if (run.silentCorruption) anyCorrupted = true;
      if (i === targetIdx || i === 0) primaryStages = run.stages;
    }

    // Reassemble output text
    let outputText = '';
    if (anyRejected) {
      outputText = '[REJECTED: Tag Mismatch]';
    } else {
      outputText = charResults.map(r => SimulationRunner.numToChar(r.actualOutput)).join('');
    }

    const firstRun = charResults[targetIdx] || charResults[0];

    return {
      algorithm: firstRun.algorithm,
      algoId: firstRun.algoId,
      isTextMode: true,
      inputText: text,
      outputText: outputText,
      goldenOutputText: text,
      actualOutput: outputText,
      stages: primaryStages,
      hasBuiltinVerification: firstRun.hasBuiltinVerification,
      faultInjected: !!faultSpec,
      faultDetected: anyRejected,
      silentCorruption: anyCorrupted && !anyRejected,
      rejected: anyRejected,
      securityStatus: anyRejected
        ? 'DETECTED_AND_REJECTED'
        : (anyCorrupted ? 'SILENT_CORRUPTION' : 'NORMAL'),
      securitySummary: anyRejected
        ? `BLOCKED: Cramer–Shoup verified character ${targetIdx + 1} ('${text[targetIdx]}') and found proof tag v ≠ v'. Decryption safely aborted!`
        : (anyCorrupted
          ? `SILENT FAILURE: Fault corrupted character ${targetIdx + 1} ('${text[targetIdx]}') into '${SimulationRunner.numToChar(charResults[targetIdx].actualOutput)}'. Plaintext is garbled without any warning!`
          : `Normal execution: Message "${text}" decrypted with 100% accuracy.`),
      details: {
        ...(firstRun.details || {}),
        targetChar: text[targetIdx],
        targetIdx: targetIdx
      }
    };
  }

  // Execution with Single Number (e.g. 123, 42, 250)
  _runNumberMode(algorithm, plaintext, faultSpec, targetStage) {
    plaintext = BigInt(plaintext);

    switch (algorithm) {
      case 'elgamal':
        return this._runElGamal(plaintext, faultSpec, targetStage);
      case 'cramershoup':
        return this._runCramerShoup(plaintext, faultSpec, targetStage);
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }

  _runElGamal(m, faultSpec, targetStage) {
    const normalizedM = this.elgamal.normalizePlaintext(m);
    const enc = this.elgamal.encrypt(normalizedM);
    const golden = this.elgamal.decrypt(enc.c1, enc.c2, this.elgamal.keys.privateKey, null);

    let faulty = null;
    if (faultSpec && targetStage) {
      const hook = FaultInjector.createHook(targetStage, faultSpec);
      faulty = this.elgamal.decrypt(enc.c1, enc.c2, this.elgamal.keys.privateKey, hook);
    }

    const output = faulty ? faulty.plaintext : golden.plaintext;
    const isCorrupted = faulty ? (output !== normalizedM) : false;

    return {
      algorithm: 'ElGamal',
      algoId: 'elgamal',
      input: normalizedM,
      originalInput: m,
      ciphertext: { c1: enc.c1, c2: enc.c2 },
      goldenOutput: golden.plaintext,
      actualOutput: output,
      stages: faulty ? faulty.stages : golden.stages,
      hasBuiltinVerification: false,
      faultInjected: !!faulty,
      faultDetected: false,
      silentCorruption: isCorrupted,
      rejected: false,
      securityStatus: isCorrupted ? 'SILENT_CORRUPTION' : 'NORMAL',
      securitySummary: isCorrupted
        ? `MALLEABLE FAILURE: Input ${normalizedM} silently decrypted as corrupted value ${output}!`
        : `Normal: Decrypted ${output} successfully.`,
      details: (faulty || golden).details
    };
  }

  _runCramerShoup(m, faultSpec, targetStage) {
    const normalizedM = this.cramershoup.normalizePlaintext(m);
    const enc = this.cramershoup.encrypt(normalizedM);
    const golden = this.cramershoup.decrypt(enc.ciphertext, this.cramershoup.keys.privateKey, null);

    let faulty = null;
    if (faultSpec && targetStage) {
      const hook = FaultInjector.createHook(targetStage, faultSpec);
      faulty = this.cramershoup.decrypt(enc.ciphertext, this.cramershoup.keys.privateKey, hook);
    }

    const run = faulty || golden;
    const isRejected = run.rejected;
    const isDetected = run.detected;
    const output = run.plaintext;
    const isCorrupted = (!isRejected && output !== null && output !== normalizedM);

    let securityStatus = 'NORMAL';
    let summary = `Normal: Decrypted ${output} and verified tag v == v'.`;

    if (isDetected && isRejected) {
      securityStatus = 'DETECTED_AND_REJECTED';
      summary = 'BLOCKED: Proof tag mismatch (v ≠ v\'). Cramer–Shoup aborted decryption and withheld corrupted plaintext!';
    } else if (isCorrupted) {
      securityStatus = 'VERIFICATION_BYPASS';
      summary = 'Instruction skip glitch bypassed verification gate!';
    }

    return {
      algorithm: 'Cramer–Shoup',
      algoId: 'cramershoup',
      input: normalizedM,
      originalInput: m,
      ciphertext: enc.ciphertext,
      goldenOutput: golden.plaintext,
      actualOutput: output,
      stages: run.stages,
      hasBuiltinVerification: true,
      faultInjected: !!faulty,
      faultDetected: isDetected,
      silentCorruption: isCorrupted,
      rejected: isRejected,
      securityStatus,
      securitySummary: summary,
      details: run.details
    };
  }
}
