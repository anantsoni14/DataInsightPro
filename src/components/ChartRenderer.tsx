import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, Brush, Label
} from 'recharts';

// Modern neon/pastel color palette for dark mode
const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#38bdf8'];

const tooltipStyle = {
  backgroundColor: 'rgba(17, 17, 17, 0.9)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  color: '#fff',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  padding: '12px 16px'
};

const axisStyle = {
  fill: 'rgba(255,255,255,0.5)',
  fontSize: 11,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif'
};

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

const formatXAxisTick = (value: any) => {
  if (typeof value === 'string' && value.length > 12) return value.substring(0, 12) + '...';
  return value;
};

export function ChartRenderer({ data, config }: { data: any[], config: any }) {
  const { type, xAxisKey, yAxisKey, title } = config;

  const validData = useMemo(() => {
    // Clean and parse data: ensure Y axis is strictly numeric
    let processed = data.map(item => {
      let yVal = item[yAxisKey];
      if (typeof yVal === 'string') {
        const stripped = yVal.replace(/[^0-9.-]+/g, "");
        if (stripped !== "") yVal = Number(stripped);
      }
      let xVal = item[xAxisKey];
      if (type === 'scatter' && typeof xVal === 'string') {
        const strippedX = xVal.replace(/[^0-9.-]+/g, "");
        if (strippedX !== "") xVal = Number(strippedX);
      }
      return { ...item, [yAxisKey]: yVal, [xAxisKey]: xVal };
    }).filter(item => typeof item[yAxisKey] === 'number' && !isNaN(item[yAxisKey]));

    // Limit data points for pie charts to prevent unreadable slices
    if (type === 'pie' && processed.length > 12) {
      processed.sort((a, b) => b[yAxisKey] - a[yAxisKey]);
      const top = processed.slice(0, 11);
      const others = processed.slice(11).reduce((sum, item) => sum + item[yAxisKey], 0);
      if (others > 0) {
        top.push({ [xAxisKey]: 'Other', [yAxisKey]: others });
      }
      return top;
    }

    // For bar, line, scatter, allow up to 300 points for density, Brush handles navigation
    if (processed.length > 300) {
      return processed.slice(0, 300);
    }

    return processed;
  }, [data, type, xAxisKey, yAxisKey]);

  if (validData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40 bg-white/5 rounded-2xl border border-dashed border-white/10 p-4 text-center">
        <p className="font-medium text-white/60 mb-1">Not enough valid data</p>
        <p className="text-xs">Could not find numeric values for "{yAxisKey}"</p>
      </div>
    );
  }

  const commonMargin = { top: 20, right: 30, left: 10, bottom: 40 };
  const isXNumeric = validData.length > 0 && typeof validData[0][xAxisKey] === 'number';

  switch (type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={validData} margin={commonMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xAxisKey} tick={axisStyle} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={formatXAxisTick} angle={-45} textAnchor="end" height={60}>
              <Label value={xAxisKey} offset={-10} position="insideBottom" style={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
            </XAxis>
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatNumber} width={60}>
              <Label value={yAxisKey} angle={-90} position="insideLeft" style={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(val: number) => formatNumber(val)} />
            <Bar dataKey={yAxisKey} fill="url(#colorBar)" radius={[4, 4, 0, 0]} maxBarSize={50}>
              {validData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
            {validData.length > 10 && (
              <Brush dataKey={xAxisKey} height={20} stroke="rgba(255,255,255,0.2)" fill="rgba(0,0,0,0.2)" tickFormatter={() => ''} />
            )}
            <defs>
              <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={1}/>
                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.8}/>
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      );
    case 'line':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={validData} margin={commonMargin}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xAxisKey} tick={axisStyle} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={formatXAxisTick} angle={-45} textAnchor="end" height={60}>
              <Label value={xAxisKey} offset={-10} position="insideBottom" style={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
            </XAxis>
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatNumber} width={60}>
              <Label value={yAxisKey} angle={-90} position="insideLeft" style={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} formatter={(val: number) => formatNumber(val)} />
            <Line 
              type="monotone" 
              dataKey={yAxisKey} 
              stroke="#818cf8" 
              strokeWidth={3} 
              dot={{ r: 3, fill: '#111', strokeWidth: 2, stroke: '#818cf8' }} 
              activeDot={{ r: 6, fill: '#818cf8', stroke: '#fff', strokeWidth: 2 }} 
            />
            {validData.length > 10 && (
              <Brush dataKey={xAxisKey} height={20} stroke="rgba(255,255,255,0.2)" fill="rgba(0,0,0,0.2)" tickFormatter={() => ''} />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
            <Pie
              data={validData}
              dataKey={yAxisKey}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius="75%"
              innerRadius="55%"
              paddingAngle={2}
              stroke="none"
              label={({ name, percent }) => `${formatXAxisTick(name)} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {validData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} formatter={(val: number) => formatNumber(val)} />
          </PieChart>
        </ResponsiveContainer>
      );
    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={commonMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey={xAxisKey} type={isXNumeric ? "number" : "category"} allowDuplicatedCategory={false} tick={axisStyle} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} tickFormatter={isXNumeric ? formatNumber : formatXAxisTick} angle={-45} textAnchor="end" height={60}>
              <Label value={xAxisKey} offset={-10} position="insideBottom" style={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
            </XAxis>
            <YAxis dataKey={yAxisKey} type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatNumber} width={60}>
              <Label value={yAxisKey} angle={-90} position="insideLeft" style={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.2)' }} contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} formatter={(val: number) => formatNumber(val)} />
            <Scatter name={title} data={validData} fill="#34d399">
              {validData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Scatter>
            {validData.length > 10 && (
              <Brush dataKey={xAxisKey} height={20} stroke="rgba(255,255,255,0.2)" fill="rgba(0,0,0,0.2)" tickFormatter={() => ''} />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      );
    default:
      return (
        <div className="flex items-center justify-center h-full text-white/40 bg-white/5 rounded-2xl border border-dashed border-white/10">
          Unsupported chart type: {type}
        </div>
      );
  }
}
