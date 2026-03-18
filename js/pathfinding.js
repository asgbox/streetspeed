class PriorityQueue {
    constructor() { this.values = []; }
    enqueue(val, priority) {
        this.values.push({ val, priority });
        this.sort();
    }
    dequeue() { return this.values.shift(); }
    sort() { this.values.sort((a, b) => a.priority - b.priority); }
    isEmpty() { return this.values.length === 0; }
}

export class PathfindingOracle {
    /**
     * @param {import("./geometry.js").GeometryEngine} geometry
     * @param {import("./signals.js").SignalEngine} signals
     */
    constructor(geometry, signals) {
        this.geometry = geometry;
        this.signals = signals;
    }

    /**
     * Time-dependent shortest path (S5 Oracle)
     */
    findShortestTime(startNode, endNode, startTimeSec, speed) {
        return this._dijkstra(startNode, endNode, startTimeSec, speed, true);
    }

    /**
     * Shortest distance ignoring signals (S6 Baseline)
     */
    findShortestDistance(startNode, endNode, speed) {
        return this._dijkstra(startNode, endNode, 0, speed, false);
    }

    _dijkstra(startNode, endNode, startTimeSec, speed, timeDependent) {
        const dist = new Map();
        const prev = new Map();
        const pq = new PriorityQueue();

        dist.set(startNode, 0);
        pq.enqueue(startNode, 0);

        while (!pq.isEmpty()) {
            const current = pq.dequeue().val;
            
            if (current === endNode) {
                return this._buildPath(prev, endNode);
            }

            const currentTime = startTimeSec + (dist.get(current) || 0);
            const edges = this.geometry.adjacency.get(current) || [];

            for (const edge of edges) {
                let edgeTime = edge.length / speed;
                let waitTime = 0;

                if (timeDependent && edge.type === "crossing") {
                    waitTime = this.signals.getWaitTime(edge.intersectionId, edge.direction, currentTime);
                }

                const totalTime = edgeTime + waitTime;
                const newTime = dist.get(current) + totalTime;

                if (!dist.has(edge.to) || newTime < dist.get(edge.to)) {
                    dist.set(edge.to, newTime);
                    prev.set(edge.to, edge);
                    pq.enqueue(edge.to, newTime);
                }
            }
        }

        return null; // No path found
    }

    _buildPath(prev, endNode) {
        const path = [];
        let curr = endNode;
        while (prev.has(curr)) {
            const edge = prev.get(curr);
            path.push(edge);
            curr = edge.from;
        }
        return path.reverse();
    }
}
