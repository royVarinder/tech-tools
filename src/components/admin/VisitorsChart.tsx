"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "next-themes";

export default function VisitorsChart({ daily }: { daily: { date: string; count: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, resolvedTheme === "dark" ? "dark" : undefined);
    chartRef.current = chart;

    const isDark = resolvedTheme === "dark";
    const axisColor = isDark ? "#afb0b7" : "#5b615c";
    const gridColor = isDark ? "#304338" : "#e2e6e2";

    chart.setOption({
      backgroundColor: "transparent",
      grid: { left: 40, right: 16, top: 24, bottom: 32 },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: daily.map((d) => d.date.slice(5)),
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: axisColor, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: axisColor, fontSize: 11 },
      },
      series: [
        {
          name: "Visits",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: daily.map((d) => d.count),
          itemStyle: { color: "#2f9d63" },
          lineStyle: { color: "#2f9d63", width: 2 },
          areaStyle: { color: "rgba(47, 157, 99, 0.15)" },
        },
      ],
    });

    function handleResize() {
      chart.resize();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [daily, resolvedTheme]);

  return <div ref={containerRef} className="h-72 w-full" />;
}
