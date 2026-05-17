
import { drawCloudLayer as drawCloudLayerExternal } from "./renderers/cloudRenderer";
import React, { useEffect, useMemo, useRef, useState } from "react";
import CompassPanel from "./Components/CompassPanel";
import DraggablePanel from "./Components/DraggablePanel";

import WeatherPanel from "./Components/WeatherPanel";
import MapLayersPanel from "./Components/MapLayersPanel";
import AsdicPanel from "./Components/AsdicPanel";

import DevelopmentPanel from "./Components/DevelopmentPanel";
import SimulationLog from "./Components/SimulationLog";


/**
 * Refactor checkpoint:
 * - App.jsx is too large for safe patching, so refactor must happen in small, reversible steps.
 * - First extraction target: canvas renderers, but do not switch the whole ChartTable yet.
 * - Current source of truth: local ChartTable in App.jsx.
 * - Safe extraction path: move pure helper functions first, one by one.
 * - Next external file target: src/renderers/cloudRenderer.js.
 * - App.jsx should remain responsible for state, simulation loop and composition.
 */

const KNOT_TO_MPS = 0.514444;
const MPS_TO_KNOT = 1 / KNOT_TO_MPS;
const DEG = Math.PI / 180;
const MIN_SHIP_MARKER_SCALE = 0.22;
const MAX_SHIP_MARKER_SCALE = 1.35;
const SHIP_MARKER_BASE_ZOOM = 0.22;
const UI_SNAP_GRID_PX = 12;
const snapUiSize = (value) => Math.round(value / UI_SNAP_GRID_PX) * UI_SNAP_GRID_PX;
const PANEL_HEIGHT_GRID_PX = 24;

const MISSION_DATE_LABEL = "18 March 1943";
const MISSION_AREA_LABEL = "Western Approaches gap · HX 229 / SC 122 crisis area";

const MISSION_COORD_LABEL = "52°00′N 34°00′W";

const MISSION_AIR_TEMP_C = 4;

const MISSION_WATER_TEMP_C = 6;

const MISSION_OVERBOARD_NOTE =

  "Cold-water collapse risk: 30–60 min; survival often 1–3 h without rescue";
const getCameraAltitudeM = (zoom) => Math.round(2600 / Math.max(zoom, 0.01));

const getDaylightFactor = (simTime) => {
  const daySeconds = ((simTime % 86400) + 86400) % 86400;
  const hour = daySeconds / 3600;
  return clamp(Math.sin(((hour - 6) / 12) * Math.PI), 0, 1);
};

function computeVisualRangeM(ship, environment) {
  // WWII escort bridge lookout height approximation.
  // Geographic horizon in km ≈ 3.57 * sqrt(observer height in metres).
  const bridgeEyeHeightM = 12;
  const horizonM = 3570 * Math.sqrt(bridgeEyeHeightM);
  const daylight = getDaylightFactor(ship.simTime);
  const cloudPenalty = 1 - clamp((environment.cloudCoverOktas ?? 0) / 8, 0, 1) * 0.22;
  const seaPenalty = 1 - clamp(environment.seaIndex / 4, 0, 1) * 0.16;
  const nightPenalty = 0.26 + daylight * 0.74;

  return Math.round(horizonM * cloudPenalty * seaPenalty * nightPenalty);
}

function computeTurningDiameterM(ship, controls, environment) {
  const sea = SEA_STATES[environment.seaIndex];
  const speedMps = Math.abs(ship.speedMps);
  const speedFactor = clamp(speedMps / (GRAFTON.maxSpeedKn * KNOT_TO_MPS), 0, 1);
  const rudderFactor = Math.abs(controls.rudderDeg) / GRAFTON.maxRudderDeg;
  const turnRateDeg = 4.8 * sea.handling * rudderFactor * Math.pow(speedFactor, 0.72);

  if (speedMps < 0.2 || turnRateDeg < 0.05) return null;

  const turnRateRad = turnRateDeg * DEG;
  const radiusM = speedMps / turnRateRad;
  return radiusM * 2;
}

const GRAFTON = {
  name: "HMS Grafton",
  pennant: "L83",
  className: "Hunt-class Type III Escort Destroyer",
  motto: "Seek in Silence, Strike with Certainty",
  lengthM: 85.3,
  beamM: 10.16,
  maxSpeedKn: 29,
  maxRudderDeg: 35,
  tacticalDiameterM: 640, // early gameplay approximation; later replace with researched data
  acceleration: 0.032, // m/s² simplified steam plant response
  deceleration: 0.045,
};

const TELEGRAPH = [
  { label: "Full Astern", shortLabel: "Full Astern", targetKn: -8 },
  { label: "Half Astern", shortLabel: "Half Astern", targetKn: -5 },
  { label: "Slow Astern", shortLabel: "Slow Astern", targetKn: -3 },
  { label: "Dead Slow Astern", shortLabel: "Dead Slow Astern", targetKn: -1.5 },
  { label: "Stop", shortLabel: "Stop", targetKn: 0 },
  { label: "Dead Slow Ahead", shortLabel: "Dead Slow", targetKn: 4 },
  { label: "Slow Ahead", shortLabel: "Slow", targetKn: 8 },
  { label: "Half Ahead", shortLabel: "Half", targetKn: 14 },
  { label: "Full Ahead", shortLabel: "Full", targetKn: 22 },
  { label: "Emergency Ahead", shortLabel: "Emergency", targetKn: 29 },
];

const SEA_STATES = [
  { label: "0 Calm", drift: 0.00, handling: 1.0, note: "glassy sea" },
  { label: "2 Smooth", drift: 0.03, handling: 0.98, note: "low swell" },
  { label: "4 Moderate", drift: 0.08, handling: 0.92, note: "whitecaps" },
  { label: "6 Rough", drift: 0.16, handling: 0.78, note: "heavy Atlantic roll" },
  { label: "8 Very High", drift: 0.28, handling: 0.58, note: "survival weather" },
];

const CONTACT_QUALITY = ["NONE", "WEAK", "FAINT", "GOOD", "STRONG"];
const ASDIC_ECHO_HOLD_SECONDS = 7;
const ASDIC_PING_COOLDOWN_SECONDS = 6;
const ASDIC_RING_DURATION_SECONDS = 1.2;
const CONTACT_MEMORY_SECONDS = 90;
const CONTACT_PLOT_FADE_SECONDS = 75;
const CONTACT_BASE_ERROR_M = 90;
const CONTACT_ERROR_GROWTH_MPS = 12;

const DEFAULT_ASDIC_PING_STATE = {
  lastPingTime: null,
  contact: null,
  ringStartTime: null,
};

function getInitialSubmarineState() {
  return {
    x: 1800,
    y: -950,
    headingDeg: 210,
    speedKn: 3,
    depthM: 65,
  };
}
function buildContactPlot(ship, contact, simTime) {
  const bearing = headingToVector(contact.bearingDeg);

  return {
    x: ship.x + bearing.x * contact.distanceM,
    y: ship.y + bearing.y * contact.distanceM,
    bearingDeg: contact.bearingDeg,
    distanceM: contact.distanceM,
    strength: contact.strength,
    quality: contact.quality,
    lastUpdateTime: simTime,
  };
}

function computeAsdicContact(ship, submarine, environment) {
  const dx = submarine.x - ship.x;
  const dy = submarine.y - ship.y;
  const distanceM = Math.hypot(dx, dy);
  const bearingDeg = wrapAngleDeg((Math.atan2(dy, dx) / DEG) + 90);

  const relativeBearing = Math.abs(signedAngleDiffDeg(ship.headingDeg, bearingDeg));
  const inArc = relativeBearing <= 58 && distanceM > 120;

  const ownSpeedKn = Math.abs(ship.speedMps * MPS_TO_KNOT);
  const speedPenalty = clamp((ownSpeedKn - 12) / 16, 0, 1);
  const seaPenalty = environment.seaIndex * 0.12;
  const rangePenalty = clamp(distanceM / 3200, 0, 1);
  const blindZonePenalty = distanceM < 240 ? clamp((240 - distanceM) / 120, 0, 1) : 0;
  const depthPenalty = clamp((submarine.depthM - 40) / 140, 0, 1);

  let strength = 1;
  strength -= speedPenalty;
  strength -= seaPenalty;
  strength -= rangePenalty;
  strength -= depthPenalty;
  strength -= blindZonePenalty;
  if (!inArc) strength = 0;

  strength = clamp(strength, 0, 1);
  const qualityIndex = Math.round(strength * 4);

  return {
    detected: strength > 0.12,
    strength,
    quality: CONTACT_QUALITY[qualityIndex],
    bearingDeg,
    distanceM,
  };
}


