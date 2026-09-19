// BigInt Arbitrary Precision Math Utilities for Cryptographic Operations

export const BigMath = {
  // Safe positive modulo
  mod(n, m) {
    const r = BigInt(n) % BigInt(m);
    return r < 0n ? r + BigInt(m) : r;
  },

  // Modular Exponentiation: (base^exp) % mod using square-and-multiply
  modExp(base, exp, mod) {
    base = BigMath.mod(base, mod);
    exp = BigInt(exp);
    mod = BigInt(mod);
    if (mod === 1n) return 0n;
    let result = 1n;
    while (exp > 0n) {
      if (exp & 1n) {
        result = (result * base) % mod;
      }
      base = (base * base) % mod;
      exp >>= 1n;
    }
    return result;
  },

  // Greatest Common Divisor
  gcd(a, b) {
    a = BigInt(a);
    b = BigInt(b);
    if (a < 0n) a = -a;
    if (b < 0n) b = -b;
    while (b !== 0n) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  },

  // Extended Euclidean Algorithm: returns { gcd, x, y } such that a*x + b*y = gcd
  extGCD(a, b) {
    a = BigInt(a);
    b = BigInt(b);
    let oldR = a, r = b;
    let oldS = 1n, s = 0n;
    let oldT = 0n, t = 1n;

    while (r !== 0n) {
      const quotient = oldR / r;
      let temp = oldR - quotient * r;
      oldR = r;
      r = temp;

      temp = oldS - quotient * s;
      oldS = s;
      s = temp;

      temp = oldT - quotient * t;
      oldT = t;
      t = temp;
    }
    return { gcd: oldR, x: oldS, y: oldT };
  },

  // Modular Inverse: returns x such that (a * x) % m === 1
  modInverse(a, m) {
    const { gcd, x } = BigMath.extGCD(a, m);
    if (gcd !== 1n && gcd !== -1n) {
      throw new Error(`Inverse does not exist: gcd(${a}, ${m}) = ${gcd}`);
    }
    return BigMath.mod(x, m);
  },

  // Garner's Formula for Chinese Remainder Theorem:
  // Given s_p = s mod p and s_q = s mod q, reconstruct s mod (p*q)
  // s = s_q + q * [ ( (s_p - s_q) mod p * q_inv ) mod p ]
  garnerCRT(sp, sq, p, q, qInv) {
    p = BigInt(p);
    q = BigInt(q);
    sp = BigInt(sp);
    sq = BigInt(sq);
    qInv = qInv !== undefined ? BigInt(qInv) : BigMath.modInverse(q, p);

    const diff = BigMath.mod(sp - sq, p);
    const h = BigMath.mod(diff * qInv, p);
    return sq + q * h;
  },

  // Deterministic 32-bit hash for Cramer-Shoup tag calculation
  // Computes a hash of (u1, u2, e) reduced modulo q
  hashCS(u1, u2, e, q) {
    const str = `${u1.toString()}:${u2.toString()}:${e.toString()}`;
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const combined = (BigInt(h1 >>> 0) << 32n) | BigInt(h2 >>> 0);
    return BigMath.mod(combined, q);
  },

  // Convert BigInt to binary string with fixed bit-width
  toBinary(num, bits = 32) {
    let s = BigInt(num).toString(2);
    if (s.length < bits) {
      s = "0".repeat(bits - s.length) + s;
    }
    return s;
  },

  // Convert BigInt to formatted hex string (0x...)
  toHex(num, digits = 8) {
    let h = BigInt(num).toString(16).toUpperCase();
    if (h.length < digits) {
      h = "0".repeat(digits - h.length) + h;
    }
    return `0x${h}`;
  },

  // Hamming distance between two BigInts
  hammingDistance(a, b) {
    let x = BigInt(a) ^ BigInt(b);
    let count = 0;
    while (x > 0n) {
      if (x & 1n) count++;
      x >>= 1n;
    }
    return count;
  }
};
