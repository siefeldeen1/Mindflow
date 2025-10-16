import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { Node, Edge, CanvasState, ViewportState, Point, NodeType, HistoryState } from '@/types';
import { useDocumentStore } from '@/store/useDocumentStore';

interface CanvasStore extends CanvasState {
  showPropertyPanel: boolean;
  addNode: (type: NodeType, position: Point) => void;
  addTextNode: (position: Point) => void;
  updateNode: (id: string, updates: Partial<Node>) => void;
  updateNodeSync: (id: string, updates: Partial<Node>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string, multiSelect?: boolean) => void;
  selectNodes: (ids: string[]) => void;
  selectEdge: (id: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  deleteSelected: () => void;
  addEdge: (sourceNodeId: string, targetNodeId: string) => void;
  deleteEdge: (id: string) => void;
  updateEdgeAnchors: (edgeId: string, sourceAnchor: Point, targetAnchor: Point) => void;
  handleEdgeClick: (edgeId: string, multiSelect?: boolean) => void;
  setViewport: (viewport: Partial<ViewportState>) => void;
  zoom: (delta: number, center: Point) => void;
  pan: (delta: Point) => void;
  setTool: (tool: CanvasState['tool']) => void;
  startConnection: (nodeId: string) => void;
  endConnection: (nodeId: string | null) => void;
  cancelConnection: () => void;
  startSelectionBox: (point: Point) => void;
  updateSelectionBox: (point: Point) => void;
  endSelectionBox: () => void;
  setDragging: (isDragging: boolean) => void;
  setPanning: (isPanning: boolean) => void;
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
  clear: () => void;
  loadCanvas: (canvasState: CanvasState) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  updateConnectedEdges: (nodeId: string) => void;
  getAnchor: (fromNode: Node, toNode: Node) => Point;
  flushUpdateNode: () => void;
  setShowPropertyPanel: (show: boolean) => void;
  duplicateNode: (nodeId: string) => void;
  isDragConnecting: boolean;
  tempTarget: Point | null;
  startDragConnection: (nodeId: string, initialPos: Point) => void;
  endDragConnection: (targetNodeId: string | null) => void;
  updateTempTarget: (pos: Point) => void;
  getTempAnchor: (nodeId: string, toPoint: Point) => Point;
  selectionVisible: boolean;
  setSelectionVisible: (visible: boolean) => void;
}

const DEFAULT_NODE_SIZE = { width: 120, height: 80 };
const DEFAULT_VIEWPORT = { x: 0, y: 0, scale: 1 };
const TEXT_NODE_PADDING = 10;

// Utility function for shallow equality check of relevant state
const shallowEqual = (objA: any, objB: any): boolean => {
  if (objA === objB) return true;
  if (typeof objA !== 'object' || typeof objB !== 'object' || objA == null || objB == null) return false;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (key === 'nodes' || key === 'edges' || key === 'selectedNodes' || key === 'selectedEdges' || key === 'viewport') {
      if (JSON.stringify(objA[key]) !== JSON.stringify(objB[key])) return false;
    } else if (objA[key] !== objB[key]) {
      return false;
    }
  }

  return true;
};

