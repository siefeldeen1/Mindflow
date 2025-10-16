// CanvasNode.tsx
import React, { useRef, useCallback, useState } from 'react';
import { Group, Rect, Ellipse, Line, Text, Arrow } from 'react-konva';
import Konva from 'konva';
import { Node, Point } from '@/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ResizeHandles } from './ResizeHandles';
import { useThemeStore } from '@/store/useThemeStore';
interface CanvasNodeProps {
  node: Node;
  isSelected: boolean;
  readOnly?: boolean;
}

const TEXT_NODE_PADDING = 10; // Padding to prevent arrows touching text

export const CanvasNode: React.FC<CanvasNodeProps> = ({ node, isSelected,readOnly = false }) => {
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
const { isDark } = useThemeStore();
  const {
    updateNode,
    updateNodeSync, // Add updateNodeSync to destructure
    selectNode,
    edges,
    updateEdgeAnchors,
    isConnecting,
    connectionSource,
    endConnection,
    startConnection,
    tool,
    viewport,
    getAnchor,
    flushUpdateNode,
    setDragging,
    setShowPropertyPanel,
    startDragConnection,
    selectionVisible
  } = useCanvasStore();

  const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    if (e.evt) {
      e.evt.stopPropagation();
      e.evt.preventDefault();
    }
    setIsDragging(true);
    setDragging(true);
    if (!isSelected) {
      selectNode(node.id);
    }
    setShowPropertyPanel(false);
  }, [isSelected, selectNode, node.id, setDragging]);

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    if (e.evt) {
      e.evt.stopPropagation();
      e.evt.preventDefault();
    }
    
    if (!groupRef.current) return;
    
    const newPosition = {
      x: groupRef.current.x(),
      y: groupRef.current.y(),
    };
    
    updateNode(node.id, { position: newPosition });
    
    const connectedEdges = edges.filter(
      (edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id
    );
    
    connectedEdges.forEach((edge) => {
      const sourceNodeTemp = edge.sourceNodeId === node.id ? 
        { ...node, position: newPosition } : 
        useCanvasStore.getState().nodes.find((n) => n.id === edge.sourceNodeId);
      
      const targetNodeTemp = edge.targetNodeId === node.id ? 
        { ...node, position: newPosition } : 
        useCanvasStore.getState().nodes.find((n) => n.id === edge.targetNodeId);
      
      if (sourceNodeTemp && targetNodeTemp) {
        const sourceAnchor = getAnchor(sourceNodeTemp, targetNodeTemp);
        const targetAnchor = getAnchor(targetNodeTemp, sourceNodeTemp);
        
        useCanvasStore.setState((state) => ({
          edges: state.edges.map((e) =>
            e.id === edge.id
              ? { ...e, sourceAnchor, targetAnchor }
              : e
          ),
        }));
      }
    });
  }, [node, updateNode, edges, getAnchor]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    if (e.evt) {
      e.evt.stopPropagation();
      e.evt.preventDefault();
    }
    setIsDragging(false);
    setDragging(false);
    useCanvasStore.getState().flushUpdateNode();
    useCanvasStore.getState().saveHistory();
  }, [setDragging]);

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    
    if (tool === 'line') {
      if (isConnecting && connectionSource) {
        if (connectionSource === node.id) {
          useCanvasStore.getState().endConnection(null);
        } else {
          const existingConnection = edges.find(edge => 
            (edge.sourceNodeId === connectionSource && edge.targetNodeId === node.id) ||
            (edge.sourceNodeId === node.id && edge.targetNodeId === connectionSource)
          );
          
          if (!existingConnection) {
            endConnection(node.id);
          }
        }
      } else {
        startConnection(node.id);
      }
    } else if (tool === 'select') {
  console.log('Node clicked, opening property panel for node:', node.id); 
  selectNode(node.id, e.evt.ctrlKey || e.evt.metaKey);
 if (!(e.evt.ctrlKey || e.evt.metaKey)) {
 useCanvasStore.setState((state) => 
  !state.showPropertyPanel ? { showPropertyPanel: true } : {}
);

}
  }
  }, [tool, isConnecting, connectionSource, node.id, edges, endConnection, selectNode, startConnection, setShowPropertyPanel]);



 const handleTextEdit = useCallback(() => {
  if (!textRef.current) return;

  const textNode = textRef.current;
  const stage = textNode.getStage();
  if (!stage) return;

  textNode.hide();
  setIsEditing(true);

  const textPosition = textNode.absolutePosition();
  const stageBox = stage.container().getBoundingClientRect();
  const originalText = node.text || '';

  // Create a contentEditable div
  const editor = document.createElement('div');
  document.body.appendChild(editor);

  // Start with the current text
  editor.innerText = originalText;

  // Make it editable
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-multiline', 'true');

  // Base styling
  editor.style.position = 'absolute';
  editor.style.top = `${stageBox.top + textPosition.y}px`;
  editor.style.left = `${stageBox.left + textPosition.x}px`;
  editor.style.fontSize = `${14 * viewport.scale}px`;
  editor.style.fontFamily = 'Arial, sans-serif';
  editor.style.border = '2px solid #3b82f6';
  editor.style.padding = '8px';
  editor.style.margin = '0px';
  editor.style.overflow = 'hidden';
  editor.style.background = 'hsl(var(--background))';
  editor.style.color = 'hsl(var(--foreground))';
  editor.style.outline = 'none';
  editor.style.textAlign = 'center';
  editor.style.whiteSpace = 'pre-wrap';
  editor.style.wordWrap = 'break-word';
  editor.style.resize = 'none';

  // Flex centering
  editor.style.display = 'flex';
  editor.style.alignItems = 'center';
  editor.style.justifyContent = 'center';

  // Shape visuals
  if (node.type === 'ellipse') {
    editor.style.borderRadius = '50%';
  } else if (node.type === 'diamond') {
    editor.style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  }

  const resizeEditor = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fontSize = 14 * viewport.scale;
    ctx.font = `${fontSize}px Arial`;

    const lines = editor.innerText.split('\n');
    const longestLine = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
    const measuredWidth = ctx.measureText(longestLine).width;

    const textWidth = measuredWidth / viewport.scale + 16 + TEXT_NODE_PADDING * 2;
    const lineHeight = fontSize * 1.2;
    const textHeight = lines.length * lineHeight / viewport.scale + 16 + TEXT_NODE_PADDING * 2;

    const newWidth = Math.max(node.size.width, textWidth);
    const newHeight = Math.max(node.size.height, textHeight);

    editor.style.width = `${newWidth * viewport.scale}px`;
    editor.style.height = `${newHeight * viewport.scale}px`;

    // Vertically center editor relative to node
    editor.style.top = `${stageBox.top + textPosition.y + (node.size.height * viewport.scale) / 2 - (newHeight * viewport.scale) / 2}px`;

    // Sync node data
    updateNodeSync(node.id, {
      size: { width: newWidth, height: newHeight },
      text: editor.innerText,
    });
  };

  // Initial layout
  resizeEditor();

  // Real-time updates
  const handleInput = () => {
    updateNodeSync(node.id, { text: editor.innerText });
    resizeEditor();
  };
  editor.addEventListener('input', handleInput);

  // Cleanup
  const cleanup = () => {
    if (textRef.current) textRef.current.show();
    setIsEditing(false);
    if (document.body.contains(editor)) document.body.removeChild(editor);
  };

  editor.addEventListener('blur', cleanup);

  editor.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      cleanup();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      updateNodeSync(node.id, { text: originalText });
      cleanup();
    }
  });

  // Focus & select all text so typing overwrites it
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}, [node.id, node.text, node.size, node.type, viewport.scale, updateNodeSync]);



 const handleDoubleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
  e.cancelBubble = true;
  if (!readOnly) {
    setIsEditing(true);
    handleTextEdit();
  }
}, [handleTextEdit, readOnly]);
  const handleResize = useCallback((newSize: { width: number; height: number }) => {
   useCanvasStore.setState((state) => {
     const updatedNodes = state.nodes.map((n) =>
       n.id === node.id ? { ...n, size: newSize } : n
     );
     const updatedEdges = state.edges.map((edge) => {
       if (edge.sourceNodeId === node.id || edge.targetNodeId === node.id) {
         const sourceNode = edge.sourceNodeId === node.id ? { ...node, size: newSize } : state.nodes.find((n) => n.id === edge.sourceNodeId)!;
         const targetNode = edge.targetNodeId === node.id ? { ...node, size: newSize } : state.nodes.find((n) => n.id === edge.targetNodeId)!;
         return {
           ...edge,
           sourceAnchor: state.getAnchor(sourceNode, targetNode),
           targetAnchor: state.getAnchor(targetNode, sourceNode),
         };
       }
       return edge;
     });

     return { nodes: updatedNodes, edges: updatedEdges };
   });
   useCanvasStore.getState().saveHistory();
  }, [node.id]);


