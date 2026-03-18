import { GeometryEngine } from "./geometry.js";
import { SignalEngine } from "./signals.js";
import { PathfindingOracle } from "./pathfinding.js";
import { Strategies } from "./strategies.js";

export class SimulationRunner {
    constructor(config) {
        this.config = config;
        this.geometry = new GeometryEngine(config.grid);
        this.signals = new SignalEngine(config.signals, this.geometry);
        this.oracle = new PathfindingOracle(this.geometry, this.signals);
        this.strategies = new Strategies(this.geometry, this.signals, this.oracle);
    }

    run(strategyId, startPoint, endPoint, startTimeSec, speed) {
        let currentSec = startTimeSec;
        let currentNode = startPoint.snappedNode1; // Starts at snapped edge node
        let destNode = endPoint.snappedNode1;
        
        let trace = [];
        let metrics = {
            strategyId,
            success: false,
            totalTravelTimeSec: 0,
            walkingTimeSec: 0,
            waitingTimeSec: 0,
            distanceM: 0,
            numCrossings: 0,
            numStops: 0,
            trace: []
        };

        // If start point is not a node but along an edge, add initial travel time
        if (startPoint.snappedOffset > 0) {
            const initialDist = startPoint.snappedOffset;
            const time = initialDist / speed;
            currentSec += time;
            metrics.distanceM += initialDist;
            metrics.walkingTimeSec += time;
        }

        let safetyValve = 0;
        const state = {
            currentNode,
            endNode: destNode,
            destinationPoint: endPoint.raw,
            currentSec,
            speed
        };

        if (strategyId === "shortest_time_oracle") {
            const path = this.oracle.findShortestTime(currentNode, destNode, currentSec, speed);
            if (!path) return metrics;
            
            for (const edge of path) {
                let waitTime = 0;
                if (edge.type === "crossing") {
                    waitTime = this.signals.getWaitTime(edge.intersectionId, edge.direction, currentSec);
                    if (waitTime > 0) {
                        metrics.waitingTimeSec += waitTime;
                        metrics.numStops++;
                        const wEndSec = currentSec + waitTime;
                        trace.push({
                            type: "wait",
                            from: this.geometry.nodes.get(currentNode),
                            to: this.geometry.nodes.get(currentNode),
                            startSec: currentSec,
                            endSec: wEndSec
                        });
                        currentSec = wEndSec;
                    }
                    metrics.numCrossings++;
                }

                const walkTime = edge.length / speed;
                const nFrom = this.geometry.nodes.get(edge.from);
                const nTo = this.geometry.nodes.get(edge.to);
                trace.push({
                    type: edge.type,
                    from: { x: nFrom.x, y: nFrom.y },
                    to: { x: nTo.x, y: nTo.y },
                    startSec: currentSec,
                    endSec: currentSec + walkTime
                });
                
                currentSec += walkTime;
                metrics.distanceM += edge.length;
                metrics.walkingTimeSec += walkTime;
                currentNode = edge.to;
            }
            metrics.success = true;
            metrics.totalTravelTimeSec = currentSec - startTimeSec;
            metrics.trace = trace;
            return metrics;
        }

        // Simulating Agent Decision Loops
        while (currentNode !== destNode && safetyValve < 500) {
            safetyValve++;
            state.currentNode = currentNode;
            state.currentSec = currentSec;

            let pathBlock;
            if (strategyId === "shortest_distance") {
                // Shortest distance knows the whole route
                const p = this.oracle.findShortestDistance(currentNode, destNode, speed);
                if (!p || p.length === 0) break;
                pathBlock = [p[0]];
            } else {
                const step = this.strategies.execute(strategyId, state);
                if (!step) break;
                pathBlock = [step];
            }

            const edge = pathBlock[0];
            let waitTime = 0;

            if (edge.type === "crossing") {
                waitTime = this.signals.getWaitTime(edge.intersectionId, edge.direction, currentSec);
                if (waitTime > 0) {
                    metrics.waitingTimeSec += waitTime;
                    metrics.numStops++;
                    const wEndSec = currentSec + waitTime;
                    trace.push({
                        type: "wait",
                        from: this.geometry.nodes.get(currentNode),
                        to: this.geometry.nodes.get(currentNode),
                        startSec: currentSec,
                        endSec: wEndSec
                    });
                    currentSec = wEndSec;
                }
                metrics.numCrossings++;
            }

            const walkTime = edge.length / speed;
            const nFrom = this.geometry.nodes.get(edge.from);
            const nTo = this.geometry.nodes.get(edge.to);
            trace.push({
                type: edge.type,
                from: { x: nFrom.x, y: nFrom.y },
                to: { x: nTo.x, y: nTo.y },
                startSec: currentSec,
                endSec: currentSec + walkTime
            });

            currentSec += walkTime;
            metrics.distanceM += edge.length;
            metrics.walkingTimeSec += walkTime;
            currentNode = edge.to;
        }

        // Add final un-snapped travel if reached the target edge's node
        if (currentNode === destNode) {
            metrics.success = true;
            if (endPoint.snappedOffset > 0) {
                const finalDist = endPoint.snappedOffset;
                const time = finalDist / speed;
                currentSec += time;
                metrics.distanceM += finalDist;
                metrics.walkingTimeSec += time;
            }
        }

        metrics.totalTravelTimeSec = currentSec - startTimeSec;
        metrics.trace = trace;

        return metrics;
    }
}
