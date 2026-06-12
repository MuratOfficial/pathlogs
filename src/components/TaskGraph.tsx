"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TaskDTO, LinkDTO } from "@/lib/types";
import { STATUS_COLORS, STATUS_LABELS, formatHours, initials } from "@/lib/labels";
import { TypeBadge, PriorityDot } from "./TaskBadges";

const GAP_X = 320;
const GAP_Y = 120;
// Явные стартовые размеры и handles узлов: без них React Flow держит узлы
// скрытыми (visibility: hidden) и не рисует рёбра, пока ResizeObserver не
// измерит DOM — в фоновых/встроенных окнах это может не произойти вовсе.
// После реального измерения позиции уточняются автоматически.
const TASK_NODE_W = 256;
const TASK_NODE_H = 104;
const ROOT_NODE_W = 180;
const ROOT_NODE_H = 96;

const TASK_HANDLES: Node["handles"] = [
  { type: "target", position: Position.Left, x: 0, y: TASK_NODE_H / 2, width: 6, height: 6 },
  { type: "source", position: Position.Right, x: TASK_NODE_W, y: TASK_NODE_H / 2, width: 6, height: 6 },
];
const ROOT_HANDLES: Node["handles"] = [
  { type: "source", position: Position.Right, x: ROOT_NODE_W, y: ROOT_NODE_H / 2, width: 6, height: 6 },
];

type TaskNodeData = {
  task: TaskDTO;
  projectKey: string;
};

type RootNodeData = {
  name: string;
  projectKey: string;
  total: number;
};

function TaskNode({ data }: NodeProps) {
  const { task, projectKey } = data as TaskNodeData;
  const dimmed = task.status === "CLOSED" || task.status === "ARCHIVED";
  return (
    <div
      className={`w-64 rounded-xl border bg-surface p-3 shadow-lg transition hover:border-accent ${
        dimmed ? "opacity-50" : ""
      }`}
      style={{ borderColor: STATUS_COLORS[task.status] + "80", borderLeftWidth: 4, borderLeftColor: STATUS_COLORS[task.status] }}
    >
      <Handle type="target" position={Position.Left} className="!bg-edge !border-none" />
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] font-bold text-muted">
          {projectKey}-{task.number}
        </span>
        <TypeBadge type={task.type} />
        <span className="ml-auto">
          <PriorityDot priority={task.priority} />
        </span>
      </div>
      <p className="mb-2 text-xs font-semibold leading-snug text-foreground">{task.title}</p>
      <div className="flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
          style={{ backgroundColor: STATUS_COLORS[task.status] + "26", color: STATUS_COLORS[task.status] }}
        >
          {STATUS_LABELS[task.status]}
        </span>
        {task.spentHours > 0 && (
          <span className="text-[9px] text-muted">{formatHours(task.spentHours)}</span>
        )}
        <span className="ml-auto flex -space-x-1">
          {task.assignees.slice(0, 3).map((a) => (
            <span
              key={a.id}
              title={a.name}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-surface bg-accent/30 text-[8px] font-bold text-accent-hover"
            >
              {initials(a.name)}
            </span>
          ))}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-edge !border-none" />
    </div>
  );
}

function RootNode({ data }: NodeProps) {
  const { name, projectKey, total } = data as RootNodeData;
  return (
    <div className="rounded-xl border-2 border-accent bg-accent/10 px-5 py-4 shadow-xl">
      <div className="mb-1 font-mono text-[10px] font-bold text-accent-hover">{projectKey}</div>
      <p className="text-sm font-bold text-foreground">{name}</p>
      <p className="mt-1 text-[10px] text-muted">{total} задач</p>
      <Handle type="source" position={Position.Right} className="!bg-accent !border-none" />
    </div>
  );
}

const nodeTypes = { task: TaskNode, root: RootNode };

const LINK_STYLE: Record<LinkDTO["type"], { stroke: string; label: string }> = {
  BLOCKS: { stroke: "#ef4444", label: "блокирует" },
  RELATES: { stroke: "#8a94ab", label: "связана" },
  DUPLICATES: { stroke: "#f59e0b", label: "дубликат" },
};

/** Рекурсивная раскладка дерева: x — глубина, y — по листьям, родители по центру детей. */
function layoutTree(tasks: TaskDTO[]) {
  const childrenOf = new Map<string | null, TaskDTO[]>();
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    // Родитель вне проекта/удалён — считаем задачу корневой
    const parent = t.parentId && ids.has(t.parentId) ? t.parentId : null;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(t);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let row = 0;

  function place(taskId: string, depth: number): number {
    const kids = childrenOf.get(taskId) ?? [];
    let y: number;
    if (kids.length === 0) {
      y = row * GAP_Y;
      row += 1;
    } else {
      const ys = kids.map((k) => place(k.id, depth + 1));
      y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    positions.set(taskId, { x: depth * GAP_X, y });
    return y;
  }

  const roots = childrenOf.get(null) ?? [];
  const rootYs = roots.map((r) => place(r.id, 1));
  const projectY = rootYs.length
    ? (Math.min(...rootYs) + Math.max(...rootYs)) / 2
    : 0;

  return { positions, projectY };
}

export function TaskGraph({
  tasks,
  links,
  projectName,
  projectKey,
}: {
  tasks: TaskDTO[];
  links: LinkDTO[];
  projectName: string;
  projectKey: string;
}) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const { positions, projectY } = layoutTree(tasks);
    const ids = new Set(tasks.map((t) => t.id));

    const nodes: Node[] = [
      {
        id: "__project__",
        type: "root",
        position: { x: 0, y: projectY },
        initialWidth: ROOT_NODE_W,
        initialHeight: ROOT_NODE_H,
        handles: ROOT_HANDLES,
        data: { name: projectName, projectKey, total: tasks.length },
      },
      ...tasks.map((t) => ({
        id: t.id,
        type: "task",
        position: positions.get(t.id) ?? { x: GAP_X, y: 0 },
        initialWidth: TASK_NODE_W,
        initialHeight: TASK_NODE_H,
        handles: TASK_HANDLES,
        data: { task: t, projectKey },
      })),
    ];

    const edges: Edge[] = [];
    for (const t of tasks) {
      const parentId = t.parentId && ids.has(t.parentId) ? t.parentId : "__project__";
      edges.push({
        id: `tree-${t.id}`,
        source: parentId,
        target: t.id,
        type: "smoothstep",
        animated: t.status === "IN_PROGRESS",
        style: { stroke: STATUS_COLORS[t.status], strokeWidth: 2 },
      });
    }
    for (const l of links) {
      if (!ids.has(l.fromId) || !ids.has(l.toId)) continue;
      const s = LINK_STYLE[l.type];
      edges.push({
        id: `link-${l.id}`,
        source: l.fromId,
        target: l.toId,
        type: "default",
        label: s.label,
        labelStyle: { fill: s.stroke, fontSize: 10 },
        labelBgStyle: { fill: "#111827" },
        style: { stroke: s.stroke, strokeDasharray: "6 4", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: s.stroke },
      });
    }

    return { nodes, edges };
  }, [tasks, links, projectName, projectKey]);

  return (
    <div className="h-full w-full overflow-hidden rounded-2xl border border-edge bg-surface/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if (node.type === "task") router.push(`/tasks/${node.id}`);
        }}
      >
        <Background color="#243049" gap={24} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) =>
            n.type === "root"
              ? "#6366f1"
              : STATUS_COLORS[(n.data as unknown as TaskNodeData).task.status]
          }
          maskColor="rgba(11, 15, 26, 0.7)"
          style={{ background: "#111827" }}
        />
      </ReactFlow>
    </div>
  );
}
