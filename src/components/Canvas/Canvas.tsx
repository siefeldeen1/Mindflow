// Canvas.tsx
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Line, Rect, Arrow } from 'react-konva';
import Konva from 'konva';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useThemeStore } from '@/store/useThemeStore';
import { CanvasState, Point } from '@/types';
import { CanvasNode } from './CanvasNode';
import { CanvasEdge } from './CanvasEdge';

interface CanvasProps {
  width: number;
  height: number;
  readOnly?: boolean;
  canvasState?: CanvasState | null;
}

export const Canvas: React.FC<CanvasProps> = ({ width, height,readOnly = false,canvasState }) => {
  const stageRef = useRef<Konva.Stage>(null);
  
  const {
    nodes,
    edges,
    selectedNodes,
    viewport,
    tool,
    isConnecting,
    selectionBox,
    isDragging,
    isPanning,
    zoom,
    pan,
    setViewport,
    setPanning,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    clearSelection,
    addNode,
    selectNodes,
    cancelConnection,
  } = useCanvasStore();
  const { isDark } = useThemeStore();



const activeNodes = canvasState?.nodes || nodes;
const activeEdges = canvasState?.edges || edges;
const activeViewport = canvasState?.viewport || viewport;
const activeSelectedNodes = canvasState?.selectedNodes || selectedNodes;
const [localViewport, setLocalViewport] = useState(activeViewport);
const [localIsPanning, setLocalIsPanning] = useState(false);

const lastDistRef = useRef<number>(0);
const lastCenterRef = useRef<Point | null>(null);

useEffect(() => {
  setLocalViewport(activeViewport);
}, [activeViewport]);
  // Compute grid color dynamically
  const getGridColor = () => {
    const style = getComputedStyle(document.documentElement);
    const hsl = style.getPropertyValue('--canvas-grid').trim();
    const computedColor = `hsl(${hsl})`;
    return computedColor;
  };
const getEdgeColor = () => {
  const style = getComputedStyle(document.documentElement);
  const hsl = style.getPropertyValue('--connection-line').trim();
  const computedColor = `hsl(${hsl})`;
  return computedColor;
};

const getDistance = (p1: Touch, p2: Touch) => {
  return Math.sqrt(Math.pow(p2.clientX - p1.clientX, 2) + Math.pow(p2.clientY - p1.clientY, 2));
};

const getCenter = (p1: Touch, p2: Touch): Point => {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  };
};

const handleMouseDown = (e: React.MouseEvent) => {
    if (readOnly || canvasState) return; 
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (readOnly|| canvasState) return; 
   
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (readOnly || canvasState) return; 
  };



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly || canvasState) return;
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        useCanvasStore.getState().deleteSelected();
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            useCanvasStore.getState().redo();
          } else {
            useCanvasStore.getState().undo();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);


const localPan = useCallback((delta: Point) => {
  setLocalViewport((prev) => ({
    ...prev,
    x: prev.x + delta.x,
    y: prev.y + delta.y,
  }));
}, []);

const localZoom = useCallback((delta: number, center: Point) => {
  setLocalViewport((prev) => {
    const oldScale = prev.scale;
    const newScale = oldScale * (1 + delta);
    const clamped = Math.max(0.25, Math.min(2, newScale));

    const oldWorldX = (center.x - prev.x) / oldScale;
    const oldWorldY = (center.y - prev.y) / oldScale;

    const newX = center.x - oldWorldX * clamped;
    const newY = center.y - oldWorldY * clamped;

    return {
      x: newX,
      y: newY,
      scale: clamped,
    };
  });
}, []);


  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    if (Math.abs(e.evt.deltaY) < 5) return;

    e.evt.preventDefault();
    
    if (!stageRef.current) return;

    const stage = stageRef.current;
    const pointer = stage.getPointerPosition();
    
    if (pointer) {
      const zoomDelta = e.evt.deltaY > 0 ? -0.1 : 0.1;
      if (readOnly || canvasState) {
        
       localZoom(zoomDelta, pointer);
       return;
     }

     if (isDragging || e.evt.ctrlKey) return;
      zoom(zoomDelta, pointer);
    }
  }, [zoom, isDragging, localZoom, readOnly, canvasState]);

