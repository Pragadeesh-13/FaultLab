// Cramer–Shoup Cryptosystem (IND-CCA2 Secure with Universal Hash Verification)
import { BigMath } from './bigmath.js';

export class CramerShoupEngine {
  constructor() {
    // 8-bit Safe prime p = 227 (q = (p-1)/2 = 113 is prime)
    // Subgroup generators: g1 = 4 (which is 2^2 mod p), g2 = 9 (3^2 mod p) in subgroup G_q
    this.defaultParams = {
      p: 227n,
      q: 113n,
      g1: 4n,
      g2: 9n,
      x1: 17n,
      x2: 29n,
      y1: 43n,
      y2: 51n,
      z: 73n
    };
    this.keys = this.generateKeys(this.defaultParams);
  }

  generateKeys(params = this.defaultParams) {
    const { p, q, g1, g2, x1, x2, y1, y2, z } = params;

    // Public key components:
    // c = g1^x1 * g2^x2 mod p
    const c = BigMath.mod(BigMath.modExp(g1, x1, p) * BigMath.modExp(g2, x2, p), p);
    // d = g1^y1 * g2^y2 mod p
    const d = BigMath.mod(BigMath.modExp(g1, y1, p) * BigMath.modExp(g2, y2, p), p);
    // h = g1^z mod p
    const h = BigMath.modExp(g1, z, p);

    return {
      publicKey: { p, q, g1, g2, c, d, h },
      privateKey: { p, q, g1, g2, x1, x2, y1, y2, z, c, d, h }
    };
  }

  // Encrypt: returns 4-tuple ciphertext (u1, u2, e, v)
  encrypt(m, pubKey = this.keys.publicKey, ephemeralK = null) {
    m = BigInt(m);
    const { p, q, g1, g2, c, d, h } = pubKey;
    if (m >= p || m <= 0n) throw new Error(`Plaintext m (${m}) must be in range [1, ${p - 1n}]`);

    const k = ephemeralK ? BigInt(ephemeralK) : 19n;

    // u1 = g1^k mod p
    const u1 = BigMath.modExp(g1, k, p);
    // u2 = g2^k mod p
    const u2 = BigMath.modExp(g2, k, p);
    // e = h^k * m mod p
    const hk = BigMath.modExp(h, k, p);
    const e = BigMath.mod(hk * m, p);

    // Hash computation alpha = H(u1, u2, e)
    const alpha = BigMath.hashCS(u1, u2, e, q);

    // Verification tag v = c^k * d^(k * alpha) mod p
    const ck = BigMath.modExp(c, k, p);
    const kAlpha = BigMath.mod(k * alpha, q);
    const dkAlpha = BigMath.modExp(d, kAlpha, p);
    const v = BigMath.mod(ck * dkAlpha, p);

    return {
      ciphertext: { u1, u2, e, v },
      alpha,
      k,
      stages: [
        { name: 'Plaintext m', reg: 'm', value: m, hex: BigMath.toHex(m) },
        { name: 'Ephemeral Nonce k', reg: 'k', value: k, hex: BigMath.toHex(k) },
        { name: 'Commitment u1', reg: 'u1 = g1^k mod p', value: u1, hex: BigMath.toHex(u1) },
        { name: 'Commitment u2', reg: 'u2 = g2^k mod p', value: u2, hex: BigMath.toHex(u2) },
        { name: 'Masked Message e', reg: 'e = h^k * m mod p', value: e, hex: BigMath.toHex(e) },
        { name: 'Hash Tag alpha', reg: 'alpha = H(u1, u2, e)', value: alpha, hex: BigMath.toHex(alpha) },
        { name: 'Proof Tag v', reg: 'v = c^k * d^(k*alpha) mod p', value: v, hex: BigMath.toHex(v) }
      ]
    };
  }

