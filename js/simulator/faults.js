// Hardware Fault Injection Models and Perturbation Operators
import { BigMath } from '../crypto/bigmath.js';

export const FaultType = {
  SINGLE_BIT_FLIP: 'SINGLE_BIT_FLIP',
  MULTI_BIT_BURST: 'MULTI_BIT_BURST',
  RANDOM_BYTE: 'RANDOM_BYTE',
  STUCK_AT_ZERO: 'STUCK_AT_ZERO',
  STUCK_AT_ONE: 'STUCK_AT_ONE',
  CLOCK_GLITCH: 'CLOCK_GLITCH',
  VOLTAGE_SAG: 'VOLTAGE_SAG',
  INSTRUCTION_SKIP: 'INSTRUCTION_SKIP'
};

export class FaultInjector {
  // Flip a single bit at specified position (0-indexed)
  static flipBit(value, bitIndex = 0) {
    const val = BigInt(value);
    const mask = 1n << BigInt(bitIndex);
    const result = val ^ mask;
    return {
      original: val,
      corrupted: result,
      affectedBits: [bitIndex],
      mask
    };
  }

  // Flip multiple specified bits
  static flipMultipleBits(value, bitIndices = [0, 1]) {
    let val = BigInt(value);
    let mask = 0n;
    for (const b of bitIndices) {
      mask |= (1n << BigInt(b));
    }
    const result = val ^ mask;
    return {
      original: val,
      corrupted: result,
      affectedBits: bitIndices,
      mask
    };
  }

  // Corrupt random bits (0 to 7 in 8-bit architecture)
  static randomCorruption(value, count = 2, maxBit = 7) {
    const indices = new Set();
    while (indices.size < count) {
      indices.add(Math.floor(Math.random() * (maxBit + 1)));
    }
    return FaultInjector.flipMultipleBits(value, Array.from(indices));
  }

  // Stuck-at-0 fault (mask with ~2^bit)
  static stuckAtZero(value, bitIndex = 0) {
    const val = BigInt(value);
    const mask = ~(1n << BigInt(bitIndex));
    const result = val & mask;
    return {
      original: val,
      corrupted: result,
      affectedBits: [bitIndex],
      mask
    };
  }

  // Stuck-at-1 fault (mask with 2^bit)
  static stuckAtOne(value, bitIndex = 0) {
    const val = BigInt(value);
    const mask = 1n << BigInt(bitIndex);
    const result = val | mask;
    return {
      original: val,
      corrupted: result,
      affectedBits: [bitIndex],
      mask
    };
  }

  // Clock glitch: causes timing violation in 8-bit register
  static clockGlitch(value, glitchIntensity = 0.5) {
    const val = BigInt(value);
    if (glitchIntensity > 0.8) {
      return {
        original: val,
        corrupted: 0n,
        affectedBits: [0, 1, 2, 3],
        description: 'Critical clock timing underflow: register cleared'
      };
    } else {
      // 8-bit bus corruption
      const mask = BigInt(Math.floor(Math.random() * 0xFF));
      return {
        original: val,
        corrupted: val ^ mask,
        affectedBits: [0, 1, 2, 3],
        mask,
        description: 'Clock setup time violation: ALU intermediate latched prematurely'
      };
    }
  }

  // Dispatcher for applying fault to a value given a fault specification
  static applyFault(value, faultSpec) {
    const { type, bitIndex = 0, bitIndices = [0, 1], intensity = 0.5 } = faultSpec;
    switch (type) {
      case FaultType.SINGLE_BIT_FLIP:
        return FaultInjector.flipBit(value, bitIndex);
      case FaultType.MULTI_BIT_BURST:
        return FaultInjector.flipMultipleBits(value, bitIndices);
      case FaultType.RANDOM_BYTE:
        return FaultInjector.randomCorruption(value, 2, 7);
      case FaultType.STUCK_AT_ZERO:
        return FaultInjector.stuckAtZero(value, bitIndex);
      case FaultType.STUCK_AT_ONE:
        return FaultInjector.stuckAtOne(value, bitIndex);
      case FaultType.CLOCK_GLITCH:
      case FaultType.VOLTAGE_SAG:
        return FaultInjector.clockGlitch(value, intensity);
      case FaultType.INSTRUCTION_SKIP:
        return {
          original: value,
          corrupted: value,
          affectedBits: [],
          description: 'Control flow skip: skipped conditional verification branch'
        };
      default:
        return FaultInjector.flipBit(value, bitIndex);
    }
  }

  // Create a fault hook callback to be passed into decrypt/sign functions
  static createHook(targetStageId, faultSpec) {
    return {
      target: targetStageId,
      spec: faultSpec,
      apply: (val) => {
        const res = FaultInjector.applyFault(val, faultSpec);
        return res.corrupted;
      }
    };
  }
}
