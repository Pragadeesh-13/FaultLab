// Minimal Cryptographic Verification Test Suite
import { BigMath } from '../js/crypto/bigmath.js';
import { ElGamalEngine } from '../js/crypto/elgamal.js';
import { CramerShoupEngine } from '../js/crypto/cramershoup.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    process.exit(1);
  } else {
    console.log(`[PASS] ${message}`);
  }
}

console.log('=== RUNNING FAULTLAB VERIFICATION TESTS ===\n');

// 1. Test BigMath
console.log('--- 1. BigMath ---');
assert(BigMath.modExp(7n, 560n, 561n) === 1n, 'modExp: 7^560 mod 561 = 1');
const inv = BigMath.modInverse(17n, 3120n);
assert((17n * inv) % 3120n === 1n, 'modInverse computation');
assert(BigMath.gcd(1071n, 462n) === 21n, 'gcd(1071, 462) = 21');
assert(BigMath.hammingDistance(0b10110n, 0b10001n) === 3, 'Hamming distance');

// 2. Test ElGamal
console.log('\n--- 2. ElGamal ---');
const elg = new ElGamalEngine();
const testMsg = 72n; // 'H'
const elgEnc = elg.encrypt(testMsg);
const elgDec = elg.decrypt(elgEnc.c1, elgEnc.c2);
assert(elgDec.plaintext === testMsg, 'ElGamal normal encryption/decryption');

// Corrupt c2 by flipping bit 2
const corruptedC2 = elgEnc.c2 ^ (1n << 2n);
const elgDecFaulty = elg.decrypt(elgEnc.c1, corruptedC2);
assert(elgDecFaulty.plaintext !== testMsg, 'ElGamal silently outputs corrupted plaintext');
assert(elgDecFaulty.detected === false, 'ElGamal has 0% detection of bit flip');

// 3. Test Cramer-Shoup
console.log('\n--- 3. Cramer-Shoup ---');
const cs = new CramerShoupEngine();
const csEnc = cs.encrypt(testMsg);
const csDecNormal = cs.decrypt(csEnc.ciphertext);
assert(csDecNormal.rejected === false, 'Cramer-Shoup normal decryption passes');
assert(csDecNormal.plaintext === testMsg, 'Cramer-Shoup recovered plaintext correctly');

// Corrupt u1 by flipping bit 2
const corruptedCS = {
  ...csEnc.ciphertext,
  u1: csEnc.ciphertext.u1 ^ (1n << 2n)
};
const csDecFaulty = cs.decrypt(corruptedCS);
assert(csDecFaulty.rejected === true, 'Cramer-Shoup catches corrupted bit and REJECTS');
assert(csDecFaulty.detected === true, 'Cramer-Shoup sets detected = true');
assert(csDecFaulty.plaintext === null, 'Cramer-Shoup withholds plaintext on tamper');

console.log('\nALL FAULTLAB TESTS PASSED!\n');
