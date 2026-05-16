/**
 * Cloud renderer extraction checkpoint.
 *
 * IMPORTANT:
 * - App.jsx is still the source of truth.
 * - This file is a parity target only.
 * - Do not import it into App.jsx until it visually matches the local drawCloudLayer().
 */

const DEG = Math.PI / 180;
const SHIP_MARKER_BASE_ZOOM = 0.22;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function headingToVector(headingDeg) {
  const rad = (headingDeg - 90) * DEG;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

function getSunModel(ship) {
  const simTime = ship?.simTime ?? 12 * 3600;
  const daySeconds = ((simTime % 86400) + 86400) % 86400;
  const hour = daySeconds / 3600;

  // Simple Atlantic theatre day/night model. Sunrise/sunset are deliberately broad
  // because this is a visual gameplay layer, not an astronomical calculator.
  const daylight = clamp(Math.sin(((hour - 6) / 12) * Math.PI), 0, 1);
  const warmLowSun = clamp(1 - Math.abs(hour - 6) / 2.6, 0, 1) + clamp(1 - Math.abs(hour - 18) / 2.6, 0, 1);
  const sunHeadingDeg = 100 + hour * 11;
  const sunVector = headingToVector(sunHeadingDeg);

  return {
    daylight,
    warmLowSun: clamp(warmLowSun, 0, 1),
    shadowX: -sunVector.x,
    shadowY: -sunVector.y,
  };
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function getCameraAltitudeM(zoom) {
  return Math.round(2600 / Math.max(zoom, 0.01));
}

export function drawCloudLayer(ctx, w, h, ship, environment, mapTheme, zoom, panOffset) {
  if (!environment?.cloudsVisible) return;

  const cover = clamp(environment.cloudCoverOktas ?? 0, 0, 8);
  if (cover <= 0) return;

  const wind = headingToVector(environment.windDirDeg ?? 245);
  const drift = (ship?.simTime ?? 0) * (environment.windKn ?? 0) * 0.28;
  const wrapPositive = (value, span) => ((value % span) + span) % span;

  const cloudBaseM = clamp(environment.cloudBaseM ?? 1800, 300, 5000);
  const cameraAltitudeM = getCameraAltitudeM(zoom);

  // Below cloud base the camera has passed through the cloud layer: clean sea/map view.
  if (cameraAltitudeM < cloudBaseM) return;

  const sun = getSunModel(ship);

  const dayCloud = mapTheme === "atlantic" ? [226, 245, 242] : [255, 255, 255];
  const duskCloud = [245, 214, 172];
  const nightCloud = [76, 91, 112];
  const baseFill = mixRgb(mixRgb(nightCloud, dayCloud, sun.daylight), duskCloud, sun.warmLowSun * 0.38);

  const dayShadow = mapTheme === "atlantic" ? [42, 70, 78] : [120, 112, 95];
  const duskShadow = [91, 65, 58];
  const nightShadow = [20, 28, 42];
  const shadowFill = mixRgb(mixRgb(nightShadow, dayShadow, sun.daylight), duskShadow, sun.warmLowSun * 0.45);

  const cellBase = mapTheme === "atlantic" ? 54 : 50;

  const cloudLayers = [
    { baseM: Math.max(300, cloudBaseM * 0.48), parallax: 0.78, scaleBias: 0.72, sizeBias: 3.8, alpha: 0.82, seedOffset: 0, count: 7 },
    { baseM: cloudBaseM, parallax: 0.62, scaleBias: 0.92, sizeBias: 5.4, alpha: 0.72, seedOffset: 900, count: 7 },
    { baseM: Math.min(5000, cloudBaseM * 1.85), parallax: 0.42, scaleBias: 1.14, sizeBias: 7.2, alpha: 0.58, seedOffset: 1800, count: 5 },
  ];

  function drawSoftDiamond(localCtx, x, y, size, angle, alpha, rgb) {
    localCtx.save();
    localCtx.translate(x, y);
    localCtx.rotate(angle + Math.PI / 4);
    // Soft projected cloud shadow. Morning/evening sun creates longer shadows,
    // midday compresses them, adding depth without turning clouds into dark blobs.
    const lowSunFactor = 1 - sun.daylight * 0.78;
    const shadowDistance = size * (0.12 + lowSunFactor * 0.42);

    localCtx.shadowColor = `rgba(${shadowFill[0]},${shadowFill[1]},${shadowFill[2]},${alpha * (2.8 + lowSunFactor * 2.4)})`;
    localCtx.shadowBlur = size * (1.15 + lowSunFactor * 1.35);
    localCtx.shadowOffsetX = sun.shadowX * shadowDistance;
    localCtx.shadowOffsetY = sun.shadowY * shadowDistance;
    localCtx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(0.72, alpha * 3.4)})`;
    localCtx.fillRect(-size / 2, -size / 2, size, size);
    localCtx.restore();
  }

  ctx.save();

  cloudLayers.forEach((layer) => {
    const layerFade = clamp((cameraAltitudeM - layer.baseM) / 1200, 0, 1);
    if (layerFade <= 0.015) return;
    const zoomRatio = Math.max(zoom, 0.02) / SHIP_MARKER_BASE_ZOOM;
    const layerScale = clamp(1 + Math.log2(zoomRatio) * 0.12 * layer.scaleBias, 0.76, 1.70);
    const layerCount = Math.round(layer.count + cover * 0.75);

    for (let i = 0; i < layerCount; i += 1) {
      const spanX = w + 640;
      const spanY = h + 520;

      const seedX = (i * 307 + 53 + layer.seedOffset) % 4000;
      const seedY = (i * 191 + 97 + layer.seedOffset) % 3000;

      const layerPanX = (panOffset?.x ?? 0) * layer.parallax;
      const layerPanY = (panOffset?.y ?? 0) * layer.parallax;

      const shipScrollX = -(ship?.x ?? 0) * zoom * layer.parallax;
      const shipScrollY = -(ship?.y ?? 0) * zoom * layer.parallax;

      const x = wrapPositive(seedX + wind.x * drift * layer.parallax + layerPanX + shipScrollX, spanX) - 320;
      const y = wrapPositive(seedY + wind.y * drift * layer.parallax + layerPanY + shipScrollY, spanY) - 260;

      const density = clamp(cover / 8 + ((i * 17 + layer.seedOffset) % 9) / 48, 0.18, 1);
      const size = (34 + density * 22) * layer.sizeBias * layerScale;

      // Fade out when the camera descends below the cloud layer.
      // Do not enforce a minimum alpha here; otherwise the player can never pass through clouds.
      ctx.globalAlpha = layerFade * layer.alpha * (0.88 + density * 0.22);

      drawSoftDiamond(ctx, x, y, size * 1.4, 0, 0.08, shadowFill);
      drawSoftDiamond(ctx, x, y, size, 0, 0.18, baseFill);
    }
  });

  ctx.restore();
}

// (drawSoftDiamond is now defined inside drawCloudLayer)