const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
  if (!stageRef.current) return;

  const stage = stageRef.current;
  const pos = stage.getPointerPosition();
  if (!pos) return;
  if (readOnly || canvasState) {
   if (e.evt.button === 0 || e.evt.button === 2) {
      lastMousePos.current = pos;
      setLocalIsPanning(true);
      stage.container().style.cursor = 'move';
    }
    return;
  }
  const activeElement = document.activeElement;
  const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');

  const worldPos = {
    x: (pos.x - viewport.x) / viewport.scale,
    y: (pos.y - viewport.y) / viewport.scale,
  };

  if (tool === 'hand') {
    if (e.evt.button === 0) {
      setPanning(true);
      lastMousePos.current = pos;
      stage.container().style.cursor = 'move';
    }
  } else if (tool === 'select') {
    if (e.evt.button === 2) {
      setPanning(true);
      stage.container().style.cursor = 'move';
    } else if (e.evt.button === 0) {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) {
        if (isInputFocused) {
          (activeElement as HTMLElement).blur();
        } else {
          clearSelection();
          startSelectionBox(worldPos);
        }
      }
    }
  } else if (tool === 'line') {
    const clickedOnEmpty = e.target === stage;
    if (clickedOnEmpty) {
      cancelConnection();
    }
  }
}, [tool, viewport, setPanning, clearSelection, startSelectionBox, cancelConnection]);

  const lastMousePos = useRef<Point | null>(null);

 const handleStageMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
if (!stageRef.current) return;

  const stage = stageRef.current;
  const pos = stage.getPointerPosition();
  if (!pos) return;

  if (readOnly || canvasState) {
    if (localIsPanning && lastMousePos.current) {
      const deltaX = pos.x - lastMousePos.current.x;
      const deltaY = pos.y - lastMousePos.current.y;
      localPan({ x: deltaX, y: deltaY });
      lastMousePos.current = pos;
    }

    return;
  }

  if (isPanning && lastMousePos.current) {
    const deltaX = pos.x - lastMousePos.current.x;
    const deltaY = pos.y - lastMousePos.current.y;
    pan({ x: deltaX, y: deltaY });
  } else if (selectionBox?.active) {
    const worldPos = {
      x: (pos.x - viewport.x) / viewport.scale,
      y: (pos.y - viewport.y) / viewport.scale,
    };
    updateSelectionBox(worldPos);
  }

  const { isDragConnecting } = useCanvasStore.getState();
  if (isDragConnecting) {
    const worldPos = {
      x: (pos.x - viewport.x) / viewport.scale,
      y: (pos.y - viewport.y) / viewport.scale,
    };
    useCanvasStore.getState().updateTempTarget(worldPos);
    stage.batchDraw(); // Ensure real-time redraw
  }

  lastMousePos.current = pos;
}, [isPanning, selectionBox, viewport, pan, updateSelectionBox, localPan, localIsPanning, readOnly, canvasState]);

  const handleStageMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
   if (readOnly || canvasState) {
     setLocalIsPanning(false);
     lastMousePos.current = null;
     
     if (stageRef.current) {
       stageRef.current.container().style.cursor = 'default';
     }
     return;
   }
   const { isDragConnecting, endDragConnection } = useCanvasStore.getState();
if (isDragConnecting) {
  let targetNodeId: string | null = null;
  const target = e.target.findAncestor((node: Konva.Node) => node.name() === 'node');
  if (target) {
    targetNodeId = target.id();
  }
  endDragConnection(targetNodeId);
}
    setPanning(false);
    lastMousePos.current = null;
    
    if (stageRef.current) {
      stageRef.current.container().style.cursor = 'default';
    }
    
    if (selectionBox?.active) {
      endSelectionBox();
    }
  }, [setPanning, selectionBox, endSelectionBox, readOnly, canvasState]);

const handleTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
  e.evt.preventDefault(); // Prevent default browser behaviors like scroll/zoom
  if (!stageRef.current) return;

  const stage = stageRef.current;
  const touches = e.evt.touches;

  if (touches.length === 1) {
    // Single touch: Start panning
    const pos = stage.getPointerPosition();
    if (pos) {
      lastMousePos.current = pos;
      if (readOnly || canvasState) {
        setLocalIsPanning(true);
      } else {
        setPanning(true);
      }
      stage.container().style.cursor = 'move';
    }
  } else if (touches.length === 2) {
    // Two touches: Start pinch zoom
    const touch1 = touches[0];
    const touch2 = touches[1];
    lastCenterRef.current = getCenter(touch1, touch2);
    lastDistRef.current = getDistance(touch1, touch2);
  }
}, [setPanning, readOnly, canvasState]);

const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
  e.evt.preventDefault();
  if (!stageRef.current) return;

  const stage = stageRef.current;
  const touches = e.evt.touches;

  if (touches.length === 1 && ((readOnly || canvasState) ? localIsPanning : isPanning)) {
    // Single touch move: Pan
    const pos = stage.getPointerPosition();
    if (pos && lastMousePos.current) {
      const delta = {
        x: pos.x - lastMousePos.current.x,
        y: pos.y - lastMousePos.current.y,
      };
      if (readOnly || canvasState) {
        localPan(delta);
      } else {
        pan(delta);
      }
      lastMousePos.current = pos;
    }
  } else if (touches.length === 2) {
    // Two touch move: Pinch zoom
    const touch1 = touches[0];
    const touch2 = touches[1];
    const newCenter = getCenter(touch1, touch2);
    const newDist = getDistance(touch1, touch2);

    if (lastDistRef.current !== 0) {
      const delta = (newDist - lastDistRef.current) / lastDistRef.current;
      const currentViewport = (readOnly || canvasState) ? localViewport : viewport;
      const setFunc = (readOnly || canvasState) ? setLocalViewport : setViewport;

      const pointTo = {
        x: (newCenter.x - currentViewport.x) / currentViewport.scale,
        y: (newCenter.y - currentViewport.y) / currentViewport.scale,
      };

      const newScale = Math.max(0.25, Math.min(2, currentViewport.scale * (1 + delta * 2))); // Amplify delta for smoother mobile zoom

      const newX = newCenter.x - pointTo.x * newScale;
      const newY = newCenter.y - pointTo.y * newScale;

      setFunc({ x: newX, y: newY, scale: newScale });
    }

    lastDistRef.current = newDist;
    lastCenterRef.current = newCenter;
  }

  // Handle drag connection if in normal mode
  if (!(readOnly || canvasState)) {
    const { isDragConnecting } = useCanvasStore.getState();
    if (isDragConnecting) {
      const pos = stage.getPointerPosition();
      if (pos) {
        const worldPos = {
          x: (pos.x - viewport.x) / viewport.scale,
          y: (pos.y - viewport.y) / viewport.scale,
        };
        useCanvasStore.getState().updateTempTarget(worldPos);
        stage.batchDraw();
      }
    }
  }
}, [isPanning, localIsPanning, viewport, localViewport, pan, localPan, setViewport, readOnly, canvasState]);

const handleTouchEnd = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
  e.evt.preventDefault();
  if (readOnly || canvasState) {
    setLocalIsPanning(false);
  } else {
    setPanning(false);
  }
  lastMousePos.current = null;
  lastDistRef.current = 0;
  lastCenterRef.current = null;

  if (stageRef.current) {
    stageRef.current.container().style.cursor = 'default';
  }

  // End drag connection if applicable (normal mode only)
  if (!(readOnly || canvasState)) {
    const { isDragConnecting, endDragConnection } = useCanvasStore.getState();
    if (isDragConnecting) {
      let targetNodeId: string | null = null;
      const target = e.target.findAncestor((node: Konva.Node) => node.name() === 'node');
      if (target) {
        targetNodeId = target.id();
      }
      endDragConnection(targetNodeId);
    }
    if (selectionBox?.active) {
      endSelectionBox();
    }
  }
}, [setPanning, selectionBox, endSelectionBox, readOnly, canvasState]);

