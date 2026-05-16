import { useEffect, useState } from "react";

export default function DevelopmentPanel({
  panelStyle,
  labelStyle,
}) {
  const [stats, setStats] = useState({
    heapUsedMb: null,
    heapLimitMb: null,
    heapPercent: null,
    fps: null,
    longTaskCount: 0,
    lastError: null,
    lastUnhandledRejection: null,
    lastUpdate: Date.now(),
  });

  useEffect(() => {
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let animationId = 0;
    let longTaskObserver = null;

    const readMemory = () => {
      const memory = typeof performance !== "undefined" && "memory" in performance
        ? performance.memory
        : null;
      if (!memory) return { heapUsedMb: null, heapLimitMb: null, heapPercent: null };

      const heapUsedMb = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const heapLimitMb = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
      const heapPercent = heapLimitMb > 0 ? Math.round((heapUsedMb / heapLimitMb) * 100) : null;

      return { heapUsedMb, heapLimitMb, heapPercent };
    };

    const tick = (now) => {
      frameCount += 1;

      if (now - lastFpsTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        const memoryStats = readMemory();

        setStats((current) => ({
          ...current,
          ...memoryStats,
          fps,
          lastUpdate: Date.now(),
        }));

        frameCount = 0;
        lastFpsTime = now;
      }

      animationId = requestAnimationFrame(tick);
    };

    const handleError = (event) => {
      setStats((current) => ({
        ...current,
        lastError: `${event.message || "Unknown error"}${event.filename ? ` @ ${event.filename.split("/").pop()}:${event.lineno || "?"}` : ""}`,
        lastUpdate: Date.now(),
      }));
    };

    const handleUnhandledRejection = (event) => {
      const reason = event.reason;
      const message = reason?.message || String(reason || "Unknown promise rejection");
      setStats((current) => ({
        ...current,
        lastUnhandledRejection: message,
        lastUpdate: Date.now(),
      }));
    };

    if ("PerformanceObserver" in window) {
      try {
        longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (!entries.length) return;
          setStats((current) => ({
            ...current,
            longTaskCount: current.longTaskCount + entries.length,
            lastUpdate: Date.now(),
          }));
        });
        longTaskObserver.observe({ entryTypes: ["longtask"] });
      } catch {
        longTaskObserver = null;
      }
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    animationId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      longTaskObserver?.disconnect();
    };
  }, []);

  const sectionTitleStyle = {
    ...(labelStyle ?? {}),
    fontSize: "10px",
    textAlign: "left",
  };

  const rowStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "6px 0",
    borderTop: "1px solid rgba(253,230,138,0.10)",
    color: "#d6d3d1",
    fontSize: "11px",
    fontFamily: "ui-monospace, monospace",
  };

  const valueStyle = {
    color: "#fde68a",
    textAlign: "right",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "60%",
  };

  const memoryLabel = stats.heapUsedMb === null
    ? "not exposed"
    : `${stats.heapUsedMb} / ${stats.heapLimitMb} MB (${stats.heapPercent}%)`;

  const healthColor = stats.lastError || stats.lastUnhandledRejection
    ? "#fca5a5"
    : stats.fps !== null && stats.fps < 25
      ? "#fde68a"
      : "#86efac";

  const healthLabel = stats.lastError || stats.lastUnhandledRejection
    ? "ERROR"
    : stats.fps !== null && stats.fps < 25
      ? "LOW FPS"
      : "OK";

  return (
    <div
      style={{
        ...(panelStyle ?? {}),
        background: panelStyle?.background ?? "rgba(28,25,23,0.92)",
        border: panelStyle?.border ?? "1px solid rgba(253,230,138,0.16)",
        borderRadius: panelStyle?.borderRadius ?? "18px",
        boxShadow: panelStyle?.boxShadow ?? "0 10px 30px rgba(0,0,0,0.32)",
        minHeight: "240px",
        width: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        padding: "20px 18px 18px",
      }}
    >
      <div
        style={{
          ...(labelStyle ?? {}),
          fontSize: labelStyle?.fontSize ?? "10px",
          textAlign: "center",
          marginBottom: "18px",
          letterSpacing: labelStyle?.letterSpacing,
        }}
      >
        DEVELOPMENT
      </div>

      <div style={{ ...sectionTitleStyle, marginBottom: "8px" }}>
        Stability Watch
      </div>

      <div style={rowStyle}>
        <span>Health</span>
        <span style={{ ...valueStyle, color: healthColor }}>{healthLabel}</span>
      </div>

      <div style={rowStyle}>
        <span>FPS</span>
        <span style={valueStyle}>{stats.fps ?? "measuring"}</span>
      </div>

      <div style={rowStyle}>
        <span>JS Heap</span>
        <span style={valueStyle}>{memoryLabel}</span>
      </div>

      <div style={rowStyle}>
        <span>Long tasks</span>
        <span style={valueStyle}>{stats.longTaskCount}</span>
      </div>

      <div style={rowStyle}>
        <span>Last error</span>
        <span title={stats.lastError || "none"} style={{ ...valueStyle, color: stats.lastError ? "#fca5a5" : "#86efac" }}>
          {stats.lastError || "none"}
        </span>
      </div>

      <div style={rowStyle}>
        <span>Promise</span>
        <span title={stats.lastUnhandledRejection || "none"} style={{ ...valueStyle, color: stats.lastUnhandledRejection ? "#fca5a5" : "#86efac" }}>
          {stats.lastUnhandledRejection || "none"}
        </span>
      </div>

      <div
        style={{
          marginTop: "14px",
          color: "#a8a29e",
          fontSize: "10px",
          lineHeight: 1.4,
          textAlign: "left",
        }}
      >
        Heap data is available only in browsers exposing performance.memory.
        Watch FPS drops, long tasks and captured runtime errors before black-screen events.
      </div>
    </div>
  );
}