import React from "react";
import { PieChart, Pie, Cell } from "recharts";

interface SafetyChartProps {
  value: number; // 0~100 (GI 지수)
}

const COLORS = ["#22c55e", "#eab308", "#ef4444"]; // 안전, 주의, 위험
const RADIAN = Math.PI / 180;

const gaugeSections = [
  { name: "안전", value: 1, color: COLORS[0] },
  { name: "주의", value: 1, color: COLORS[1] },
  { name: "위험", value: 1, color: COLORS[2] },
];

const chartCx = 110;
const chartCy = 100;
const innerRadius = 50;
const outerRadius = 100;

// GI 값을 실제 바늘 각도(0도 오른쪽 ~ 180도 왼쪽)로 변환하는 함수
function calculateActualAngle(value: number): number {
  const TOTAL_ARC_DEGREES = 180;
  let baseAngle = 0; // 구간 매핑으로 계산될 기본 각도

  // 1. 각 GI 구간을 시각적인 60도 섹션에 매핑 (이전의 "정확한 구간 매핑")
  // 각도 기준: 180도 = 왼쪽 끝, 0도 = 오른쪽 끝
  if (value <= 55) { // 안전 구간 (0-55) -> 시각적 각도 180도 ~ 120도
    const percentage = value / 55;
    baseAngle = TOTAL_ARC_DEGREES - (percentage * 60);
  } else if (value <= 69) { // 주의 구간 (56-69) -> 시각적 각도 120도 ~ 60도
    const percentage = (value - 56) / (69 - 56);
    baseAngle = (TOTAL_ARC_DEGREES - 60) - (percentage * 60);
  } else { // 위험 구간 (70-100) -> 시각적 각도 60도 ~ 0도
    const percentage = (value - 70) / (100 - 70);
    baseAngle = (TOTAL_ARC_DEGREES - 120) - (percentage * 60);
  }

  // 2. GI 값 구간에 따른 추가 각도 보정 (사용자 제안 방식)
  //    주의: 이 보정은 이미 계산된 baseAngle에 적용됨
  if (value >= 70) { // 위험 구간 (70-100)
    baseAngle -= 5; // 바늘을 왼쪽으로 약간 더 이동 (각도 값을 늘림)
  } else if (value >= 56) { // 주의 구간 (56-69)
    baseAngle -= 2.5; // 바늘을 왼쪽으로 약간 더 이동
  }
  // 안전 구간(0-55)은 추가 보정 없음

  // 최종 각도는 0~180도 사이로 제한
  return Math.min(Math.max(baseAngle, 0), TOTAL_ARC_DEGREES);
}

const renderNeedle = (angleForNeedle: number) => {
  const length = (innerRadius + 2 * outerRadius) / 3;
  const sin = Math.sin(-RADIAN * angleForNeedle);
  const cos = Math.cos(-RADIAN * angleForNeedle);

  const needleCenterX = chartCx;
  const needleCenterY = chartCy;
  const radiusSmallCircle = 5;

  const point1X = needleCenterX + radiusSmallCircle * sin;
  const point1Y = needleCenterY - radiusSmallCircle * cos;
  const point2X = needleCenterX - radiusSmallCircle * sin;
  const point2Y = needleCenterY + radiusSmallCircle * cos;
  const topPointX = needleCenterX + length * cos;
  const topPointY = needleCenterY + length * sin;

  return [
    <circle key="needle-circle" cx={needleCenterX} cy={needleCenterY} r={radiusSmallCircle} fill="#4A4A4A" stroke="none" />,
    <path
      key="needle-path"
      d={`M${point1X} ${point1Y} L${point2X} ${point2Y} L${topPointX} ${topPointY} Z`}
      stroke="none"
      fill="#4A4A4A"
    />,
  ];
};

export default function SafetyChart({ value }: SafetyChartProps) {
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  const finalAngleForNeedle = calculateActualAngle(normalizedValue);

  return (
    <PieChart width={220} height={120}>
      <Pie
        data={gaugeSections}
        dataKey="value"
        startAngle={180}
        endAngle={0}
        cornerRadius={10}
        paddingAngle={1}
        cx={chartCx}
        cy={chartCy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        fill="#8884d8"
        stroke="none"
        isAnimationActive={false}
      >
        {gaugeSections.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
      </Pie>
      {renderNeedle(finalAngleForNeedle)}
    </PieChart>
  );
}