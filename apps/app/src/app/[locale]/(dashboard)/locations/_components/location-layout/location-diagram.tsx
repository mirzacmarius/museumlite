"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { cn } from "@v1/ui/utils";
import {
  Background,
  ControlButton,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  useStore,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FunctionReturnType } from "convex/server";
import {
  ChevronRight,
  type LucideIcon,
  Package,
  Scan,
  Sparkles,
  UnfoldHorizontal,
  UnfoldVertical,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isExhibitionLocation,
  isStorageLocation,
} from "@/app/[locale]/(dashboard)/locations/location-view-helpers";
import { useScopedI18n } from "@/locales/client";
import { LocationTypeIcon } from "../location-type-icon";
import {
  type DiagramSettings,
  DiagramSettingsPopover,
  useDiagramSettings,
} from "./diagram-settings";
import { readDiagramState, saveDiagramState } from "./diagram-storage";

type DiagramLocation = Pick<
  FunctionReturnType<typeof api.locations.listAll>[number],
  "_id" | "name" | "type" | "isActive" | "locationCode" | "sortOrder"
>;
type LocationObjects = FunctionReturnType<
  typeof api.locations.getObjectsAtLocation
>;

interface LocationDiagramProps {
  location: Omit<DiagramLocation, "sortOrder"> & { sortOrder?: number };
  childrenById: Map<Id<"locations">, DiagramLocation[]>;
  objectsById: Map<Id<"locations">, LocationObjects>;
  onSelectLocation: (id: Id<"locations">) => void;
}

type LocationFlowNode = Node<
  {
    settings: DiagramSettings;
    location: DiagramLocation;
    objects: LocationObjects;
    children: DiagramLocation[];
    expanded: boolean;
    horizontal: boolean;
    toggle: (id: Id<"locations">) => void;
    onSelectLocation: (id: Id<"locations">) => void;
  },
  "location"
>;

const HEADER_HEIGHT = 64;
const FOOTER_HEIGHT = 40;
const SECTION_LABEL_HEIGHT = 24;
const MAX_VISIBLE_OBJECT_ROWS = 4;
const TITLE_HANDLE_ID = "title";
const NODE_SOURCE_HANDLE_ID = "out";
const NODE_TARGET_HANDLE_ID = "in";

const LOCATION_ACCENT = {
  storage: {
    border: "border-amber-500/30",
    icon: "bg-amber-500/10 text-amber-400",
    stroke: "#f59e0b",
  },
  exhibition: {
    border: "border-emerald-500/25",
    icon: "bg-emerald-500/10 text-emerald-400",
    stroke: "#34d399",
  },
  default: {
    border: "border-border",
    icon: "bg-indigo-500/10 text-indigo-400",
    stroke: "#818cf8",
  },
} as const;

function getLocationAccent(type: string) {
  if (isStorageLocation(type)) return LOCATION_ACCENT.storage;
  if (isExhibitionLocation(type)) return LOCATION_ACCENT.exhibition;
  return LOCATION_ACCENT.default;
}

function formatLocationType(type: string, translate: (key: string) => string) {
  return [
    "building",
    "room",
    "gallery",
    "storage",
    "cabinet",
    "shelf",
    "vault",
    "other",
  ].includes(type)
    ? translate(`form.locationTypes.${type}`)
    : type;
}

function getObjectRowHeight(settings: DiagramSettings) {
  if (settings.items === "grid") return settings.size === "large" ? 154 : 110;
  return settings.size === "large" ? 68 : 44;
}

function getLocationRowHeight(settings: DiagramSettings) {
  return settings.size === "large" ? 36 : 28;
}

function getNodeWidth(size: DiagramSettings["size"]) {
  return size === "large" ? 320 : 256;
}

function estimateNodeHeight({
  settings,
  objectCount,
  childCount,
}: {
  settings: DiagramSettings;
  objectCount: number;
  childCount: number;
}) {
  const objectRowHeight = getObjectRowHeight(settings);
  const locationRowHeight = getLocationRowHeight(settings);
  const visibleObjectRows =
    settings.items === "grid"
      ? Math.min(Math.ceil(objectCount / 2), 2)
      : Math.min(objectCount, MAX_VISIBLE_OBJECT_ROWS);

  return (
    HEADER_HEIGHT +
    FOOTER_HEIGHT +
    (childCount > 0
      ? SECTION_LABEL_HEIGHT + childCount * locationRowHeight
      : 0) +
    (objectCount > 0
      ? SECTION_LABEL_HEIGHT + visibleObjectRows * objectRowHeight
      : 0)
  );
}

