import { useState } from "react";

export default function CompassPanel({
  ship,
  environment,
  orderedCourseDeg,
  courseKeepingEnabled,
  DEG,
  panelStyle,
  labelStyle,
  buttonStyle,
  bearingLabel,
  formatTime,
  collapsed = false,
}) {
  const [stopwatchStartTime, setStopwatchStartTime] = useState(null);
  const [stopwatchHeldSeconds, setStopwatchHeldSeconds] = useState(0);

  const compassSize = 212;
  const center = compassSize / 2;
  const outerRingRadius = 78;
  const cardinalRadius = 72;
  const numberRadius = 96;
  const tickOuterRadius = 88;
  const tickInnerRadius = 80;
  const clockSize = outerRingRadius * 2;
  const clockCenter = clockSize / 2;
  const clockRingRadius = clockCenter;

  const stopwatchSeconds = stopwatchStartTime === null ? stopwatchHeldSeconds : Math.max(0, ship.simTime - stopwatchStartTime + stopwatchHeldSeconds);
  const orderedHeadingErrorDeg = Number.isFinite(orderedCourseDeg)
    ? Math.abs(((orderedCourseDeg - ship.headingDeg + 540) % 360) - 180)
    : 0;
  const orderedHeadingVisible = Number.isFinite(orderedCourseDeg) && orderedHeadingErrorDeg > 1.5;
  const hourAngle = ((ship.simTime / 3600) % 12) * 30;
  const minuteAngle = ((ship.simTime / 60) % 60) * 6;
  const stopwatchSecondAngle = (stopwatchSeconds % 60) * 6;
  const stopwatchMinuteAngle = ((stopwatchSeconds / 60) % 60) * 6;

  if (collapsed) {
    return (
      <div style={{ ...panelStyle, width: "240px", minHeight: "44px", height: "44px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
        <div style={labelStyle}>Compass</div>
      </div>
    );
  }
  return (
    <div style={{ ...panelStyle, width: "240px", height: "576px", overflow: "visible" }}>
      <div style={labelStyle}>Compass</div>

      <div style={{ position: "relative", width: `${compassSize}px`, height: `${compassSize}px`, margin: "8px auto 0" }}>
        <div
          style={{
            position: "absolute",
            left: `${center - outerRingRadius}px`,
            top: `${center - outerRingRadius}px`,
            width: `${outerRingRadius * 2}px`,
            height: `${outerRingRadius * 2}px`,
            borderRadius: "50%",
            border: "1px solid rgba(253,230,138,0.55)",
          }}
        />

        {["N", "E", "S", "W"].map((label, index) => {
          const deg = index * 90;
          const angle = deg * DEG - Math.PI / 2;
          const x = center + Math.cos(angle) * cardinalRadius;
          const y = center + Math.sin(angle) * cardinalRadius;

          return (
            <div
              key={label}
              style={{
                position: "absolute",
                left: `${x}px`,
                top: `${y}px`,
                transform: "translate(-50%, -50%)",
                fontSize: "12px",
                fontWeight: 900,
                color: "#fde68a",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {label}
            </div>
          );
        })}

        {Array.from({ length: 12 }, (_, index) => index * 30).map((deg) => {
          const angle = deg * DEG - Math.PI / 2;
          const x = center + Math.cos(angle) * numberRadius;
          const y = center + Math.sin(angle) * numberRadius;

          return (
            <div
              key={`num-${deg}`}
              style={{
                position: "absolute",
                left: `${x}px`,
                top: `${y}px`,
                transform: "translate(-50%, -50%)",
                fontSize: deg % 90 === 0 ? "9px" : "8px",
                fontWeight: deg % 90 === 0 ? 800 : 600,
                color: deg % 90 === 0 ? "#fde68a" : "#d6d3d1",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {String(deg).padStart(3, "0")}
            </div>
          );
        })}

        {Array.from({ length: 36 }, (_, index) => index * 10).map((deg) => {
          const angle = deg * DEG - Math.PI / 2;
          const isMajor = deg % 30 === 0;
          const x1 = center + Math.cos(angle) * tickInnerRadius;
          const y1 = center + Math.sin(angle) * tickInnerRadius;
          const x2 = center + Math.cos(angle) * tickOuterRadius;
          const y2 = center + Math.sin(angle) * tickOuterRadius;
          const length = Math.hypot(x2 - x1, y2 - y1);

          return (
            <div
              key={`tick-${deg}`}
              style={{
                position: "absolute",
                left: `${x1}px`,
                top: `${y1}px`,
                width: `${length}px`,
                height: isMajor ? "2px" : "1px",
                background: isMajor ? "rgba(253,230,138,0.82)" : "rgba(214,211,209,0.52)",
                transformOrigin: "0 50%",
                transform: `rotate(${angle}rad)`,
              }}
            />
          );
        })}

        <div
          title="Ship heading"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "2px",
            height: "64px",
            background: "#f5f5f4",
            transformOrigin: "50% 100%",
            transform: `translate(-50%, -100%) rotate(${ship.headingDeg}deg)`,
            boxShadow: "0 0 6px rgba(245,245,244,0.28)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "-8px",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: "11px solid #f5f5f4",
              transform: "translateX(-50%)",
            }}
          />
        </div>

        {orderedHeadingVisible && (() => {
          const angle = orderedCourseDeg * DEG - Math.PI / 2;
          const markerRadius = outerRingRadius - 16;
          const x = center + Math.cos(angle) * markerRadius;
          const y = center + Math.sin(angle) * markerRadius;
          return (
            <div
              title="Ordered heading"
              style={{
                position: "absolute",
                left: `${x}px`,
                top: `${y}px`,
                width: "2px",
                height: "14px",
                background: "rgba(49, 139, 119, 0.95)",
                transformOrigin: "50% 100%",
                transform: `translate(-50%, -100%) rotate(${orderedCourseDeg}deg)`,
                filter: "drop-shadow(0 0 5px rgba(49,139,119,0.35))",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "-7px",
                  width: 0,
                  height: 0,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderBottom: "10px solid rgba(49, 139, 119, 0.95)",
                  transform: "translateX(-50%)",
                }}
              />
            </div>
          );
        })()}

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "4px",
            height: "62px",
            background: "rgba(56,189,248,0.45)",
            transformOrigin: "50% 100%",
            transform: `translate(-50%, -100%) rotate(${environment.windDirDeg}deg)`,
            opacity: 0.62,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "-8px",
              width: 0,
              height: 0,
              borderLeft: "7px solid transparent",
              borderRight: "7px solid transparent",
              borderBottom: "12px solid rgba(56,189,248,0.55)",
              transform: "translateX(-50%)",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: "6px", fontSize: "10px", color: "#d6d3d1", textAlign: "center" }}>
        HDG {bearingLabel(ship.headingDeg)} {orderedHeadingVisible && <span style={{ color: "rgba(49, 139, 119, 0.95)", fontWeight: 800 }}>· ORD HDG {bearingLabel(orderedCourseDeg)}</span>} <br></br> WIND {bearingLabel(environment.windDirDeg)} · <span style={{ color: "rgba(56,189,248,0.72)", fontWeight: 800 }}>{environment.windKn} kn</span>
      </div>

      <div style={{ margin: "14px auto 0", width: `${clockSize}px`, height: `${clockSize}px`, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(103,86,68,0.88)", background: "rgba(203,188,137,0.92)", boxShadow: "inset 0 0 18px rgba(80,64,42,0.18)" }} />
        {Array.from({ length: 60 }, (_, index) => index).map((second) => {
          if (second % 5 === 0) return null;
          const angle = second * 6 * DEG - Math.PI / 2;
          const x1 = clockCenter + Math.cos(angle) * (clockRingRadius - 7);
          const y1 = clockCenter + Math.sin(angle) * (clockRingRadius - 7);
          const x2 = clockCenter + Math.cos(angle) * (clockRingRadius - 1);
          const y2 = clockCenter + Math.sin(angle) * (clockRingRadius - 1);
          return (
            <div
              key={`clock-second-${second}`}
              style={{
                position: "absolute",
                left: `${x1}px`,
                top: `${y1}px`,
                width: `${Math.hypot(x2 - x1, y2 - y1)}px`,
                height: "1px",
                background: "rgba(57,45,31,0.55)",
                transformOrigin: "0 50%",
                transform: `rotate(${angle}rad)`,
              }}
            />
          );
        })}
        {Array.from({ length: 12 }, (_, index) => index).map((hour) => {
          const angle = hour * 30 * DEG - Math.PI / 2;
          const x1 = clockCenter + Math.cos(angle) * (clockRingRadius - 13);
          const y1 = clockCenter + Math.sin(angle) * (clockRingRadius - 13);
          const x2 = clockCenter + Math.cos(angle) * (clockRingRadius - 1);
          const y2 = clockCenter + Math.sin(angle) * (clockRingRadius - 1);
          return (
            <div
              key={`clock-${hour}`}
              style={{
                position: "absolute",
                left: `${x1}px`,
                top: `${y1}px`,
                width: `${Math.hypot(x2 - x1, y2 - y1)}px`,
                height: hour % 3 === 0 ? "0px" : "1px",
                background: hour % 3 === 0 ? "transparent" : "rgba(57,45,31,0.72)",
                transformOrigin: "0 50%",
                transform: `rotate(${angle}rad)`,
              }}
            />
          );
        })}
        {Array.from({ length: 12 }, (_, index) => index * 5).map((second) => {
          const angle = second * 6 * DEG - Math.PI / 2;
          const x = clockCenter + Math.cos(angle) * (clockRingRadius + 12);
          const y = clockCenter + Math.sin(angle) * (clockRingRadius + 12);
          return (
            <div
              key={`stopwatch-label-${second}`}
              style={{
                position: "absolute",
                left: `${x}px`,
                top: `${y}px`,
                transform: "translate(-50%, -50%)",
                fontSize: "8px",
                fontWeight: 800,
                fontFamily: "ui-monospace, monospace",
                color: "rgba(203,188,137,0.92)",
              }}
            >
              {String(second).padStart(2, "0")}
            </div>
          );
        })}
        <div style={{ position: "absolute", left: "50%", top: "50%", width: "2px", height: "44px", background: "rgba(127,29,29,0.58)", transformOrigin: "50% 100%", transform: `translate(-50%, -100%) rotate(${stopwatchMinuteAngle}deg)` }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", width: "2px", height: "64px", background: "rgba(239,68,68,0.82)", transformOrigin: "50% 100%", transform: `translate(-50%, -100%) rotate(${stopwatchSecondAngle}deg)` }}>
          <div style={{ position: "absolute", left: "50%", top: "-4px", width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderBottom: "6px solid rgba(239,68,68,0.88)", transform: "translateX(-50%)" }} />
        </div>
      </div>

      <div style={{ marginTop: "24px", display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
        <button
          style={buttonStyle}
          onClick={() => {
            if (stopwatchStartTime === null) {
              setStopwatchStartTime(ship.simTime);
            }
          }}
        >
          Start
        </button>
        <button
          style={buttonStyle}
          onClick={() => {
            if (stopwatchStartTime !== null) {
              setStopwatchHeldSeconds(Math.max(0, ship.simTime - stopwatchStartTime + stopwatchHeldSeconds));
              setStopwatchStartTime(null);
            }
          }}
        >
          Stop
        </button>
        <button
          style={buttonStyle}
          onClick={() => {
            setStopwatchStartTime(null);
            setStopwatchHeldSeconds(0);
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ marginTop: "4px", textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: "10px", color: "#a8a29e" }}>
        Stopwatch {formatTime(stopwatchSeconds)}
      </div>
    </div>
  );
}
