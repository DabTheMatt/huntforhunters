import { useEffect, useRef, useState } from "react";

const PING_INTERVAL_OPTIONS = [3, 5, 8, 12];
const SEARCH_ARC_OPTIONS = [360, 180, 90, 45];
const normalizeBearing = (degrees) => ((Math.round(degrees) % 360) + 360) % 360;
const formatBearing = (degrees) => `${String(normalizeBearing(degrees)).padStart(3, "0")}°`;

export default function AsdicPanel({
  asdicVisible,
  setAsdicVisible,
  asdicContact,
  onPing,
  canPing,
  pingCooldownRemaining,
  asdicMode,
  onSetMode,
  bearingLabel,
  buttonStyle,
  activeButtonStyle,
  onSetSearchArc,
  onSetSearchDirection,
  shipHeadingDeg = 0,
}) {
  const [autoPingEnabled, setAutoPingEnabled] = useState(false);
  const [pingIntervalSeconds, setPingIntervalSeconds] = useState(3);
  const [searchArcDeg, setSearchArcDeg] = useState(180);
  const [searchDirectionDeg, setSearchDirectionDeg] = useState(0);
  const projectorBearingDeg = normalizeBearing(shipHeadingDeg + searchDirectionDeg);
  const knobRotationDeg = -normalizeBearing(shipHeadingDeg);

  const getKnobLabelStyle = (relativeDeg, color = "#a8a29e") => {
    const angleRad = ((normalizeBearing(shipHeadingDeg + relativeDeg) - 90) * Math.PI) / 180;
    const radiusPx = 24;

    return {
      position: "absolute",
      left: `${36 + Math.cos(angleRad) * radiusPx}px`,
      top: `${36 + Math.sin(angleRad) * radiusPx}px`,
      transform: "translate(-50%, -50%)",
      fontSize: "7px",
      color,
      fontFamily: "ui-monospace, monospace",
      userSelect: "none",
      pointerEvents: "none",
    };
  };

  const canPingRef = useRef(canPing);
  const onPingRef = useRef(onPing);
  const autoPingEnabledRef = useRef(autoPingEnabled);
  const searchDirectionKnobRef = useRef(null);

  useEffect(() => {
    canPingRef.current = canPing;
  }, [canPing]);

  useEffect(() => {
    onPingRef.current = onPing;
  }, [onPing]);

  useEffect(() => {
    autoPingEnabledRef.current = autoPingEnabled;
  }, [autoPingEnabled]);


  const setSearchDirectionFromPointer = (event) => {
    if (asdicMode === "attack") return;

    const rect = searchDirectionKnobRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = event.clientX - centerX;
    const deltaY = event.clientY - centerY;
    const pointerBearingDeg = normalizeBearing((Math.atan2(deltaX, -deltaY) * 180) / Math.PI);
    const nextDirectionDeg = normalizeBearing(pointerBearingDeg - shipHeadingDeg);

    setSearchDirectionDeg(nextDirectionDeg);
    onSetSearchDirection?.(nextDirectionDeg);
  };

  const lockProjectorOnEcho = () => {
    if (!asdicContact.detected) return;

    const nextDirectionDeg = normalizeBearing(asdicContact.bearingDeg - shipHeadingDeg);
    setSearchDirectionDeg(nextDirectionDeg);
    onSetSearchDirection?.(nextDirectionDeg);
  };

  useEffect(() => {
    if (!autoPingEnabled || !asdicVisible) return undefined;

    let timeoutId;

    const scheduleNextPing = () => {
      timeoutId = window.setTimeout(() => {
        if (!autoPingEnabledRef.current || !asdicVisible) return;

        if (canPingRef.current) {
          onPingRef.current?.();
        }

        scheduleNextPing();
      }, pingIntervalSeconds * 1000);
    };

    scheduleNextPing();

    return () => window.clearTimeout(timeoutId);
  }, [autoPingEnabled, asdicVisible, pingIntervalSeconds]);

  return (
    <div
      style={{
        width: "100%",
        minHeight: "276px",
        boxSizing: "border-box",
        padding: "0 12px 14px",
        background: "transparent",
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
      }}
    >

      <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 68px", gap: "6px" }}>
        <button
          style={{ ...(asdicMode === "attack" ? activeButtonStyle : buttonStyle), width: "100%", fontSize: "11px" }}
          onClick={() => {
            if (asdicMode === "attack") {
              onSetMode("search");
              return;
            }

            lockProjectorOnEcho();
            onSetMode("attack");
          }}
          title={asdicContact.detected ? "Lock projector bearing on detected echo." : "No echo to lock. Switches to tracking mode only."}
        >
          {asdicMode === "attack" ? "LOCK ON" : "LOCK OFF"}
        </button>

        <select
          value={asdicMode === "attack" ? 90 : searchArcDeg}
          disabled={asdicMode === "attack"}
          onChange={(event) => {
            const nextSearchArcDeg = Number(event.target.value);
            setSearchArcDeg(nextSearchArcDeg);
            onSetSearchArc?.(nextSearchArcDeg);
            if (asdicMode === "attack") {
              onSetMode("search");
            }
          }}
          style={{
            ...buttonStyle,
            width: "100%",
            fontSize: "11px",
            padding: "4px 2px",
            textAlign: "center",
            opacity: asdicMode === "attack" ? 0.55 : 1,
          }}
          title="Search sector"
        >
          {SEARCH_ARC_OPTIONS.map((degrees) => (
            <option key={degrees} value={degrees}>
              {degrees}°
            </option>
          ))}
        </select>

      </div>

      <div style={{ marginTop: "8px", fontSize: "10px", color: "#d6d3d1", lineHeight: 1.3 }}>
        {asdicMode === "attack"
          ? asdicContact.detected
            ? `Locked on echo ${formatBearing(asdicContact.bearingDeg)}.`
            : "Tracking mode: no echo locked."
          : `Search sector: ${searchArcDeg}° · center ${formatBearing(searchDirectionDeg)}.`}
      </div>

      <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "72px 1fr", gap: "10px", alignItems: "center" }}>
        <div
          ref={searchDirectionKnobRef}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setSearchDirectionFromPointer(event);
          }}
          onPointerMove={(event) => {
            event.stopPropagation();
            if (event.buttons !== 1) return;
            setSearchDirectionFromPointer(event);
          }}
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            border: "1px solid rgba(253,230,138,0.28)",
            background: "rgba(28,25,23,0.7)",
            position: "relative",
            cursor: asdicMode === "attack" ? "not-allowed" : "grab",
            opacity: asdicMode === "attack" ? 0.55 : 1,
            touchAction: "none",
            boxSizing: "border-box",
            userSelect: "none",
          }}
          title="Drag to train ASDIC search bearing"
        >
          <div style={getKnobLabelStyle(0, "#fde68a")}>{formatBearing(shipHeadingDeg)}</div>
          <div style={getKnobLabelStyle(90)}>{formatBearing(shipHeadingDeg + 90)}</div>
          <div style={getKnobLabelStyle(180)}>{formatBearing(shipHeadingDeg + 180)}</div>
          <div style={getKnobLabelStyle(270)}>{formatBearing(shipHeadingDeg + 270)}</div>
          <div style={{ position: "absolute", left: "50%", top: "50%", width: "1px", height: "56px", background: "rgba(253,230,138,0.12)", transform: `translate(-50%, -50%) rotate(${shipHeadingDeg}deg)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", width: "56px", height: "1px", background: "rgba(253,230,138,0.12)", transform: `translate(-50%, -50%) rotate(${shipHeadingDeg}deg)`, pointerEvents: "none" }} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "2px",
              height: "24px",
              background: "rgba(253,230,138,0.92)",
              transformOrigin: "50% 100%",
              transform: `translate(-50%, -100%) rotate(${projectorBearingDeg}deg)`,
              boxShadow: "0 0 6px rgba(253,230,138,0.34)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderBottom: "8px solid rgba(253,230,138,0.96)",
              transformOrigin: "50% 26px",
              transform: `translate(-50%, -26px) rotate(${projectorBearingDeg}deg)`,
              filter: "drop-shadow(0 0 4px rgba(253,230,138,0.34))",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "absolute", left: "50%", top: "50%", width: "7px", height: "7px", borderRadius: "50%", background: "#fde68a", transform: "translate(-50%, -50%)", pointerEvents: "none" }} />
        </div>

        <div style={{ fontSize: "10px", color: "#d6d3d1", lineHeight: 1.35 }}>
          PROJECTOR BEARING<br />
          <span style={{ color: "#fde68a", fontSize: "14px", fontFamily: "ui-monospace, monospace", fontWeight: 800 }}>
            {formatBearing(projectorBearingDeg)}
          </span>
          <div style={{ marginTop: "4px", color: "#a8a29e" }}>
            0° on dial follows ship heading. Drag knob to train ASDIC head.
          </div>
        </div>
      </div>

      <div style={{ marginTop: "8px", fontSize: "10px", color: "#d6d3d1" }}>
        {asdicVisible
          ? asdicContact.detected
            ? `${asdicContact.quality} · ${bearingLabel(asdicContact.bearingDeg)} · ${(asdicContact.distanceM * 1.09361).toFixed(0)} yd`
            : "No contact. Listening watch."
          : "ASDIC display hidden."}
      </div>

      <button
        style={{
          ...activeButtonStyle,
          marginTop: "10px",
          width: "100%",
          fontSize: "12px",
        }}
        disabled={false}
        onClick={() => onPingRef.current?.()}
        title="Send one active ASDIC pulse now."
      >
        SINGLE PING
      </button>

      <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 68px", gap: "6px" }}>
        <button
          style={{
            ...(autoPingEnabled ? activeButtonStyle : buttonStyle),
            width: "100%",
            fontSize: "11px",
          }}
          onClick={() => {
            setAutoPingEnabled((enabled) => !enabled);
          }}
          title="Repeat ASDIC pings at the selected interval."
        >
          INTERVAL {autoPingEnabled ? "ON" : "OFF"}
        </button>

        <select
          value={autoPingEnabled ? pingIntervalSeconds : "off"}
          onChange={(event) => {
            if (event.target.value === "off") {
              setAutoPingEnabled(false);
              return;
            }
            setPingIntervalSeconds(Number(event.target.value));
            setAutoPingEnabled(true);
          }}
          style={{
            ...buttonStyle,
            width: "100%",
            fontSize: "11px",
            padding: "4px 2px",
            textAlign: "center",
          }}
          title="Ping interval"
        >
          <option value="off">OFF</option>
          {PING_INTERVAL_OPTIONS.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds}s
            </option>
          ))}
        </select>
      </div>

      <button
        style={{
          ...(asdicVisible ? activeButtonStyle : buttonStyle),
          marginTop: "8px",
          width: "100%",
          fontSize: "12px",
        }}
        onClick={() => {
          setAutoPingEnabled(false);
          setAsdicVisible((v) => !v);
        }}
      >
        ASDIC {asdicVisible ? "ON" : "OFF"}
      </button>
    </div>
  );
}