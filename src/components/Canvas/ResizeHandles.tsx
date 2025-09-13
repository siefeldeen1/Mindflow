import React from 'react';
import { Circle } from 'react-konva';
import { Node } from '@/types';
import { useCanvasStore } from '@/store/useCanvasStore';

interface ResizeHandlesProps {
  node: Node;
  isSelected: boolean;
  onResize: (newSize: { width: number; height: number }) => void;
  viewport: { x: number; y: number; scale: number };
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  node,
  isSelected,
  onResize,
  viewport,
}) => {
  if (!isSelected) return null;

  const handleSize = 6 / viewport.scale;
  const strokeWidth = 1 / viewport.scale;

  const handles = [
    { x: 0, y: 0, cursor: 'nw-resize' }, // top-left
    { x: node.size.width, y: 0, cursor: 'ne-resize' }, // top-right
    { x: node.size.width, y: node.size.height, cursor: 'se-resize' }, // bottom-right
    { x: 0, y: node.size.height, cursor: 'sw-resize' }, // bottom-left
    { x: node.size.width / 2, y: 0, cursor: 'n-resize' }, // top-center
    { x: node.size.width, y: node.size.height / 2, cursor: 'e-resize' }, // right-center
    { x: node.size.width / 2, y: node.size.height, cursor: 's-resize' }, // bottom-center
    { x: 0, y: node.size.height / 2, cursor: 'w-resize' }, // left-center
  ];

  return (
    <>
      {handles.map((handle, index) => (
        <Circle
          key={index}
          x={handle.x}
          y={handle.y}
          radius={handleSize}
          fill="hsl(var(--background))"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          draggable
          onDragMove={(e) => {
            const stage = e.target.getStage();
            if (!stage) return;

            const newPos = e.target.absolutePosition();
            const originalPos = node.position;
            const originalSize = node.size;

            const relativePos = {
              x: (newPos.x - viewport.x) / viewport.scale,
              y: (newPos.y - viewport.y) / viewport.scale,
            };

            const newSize = { ...originalSize };
            const newPosition = { ...originalPos };

            switch (index) {
              case 0: // top-left
                newSize.width = originalSize.width + (originalPos.x - relativePos.x);
                newSize.height = originalSize.height + (originalPos.y - relativePos.y);
                newPosition.x = relativePos.x;
                newPosition.y = relativePos.y;
                break;
              case 1: // top-right
                newSize.width = relativePos.x - originalPos.x;
                newSize.height = originalSize.height + (originalPos.y - relativePos.y);
                newPosition.y = relativePos.y;
                break;
              case 2: // bottom-right
                newSize.width = relativePos.x - originalPos.x;
                newSize.height = relativePos.y - originalPos.y;
                break;
              case 3: // bottom-left
                newSize.width = originalSize.width + (originalPos.x - relativePos.x);
                newSize.height = relativePos.y - originalPos.y;
                newPosition.x = relativePos.x;
                break;
              case 4: // top-center
                newSize.height = originalSize.height + (originalPos.y - relativePos.y);
                newPosition.y = relativePos.y;
                break;
              case 5: // right-center
                newSize.width = relativePos.x - originalPos.x;
                break;
              case 6: // bottom-center
                newSize.height = relativePos.y - originalPos.y;
                break;
              case 7: // left-center
                newSize.width = originalSize.width + (originalPos.x - relativePos.x);
                newPosition.x = relativePos.x;
                break;
            }

            newSize.width = Math.max(20, newSize.width);
            newSize.height = Math.max(20, newSize.height);

            onResize(newSize);
            if (newPosition.x !== originalPos.x || newPosition.y !== originalPos.y) {
              useCanvasStore.setState((state) => ({
                nodes: state.nodes.map((n) =>
                  n.id === node.id ? { ...n, position: newPosition } : n
                ),
              }));
            }

            e.target.position({ x: handle.x, y: handle.y });
          }}
          onDragEnd={() => {
            useCanvasStore.getState().saveHistory();
          }}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = handle.cursor;
            }
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'default';
            }
          }}
        />
      ))}
    </>
  );
};