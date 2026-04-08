import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
  positive?: boolean; // if true, upward trend is good (green); if false, downward is good
}

export default function SparklineChart({
  data,
  color = '#1565C0',
  height = 40,
  positive = true,
}: SparklineChartProps) {
  if (!data || data.length === 0) return null;

  // Determine trend color based on direction preference
  const first = data[0] ?? 0;
  const last = data[data.length - 1] ?? 0;
  const trending = last >= first ? 'up' : 'down';
  const resolvedColor =
    (positive && trending === 'up') || (!positive && trending === 'down')
      ? '#2e7d32'   // good trend → green
      : color;      // neutral or supplied color

  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`spark-fill-${resolvedColor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={resolvedColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={resolvedColor}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          fill={`url(#spark-fill-${resolvedColor.replace('#', '')})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
