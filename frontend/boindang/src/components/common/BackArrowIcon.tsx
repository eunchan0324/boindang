import { ArrowLeft } from '@phosphor-icons/react';
import React from 'react';

interface BackArrowIconProps {
  size?: number;
  className?: string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
}

export default function BackArrowIcon({ size = 24, className = '', weight = 'bold' }: BackArrowIconProps) {
  return <ArrowLeft size={size} weight={weight} className={className} />;
} 