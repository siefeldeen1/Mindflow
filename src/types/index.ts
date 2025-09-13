export type NodeType = 'rectangle' | 'ellipse' | 'diamond' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  type: NodeType;
  position: Point;
  size: { width: number; height: number };
  text: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface Edge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceAnchor: Point;
  targetAnchor: Point;
}

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export interface SelectionBox {
  start: Point;
  end: Point;
  active: boolean;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

export interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNodes: string[];
  selectedEdges: string[];
  viewport: ViewportState;
  tool: 'select' | 'line';
  isConnecting: boolean;
  connectionSource: string | null;
  history: HistoryState[];
  historyIndex: number;
  isDragging: boolean;
  isPanning: boolean;
  selectionBox: SelectionBox | null;
}

export interface HistoryState {
  nodes: Node[];
  edges: Edge[];
  viewport: ViewportState;
}

export interface Document {
  id: string;
  name: string;
  state: CanvasState;
}