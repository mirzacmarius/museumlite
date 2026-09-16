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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, MapPin, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

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
    location: DiagramLocation;
    objects: LocationObjects;
    childCount: number;
    expanded: boolean;
    toggle: (id: Id<"locations">) => void;
  },
  "location"
>;

function LocationNode({ data }: NodeProps<LocationFlowNode>) {
  const { location, objects, childCount, expanded, toggle } = data;
  return (
    <div className="w-64 rounded-xl border border-border bg-card shadow-lg">
      <Handle
        type="target"
        position={Position.Left}
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
            className="nodrag nopan flex items-center gap-1 rounded px-1 py-1 hover:bg-muted hover:text-foreground"
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
        <div className="nodrag nopan nowheel max-h-44 overflow-y-auto rounded-b-xl border-t border-border/60">
          {objects.map((object) => (
            <Link
              key={object._id}
              href={`/objects/${object._id}`}
              className="flex h-11 items-center gap-2 px-3 hover:bg-muted focus-visible:outline focus-visible:outline-indigo-400"
            >
              <span className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {object.thumbnailUrl ? (
                  <Image
                    src={object.thumbnailUrl}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                ) : (
                  <Package className="size-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0">
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
          position={Position.Right}
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
  const [collapsed, setCollapsed] = useState<Set<Id<"locations">>>(
    () => new Set(),
  );
  const toggle = useCallback((id: Id<"locations">) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const { nodes, edges } = useMemo(() => {
    const nodes: LocationFlowNode[] = [];
    const edges: Edge[] = [];
    const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph({
      rankdir: "LR",
      ranksep: 100,
      nodesep: 36,
      marginx: 30,
      marginy: 30,
    });
    const visited = new Set<Id<"locations">>();
    function visit(current: DiagramLocation) {
      if (visited.has(current._id)) return;
      visited.add(current._id);
      const objects = objectsById.get(current._id) ?? [];
      const children = childrenById.get(current._id) ?? [];
      const height = 106 + Math.min(objects.length, 4) * 44;
      nodes.push({
        id: current._id,
        type: "location",
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        position: { x: 0, y: 0 },
        data: {
          location: current,
          objects,
          childCount: children.length,
          expanded: !collapsed.has(current._id),
          toggle,
        },
        // Read-only nodes still contain clickable branch controls and object links.
        style: { pointerEvents: "all" },
        width: 256,
        height,
      });
      graph.setNode(current._id, { width: 256, height });
      if (collapsed.has(current._id)) return;
      for (const child of children) {
        if (visited.has(child._id)) continue;
        visit(child);
        graph.setEdge(current._id, child._id);
        edges.push({
          id: `${current._id}-${child._id}`,
          source: current._id,
          target: child._id,
          type: "smoothstep",
          style: { stroke: "#818cf8", strokeWidth: 1.5 },
        });
      }
    }
    visit(location);
    dagre.layout(graph);
    for (const node of nodes) {
      const position = graph.node(node.id);
      node.position = {
        x: position.x - 128,
        y: position.y - (node.height ?? 106) / 2,
      };
    }
    return { nodes, edges };
  }, [location, childrenById, objectsById, collapsed, toggle]);
  return (
    <div className="h-[65vh] min-h-96 w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={1.6}
        colorMode="dark"
      >
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
    </div>
  );
}
