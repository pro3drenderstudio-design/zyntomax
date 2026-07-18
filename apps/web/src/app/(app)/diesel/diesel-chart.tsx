"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export type DieselPoint = {
  label: string;
  litres: number;
  outputKg: number;
  litresPerKg: number | null;
};

export function DieselChart({ data }: { data: DieselPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e3e8e5" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#008037" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e3e8e5" }}
            formatter={(v: number, name: string) =>
              name === "Litres/kg" ? [v?.toFixed(3) ?? "—", name] : [v?.toLocaleString(), name]
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="litres" name="Diesel (L)" fill="#94a3b8" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="outputKg" name="Output (kg)" fill="#7ed957" radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="litresPerKg" name="Litres/kg" stroke="#008037" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
