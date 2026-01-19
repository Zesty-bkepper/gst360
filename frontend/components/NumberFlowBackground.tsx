import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  size: number;
  opacity: number;
  baseX: number;
  baseY: number;
}

const NumberFlowBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    // Increased particle count for denser clusters
    const particleCount = 120;
    // Expanded symbols to include more business, finance, and GST specific data points
    const symbols = [
      '360', '₹', '0', '1', '%', 'GST', 'TAX', 'INV', 'ITC', 'ROI', 'GSTR', 
      '18%', '28%', '12%', '5%', 'B2B', 'PAN', 'HSN', 'SAC', 'E-WAY', 
      '+2.4', 'FILING', 'AUDIT', 'LEDGER', 'CREDIT', 'DEBIT', '99.9', '24/7'
    ];

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];

      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.4, // Slower natural drift
          vy: (Math.random() - 0.5) * 0.4,
          text: symbols[Math.floor(Math.random() * symbols.length)],
          size: Math.random() * 10 + 9, // Slightly smaller for higher density
          opacity: Math.random() * 0.12 + 0.03, // Subtle intentionality
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Natural floating movement
        p.x += p.vx;
        p.y += p.vy;

        // Mouse interaction: Magnetic attraction
        if (mouse.current.active) {
          const dx = mouse.current.x - p.x;
          const dy = mouse.current.y - p.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 350; // Increased radius of influence
          
          if (distance < maxDistance) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            // Stronger force as mouse gets closer, creating a "cluster" effect
            const force = (maxDistance - distance) / maxDistance;
            const strength = 4.5;

            p.x += forceDirectionX * force * strength;
            p.y += forceDirectionY * force * strength;
            
            // Jitter effect for "live data" feel when close to mouse
            if (distance < 100) {
              p.x += (Math.random() - 0.5) * 0.5;
              p.y += (Math.random() - 0.5) * 0.5;
            }
          }
        }

        // Return to base position with subtle elastic behavior
        const dxBase = p.baseX - p.x;
        const dyBase = p.baseY - p.y;
        p.x += dxBase * 0.015;
        p.y += dyBase * 0.015;

        // Soft wrap-around boundaries instead of bouncing for a "flow" feel
        if (p.x < -50) p.x = canvas.width + 50;
        if (p.x > canvas.width + 50) p.x = -50;
        if (p.y < -50) p.y = canvas.height + 50;
        if (p.y > canvas.height + 50) p.y = -50;

        // Update base positions slowly to keep the background alive
        p.baseX += p.vx * 0.2;
        p.baseY += p.vy * 0.2;

        // Draw
        ctx.font = `600 ${p.size}px "Inter", "SF Mono", monospace`;
        ctx.fillStyle = `rgba(37, 99, 235, ${p.opacity})`;
        ctx.fillText(p.text, p.x, p.y);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      mouse.current.active = true;
    };

    const handleMouseLeave = () => {
      mouse.current.active = false;
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);
    
    init();
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
};

export default NumberFlowBackground;