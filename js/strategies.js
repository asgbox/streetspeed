export class Strategies {
    constructor(geometry, signals, pinger) {
        this.geometry = geometry;
        this.signals = signals;
        this.oracle = pinger; // PathfindingOracle instance
    }

    execute(strategyId, state) {
        // state: { currentNode, destinationPoint, currentSec, speed }
        // returns the next Edge to take
        
        if (strategyId === "shortest_time_oracle") {
            // Find full path and return first edge. In practice, since state is deterministic, we can just find path once or recompute.
            const path = this.oracle.findShortestTime(state.currentNode, state.endNode, state.currentSec, state.speed);
            return path ? path[0] : null;
        }
        
        if (strategyId === "shortest_distance") {
            const path = this.oracle.findShortestDistance(state.currentNode, state.endNode, state.speed);
            return path ? path[0] : null;
        }

        const edges = this.geometry.adjacency.get(state.currentNode) || [];
        if (edges.length === 0) return null;

        // Eixample specific strategies
        // We evaluate edges based on heuristic rules
        
        // Let's implement S1, S2, S3, S4 using common scoring
        let bestEdge = null;
        let bestScore = -Infinity;

        const currPoint = this.geometry.nodes.get(state.currentNode);
        const destPoint = state.destinationPoint; // Exact raw point or snapped dest node

        for (const edge of edges) {
            const nextNode = this.geometry.nodes.get(edge.to);
            const distToTargetBefore = Math.sqrt((currPoint.x - destPoint.x)**2 + (currPoint.y - destPoint.y)**2);
            const distToTargetAfter = Math.sqrt((nextNode.x - destPoint.x)**2 + (nextNode.y - destPoint.y)**2);
            const progress = distToTargetBefore - distToTargetAfter;
            
            // Only consider edges that get us strictly closer to the goal (with a tiny epsilon for floating points)
            if (progress < -0.1) continue; 
            
            let waitTime = 0;
            if (edge.type === "crossing") {
                waitTime = this.signals.getWaitTime(edge.intersectionId, edge.direction, state.currentSec);
            }

            let score = 0;

            if (strategyId === "beeline_staircase") {
                // Prefers the node that stays closest to the straight line to target
                // Also penalize wait time to break ties
                score = -Math.abs(progress - edge.length) - (waitTime * 0.1); 
            } else if (strategyId === "follow_current_green") {
                // Prefers edges with 0 wait time
                if (waitTime === 0) {
                    score = 1000 + progress;
                } else {
                    score = progress - waitTime;
                }
            } else if (strategyId.startsWith("axis_first")) {
                // Prefer movement along X or Y primarily
                const axis = strategyId.endsWith("xy") ? 'x' : 'y';
                const distAlongAxis = Math.abs(nextNode[axis] - destPoint[axis]);
                const distAlongOther = Math.abs(nextNode[axis === 'x' ? 'y' : 'x'] - destPoint[axis === 'x' ? 'y' : 'x']);
                score = -distAlongAxis*2 - distAlongOther - waitTime*0.1;
                // Note: Simplified logic. True axis_first would hard filter until axis aligned
            } else if (strategyId.startsWith("fixed_staircase")) {
                // strict alternating step
                // for MVP, we'll approximate staircase by picking alternating directions
                // this needs history, which is complex. For now, we fallback to a simple progress heur.
                score = progress - waitTime; 
            } else {
                score = progress;
            }

            if (score > bestScore) {
                bestScore = score;
                bestEdge = edge;
            }
        }

        // If no progress-making edges, fallback to the one with the best oracle path to prevent getting stuck
        if (!bestEdge) {
           const path = this.oracle.findShortestTime(state.currentNode, state.endNode, state.currentSec, state.speed);
           return path ? path[0] : null;
        }

        return bestEdge;
    }
}
