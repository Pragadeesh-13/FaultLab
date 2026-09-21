// BigInt 8-Bit Modular Arithmetic & Utilities for Cryptographic Operations

export const BigMath = {
  // Safe positive modulo: ensures result is always non-negative in [0, m - 1]
  mod(n, m) {
    const r = BigInt(n) % BigInt(m);
    return r < 0n ? r + BigInt(m) : r;
  },

  // Modular Exponentiation: computes (base^exp) % mod using Square-and-Multiply
  // Runs in O(log exp) time, preventing integer overflow
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

  // Greatest Common Divisor using standard Euclidean algorithm
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

  // Modular Inverse: computes x such that (a * x) % m === 1
  modInverse(a, m) {
    const { gcd, x } = BigMath.extGCD(a, m);
    if (gcd !== 1n && gcd !== -1n) {
      throw new Error(`Inverse does not exist: gcd(${a}, ${m}) = ${gcd}`);
    }
    return BigMath.mod(x, m);
  },

  // Simple, easy-to-explain Universal Hash for Cramer-Shoup verification tag:
  // Combines (u1, u2, e) using fixed coprime multipliers modulo q.
  // Formula: alpha = (3*u1 + 5*u2 + 7*e + 1) mod q
  // Any bit-flip in u1, u2, or e mathematically guarantees alpha will change.
  hashCS(u1, u2, e, q) {
    u1 = BigInt(u1);
    u2 = BigInt(u2);
    e = BigInt(e);
    q = BigInt(q);
    const combined = u1 * 3n + u2 * 5n + e * 7n + 1n;
    return BigMath.mod(combined, q);
  },

  // Convert BigInt to 8-bit binary string (e.g. 72 -> "01001000")
  toBinary(num, bits = 8) {
    let s = (BigInt(num) & ((1n << BigInt(bits)) - 1n)).toString(2);
    return s.padStart(bits, '0');
  },

  // Convert BigInt to clean 2-digit hex string (e.g. 72 -> "0x48")
  toHex(num, digits = 2) {
    let h = BigInt(num).toString(16).toUpperCase();
    return `0x${h.padStart(digits, '0')}`;
  },

  // Hamming distance: counts number of bits that differ between two values
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