function sortLocations(locations: DiagramLocation[]) {
  return locations.toSorted(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

function childSourceHandleId(childId: Id<"locations">) {
  return `from-row-${childId}`;
}

function collectParentIds(
  rootId: Id<"locations">,
  childrenById: Map<Id<"locations">, DiagramLocation[]>,
) {
  const parentIds = new Set<Id<"locations">>();
  for (const [parentId, children] of childrenById) {
    if (children.length > 0) parentIds.add(parentId);
  }
  if ((childrenById.get(rootId) ?? []).length > 0) parentIds.add(rootId);
  return parentIds;
}

function collectValidIds(
  rootId: Id<"locations">,
  parentIds: Set<Id<"locations">>,
  childrenById: Map<Id<"locations">, DiagramLocation[]>,
) {
  const validIds = new Set([rootId, ...parentIds]);
  for (const children of childrenById.values()) {
    for (const child of children) validIds.add(child._id);
  }
  return validIds;
}

function LocationNode({ data }: NodeProps<LocationFlowNode>) {
  const t = useScopedI18n("untranslatedDashboard.locations");
  const tLocations = useScopedI18n("locations");
  const {
    location,
    objects,
    children,
    expanded,
    horizontal,
    toggle,
    onSelectLocation,
    settings,
  } = data;
  const grid = settings.items === "grid";
  const large = settings.size === "large";
  const accent = getLocationAccent(location.type);
  const locationRowHeight = getLocationRowHeight(settings);
  const hasChildren = children.length > 0;
  const targetHandleId = horizontal ? TITLE_HANDLE_ID : NODE_TARGET_HANDLE_ID;

  return (
    <div
      className={cn(
        "relative overflow-visible rounded-xl border bg-card shadow-lg",
        accent.border,
      )}
      style={{ width: getNodeWidth(settings.size) }}
    >
      <Handle
        type="target"
        id={targetHandleId}
        position={horizontal ? Position.Left : Position.Top}
        isConnectable={false}
        className="!size-2.5 !border-2 !border-background !bg-indigo-400"
        style={
          horizontal
            ? {
                top: HEADER_HEIGHT / 2,
                left: -5,
                transform: "translateY(-50%)",
              }
            : { top: -5, left: "50%", transform: "translateX(-50%)" }
        }
      />
      {!horizontal && hasChildren && expanded ? (
        <Handle
          type="source"
          id={NODE_SOURCE_HANDLE_ID}
          position={Position.Bottom}
          isConnectable={false}
          className="!size-2.5 !border-2 !border-background !bg-indigo-400"
          style={{ bottom: -5, left: "50%", transform: "translateX(-50%)" }}
        />
      ) : null}
      <button
        type="button"
        onClick={() => onSelectLocation(location._id)}
        className="nodrag nopan flex h-16 w-full items-center gap-2.5 px-3 text-start hover:bg-muted/40"
      >
        <span className={cn("rounded-md p-2", accent.icon)}>
          <LocationTypeIcon type={location.type} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium" title={location.name}>
            {location.name}
          </p>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">
            <span className="capitalize">
              {formatLocationType(location.type, tLocations)}
            </span>
            {location.locationCode ? (
              <>
                {" · "}
                <span className="font-mono">{location.locationCode}</span>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={
            location.isActive
              ? "size-1.5 shrink-0 rounded-full bg-emerald-500"
              : "size-1.5 shrink-0 rounded-full bg-muted-foreground"
          }
        />
      </button>

      {hasChildren && (
        <div className="border-t border-border/60">
          <div className="flex h-6 items-center px-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("locations")}
          </div>
          <div>
            {children.map((child) => (
              <div
                key={child._id}
                className="relative border-t border-border/40"
                style={{ height: locationRowHeight }}
              >
                <button
                  type="button"
                  onClick={() => onSelectLocation(child._id)}
                  className="nodrag nopan flex h-full w-full items-center gap-2 px-3 pe-4 text-start text-[10px] hover:bg-muted/50"
                >
                  <LocationTypeIcon
                    type={child.type}
                    className="size-3 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate" title={child.name}>
                    {child.name}
                  </span>
                  <span className="shrink-0 capitalize text-muted-foreground">
                    {formatLocationType(child.type, tLocations)}
                  </span>
                </button>
                {horizontal && expanded ? (
                  <Handle
                    type="source"
                    id={childSourceHandleId(child._id)}
                    position={Position.Right}
                    isConnectable={false}
                    className="!size-2.5 !border-2 !border-background !bg-indigo-400"
                    style={{
                      top: "50%",
                      right: -5,
                      transform: "translateY(-50%)",
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex h-10 items-center justify-between border-t border-border/60 px-3 text-[10px] text-muted-foreground">
        <span>{t("objectsHere", { count: objects.length })}</span>
        {hasChildren ? (
          <button
            type="button"
            aria-label={t(expanded ? "collapseLocation" : "expandLocation", {
              name: location.name,
            })}
            aria-expanded={expanded}
            onClick={() => toggle(location._id)}
            className="nodrag nopan flex items-center gap-1 rounded p-1 hover:bg-muted hover:text-foreground"
          >
            {expanded ? t("hideTree") : t("showTree")}{" "}
            <ChevronRight
              className={expanded ? "size-3 rotate-90" : "size-3"}
            />
          </button>
        ) : (
          <span className="capitalize">
            {formatLocationType(location.type, tLocations)}
          </span>
        )}
      </div>

      {objects.length > 0 && (
        <div className="border-t border-border/60">
          <div className="flex h-6 items-center px-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("objects")}
          </div>
          <div
            className={`nodrag nopan nowheel overflow-y-auto ${grid ? "grid grid-cols-2" : ""}`}
            style={{
              maxHeight:
                (grid ? 2 : MAX_VISIBLE_OBJECT_ROWS) *
                getObjectRowHeight(settings),
            }}
          >
            {objects.map((object) => (
              <Link
                key={object._id}
                href={`/objects/${object._id}`}
                className={`flex gap-2 border-t border-border/40 hover:bg-muted focus-visible:outline focus-visible:outline-indigo-400 ${grid ? "flex-col p-2" : "items-center px-3"}`}
                style={{ height: getObjectRowHeight(settings) }}
              >
                <span
                  className="relative flex shrink-0 items-center justify-center overflow-hidden rounded bg-muted"
                  style={{
                    width: grid ? "100%" : large ? 52 : 32,
                    height: grid ? (large ? 102 : 58) : large ? 52 : 32,
                  }}
                >
                  {object.thumbnailUrl ? (
                    <Image
                      src={object.thumbnailUrl}
                      alt=""
                      fill
                      sizes={grid ? "144px" : large ? "52px" : "32px"}
                      className="object-cover"
                    />
                  ) : (
                    <Package className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 w-full">
                  <span
                    className="block truncate text-[10px]"
                    title={object.title}
                  >
                    {object.title}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[9px] text-muted-foreground">
                    {object.accessionNumber}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { location: LocationNode };

const FIT_VIEW_OPTIONS = { padding: 0.04, maxZoom: 1 } as const;
const MIN_ZOOM = 0.1;
const VIEWPORT_DURATION_MS = 240;
const FIT_TOP_PADDING_PX = 16;

type FitAxis = "width" | "height" | "both";

function clampZoom(zoom: number) {
  return Math.min(FIT_VIEW_OPTIONS.maxZoom, Math.max(MIN_ZOOM, zoom));
}

function viewportForFit({
  axis,
  bounds,
  paneWidth,
  paneHeight,
}: {
  axis: FitAxis;
  bounds: { x: number; y: number; width: number; height: number };
  paneWidth: number;
  paneHeight: number;
}): Viewport | null {
  if (paneWidth <= 0 || paneHeight <= 0) return null;
  if (bounds.width <= 0 || bounds.height <= 0) return null;

  const usable = 1 - FIT_VIEW_OPTIONS.padding * 2;
  const widthZoom = (paneWidth * usable) / bounds.width;
  const heightZoom = (paneHeight * usable) / bounds.height;
  const zoom = clampZoom(
    axis === "width"
      ? widthZoom
      : axis === "height"
        ? heightZoom
        : Math.min(widthZoom, heightZoom),
  );

  return {
    x: paneWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: FIT_TOP_PADDING_PX - bounds.y * zoom,
    zoom,
  };
}

const FIT_AXIS_CONTROLS: {
  axis: Exclude<FitAxis, "both">;
  label: string;
  Icon: LucideIcon;
}[] = [
  { axis: "width", label: "fitWidth", Icon: UnfoldHorizontal },
  { axis: "height", label: "fitHeight", Icon: UnfoldVertical },
];

function DiagramToolbar({
  settings,
}: {
  settings: ReturnType<typeof useDiagramSettings>;
}) {
  return (
    <Panel position="top-right">
      <DiagramSettingsPopover settings={settings} />
    </Panel>
  );
}

function DiagramControls({
  arrangeToken,
  nodeCount,
  fitOnMount,
  onAutoArrange,
}: {
  arrangeToken: number;
  nodeCount: number;
  fitOnMount: boolean;
  onAutoArrange: () => void;
}) {
  const t = useScopedI18n("untranslatedDashboard.locations");
  const { getNodes, getNodesBounds, setViewport } = useReactFlow();
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  const didFitOnMount = useRef(false);
  const lastArrangedToken = useRef(0);

  function fitDiagram(axis: FitAxis) {
    const nodes = getNodes();
    if (nodes.length === 0) return;

    const viewport = viewportForFit({
      axis,
      bounds: getNodesBounds(nodes),
      paneWidth,
      paneHeight,
    });
    if (!viewport) return;

    void setViewport(viewport, { duration: VIEWPORT_DURATION_MS });
  }

  useEffect(() => {
    if (paneWidth <= 0 || paneHeight <= 0 || nodeCount === 0) return;

    const shouldFitFromArrange = arrangeToken > lastArrangedToken.current;
    const shouldFitFromMount = fitOnMount && !didFitOnMount.current;
    if (!shouldFitFromArrange && !shouldFitFromMount) return;

    if (shouldFitFromMount) didFitOnMount.current = true;
    if (shouldFitFromArrange) lastArrangedToken.current = arrangeToken;

    const timeoutId = window.setTimeout(() => {
      fitDiagram("both");
    }, 50);
    return () => window.clearTimeout(timeoutId);
  }, [arrangeToken, nodeCount, fitOnMount, paneWidth, paneHeight]);

  return (
    <Controls
      showInteractive={false}
      showFitView={false}
      fitViewOptions={FIT_VIEW_OPTIONS}
    >
      <ControlButton
        type="button"
        title={t("fitView")}
        aria-label={t("fitView")}
        className="react-flow__controls-fitview"
        onClick={() => fitDiagram("both")}
      >
        <Scan className="!size-3.5" />
      </ControlButton>
      {FIT_AXIS_CONTROLS.map(({ axis, label, Icon }) => (
        <ControlButton
          key={axis}
          type="button"
          title={t(label)}
          aria-label={t(label)}
          onClick={() => fitDiagram(axis)}
        >
          <Icon className="!size-3.5" />
        </ControlButton>
      ))}
      <ControlButton
        type="button"
        title={t("autoArrange")}
        aria-label={t("autoArrange")}
        onClick={onAutoArrange}
      >
        <Sparkles className="!size-3.5" />
      </ControlButton>
    </Controls>
  );
}

export function LocationDiagram({
  location: currentLocation,
  childrenById,
  objectsById,
  onSelectLocation,
}: LocationDiagramProps) {
  const tViews = useScopedI18n("untranslatedDashboard.locationViews");
  const rootId = currentLocation._id;
  const storageKey = `museumlite:diagram:${rootId}`;
  const settings = useDiagramSettings(storageKey);
  const { resolvedTheme } = useTheme();
  const colorMode = resolvedTheme === "light" ? "light" : "dark";
  const { direction, items, size, spacing, lines } = settings;
  const diagramSettings: DiagramSettings = useMemo(
    () => ({ direction, items, size, spacing, lines }),
    [direction, items, size, spacing, lines],
  );
  const rootLocation: DiagramLocation = useMemo(
    () => ({
      _id: rootId,
      name: currentLocation.name,
      type: currentLocation.type,
      isActive: currentLocation.isActive,
      locationCode: currentLocation.locationCode,
      sortOrder: currentLocation.sortOrder ?? 0,
    }),
    [
      rootId,
      currentLocation.name,
      currentLocation.type,
      currentLocation.isActive,
      currentLocation.locationCode,
      currentLocation.sortOrder,
    ],
  );
  const [{ collapsed, restored, initialViewport }, setDiagramState] = useState<{
    collapsed: Set<Id<"locations">>;
    restored: boolean;
    initialViewport?: Viewport;
  }>(() => ({ collapsed: new Set(), restored: false }));
  const [arrangeToken, setArrangeToken] = useState(0);

  useEffect(() => {
    const saved = readDiagramState(storageKey);
    const parentIds = collectParentIds(rootId, childrenById);
    const validIds = collectValidIds(rootId, parentIds, childrenById);

    setDiagramState({
      initialViewport: saved.viewport,
      collapsed: Array.isArray(saved.collapsed)
        ? new Set(
            Array.from(validIds).filter((id) => saved.collapsed?.includes(id)),
          )
        : new Set(),
      restored: true,
    });
  }, [storageKey, childrenById, rootId]);

  const toggle = useCallback(
    (id: Id<"locations">) => {
      setDiagramState((previous) => {
        const next = new Set(previous.collapsed);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveDiagramState(storageKey, { collapsed: Array.from(next) });
        return { ...previous, collapsed: next };
      });
    },
    [storageKey],
  );

  const autoArrange = useCallback(() => {
    setDiagramState((previous) => ({
      ...previous,
      collapsed: new Set(),
      initialViewport: undefined,
    }));
    saveDiagramState(storageKey, {
      collapsed: [],
      viewport: undefined,
      ...diagramSettings,
    });
    setArrangeToken((token) => token + 1);
  }, [storageKey, diagramSettings]);

  const { nodes, edges } = useMemo(() => {
    const nodes: LocationFlowNode[] = [];
    const edges: Edge[] = [];
    const horizontal = diagramSettings.direction === "horizontal";
    const rankGap = diagramSettings.spacing === "compact" ? 64 : 96;
    const siblingGap = diagramSettings.spacing === "compact" ? 16 : 24;
    const nodeById = new Map<Id<"locations">, LocationFlowNode>();
    const childrenOf = new Map<Id<"locations">, Id<"locations">[]>();
    const visited = new Set<Id<"locations">>();

    function visit(current: DiagramLocation) {
      if (visited.has(current._id)) return;
      visited.add(current._id);

      const objects = objectsById.get(current._id) ?? [];
      const children = sortLocations(childrenById.get(current._id) ?? []);
      const width = getNodeWidth(diagramSettings.size);
      const height = estimateNodeHeight({
        settings: diagramSettings,
        objectCount: objects.length,
        childCount: children.length,
      });
      const expanded = !collapsed.has(current._id);
      const node: LocationFlowNode = {
        id: current._id,
        type: "location",
        sourcePosition: horizontal ? Position.Right : Position.Bottom,
        targetPosition: horizontal ? Position.Left : Position.Top,
        position: { x: 0, y: 0 },
        data: {
          settings: diagramSettings,
          location: current,
          objects,
          children,
          expanded,
          horizontal,
          toggle,
          onSelectLocation,
        },
        style: { pointerEvents: "all", overflow: "visible" },
        width,
        height,
      };
      nodes.push(node);
      nodeById.set(current._id, node);

      if (!expanded) {
        childrenOf.set(current._id, []);
        return;
      }

      const childIds: Id<"locations">[] = [];
      for (const child of children) {
        visit(child);
        childIds.push(child._id);
        edges.push({
          id: `${current._id}-${child._id}`,
          source: current._id,
          sourceHandle: horizontal
            ? childSourceHandleId(child._id)
            : NODE_SOURCE_HANDLE_ID,
          target: child._id,
          targetHandle: horizontal ? TITLE_HANDLE_ID : NODE_TARGET_HANDLE_ID,
          type: diagramSettings.lines,
          ...(diagramSettings.lines === "smoothstep"
            ? { pathOptions: { borderRadius: 12, offset: 20 } }
            : {}),
          style: {
            stroke: getLocationAccent(child.type).stroke,
            strokeWidth: 1.5,
          },
        });
      }
      childrenOf.set(current._id, childIds);
    }

    visit(rootLocation);

    function placeSubtree(
      locationId: Id<"locations">,
      originX: number,
      originY: number,
    ): { width: number; height: number } {
      const node = nodeById.get(locationId);
      if (!node) return { width: 0, height: 0 };

      const nodeWidth = node.width ?? 256;
      const nodeHeight = node.height ?? 106;
      const childIds = childrenOf.get(locationId) ?? [];

      if (childIds.length === 0) {
        node.position = { x: originX, y: originY };
        return { width: nodeWidth, height: nodeHeight };
      }

      if (horizontal) {
        const childOriginX = originX + nodeWidth + rankGap;
        let childY = originY;
        let subtreeWidth = 0;
        let subtreeHeight = 0;

        for (const childId of childIds) {
          const childSize = placeSubtree(childId, childOriginX, childY);
          subtreeWidth = Math.max(subtreeWidth, childSize.width);
          subtreeHeight += childSize.height + siblingGap;
          childY += childSize.height + siblingGap;
        }
        subtreeHeight -= siblingGap;

        // Keep parent at the top of its branch so edges stay in-band and do not
        // cross neighboring siblings' links.
        node.position = { x: originX, y: originY };

        return {
          width: nodeWidth + rankGap + subtreeWidth,
          height: Math.max(nodeHeight, subtreeHeight),
        };
      }

      const childOriginY = originY + nodeHeight + rankGap;
      let childX = originX;
      let subtreeWidth = 0;
      let subtreeHeight = 0;

      for (const childId of childIds) {
        const childSize = placeSubtree(childId, childX, childOriginY);
        subtreeHeight = Math.max(subtreeHeight, childSize.height);
        subtreeWidth += childSize.width + siblingGap;
        childX += childSize.width + siblingGap;
      }
      subtreeWidth -= siblingGap;

      node.position = { x: originX, y: originY };

      return {
        width: Math.max(nodeWidth, subtreeWidth),
        height: nodeHeight + rankGap + subtreeHeight,
      };
    }

    placeSubtree(rootLocation._id, 40, 40);

    return { nodes, edges };
  }, [
    rootLocation,
    childrenById,
    objectsById,
    collapsed,
    toggle,
    onSelectLocation,
    diagramSettings,
  ]);

  return (
    <div>
      <div className="h-[65vh] min-h-96 w-full">
        {restored && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesReconnectable={false}
            elementsSelectable={false}
            deleteKeyCode={null}
            fitView={false}
            defaultViewport={initialViewport}
            onMoveEnd={(_, viewport) =>
              saveDiagramState(storageKey, {
                viewport,
                ...diagramSettings,
              })
            }
            fitViewOptions={FIT_VIEW_OPTIONS}
            minZoom={MIN_ZOOM}
            maxZoom={1.6}
            colorMode={colorMode}
          >
            <DiagramToolbar settings={settings} />
            <Panel
              position="bottom-center"
              className="rounded-md border border-border/60 bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground"
            >
              {tViews("dragToExplore")}
            </Panel>
            <Background
              gap={24}
              size={1}
              color={colorMode === "light" ? "#d4d4d8" : "#303036"}
            />
            <DiagramControls
              arrangeToken={arrangeToken}
              nodeCount={nodes.length}
              fitOnMount={!initialViewport}
              onAutoArrange={autoArrange}
            />
            <MiniMap
              pannable
              zoomable
              nodeColor="#6366f1"
              maskColor={
                colorMode === "light"
                  ? "rgba(255,255,255,0.7)"
                  : "rgba(0,0,0,0.5)"
              }
              className="!h-20 !w-32"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
