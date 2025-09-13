import React, { useState, useEffect, useRef } from 'react';
import { 
  MousePointer, 
  Square, 
  Circle, 
  Diamond, 
  Type, 
  Minus,
  Undo,
  Redo,
  Download,
  Upload,
  Sun,
  Moon,
  Save,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthDialog } from '@/components/Auth/AuthDialog';
import { CanvasState } from '@/types';

interface ToolbarProps {
  activeDocumentId: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeDocumentId }) => {
  const { tool, setTool, undo, redo, clear, history, historyIndex, isConnecting, addNode, addTextNode, nodes, edges, viewport } = useCanvasStore();
  const { toggleTheme } = useThemeStore();
  const { saveDocument, markUnsaved, lastSavedState } = useDocumentStore();
  const { isAuthenticated } = useAuthStore();
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const lastSavedStateRef = useRef<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const isSavingRef = useRef<boolean>(false);
  const justSwitchedTabRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const basePosition = { x: 100, y: 100 };
  const nodeSpacing = 50;
  const nodeSize = 100;
  const maxPerRow = 5;

  // Initialize lastSavedStateRef when activeDocumentId changes
  useEffect(() => {
    if (activeDocumentId && lastSavedState[activeDocumentId]) {
      lastSavedStateRef.current = {
        nodes: JSON.parse(JSON.stringify(lastSavedState[activeDocumentId].nodes)),
        edges: JSON.parse(JSON.stringify(lastSavedState[activeDocumentId].edges)),
      };
      justSwitchedTabRef.current = true;
      
    }
  }, [activeDocumentId, lastSavedState]);

  // Handle notification timeout
  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  // Detect changes to nodes and edges, skipping after tab switch or save
  useEffect(() => {
    if (isSavingRef.current) {
      
      return;
    }
    if (justSwitchedTabRef.current) {
      
      justSwitchedTabRef.current = false;
      return;
    }

    // Normalize nodes and edges for comparison (strip irrelevant properties)
    const normalizeState = (state: any[]) =>
      state.map(item => ({
        ...item,
        // Remove transient properties like selection state
        selected: undefined,
        // Normalize floating-point values to avoid precision issues
        x: item.x ? Math.round(item.x * 100) / 100 : undefined,
        y: item.y ? Math.round(item.y * 100) / 100 : undefined,
        width: item.width ? Math.round(item.width * 100) / 100 : undefined,
        height: item.height ? Math.round(item.height * 100) / 100 : undefined,
      }));

    const currentNodes = normalizeState(nodes);
    const currentEdges = normalizeState(edges);
    const savedNodes = normalizeState(lastSavedStateRef.current.nodes);
    const savedEdges = normalizeState(lastSavedStateRef.current.edges);

    const hasNodeChanges = JSON.stringify(currentNodes) !== JSON.stringify(savedNodes);
    const hasEdgeChanges = JSON.stringify(currentEdges) !== JSON.stringify(savedEdges);
    const hasMeaningfulChanges = (nodes.length > 0 || edges.length > 0) && (hasNodeChanges || hasEdgeChanges);

    if (hasMeaningfulChanges) {
      
      markUnsaved(activeDocumentId);
    } 
  }, [nodes, edges, activeDocumentId, markUnsaved]);

  const handleShapeClick = (shapeType: 'rectangle' | 'ellipse' | 'diamond') => {
    const nodeCount = nodes.length;
    const row = Math.floor(nodeCount / maxPerRow);
    const col = nodeCount % maxPerRow;
    const newPosition = {
      x: basePosition.x + col * (nodeSize + nodeSpacing),
      y: basePosition.y + row * (nodeSize + nodeSpacing),
    };
    addNode(shapeType, newPosition);
    setShowNotification(null);
  };

  const handleTextClick = () => {
    const nodeCount = nodes.length;
    const row = Math.floor(nodeCount / maxPerRow);
    const col = nodeCount % maxPerRow;
    const newPosition = {
      x: basePosition.x + col * (nodeSize + nodeSpacing),
      y: basePosition.y + row * (nodeSize + nodeSpacing),
    };
    addTextNode(newPosition);
    setShowNotification(null);
  };

  const handleLineClick = () => {
    setTool('line');
    setShowNotification('Select the shapes to connect them');
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      setShowNotification('Please log in to save your document');
      return;
    }
    if (!activeDocumentId) {
      setShowNotification('No document selected');
      return;
    }
    try {
      isSavingRef.current = true;
      const state = {
        nodes,
        edges,
        viewport,
        tool,
        isConnecting,
        connectionSource: null,
        history,
        historyIndex,
        isDragging: false,
        isPanning: false,
        selectedNodes: [],
        selectedEdges: [],
        selectionBox: null,
      };
      
      await saveDocument(activeDocumentId, state);
      // Update last saved state
      lastSavedStateRef.current = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      setShowNotification('Document saved');
    } catch (error) {
      console.error('Save error:', error);
      setShowNotification('Failed to save document');
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleExport = () => {
    try {
      const documentState = {
        nodes,
        edges,
        viewport,
      };
      const jsonString = JSON.stringify(documentState, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const docName = useDocumentStore.getState().documents.find(doc => doc.id === activeDocumentId)?.name || 'mindmap';
      link.download = `${docName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setShowNotification('Document exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      setShowNotification('Failed to export document');
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Validate the imported data
        if (!parsed.nodes || !parsed.edges || !parsed.viewport) {
          throw new Error('Invalid file format: Missing required fields');
        }

        const validatedState: CanvasState = {
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          edges: Array.isArray(parsed.edges) ? parsed.edges : [],
          viewport: parsed.viewport || { x: 0, y: 0, scale: 1 },
          selectedNodes: [],
          selectedEdges: [],
          tool: 'select',
          isConnecting: false,
          connectionSource: null,
          history: [],
          historyIndex: -1,
          isDragging: false,
          isPanning: false,
          selectionBox: null,
        };

        // Update canvas and document
        useCanvasStore.getState().loadCanvas(validatedState);
        useDocumentStore.getState().updateDocumentState(activeDocumentId, validatedState);
        useDocumentStore.getState().markUnsaved(activeDocumentId);
        setShowNotification('Document imported successfully');
      } catch (error) {
        console.error('Import error:', error);
        setShowNotification('Failed to import document');
      }
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'text', icon: Type, label: 'Add Text' },
    { id: 'line', icon: Minus, label: isConnecting ? 'Click 2 shapes to connect' : 'Connect Shapes' },
  ] as const;

  const shapes = [
    { id: 'rectangle', icon: Square, label: 'Add Rectangle' },
    { id: 'ellipse', icon: Circle, label: 'Add Ellipse' },
    { id: 'diamond', icon: Diamond, label: 'Add Diamond' },
  ] as const;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-2 overflow-x-auto">
      {showNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-lg shadow-md z-50 animate-notification border border-primary/20">
          {showNotification}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleImport}
        style={{ display: 'none' }}
      />

      <div className="flex items-center gap-1">
        {tools.map((toolItem) => (
          <Button
            key={toolItem.id}
            variant={tool === toolItem.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              if (toolItem.id === 'text') {
                handleTextClick();
              } else if (toolItem.id === 'line') {
                handleLineClick();
              } else {
                setTool(toolItem.id as any);
                setShowNotification(null);
              }
            }}
            className="w-9 h-9 p-0"
            title={toolItem.label}
          >
            <toolItem.icon className="w-4 h-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        {shapes.map((shape) => (
          <Button
            key={shape.id}
            variant="ghost"
            size="sm"
            onClick={() => {
              handleShapeClick(shape.id);
            }}
            className="w-9 h-9 p-0"
            title={shape.label}
          >
            <shape.icon className="w-4 h-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            undo();
            setShowNotification(null);
          }}
          disabled={!canUndo}
          className="w-9 h-9 p-0"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            redo();
            setShowNotification(null);
          }}
          disabled={!canRedo}
          className="w-9 h-9 p-0"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className="w-9 h-9 p-0"
          title="Save"
        >
          <Save className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          className="w-9 h-9 p-0"
          title="Export as JSON"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={triggerFileInput}
          className="w-9 h-9 p-0"
          title="Import from JSON"
        >
          <Upload className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <AuthDialog />
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            clear();
            setShowNotification(null);
          }}
          title="Clear Canvas"
        >
          Clear
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            toggleTheme();
            setShowNotification(null);
          }}
          className="w-9 h-9 p-0"
          title="Toggle Theme"
        >
          {useThemeStore.getState().isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};