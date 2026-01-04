import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label
} from 'recharts';

const ArrowChart = ({ data = [], theme = 'light' }) => {
  // تنسيق الألوان حسب الثيم
  const colors = {
    light: {
      text: '#374151',
      background: '#ffffff',
      grid: '#e5e7eb',
      tooltip: '#f9fafb',
      line: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444'
    },
    dark: {
      text: '#f3f4f6',
      background: '#1f2937',
      grid: '#4b5563',
      tooltip: '#374151',
      line: '#60a5fa',
      success: '#34d399',
      warning: '#fbbf24',
      danger: '#f87171'
    }
  };

  const currentTheme = colors[theme] || colors.light;

  // حساب القيم المهمة
  const { maxPoints, minPoints, averagePoints } = React.useMemo(() => {
    if (!data || data.length === 0) return {};
    
    const points = data.map(item => item.points);
    return {
      maxPoints: Math.max(...points),
      minPoints: Math.min(...points),
      averagePoints: points.reduce((a, b) => a + b, 0) / points.length
    };
  }, [data]);

  // تحديد لون الخط حسب الأداء
  const getLineColor = () => {
    if (!data || data.length === 0) return currentTheme.line;
    
    const lastPoints = data[data.length - 1].points;
    const percentage = (lastPoints / maxPoints) * 100;
    if (percentage < 20) return currentTheme.danger;
    if (percentage < 50) return currentTheme.warning;
    if (percentage < 80) return currentTheme.success;
    return currentTheme.line;
  };

  // تنسيق التولتيب
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: currentTheme.tooltip,
          padding: '10px',
          border: `1px solid ${currentTheme.grid}`,
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ 
            margin: 0,
            color: currentTheme.text,
            fontWeight: 'bold',
            borderBottom: `1px solid ${currentTheme.grid}`,
            paddingBottom: '4px',
            marginBottom: '4px'
          }}>
            الجلسة #{label}
          </p>
          <p style={{ margin: 0, color: getLineColor() }}>
            النقاط: <strong>{payload[0].value.toLocaleString()}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div style={{
        width: '100%',
        height: 400,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: currentTheme.background,
        color: currentTheme.text,
        borderRadius: '8px'
      }}>
        لا توجد بيانات متاحة لعرض المخطط
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '500px',
      background: currentTheme.background,
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
    }}>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 30, bottom: 40 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={currentTheme.grid} 
            vertical={false}
          />
          
          <XAxis
            dataKey="time"
            tick={{ fill: currentTheme.text }}
            axisLine={{ stroke: currentTheme.grid }}
            tickLine={{ stroke: currentTheme.grid }}
            label={{
              value: 'تسلسل الجلسات',
              position: 'insideBottomRight',
              offset: -20,
              fill: currentTheme.text
            }}
          />
          
          <YAxis
            tick={{ fill: currentTheme.text }}
            axisLine={{ stroke: currentTheme.grid }}
            tickLine={{ stroke: currentTheme.grid }}
            label={{
              value: 'النقاط',
              angle: -90,
              position: 'insideLeft',
              fill: currentTheme.text
            }}
            tickFormatter={(value) => value.toLocaleString()}
          />
          
          {averagePoints && (
            <ReferenceLine
              y={averagePoints}
              stroke={currentTheme.warning}
              strokeDasharray="5 5"
              label={{
                value: `المتوسط: ${averagePoints.toFixed(1)}`,
                position: 'right',
                fill: currentTheme.text,
                fontSize: 12
              }}
            />
          )}
          
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ 
              stroke: currentTheme.grid,
              strokeDasharray: '3 3'
            }}
          />
          
          <Line
            name="النقاط"
            type="monotone"
            dataKey="points"
            stroke={getLineColor()}
            strokeWidth={3}
            dot={{
              fill: currentTheme.background,
              stroke: getLineColor(),
              strokeWidth: 2,
              r: 4
            }}
            activeDot={{ 
              r: 8,
              stroke: currentTheme.background,
              strokeWidth: 2,
              fill: getLineColor()
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ArrowChart;