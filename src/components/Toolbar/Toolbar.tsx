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
  Save,
  FolderOpen,
  X,
  Loader2,
  Share2,
  Hand,
  Copy,
  Trash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useDocumentStore } from '@/store/useDocumentStore';
import { useAuthStore } from '@/store/useAuthStore';
import { CanvasState } from '@/types';

interface ToolbarProps {
  activeDocumentId: string;
  setShowDeleteConfirm: (id: string | null) => void;
  setShowClearConfirm: (show: boolean) => void;
  readOnly?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeDocumentId, setShowDeleteConfirm, setShowClearConfirm,readOnly = false }) => {
  const { tool, setTool, undo, redo, clear, history, historyIndex, isConnecting, addNode, addTextNode, nodes, edges, viewport } = useCanvasStore();
  const { saveDocument, markUnsaved, lastSavedState,isAutoSaving } = useDocumentStore();
  const { isAuthenticated,token } = useAuthStore();
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
useEffect(() => {
  if (readOnly) {
    setTool('hand');
  }
}, [readOnly, setTool]);
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
    if (readOnly) {
    setShowNotification('Cannot add shapes in read-only mode');
    return;
  }
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
    if (readOnly) {
    setShowNotification('Cannot add text in read-only mode');
    return;
  }
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
    if (readOnly) {
    setShowNotification('Cannot connect shapes in read-only mode');
    return;
  }
    setTool('line');
    setShowNotification('Select the shapes to connect them');
  };

  const handleSave = async () => {
    if (readOnly) {
    setShowNotification('Cannot save in read-only mode');
    return;
  }
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
const handleShare = async () => {
  if (readOnly) {
    setShowNotification('Cannot share in read-only mode');
    return;
  }
    if (!isAuthenticated) {
      setShowNotification('Please log in to share');
      return;
    }
    if (!activeDocumentId) {
      setShowNotification('No document selected');
      return;
    }
    try {
      const state = { nodes, edges, viewport };
      const jsonString = JSON.stringify(state);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ docId: activeDocumentId, json: jsonString }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }
      const { shareLink } = await response.json();
      navigator.clipboard.writeText(shareLink);
      setShowNotification('Share link copied to clipboard');
    } catch (error) {
      console.error('Share error:', error);
      setShowNotification('Failed to share document');
    }
  };
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) {
    setShowNotification('Cannot import in read-only mode');
    return;
  }
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
    if (readOnly) {
    setShowNotification('Cannot import in read-only mode');
    return;
  }
    fileInputRef.current?.click();
  };

  const tools = [
    { id: 'select', icon: MousePointer, label: 'Select' },
    { id: 'hand', icon: Hand, label: 'Pan' },
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
              if (readOnly) {
      setShowNotification('Cannot change tools in read-only mode');
      return;
    }
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
            disabled={readOnly}
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
            if (readOnly) {
      setShowNotification('Cannot undo in read-only mode');
      return;
    }
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
            if (readOnly) {
      setShowNotification('Cannot undo in read-only mode');
      return;
    }
            redo();
            setShowNotification(null);
          }}
          disabled={!canRedo}
          className="w-9 h-9 p-0"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </Button>
        <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      if (readOnly) {
        setShowNotification('Cannot duplicate in read-only mode');
        return;
      }
      const { selectedNodes, duplicateNode } = useCanvasStore.getState();
      if (selectedNodes.length === 1) {
        duplicateNode(selectedNodes[0]);
        setShowNotification('Node duplicated');
      } else {
        setShowNotification('Select exactly one node to duplicate');
      }
    }}
    disabled={useCanvasStore.getState().selectedNodes.length !== 1 || readOnly}
    className="w-9 h-9 p-0"
    title="Duplicate Selected Node"
  >
    <Copy className="w-4 h-4" />
  </Button>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => {
      if (readOnly) {
        setShowNotification('Cannot delete in read-only mode');
        return;
      }
      const { selectedNodes, deleteNode } = useCanvasStore.getState();
      if (selectedNodes.length === 1) {
        deleteNode(selectedNodes[0]);
        setShowNotification('Node deleted');
      } else {
        setShowNotification('Select exactly one node to delete');
      }
    }}
    disabled={useCanvasStore.getState().selectedNodes.length !== 1 || readOnly}
    className="w-9 h-9 p-0"
    title="Delete Selected Node"
  >
    <Trash className="w-4 h-4" />
  </Button>
      </div>

      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-1">
       <Button
  variant="ghost"
  size="sm"
  onClick={handleSave}
  className="w-9 h-9 p-0 relative"
  title="Save"
  disabled={readOnly}
>
  {isAutoSaving ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : (
    <Save className="w-4 h-4" />
  )}
</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExport}
          className="w-9 h-9 p-0"
          title="Export file"
          disabled={readOnly}
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={triggerFileInput}
          className="w-9 h-9 p-0"
          title="Import file"
          disabled={readOnly}
        >
          <Upload className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="w-9 h-9 p-0"
          title="Share Document"
          disabled={readOnly}
        >
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center gap-2 hover:bg-destructive/90 transition-colors duration-200 rounded-full"
          onClick={() => {
    if (readOnly) {
      setShowNotification('Cannot delete tabs in read-only mode');
      return;
    }
    setShowDeleteConfirm(activeDocumentId);
  }}
          disabled={useDocumentStore.getState().documents.length <= 1 || readOnly}
          title="Delete Current Tab"
        >
          <span className="hidden sm:inline">Delete Tab</span>
          <X className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center gap-2 hover:bg-destructive/90 transition-colors duration-200 rounded-full"
          onClick={() => {
            setShowClearConfirm(true);
            setShowNotification(null);
          }}
          title="Clear Canvas"
          disabled={readOnly}
        >
          <span className="hidden sm:inline">Clear</span>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};