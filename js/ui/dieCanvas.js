// Interactive Silicon Die Canvas with Laser Fault Injection (LFI) Targeting
export class SiliconDieCanvas {
  constructor(canvasElement, onTargetSelected = null) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onTargetSelected = onTargetSelected;

    this.laserX = 260;
    this.laserY = 180;
    this.laserRadius = 18;
    this.isFiring = false;
    this.fireProgress = 0;
    this.shockwaveRadius = 0;
    this.particles = [];

    // Chip Functional Blocks Floorplan (x, y, w, h in canvas coordinates)
    this.blocks = [
      {
        id: 'alu_core',
        name: 'Modular Math ALU Core',
        desc: 'Montgomery multiplier & modular exponentiation pipeline',
        x: 60, y: 70, w: 220, h: 140,
        color: '#0ea5e9',
        targetStages: { elgamal: 'elg_shared', cramershoup: 'cs_verify' }
      },
      {
        id: 'reg_bank',
        name: 'Register Bank & Buffers',
        desc: 'Intermediate state registers & ciphertext memory latches',
        x: 300, y: 70, w: 180, h: 140,
        color: '#8b5cf6',
        targetStages: { elgamal: 'elg_out', cramershoup: 'cs_out' }
      },
      {
        id: 'hash_engine',
        name: 'Universal Hash & MAC Core',
        desc: 'Hardware hash accelerator for Cramer–Shoup verification',
        x: 60, y: 230, w: 220, h: 110,
        color: '#10b981',
        targetStages: { elgamal: 'elg_c1', cramershoup: 'cs_hash' }
      },
      {
        id: 'control_gate',
        name: 'Control Unit & Branch Logic',
        desc: 'Instruction decoder and conditional branch evaluator',
        x: 300, y: 230, w: 180, h: 110,
        color: '#f59e0b',
        targetStages: { elgamal: 'elg_c2', cramershoup: 'cs_branch' }
      }
    ];

