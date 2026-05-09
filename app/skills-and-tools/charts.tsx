"use client";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export interface BarDatum {
  name: string;
  count: number;
}

const BRAND = "#758666";
const BRAND_DEEP = "#475240";

export function HorizontalBarChart({
  data,
  totalJobs,
  emptyLabel,
  onBarClick,
}: {
  data: BarDatum[];
  totalJobs: number;
  emptyLabel: string;
  onBarClick?: (name: string) => void;
}) {
  // Recompute height: 28px per row + padding. Keeps tall lists readable.
  const height = Math.max(180, data.length * 28 + 24);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white/60 p-8 text-sm text-zinc-500">
        {emptyLabel}
      </div>
    );
  }

  const options: ChartOptions<"bar"> = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 32 } },
    onClick: onBarClick
      ? (_evt, elements) => {
          const el = elements[0];
          if (!el) return;
          const name = data[el.index]?.name;
          if (name) onBarClick(name);
        }
      : undefined,
    onHover: onBarClick
      ? (event, elements) => {
          const target = (event.native?.target ?? null) as HTMLElement | null;
          if (target) target.style.cursor = elements.length > 0 ? "pointer" : "default";
        }
      : undefined,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0a0a0a",
        titleFont: { family: "var(--font-sans)", weight: 600 },
        bodyFont: { family: "var(--font-sans)" },
        callbacks: {
          label: (ctx) => {
            const n = ctx.parsed.x as number;
            const pct = totalJobs > 0 ? Math.round((n / totalJobs) * 100) : 0;
            return ` ${n} job${n === 1 ? "" : "s"} (${pct}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          color: "#71717a",
          font: { family: "var(--font-sans)", size: 11 },
          stepSize: 1,
          precision: 0,
        },
        grid: { color: "rgba(24,24,27,0.06)" },
        border: { display: false },
      },
      y: {
        ticks: {
          color: "#18181b",
          font: { family: "var(--font-sans)", size: 13, weight: 500 },
          autoSkip: false,
        },
        grid: { display: false },
        border: { display: false },
      },
    },
  };

  const chartData = {
    labels: data.map((d) => d.name),
    datasets: [
      {
        data: data.map((d) => d.count),
        backgroundColor: BRAND,
        hoverBackgroundColor: BRAND_DEEP,
        borderRadius: 4,
        barThickness: 16,
      },
    ],
  };

  return (
    <div style={{ height }} className="w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
}
