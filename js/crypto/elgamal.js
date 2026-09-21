// ElGamal Cryptosystem with Instrumentation and Malleability Tracking
import { BigMath } from './bigmath.js';

export class ElGamalEngine {
  constructor(customParams = null) {
    // 8-bit Safe prime p = 227 (q = (p-1)/2 = 113 is prime), subgroup generator g = 4
    this.defaultParams = {
      p: 227n,
      q: 113n,
      g: 4n,
      x: 23n // Default private key
    };
    this.params = { ...this.defaultParams, ...(customParams || {}) };
    this.keys = this.generateKeys(this.params.p, this.params.g, this.params.x);
  }

  // Pick a dynamic random ephemeral nonce k in [2, q - 2]
  getRandomNonce(q = this.params.q || 113n) {
    const qNum = Number(q);
    return BigInt(Math.floor(Math.random() * (qNum - 3)) + 2);
  }

  // Generate a dynamic random private key x and update public key y
  generateRandomKeys(p = this.params.p, g = this.params.g, q = this.params.q) {
    p = BigInt(p);
    g = BigInt(g);
    q = BigInt(q);
    const randomX = BigInt(Math.floor(Math.random() * (Number(q) - 3)) + 2);
    this.params.x = randomX;
    this.keys = this.generateKeys(p, g, randomX);
    return this.keys;
  }

  generateKeys(p = 227n, g = 4n, x = 23n) {
    p = BigInt(p);
    g = BigInt(g);
    x = BigInt(x);

    // Public key y = g^x mod p
    const y = BigMath.modExp(g, x, p);

    return {
      publicKey: { p, g, y },
      privateKey: { p, g, x, y }
    };
  }

  // Dynamically normalize any input number to valid range [1, p - 1]
  // Allows arbitrary integers (e.g. 0, 42, 250, 1000) without crashing
  normalizePlaintext(m, p = this.keys.publicKey.p) {
    m = BigInt(m);
    p = BigInt(p);
    if (m > 0n && m < p) return m;
    let norm = BigMath.mod(m, p - 1n);
    return norm === 0n ? 1n : norm;
  }

  // Encrypt: returns ciphertext (c1, c2)
  // Supports dynamic random nonce k and dynamic arbitrary input numbers
  encrypt(m, pubKey = this.keys.publicKey, ephemeralK = null) {
    const { p, g, y } = pubKey;
    m = this.normalizePlaintext(m, p);

    // Dynamic ephemeral key k: random nonce if not explicitly provided
    const k = ephemeralK !== null && ephemeralK !== undefined
      ? BigInt(ephemeralK)
      : this.getRandomNonce(this.params.q || 113n);

    // c1 = g^k mod p
    const c1 = BigMath.modExp(g, k, p);
    // shared secret factor s = y^k mod p
    const sFactor = BigMath.modExp(y, k, p);
    // c2 = (m * sFactor) mod p
    const c2 = BigMath.mod(m * sFactor, p);

    return {
      c1,
      c2,
      k,
      stages: [
        { name: 'Plaintext m', reg: 'm', value: m, hex: BigMath.toHex(m) },
        { name: 'Ephemeral Nonce k (Dynamic)', reg: 'k', value: k, hex: BigMath.toHex(k) },
        { name: 'Ciphertext Component c1', reg: 'c1 = g^k mod p', value: c1, hex: BigMath.toHex(c1) },
        { name: 'Ciphertext Component c2', reg: 'c2 = m * y^k mod p', value: c2, hex: BigMath.toHex(c2) }
      ]
    };
  }

  // Decrypt with stage instrumentation and fault injection hook
  decrypt(c1, c2, privKey = this.keys.privateKey, faultHook = null) {
    c1 = BigInt(c1);
    c2 = BigInt(c2);
    const { p, x } = privKey;

    const stages = [
      { id: 'elg_c1', name: 'Ciphertext Input c1', reg: 'c1', value: c1, bitWidth: 8 },
      { id: 'elg_c2', name: 'Ciphertext Input c2', reg: 'c2', value: c2, bitWidth: 8 }
    ];

    let liveC1 = c1;
    let liveC2 = c2;

    if (faultHook && faultHook.target === 'elg_c1') {
      liveC1 = faultHook.apply(liveC1);
      stages[0].corrupted = true;
      stages[0].corruptedValue = liveC1;
    }

    if (faultHook && faultHook.target === 'elg_c2') {
      liveC2 = faultHook.apply(liveC2);
      stages[1].corrupted = true;
      stages[1].corruptedValue = liveC2;
    }

    // Stage 1: Compute shared secret s = c1^x mod p
    let s = BigMath.modExp(liveC1, x, p);
    const sStage = { id: 'elg_shared', name: 'Shared Secret Derivation', reg: 's = c1^x mod p', value: s, bitWidth: 8 };
    if (faultHook && faultHook.target === 'elg_shared') {
      s = faultHook.apply(s);
      sStage.corrupted = true;
      sStage.corruptedValue = s;
    }
    stages.push(sStage);

    // Stage 2: Compute modular inverse s_inv = s^(-1) mod p
    let sInv = BigMath.modInverse(s, p);
    const invStage = { id: 'elg_inv', name: 'Modular Inversion', reg: 's_inv = s^-1 mod p', value: sInv, bitWidth: 8 };
    if (faultHook && faultHook.target === 'elg_inv') {
      sInv = faultHook.apply(sInv);
      invStage.corrupted = true;
      invStage.corruptedValue = sInv;
    }
    stages.push(invStage);

    // Stage 3: Recover message m = (c2 * s_inv) mod p
    let recoveredM = BigMath.mod(liveC2 * sInv, p);
    const outStage = { id: 'elg_out', name: 'Recovered Plaintext', reg: 'm = c2 * s_inv mod p', value: recoveredM, bitWidth: 8 };
    if (faultHook && faultHook.target === 'elg_out') {
      recoveredM = faultHook.apply(recoveredM);
      outStage.corrupted = true;
      outStage.corruptedValue = recoveredM;
    }
    stages.push(outStage);

    return {
      plaintext: recoveredM,
      stages,
      hasBuiltinVerification: false,
      detected: false, // ElGamal is malleable and has NO integrity verification tag
      details: {
        c1: liveC1,
        c2: liveC2,
        origC1: c1,
        origC2: c2,
        s,
        sInv,
        recoveredM,
        x,
        p
      }
    };
  }
}
