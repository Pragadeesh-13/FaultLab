# FaultLab — Hardware Fault Injection Simulation

FaultLab is an interactive, visual simulation demonstrating **physical hardware fault injection attacks** (such as Laser Fault Injection and voltage glitching) on public-key cryptosystems.

It demonstrates side-by-side why basic cryptosystems like **ElGamal** fail silently when subjected to physical bit flips, and how advanced schemes like **Cramer–Shoup** provably detect and prevent hardware tampering.

---

## 1. The Core Concept in Simple English

In traditional cryptography on paper, algorithms assume hardware runs in an ideal, tamper-proof environment. In the physical world, an attacker with physical access to a silicon microchip can introduce hardware perturbations:
- **Laser Fault Injection (LFI):** A microscope-focused infrared laser beam ionizes silicon substrate transistors, flipping a single stored bit from `0` to `1` or `1` to `0`.
- **Voltage / Clock Glitching:** A microsecond drop in supply voltage or an overclock pulse causes an ALU or register latch to capture an erroneous intermediate state.

### Why ElGamal Fails (0% Detection)
1. **Scrambled, but never sealed:** ElGamal locks a secret message so eavesdroppers cannot read it. However, it lacks an integrity checksum or verification tag.
2. **A laser flips a bit:** While the chip is decrypting, a laser pulse flips a single bit in the ciphertext or register memory.
3. **Blind calculation:** The chip has no way to check if anything changed. It blindly performs modular arithmetic on the corrupted bits.
4. **Silent failure:** The system outputs corrupted garbage or forged plaintext without warning. The receiver accepts the corrupted data, unaware that an attack occurred.

