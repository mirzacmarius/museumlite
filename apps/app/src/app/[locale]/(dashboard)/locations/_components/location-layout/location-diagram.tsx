"use client";

import dagre from "@dagrejs/dagre";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  Background,
  Controls,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, MapPin, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type DiagramSettings,
  DiagramSettingsPopover,
  useDiagramSettings,
} from "./diagram-settings";
import { readDiagramState, saveDiagramState } from "./diagram-storage";

type DiagramLocation = Pick<
  FunctionReturnType<typeof api.locations.listAll>[number],
  "_id" | "name" | "type" | "isActive"
>;
type LocationObjects = FunctionReturnType<
  typeof api.locations.getObjectsAtLocation
>;
interface LocationDiagramProps {
  location: DiagramLocation;
  childrenById: Map<Id<"locations">, DiagramLocation[]>;
  objectsById: Map<Id<"locations">, LocationObjects>;
}
type LocationFlowNode = Node<
  {
    settings: DiagramSettings;
    location: DiagramLocation;
    objects: LocationObjects;
    childCount: number;
    expanded: boolean;
    toggle: (id: Id<"locations">) => void;
  },
  "location"
>;

function LocationNode({ data }: NodeProps<LocationFlowNode>) {
  const { location, objects, childCount, expanded, toggle, settings } = data;
  const grid = settings.items === "grid";
  const large = settings.size === "large";
  return (
    <div
      className="rounded-xl border border-border bg-card shadow-lg"
      style={{ width: settings.size === "large" ? 320 : 256 }}
    >
      <Handle
        type="target"
        position={
          settings.direction === "vertical" ? Position.Top : Position.Left
        }
        isConnectable={false}
        className="!border-indigo-400 !bg-indigo-400"
      />
      <div className="flex h-16 items-center gap-2.5 px-3">
        <span className="rounded-md bg-indigo-500/10 p-2 text-indigo-400">
          <MapPin className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium" title={location.name}>
            {location.name}
          </p>
          <p className="mt-1 text-[10px] capitalize text-muted-foreground">
            {location.type.replaceAll("_", " ")}
          </p>
        </div>
        <span
          className={
            location.isActive
              ? "size-1.5 shrink-0 rounded-full bg-emerald-500"
              : "size-1.5 shrink-0 rounded-full bg-muted-foreground"
          }
        />
      </div>
      <div className="flex h-10 items-center justify-between border-t border-border/60 px-3 text-[10px] text-muted-foreground">
        <span>{objects.length} objects here</span>
        {childCount > 0 ? (
          <button
            type="button"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${location.name}`}
            aria-expanded={expanded}
            onClick={() => toggle(location._id)}
            className="nodrag nopan flex items-center gap-1 rounded p-1 hover:bg-muted hover:text-foreground"
          >
            {childCount} locations{" "}
            <ChevronRight
              className={expanded ? "size-3 rotate-90" : "size-3"}
            />
          </button>
        ) : (
          <span>No child locations</span>
        )}
      </div>
      {objects.length > 0 && (
        <div
          className={`nodrag nopan nowheel overflow-y-auto rounded-b-xl border-t border-border/60 ${grid ? "grid grid-cols-2" : ""}`}
          style={{ maxHeight: grid ? (large ? 308 : 220) : large ? 272 : 176 }}
        >
          {objects.map((object) => (
            <Link
              key={object._id}
              href={`/objects/${object._id}`}
              className={`flex gap-2 hover:bg-muted focus-visible:outline focus-visible:outline-indigo-400 ${grid ? "flex-col p-2" : "items-center px-3"}`}
              style={{ height: grid ? (large ? 154 : 110) : large ? 68 : 44 }}
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
      )}
      {childCount > 0 && (
        <Handle
          type="source"
          position={
            settings.direction === "vertical" ? Position.Bottom : Position.Right
          }
          isConnectable={false}
          className="!border-indigo-400 !bg-indigo-400"
        />
      )}
    </div>
  );
}
const nodeTypes = { location: LocationNode };

export function LocationDiagram({
  location,
  childrenById,
  objectsById,
}: LocationDiagramProps) {
  const storageKey = `museumlite:diagram:${location._id}`;
  const settings = useDiagramSettings(storageKey);
  const { direction, items, size, spacing, lines } = settings;
  const [{ collapsed, restored, initialViewport }, setDiagramState] = useState<{
    collapsed: Set<Id<"locations">>;
    restored: boolean;
    initialViewport?: Viewport;
  }>(() => ({ collapsed: new Set(), restored: false }));
  useEffect(() => {
    const saved = readDiagramState(storageKey);
    const validIds = new Set([
      location._id,
      ...Array.from(childrenById.values())
        .flat()
        .map((child) => child._id),
    ]);
    setDiagramState({
      initialViewport: saved.viewport,
      collapsed: new Set(
        Array.from(validIds).filter((id) => saved.collapsed?.includes(id)),
      ),
      restored: true,
    });
  }, [storageKey]);
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
  const { nodes, edges } = useMemo(() => {
    const nodes: LocationFlowNode[] = [];
    const edges: Edge[] = [];
    const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: direction === "vertical" ? "TB" : "LR",
      ranksep: spacing === "compact" ? 60 : 100,
      nodesep: spacing === "compact" ? 20 : 40,
      marginx: 30,
      marginy: 30,
    });
    const visited = new Set<Id<"locations">>();
    function visit(current: DiagramLocation) {
      if (visited.has(current._id)) return;
      visited.add(current._id);
      const objects = objectsById.get(current._id) ?? [];
      const children = childrenById.get(current._id) ?? [];
      const width = size === "large" ? 320 : 256;
      const rowHeight =
        items === "grid"
          ? size === "large"
            ? 154
            : 110
          : size === "large"
            ? 68
            : 44;
      const rows =
        items === "grid"
          ? Math.min(Math.ceil(objects.length / 2), 2)
          : Math.min(objects.length, 4);
      const height = 106 + rows * rowHeight;
      nodes.push({
        id: current._id,
        type: "location",
        sourcePosition:
          direction === "vertical" ? Position.Bottom : Position.Right,
        targetPosition: direction === "vertical" ? Position.Top : Position.Left,
        position: { x: 0, y: 0 },
        data: {
          settings: { direction, items, size, spacing, lines },
          location: current,
          objects,
          childCount: children.length,
          expanded: !collapsed.has(current._id),
          toggle,
        },
        // Read-only nodes still contain clickable branch controls and object links.
        style: { pointerEvents: "all" },
        width,
        height,
      });
      graph.setNode(current._id, { width, height });
      if (collapsed.has(current._id)) return;
      for (const child of children) {
        if (visited.has(child._id)) continue;
        visit(child);
        graph.setEdge(current._id, child._id);
        edges.push({
          id: `${current._id}-${child._id}`,
          source: current._id,
          target: child._id,
          type: lines,
          style: { stroke: "#818cf8", strokeWidth: 1.5 },
        });
      }
    }
    visit(location);
    dagre.layout(graph);
    for (const node of nodes) {
      const position = graph.node(node.id);
      node.position = {
        x: position.x - (node.width ?? 256) / 2,
        y: position.y - (node.height ?? 106) / 2,
      };
    }
    return { nodes, edges };
  }, [
    location,
    childrenById,
    objectsById,
    collapsed,
    toggle,
    direction,
    items,
    size,
    spacing,
    lines,
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
            fitView={!initialViewport}
            defaultViewport={initialViewport}
            onMoveEnd={(_, viewport) =>
              saveDiagramState(storageKey, {
                viewport,
                direction,
                items,
                size,
                spacing,
                lines,
              })
            }
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            minZoom={0.1}
            maxZoom={1.6}
            colorMode="dark"
          >
            <Panel position="top-right">
              <DiagramSettingsPopover settings={settings} />
            </Panel>
            <Panel
              position="top-left"
              className="rounded-md border border-border/60 bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground"
            >
              Drag to explore · Scroll to zoom
            </Panel>
            <Background gap={24} size={1} color="#303036" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor="#6366f1"
              maskColor="rgba(0,0,0,0.5)"
              className="!h-20 !w-32"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
