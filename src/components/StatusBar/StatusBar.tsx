import React from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';

export const StatusBar: React.FC = () => {
  const { nodes, edges, selectedNodes, selectedEdges, viewport, tool } = useCanvasStore();

  const formatZoom = (scale: number) => `${Math.round(scale * 100)}%`;
  
  const formatPosition = (x: number, y: number) => 
    `${Math.round(x)}, ${Math.round(y)}`;

  return (
    <div className="bg-muted border-t border-border px-4 py-1 text-xs text-muted-foreground flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span>Tool: {tool}</span>
        <span>Nodes: {nodes.length}</span>
        <span>Edges: {edges.length}</span>
        {selectedNodes.length > 0 && (
          <span>Selected: {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''}</span>
        )}
        {selectedEdges.length > 0 && (
          <span>Selected: {selectedEdges.length} edge{selectedEdges.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        <span>Position: {formatPosition(viewport.x, viewport.y)}</span>
        <span>Zoom: {formatZoom(viewport.scale)}</span>
      </div>
    </div>
  );
};