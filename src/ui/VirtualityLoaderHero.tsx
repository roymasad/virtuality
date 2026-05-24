import { useEffect, useRef } from "react";

export function VirtualityLoaderHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let raf = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, Math.floor(rect.width * dpr));
      const height = Math.max(220, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      resize();

      const width = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
      const height = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
      const centerX = width * 0.5;
      const animationCenterY = height * 0.48;
      const titleY = height * 0.23;
      const t = frame / 30;

      context.fillStyle = "#000";
      context.fillRect(0, 0, width, height);

      context.save();
      context.globalCompositeOperation = "lighter";
      for (let index = 0; index < 72; index += 1) {
        const phase = t * 1.6 + index * 0.19;
        const radius = Math.min(width, height) * (0.16 + index * 0.0025);
        const ax = centerX + Math.cos(phase) * radius;
        const ay = animationCenterY + Math.sin(phase * 0.7) * radius * 0.62;
        const bx = centerX + Math.cos(phase + 1.8) * radius * 0.8;
        const by = animationCenterY + Math.sin(phase + 1.2) * radius * 0.54;

        context.strokeStyle = `hsla(${((index / 72 + t * 0.05) % 1) * 360}, 90%, 58%, 0.72)`;
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(ax, ay);
        context.lineTo(bx, by);
        context.stroke();
      }
      context.restore();

      const titleSize = Math.max(34, Math.min(width, height) * 0.16);
      context.font = `700 ${titleSize}px "Courier New", monospace`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.shadowColor = "#70ff8b";
      context.shadowBlur = 28;
      context.fillStyle = "#d7ffdf";
      context.fillText("VIRTUALITY", centerX, titleY);
      context.shadowBlur = 0;
      context.fillStyle = "#70ff8b";
      context.fillText("VIRTUALITY", centerX, titleY);

      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="virtuality-loader-hero" aria-label="Animated Virtuality loader" />;
}
