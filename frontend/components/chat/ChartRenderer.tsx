"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  PieChart,
  Line,
  Bar,
  Area,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface SeriesConfig {
  key: string;
  name: string;
  color?: string;
}

interface ChartConfig {
  type: "line" | "bar" | "area" | "pie";
  title?: string;
  xKey?: string;
  nameKey?: string;
  dataKey?: string;
  series?: SeriesConfig[];
  data: Record<string, unknown>[];
}

type CartesianType = "line" | "bar" | "area";

const DEFAULT_COLORS = [
  "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#3b82f6", "#84cc16",
];

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a2e",
  border: "1px solid #2a2a3e",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontSize: "12px",
};
const TOOLTIP_ITEM_STYLE = { color: "#e2e8f0" };
const TOOLTIP_LABEL_STYLE = { color: "#94a3b8", marginBottom: 2 };

const AXIS_STYLE = { fill: "#64748b", fontSize: 11 };

const CARTESIAN_TYPES: CartesianType[] = ["line", "bar", "area"];

const TYPE_ICONS: Record<CartesianType, JSX.Element> = {
  line: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M3 17l5-5 4 4 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bar: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" />
      <rect x="10" y="6" width="4" height="15" rx="1" fill="currentColor" />
      <rect x="17" y="9" width="4" height="12" rx="1" fill="currentColor" />
    </svg>
  ),
  area: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M3 17l5-5 4 4 9-9V21H3z" fill="currentColor" opacity="0.4" />
      <path d="M3 17l5-5 4 4 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShrinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M9 3v6H3M21 15h-6v6M3 9l7 7M14 3l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function parseConfig(raw: string): { config: ChartConfig | null; error: string | null } {
  try {
    return { config: JSON.parse(raw) as ChartConfig, error: null };
  } catch {
    return { config: null, error: "Could not parse chart data" };
  }
}

function ChartRenderer({ raw }: { raw: string }) {
  const { config, error } = parseConfig(raw);
  const [expanded, setExpanded] = useState(false);
  const [activeType, setActiveType] = useState<CartesianType>(
    () => (config?.type !== "pie" ? (config?.type ?? "line") : "line")
  );

  if (error || !config) {
    return (
      <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-xs text-red-400 mb-3">
        Chart error: {error || "Could not parse chart data"}
      </div>
    );
  }

  const isPie = config.type === "pie";
  const displayType: ChartConfig["type"] = isPie ? "pie" : activeType;
  const chartHeight = expanded ? 400 : 240;
  const seriesList = config.series ?? [
    { key: config.dataKey ?? "value", name: config.title ?? "Value", color: DEFAULT_COLORS[0] },
  ];

  const renderChart = () => {
    const { data, xKey = "period" } = config;

    if (displayType === "pie") {
      const nameKey = config.nameKey ?? "name";
      const dataKey = config.dataKey ?? "value";
      return (
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={expanded ? 150 : 90}
            innerRadius={expanded ? 60 : 36}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
          <Legend formatter={(value) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{value}</span>} />
        </PieChart>
      );
    }

    const ChartComponent =
      displayType === "bar" ? BarChart : displayType === "area" ? AreaChart : LineChart;

    return (
      <ChartComponent data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} axisLine={{ stroke: "#1e293b" }} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} cursor={{ fill: "#ffffff08" }} />
        {seriesList.length > 1 && (
          <Legend formatter={(value) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{value}</span>} />
        )}
        {seriesList.map((s, i) => {
          const color = s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          if (displayType === "bar") {
            return <Bar key={s.key} dataKey={s.key} name={s.name} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />;
          }
          if (displayType === "area") {
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={color}
                fill={`${color}22`}
                strokeWidth={2}
                dot={{ fill: color, r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            );
          }
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          );
        })}
      </ChartComponent>
    );
  };

  return (
    <div className={`mb-4 rounded-xl border border-border-dark bg-surface-dark overflow-hidden transition-all duration-300 ${expanded ? "shadow-2xl" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-dark">
        <div className="flex items-center gap-2 min-w-0">
          {/* Type switcher tabs — only for cartesian charts */}
          {!isPie ? (
            <div className="flex items-center gap-0.5 bg-bg-dark rounded-md p-0.5 flex-shrink-0">
              {CARTESIAN_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  title={`${t.charAt(0).toUpperCase() + t.slice(1)} chart`}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    activeType === t
                      ? "bg-accent/20 text-accent"
                      : "text-secondary hover:text-primary-dark"
                  }`}
                >
                  {TYPE_ICONS[t]}
                  <span className="capitalize">{t}</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[10px] font-medium text-accent uppercase tracking-wider bg-accent/10 px-2 py-0.5 rounded flex-shrink-0">
              pie chart
            </span>
          )}
          {config.title && (
            <span className="text-xs text-primary-dark font-medium truncate">{config.title}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          title={expanded ? "Collapse" : "Expand chart"}
          className="p-1.5 rounded-md text-secondary hover:text-primary-dark hover:bg-bg-dark transition-colors flex-shrink-0"
        >
          {expanded ? <ShrinkIcon /> : <ExpandIcon />}
        </button>
      </div>

      {/* Chart */}
      <div className="p-4 bg-[#0d0d1a]" style={{ height: chartHeight + 32 }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ChartRenderer;
