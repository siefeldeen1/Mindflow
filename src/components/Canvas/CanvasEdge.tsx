// Change 16: In CanvasEdge.tsx, replace the entire CanvasEdge component with this
import React, { useCallback } from 'react';
import { Arrow } from 'react-konva'; // Updated import to use Arrow
import Konva from 'konva';
import { Edge } from '@/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useThemeStore } from '@/store/useThemeStore';

interface CanvasEdgeProps {
  edge: Edge;
  isSelected: boolean;
  readOnly?: boolean;
}

export const CanvasEdge: React.FC<CanvasEdgeProps> = ({ edge, isSelected,readOnly = false }) => {
  const { handleEdgeClick, deleteEdge } = useCanvasStore();
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

  const onEdgeDoubleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true; // Prevent event propagation
    deleteEdge(edge.id);
  }, [edge.id, deleteEdge]);

  const onMouseEnter = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'pointer';
    }
  }, []);

  const onMouseLeave = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (stage) {
      stage.container().style.cursor = 'default';
    }
  }, []);


  const commonProps = {
   points: [
     edge.sourceAnchor.x,
     edge.sourceAnchor.y,
     edge.targetAnchor.x,
     edge.targetAnchor.y,
   ],
   stroke: getEdgeColor(),
   fill: getEdgeColor(), // Fill for the arrowhead
   strokeWidth: isSelected ? 3 : 2,
   pointerLength: 10,
   pointerWidth: 10,
   pointerAtEnding: true, // Arrowhead at target end
 };

 if (readOnly) {
   return (
     <Arrow
       {...commonProps}
       hitStrokeWidth={0}
       listening={false}
     />
   );
 }
  return (
    <Arrow
      {...commonProps}
      hitStrokeWidth={20}
      onClick={onEdgeClick}
      onTap={onEdgeClick}
      onDblClick={onEdgeDoubleClick}
      onDblTap={onEdgeDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
};