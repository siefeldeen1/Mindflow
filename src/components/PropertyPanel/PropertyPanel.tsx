import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCanvasStore } from '@/store/useCanvasStore';

export const PropertyPanel: React.FC = () => {
  // Modified: Added updateNodeSync to destructure
  const { nodes, selectedNodes, updateNode, updateNodeSync, saveHistory } = useCanvasStore();

  const selectedNode = selectedNodes.length === 1
    ? nodes.find(node => node.id === selectedNodes[0])
    : null;

  // Local state for input values
  const [width, setWidth] = useState(selectedNode ? Math.round(selectedNode.size.width).toString() : '');
  const [height, setHeight] = useState(selectedNode ? Math.round(selectedNode.size.height).toString() : '');

  // Sync local state with selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      setWidth(Math.round(selectedNode.size.width).toString());
      setHeight(Math.round(selectedNode.size.height).toString());
    } else {
      setWidth('');
      setHeight('');
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <Card className="w-80 h-full rounded-none">
        <CardHeader>
          <CardTitle className="text-sm">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a node to edit its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleTextChange = (value: string) => {
    updateNode(selectedNode.id, { text: value });
    saveHistory(); // Trigger edge updates
  };

  // Modified: Use updateNodeSync for immediate updates
  const handlePositionChange = (field: 'x' | 'y', value: string) => {
    const numValue = parseFloat(value) || 0;
    updateNodeSync(selectedNode.id, {
      position: {
        ...selectedNode.position,
        [field]: numValue,
      },
    });
    saveHistory(); // Trigger edge updates
  };

  // Modified: Use updateNodeSync for immediate updates
  const handleSizeChange = (field: 'width' | 'height', value: string) => {
    const numValue = parseFloat(value) || 0;
    updateNodeSync(selectedNode.id, {
      size: {
        ...selectedNode.size,
        [field]: Math.max(20, numValue), // Minimum size
      },
    });
    saveHistory(); // Trigger edge updates
  };

  const handleColorChange = (field: 'fill' | 'stroke', value: string) => {
    updateNode(selectedNode.id, { [field]: value });
    saveHistory(); // Trigger edge updates
  };

  const handleStrokeWidthChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    updateNode(selectedNode.id, { strokeWidth: Math.max(0, numValue) });
    saveHistory(); // Trigger edge updates
  };

  return (
    <Card className="w-80 h-full overflow-x-hidden rounded-none">
      <CardHeader>
        <CardTitle className="text-sm">Properties</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Text */}
        <div className="space-y-2">
          <Label htmlFor="node-text">Text</Label>
          <Textarea
            id="node-text"
            value={selectedNode.text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Enter text..."
            rows={3}
          />
        </div>

        {/* Position */}
        <div className="space-y-2">
          <Label>Position</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="node-x" className="text-xs">X</Label>
              <Input
                id="node-x"
                type="number"
                value={Math.round(selectedNode.position.x)}
                onChange={(e) => handlePositionChange('x', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="node-y" className="text-xs">Y</Label>
              <Input
                id="node-y"
                type="number"
                value={Math.round(selectedNode.position.y)}
                onChange={(e) => handlePositionChange('y', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div className="space-y-2">
          <Label>Size</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="node-width" className="text-xs">Width</Label>
              <Input
                id="node-width"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                onBlur={() => handleSizeChange('width', width)}
              />
            </div>
            <div>
              <Label htmlFor="node-height" className="text-xs">Height</Label>
              <Input
                id="node-height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                onBlur={() => handleSizeChange('height', height)}
              />
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <Label>Appearance</Label>
          <div className="space-y-2">
            <div>
              <Label htmlFor="node-fill" className="text-xs">Fill Color</Label>
              <div className="flex gap-2">
                <Input
                  id="node-fill"
                  type="color"
                  value={selectedNode.fill}
                  onChange={(e) => handleColorChange('fill', e.target.value)}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={selectedNode.fill}
                  onChange={(e) => handleColorChange('fill', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="node-stroke" className="text-xs">Stroke Color</Label>
              <div className="flex gap-2">
                <Input
                  id="node-stroke"
                  type="color"
                  value={selectedNode.stroke}
                  onChange={(e) => handleColorChange('stroke', e.target.value)}
                  className="w-12 h-8 p-1"
                />
                <Input
                  type="text"
                  value={selectedNode.stroke}
                  onChange={(e) => handleColorChange('stroke', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="node-stroke-width" className="text-xs">Stroke Width</Label>
              <Input
                id="node-stroke-width"
                type="number"
                value={selectedNode.strokeWidth}
                onChange={(e) => handleStrokeWidthChange(e.target.value)}
                min="0"
                step="0.5"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Label>Actions</Label>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const newNode = {
                  ...selectedNode,
                  id: crypto.randomUUID(),
                  position: {
                    x: selectedNode.position.x + 20,
                    y: selectedNode.position.y + 20,
                  },
                };
                useCanvasStore.getState().addNode(newNode.type, newNode.position);
                useCanvasStore.getState().updateNode(
                  useCanvasStore.getState().nodes[useCanvasStore.getState().nodes.length - 1].id,
                  {
                    text: newNode.text,
                    fill: newNode.fill,
                    stroke: newNode.stroke,
                    strokeWidth: newNode.strokeWidth,
                    size: newNode.size,
                  }
                );
                saveHistory(); // Trigger edge updates
              }}
            >
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                useCanvasStore.getState().deleteNode(selectedNode.id);
                saveHistory(); // Trigger edge updates
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};