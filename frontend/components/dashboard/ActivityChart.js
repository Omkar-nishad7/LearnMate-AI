"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import Card from "@/components/ui/Card";

export default function ActivityChart({
  title = "Weekly Activity",
  subtitle = "Real activity recorded over the last 7 days",
  data = [],
}) {
  const hasData = Array.isArray(data) && data.some((point) => point.value > 0);

  return (
    <Card className="p-5">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {!hasData ? (
        <div className="flex min-h-56 items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
          No learning activity has been recorded in the last 7 days.
        </div>
      ) : (
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#activityFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
