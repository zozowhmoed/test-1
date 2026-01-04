import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './ArrowChart.css';

// نفس دالة calculateLevel المستخدمة في Timer
const calculateLevel = (points) => {
  const basePoints = 100;
  const growthFactor = 1.2;

  if (points < basePoints) {
    return {
      currentLevel: 1,
      nextLevelPoints: basePoints,
      progress: (points / basePoints) * 100,
      pointsToNextLevel: basePoints - points
    };
  }

  let level = 2;
  let requiredPoints = Math.floor(basePoints * growthFactor);
  let totalPointsNeeded = basePoints + requiredPoints;

  while (points >= totalPointsNeeded) {
    level++;
    requiredPoints = Math.floor(requiredPoints * growthFactor);
    totalPointsNeeded += requiredPoints;
  }

  const pointsForCurrentLevel = points - (totalPointsNeeded - requiredPoints);

  return {
    currentLevel: level,
    nextLevelPoints: requiredPoints,
    progress: (pointsForCurrentLevel / requiredPoints) * 100,
    pointsToNextLevel: requiredPoints - pointsForCurrentLevel
  };
};

// دالة جديدة لحساب نقاط كل مستوى للمخطط
const calculateLevelPoints = (points) => {
  const basePoints = 100;
  const growthFactor = 1.2;
  
  let level = 1;
  let requiredPoints = basePoints;
  let totalPointsNeeded = basePoints;
  const levels = [];

  // حساب حتى المستوى الحالي + 3 مستويات مستقبلية
  const targetLevels = calculateLevel(points).currentLevel + 3;
  
  while (level <= targetLevels) {
    levels.push({
      level,
      pointsRequired: totalPointsNeeded,
      pointsEarned: Math.min(points, totalPointsNeeded)
    });
    
    level++;
    requiredPoints = Math.floor(requiredPoints * growthFactor);
    totalPointsNeeded += requiredPoints;
  }

  return levels;
};

const ArrowChartPage = ({ points }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      const levelsData = calculateLevelPoints(points);

      const labels = levelsData.map(level => `المستوى ${level.level}`);
      const levelPoints = levelsData.map(level => level.pointsEarned);

      const data = {
        labels: labels,
        datasets: [{
          label: 'تقدمك الدراسي',
          data: levelPoints,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointStyle: 'circle',
          pointRadius: 6,
          pointHoverRadius: 10,
          pointBackgroundColor: (context) => {
            const index = context.dataIndex;
            const currentLevel = calculateLevel(points).currentLevel;
            return index === currentLevel - 1 ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)';
          }
        }]
      };

      const options = {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
          title: {
            display: true,
            text: 'مستوى التقدم',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const level = levelsData[context.dataIndex];
                const currentLevel = calculateLevel(points).currentLevel;
                let label = `النقاط: ${level.pointsEarned}`;
                
                if (context.dataIndex === currentLevel - 1) {
                  label += ' (المستوى الحالي)';
                } else if (context.dataIndex < currentLevel - 1) {
                  label += ' (مكتمل)';
                } else {
                  label += ` (المطلوب: ${level.pointsRequired})`;
                }
                
                return label;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'النقاط'
            }
          },
          x: {
            title: {
              display: true,
              text: 'المستويات'
            }
          }
        }
      };

      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: data,
        options: options
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [points]);

  const { currentLevel, pointsToNextLevel } = calculateLevel(points);

  return (
    <div className="arrow-chart-container">
      <div className="chart-header">
        <h2>مخطط تقدمك الدراسي</h2>
        <p>هذا المخطط يوضح تقدمك في الدراسة عبر المستويات المختلفة</p>
      </div>

      <div className="chart-wrapper">
        <canvas ref={chartRef} id="progressChart"></canvas>
      </div>

      <div className="chart-info">
        <div className="info-card">
          <h3>نقاطك الحالية</h3>
          <p className="points-value">{points}</p>
        </div>

        <div className="info-card">
          <h3>المستوى الحالي</h3>
          <p className="level-value">{currentLevel}</p>
        </div>

        <div className="info-card">
          <h3>النقاط للمستوى التالي</h3>
          <p className="next-level">{pointsToNextLevel}</p>
        </div>
      </div>
    </div>
  );
};

export default ArrowChartPage;