useEffect(() => {
  if (stageRef.current) {
   stageRef.current.position({ x: localViewport.x, y: localViewport.y });
   stageRef.current.scale({ x: localViewport.scale, y: localViewport.scale });
    stageRef.current.batchDraw();
    stageRef.current.draw();
  }
}, [localViewport, isDark]);

  return (
    <div
      style={{ width, height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="bg-background"
    >
    <div className="relative w-full h-full bg-canvas-bg overflow-hidden">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
       onContextMenu={(e) => { e.evt.preventDefault(); e.evt.stopPropagation(); }}
        // draggable={false}
       listening={true}
       onTouchStart={handleTouchStart}
onTouchMove={handleTouchMove}
onTouchEnd={handleTouchEnd}
      >
       <Layer key={`layer-${isDark ? 'dark' : 'light'}`}>
  {(() => {
   const gridSize = 20;
    const scale = localViewport.scale;
    
  const worldBounds = {
     left: (-localViewport.x) / scale - gridSize * 10,
     top: (-localViewport.y) / scale - gridSize * 10,
     right: (width - localViewport.x) / scale + gridSize * 10,
     bottom: (height - localViewport.y) / scale + gridSize * 10,
   };
    
    const startX = Math.floor(worldBounds.left / gridSize) * gridSize;
    const startY = Math.floor(worldBounds.top / gridSize) * gridSize;
    const endX = Math.ceil(worldBounds.right / gridSize) * gridSize;
    const endY = Math.ceil(worldBounds.bottom / gridSize) * gridSize;
    
    const lines = [];
    const gridColor = getGridColor();
    
    for (let x = startX; x <= endX; x += gridSize) {
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, worldBounds.top, x, worldBounds.bottom]}
          stroke={gridColor}
          strokeWidth={0.5 / scale}
          opacity={0.4}
          listening={false}
        />
      );
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
      lines.push(
        <Line
          key={`h-${y}`}
          points={[worldBounds.left, y, worldBounds.right, y]}
          stroke={gridColor}
          strokeWidth={0.5 / scale}
          opacity={0.4}
          listening={false}
        />
      );
    }
    
    return lines;
  })()}
  {(() => {
    const { isDragConnecting, connectionSource, tempTarget, getTempAnchor } = useCanvasStore.getState();
    if (!canvasState && isDragConnecting && connectionSource && tempTarget) {
      const sourceAnchor = getTempAnchor(connectionSource, tempTarget);
      return (
        <Arrow
          key="temp-line"
          points={[sourceAnchor.x, sourceAnchor.y, tempTarget.x, tempTarget.y]}
          stroke={getEdgeColor()}
          fill={getEdgeColor()}
          strokeWidth={2}
          dash={[5, 5]}
          pointerLength={10}
          pointerWidth={10}
          pointerAtEnding={true}
          listening={false}
        />
      );
    }
    return null;
  })()}
  {activeEdges.map((edge) => (
   <CanvasEdge key={edge.id} edge={edge} isSelected={false} readOnly={readOnly || !!canvasState} />
  ))}
  
  {activeNodes.map((node) => (
    <CanvasNode
      key={node.id}
      node={node}
      isSelected={activeSelectedNodes.includes(node.id)}
      readOnly={readOnly || !!canvasState}
    />
  ))}
  
  {selectionBox?.active && !readOnly && !canvasState && (
    <Rect
      x={Math.min(selectionBox.start.x, selectionBox.end.x)}
      y={Math.min(selectionBox.start.y, selectionBox.end.y)}
      width={Math.abs(selectionBox.end.x - selectionBox.start.x)}
      height={Math.abs(selectionBox.end.y - selectionBox.start.y)}
      fill={selectionBox.fill}
      stroke="hsl(var(--selection-box))"
      strokeWidth={1}
      dash={[5, 5]}
    />
  )}
</Layer>
      </Stage>
    </div>
    </div>
    
  );
};