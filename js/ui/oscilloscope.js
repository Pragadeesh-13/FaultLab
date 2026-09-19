// Real-Time Oscilloscope Waveform Visualizer for Hardware Glitch Analysis
export class OscilloscopeCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    this.time = 0;
    this.glitchActive = false;
    this.glitchType = null; // 'clock' or 'voltage'
    this.glitchProgress = 0;

    this.startAnimation();
  }

  triggerGlitch(type = 'clock', durationMs = 800) {
    this.glitchActive = true;
    this.glitchType = type;
    this.glitchProgress = 0;

    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      this.glitchProgress = Math.min(1, elapsed / durationMs);

      if (this.glitchProgress < 1) {
        requestAnimationFrame(step);
      } else {
        this.glitchActive = false;
      }
    };
    requestAnimationFrame(step);
  }

  startAnimation() {
    const loop = () => {
      this.time += 0.05;
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark phosphor display background
    ctx.fillStyle = '#050c0a';
    ctx.fillRect(0, 0, w, h);

    // Oscilloscope Grid (Reticle)
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.lineWidth = 1;
    const divX = w / 10;
    const divY = h / 8;

    for (let x = 0; x <= w; x += divX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += divY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center cross ticks
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    const midX = w / 2;
    const midY = h / 2;
    for (let x = 0; x <= w; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, midY - 3);
      ctx.lineTo(x, midY + 3);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 10) {
      ctx.beginPath();
      ctx.moveTo(midX - 3, y);
      ctx.lineTo(midX + 3, y);
      ctx.stroke();
    }

    // Waveform 1: CH1 CLK (Clock Signal - Cyan / Amber when glitched)
    this.drawClockWaveform(ctx, w, h);

    // Waveform 2: CH2 VDD (Supply Voltage - Green / Red when glitched)
    this.drawVoltageWaveform(ctx, w, h);

    // Readout Overlay
    this.drawOverlay(ctx, w, h);
  }

  drawClockWaveform(ctx, w, h) {
    const baseY = h * 0.32;
    const clkAmp = h * 0.16;
    const period = 50;

    const isClockGlitched = this.glitchActive && this.glitchType === 'clock';

    ctx.strokeStyle = isClockGlitched ? '#f59e0b' : '#06b6d4';
    ctx.lineWidth = 2;
    ctx.shadowColor = isClockGlitched ? '#f59e0b' : '#06b6d4';
    ctx.shadowBlur = 6;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      let t = (x + this.time * 40) % period;

      // Inject glitch near middle of display if active
      let yOffset = 0;
      if (isClockGlitched && x > w * 0.45 && x < w * 0.55) {
        // Severe clock pulse shrink / runt pulse
        const glitchFactor = Math.sin((x - w * 0.45) / (w * 0.1) * Math.PI);
        yOffset = clkAmp * 0.8 * glitchFactor;
      }

      const high = t < (period / 2);
      const targetY = high ? baseY - clkAmp + yOffset : baseY + clkAmp - yOffset;

      if (x === 0) {
        ctx.moveTo(x, targetY);
      } else {
        ctx.lineTo(x, targetY);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawVoltageWaveform(ctx, w, h) {
    const baseY = h * 0.72;
    const isVoltageGlitched = this.glitchActive && this.glitchType === 'voltage';

    ctx.strokeStyle = isVoltageGlitched ? '#ef4444' : '#10b981';
    ctx.lineWidth = 2;
    ctx.shadowColor = isVoltageGlitched ? '#ef4444' : '#10b981';
    ctx.shadowBlur = 6;
    ctx.beginPath();

    for (let x = 0; x < w; x++) {
      let noise = (Math.random() - 0.5) * 2;
      let drop = 0;

      if (isVoltageGlitched && x > w * 0.42 && x < w * 0.58) {
        // Voltage dip spike
        const dipFactor = Math.sin((x - w * 0.42) / (w * 0.16) * Math.PI);
        drop = (h * 0.28) * dipFactor * (1 - Math.abs(this.glitchProgress - 0.5) * 1.5);
      }

      const y = baseY + drop + noise;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  drawOverlay(ctx, w, h) {
    ctx.font = '10px "JetBrains Mono", monospace';

    // Channel 1 Status
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('CH1: CLK 50MHz [1.8Vpp]', 12, 18);

    // Channel 2 Status
    ctx.fillStyle = '#10b981';
    ctx.fillText('CH2: VDD Rail 1.20V', 12, 32);

    // Timebase
    ctx.fillStyle = '#64748b';
    ctx.fillText('TB: 10ns/div  TRIG: EXT-RISING', w - 180, 18);

    if (this.glitchActive) {
      ctx.fillStyle = this.glitchType === 'clock' ? '#f59e0b' : '#ef4444';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(`FAULT TRIGGERED: ${this.glitchType.toUpperCase()} ANOMALY`, w - 240, 34);
    }
  }
}
