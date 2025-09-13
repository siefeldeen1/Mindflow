import React, { useRef, useCallback, useState } from 'react';
import { Group, Rect, Ellipse, Line, Text } from 'react-konva';
import Konva from 'konva';
import { Node, Point } from '@/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import { ResizeHandles } from './ResizeHandles';

interface CanvasNodeProps {
  node: Node;
  isSelected: boolean;
}

const TEXT_NODE_PADDING = 10; // Padding to prevent arrows touching text

export const CanvasNode: React.FC<CanvasNodeProps> = ({ node, isSelected }) => {
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const {
    updateNode,
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
  } = useCanvasStore();

  const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    e.evt.stopPropagation();
    e.evt.preventDefault(); // Added: Block default browser behavior
    setIsDragging(true);
    setDragging(true);
    if (!isSelected) {
      selectNode(node.id);
    }
  }, [isSelected, selectNode, node.id, setDragging]);

  const handleDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    e.evt.stopPropagation();
    e.evt.preventDefault();
    
    
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
    e.evt.stopPropagation();
    e.evt.preventDefault(); // Added: Block default browser behavior
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
    } else {
      selectNode(node.id, e.evt.ctrlKey || e.evt.metaKey);
      if (node.type === 'text') {
        setIsEditing(true);
      }
    }
  }, [tool, isConnecting, connectionSource, node.id, edges, endConnection, selectNode, startConnection]);

  const handleDoubleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    
    setIsEditing(true);
  }, []);

 const handleTextEdit = useCallback((e: Konva.KonvaEventObject<Event>) => {
  if (textRef.current) {
    const textNode = textRef.current;
    const stage = textNode.getStage();
    if (!stage) return;

    textNode.hide();
    
    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();
    
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    
    textarea.value = node.text || '';
    textarea.style.position = 'absolute';
    textarea.style.top = (stageBox.top + textPosition.y) + 'px';
    textarea.style.left = (stageBox.left + textPosition.x) + 'px';
    textarea.style.width = (node.size.width * viewport.scale) + 'px';
    textarea.style.height = (node.size.height * viewport.scale) + 'px';
    textarea.style.fontSize = (14 * viewport.scale) + 'px';
    textarea.style.border = '2px solid #3b82f6';
    textarea.style.padding = '8px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'hsl(var(--background))';
    textarea.style.color = 'hsl(var(--foreground))';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.textAlign = 'center';
    textarea.style.fontFamily = 'Arial';
    textarea.style.transformOrigin = 'left top';
    
    if (node.type === 'ellipse') {
      textarea.style.borderRadius = '50%';
    } else if (node.type === 'diamond') {
      textarea.style.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    }
    
    const resizeTextarea = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        context.font = `${14 * viewport.scale}px Arial`;
        const lines = textarea.value.split('\n');
        const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
        const textWidth = context.measureText(longestLine).width / viewport.scale + 16 + TEXT_NODE_PADDING * 2;
        const lineHeight = 14 * 1.2;
        const textHeight = lines.length * lineHeight + 16 + TEXT_NODE_PADDING * 2;
        
        const newWidth = Math.max(node.size.width, textWidth);
        const newHeight = Math.max(node.size.height, textHeight);
        
        textarea.style.width = `${newWidth * viewport.scale}px`;
        textarea.style.height = `${newHeight * viewport.scale}px`;
        textarea.style.paddingTop = `${(newHeight * viewport.scale - lines.length * 14 * viewport.scale * 1.2) / 2}px`;
        textarea.style.lineHeight = `${lineHeight * viewport.scale}px`;
        
        textarea.style.top = (stageBox.top + textPosition.y) + 'px';
        
        updateNode(node.id, {
          size: {
            width: newWidth,
            height: newHeight,
          },
        });
      }
    };
    
    textarea.addEventListener('input', resizeTextarea);
    
    textarea.focus();
    textarea.select();
    
    const removeTextarea = () => {
      textarea.parentNode?.removeChild(textarea);
      textNode.show();
      setIsEditing(false);
    };
    
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        updateNode(node.id, { text: textarea.value });
        removeTextarea();
      } else if (e.key === 'Escape') {
        removeTextarea();
      }
    });
    
    textarea.addEventListener('blur', () => {
      updateNode(node.id, { text: textarea.value });
      removeTextarea();
    });
    
    resizeTextarea();
  }
}, [node, updateNode, viewport.scale]);

  const handleResize = useCallback((newSize: { width: number; height: number }) => {
    useCanvasStore.setState((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === node.id ? { ...n, size: newSize } : n
      ),
    }));
  }, [node.id]);

  const renderShape = () => {
    const shapeProps = {
      width: node.size.width,
      height: node.size.height,
      fill: node.fill || '#ffffff',
      stroke: connectionSource === node.id ? '#3b82f6' : isSelected ? '#3b82f6' : (node.stroke || '#666666'),
      strokeWidth: (node.strokeWidth || 2) * (connectionSource === node.id || isSelected ? 1.5 : 1),
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
      draggable={tool === 'select'}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      opacity={isDragging ? 0.8 : 1}
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
        fill="hsl(var(--foreground))"
        wrap="word"
        ellipsis
        onDblClick={handleTextEdit}
      />
      
      <ResizeHandles
        node={node}
        isSelected={isSelected}
        onResize={handleResize}
        viewport={viewport}
      />
    </Group>
  );
};