  // Decrypt with rigorous verification and fault injection support
  decrypt(ciphertext, privKey = this.keys.privateKey, faultHook = null) {
    let { u1, u2, e, v } = ciphertext;
    u1 = BigInt(u1);
    u2 = BigInt(u2);
    e = BigInt(e);
    v = BigInt(v);
    const { p, q, x1, x2, y1, y2, z } = privKey;

    const stages = [
      { id: 'cs_u1', name: 'Input Commitment u1', reg: 'u1', value: u1, bitWidth: 16 },
      { id: 'cs_u2', name: 'Input Commitment u2', reg: 'u2', value: u2, bitWidth: 16 },
      { id: 'cs_e', name: 'Input Encrypted Message e', reg: 'e', value: e, bitWidth: 16 },
      { id: 'cs_v', name: 'Input Proof Tag v', reg: 'v', value: v, bitWidth: 16 }
    ];

    if (faultHook && faultHook.target === 'cs_u1') {
      u1 = faultHook.apply(u1);
      stages[0].corrupted = true;
      stages[0].corruptedValue = u1;
    }
    if (faultHook && faultHook.target === 'cs_u2') {
      u2 = faultHook.apply(u2);
      stages[1].corrupted = true;
      stages[1].corruptedValue = u2;
    }
    if (faultHook && faultHook.target === 'cs_e') {
      e = faultHook.apply(e);
      stages[2].corrupted = true;
      stages[2].corruptedValue = e;
    }
    if (faultHook && faultHook.target === 'cs_v') {
      v = faultHook.apply(v);
      stages[3].corrupted = true;
      stages[3].corruptedValue = v;
    }

    // Step 1: Recompute Hash alpha' = H(u1, u2, e)
    let alpha = BigMath.hashCS(u1, u2, e, q);
    const hashStage = { id: 'cs_hash', name: 'Recomputed Hash alpha', reg: 'alpha = H(u1, u2, e)', value: alpha, bitWidth: 8 };
    if (faultHook && faultHook.target === 'cs_hash') {
      alpha = faultHook.apply(alpha);
      hashStage.corrupted = true;
      hashStage.corruptedValue = alpha;
    }
    stages.push(hashStage);

    // Step 2: Compute expected verification tag v'
    // v' = u1^(x1 + y1*alpha) * u2^(x2 + y2*alpha) mod p
    const exp1 = BigMath.mod(x1 + BigMath.mod(y1 * alpha, q), q);
    const exp2 = BigMath.mod(x2 + BigMath.mod(y2 * alpha, q), q);
    let term1 = BigMath.modExp(u1, exp1, p);
    let term2 = BigMath.modExp(u2, exp2, p);
    let vPrime = BigMath.mod(term1 * term2, p);

    const vPrimeStage = {
      id: 'cs_verify',
      name: 'Verification Tag Evaluation',
      reg: "v' = u1^(x1+y1*a) * u2^(x2+y2*a) mod p",
      value: vPrime,
      expected: v,
      bitWidth: 8
    };
    if (faultHook && faultHook.target === 'cs_verify') {
      vPrime = faultHook.apply(vPrime);
      vPrimeStage.corrupted = true;
      vPrimeStage.corruptedValue = vPrime;
    }
    stages.push(vPrimeStage);

    // Step 3: Verification Check
    const passed = (vPrime === v);
    let bypassVerification = false;

    // Clock glitch / instruction skip fault can bypass branch!
    if (faultHook && faultHook.target === 'cs_branch') {
      bypassVerification = true;
      stages.push({
        id: 'cs_branch',
        name: 'Control Flow Verification Gate',
        reg: "INSTRUCTION SKIP (Glitch)",
        value: "BYPASSED",
        corrupted: true,
        corruptedValue: "Bypassed Check"
      });
    } else {
      stages.push({
        id: 'cs_gate',
        name: 'Cryptographic Tag Verification Gate',
        reg: "Check v == v'",
        value: passed ? 'VERIFIED (MATCH)' : 'INTEGRITY ERROR (MISMATCH)',
        passed: passed,
        tagReceived: v,
        tagComputed: vPrime
      });
    }

    if (!passed && !bypassVerification) {
      // Cramer–Shoup detects the fault and halts cleanly!
      return {
        rejected: true,
        plaintext: null,
        error: 'VERIFICATION_FAILURE: Proof tag mismatch. Cryptographic abort triggered.',
        stages,
        hasBuiltinVerification: true,
        detected: true, // Caught by CCA2 tag verification!
        details: {
          u1,
          u2,
          e,
          v,
          origU1: ciphertext.u1,
          origU2: ciphertext.u2,
          alpha,
          vPrime,
          passed: false,
          p,
          q
        }
      };
    }

    // Step 4: If verified, compute m = e / (u1^z) mod p
    let u1z = BigMath.modExp(u1, z, p);
    let u1zInv = BigMath.modInverse(u1z, p);
    let recoveredM = BigMath.mod(e * u1zInv, p);

    const outStage = { id: 'cs_out', name: 'Decrypted Plaintext', reg: 'm = e * (u1^z)^-1 mod p', value: recoveredM, bitWidth: 8 };
    if (faultHook && faultHook.target === 'cs_out') {
      recoveredM = faultHook.apply(recoveredM);
      outStage.corrupted = true;
      outStage.corruptedValue = recoveredM;
    }
    stages.push(outStage);

    return {
      rejected: false,
      plaintext: recoveredM,
      stages,
      hasBuiltinVerification: true,
      detected: false,
      details: {
        u1,
        u2,
        e,
        v,
        origU1: ciphertext.u1,
        origU2: ciphertext.u2,
        alpha,
        vPrime,
        passed: true,
        u1z,
        u1zInv,
        recoveredM,
        p,
        q
      }
    };
  }
}