export const useCanvasStore = create<CanvasStore>((set, get) => {

  // Store the last document state to avoid redundant updates
  let lastDocumentState: Partial<CanvasState> | null = null;
  isDragConnecting: false;
  tempTarget: null;

  // Helper function to update document state
  const updateDocument = () => {
    const { activeDocumentId } = useDocumentStore.getState();
    if (activeDocumentId) {
      const state = get();
      const newDocumentState: Partial<CanvasState> = {
        nodes: state.nodes,
        edges: state.edges,
        selectedNodes: state.selectedNodes,
        selectedEdges: state.selectedEdges,
        viewport: state.viewport,
      };

      if (!lastDocumentState || !shallowEqual(newDocumentState, lastDocumentState)) {
        lastDocumentState = { ...newDocumentState };
        setTimeout(() => {
          useDocumentStore.getState().updateDocumentState(activeDocumentId, newDocumentState);
        }, 0);
      }
    }
  };
  const debouncedUpdateDocument = debounce(updateDocument, 300);

  const debouncedUpdateNode = debounce((id: string, updates: Partial<Node>) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
    }));
    get().updateConnectedEdges(id);
    useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
    debouncedUpdateDocument();
  }, 100);




  const getAnchor = (fromNode: Node, toNode: Node): Point => {
    const fromCenter = {
      x: fromNode.position.x + fromNode.size.width / 2,
      y: fromNode.position.y + fromNode.size.height / 2,
    };

    const toCenter = {
      x: toNode.position.x + toNode.size.width / 2,
      y: toNode.position.y + toNode.size.height / 2,
    };

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) return fromCenter;

    const nx = dx / dist;
    const ny = dy / dist;

    switch (fromNode.type) {
      case 'rectangle':
      case 'text':
        const halfWidth = fromNode.size.width / 2;
        const halfHeight = fromNode.size.height / 2;
        const tRect = 1 / (Math.abs(nx / halfWidth) + Math.abs(ny / halfHeight));
        return {
          x: fromCenter.x + tRect * nx,
          y: fromCenter.y + tRect * ny,
        };
      case 'ellipse':
        const a = fromNode.size.width / 2;
        const b = fromNode.size.height / 2;
        const theta = Math.atan2(dy, dx);
        return {
          x: fromCenter.x + a * Math.cos(theta),
          y: fromCenter.y + b * Math.sin(theta),
        };
      case 'diamond':
        const w = fromNode.size.width / 2;
        const h = fromNode.size.height / 2;
        const tDiamond = 1 / (Math.abs(nx / w) + Math.abs(ny / h));
        return {
          x: fromCenter.x + tDiamond * nx,
          y: fromCenter.y + tDiamond * ny,
        };
      default:
        return fromCenter;
    }
  };

  const updateConnectedEdges = (nodeId: string) => {
    set((state) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return {};

      const updatedEdges = state.edges.map((edge) => {
        if (edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId) return edge;

        const sourceNode = state.nodes.find((n) => n.id === edge.sourceNodeId)!;
        const targetNode = state.nodes.find((n) => n.id === edge.targetNodeId)!;

        const sourceAnchor = getAnchor(sourceNode, targetNode);
        const targetAnchor = getAnchor(targetNode, sourceNode);

        return { ...edge, sourceAnchor, targetAnchor };
      });

      return { edges: updatedEdges };
    });
  };



  return {
    nodes: [],
    edges: [],
    selectedNodes: [],
    selectedEdges: [],
    viewport: DEFAULT_VIEWPORT,
    tool: 'select',
    isConnecting: false,
    connectionSource: null,
    history: [],
    historyIndex: -1,
    isDragging: false,
    isPanning: false,
    selectionBox: null,
    showPropertyPanel: false,
    selectionVisible: true,
    addNode: (type: NodeType, position: Point) => {
      const node: Node = {
        id: uuidv4(),
        type,
        position,
        size: DEFAULT_NODE_SIZE,
        text: 'New Node',
        fill: '#ffffff',
        stroke: '#666666',
        strokeWidth: 2,
      };


      set((state) => ({
        nodes: [...state.nodes, node],
        selectedNodes: [node.id],
        selectedEdges: [],
      }));
      debouncedUpdateDocument();
      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
    },

    getTempAnchor: (nodeId: string, toPoint: Point) => {
      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };
      const fromCenter = {
        x: node.position.x + node.size.width / 2,
        y: node.position.y + node.size.height / 2,
      };
      const dx = toPoint.x - fromCenter.x;
      const dy = toPoint.y - fromCenter.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) return fromCenter;
      const nx = dx / dist;
      const ny = dy / dist;
      switch (node.type) {
        case 'rectangle':
        case 'text':
          const halfWidth = node.size.width / 2;
          const halfHeight = node.size.height / 2;
          const tRect = 1 / (Math.abs(nx / halfWidth) + Math.abs(ny / halfHeight));
          return {
            x: fromCenter.x + tRect * nx,
            y: fromCenter.y + tRect * ny,
          };
        case 'ellipse':
          const a = node.size.width / 2;
          const b = node.size.height / 2;
          const theta = Math.atan2(dy, dx);
          return {
            x: fromCenter.x + a * Math.cos(theta),
            y: fromCenter.y + b * Math.sin(theta),
          };
        case 'diamond':
          const w = node.size.width / 2;
          const h = node.size.height / 2;
          const tDiamond = 1 / (Math.abs(nx / w) + Math.abs(ny / h));
          return {
            x: fromCenter.x + tDiamond * nx,
            y: fromCenter.y + tDiamond * ny,
          };
        default:
          return fromCenter;
      }
    },
    startDragConnection: (nodeId: string, initialPos: Point) => {
      set({
        isConnecting: true,
        connectionSource: nodeId,
        isDragConnecting: true,
        tempTarget: initialPos,
      });
    },
    updateTempTarget: (pos: Point) => {
      set({ tempTarget: pos });
    },
    endDragConnection: (targetNodeId: string | null) => {
      get().endConnection(targetNodeId);
      set({
        isDragConnecting: false,
        tempTarget: null,
      });
    },

    duplicateNode: (nodeId: string) => {
      const state = get();
      const node = state.nodes.find(n => n.id === nodeId);
      if (!node) return;

      const newNode: Node = {
        ...node,
        id: uuidv4(),
        position: {
          x: node.position.x + 20,
          y: node.position.y + 20,
        },
      };

      set({
        nodes: [...state.nodes, newNode],
        selectedNodes: [newNode.id],
        selectedEdges: [],
      });

      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      get().saveHistory();
      debouncedUpdateDocument();
    },
    addTextNode: (position: Point) => {
      const node: Node = {
        id: uuidv4(),
        type: 'text' as NodeType,
        position,
        size: { width: 100 + TEXT_NODE_PADDING * 2, height: 30 + TEXT_NODE_PADDING * 2 },
        text: 'Click to edit',
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
      };

      set((state) => ({
        nodes: [...state.nodes, node],
        selectedNodes: [node.id],
        selectedEdges: [],
      }));

      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      get().saveHistory();
      debouncedUpdateDocument();
    },

    updateNode: debouncedUpdateNode,
    flushUpdateNode: () => debouncedUpdateNode.flush(),

    updateNodeSync: (id: string, updates: Partial<Node>) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === id ? { ...node, ...updates } : node
        ),
      }));
      get().updateConnectedEdges(id);
      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      debouncedUpdateDocument();
    },

    deleteNode: (id: string) => {
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== id),
        edges: state.edges.filter(
          (edge) => edge.sourceNodeId !== id && edge.targetNodeId !== id
        ),
        selectedNodes: state.selectedNodes.filter((nodeId) => nodeId !== id),
      }));

      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      get().saveHistory();
      debouncedUpdateDocument();
    },

    selectNode: (id: string, multiSelect = false) => {
      set((state) => {
        const isSelected = state.selectedNodes.includes(id);

        if (multiSelect) {
          return {
            selectedNodes: isSelected
              ? state.selectedNodes.filter((nodeId) => nodeId !== id)
              : [...state.selectedNodes, id],
            selectedEdges: [],
          };
        }

        return {
          selectedNodes: isSelected ? [] : [id],
          selectedEdges: [],
        };
      });
      debouncedUpdateDocument();
    },

    selectNodes: (ids: string[]) => {
      set({
        selectedNodes: ids,
        selectedEdges: [],
      });
      debouncedUpdateDocument();
    },

    selectEdge: (id: string, multiSelect = false) => {
      set((state) => {
        const isSelected = state.selectedEdges.includes(id);

        if (multiSelect) {
          return {
            selectedEdges: isSelected
              ? state.selectedEdges.filter((edgeId) => edgeId !== id)
              : [...state.selectedEdges, id],
            selectedNodes: [],
          };
        }

        return {
          selectedEdges: isSelected ? [] : [id],
          selectedNodes: [],
        };
      });
      debouncedUpdateDocument();
    },

    clearSelection: () => {
      set({
        selectedNodes: [],
        selectedEdges: [],
      });
      debouncedUpdateDocument();
    },

    deleteSelected: () => {
      const { selectedNodes, selectedEdges } = get();

      set((state) => ({
        nodes: state.nodes.filter((node) => !selectedNodes.includes(node.id)),
        edges: state.edges.filter(
          (edge) =>
            !selectedEdges.includes(edge.id) &&
            !selectedNodes.includes(edge.sourceNodeId) &&
            !selectedNodes.includes(edge.targetNodeId)
        ),
        selectedNodes: [],
        selectedEdges: [],
      }));

      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      get().saveHistory();
      debouncedUpdateDocument();
    },

    addEdge: (sourceNodeId: string, targetNodeId: string) => {
      const { nodes } = get();
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      const targetNode = nodes.find((n) => n.id === targetNodeId);

      if (!sourceNode || !targetNode || sourceNodeId === targetNodeId) return;

      const sourceAnchor = getAnchor(sourceNode, targetNode);
      const targetAnchor = getAnchor(targetNode, sourceNode);

      const edge: Edge = {
        id: uuidv4(),
        sourceNodeId,
        targetNodeId,
        sourceAnchor,
        targetAnchor,
      };

      set((state) => ({
        edges: [...state.edges, edge],
        isConnecting: false,
        connectionSource: null,
      }));

      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      get().saveHistory();
      debouncedUpdateDocument();
    },

    deleteEdge: (id: string) => {
      set((state) => ({
        edges: state.edges.filter((edge) => edge.id !== id),
        selectedEdges: state.selectedEdges.filter((edgeId) => edgeId !== id),
      }));

      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      get().saveHistory();
      debouncedUpdateDocument();
    },

    updateEdgeAnchors: (edgeId: string, sourceAnchor: Point, targetAnchor: Point) => {
      set((state) => ({
        edges: state.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, sourceAnchor, targetAnchor } : edge
        ),
      }));
      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      debouncedUpdateDocument();
    },

    handleEdgeClick: (edgeId: string, multiSelect = false) => {
      const { tool } = get();
      if (tool === 'line') {
        get().deleteEdge(edgeId);
      } else {
        get().selectEdge(edgeId, multiSelect);
      }
    },

    setViewport: (viewport: Partial<ViewportState>) => {
      set((state) => ({
        viewport: { ...state.viewport, ...viewport },
      }));
    },

    zoom: (delta: number, center: Point) => {
      const { viewport } = get();
      const oldScale = viewport.scale;
      const newScale = oldScale * (1 + delta);
      const clamped = Math.max(0.25, Math.min(2, newScale));

      const oldWorldX = (center.x - viewport.x) / oldScale;
      const oldWorldY = (center.y - viewport.y) / oldScale;

      const newX = center.x - oldWorldX * clamped;
      const newY = center.y - oldWorldY * clamped;

      set({
        viewport: {
          x: newX,
          y: newY,
          scale: clamped,
        },
      });
    },

    pan: (delta: Point) => {
      set((state) => ({
        viewport: {
          ...state.viewport,
          x: state.viewport.x + delta.x,
          y: state.viewport.y + delta.y,
        },
      }));
    },

    setTool: (tool: CanvasState['tool']) => {
      if (tool === 'line') {
        set({ tool });
      } else {
        set({ tool, isConnecting: false, connectionSource: null });
      }
    },

    startConnection: (nodeId: string) => {
      set({
        isConnecting: true,
        connectionSource: nodeId,
        tool: 'line',
      });
    },

    endConnection: (nodeId: string | null) => {
      const { connectionSource } = get();
      if (nodeId && connectionSource && connectionSource !== nodeId) {
        get().addEdge(connectionSource, nodeId);
      }
      set({
        isConnecting: false,
        connectionSource: null,
      });
    },

    cancelConnection: () => {
      set({
        isConnecting: false,
        connectionSource: null,
        tool: 'select',
      });
    },

    startSelectionBox: (point: Point) => {
      set({
        selectionBox: {
          start: point,
          end: point,
          active: true,
          stroke: '#3b82f6',
          fill: 'rgba(59, 130, 246, 0.2)',
          strokeWidth: 1,
        },
      });
    },

    updateSelectionBox: (point: Point) => {
      set((state) => ({
        selectionBox: state.selectionBox
          ? { ...state.selectionBox, end: point }
          : null,
      }));
    },

    endSelectionBox: () => {
      const { selectionBox, nodes } = get();

      if (selectionBox) {
        const { start, end } = selectionBox;
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        const selectedNodeIds = nodes
          .filter((node) => {
            const nodeMinX = node.position.x;
            const nodeMaxX = node.position.x + node.size.width;
            const nodeMinY = node.position.y;
            const nodeMaxY = node.position.y + node.size.height;

            return (
              nodeMaxX >= minX &&
              nodeMinX <= maxX &&
              nodeMaxY >= minY &&
              nodeMinY <= maxY
            );
          })
          .map((node) => node.id);

        set({
          selectedNodes: selectedNodeIds,
          selectedEdges: [],
          selectionBox: null,
        });
        debouncedUpdateDocument();
      }
    },

    setDragging: (isDragging: boolean) => {
      set({ isDragging });
    },

    setPanning: (isPanning: boolean) => {
      set({ isPanning });
    },
    setSelectionVisible: (visible: boolean) => set({ selectionVisible: visible }),
    saveHistory: () => {
      const { nodes, edges, viewport, history, historyIndex } = get();
      const newHistoryState: HistoryState = {
        nodes: JSON.parse(JSON.stringify(nodes || [])),
        edges: JSON.parse(JSON.stringify(edges || [])),
        viewport: { ...viewport },
      };

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newHistoryState);

      if (newHistory.length > 50) {
        newHistory.shift();
      }

      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
      });
    },

    undo: () => {
      const { history, historyIndex } = get();

      if (historyIndex > 0) {
        const prevState = history[historyIndex - 1];
        set({
          nodes: JSON.parse(JSON.stringify(prevState.nodes || [])),
          edges: JSON.parse(JSON.stringify(prevState.edges || [])),
          viewport: { ...prevState.viewport },
          historyIndex: historyIndex - 1,
          selectedNodes: [],
          selectedEdges: [],
        });
        useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
        debouncedUpdateDocument();
      }
    },

    redo: () => {
      const { history, historyIndex } = get();

      if (historyIndex < history.length - 1) {
        const nextState = history[historyIndex + 1];
        set({
          nodes: JSON.parse(JSON.stringify(nextState.nodes || [])),
          edges: JSON.parse(JSON.stringify(nextState.edges || [])),
          viewport: { ...nextState.viewport },
          historyIndex: historyIndex + 1,
          selectedNodes: [],
          selectedEdges: [],
        });
        useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
        debouncedUpdateDocument();
      }
    },

    clear: () => {
      set({
        nodes: [],
        edges: [],
        selectedNodes: [],
        selectedEdges: [],
        viewport: DEFAULT_VIEWPORT,
        showPropertyPanel: false,
      });
      useDocumentStore.getState().markUnsaved(useDocumentStore.getState().activeDocumentId!);
      get().saveHistory();
      debouncedUpdateDocument();
    },

    loadCanvas: (canvasState: CanvasState) => {
      const currentState = get();
      const newNodes = canvasState.nodes ? JSON.parse(JSON.stringify(canvasState.nodes)) : [];
      const newEdges = canvasState.edges ? JSON.parse(JSON.stringify(canvasState.edges)) : [];
      const newViewport = canvasState.viewport || DEFAULT_VIEWPORT;

      if (
        JSON.stringify(currentState.nodes) === JSON.stringify(newNodes) &&
        JSON.stringify(currentState.edges) === JSON.stringify(newEdges)
      ) {
        return;
      }

      set({
        nodes: newNodes,
        edges: newEdges,
        selectedNodes: [],
        selectedEdges: [],
        viewport: newViewport,
        showPropertyPanel: false,
      });
      get().saveHistory();
      debouncedUpdateDocument();
    },

    handleKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        get().deleteSelected();
      }
    },

    updateConnectedEdges,
    getAnchor,

    setShowPropertyPanel: (show: boolean) => set({ showPropertyPanel: show }),
    isDragConnecting: false,
    tempTarget: null,
  };
});