    this.activeBlock = null;
    this.initEvents();
    this.startRenderLoop();
  }

  initEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.laserX = (e.clientX - rect.left) * scaleX;
      this.laserY = (e.clientY - rect.top) * scaleY;
      this.updateActiveBlock();
    });

    this.canvas.addEventListener('click', (e) => {
      // First notify the app about the click (triggers fault logic)
      if (this.onTargetSelected) {
        this.onTargetSelected(this.activeBlock, {
          x: Math.round(this.laserX),
          y: Math.round(this.laserY)
        });
      }
      // The app's triggerHardwareGlitch will call fireLaser() for the animation
    });
  }

  updateActiveBlock() {
    this.activeBlock = null;
    for (const block of this.blocks) {
      if (
        this.laserX >= block.x &&
        this.laserX <= block.x + block.w &&
        this.laserY >= block.y &&
        this.laserY <= block.y + block.h
      ) {
        this.activeBlock = block;
        break;
      }
    }
  }

  fireLaser(durationMs = 600) {
    this.isFiring = true;
    this.fireProgress = 0;
    this.shockwaveRadius = 5;

    // Spawn ionization particles
    this.particles = [];
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x: this.laserX,
        y: this.laserY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03,
        color: Math.random() > 0.4 ? '#f43f5e' : '#38bdf8'
      });
    }

    const start = performance.now();
    const animateFire = (now) => {
      const elapsed = now - start;
      this.fireProgress = Math.min(1, elapsed / durationMs);
      this.shockwaveRadius = 5 + this.fireProgress * 45;

      if (this.fireProgress < 1) {
        requestAnimationFrame(animateFire);
      } else {
        this.isFiring = false;
      }
    };
    requestAnimationFrame(animateFire);
  }

  startRenderLoop() {
    const render = () => {
      this.draw();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear background: Deep semiconductor substrate
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    // Silicon wafer border
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Grid mesh lines (metallization layers)
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 20; x < w - 20; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, h - 20);
      ctx.stroke();
    }
    for (let y = 20; y < h - 20; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
    }

    // Bus traces connecting blocks
    this.drawBusLines(ctx);

    // Draw Functional Silicon Blocks
    for (const block of this.blocks) {
      const isTargeted = this.activeBlock && this.activeBlock.id === block.id;

      // Block background
      ctx.fillStyle = isTargeted ? 'rgba(30, 58, 138, 0.35)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(block.x, block.y, block.w, block.h);

      // Block border with glow if targeted
      ctx.strokeStyle = isTargeted ? block.color : 'rgba(71, 85, 105, 0.6)';
      ctx.lineWidth = isTargeted ? 2 : 1;
      if (isTargeted) {
        ctx.shadowColor = block.color;
        ctx.shadowBlur = 10;
      }
      ctx.strokeRect(block.x, block.y, block.w, block.h);
      ctx.shadowBlur = 0;

      // Internal circuit pattern lines
      this.drawCircuitPattern(ctx, block);

      // Block Label
      ctx.fillStyle = isTargeted ? '#38bdf8' : '#cbd5e1';
      ctx.font = 'bold 12px "Poppins", sans-serif';
      ctx.fillText(block.name, block.x + 12, block.y + 24);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px "Poppins", sans-serif';
      ctx.fillText(block.desc, block.x + 12, block.y + 40, block.w - 24);
    }

    // Interconnect Pads along border
    this.drawBondingPads(ctx, w, h);

    // Draw Ionization Particles
    if (this.particles.length > 0) {
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life > 0) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5 * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }
      this.particles = this.particles.filter(p => p.life > 0);
    }

    // Draw Laser Pulse and Shockwave
    if (this.isFiring) {
      // Expanding ionization ring
      ctx.beginPath();
      ctx.arc(this.laserX, this.laserY, this.shockwaveRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(244, 63, 94, ${1 - this.fireProgress})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Central beam flash
      const grad = ctx.createRadialGradient(
        this.laserX, this.laserY, 0,
        this.laserX, this.laserY, 30
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.3, 'rgba(244, 63, 94, 0.8)');
      grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.laserX, this.laserY, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Laser Targeting Reticle
    this.drawReticle(ctx, this.laserX, this.laserY);
  }

  drawBusLines(ctx) {
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 2;

    // Bus 1: ALU to Register Bank
    ctx.beginPath();
    ctx.moveTo(280, 120);
    ctx.lineTo(300, 120);
    ctx.stroke();

    // Bus 2: ALU to Hash Engine
    ctx.beginPath();
    ctx.moveTo(150, 210);
    ctx.lineTo(150, 230);
    ctx.stroke();

    // Bus 3: Register Bank to Control Gate
    ctx.beginPath();
    ctx.moveTo(390, 210);
    ctx.lineTo(390, 230);
    ctx.stroke();

    // Bus 4: Hash Engine to Control Gate
    ctx.beginPath();
    ctx.moveTo(280, 280);
    ctx.lineTo(300, 280);
    ctx.stroke();
  }

  drawCircuitPattern(ctx, block) {
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    for (let y = block.y + 55; y < block.y + block.h - 10; y += 12) {
      ctx.beginPath();
      ctx.moveTo(block.x + 12, y);
      ctx.lineTo(block.x + block.w - 12, y);
      ctx.stroke();
    }
  }

  drawBondingPads(ctx, w, h) {
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;

    // Top and bottom wire bonding pads
    for (let x = 40; x < w - 40; x += 35) {
      ctx.fillRect(x, 12, 18, 10);
      ctx.strokeRect(x, 12, 18, 10);
      ctx.fillRect(x, h - 22, 18, 10);
      ctx.strokeRect(x, h - 22, 18, 10);
    }
    // Left and right pads
    for (let y = 40; y < h - 40; y += 35) {
      ctx.fillRect(12, y, 10, 18);
      ctx.strokeRect(12, y, 10, 18);
      ctx.fillRect(w - 22, y, 10, 18);
      ctx.strokeRect(w - 22, y, 10, 18);
    }
  }

  drawReticle(ctx, x, y) {
    const r = this.laserRadius;
    ctx.save();

    // Crosshair lines
    ctx.strokeStyle = this.isFiring ? '#f43f5e' : '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - r - 8, y);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + r + 8, y);
    ctx.moveTo(x, y - r - 8);
    ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x, y + r + 8);
    ctx.stroke();

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = this.isFiring ? '#f43f5e' : 'rgba(56, 189, 248, 0.75)';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = this.isFiring ? '#f43f5e' : '#38bdf8';
    ctx.fill();

    // Coordinate readout
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText(`X:${Math.round(x)}µm Y:${Math.round(y)}µm`, x + r + 10, y - 6);

    ctx.restore();
  }
}