const getConnectionPoints = (node: Node) => {
  const w = node.size.width;
  const h = node.size.height;
  const cx = w / 2;
  const cy = h / 2;
  return [
    { x: cx, y: 0 }, // top
    { x: w, y: cy }, // right
    { x: cx, y: h }, // bottom
    { x: 0, y: cy }, // left
  ].filter(point => 
    point.x >= 0 && point.x <= w && point.y >= 0 && point.y <= h
  );
};

  const renderShape = () => {
      const maxStrokeWidth = 10;
   const shapeProps = {
  width: node.size.width,
  height: node.size.height,
  fill: node.fill || '#ffffff',

  stroke:
    connectionSource === node.id
      ? '#3b82f6'
      : isSelected && selectionVisible
      ? '#3b82f6'
      : node.stroke || '#666666',

  strokeWidth: Math.min(
    maxStrokeWidth,
    (node.strokeWidth || 2) *
      (connectionSource === node.id || (isSelected && selectionVisible) ? 1.5 : 1)
  ),
};

    switch (node.type) {
      case 'text':
        return (isSelected || connectionSource === node.id) ? (
          <Rect
            width={node.size.width}
            height={node.size.height}
            fill="transparent"
            stroke={connectionSource === node.id ? '#3b82f6' : '#3b82f6'}
            strokeWidth={(node.strokeWidth || 2) * 1.5}
          />
        ) : null;
      
      case 'rectangle':
        return <Rect {...shapeProps} cornerRadius={4} />;
      
      case 'ellipse':
        return (
          <Ellipse
            radiusX={node.size.width / 2}
            radiusY={node.size.height / 2}
            x={node.size.width / 2}
            y={node.size.height / 2}
            fill={shapeProps.fill}
            stroke={shapeProps.stroke}
            strokeWidth={shapeProps.strokeWidth}
          />
        );
      
      case 'diamond':
        const points = [
          node.size.width / 2, 0,
          node.size.width, node.size.height / 2,
          node.size.width / 2, node.size.height,
          0, node.size.height / 2,
        ];
        return (
          <Line
            points={points}
            closed
            fill={shapeProps.fill}
            stroke={shapeProps.stroke}
            strokeWidth={shapeProps.strokeWidth}
          />
        );
      
      default:
        return <Rect {...shapeProps} />;
    }
  };

  return (
    <Group
      ref={groupRef}
      x={node.position.x}
      y={node.position.y}
     draggable={tool === 'select' && !readOnly}
     onDragStart={!readOnly ? handleDragStart : undefined}
     onDragMove={!readOnly ? handleDragMove : undefined}
     onDragEnd={!readOnly ? handleDragEnd : undefined}
     onClick={!readOnly ? handleClick : undefined}
     onDblClick={!readOnly ? handleDoubleClick : undefined}
      opacity={isDragging ? 0.8 : 1}
      id={node.id}
      name="node"
      onMouseEnter={!readOnly ? () => setIsHovered(true) : undefined}
      onMouseLeave={!readOnly ? () => setIsHovered(false) : undefined}
      listening={!readOnly}
    >
      {renderShape()}
      
      <Text
  ref={textRef}
  text={node.text || 'Text'}
  x={0}
  y={0}
  width={node.size.width}
  height={node.size.height}
  align="center"
  verticalAlign="middle"
  fontSize={14}
  fontFamily="Arial"
  fill={node.type === 'text' ? (isDark ? '#ffffff' : '#000000') : 'hsl(var(--foreground))'}
  wrap="word"
  ellipsis
  visible={!isEditing}
  onDblClick={!readOnly ? handleTextEdit : undefined}
/>
      
      <ResizeHandles
        node={node}
        isSelected={isSelected && !readOnly}
        onResize={handleResize}
        viewport={viewport}
      />
  {tool === 'select' && isSelected && !readOnly && (
  getConnectionPoints(node).map((point, index) => {
    const handleOffset = 15;
    const cx = node.size.width / 2;
    const cy = node.size.height / 2;
    const vx = point.x - cx;
    const vy = point.y - cy;
    const length = Math.hypot(vx, vy);
    if (length === 0) return null;
    const nx = vx / length;
    const ny = vy / length;
    const outsideX = point.x + nx * handleOffset;
    const outsideY = point.y + ny * handleOffset;
    const angle = Math.atan2(ny, nx) * (180 / Math.PI);
    return (
      <Group key={`conn-${index}`} x={outsideX} y={outsideY} rotation={angle}>
        <Arrow
          points={[0, 0, 10 / viewport.scale, 0]}
          stroke="#3b82f6"
          fill="#3b82f6"
          strokeWidth={2 / viewport.scale}
          pointerLength={5 / viewport.scale}
          pointerWidth={5 / viewport.scale}
          pointerAtEnding={true}
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'crosshair';
            }
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) {
              stage.container().style.cursor = 'default';
            }
          }}
          onMouseDown={(e) => {
            e.cancelBubble = true;
            if (e.evt) {
              e.evt.preventDefault();
              e.evt.stopPropagation();
            }
            const stage = e.target.getStage();
            if (!stage) return;
            const pos = stage.getPointerPosition();
            if (!pos) return;
            const worldPos = {
              x: (pos.x - viewport.x) / viewport.scale,
              y: (pos.y - viewport.y) / viewport.scale,
            };
            startDragConnection(node.id, worldPos);
          }}
        />
      </Group>
    );
  })
)}
    </Group>
  );
};