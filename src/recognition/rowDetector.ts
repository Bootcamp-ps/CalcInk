import { SymbolGroup } from './symbolGrouper';
import { BoundingBox, getGroupBounds } from '../canvas/strokeModel';

export interface Row {
  id: string;
  groups: SymbolGroup[];
  bounds: BoundingBox;
}

/**
 * Clusters symbol groups into rows based on vertical overlap,
 * and splits independent equations on the same line if there is a large horizontal gap.
 */
export function detectRows(groups: SymbolGroup[], xGapThresholdRatio: number = 3.0): Row[] {
  if (groups.length === 0) return [];

  // 1. Cluster groups by Y-overlap
  const yClusters: SymbolGroup[][] = [];
  
  for (const group of groups) {
    let added = false;
    for (const cluster of yClusters) {
      const clusterTop = Math.min(...cluster.map(g => g.bounds.top));
      const clusterBottom = Math.max(...cluster.map(g => g.bounds.bottom));
      const clusterHeight = clusterBottom - clusterTop;
      
      const overlapY = Math.min(group.bounds.bottom, clusterBottom) - Math.max(group.bounds.top, clusterTop);
      const minHeight = Math.min(group.bounds.height, clusterHeight);
      
      // If overlap is more than 30% of the shorter height, they are on the same row
      if (minHeight > 0 && overlapY / minHeight > 0.3) {
        cluster.push(group);
        added = true;
        break;
      }
    }
    if (!added) {
      yClusters.push([group]);
    }
  }
  
  // 2. Sort each cluster horizontally and split by large horizontal gaps
  const rows: Row[] = [];
  
  for (const cluster of yClusters) {
    cluster.sort((a, b) => a.bounds.left - b.bounds.left);
    
    // Calculate average width of symbols in this cluster
    let totalWidth = 0;
    for (const g of cluster) totalWidth += g.bounds.width;
    const avgWidth = cluster.length > 0 ? totalWidth / cluster.length : 0;
    
    let currentSubRow: SymbolGroup[] = [cluster[0]];
    for (let i = 1; i < cluster.length; i++) {
      const prev = cluster[i - 1];
      const curr = cluster[i];
      const gap = curr.bounds.left - prev.bounds.right;
      
      // Dynamic gap threshold based on average symbol width (minimum 50px)
      const dynamicThreshold = Math.max(50, avgWidth * xGapThresholdRatio);
      
      if (gap > dynamicThreshold) {
        // Gap is too large, split the row here
        rows.push({
          id: `row_${Date.now()}_${rows.length}`,
          groups: currentSubRow,
          bounds: getGroupBounds(currentSubRow.flatMap(g => g.strokes))!
        });
        currentSubRow = [curr];
      } else {
        currentSubRow.push(curr);
      }
    }
    
    if (currentSubRow.length > 0) {
      rows.push({
        id: `row_${Date.now()}_${rows.length}`,
        groups: currentSubRow,
        bounds: getGroupBounds(currentSubRow.flatMap(g => g.strokes))!
      });
    }
  }
  
  // 3. Sort all final rows from top to bottom
  rows.sort((a, b) => a.bounds.top - b.bounds.top);
  
  return rows;
}
