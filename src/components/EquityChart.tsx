"use client";

import React, { useState } from "react";
import type { EquityPoint } from "@/lib/engine/backtester";

interface EquityChartProps {
  points: EquityPoint[];
  initialCapital: number;
}

export function EquityChart({ points, initialCapital }: EquityChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!points || points.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-slate-800/80 bg-[#0B0F19] text-sm text-slate-400">
        Run a walk-forward backtest to render strategy equity & drawdown curves.
      </div>
    );
  }

  const width = 760;
  const height = 250;
  const padLeft = 58;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues = points.flatMap((p) => [p.equity, p.benchmarkEquity, initialCapital]);
  const minVal = Math.min(...allValues) * 0.992;
  const maxVal = Math.max(...allValues) * 1.008;
  const span = Math.max(1, maxVal - minVal);

  const toX = (idx: number) => padLeft + (idx / (points.length - 1)) * plotW;
  const toY = (val: number) => padTop + plotH - ((val - minVal) / span) * plotH;

  const stratPath = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${toX(idx).toFixed(1)},${toY(p.equity).toFixed(1)}`)
    .join(" ");

  const benchPath = points
    .map(
      (p, idx) =>
        `${idx === 0 ? "M" : "L"}${toX(idx).toFixed(1)},${toY(p.benchmarkEquity).toFixed(1)}`
    )
    .join(" ");

  const oosFirstIdx = points.findIndex((p) => !p.inSample);
  const splitX = oosFirstIdx > 0 ? toX(oosFirstIdx) : null;
  const activePoint = hoverIdx !== null ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#0B0F19] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="inline-block h-2 w-4 rounded-sm bg-emerald-400" />
            Strategy Equity ($
            {activePoint.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })})
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="inline-block h-0.5 w-4 bg-slate-500" />
            Buy & Hold ($
            {activePoint.benchmarkEquity.toLocaleString("en-US", { minimumFractionDigits: 2 })})
          </span>
          <span className="font-mono text-rose-400">
            DD: {activePoint.drawdownPct.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-cyan-300">
            {activePoint.inSample ? "70% IN-SAMPLE WINDOW" : "30% OUT-OF-SAMPLE WALK-FORWARD"}
          </span>
          <span className="font-mono">
            {new Date(activePoint.timestampSec * 1000).toISOString().slice(0, 16).replace("T", " ")}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-60 w-full select-none overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const clamped = Math.max(0, Math.min(1, (relX - padLeft) / plotW));
          setHoverIdx(Math.round(clamped * (points.length - 1)));
        }}
      >
        {[0, 0.5, 1].map((t) => {
          const val = minVal + span * t;
          const y = toY(val);
          return (
            <g key={t}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#1E293B"
                strokeDasharray="3 3"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 font-mono text-[10px]"
              >
                ${Math.round(val).toLocaleString()}
              </text>
            </g>
          );
        })}

        {splitX !== null && (
          <g>
            <rect
              x={splitX}
              y={padTop}
              width={width - padRight - splitX}
              height={plotH}
              fill="rgba(6, 182, 212, 0.05)"
            />
            <line
              x1={splitX}
              y1={padTop}
              x2={splitX}
              y2={height - padBottom}
              stroke="#06B6D4"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />
            <text
              x={splitX + 6}
              y={padTop + 12}
              className="fill-cyan-400 font-mono text-[10px]"
            >
              OOS Split
            </text>
          </g>
        )}

        <path d={benchPath} fill="none" stroke="#64748B" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={stratPath} fill="none" stroke="#10B981" strokeWidth="2.4" />

        {hoverIdx !== null && (
          <line
            x1={toX(hoverIdx)}
            y1={padTop}
            x2={toX(hoverIdx)}
            y2={height - padBottom}
            stroke="#94A3B8"
            strokeWidth="1"
          />
        )}
      </svg>
    </div>
  );
}