### How Cramer–Shoup Prevents It (100% Detection)
1. **Cryptographic security seal:** When Cramer–Shoup encrypts a message, it attaches a unique mathematical "proof tag" ($v$) that binds all parts of the ciphertext together using universal hashing.
2. **The laser flips a bit:** The attacker targets the chip with the exact same laser pulse, altering a bit in memory.
3. **The seal breaks immediately:** Before decrypting or releasing any plaintext, the chip independently recalculates what the proof tag should look like ($v'$). Because a bit was altered, $v' \ne v$.
4. **Instant abort:** The verification check fails. The chip immediately sounds an alarm, clears its registers, and aborts decryption without releasing any corrupted plaintext.

---

## 2. Interactive Features

1. **Interactive Silicon Die Floorplan**
   - Renders functional blocks on a silicon chip: *Modular Math ALU Core*, *Register Bank*, *Universal Hash Core*, and *Control Unit*.
   - Aim and click anywhere on the die to fire an animated laser pulse and trigger hardware fault injection.
2. **Digital Oscilloscope**
   - Real-time animated canvas monitoring the clock and core voltage supply rails.
   - Click the waveform to trigger an interactive voltage sag glitch.
3. **8-Bit Bit-Level Register Inspector**
   - Displays values in Hexadecimal, Decimal, and raw 8-bit binary (`00000000` to `11111111`).
   - Shows Hamming distance between original and corrupted states.
   - Click any individual bit to manually toggle it and observe the effect.
4. **Side-by-Side Mathematical Calculation Trace**
   - Displays the step-by-step decryption pipeline for both ElGamal and Cramer–Shoup simultaneously.
   - Every intermediate value is rendered as styled 8-bit binary streams with flipped bits highlighted in pulsing red.
   - Supports both ASCII text messages (e.g. `"HELLO"`, `"PASS"`) and direct integer inputs (e.g. `123`, `42`).

---

## 3. Mathematical Parameters (8-Bit Presentation Field)

To make every modular operation easy to trace and calculate by hand on a whiteboard, FaultLab uses an 8-bit safe prime:

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **Prime $p$** | `227` | Safe prime ($q = (p - 1)/2 = 113$ is also prime) |
| **Subgroup Order $q$** | `113` | Large prime order of subgroup $G_q$ |
| **Generator $g_1$** | `4` | Quadratic residue generator ($2^2 \pmod{227}$) |
| **Generator $g_2$** | `9` | Quadratic residue generator ($3^2 \pmod{227}$) |

### ElGamal Math:
- **Public Key:** $y = g^x \pmod p$ (where $x = 23$)
- **Ciphertext:** $c_1 = g^k \pmod p$, $c_2 = m \cdot y^k \pmod p$
- **Decryption:** $s = c_1^x \pmod p$, then $m = c_2 \cdot s^{-1} \pmod p$
- **Fault Impact:** If bit $k$ flips in $c_2$, $c_2' = c_2 \oplus 2^k$. Plaintext becomes $m' = c_2' \cdot s^{-1} \pmod p \ne m$. **No error is raised.**

### Cramer–Shoup Math:
- **Public Key:** $c = g_1^{x_1} g_2^{x_2} \pmod p$, $d = g_1^{y_1} g_2^{y_2} \pmod p$, $h = g_1^z \pmod p$
- **Ciphertext:** $(u_1, u_2, e, v)$ where $\alpha = H(u_1, u_2, e)$ and $v = c^k d^{k \alpha} \pmod p$
- **Verification & Decryption:**
  1. Recompute $\alpha = H(u_1, u_2, e)$
  2. Compute test tag: $v' = u_1^{x_1 + y_1 \alpha} \cdot u_2^{x_2 + y_2 \alpha} \pmod p$
  3. Verify: If $v \ne v'$, **REJECT AND ABORT**.
  4. Only if valid: $m = e \cdot u_1^{-z} \pmod p$.
- **Fault Impact:** If bit $k$ flips in $u_1$, $u_1' = u_1 \oplus 2^k \implies \alpha' \ne \alpha \implies v' \ne v$. **Decryption safely halts.**

---

## 4. Codebase Architecture

The codebase is designed to be minimal, clean, and self-contained with **zero external dependencies or build tools**:

```
.
├── index.html                 # Main entry point (Landing view + Simulator view)
├── README.md                  # Project documentation & explanation
├── css/
│   ├── main.css               # Global tokens, dark cyber theme, navbar
│   ├── cyber-theme.css        # Card containers, buttons, input controls
│   ├── hardware.css           # Silicon die canvas & digital oscilloscope layout
│   ├── comparative.css        # Side-by-side math trace & 8-bit stream tags
│   └── landing.css            # Landing page hero & simple English explanation cards
├── js/
│   ├── app.js                 # Application coordinator & event wiring
│   ├── crypto/
│   │   ├── bigmath.js         # BigInt modular arithmetic (modExp, extGCD, modInverse)
│   │   ├── elgamal.js         # 8-bit ElGamal implementation
│   │   └── cramershoup.js     # 8-bit Cramer-Shoup implementation with proof tag
│   ├── simulator/
│   │   ├── faults.js          # Hardware fault injection operators (bit flip, glitch)
│   │   └── runner.js          # Simulation execution coordinator (text & number modes)
│   └── ui/
│       ├── bitInspector.js    # Interactive 8-bit register inspector
│       ├── compareView.js     # Side-by-side calculation trace component
│       ├── dieCanvas.js       # Silicon die floorplan & laser animation canvas
│       └── oscilloscope.js    # Real-time clock & voltage waveform monitor
└── tests/
    └── test_crypto.js         # Standalone verification test suite (Node.js)
```

---

## 5. Running the Project

### In Any Web Browser:
No build step or `npm install` is required. You can serve the folder using any local static file server:

```bash
# Using Python 3:
python3 -m http.server 3000

# OR using Node.js:
npx serve -p 3000
```
Then open `http://localhost:3000` in your web browser.

### Running Cryptographic Verification Tests:
To verify the BigInt math and fault injection detection logic:

```bash
node tests/test_crypto.js
```
Expected output:
```
=== RUNNING FAULTLAB VERIFICATION TESTS ===

--- 1. BigMath ---
[PASS] modExp: 7^560 mod 561 = 1
[PASS] modInverse computation
[PASS] gcd(1071, 462) = 21
[PASS] Hamming distance

--- 2. ElGamal ---
[PASS] ElGamal normal encryption/decryption
[PASS] ElGamal silently outputs corrupted plaintext
[PASS] ElGamal has 0% detection of bit flip

--- 3. Cramer-Shoup ---
[PASS] Cramer-Shoup normal decryption passes
[PASS] Cramer-Shoup recovered plaintext correctly
[PASS] Cramer-Shoup catches corrupted bit and REJECTS
[PASS] Cramer-Shoup sets detected = true
[PASS] Cramer-Shoup withholds plaintext on tamper

ALL FAULTLAB TESTS PASSED!
```
