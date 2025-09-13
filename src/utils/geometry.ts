import { Point, Node } from '@/types';

export const distance = (p1: Point, p2: Point): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const getNodeCenter = (node: Node): Point => ({
  x: node.position.x + node.size.width / 2,
  y: node.position.y + node.size.height / 2,
});

export const getNodeBounds = (node: Node) => ({
  left: node.position.x,
  top: node.position.y,
  right: node.position.x + node.size.width,
  bottom: node.position.y + node.size.height,
});

export const isPointInNode = (point: Point, node: Node): boolean => {
  const bounds = getNodeBounds(node);
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  );
};

export const getConnectionPoint = (fromNode: Node, toNode: Node): { source: Point; target: Point } => {
  const fromCenter = getNodeCenter(fromNode);
  const toCenter = getNodeCenter(toNode);
  
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  
  // Calculate intersection points with node boundaries
  const sourcePoint = getNodeEdgeIntersection(fromNode, toCenter);
  const targetPoint = getNodeEdgeIntersection(toNode, fromCenter);
  
  return {
    source: sourcePoint,
    target: targetPoint,
  };
};

export const getNodeEdgeIntersection = (node: Node, externalPoint: Point): Point => {
  const center = getNodeCenter(node);
  const bounds = getNodeBounds(node);
  
  const dx = externalPoint.x - center.x;
  const dy = externalPoint.y - center.y;
  
  if (Math.abs(dx) === 0 && Math.abs(dy) === 0) {
    return center;
  }
  
  // Calculate intersection based on node shape
  switch (node.type) {
    case 'ellipse':
      return getEllipseIntersection(node, externalPoint);
    case 'diamond':
      return getDiamondIntersection(node, externalPoint);
    default: // rectangle
      return getRectangleIntersection(node, externalPoint);
  }
};

const getRectangleIntersection = (node: Node, externalPoint: Point): Point => {
  const center = getNodeCenter(node);
  const bounds = getNodeBounds(node);
  
  const dx = externalPoint.x - center.x;
  const dy = externalPoint.y - center.y;
  
  const halfWidth = node.size.width / 2;
  const halfHeight = node.size.height / 2;
  
  // Determine which edge the line intersects
  const slopeToEdgeX = halfHeight / halfWidth;
  const slope = Math.abs(dy / dx);
  
  if (slope <= slopeToEdgeX) {
    // Intersects left or right edge
    const x = dx > 0 ? bounds.right : bounds.left;
    const y = center.y + (dy * halfWidth) / Math.abs(dx);
    return { x, y };
  } else {
    // Intersects top or bottom edge
    const x = center.x + (dx * halfHeight) / Math.abs(dy);
    const y = dy > 0 ? bounds.bottom : bounds.top;
    return { x, y };
  }
};

const getEllipseIntersection = (node: Node, externalPoint: Point): Point => {
  const center = getNodeCenter(node);
  const a = node.size.width / 2; // semi-major axis
  const b = node.size.height / 2; // semi-minor axis
  
  const dx = externalPoint.x - center.x;
  const dy = externalPoint.y - center.y;
  
  if (dx === 0 && dy === 0) return center;
  
  // Parametric form: x = a*cos(t), y = b*sin(t)
  // Find t where the line from center to external point intersects the ellipse
  const angle = Math.atan2(dy, dx);
  
  const x = center.x + a * Math.cos(angle);
  const y = center.y + b * Math.sin(angle);
  
  return { x, y };
};

const getDiamondIntersection = (node: Node, externalPoint: Point): Point => {
  const center = getNodeCenter(node);
  const halfWidth = node.size.width / 2;
  const halfHeight = node.size.height / 2;
  
  const dx = externalPoint.x - center.x;
  const dy = externalPoint.y - center.y;
  
  if (dx === 0 && dy === 0) return center;
  
  // Diamond vertices
  const top = { x: center.x, y: center.y - halfHeight };
  const right = { x: center.x + halfWidth, y: center.y };
  const bottom = { x: center.x, y: center.y + halfHeight };
  const left = { x: center.x - halfWidth, y: center.y };
  
  // Find which edge the line intersects
  const slope = dy / dx;
  const diamondSlope = halfHeight / halfWidth;
  
  if (Math.abs(slope) <= diamondSlope) {
    // Intersects left or right edge
    const edge = dx > 0 ? [top, right, bottom] : [top, left, bottom];
    return getLineIntersection(center, externalPoint, edge[0], edge[2]);
  } else {
    // Intersects top or bottom edge
    const edge = dy > 0 ? [left, bottom, right] : [left, top, right];
    return getLineIntersection(center, externalPoint, edge[0], edge[2]);
  }
};

const getLineIntersection = (p1: Point, p2: Point, p3: Point, p4: Point): Point => {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  
  if (Math.abs(denominator) < 1e-10) {
    // Lines are parallel
    return p1;
  }
  
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
  
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
};