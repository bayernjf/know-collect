import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useAIModals } from '../useAIModals';
import VideoDetailModal from './VideoDetailModal';
import type { Video } from '../types';

type NodeType = 'video' | 'tag' | 'author' | 'folder';

interface GNode {
  id: string;
  label: string;
  type: NodeType;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface GEdge {
  a: string;
  b: string;
}

const PLATFORM_COLOR: Record<Video['platform'], string> = {
  douyin: '#fe2c55',
  bilibili: '#fb7299',
  xiaohongshu: '#ff2741',
};

const OTHER_COLOR: Record<Exclude<NodeType, 'video'>, string> = {
  tag: '#ffb454',
  author: '#5fd08a',
  folder: '#c792ea',
};

export default function KnowledgeGraph() {
  const { videos, folders } = useStore();
  const { summarizeOne, reportModals } = useAIModals();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const dimsRef = useRef({ w: 800, h: 600 });
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [detailId, setDetailId] = useState<string | null>(null);

  // 构建图数据
  const { nodes, edges } = useMemo(() => {
    const map = new Map<string, GNode>();
    const list: GEdge[] = [];
    const add = (id: string, label: string, type: NodeType, color: string, r = 6) => {
      if (!map.has(id)) {
        map.set(id, { id, label, type, color, x: 0, y: 0, vx: 0, vy: 0, r });
      }
      return map.get(id)!;
    };
    videos.forEach((v) => {
      const vn = add('v:' + v.id, v.title, 'video', PLATFORM_COLOR[v.platform], 9);
      if (v.author) {
        const an = add('a:' + v.author, v.author, 'author', OTHER_COLOR.author);
        list.push({ a: vn.id, b: an.id });
      }
      v.tags.forEach((t) => {
        const tn = add('t:' + t, '#' + t, 'tag', OTHER_COLOR.tag);
        list.push({ a: vn.id, b: tn.id });
      });
      if (v.folderId) {
        const f = folders.find((x) => x.id === v.folderId);
        if (f) {
          const fn = add('f:' + f.id, f.name, 'folder', OTHER_COLOR.folder);
          list.push({ a: vn.id, b: fn.id });
        }
      }
    });
    return { nodes: [...map.values()], edges: list };
  }, [videos, folders]);

  // 画布尺寸自适应
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dimsRef.current = { w: rect.width, h: rect.height };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = dimsRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ns = nodesRef.current;
    const byId = new Map(ns.map((n) => [n.id, n]));
    const hovered = hoverRef.current;
    const neighbors = new Set<string>();
    if (hovered) {
      neighbors.add(hovered);
      edgesRef.current.forEach((e) => {
        if (e.a === hovered) neighbors.add(e.b);
        if (e.b === hovered) neighbors.add(e.a);
      });
    }
    edgesRef.current.forEach((e) => {
      const a = byId.get(e.a);
      const b = byId.get(e.b);
      if (!a || !b) return;
      const active = !hovered || e.a === hovered || e.b === hovered;
      ctx.strokeStyle = active ? 'rgba(180,190,220,0.22)' : 'rgba(180,190,220,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    ns.forEach((n) => {
      const dim = hovered && !neighbors.has(n.id);
      ctx.globalAlpha = dim ? 0.2 : 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.color;
      ctx.fill();
      if (n.type !== 'video' || (neighbors.has(n.id) && hovered)) {
        ctx.fillStyle = '#cdd6f4';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(n.label, n.x + n.r + 3, n.y + 3);
      }
    });
    ctx.globalAlpha = 1;
  };

  // 力导向模拟 + 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    nodesRef.current = nodes.map((n) => ({ ...n }));
    edgesRef.current = edges;
    setStats({ nodes: nodes.length, edges: edges.length });
    const { w, h } = dimsRef.current;
    nodesRef.current.forEach((n) => {
      n.x = w / 2 + (Math.random() - 0.5) * w * 0.7;
      n.y = h / 2 + (Math.random() - 0.5) * h * 0.7;
    });
    let raf = 0;
    const step = () => {
      const ns = nodesRef.current;
      const W = dimsRef.current.w;
      const H = dimsRef.current.h;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i];
          const b = ns[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = 1400 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      edgesRef.current.forEach((e) => {
        const a = ns.find((n) => n.id === e.a);
        const b = ns.find((n) => n.id === e.b);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const k = 0.015 * (dist - 80);
        const fx = (dx / dist) * k;
        const fy = (dy / dist) * k;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      });
      ns.forEach((n) => {
        n.vx += (W / 2 - n.x) * 0.0015;
        n.vy += (H / 2 - n.y) * 0.0015;
        n.vx *= 0.86;
        n.vy *= 0.86;
        if (!dragRef.current || dragRef.current.id !== n.id) {
          n.x += n.vx;
          n.y += n.vy;
        }
      });
      draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const pick = (x: number, y: number): GNode | null => {
    const ns = nodesRef.current;
    for (let i = ns.length - 1; i >= 0; i--) {
      const n = ns[i];
      if (Math.hypot(n.x - x, n.y - y) <= n.r + 4) return n;
    }
    return null;
  };

  const toLocal = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.MouseEvent) => {
    const p = toLocal(e);
    const n = pick(p.x, p.y);
    downPosRef.current = p;
    if (n) dragRef.current = { id: n.id, moved: false };
  };

  const onMove = (e: React.MouseEvent) => {
    const p = toLocal(e);
    if (dragRef.current) {
      const n = nodesRef.current.find((x) => x.id === dragRef.current!.id);
      if (n) {
        n.x = p.x;
        n.y = p.y;
        n.vx = 0;
        n.vy = 0;
      }
      if (downPosRef.current && Math.hypot(p.x - downPosRef.current.x, p.y - downPosRef.current.y) > 4) {
        dragRef.current.moved = true;
      }
      return;
    }
    const n = pick(p.x, p.y);
    const id = n ? n.id : null;
    if (hoverRef.current !== id) {
      hoverRef.current = id;
      if (canvasRef.current) canvasRef.current.style.cursor = id ? 'pointer' : 'default';
      draw();
    }
  };

  const onUp = () => {
    const drag = dragRef.current;
    if (drag && !drag.moved) {
      if (drag.id.startsWith('v:')) setDetailId(drag.id.slice(2));
    }
    dragRef.current = null;
    downPosRef.current = null;
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>🕸️ 知识图谱</h1>
        <p className="subtitle">
          以视频、作者、标签、文件夹为节点，探索收藏之间的关联 · 共 {stats.nodes} 个节点 / {stats.edges} 条关系
        </p>
      </header>

      <div className="graph-legend">
        <span><i style={{ background: PLATFORM_COLOR.douyin }} /> 视频</span>
        <span><i style={{ background: OTHER_COLOR.author }} /> 作者</span>
        <span><i style={{ background: OTHER_COLOR.tag }} /> 标签</span>
        <span><i style={{ background: OTHER_COLOR.folder }} /> 文件夹</span>
        <span className="legend-hint">拖动节点 · 悬停高亮关联 · 点击视频查看详情</span>
      </div>

      <div className="graph-canvas" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        />
      </div>

      {detailId && (
        <VideoDetailModal
          videoId={detailId}
          onClose={() => setDetailId(null)}
          onSummarize={summarizeOne}
        />
      )}
      {reportModals}
    </div>
  );
}
