import React, { useCallback } from 'react';
import { Line } from 'react-konva';
import Konva from 'konva';
import { Edge } from '@/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useThemeStore } from '@/store/useThemeStore';

interface CanvasEdgeProps {
  edge: Edge;
  isSelected: boolean;
}

export const CanvasEdge: React.FC<CanvasEdgeProps> = ({ edge, isSelected }) => {
  const { handleEdgeClick } = useCanvasStore();
  const { isDark } = useThemeStore();

  // Compute edge color dynamically
  const getEdgeColor = () => {
    const style = getComputedStyle(document.documentElement);
    const hsl = style.getPropertyValue('--connection-line').trim();
    const computedColor = `hsl(${hsl})`;
    
    return computedColor;
  };

  const onEdgeClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    
    e.cancelBubble = true; // Prevent event propagation
    handleEdgeClick(edge.id, e.evt.ctrlKey || e.evt.metaKey);
  }, [edge.id, handleEdgeClick]);

  return (
    <Line
      points={[
        edge.sourceAnchor.x,
        edge.sourceAnchor.y,
        edge.targetAnchor.x,
        edge.targetAnchor.y,
      ]}
      stroke={getEdgeColor()}
      strokeWidth={isSelected ? 3 : 2}
      hitStrokeWidth={20}
      pointerLength={10}
      pointerWidth={10}
      onClick={onEdgeClick}
      onTap={onEdgeClick}
    />
  );
};