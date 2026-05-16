import { useEffect, useRef, useState } from "react";

const DEG = Math.PI / 180;
const CONTACT_MEMORY_SECONDS = 180;
const CONTACT_PLOT_FADE_SECONDS = 150;
const CONTACT_BASE_ERROR_M = 90;
const CONTACT_ERROR_GROWTH_MPS = 12;


const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Extraction checkpoint: ship + vectors rendering migrates before App.jsx import switch.
function drawShipAndVectors(ctx, canvas, {
  ship,
  zoom,
  orderedCourseDeg,
  courseKeepingEnabled,
  vectorsVisible,
}) {
  if (!ctx || !canvas || !ship) return;

  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;

  if (vectorsVisible) {
    const vectorLength = Math.max(ship.speedKn * 22 * zoom, 40);

    ctx.save();
    ctx.translate(centerX, centerY);

    // Actual movement vector.
    ctx.rotate(ship.headingDeg * DEG);
    ctx.strokeStyle = "rgba(255, 210, 120, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -vectorLength);
    ctx.stroke();

    // Ordered heading vector.
    if (courseKeepingEnabled) {
      ctx.rotate((orderedCourseDeg - ship.headingDeg) * DEG);
      ctx.strokeStyle = "rgba(120, 220, 255, 0.92)";
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -vectorLength * 0.9);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // HMS Grafton chart symbol.
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(ship.headingDeg * DEG);

  const shipLengthPx = Math.max(112 * zoom, 18);
  const shipBeamPx = Math.max(14 * zoom, 4);

  ctx.fillStyle = "rgba(18, 28, 36, 0.96)";
  ctx.strokeStyle = "rgba(210, 230, 240, 0.82)";
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.moveTo(0, -shipLengthPx * 0.55);
  ctx.lineTo(shipBeamPx, shipLengthPx * 0.25);
  ctx.lineTo(0, shipLengthPx * 0.55);
  ctx.lineTo(-shipBeamPx, shipLengthPx * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Extraction checkpoint: sea + grid rendering migrates before the full chart renderer.
function drawSeaAndGrid(ctx, canvas, { ship, zoom, panOffset, mapTheme }) {
  if (!ctx || !canvas || !ship) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.save();

  ctx.fillStyle = mapTheme === "paper"
    ? "rgb(226, 219, 198)"
    : "rgb(16, 38, 58)";

  ctx.fillRect(0, 0, width, height);

  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const gridSpacing = Math.max(120 * zoom, 40);

  const originX = centerX + (-ship.x * zoom + panOffset.x);
  const originY = centerY + (-ship.y * zoom + panOffset.y);

  ctx.strokeStyle = mapTheme === "paper"
    ? "rgba(80, 64, 42, 0.22)"
    : "rgba(120, 180, 210, 0.12)";

  ctx.lineWidth = 1;

  for (let x = originX % gridSpacing; x < width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = originY % gridSpacing; y < height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

// Extraction checkpoint: cloud rendering migrates before the full chart renderer.
function drawCloudLayer(ctx, canvas, { ship, zoom, panOffset, environment }) {
  if (!ctx || !canvas || !ship) return;

  const cloudCover = environment?.cloudCover ?? 0.4;
  if (cloudCover <= 0.02) return;

  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.5;

  const layerCount = 3;

  for (let layer = 0; layer < layerCount; layer += 1) {
    const altitudeFactor = 0.72 + layer * 0.28;
    const parallax = 0.10 + layer * 0.12;
    const baseSize = (42 + layer * 28) * zoom * altitudeFactor;
    const opacity = (0.10 + layer * 0.06) * cloudCover;

    const driftX = (-ship.x * zoom + panOffset.x) * parallax;
    const driftY = (-ship.y * zoom + panOffset.y) * parallax;

    for (let i = 0; i < 5; i += 1) {
      const seedX = ((i * 263) + layer * 411) % 1400;
      const seedY = ((i * 337) + layer * 197) % 900;

      const x = centerX + driftX + seedX - 700;
      const y = centerY + driftY + seedY - 450;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((i * 19) + layer * 11) * DEG);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "rgba(255,255,255,0.85)";

      for (let q = 0; q < 4; q += 1) {
        const offset = (q - 1.5) * baseSize * 0.58;
        ctx.fillRect(offset, offset * 0.35, baseSize, baseSize);
      }

      ctx.restore();
    }
  }
}

// Canvas-only ASDIC plot renderer extracted from App.jsx.
// This is a tactical chart-table estimate, not the operator's ASDIC display.
function drawAsdicContactPlot(ctx, { ship, zoom, contactPlot, centerX, centerY }) {
  if (!ctx || !ship || !contactPlot) return;

  const plotAge = ship.simTime - contactPlot.lastUpdateTime;
  if (plotAge > CONTACT_MEMORY_SECONDS) return;

  const confidence = clamp(1 - plotAge / CONTACT_PLOT_FADE_SECONDS, 0, 1);
  const plotX = centerX + (contactPlot.x - ship.x) * zoom;
  const plotY = centerY + (contactPlot.y - ship.y) * zoom;
  const errorRadiusM = CONTACT_BASE_ERROR_M + plotAge * CONTACT_ERROR_GROWTH_MPS;
  const errorX = Math.max(errorRadiusM * zoom * 1.35, 14);
  const errorY = Math.max(errorRadiusM * zoom * 0.70, 8);
  const plotAngle = (contactPlot.bearingDeg - 90) * DEG;

  ctx.save();
  ctx.translate(plotX, plotY);
  ctx.rotate(plotAngle);
  ctx.globalAlpha = 0.34 + confidence * 0.58;
  ctx.strokeStyle = "rgba(134, 239, 172, 0.94)";
  ctx.fillStyle = "rgba(134, 239, 172, 0.14)";
  ctx.lineWidth = 2.2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.ellipse(0, 0, errorX, errorY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(187, 247, 208, 0.96)";
  ctx.beginPath();
  ctx.rect(-5, -5, 10, 10);
  ctx.fill();

  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`ASDIC PLOT ${Math.round(confidence * 100)}%`, errorX + 8, 0);
  ctx.restore();
}

/**
 * ChartTable canvas renderer extraction target.
 *
 * Refactor status:
 * - This component now has the same public props contract as the in-file App.jsx ChartTable.
 * - It is still intentionally not imported by App.jsx.
 * - ASDIC plot and cloud rendering helpers are now extracted here.
 * - ASDIC plot, clouds, sea, grid, ship and vector rendering helpers are now extracted here.
 * - Next safe step: switch App.jsx import to this extracted ChartTable renderer.
 */

export default function ChartTable({
  ship,
  zoom,
  setZoom,
  environment,
  controls,
  orderedCourseDeg,
  courseInput,
  courseKeepingEnabled,
  vectorsVisible,
  asdicVisible,
  asdicContact,
  contactPlot,
  ringVisible,
  ringAge,
  submarine,
  mapTheme,
}) {
  const canvasRef = useRef(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Extraction checkpoint only.
    // The real renderer still lives in App.jsx until all drawing helpers are moved here.
    // Keeping this file unmounted prevents accidental gameplay regressions during refactor.
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawSeaAndGrid(ctx, canvas, {
      ship,
      zoom,
      panOffset,
      mapTheme,
    });

    drawCloudLayer(ctx, canvas, {
      ship,
      zoom,
      panOffset,
      environment,
    });

    drawShipAndVectors(ctx, canvas, {
      ship,
      zoom,
      orderedCourseDeg,
      courseKeepingEnabled,
      vectorsVisible,
    });

    // Extraction checkpoint: real ASDIC plot renderer moved out of App.jsx.
    drawAsdicContactPlot(ctx, {
      ship,
      zoom,
      contactPlot,
      centerX: canvas.width * 0.5,
      centerY: canvas.height * 0.5,
    });
  }, [
    ship,
    zoom,
    environment,
    controls,
    orderedCourseDeg,
    courseInput,
    courseKeepingEnabled,
    vectorsVisible,
    asdicVisible,
    asdicContact,
    contactPlot,
    ringVisible,
    ringAge,
    submarine,
    mapTheme,
    panOffset,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
      }}
      aria-label="Chart table renderer extraction placeholder"
    />
  );
}