function drawSeaTexture(ctx, w, h, ship, zoom, environment) {
  const sea = SEA_STATES[environment.seaIndex];
  const intensity = environment.seaIndex / Math.max(SEA_STATES.length - 1, 1);
  if (intensity <= 0.01) return;

  const waveSpacingMeters = clamp(260 - intensity * 170, 70, 260);
  const waveSpacingPx = clamp(waveSpacingMeters * zoom, 18, 110);
  const waveLengthPx = clamp((90 + intensity * 90) * zoom, 28, 150);
  const waveAmplitude = 2 + intensity * 7;
  const lineCount = Math.ceil((w + h) / waveSpacingPx) + 8;
  const wind = headingToVector(environment.windDirDeg);
  const waveAngle = Math.atan2(wind.y, wind.x) + Math.PI / 2;
  const phase = ship.simTime * (0.25 + intensity * 0.75);

  ctx.save();
  ctx.globalAlpha = 0.08 + intensity * 0.18;
  ctx.strokeStyle = intensity > 0.65 ? "rgba(70, 89, 92, 0.95)" : "rgba(63, 78, 82, 0.85)";
  ctx.lineWidth = 0.75 + intensity * 1.25;
  ctx.translate(w / 2, h / 2);
  ctx.rotate(waveAngle);

  for (let i = -lineCount; i < lineCount; i += 1) {
    const y = i * waveSpacingPx + ((phase * 18) % waveSpacingPx) - waveSpacingPx;
    const xStart = -w * 0.9;
    const xEnd = w * 0.9;
    ctx.beginPath();
    for (let x = xStart; x <= xEnd; x += 18) {
      const wave = Math.sin((x / Math.max(waveLengthPx, 1)) * Math.PI * 2 + phase + i * 0.7) * waveAmplitude;
      const jitter = Math.sin((x / 37) + phase * 0.6 + i) * intensity * 2.5;
      const px = x;
      const py = y + wave + jitter;
      if (x === xStart) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  if (intensity > 0.55) {
    ctx.globalAlpha = 0.035 + intensity * 0.07;
    ctx.lineWidth = 1;
    for (let i = -lineCount; i < lineCount; i += 2) {
      const y = i * waveSpacingPx + ((phase * 25) % waveSpacingPx) - waveSpacingPx;
      ctx.beginPath();
      ctx.moveTo(-w * 0.9, y + Math.sin(phase + i) * 6);
      ctx.lineTo(w * 0.9, y + Math.cos(phase * 0.7 + i) * 6);
      ctx.stroke();
    }
  }

  ctx.restore();
}
function AutoPanel({ children, minHeight = 72 }) {
  const contentRef = React.useRef(null);
  const [height, setHeight] = React.useState(minHeight);

  React.useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const updateHeight = () => {
      const measuredHeight = element.scrollHeight + 8;
      const nextHeight = Math.max(
        minHeight,
        Math.ceil(measuredHeight / PANEL_HEIGHT_GRID_PX) * PANEL_HEIGHT_GRID_PX
      );
      setHeight(nextHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [minHeight]);

  return (
    <div style={{ ...panelStyle, height }}>
      <div ref={contentRef}>{children}</div>
    </div>
  );
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapAngleDeg(angle) {
  let a = angle % 360;
  if (a < 0) a += 360;
  return a;
}

function headingToVector(headingDeg) {
  const rad = (headingDeg - 90) * DEG;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600) % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function bearingLabel(deg) {
  return `${Math.round(wrapAngleDeg(deg)).toString().padStart(3, "0")}°`;
}

function playAsdicSound(contact) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const now = ctx.currentTime;

  const makePing = (startTime, frequency = 1450, gainValue = 0.16, duration = 0.09) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, startTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.08, startTime + duration * 0.55);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, startTime);
    filter.Q.setValueAtTime(9, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(gainValue, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  };

  // Initial active ASDIC ping.
  makePing(now, 1500, 0.18, 0.085);

  // Echo: delayed, quieter, slightly lower tone.
  if (contact?.detected) {
    // Real ASDIC echo is heard after the sound travels to the target and back.
    // For gameplay we compress the delay, but keep it range-dependent.
    const realRoundTripSeconds = (contact.distanceM * 2) / 1500;
    const echoDelay = clamp(realRoundTripSeconds * 0.24, 0.22, 1.15);
    const echoGain = clamp(0.035 + contact.strength * 0.11, 0.035, 0.14);
    makePing(now + echoDelay, 1180 + contact.strength * 260, echoGain, 0.12);
  }

  window.setTimeout(() => ctx.close(), 1600);
}

function signedAngleDiffDeg(fromDeg, toDeg) {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

function computeCourseKeepingRudder(ship, orderedCourseDeg) {
  const diff = signedAngleDiffDeg(ship.headingDeg, orderedCourseDeg);
  if (Math.abs(diff) < 1) return 0;
  return Math.round(clamp(diff * 1.15, -GRAFTON.maxRudderDeg, GRAFTON.maxRudderDeg));
}

function getEffectiveControls(ship, controls, orderedCourseDeg, courseKeepingEnabled) {
  if (!courseKeepingEnabled || orderedCourseDeg === null || !Number.isFinite(orderedCourseDeg)) {
    return controls;
  }
  return {
    ...controls,
    rudderDeg: computeCourseKeepingRudder(ship, orderedCourseDeg),
  };
}

function chooseGridSpacingMeters(zoom) {
  const desiredPx = 72;
  const rawMeters = desiredPx / Math.max(zoom, 0.001);
  const steps = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  return steps.find((step) => step >= rawMeters) || steps[steps.length - 1];
}

function useAnimationFrame(callback) {
  const requestRef = useRef();
  const previousTimeRef = useRef();

  useEffect(() => {
    const animate = (time) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = (time - previousTimeRef.current) / 1000;
        callback(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [callback]);
}

function simulateShip(ship, controls, environment, dt) {
  const sea = SEA_STATES[environment.seaIndex];
  const targetMps = TELEGRAPH[controls.telegraphIndex].targetKn * KNOT_TO_MPS;
  const speedDelta = targetMps - ship.speedMps;
  const accel = speedDelta >= 0 ? GRAFTON.acceleration : GRAFTON.deceleration;
  const nextSpeed = ship.speedMps + clamp(speedDelta, -accel * dt, accel * dt);

  const rudder = controls.rudderDeg;
  const speedFactor = clamp(Math.abs(nextSpeed) / (GRAFTON.maxSpeedKn * KNOT_TO_MPS), 0, 1);
  const rudderFactor = rudder / GRAFTON.maxRudderDeg;
  const asternFactor = nextSpeed < 0 ? -0.45 : 1;

  // Simplified turn model: at higher speed and rudder angle, ship turns more quickly.
  // Astern steering is weaker and effectively reverses the response.
  // Later: replace with hull-specific tactical diameter and response lag.
  const maxTurnRateDeg = 4.8 * sea.handling;
  const turnRate = maxTurnRateDeg * rudderFactor * Math.pow(speedFactor, 0.72) * asternFactor;
  const heading = wrapAngleDeg(ship.headingDeg + turnRate * dt);

  const forward = headingToVector(heading);
  const wind = headingToVector(environment.windDirDeg);
  const windStrength = environment.windKn * KNOT_TO_MPS;
  const driftMps = sea.drift * windStrength;

  const dx = (forward.x * nextSpeed + wind.x * driftMps) * dt;
  const dy = (forward.y * nextSpeed + wind.y * driftMps) * dt;

  const rollDeg = Math.sin(ship.simTime * 0.65) * environment.seaIndex * 0.9;
  const pitchDeg = Math.sin(ship.simTime * 0.47 + 1.2) * environment.seaIndex * 0.45;

  const nextSimTime = ship.simTime + dt;
  const nextTrail = [...(ship.trail || []), { x: ship.x + dx, y: ship.y + dy, t: nextSimTime }]
    .filter((point) => nextSimTime - point.t <= 60)
    .slice(-900);

  return {
    ...ship,
    x: ship.x + dx,
    y: ship.y + dy,
    trail: nextTrail,
    speedMps: nextSpeed,
    headingDeg: heading,
    turnRateDeg: turnRate,
    rollDeg,
    pitchDeg,
    simTime: nextSimTime,
  };
}

function predictShipTrack(
  ship,
  controls,
  environment,
  seconds = 30,
  orderedCourseDeg = null,
  courseKeepingEnabled = false
) {
  const points = [];
  let ghost = {
    x: ship.x,
    y: ship.y,
    headingDeg: ship.headingDeg,
    speedMps: ship.speedMps,
    turnRateDeg: ship.turnRateDeg,
    rollDeg: ship.rollDeg,
    pitchDeg: ship.pitchDeg,
    simTime: ship.simTime,
    trail: [],
  };

  const step = 0.25;
  const steps = Math.ceil(seconds / step);
  for (let i = 0; i <= steps; i += 1) {
    const effectiveControls = getEffectiveControls(
      ghost,
      controls,
      orderedCourseDeg,
      courseKeepingEnabled
    );
    points.push({
      x: ghost.x,
      y: ghost.y,
      headingDeg: ghost.headingDeg,
      rudderDeg: effectiveControls.rudderDeg,
    });
    ghost = simulateShip(ghost, effectiveControls, environment, step);
  }
  return points;
}

// TODO(refactor): Move this whole canvas renderer to src/components/ChartTable.jsx.
// Keep the current implementation here until the new file exists and imports are wired.
function ChartTable({ ship, zoom, setZoom, environment, controls, orderedCourseDeg, courseInput, courseKeepingEnabled, vectorsVisible, asdicVisible, asdicContact, contactPlot, ringVisible, ringAge, submarine, mapTheme, mapInfoVisible, visualRangeVisible, legendVisible, asdicMode, asdicSearchArcDeg, asdicSearchDirectionDeg }) {
  const canvasRef = useRef(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    // Cap DPR to prevent heavy canvas redraws from crashing Chromium on high-DPI displays.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const chartColors = mapTheme === "atlantic"
      ? {
          background: "#173746",
          grid: "#8fb3bd",
          gridText: "rgba(196, 225, 226, 0.68)",
          text: "#d7ecec",
          darkText: "#10252f",
          scale: "#c4e1e2",
        }
      : {
          background: "#d8c49c",
          grid: "#6f5f43",
          gridText: "rgba(72, 59, 43, 0.70)",
          text: "#24313a",
          darkText: "#24313a",
          scale: "#483b2b",
        };

    // Chart paper background
    ctx.fillStyle = chartColors.background;
    ctx.fillRect(0, 0, w, h);

    // Animated sea texture under the chart grid.
    if (environment.wavesVisible) {
      drawSeaTexture(ctx, w, h, ship, zoom, environment);
    }

    // Subtle paper grain/grid — world-space grid, scaled by zoom
    ctx.globalAlpha = mapTheme === "atlantic" ? 0.18 : 0.16;
    ctx.strokeStyle = chartColors.grid;
    ctx.lineWidth = 1;
    const gridMeters = chooseGridSpacingMeters(zoom) * 2;
    const gridPx = gridMeters * zoom;
    const gridOriginX = w / 2 + panOffset.x - ship.x * zoom;
    const gridOriginY = h / 2 + panOffset.y - ship.y * zoom;
    const gridOffsetX = ((gridOriginX % gridPx) + gridPx) % gridPx;
    const gridOffsetY = ((gridOriginY % gridPx) + gridPx) % gridPx;

    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = chartColors.gridText;

    for (let x = gridOffsetX; x < w + gridPx; x += gridPx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      const worldX = Math.round((x - gridOriginX) / zoom);
      ctx.globalAlpha = 1;
      ctx.fillText(`${worldX}m`, x + 4, 14);
      ctx.fillText(`${worldX}m`, x + 4, h - 8);
      ctx.globalAlpha = mapTheme === "atlantic" ? 0.18 : 0.16;
    }
    for (let y = gridOffsetY; y < h + gridPx; y += gridPx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      const worldY = Math.round((y - gridOriginY) / zoom);
      ctx.globalAlpha = 1;
      ctx.fillText(`${worldY}m`, 6, y - 4);
      ctx.fillText(`${worldY}m`, w - 58, y - 4);
      ctx.globalAlpha = mapTheme === "atlantic" ? 0.18 : 0.16;
    }
    ctx.globalAlpha = 1;

    // Center on ship
    const cx = w / 2 + panOffset.x;
    const cy = h / 2 + panOffset.y;

    const courseErrorDeg = orderedCourseDeg === null ? 0 : Math.abs(signedAngleDiffDeg(ship.headingDeg, orderedCourseDeg));
    const headingVectorLengthPx = clamp(1200 * zoom, 90, 520);
    const showOrderedCourseVector = vectorsVisible && courseKeepingEnabled && orderedCourseDeg !== null && Number.isFinite(orderedCourseDeg) && courseErrorDeg > 1.5;

    // Actual traveled wake — double prop wash following the real historical path.
    // The wake begins a few pixels abaft the screws and fades gently into the old track.
    const recentTrail = (ship.trail || []).filter((point) => ship.simTime - point.t <= 60);
    if (recentTrail.length > 2) {
      const trailShipLengthPx = Math.max(GRAFTON.lengthM * zoom, 4);
      const trailShipBeamPx = Math.max(
        trailShipLengthPx * (GRAFTON.beamM / GRAFTON.lengthM) * 0.5,
        0.45
      );
      const propOffsetPx = trailShipBeamPx * 0.55;
      const sternOffsetPx = trailShipLengthPx * 0.50;
      const wakeGapPx = clamp(8 * zoom, 3, 10);

      const screenTrail = recentTrail.map((point) => ({
        x: cx + (point.x - ship.x) * zoom,
        y: cy + (point.y - ship.y) * zoom,
        t: point.t,
      }));

      for (let i = 1; i < screenTrail.length; i += 1) {
        const prev = screenTrail[i - 1];
        const point = screenTrail[i];
        const age = clamp((ship.simTime - point.t) / 60, 0, 1);
        const freshness = 1 - age;

        let tx = point.x - prev.x;
        let ty = point.y - prev.y;
        const segmentLength = Math.hypot(tx, ty);
        if (segmentLength < 0.001) continue;
        tx /= segmentLength;
        ty /= segmentLength;

        const nx = -ty;
        const ny = tx;
        const fadeIn = clamp(i / 8, 0, 1);
        const offsetPx = propOffsetPx * (0.78 + freshness * 0.22) * fadeIn;

        let startPortX = prev.x + nx * offsetPx;
        let startPortY = prev.y + ny * offsetPx;
        let startStbdX = prev.x - nx * offsetPx;
        let startStbdY = prev.y - ny * offsetPx;
        let endPortX = point.x + nx * offsetPx;
        let endPortY = point.y + ny * offsetPx;
        let endStbdX = point.x - nx * offsetPx;
        let endStbdY = point.y - ny * offsetPx;

        if (i === screenTrail.length - 1) {
          const aft = headingToVector(ship.headingDeg + 180);
          const port = headingToVector(ship.headingDeg - 90);
          const stbd = headingToVector(ship.headingDeg + 90);
          endPortX = cx + aft.x * (sternOffsetPx + wakeGapPx) + port.x * propOffsetPx;
          endPortY = cy + aft.y * (sternOffsetPx + wakeGapPx) + port.y * propOffsetPx;
          endStbdX = cx + aft.x * (sternOffsetPx + wakeGapPx) + stbd.x * propOffsetPx;
          endStbdY = cy + aft.y * (sternOffsetPx + wakeGapPx) + stbd.y * propOffsetPx;
        }

        const portGradient = ctx.createLinearGradient(startPortX, startPortY, endPortX, endPortY);
        portGradient.addColorStop(0, `rgba(245, 242, 232, ${0.04 + freshness * 0.12})`);
        portGradient.addColorStop(1, `rgba(245, 242, 232, ${0.12 + freshness * 0.28})`);
        ctx.strokeStyle = portGradient;
        ctx.lineWidth = 0.45 + freshness * 1.45;
        ctx.beginPath();
        ctx.moveTo(startPortX, startPortY);
        ctx.lineTo(endPortX, endPortY);
        ctx.stroke();

        const stbdGradient = ctx.createLinearGradient(startStbdX, startStbdY, endStbdX, endStbdY);
        stbdGradient.addColorStop(0, `rgba(245, 242, 232, ${0.04 + freshness * 0.12})`);
        stbdGradient.addColorStop(1, `rgba(245, 242, 232, ${0.12 + freshness * 0.28})`);
        ctx.strokeStyle = stbdGradient;
        ctx.beginPath();
        ctx.moveTo(startStbdX, startStbdY);
        ctx.lineTo(endStbdX, endStbdY);
        ctx.stroke();
      }
    }

    // Projected track is drawn after the ship symbol so it remains visible when zoomed in.

    // Wind arrow centered below weather text.
    const wind = headingToVector(environment.windDirDeg);
    const windCenterX = 94;
    const windCenterY = 82;
    const windHalfLength = 24;
    const windStartX = windCenterX - wind.x * windHalfLength;
    const windStartY = windCenterY - wind.y * windHalfLength;
    const windEndX = windCenterX + wind.x * windHalfLength;
    const windEndY = windCenterY + wind.y * windHalfLength;

    const cameraAltitudeM = getCameraAltitudeM(zoom);
    const drawWrappedCanvasText = (text, x, y, maxChars = 40, lineHeight = 14) => {
      const words = String(text ?? "").split(/\s+/).filter(Boolean);
      const lines = [];
      let currentLine = "";

      words.forEach((word) => {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (nextLine.length > maxChars && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = nextLine;
        }
      });

      if (currentLine) lines.push(currentLine);
      if (lines.length === 0) lines.push("");

      lines.forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
      });

      return y + lines.length * lineHeight;
    };

    if (mapInfoVisible) {
      let infoY = 36;
      ctx.fillStyle = mapTheme === "atlantic" ? "rgba(215,236,236,0.92)" : "rgba(47, 74, 91, 0.9)";
      ctx.font = "12px ui-monospace, monospace";
      infoY = drawWrappedCanvasText(environment.missionAreaLabel, 24, infoY, 40, 14);
      infoY = drawWrappedCanvasText(`POSITION ${environment.missionCoordLabel}`, 24, infoY + 4, 40, 14);
      infoY = drawWrappedCanvasText(`SEA ${SEA_STATES[environment.seaIndex].label} · AIR ${environment.airTempC}°C · WATER ${environment.waterTempC}°C`, 24, infoY + 4, 40, 14);
      infoY = drawWrappedCanvasText(`CLOUD ${environment.cloudCoverOktas}/8 · BASE ${environment.cloudBaseM} m`, 24, infoY + 4, 40, 14);
      infoY = drawWrappedCanvasText(`VIEW ALT ${cameraAltitudeM} m AGL`, 24, infoY + 4, 40, 14);

      ctx.fillStyle = "rgba(253,230,138,0.82)";
      infoY = drawWrappedCanvasText(`OVERBOARD: ${environment.overboardSurvivalNote}`, 24, infoY + 4, 40, 14);

      if (visualRangeVisible) {
        const visualRangeM = computeVisualRangeM(ship, environment);
        const visualRangePx = visualRangeM * zoom;
        const outsideChart =
          cx - visualRangePx < 0 ||
          cx + visualRangePx > w ||
          cy - visualRangePx < 0 ||
          cy + visualRangePx > h;

        ctx.fillStyle = mapTheme === "atlantic" ? "rgba(215,236,236,0.92)" : "rgba(47, 74, 91, 0.9)";

        drawWrappedCanvasText(
          outsideChart
            ? `VISUAL ${Math.round(visualRangeM / 1000)} km · OUTSIDE CHART`
            : `VISUAL ${Math.round(visualRangeM / 1000)} km`,
          24,
          infoY + 4,
          40,
          14
        );
      }
    }


    // Tactical ASDIC contact memory plot — this is not the true submarine position.
    if (contactPlot) {
      const plotAge = ship.simTime - contactPlot.lastUpdateTime;
      if (plotAge <= CONTACT_MEMORY_SECONDS) {
        const confidence = clamp(1 - plotAge / CONTACT_PLOT_FADE_SECONDS, 0, 1);
        const plotX = cx + (contactPlot.x - ship.x) * zoom;
        const plotY = cy + (contactPlot.y - ship.y) * zoom;
        const errorRadiusM = CONTACT_BASE_ERROR_M + plotAge * CONTACT_ERROR_GROWTH_MPS;
        const errorX = Math.max(errorRadiusM * zoom * 1.35, 14);
        const errorY = Math.max(errorRadiusM * zoom * 0.70, 8);
        const plotAngle = (contactPlot.bearingDeg - 90) * DEG;

        ctx.save();
        ctx.translate(plotX, plotY);
        ctx.rotate(plotAngle);
        ctx.globalAlpha = 0.16 + confidence * 0.52;
        ctx.strokeStyle = "rgba(134, 239, 172, 0.94)";
        ctx.fillStyle = "rgba(134, 239, 172, 0.065)";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.ellipse(0, 0, errorX, errorY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(187, 247, 208, 0.96)";
        ctx.beginPath();
        ctx.rect(-3, -3, 6, 6);
        ctx.fill();

        ctx.font = "bold 11px ui-monospace, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`ASDIC PLOT ${Math.round(confidence * 100)}%`, errorX + 8, 0);
        ctx.restore();
      }
    }

    // Visual horizon / naked-eye lookout circle.
    if (visualRangeVisible) {
      const visualRangeM = computeVisualRangeM(ship, environment);
      const visualRangePx = visualRangeM * zoom;
      const maxSafeCirclePx = Math.max(w, h) * 3.5;
      const drawVisualCircle = visualRangePx <= maxSafeCirclePx;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = mapTheme === "atlantic" ? "rgba(245, 230, 160, 0.44)" : "rgba(70, 55, 35, 0.42)";
      ctx.fillStyle = mapTheme === "atlantic" ? "rgba(245, 230, 160, 0.028)" : "rgba(70, 55, 35, 0.022)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([10, 8]);
      if (drawVisualCircle) {
        ctx.beginPath();
        ctx.arc(0, 0, visualRangePx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = mapTheme === "atlantic" ? "rgba(245, 230, 160, 0.78)" : "rgba(70, 55, 35, 0.78)";
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.textAlign = "left";
      if (drawVisualCircle) {
        ctx.fillText(`VISUAL ${Math.round(visualRangeM / 1000)} km`, visualRangePx + 8, -6);
      }
      ctx.restore();
    }

    // ASDIC forward search cone and detected echo.
    const asdicRangeM = 3200;
    const asdicArcDeg = asdicMode === "attack" ? 12 : asdicSearchArcDeg / 2;
    const asdicRangePx = asdicRangeM * zoom;
    const blindZonePx = 120 * zoom;

    if (vectorsVisible && asdicVisible) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((ship.headingDeg + asdicSearchDirectionDeg) * DEG);

      // Working sector: forward-facing cone from the bow, not a free-floating symbol.
      ctx.fillStyle = "rgba(18, 135, 67, 0.035)";
      ctx.strokeStyle = "rgba(18, 135, 67, 0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, asdicRangePx, (-90 - asdicArcDeg) * DEG, (-90 + asdicArcDeg) * DEG);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Blind zone / poor close bearing region under the bow.
      ctx.strokeStyle = "rgba(18, 135, 67, 0.20)";
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, blindZonePx, (-90 - asdicArcDeg) * DEG, (-90 + asdicArcDeg) * DEG);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }

    // ASDIC contact overlay (thin green arc and center dot) removed.


    // HMS Grafton plan-view model — simplified Hunt-class Type III deck layout.

    // True altitude scaling. Only a tiny visibility floor remains.
    // At 10 km the escort should read as a small tactical contact, not a full model.
    const trueShipLengthPx = GRAFTON.lengthM * zoom;
    const shipLengthPx = Math.max(trueShipLengthPx, 4);

    // shipBeamPx is used below as HALF-BEAM.
    const shipBeamPx = Math.max(
      shipLengthPx * (GRAFTON.beamM / GRAFTON.lengthM) * 0.5,
      0.45
    );
    const detailScale = clamp(shipLengthPx / GRAFTON.lengthM, 0.12, 8);
    const shipBowPx = shipLengthPx * 0.48;
    const shipSternPx = shipLengthPx * 0.52;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ship.headingDeg * DEG);
    // Blueprint-style hull: long, narrow Admiralty-plan silhouette with pale deck insert.
    const drawHullPath = (scaleX = 1, scaleY = 1) => {
      ctx.beginPath();
      ctx.moveTo(0, -shipBowPx * scaleY);
      ctx.quadraticCurveTo(shipBeamPx * 0.30 * scaleX, -shipLengthPx * 0.49 * scaleY, shipBeamPx * 0.72 * scaleX, -shipLengthPx * 0.36 * scaleY);
      ctx.quadraticCurveTo(shipBeamPx * 0.98 * scaleX, -shipLengthPx * 0.16 * scaleY, shipBeamPx * 0.84 * scaleX, shipLengthPx * 0.26 * scaleY);
      ctx.quadraticCurveTo(shipBeamPx * 0.58 * scaleX, shipLengthPx * 0.43 * scaleY, shipBeamPx * 0.28 * scaleX, shipSternPx * scaleY);
      ctx.lineTo(-shipBeamPx * 0.28 * scaleX, shipSternPx * scaleY);
      ctx.quadraticCurveTo(-shipBeamPx * 0.58 * scaleX, shipLengthPx * 0.43 * scaleY, -shipBeamPx * 0.84 * scaleX, shipLengthPx * 0.26 * scaleY);
      ctx.quadraticCurveTo(-shipBeamPx * 0.98 * scaleX, -shipLengthPx * 0.16 * scaleY, -shipBeamPx * 0.72 * scaleX, -shipLengthPx * 0.36 * scaleY);
      ctx.quadraticCurveTo(-shipBeamPx * 0.30 * scaleX, -shipLengthPx * 0.49 * scaleY, 0, -shipBowPx * scaleY);
      ctx.closePath();
    };

    drawHullPath();
    ctx.fillStyle = "rgba(37, 51, 60, 0.92)";
    ctx.strokeStyle = "#111820";
    ctx.lineWidth = Math.max(1.1, 0.85 * detailScale);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.scale(0.78, 0.88);
    drawHullPath();
    ctx.fillStyle = "rgba(216, 207, 183, 0.76)";
    ctx.strokeStyle = "rgba(17, 24, 32, 0.40)";
    ctx.lineWidth = Math.max(0.7, 0.45 * detailScale);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "rgba(17, 24, 32, 0.38)";
    ctx.lineWidth = Math.max(0.55, 0.35 * detailScale);
    ctx.beginPath();
    ctx.moveTo(0, -shipLengthPx * 0.455);
    ctx.lineTo(0, shipLengthPx * 0.455);
    ctx.stroke();

    // Thin deck-edge lines to make the silhouette read as a ship plan, not a solid marker.
    ctx.strokeStyle = "rgba(232, 226, 211, 0.56)";
    ctx.lineWidth = Math.max(0.45, 0.28 * detailScale);
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(side * shipBeamPx * 0.54, -shipLengthPx * 0.365);
      ctx.quadraticCurveTo(side * shipBeamPx * 0.70, -shipLengthPx * 0.15, side * shipBeamPx * 0.58, shipLengthPx * 0.300);
      ctx.stroke();
    });

    // Bow anchor/cable detail.
    ctx.strokeStyle = "rgba(17, 24, 32, 0.62)";
    ctx.lineWidth = Math.max(0.45, 0.28 * detailScale);
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(side * shipBeamPx * 0.12, -shipLengthPx * 0.455);
      ctx.lineTo(side * shipBeamPx * 0.50, -shipLengthPx * 0.420);
      ctx.stroke();
      ctx.fillStyle = "rgba(17, 24, 32, 0.72)";
      ctx.beginPath();
      ctx.arc(side * shipBeamPx * 0.48, -shipLengthPx * 0.415, Math.max(0.7, 0.65 * detailScale), 0, Math.PI * 2);
      ctx.fill();
    });

    const drawDeckBox = (x, y, ww, hh, fill = "#394751") => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = "rgba(9, 14, 18, 0.85)";
      ctx.lineWidth = Math.max(0.8, 0.65 * detailScale);
      ctx.beginPath();
      ctx.roundRect(x - ww / 2, y - hh / 2, ww, hh, Math.max(1.5, 2.2 * detailScale));
      ctx.fill();
      ctx.stroke();
    };

    const drawMount = (x, y, r, label, barrelDir = -1) => {
      ctx.fillStyle = "rgba(205, 197, 174, 0.90)";
      ctx.strokeStyle = "rgba(17, 24, 32, 0.78)";
      ctx.lineWidth = Math.max(0.65, 0.5 * detailScale);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.65, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(124, 136, 142, 0.94)";
      ctx.strokeStyle = "#101820";
      ctx.beginPath();
      ctx.roundRect(x - r * 0.62, y - r * 0.38, r * 1.24, r * 0.76, Math.max(1, 1.6 * detailScale));
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "#0b1116";
      ctx.lineWidth = Math.max(0.55, 0.38 * detailScale);
      [-0.22, 0.22].forEach((off) => {
        ctx.beginPath();
        ctx.moveTo(x + r * off, y + barrelDir * r * 0.18);
        ctx.lineTo(x + r * off, y + barrelDir * r * 2.85);
        ctx.stroke();
      });

      ctx.fillStyle = "rgba(20, 27, 32, 0.88)";
      ctx.font = `bold ${Math.max(5, Math.min(14, 4.8 * detailScale))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, y);
    };

    // Forecastle, bridge, director and mast — narrow, layered blueprint superstructure.
    drawDeckBox(0, -shipLengthPx * 0.306, shipBeamPx * 0.78, shipLengthPx * 0.064, "rgba(170, 172, 162, 0.92)");
    drawDeckBox(0, -shipLengthPx * 0.238, shipBeamPx * 1.05, shipLengthPx * 0.086, "rgba(124, 136, 142, 0.94)");
    drawDeckBox(0, -shipLengthPx * 0.180, shipBeamPx * 0.72, shipLengthPx * 0.060, "rgba(155, 162, 163, 0.92)");
    drawDeckBox(0, -shipLengthPx * 0.138, shipBeamPx * 0.48, shipLengthPx * 0.038, "rgba(188, 190, 184, 0.90)");

    ctx.fillStyle = "rgba(205, 197, 174, 0.88)";
    ctx.strokeStyle = "rgba(17, 24, 32, 0.70)";
    ctx.lineWidth = Math.max(0.6, 0.42 * detailScale);
    ctx.beginPath();
    ctx.arc(0, -shipLengthPx * 0.292, shipBeamPx * 0.105, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(17, 24, 32, 0.90)";
    ctx.lineWidth = Math.max(0.65, 0.45 * detailScale);
    ctx.beginPath();
    ctx.moveTo(0, -shipLengthPx * 0.290);
    ctx.lineTo(0, -shipLengthPx * 0.365);
    ctx.moveTo(-shipBeamPx * 0.18, -shipLengthPx * 0.330);
    ctx.lineTo(shipBeamPx * 0.18, -shipLengthPx * 0.330);
    ctx.stroke();

    if (detailScale > 0.85) {
      ctx.strokeStyle = "rgba(17, 24, 32, 0.32)";
      ctx.lineWidth = Math.max(0.45, 0.24 * detailScale);
      ctx.beginPath();
      ctx.moveTo(0, -shipLengthPx * 0.360);
      ctx.lineTo(-shipBeamPx * 0.62, -shipLengthPx * 0.185);
      ctx.moveTo(0, -shipLengthPx * 0.360);
      ctx.lineTo(shipBeamPx * 0.62, -shipLengthPx * 0.185);
      ctx.stroke();
    }

    // A and X twin 4-inch Mk XVI mounts.
    drawMount(0, -shipLengthPx * 0.37, shipBeamPx * 0.34, "A", -1);
    drawMount(0, shipLengthPx * 0.32, shipBeamPx * 0.34, "X", 1);

    // Single straight funnel, slightly abaft bridge.
    drawDeckBox(0, -shipLengthPx * 0.070, shipBeamPx * 0.50, shipLengthPx * 0.066, "rgba(34, 42, 47, 0.98)");
    ctx.fillStyle = "rgba(235, 230, 216, 0.24)";
    ctx.beginPath();
    ctx.moveTo(-shipBeamPx * 0.22, -shipLengthPx * 0.100);
    ctx.lineTo(shipBeamPx * 0.22, -shipLengthPx * 0.094);
    ctx.lineTo(shipBeamPx * 0.17, -shipLengthPx * 0.061);
    ctx.lineTo(-shipBeamPx * 0.23, -shipLengthPx * 0.069);
    ctx.closePath();
    ctx.fill();

    // Type III torpedo tubes amidships — drawn as blueprint tube rails across the deck.
    ctx.save();
    ctx.translate(0, shipLengthPx * 0.065);
    ctx.rotate(Math.PI / 2);
    drawDeckBox(0, 0, shipBeamPx * 0.34, shipBeamPx * 1.30, "rgba(88, 102, 110, 0.92)");
    ctx.strokeStyle = "#111820";
    ctx.lineWidth = Math.max(0.45, 0.35 * detailScale);
    [-0.18, 0, 0.18].forEach((tubeOffset) => {
      ctx.beginPath();
      ctx.moveTo(-shipBeamPx * 0.56, tubeOffset * shipBeamPx);
      ctx.lineTo(shipBeamPx * 0.56, tubeOffset * shipBeamPx);
      ctx.stroke();
    });
    ctx.restore();

    // Pom-pom and small AA positions.
    drawDeckBox(0, shipLengthPx * 0.18, shipBeamPx * 0.60, shipLengthPx * 0.050, "rgba(142, 153, 158, 0.92)");
    ctx.fillStyle = "rgba(205, 197, 174, 0.88)";
    ctx.strokeStyle = "rgba(17, 24, 32, 0.70)";
    ctx.lineWidth = Math.max(0.55, 0.38 * detailScale);
    ctx.beginPath();
    ctx.arc(0, shipLengthPx * 0.18, shipBeamPx * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    [-1, 1].forEach((side) => {
      drawDeckBox(side * shipBeamPx * 0.80, -shipLengthPx * 0.18, shipBeamPx * 0.18, shipLengthPx * 0.040, "rgba(164, 171, 172, 0.92)");
      drawDeckBox(side * shipBeamPx * 0.62, shipLengthPx * 0.43, shipBeamPx * 0.16, shipLengthPx * 0.035, "rgba(164, 171, 172, 0.88)");
      ctx.strokeStyle = "#111820";
      ctx.lineWidth = Math.max(0.35, 0.25 * detailScale);
      ctx.beginPath();
      ctx.moveTo(side * shipBeamPx * 0.80, -shipLengthPx * 0.18);
      ctx.lineTo(side * shipBeamPx * 0.80, -shipLengthPx * 0.235);
      ctx.moveTo(side * shipBeamPx * 0.62, shipLengthPx * 0.43);
      ctx.lineTo(side * shipBeamPx * 0.62, shipLengthPx * 0.485);
      ctx.stroke();
    });

    // Extra blueprint-style deck details visible at medium/high zoom.
    if (detailScale > 0.55) {
      const drawTinyCircle = (x, y, r, fill = "#2f3a40") => {
        ctx.fillStyle = fill;
        ctx.strokeStyle = "rgba(9, 14, 18, 0.65)";
        ctx.lineWidth = Math.max(0.5, 0.45 * detailScale);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      };

      [-1, 1].forEach((side) => {
        const boat = (x, y, ww, hh) => {
          ctx.fillStyle = "rgba(188, 184, 164, 0.90)";
          ctx.strokeStyle = "rgba(17, 24, 32, 0.72)";
          ctx.lineWidth = Math.max(0.55, 0.42 * detailScale);
          ctx.beginPath();
          ctx.ellipse(x, y, ww / 2, hh / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = "rgba(17, 24, 32, 0.38)";
          ctx.lineWidth = Math.max(0.35, 0.22 * detailScale);
          ctx.beginPath();
          ctx.moveTo(x - ww * 0.32, y);
          ctx.lineTo(x + ww * 0.32, y);
          ctx.stroke();
        };

        boat(side * shipBeamPx * 0.72, -shipLengthPx * 0.055, shipBeamPx * 0.28, shipLengthPx * 0.105);
        boat(side * shipBeamPx * 0.70, shipLengthPx * 0.060, shipBeamPx * 0.24, shipLengthPx * 0.095);

        ctx.strokeStyle = "#111820";
        ctx.lineWidth = Math.max(0.45, 0.34 * detailScale);
        ctx.beginPath();
        ctx.moveTo(side * shipBeamPx * 0.50, -shipLengthPx * 0.120);
        ctx.lineTo(side * shipBeamPx * 0.95, -shipLengthPx * 0.035);
        ctx.moveTo(side * shipBeamPx * 0.50, -shipLengthPx * 0.005);
        ctx.lineTo(side * shipBeamPx * 0.90, shipLengthPx * 0.085);
        ctx.stroke();
      });

      [-1, 1].forEach((side) => {
        for (let i = 0; i < 9; i += 1) {
          const y = -shipLengthPx * 0.28 + i * shipLengthPx * 0.055;
          drawTinyCircle(side * shipBeamPx * 0.86, y, Math.max(0.8, 0.9 * detailScale));
        }
      });

      for (let i = 0; i < 5; i += 1) {
        drawTinyCircle(0, -shipLengthPx * 0.44 + i * shipLengthPx * 0.026, Math.max(0.8, 0.85 * detailScale), "#3d474d");
      }
    }


    // SMOKE — square/vector particles instead of ellipse smoke.
    // funnel location
    const funnelX = 0;
    const funnelY = -shipLengthPx * 0.08;
    // Drift vector: smoke is pushed by wind and also trails aft as the ship moves ahead.
    // Convert final world-space drift vector into the ship-local canvas rotation.
    const windVector = headingToVector(environment.windDirDeg);
    const aftVector = headingToVector(ship.headingDeg + 180);
    const speedKn = Math.abs(ship.speedMps * MPS_TO_KNOT);
    const driftWorldX = windVector.x * environment.windKn + aftVector.x * speedKn * 0.85;
    const driftWorldY = windVector.y * environment.windKn + aftVector.y * speedKn * 0.85;
    const driftAngle = Math.atan2(driftWorldY, driftWorldX) - ship.headingDeg * DEG;

    // Smoke power based on telegraph and ship speed.
    const telegraph = TELEGRAPH[controls.telegraphIndex];
    const smokePower = clamp((Math.abs(telegraph.targetKn) / GRAFTON.maxSpeedKn) * 0.9 + (speedKn > 1 ? 0.12 : 0), 0, 1);
    for (let i = 0; i < 10; i += 1) {
      const t = i / 9;
      const wobbleMeters = Math.sin(ship.simTime * 1.2 + i * 1.9) * 7 * t;
      const distanceMeters = 18 + t * (80 + smokePower * 180);

      const px = funnelX + (Math.cos(driftAngle) * distanceMeters + Math.cos(driftAngle + Math.PI / 2) * wobbleMeters) * zoom;
      const py = funnelY + (Math.sin(driftAngle) * distanceMeters + Math.sin(driftAngle + Math.PI / 2) * wobbleMeters) * zoom;

      const size = Math.max((6 + t * 18 * smokePower) * zoom, 1.6);

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(driftAngle + t * 0.7);
      ctx.fillStyle = `rgba(24, 23, 22, ${0.46 * smokePower * (1 - t)})`;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    }

    ctx.restore();

      if (ringVisible) {
        const t = clamp(ringAge / ASDIC_RING_DURATION_SECONDS, 0, 1);
        const ringRadius = (140 + t * 2200) * zoom;
        const arcDeg = 58;
        const bowOffsetPx = shipLengthPx * 0.42;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((ship.headingDeg + asdicSearchDirectionDeg) * DEG);
        ctx.translate(0, -bowOffsetPx);

        ctx.strokeStyle = `rgba(134, 239, 172, ${0.95 * (1 - t)})`;
        ctx.lineWidth = Math.max(1.5, 3 * zoom + 1);
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          ringRadius,
          (-90 - arcDeg) * DEG,
          (-90 + arcDeg) * DEG
        );
        ctx.stroke();

        if (asdicContact.detected) {
          const contactRangePx = asdicContact.distanceM * zoom;
          const ringContactGap = Math.abs(ringRadius - contactRangePx);

          if (ringContactGap <= Math.max(12, 42 * zoom)) {
            const relBearing = signedAngleDiffDeg(ship.headingDeg, asdicContact.bearingDeg);
            const echoAngle = (-90 + relBearing) * DEG;
            const echoX = Math.cos(echoAngle) * contactRangePx;
            const echoY = Math.sin(echoAngle) * contactRangePx;
            const flashAlpha = clamp(1 - ringContactGap / Math.max(12, 42 * zoom), 0, 1);

            ctx.fillStyle = `rgba(187, 247, 208, ${0.85 * flashAlpha})`;
            ctx.beginPath();
            ctx.arc(echoX, echoY, Math.max(2, 4 * zoom + 2), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

    // 30-second projected track based on current engine, rudder, sea and wind.
    // It is drawn above the ship marker and starts just ahead of the bow so it is not hidden when zoomed in.
    const predictedTrack = vectorsVisible
      ? predictShipTrack(ship, controls, environment, 30, orderedCourseDeg, courseKeepingEnabled)
      : [];
    if (vectorsVisible && predictedTrack.length > 2) {
      const screenPoints = predictedTrack.map((point) => ({
        x: cx + (point.x - ship.x) * zoom,
        y: cy + (point.y - ship.y) * zoom,
      }));

      const first = screenPoints[0];
      const finalPoint = screenPoints[screenPoints.length - 1];
      const previousPoint = screenPoints[screenPoints.length - 2];
      const endAngle = Math.atan2(finalPoint.y - previousPoint.y, finalPoint.x - previousPoint.x);
      const projectedDistancePx = Math.hypot(finalPoint.x - first.x, finalPoint.y - first.y);

      if (projectedDistancePx >= 4) {
        ctx.strokeStyle = "rgba(45, 111, 169, 0.86)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < screenPoints.length; i += 1) {
          ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.save();
        ctx.translate(finalPoint.x, finalPoint.y);
        ctx.rotate(endAngle);
        ctx.fillStyle = "rgba(45, 111, 169, 0.95)";
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-7, -6);
        ctx.lineTo(-7, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "rgba(45, 111, 169, 0.95)";
        ctx.font = "bold 12px ui-monospace, monospace";
        ctx.fillText("30s", finalPoint.x + 12, finalPoint.y - 10);
      }
    }

    // Current heading / actual ship heading vector
    const fwd = headingToVector(ship.headingDeg);
    if (vectorsVisible) {
      ctx.strokeStyle = "rgba(103, 86, 68, 0.72)";
      ctx.lineWidth = 1.7;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = 0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + fwd.x * headingVectorLengthPx, cy + fwd.y * headingVectorLengthPx);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.fillStyle = "rgba(103, 86, 68, 0.92)";
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.fillText(`HDG ${bearingLabel(ship.headingDeg)}`, cx + fwd.x * (headingVectorLengthPx + 10), cy + fwd.y * (headingVectorLengthPx + 10));
    }

    // Ordered Course / Course to Steer vector
    if (showOrderedCourseVector && Number.isFinite(orderedCourseDeg)) {
      const ordered = headingToVector(orderedCourseDeg);
      ctx.strokeStyle = "rgba(49, 139, 119, 0.88)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = 12;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const orderedVectorLengthPx = headingVectorLengthPx;
      ctx.lineTo(cx + ordered.x * orderedVectorLengthPx, cy + ordered.y * orderedVectorLengthPx);
      ctx.stroke();
      ctx.lineDashOffset = 0;
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(49, 139, 119, 0.96)";
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.fillText(
        `${courseKeepingEnabled ? "ORD HDG" : "ORD HDG STBY"} ${bearingLabel(orderedCourseDeg)}`,
        cx + ordered.x * (orderedVectorLengthPx + 10),
        cy + ordered.y * (orderedVectorLengthPx + 10)
      );

      const angleBetween = signedAngleDiffDeg(ship.headingDeg, orderedCourseDeg);
      const mid = headingToVector(ship.headingDeg + angleBetween / 2);
      ctx.fillStyle = "rgba(253, 230, 138, 0.96)";
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.fillText(
        `Δ ${angleBetween > 0 ? "+" : ""}${Math.round(angleBetween)}°`,
        cx + mid.x * 210 + 8,
        cy + mid.y * 210
      );
    }

    if (courseInput.length > 0) {
      ctx.fillStyle = "rgba(18, 135, 67, 0.95)";
      ctx.font = "bold 13px ui-monospace, monospace";
      ctx.fillText(`COURSE INPUT: ${courseInput.padEnd(3, "_")} ENTER TO CONFIRM`, 24, 74);
    }

    // Labels
    ctx.fillStyle = chartColors.text;
    ctx.font = "bold 13px ui-monospace, monospace";
    ctx.fillText("HMS GRAFTON L83", cx + 18, cy - 18);
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`${bearingLabel(ship.headingDeg)} / ${(ship.speedMps * MPS_TO_KNOT).toFixed(1)} kn`, cx + 18, cy + 2);

    // Scale marker
    ctx.strokeStyle = chartColors.scale;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 180, h - 42);
    ctx.lineTo(w - 80, h - 42);
    ctx.stroke();
    ctx.fillStyle = chartColors.scale;
    ctx.font = "12px ui-monospace, monospace";
    const metersShown = Math.round(100 / zoom);
    ctx.fillText(`${metersShown} m`, w - 158, h - 50);
    ctx.fillText(`GRID ${gridMeters} m`, w - 180, h - 22);
    if (legendVisible) {
      ctx.font = "11px ui-monospace, monospace";
      if (vectorsVisible) {
        ctx.fillStyle = "rgba(45, 111, 169, 0.88)";
        ctx.fillText("— — predicted track 30s", 24, h - 96);
        ctx.fillStyle = "rgba(49, 139, 119, 0.90)";
        ctx.fillText("— — ordered heading", 24, h - 78);
        ctx.fillStyle = "rgba(103, 86, 68, 0.82)";
        ctx.fillText("— — current heading", 24, h - 60);
      }
      ctx.fillStyle = mapTheme === "atlantic" ? "rgba(215,236,236,0.62)" : "rgba(38, 61, 76, 0.56)";
      ctx.fillText("— track history 60s", 24, h - 42);
      ctx.fillStyle = "rgba(18, 135, 67, 0.58)";
      ctx.fillText("— ASDIC cone / echo", 24, h - 24);
    }

    // Cloud renderer extraction checkpoint.
    // When src/renderers/cloudRenderer.js exists and passes parity, replace local helper with imported function.
    // Cloud layer sits above ships/vectors/ASDIC but still below UI panels.
    // Contract: imported cloudRenderer.js must preserve z-order, zoom behavior,
    // wind drift, theme colors and camera-altitude fade exactly.
    drawCloudLayerExternal(ctx, w, h, ship, environment, mapTheme, zoom, panOffset);

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = chartColors.text;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Hunt For Hunters · Maciek Dąbrowski · 2026 · build 0.2", w / 2, h - 18);
    ctx.restore();
  }, [ship, zoom, environment, controls, orderedCourseDeg, courseInput, courseKeepingEnabled, vectorsVisible, asdicVisible, asdicContact, contactPlot, ringVisible, ringAge, submarine, mapTheme, mapInfoVisible, visualRangeVisible, legendVisible, asdicMode, asdicSearchArcDeg, asdicSearchDirectionDeg, panOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Stable tactical zoom: keep the chart table anchored instead of moving panOffset.
      // Cursor-anchored zoom caused the whole map, ship and cloud layer to drift sideways.
      const factor = event.deltaY < 0 ? 1.16 : 0.86;
      setZoom((currentZoom) => clamp(currentZoom * factor, 0.01, 8));
    };

    const container = canvas.parentElement;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    container?.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      container?.removeEventListener("wheel", handleWheel);
    };
  }, [setZoom]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100vh - 32px)",
        overflow: "hidden",
        border: "1px solid #5c5244",
        borderRadius: "16px",
        background: mapTheme === "atlantic" ? "#173746" : "#d8c49c",
        cursor: dragRef.current.active ? "grabbing" : "grab",
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          dragRef.current = { active: true, x: event.clientX, y: event.clientY };
        }}
        onMouseMove={(event) => {
          if (!dragRef.current.active) return;
          const dx = event.clientX - dragRef.current.x;
          const dy = event.clientY - dragRef.current.y;
          dragRef.current = { active: true, x: event.clientX, y: event.clientY };
          setPanOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
        }}
        onMouseUp={() => {
          dragRef.current.active = false;
        }}
        onMouseLeave={() => {
          dragRef.current.active = false;
        }}
        onDoubleClick={() => setPanOffset({ x: 0, y: 0 })}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          background: mapTheme === "atlantic" ? "#173746" : "#d8c49c",
          cursor: dragRef.current.active ? "grabbing" : "grab",
        }}
      />
    </div>
  );
}


function ZoomPanel({ zoom, setZoom }) {
  return (
    <div style={{ ...panelStyle, height: "72px" }}>
      <div style={labelStyle}>Zoom</div>
      <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="range"
          min="0.01"
          max="8"
          step="0.01"
          value={zoom}
          style={{ flex: 1 }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
        <div style={{ minWidth: "48px", textAlign: "right", fontFamily: "ui-monospace, monospace", fontSize: "12px" }}>
          {zoom.toFixed(2)}x
        </div>
      </div>
    </div>
  );
}




const panelStyle = {
  borderRadius: "12px",
  background: "rgba(28, 25, 23, 0.80)",
  color: "#f5f5f4",
  padding: "8px",
  boxShadow: "0 8px 18px rgba(0, 0, 0, 0.22)",
  boxSizing: "border-box",
  width: "100%",
  overflow: "hidden",
};

const labelStyle = {
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "#a8a29e",
};

const statusBoxStyle = {
  borderRadius: "10px",
  background: "#292524",
  padding: "8px",
};

const buttonStyle = {
  border: "1px solid rgba(120, 113, 108, 0.55)",
  borderRadius: "10px",
  background: "#292524",
  color: "#f5f5f4",
  padding: "6px 8px",
  cursor: "pointer",
  fontSize: "11px",
};

const activeButtonStyle = {
  ...buttonStyle,
  background: "#fde68a",
  color: "#0c0a09",
};

const dangerButtonStyle = {
  ...buttonStyle,
  background: "#fecaca",
  color: "#0c0a09",
};

function StatusBox({ label, value }) {
  return (
    <div style={statusBoxStyle}>
      <div style={{ color: "#a8a29e", fontSize: "10px" }}>{label}</div>
      <div style={{ marginTop: "2px", fontSize: "14px", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function InstrumentPanel({ ship, controls, setControls, environment, setEnvironment, timeScale, setTimeScale, paused, setPaused, vectorsVisible, setVectorsVisible, mapTheme, setMapTheme, uiSnapEnabled, setUiSnapEnabled, setCourseKeepingEnabled, orderedCourseDeg, courseKeepingEnabled, asdicContact }) {
  const speedKn = ship.speedMps * MPS_TO_KNOT;
  const turningDiameterM = computeTurningDiameterM(ship, controls, environment);

  const setRudder = (delta) => {
    setCourseKeepingEnabled(false);
    setControls((c) => ({ ...c, rudderDeg: clamp(c.rudderDeg + delta, -GRAFTON.maxRudderDeg, GRAFTON.maxRudderDeg) }));
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "192px 192px", gap: "24px", alignItems: "start" }}>
      <DraggablePanel snapEnabled={uiSnapEnabled} style={{ ...panelStyle, width: "192px", height: "336px" }}>
        <div style={labelStyle}>Bridge</div>
        <div style={{ marginTop: "5px", fontSize: "15px", fontWeight: 600 }}>
          {GRAFTON.name} <span style={{ color: "#a8a29e" }}>{GRAFTON.pennant}</span>
        </div>
        <div style={{ marginTop: "2px", fontSize: "11px", color: "#d6d3d1" }}>{GRAFTON.className}</div>
        <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
          <StatusBox label="Course" value={bearingLabel(ship.headingDeg)} />
          <StatusBox label="Speed" value={`${speedKn.toFixed(1)} kn`} />
          <StatusBox label="Roll" value={`${ship.rollDeg.toFixed(1)}°`} />
          <StatusBox label="Pitch" value={`${ship.pitchDeg.toFixed(1)}°`} />
        </div>

        <div style={{ marginTop: "6px", borderRadius: "10px", background: "#292524", padding: "8px", fontSize: "10px", lineHeight: 1.35, overflowWrap: "anywhere" }}>
          <div style={{ ...labelStyle, marginBottom: "3px" }}>ASDIC</div>
          <div style={{ fontWeight: 700, color: asdicContact.detected ? "#86efac" : "#d6d3d1" }}>
            {asdicContact.detected
              ? `${asdicContact.quality} · ${bearingLabel(asdicContact.bearingDeg)} · ${(asdicContact.distanceM * 1.09361).toFixed(0)} yd`
              : "NO CONTACT"}
          </div>
        </div>
      </DraggablePanel>

      <DraggablePanel snapEnabled={uiSnapEnabled} width="240px" style={{ position: "fixed", right: "240px", top: "240px", zIndex: 3 }}>
        <CompassPanel
          ship={ship}
          environment={environment}
          orderedCourseDeg={orderedCourseDeg}
          courseKeepingEnabled={courseKeepingEnabled}
          DEG={DEG}
          panelStyle={panelStyle}
          labelStyle={labelStyle}
          buttonStyle={buttonStyle}
          bearingLabel={bearingLabel}
          formatTime={formatTime}
        />
      </DraggablePanel>

      <DraggablePanel snapEnabled={uiSnapEnabled} style={{ ...panelStyle, width: "192px", height: "288px" }}>
        <div style={labelStyle}>Engine Telegraph</div>
        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
          {[...TELEGRAPH].reverse().map((mode) => {
            const originalIndex = TELEGRAPH.findIndex((item) => item.label === mode.label);
            return (
              <button
                key={mode.label}
                onClick={() => setControls((c) => ({ ...c, telegraphIndex: originalIndex }))}
                style={{
                  ...(controls.telegraphIndex === originalIndex ? activeButtonStyle : buttonStyle),
                  width: "100%",
                  textAlign: "center",
                  padding: "3px 5px",
                  fontSize: "10px",
                }}
              >
                {mode.shortLabel}
              </button>
            );
          })}
        </div>
      </DraggablePanel>

      <DraggablePanel snapEnabled={uiSnapEnabled} style={{ ...panelStyle, width: "192px", height: "192px" }}>
        <div style={labelStyle}>Rudder</div>
        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "5px" }}>
          <button style={buttonStyle} onClick={() => setRudder(-5)}>Port 5</button>
          <button style={buttonStyle} onClick={() => { setCourseKeepingEnabled(false); setControls((c) => ({ ...c, rudderDeg: 0 })); }}>Midships</button>
          <button style={buttonStyle} onClick={() => setRudder(5)}>Stbd 5</button>
        </div>
        <div style={{ marginTop: "8px", borderRadius: "10px", background: "#292524", padding: "8px", textAlign: "center", fontSize: "18px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(controls.rudderDeg) < 0 ? "P" : Math.round(controls.rudderDeg) > 0 ? "S" : "M"} {Math.abs(Math.round(controls.rudderDeg))}°
        </div>
        <input
          style={{ marginTop: "8px", width: "100%" }}
          type="range"
          min={-GRAFTON.maxRudderDeg}
          max={GRAFTON.maxRudderDeg}
          step="1"
          value={controls.rudderDeg}
          onChange={(e) => { setCourseKeepingEnabled(false); setControls((c) => ({ ...c, rudderDeg: Math.round(Number(e.target.value)) })); }}
        />
        <div
          style={{
            marginTop: "6px",
            fontSize: "9px",
            color: "#fde68a",
            lineHeight: 1.25,
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          Turn circle: {turningDiameterM ? `${Math.round(turningDiameterM)} m Ø` : "—"}
        </div>
      </DraggablePanel>

      <DraggablePanel snapEnabled={uiSnapEnabled} style={{ ...panelStyle, width: "192px", minHeight: "144px", height: "auto" }}>
        <div style={labelStyle}>Date & Time</div>
        <div style={{ marginTop: "5px", fontSize: "12px", color: "#d6d3d1", fontWeight: 600 }}>{MISSION_DATE_LABEL}</div>
        <div style={{ marginTop: "5px", fontSize: "14px", fontWeight: 600 }}>{formatTime(ship.simTime)}</div>
        <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {[0.5, 1, 5, 10, 20, 100].map((s) => (
            <button key={s} style={timeScale === s ? activeButtonStyle : buttonStyle} onClick={() => setTimeScale(s)}>
              {s}x
            </button>
          ))}
          <button style={paused ? dangerButtonStyle : buttonStyle} onClick={() => setPaused((p) => !p)}>
            {paused ? "Paused" : "Pause"}
          </button>
        </div>
        {/* Removed: Sea state select and Waves button */}
      </DraggablePanel>
    </div>
  );
}

export default function App() {
  const initialShipState = {
    x: 0,
    y: 0,
    headingDeg: 45,
    speedMps: 0,
    turnRateDeg: 0,
    rollDeg: 0,
    pitchDeg: 0,
    simTime: 9 * 3600,
    trail: [],
  };
  const [ship, setShip] = useState(initialShipState);
  const [controls, setControls] = useState({ telegraphIndex: TELEGRAPH.findIndex((mode) => mode.label === "Stop"), rudderDeg: 0 });
const [environment, setEnvironment] = useState({
  seaIndex: 3,
  windDirDeg: 250,
  windKn: 28,
  wavesVisible: true,
  cloudsVisible: true,
  cloudCoverOktas: 7,
  cloudBaseM: 650,

  airTempC: MISSION_AIR_TEMP_C,
  waterTempC: MISSION_WATER_TEMP_C,
  overboardSurvivalNote: MISSION_OVERBOARD_NOTE,

  missionAreaLabel: MISSION_AREA_LABEL,
  missionCoordLabel: MISSION_COORD_LABEL,
});
  const [zoom, setZoom] = useState(0.22);
  const [timeScale, setTimeScale] = useState(1);
  const [paused, setPaused] = useState(false);
  const [orderedCourseDeg, setOrderedCourseDeg] = useState(45);
  const [courseInput, setCourseInput] = useState("");
  const [courseKeepingEnabled, setCourseKeepingEnabled] = useState(false);
  const [vectorsVisible, setVectorsVisible] = useState(true);
  const [visualRangeVisible, setVisualRangeVisible] = useState(true);
  const [mapInfoVisible, setMapInfoVisible] = useState(true);
  const [legendVisible, setLegendVisible] = useState(true);
  const [mapTheme, setMapTheme] = useState("atlantic");
  const [asdicVisible, setAsdicVisible] = useState(true);
  const [asdicMode, setAsdicMode] = useState("manual");
  const [asdicSearchArcDeg, setAsdicSearchArcDeg] = useState(180);
  const [asdicSearchDirectionDeg, setAsdicSearchDirectionDeg] = useState(0);
  const [uiSnapEnabled, setUiSnapEnabled] = useState(true);
  const [submarine, setSubmarine] = useState(getInitialSubmarineState());
  const rawAsdicContact = useMemo(
    () => computeAsdicContact(ship, submarine, environment),
    [ship.x, ship.y, ship.headingDeg, ship.speedMps, submarine.x, submarine.y, submarine.depthM, environment.seaIndex]
  );

  const [asdicPing, setAsdicPing] = useState(DEFAULT_ASDIC_PING_STATE);
  const [contactPlot, setContactPlot] = useState(null);

  const secondsSincePing = asdicPing.lastPingTime === null
    ? Infinity
    : ship.simTime - asdicPing.lastPingTime;

  const pingCooldownRemaining = clamp(
    ASDIC_PING_COOLDOWN_SECONDS - secondsSincePing,
    0,
    ASDIC_PING_COOLDOWN_SECONDS
  );

  const canPing = asdicVisible && secondsSincePing >= ASDIC_PING_COOLDOWN_SECONDS;

  const ringAge = asdicPing.ringStartTime === null
    ? Infinity
    : ship.simTime - asdicPing.ringStartTime;
  const ringVisible = ringAge <= ASDIC_RING_DURATION_SECONDS;

  const asdicContact =
    asdicPing.contact && secondsSincePing <= ASDIC_ECHO_HOLD_SECONDS
      ? asdicPing.contact
      : {
          detected: false,
          strength: 0,
          quality: "NONE",
          bearingDeg: rawAsdicContact.bearingDeg,
          distanceM: rawAsdicContact.distanceM,
        };
  const [logs, setLogs] = useState([
    { time: "09:00:00", message: "HMS Grafton L83 standing by. Chart table active." },
    { time: "09:00:00", message: `Mission area fixed at ${MISSION_COORD_LABEL}. Air 4°C, water 6°C.` },
    { time: "09:00:00", message: "Weather desk reports Sea State 6, wind 250 at 28 knots, low cloud and rough Atlantic swell." },
  ]);

  const lastLogRef = useRef({ telegraph: TELEGRAPH.findIndex((mode) => mode.label === "Stop"), rudder: 0, sea: 2, minute: -1, asdicMinute: -1 });

  useAnimationFrame((frameDt) => {
    if (paused) return;
    const scaledDt = clamp(frameDt, 0, 0.05) * timeScale;
    setShip((s) => {
      const effectiveControls = getEffectiveControls(s, controls, orderedCourseDeg, courseKeepingEnabled);

      if (courseKeepingEnabled && effectiveControls.rudderDeg !== controls.rudderDeg) {
        setControls((current) => ({ ...current, rudderDeg: effectiveControls.rudderDeg }));
      }

      return simulateShip(s, effectiveControls, environment, scaledDt);
    });
  });

  useEffect(() => {
    const nextLogs = [];
    const currentMinute = Math.floor(ship.simTime / 60);
    // ASDIC contact logging
    if (asdicVisible && asdicContact.detected && currentMinute !== lastLogRef.current.asdicMinute) {
      nextLogs.push({
        time: formatTime(ship.simTime),
        message: `ASDIC ${asdicContact.quality} bearing ${bearingLabel(asdicContact.bearingDeg)} range ${(asdicContact.distanceM * 1.09361).toFixed(0)} yd.`,
      });
      lastLogRef.current.asdicMinute = currentMinute;
    }
    if (lastLogRef.current.telegraph !== controls.telegraphIndex) {
      nextLogs.push({ time: formatTime(ship.simTime), message: `Engine room acknowledges: ${TELEGRAPH[controls.telegraphIndex].label}.` });
      lastLogRef.current.telegraph = controls.telegraphIndex;
    }
    if (lastLogRef.current.rudder !== controls.rudderDeg) {
      nextLogs.push({ time: formatTime(ship.simTime), message: `Helm: ${controls.rudderDeg === 0 ? "Midships" : `${controls.rudderDeg < 0 ? "Port" : "Starboard"} ${Math.abs(controls.rudderDeg)} degrees`}.` });
      lastLogRef.current.rudder = controls.rudderDeg;
    }
    if (lastLogRef.current.sea !== environment.seaIndex) {
      nextLogs.push({ time: formatTime(ship.simTime), message: `Weather desk updates sea state: ${SEA_STATES[environment.seaIndex].label}.` });
      lastLogRef.current.sea = environment.seaIndex;
    }
    if (currentMinute !== lastLogRef.current.minute && currentMinute % 5 === 0) {
      nextLogs.push({ time: formatTime(ship.simTime), message: `Navigator plot: course ${bearingLabel(ship.headingDeg)}, speed ${(ship.speedMps * MPS_TO_KNOT).toFixed(1)} knots.` });
      lastLogRef.current.minute = currentMinute;
    }
    if (nextLogs.length) {
      setLogs((old) => [...nextLogs, ...old].slice(0, 80));
    }
  }, [controls.telegraphIndex, controls.rudderDeg, environment.seaIndex, ship.simTime, ship.headingDeg, ship.speedMps, asdicVisible, asdicContact.detected, asdicContact.quality, asdicContact.bearingDeg, asdicContact.distanceM]);

  useEffect(() => {
    const handler = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      }
      const isCourseDigit = /^[0-9]$/.test(e.key) || /^Numpad[0-9]$/.test(e.code);
      const courseDigit = /^Numpad[0-9]$/.test(e.code) ? e.code.replace("Numpad", "") : e.key;
      if (isCourseDigit && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCourseInput((current) => (current + courseDigit).slice(0, 3));
        return;
      }
      if (e.key === "Backspace" && courseInput.length > 0) {
        e.preventDefault();
        setCourseInput((current) => current.slice(0, -1));
        return;
      }
      if (e.key === "Enter" && courseInput.length > 0) {
        e.preventDefault();
        const parsedCourse = Number(courseInput);
        if (Number.isFinite(parsedCourse)) {
          const normalizedCourse = wrapAngleDeg(parsedCourse === 360 ? 0 : parsedCourse);
          setOrderedCourseDeg(normalizedCourse);
          setCourseKeepingEnabled(true);
          if (Math.abs(ship.speedMps) < 0.5) {
            setControls((current) => ({
              ...current,
              telegraphIndex: TELEGRAPH.findIndex((mode) => mode.label === "Slow Ahead"),
            }));
          }
          addLog(`Ordered course set to ${bearingLabel(normalizedCourse)}. Course keeping engaged.`);
        }
        setCourseInput("");
        return;
      }
      if (e.key === "Escape" && courseInput.length > 0) {
        e.preventDefault();
        setCourseInput("");
        return;
      }
      if (e.key === "1") setTimeScale(0.5);
      if (e.key === "2") setTimeScale(1);
      if (e.key === "3") setTimeScale(5);
      if (e.key === "4") setTimeScale(10);
      if (e.key === "5") setTimeScale(20);
      if (e.key === "6") setTimeScale(100);
      if (e.key === "a" || e.key === "A") {
        setCourseKeepingEnabled(false);
        setControls((c) => ({ ...c, rudderDeg: Math.round(clamp(c.rudderDeg - 5, -GRAFTON.maxRudderDeg, GRAFTON.maxRudderDeg)) }));
      }
      if (e.key === "d" || e.key === "D") {
        setCourseKeepingEnabled(false);
        setControls((c) => ({ ...c, rudderDeg: Math.round(clamp(c.rudderDeg + 5, -GRAFTON.maxRudderDeg, GRAFTON.maxRudderDeg)) }));
      }
      if (e.key === "s" || e.key === "S") {
        setCourseKeepingEnabled(false);
        setControls((c) => ({ ...c, rudderDeg: 0 }));
      }
      if (e.key === "w" || e.key === "W") setControls((c) => ({ ...c, telegraphIndex: clamp(c.telegraphIndex + 1, 0, TELEGRAPH.length - 1) }));
      if (e.key === "x" || e.key === "X") setControls((c) => ({ ...c, telegraphIndex: clamp(c.telegraphIndex - 1, 0, TELEGRAPH.length - 1) }));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [courseInput, ship.simTime, ship.speedMps, setCourseKeepingEnabled]);

  const addLog = (message) => {
    setLogs((old) => [{ time: formatTime(ship.simTime), message }, ...old].slice(0, 80));
  };

  const handleAsdicPing = () => {
    const autoPingActive = asdicMode !== "manual";
    if (autoPingActive && !canPing) return;

    const contactSnapshot = rawAsdicContact;
    if (contactSnapshot.detected) {
      setContactPlot(buildContactPlot(ship, contactSnapshot, ship.simTime));
    }

    setAsdicPing({
      lastPingTime: ship.simTime,
      contact: contactSnapshot,
      ringStartTime: ship.simTime,
    });

    playAsdicSound(contactSnapshot);

    addLog(
      contactSnapshot.detected
        ? `ASDIC ping: ${contactSnapshot.quality} echo bearing ${bearingLabel(contactSnapshot.bearingDeg)} range ${(contactSnapshot.distanceM * 1.09361).toFixed(0)} yd.`
        : "ASDIC ping: no echo."
    );
  };

  const handleAsdicMode = (mode) => {
    setAsdicVisible(true);
    setAsdicMode(mode);

    if (mode === "manual") {
      addLog("Captain to ASDIC room: Stand by for manual pings.");
    }

    if (mode === "search") {
      addLog("Captain to ASDIC room: Search ahead.");
    }

    if (mode === "attack") {
      addLog("Captain to ASDIC room: Attack pings. Maintain contact.");
    }
  };

  useEffect(() => {
    if (!asdicVisible) return;
    if (asdicMode === "manual") return;
    if (!canPing) return;

    handleAsdicPing();
  }, [ship.simTime, asdicVisible, asdicMode, canPing]);

  const handleFullAhead = () => {
    setControls((c) => ({ ...c, telegraphIndex: TELEGRAPH.findIndex((mode) => mode.label === "Full Ahead") }));
    addLog("Sea trial order: Full Ahead.");
  };

  const handleHardStarboard = () => {
    setCourseKeepingEnabled(false);
    setControls((c) => ({ ...c, rudderDeg: GRAFTON.maxRudderDeg }));
    addLog("Sea trial order: Hard Starboard.");
  };

  const handleCrashStop = () => {
    setControls((c) => ({ ...c, telegraphIndex: TELEGRAPH.findIndex((mode) => mode.label === "Stop") }));
    addLog("Sea trial order: Crash Stop / Stop Engines.");
  };

  const handleResetTrial = () => {
    setShip(initialShipState);
    setControls({ telegraphIndex: TELEGRAPH.findIndex((mode) => mode.label === "Stop"), rudderDeg: 0 });
    setPaused(false);
    setTimeScale(1);
    setOrderedCourseDeg(45);
    setCourseKeepingEnabled(false);
    setCourseInput("");
    setVectorsVisible(true);
    setVisualRangeVisible(true);
    setMapInfoVisible(true);
    setLegendVisible(true);
    setMapTheme("atlantic");
    setAsdicVisible(true);
    setAsdicMode("manual");
    setAsdicSearchArcDeg(180);
    setAsdicSearchDirectionDeg(0);
    setUiSnapEnabled(true);
    setEnvironment((env) => ({ ...env, cloudsVisible: false }));
    setLogs([
      { time: "09:00:00", message: "HMS Grafton L83 standing by. Chart table active." },
      { time: "09:00:00", message: "Sea trial reset. Awaiting bridge orders." },
    ]);
    lastLogRef.current = { telegraph: TELEGRAPH.findIndex((mode) => mode.label === "Stop"), rudder: 0, sea: environment.seaIndex, minute: -1, asdicMinute: -1 };
    setAsdicPing(DEFAULT_ASDIC_PING_STATE);
    setContactPlot(null);
  };


  return (
    <div style={{ minHeight: "100vh", background: "#0c0a09", color: "#f5f5f4", padding: "16px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        <header style={{ display: "flex", flexDirection: "column", gap: "12px", borderRadius: "16px", background: "rgba(28, 25, 23, 0.85)", padding: "16px", boxShadow: "0 12px 28px rgba(0,0,0,0.28)" }}>
          <div>
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.35em", color: "#fde68a" }}>Hunt For Hunters</div>
            <h1 style={{ margin: "4px 0 0", fontSize: "32px", fontWeight: 700 }}>Build 0.1 — The Table Lives</h1>
            <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#d6d3d1" }}>HMS Grafton L83 · “{GRAFTON.motto}”</p>
          </div>
          <div style={{ alignSelf: "flex-start", borderRadius: "12px", background: "rgba(12, 10, 9, 0.7)", padding: "12px 16px", fontSize: "12px", color: "#d6d3d1" }}>
            Keys: W/X telegraph · A/D rudder · S midships · Space pause · 1–6 time scale
          </div>
        </header>

        <div style={{ position: "fixed", inset: "16px", zIndex: 1 }}>
          <ChartTable
            ship={ship}
            zoom={zoom}
            setZoom={setZoom}
            environment={environment}
            controls={controls}
            orderedCourseDeg={orderedCourseDeg}
            courseInput={courseInput}
            courseKeepingEnabled={courseKeepingEnabled}
            vectorsVisible={vectorsVisible}
            asdicVisible={asdicVisible}
            asdicContact={asdicContact}
            contactPlot={contactPlot}
            ringVisible={ringVisible}
            ringAge={ringAge}
            submarine={submarine}
            mapTheme={mapTheme}
            mapInfoVisible={mapInfoVisible}
            visualRangeVisible={visualRangeVisible}
            legendVisible={legendVisible}
            asdicMode={asdicMode}
            asdicSearchArcDeg={asdicSearchArcDeg}
            asdicSearchDirectionDeg={asdicSearchDirectionDeg}
          />
        </div>

        <div style={{ position: "fixed", left: "24px", bottom: "24px", zIndex: 3, width: "408px", maxWidth: "408px" }}>
        <InstrumentPanel
          ship={ship}
          controls={controls}
          setControls={setControls}
          environment={environment}
          setEnvironment={setEnvironment}
          timeScale={timeScale}
          setTimeScale={setTimeScale}
          paused={paused}
          setPaused={setPaused}
          vectorsVisible={vectorsVisible}
          setVectorsVisible={setVectorsVisible}
          mapTheme={mapTheme}
          setMapTheme={setMapTheme}
          uiSnapEnabled={uiSnapEnabled}
          setUiSnapEnabled={setUiSnapEnabled}
          setCourseKeepingEnabled={setCourseKeepingEnabled}
          orderedCourseDeg={orderedCourseDeg}
          courseKeepingEnabled={courseKeepingEnabled}
          asdicContact={asdicContact}
        />
        </div>

        <DraggablePanel snapEnabled={uiSnapEnabled} style={{ position: "fixed", left: "24px", top: "168px", zIndex: 3, width: "192px" }}>
          <AsdicPanel
            asdicVisible={asdicVisible}
            setAsdicVisible={setAsdicVisible}
            asdicContact={asdicContact}
            onPing={handleAsdicPing}
            canPing={canPing}
            pingCooldownRemaining={pingCooldownRemaining}
            asdicMode={asdicMode}
            onSetMode={handleAsdicMode}
            bearingLabel={bearingLabel}
            buttonStyle={buttonStyle}
            activeButtonStyle={activeButtonStyle}
            onSetSearchArc={setAsdicSearchArcDeg}
            onSetSearchDirection={setAsdicSearchDirectionDeg}
            shipHeadingDeg={ship.headingDeg}
          />
        </DraggablePanel>

        <DraggablePanel snapEnabled={uiSnapEnabled} style={{ position: "fixed", left: "calc(50% - 120px)", bottom: "48px", zIndex: 3, width: "240px" }}>
          <ZoomPanel zoom={zoom} setZoom={setZoom} />
        </DraggablePanel>

        <DraggablePanel snapEnabled={uiSnapEnabled} style={{ position: "fixed", left: "456px", bottom: "24px", zIndex: 3, width: "192px" }}>
          <WeatherPanel
            environment={environment}
            setEnvironment={setEnvironment}
            AutoPanel={AutoPanel}
            labelStyle={labelStyle}
            StatusBox={StatusBox}
            SEA_STATES={SEA_STATES}
          />
        </DraggablePanel>

        <DraggablePanel snapEnabled={uiSnapEnabled} style={{ position: "fixed", left: "calc(50% + 144px)", bottom: "48px", zIndex: 3, width: "168px" }}>
          <MapLayersPanel
            environment={environment}
            setEnvironment={setEnvironment}
            vectorsVisible={vectorsVisible}
            setVectorsVisible={setVectorsVisible}
            visualRangeVisible={visualRangeVisible}
            setVisualRangeVisible={setVisualRangeVisible}
            mapInfoVisible={mapInfoVisible}
            setMapInfoVisible={setMapInfoVisible}
            legendVisible={legendVisible}
            setLegendVisible={setLegendVisible}
            mapTheme={mapTheme}
            setMapTheme={setMapTheme}
            uiSnapEnabled={uiSnapEnabled}
            setUiSnapEnabled={setUiSnapEnabled}
            AutoPanel={AutoPanel}
            labelStyle={labelStyle}
            buttonStyle={buttonStyle}
            activeButtonStyle={activeButtonStyle}
          />
        </DraggablePanel>

        <DraggablePanel snapEnabled={uiSnapEnabled} style={{ position: "fixed", right: "24px", top: "24px", zIndex: 3, width: "336px" }}>
        <DevelopmentPanel
          onFullAhead={handleFullAhead}
          onHardStarboard={handleHardStarboard}
          onCrashStop={handleCrashStop}
          onReset={handleResetTrial}
        />
        </DraggablePanel>

        <DraggablePanel snapEnabled={uiSnapEnabled} style={{ position: "fixed", right: "24px", bottom: "24px", zIndex: 3, width: "432px" }}>
          <SimulationLog
            panelStyle={panelStyle}
            labelStyle={labelStyle}
            simulationLog={logs}
          />
        </DraggablePanel>
      </div>
    </div>
  );
}
