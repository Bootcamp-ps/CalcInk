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
export function detectRows(groups: SymbolGroup[], xGapThresholdRatio: number = 12.0): Row[] {
  if (groups.length === 0) return [];

  // 1. Cluster groups by Y-overlap (using original bounds)
  const yClusters: typeof groups[] = [];
  
  for (const group of groups) {
    let added = false;
    for (const cluster of yClusters) {
      const clusterTop = Math.min(...cluster.map(g => g.bounds.y));
      const clusterBottom = Math.max(...cluster.map(g => g.bounds.y + g.bounds.height));
      const clusterHeight = clusterBottom - clusterTop;
      
      const overlapY = Math.min(group.bounds.y + group.bounds.height, clusterBottom) - Math.max(group.bounds.y, clusterTop);
      const minHeight = Math.min(group.bounds.height, clusterHeight);
      
      const clusterCenterY = clusterTop + clusterHeight / 2;
      const groupCenterY = group.bounds.y + group.bounds.height / 2;
      const centerDist = Math.abs(clusterCenterY - groupCenterY);

      if (
        (minHeight > 0 && overlapY / minHeight > 0.2) ||
        centerDist < Math.max(clusterHeight * 0.7, 35)
      ) {
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
    cluster.sort((a, b) => a.bounds.x - b.bounds.x);
    
    let totalWidth = 0;
    for (const g of cluster) totalWidth += g.bounds.width;
    const avgWidth = cluster.length > 0 ? totalWidth / cluster.length : 0;
    
    let currentSubRow: SymbolGroup[] = [cluster[0]!];
    let prevBounds = cluster[0]!.bounds;

    for (let i = 1; i < cluster.length; i++) {
      const curr = cluster[i]!;
      const currBounds = curr.bounds;
      const gap = currBounds.x - (prevBounds.x + prevBounds.width);
      
      const dynamicThreshold = Math.max(50, avgWidth * xGapThresholdRatio);
      
      if (gap > dynamicThreshold) {
        rows.push({
          id: `row_${Date.now()}_${rows.length}`,
          groups: currentSubRow,
          bounds: getGroupBounds(currentSubRow.flatMap(g => g.strokes))!
        });
        currentSubRow = [curr];
      } else {
        currentSubRow.push(curr);
      }
      prevBounds = currBounds;
    }
    
    if (currentSubRow.length > 0) {
      rows.push({
        id: `row_${Date.now()}_${rows.length}`,
        groups: currentSubRow,
        bounds: getGroupBounds(currentSubRow.flatMap(g => g.strokes))!
      });
    }
  }
  
  // 3. Sort final rows top to bottom
  rows.sort((a, b) => {
    const aCy = a.bounds.y + a.bounds.height / 2;
    const bCy = b.bounds.y + b.bounds.height / 2;
    return aCy - bCy;
  });
  
  return rows;
}
