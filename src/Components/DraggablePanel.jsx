import { cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from "react";

const UI_SNAP_GRID_PX = 12;
const PANEL_EDGE_MARGIN_PX = UI_SNAP_GRID_PX * 2;
const PANEL_HEADER_HEIGHT_PX = 34;
const COLLAPSED_PANEL_HEIGHT_PX = PANEL_HEADER_HEIGHT_PX;
const PANEL_GAP_PX = UI_SNAP_GRID_PX;
const PANEL_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const PANEL_TEXT_COLOR = "#fde68a";
const PANEL_BACKGROUND_ALPHA = 0.7;
const PANEL_BACKGROUND = `rgba(28,25,23,${PANEL_BACKGROUND_ALPHA})`;
const PANEL_HEADER_BACKGROUND = `rgba(68,64,60,${PANEL_BACKGROUND_ALPHA})`;
const PANEL_BORDER = "1px solid rgba(253,230,138,0.22)";
const PANEL_RADIUS_PX = 12;

const registeredPanelRects = new Map();

const snapToGrid = (value) => Math.round(value / UI_SNAP_GRID_PX) * UI_SNAP_GRID_PX;

const clampToPanelBounds = ({ left, top, width, height }) => {
  const viewportWidth = window.innerWidth || 1280;
  const viewportHeight = window.innerHeight || 720;
  const minLeft = PANEL_EDGE_MARGIN_PX;
  const minTop = PANEL_EDGE_MARGIN_PX;
  const maxLeft = Math.max(minLeft, viewportWidth - width - PANEL_EDGE_MARGIN_PX);
  const maxTop = Math.max(minTop, viewportHeight - height - PANEL_EDGE_MARGIN_PX);

  return {
    left: Math.min(Math.max(snapToGrid(left), minLeft), maxLeft),
    top: Math.min(Math.max(snapToGrid(top), minTop), maxTop),
  };
};

const getPanelTitle = (text) => {
  const normalizedText = text
    .replace(/[+−]/g, " ")
    .replace(/\bpanel\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lowerText = normalizedText.toLowerCase();

  if (lowerText.includes("simulation log")) return "Simulation Log";
  if (lowerText.includes("development")) return "Development";
  if (lowerText.includes("map layers")) return "Map Layers";
  if (lowerText.includes("engine telegraph") || lowerText.includes("engine telegram")) return "Engine Telegraph";
  if (lowerText.includes("rudder")) return "Rudder Orders";
  if (lowerText.includes("date") && lowerText.includes("time")) return "Date & Time";
  if (lowerText.includes("zoom")) return "Zoom";
  if (lowerText.includes("bridge")) return "Bridge";
  if (lowerText.includes("weather")) return "Weather";
  if (lowerText.includes("asdic")) return "ASDIC";
  if (lowerText.includes("compass") || lowerText.includes("compas")) return "Compass";
  if (lowerText.includes("radar")) return "Radar";
  if (lowerText.includes("gunnery")) return "Gunnery";
  if (lowerText.includes("damage")) return "Damage";
  if (lowerText.includes("convoy")) return "Convoy";
  if (lowerText.includes("signals")) return "Signals";

  return normalizedText.split(" ").slice(0, 3).join(" ") || "Panel";
};


const getPanelTitleFromChild = (child) => {
  if (!isValidElement(child)) return null;

  const componentName = child.type?.displayName || child.type?.name || "";
  const normalizedName = componentName.toLowerCase();
  const childClassName = `${child.props?.className ?? ""}`.toLowerCase();
  const childDataTitle = `${child.props?.title ?? child.props?.panelTitle ?? child.props?.name ?? ""}`.toLowerCase();
  const childIdentity = `${normalizedName} ${childClassName} ${childDataTitle}`;

  if (childIdentity.includes("simulationlog") || childIdentity.includes("simulation-log") || childIdentity.includes("simulation log")) return "Simulation Log";
  if (childIdentity.includes("development")) return "Development";
  if (childIdentity.includes("maplayers") || childIdentity.includes("map-layers") || childIdentity.includes("map layers")) return "Map Layers";
  if (childIdentity.includes("enginetelegraph") || childIdentity.includes("engine-telegraph") || childIdentity.includes("engine telegraph")) return "Engine Telegraph";
  if (childIdentity.includes("rudder")) return "Rudder Orders";
  if (childIdentity.includes("date") || childIdentity.includes("time")) return "17 MAY 1943";
  if (childIdentity.includes("zoom")) return "Zoom";
  if (childIdentity.includes("bridge")) {
    const grafton = child.props?.grafton;
    if (grafton?.name && grafton?.className) {
      return `Bridge · ${grafton.name} · ${grafton.className}`;
    }
    return "Bridge";
  }
  if (childIdentity.includes("weather")) return "Weather";
  if (childIdentity.includes("asdic")) return "ASDIC";
  if (childIdentity.includes("compass")) return "Compass";
  if (childIdentity.includes("radar")) return "Radar";
  if (childIdentity.includes("gunnery")) return "Gunnery";
  if (childIdentity.includes("damage")) return "Damage";
  if (childIdentity.includes("convoy")) return "Convoy";
  if (childIdentity.includes("signals")) return "Signals";

  return null;
};

const getPanelLayoutKeyFromChild = (child) => {
  return getPanelTitleFromChild(child)?.toLowerCase() ?? "";
};

const usesSquareCollapsedEdge = () => true;

const getPanelLayoutPreference = ({ text, layoutKey, width, height }) => {
  const normalizedText = `${layoutKey} ${text}`.toLowerCase();
  const viewportWidth = window.innerWidth || 1280;
  const viewportHeight = window.innerHeight || 720;

  if (normalizedText.includes("simulation log") || normalizedText.includes("log")) {
    return {
      position: clampToPanelBounds({
        left: viewportWidth - width - PANEL_EDGE_MARGIN_PX,
        top: viewportHeight - height - PANEL_EDGE_MARGIN_PX,
        width,
        height,
      }),
    };
  }

  if (normalizedText.includes("development")) {
    return {
      position: clampToPanelBounds({
        left: viewportWidth - width - PANEL_EDGE_MARGIN_PX,
        top: PANEL_EDGE_MARGIN_PX,
        width,
        height,
      }),
      collapsed: true,
    };
  }

  if (normalizedText.includes("weather")) {
    return {
      position: clampToPanelBounds({
        left: PANEL_EDGE_MARGIN_PX,
        top: PANEL_EDGE_MARGIN_PX,
        width,
        height,
      }),
    };
  }

  if (normalizedText.includes("map layers") || normalizedText.includes("layers")) {
    return {
      position: clampToPanelBounds({
        left: PANEL_EDGE_MARGIN_PX + UI_SNAP_GRID_PX * 32,
        top: PANEL_EDGE_MARGIN_PX,
        width,
        height,
      }),
    };
  }

  if (normalizedText.includes("bridge")) {
    return {
      position: clampToPanelBounds({
        left: PANEL_EDGE_MARGIN_PX,
        top: PANEL_EDGE_MARGIN_PX + UI_SNAP_GRID_PX * 22,
        width,
        height,
      }),
    };
  }

  if (normalizedText.includes("rudder")) {
    return {
      position: clampToPanelBounds({
        left: PANEL_EDGE_MARGIN_PX + UI_SNAP_GRID_PX * 32,
        top: PANEL_EDGE_MARGIN_PX + UI_SNAP_GRID_PX * 22,
        width,
        height,
      }),
    };
  }

  if (normalizedText.includes("asdic")) {
    return {
      position: clampToPanelBounds({
        left: PANEL_EDGE_MARGIN_PX + UI_SNAP_GRID_PX * 64,
        top: PANEL_EDGE_MARGIN_PX,
        width,
        height,
      }),
    };
  }

  return null;
};

const overlaps = (firstRect, secondRect) => {
  return !(
    firstRect.left + firstRect.width + PANEL_GAP_PX <= secondRect.left ||
    secondRect.left + secondRect.width + PANEL_GAP_PX <= firstRect.left ||
    firstRect.top + firstRect.height + PANEL_GAP_PX <= secondRect.top ||
    secondRect.top + secondRect.height + PANEL_GAP_PX <= firstRect.top
  );
};

const findOpenPanelPosition = ({ left, top, width, height }, panelId) => {
  const boundedInitialPosition = clampToPanelBounds({ left, top, width, height });
  let nextLeft = boundedInitialPosition.left;
  let nextTop = boundedInitialPosition.top;
  const viewportWidth = window.innerWidth || 1280;
  const viewportHeight = window.innerHeight || 720;
  const maxAttempts = 120;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidateRect = { left: nextLeft, top: nextTop, width, height };
    const collides = [...registeredPanelRects.entries()].some(([registeredId, registeredRect]) => {
      return registeredId !== panelId && overlaps(candidateRect, registeredRect);
    });

    if (!collides) return { left: nextLeft, top: nextTop };

    nextLeft += width + PANEL_GAP_PX;

    if (nextLeft + width > viewportWidth - PANEL_EDGE_MARGIN_PX) {
      nextLeft = PANEL_EDGE_MARGIN_PX;
      nextTop += height + PANEL_GAP_PX;
    }

    if (nextTop + height > viewportHeight - PANEL_EDGE_MARGIN_PX) {
      nextTop = PANEL_EDGE_MARGIN_PX;
    }
  }

  return boundedInitialPosition;
};

export default function DraggablePanel({ children, style = {}, snapEnabled = true, width, defaultCollapsed = false }) {
  const [position, setPosition] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [panelTitle, setPanelTitle] = useState("Panel");
  const initializedRef = useRef(false);
  const dragStartRef = useRef(null);
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const panelIdRef = useRef(Symbol("draggable-panel"));

  const isInteractiveTarget = (target) => {
    return Boolean(target.closest?.("button, input, select, textarea, option"));
  };

  const rememberPanelRect = (nextPosition = position) => {
    if (!panelRef.current || !nextPosition) return;

    const rect = panelRef.current.getBoundingClientRect();
    registeredPanelRects.set(panelIdRef.current, {
      left: nextPosition.left,
      top: nextPosition.top,
      width: rect.width,
      height: rect.height,
    });
  };

  useLayoutEffect(() => {
    if (!panelRef.current || position) return;

    const rect = panelRef.current.getBoundingClientRect();
    const panelText = panelRef.current.textContent ?? "";
    const childTitle = getPanelTitleFromChild(children);
    const hasExplicitPosition =
      style.left !== undefined ||
      style.right !== undefined ||
      style.top !== undefined ||
      style.bottom !== undefined;
    const layoutPreference = hasExplicitPosition
      ? null
      : getPanelLayoutPreference({
          text: panelText,
          layoutKey: getPanelLayoutKeyFromChild(children),
          width: rect.width,
          height: rect.height,
        });
    setPanelTitle(childTitle ?? getPanelTitle(panelText));

    const initialPosition = layoutPreference?.position ?? findOpenPanelPosition(
      {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      panelIdRef.current,
    );

    if (!initializedRef.current && (defaultCollapsed || layoutPreference?.collapsed)) {
      setCollapsed(true);
    }
    initializedRef.current = true;

    registeredPanelRects.set(panelIdRef.current, {
      ...initialPosition,
      width: rect.width,
      height: layoutPreference?.collapsed ? COLLAPSED_PANEL_HEIGHT_PX : rect.height,
    });
    setPosition(initialPosition);
  }, [children, position, style.left, style.right, style.top, style.bottom, defaultCollapsed]);

  useEffect(() => {
    return () => {
      registeredPanelRects.delete(panelIdRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    rememberPanelRect();
  }, [collapsed, position]);

useLayoutEffect(() => {
  if (!contentRef.current) return;

  const normalizedPanelTitle = panelTitle
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const normalizedPanelBaseTitle = normalizedPanelTitle
    .replace(/\s+(room|orders|panel|controls?|station|display|readout)$/i, "")
    .trim();
  const duplicateTitleCandidates = contentRef.current.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, header, [data-panel-title], [class*='title' i], [class*='heading' i], [class*='header' i]"
  );

  duplicateTitleCandidates.forEach((element) => {
    const normalizedElementText = element.textContent
      .replace(/[+−]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const normalizedElementBaseText = normalizedElementText
      .replace(/\bpanel\b/gi, "")
      .replace(/\s+(room|orders|controls?|station|display|readout)$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    const compactDuplicate = normalizedElementText.length <= normalizedPanelTitle.length + 24;
    const titleMatches =
      normalizedElementText === normalizedPanelTitle ||
      normalizedElementText === `${normalizedPanelTitle} panel` ||
      normalizedElementText.startsWith(`${normalizedPanelTitle} `) ||
      normalizedElementBaseText === normalizedPanelBaseTitle ||
      normalizedElementBaseText.startsWith(`${normalizedPanelBaseTitle} `) ||
      normalizedPanelBaseTitle.startsWith(`${normalizedElementBaseText} `);

    if (compactDuplicate && titleMatches) {
      element.style.display = "none";
    }
  });
}, [children, panelTitle]);

  const startDrag = (event) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;

    const rect = panelRef.current?.getBoundingClientRect();
    const currentPosition = position ?? (rect ? { left: rect.left, top: rect.top } : { left: 0, top: 0 });

    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: currentPosition.left,
      top: currentPosition.top,
    };
    setPosition(currentPosition);
    setDragging(true);
    event.preventDefault();
  };

  useEffect(() => {
    const onDrag = (event) => {
      if (!dragging || !dragStartRef.current) return;

      let left = dragStartRef.current.left + (event.clientX - dragStartRef.current.pointerX);
      let top = dragStartRef.current.top + (event.clientY - dragStartRef.current.pointerY);

      const rect = panelRef.current?.getBoundingClientRect();
      const nextPosition = rect
        ? clampToPanelBounds({ left, top, width: rect.width, height: rect.height })
        : {
            left: snapEnabled ? snapToGrid(left) : left,
            top: snapEnabled ? snapToGrid(top) : top,
          };
      setPosition(nextPosition);
      rememberPanelRect(nextPosition);
    };

    const stopDrag = () => {
      if (panelRef.current && position) {
        rememberPanelRect(position);
      }

      dragStartRef.current = null;
      setDragging(false);
    };

    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", stopDrag);

    return () => {
      window.removeEventListener("mousemove", onDrag);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, [dragging, position, snapEnabled]);

  const panelContent = isValidElement(children)
    ? cloneElement(children, { collapsed })
    : children;

  const squareCollapsedEdge = usesSquareCollapsedEdge(panelTitle);

  return (
    <>
      {dragging && snapEnabled && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
            backgroundColor: "rgba(0,0,0,0.04)",
            backgroundImage: `linear-gradient(rgba(253,230,138,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(253,230,138,0.18) 1px, transparent 1px)`,
            backgroundSize: `${UI_SNAP_GRID_PX}px ${UI_SNAP_GRID_PX}px`,
            backgroundPosition: "0 0",
          }}
        />
      )}

      <div
        ref={panelRef}
        onMouseDown={startDrag}
        style={{
          ...style,
          ...(position
            ? {
                left: `${position.left}px`,
                top: `${position.top}px`,
                right: "auto",
                bottom: "auto",
              }
            : {
                left: style.left,
                right: style.right,
                top: style.top,
                bottom: style.bottom,
              }),
          width: width ?? style.width,
          minWidth: width ?? style.width,
          maxWidth: width ?? style.width,
          height: collapsed ? `${COLLAPSED_PANEL_HEIGHT_PX}px` : style.height,
          minHeight: collapsed ? `${COLLAPSED_PANEL_HEIGHT_PX}px` : style.minHeight,
          maxHeight: collapsed ? `${COLLAPSED_PANEL_HEIGHT_PX}px` : style.maxHeight,
          overflow: collapsed ? "hidden" : style.overflow,
          background: PANEL_BACKGROUND,
          border: PANEL_BORDER,
          borderRadius: `${PANEL_RADIUS_PX}px`,
          color: PANEL_TEXT_COLOR,
          fontFamily: PANEL_FONT_FAMILY,
          padding: 0,
          cursor: dragging ? "grabbing" : "grab",
          userSelect: dragging ? "none" : "auto",
          outline: dragging && snapEnabled ? "1px dashed rgba(250,204,21,0.85)" : "none",
          outlineOffset: "0px",
          boxSizing: "border-box",
          transition: dragging ? "none" : "height 160ms ease, min-height 160ms ease, max-height 160ms ease, border-radius 160ms ease",
          position: "fixed",
        }}
      >
        <div
          style={{
            height: `${PANEL_HEADER_HEIGHT_PX}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "0 34px",
            boxSizing: "border-box",
            borderBottom: collapsed ? "none" : "1px solid rgba(253,230,138,0.14)",
            color: PANEL_TEXT_COLOR,
            fontFamily: PANEL_FONT_FAMILY,
            fontSize: "11px",
            lineHeight: 1,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background: PANEL_HEADER_BACKGROUND,
            borderRadius: `${PANEL_RADIUS_PX}px ${PANEL_RADIUS_PX}px 0 0`,
            userSelect: "none",
            cursor: dragging ? "grabbing" : "grab",
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "center",
              width: "100%",
            }}
          >
            {panelTitle}
          </span>
          <button
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            title="Panel information"
            aria-label="Panel information"
            style={{
              position: "absolute",
              right: "28px",
              top: "8px",
              flex: "0 0 auto",
              width: "18px",
              height: "18px",
              zIndex: 1000,
              border: "1px solid rgba(253,230,138,0.24)",
              borderRadius: "4px",
              background: PANEL_BACKGROUND,
              color: PANEL_TEXT_COLOR,
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 900,
              lineHeight: "17px",
              padding: 0,
              fontFamily: PANEL_FONT_FAMILY,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            i
          </button>
          <button
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setCollapsed((old) => !old)}
            title={collapsed ? "Expand panel" : "Collapse panel"}
            style={{
              position: "absolute",
              right: "8px",
              top: "8px",
              flex: "0 0 auto",
              width: "18px",
              height: "18px",
              zIndex: 1000,
              border: "1px solid rgba(253,230,138,0.24)",
              borderRadius: "4px",
              background: collapsed ? PANEL_HEADER_BACKGROUND : PANEL_BACKGROUND,
              color: PANEL_TEXT_COLOR,
              cursor: "pointer",
              fontSize: "12px",
              lineHeight: "16px",
              padding: 0,
              fontFamily: PANEL_FONT_FAMILY,
            }}
          >
            {collapsed ? "+" : "−"}
          </button>
        </div>
        <div
          ref={contentRef}
          style={{
            display: collapsed ? "none" : "block",
            color: "inherit",
            fontFamily: "inherit",
            background: "transparent",
            borderRadius: `0 0 ${PANEL_RADIUS_PX}px ${PANEL_RADIUS_PX}px`,
          }}
        >
          {panelContent}
        </div>
      </div>
    </>
  );
}