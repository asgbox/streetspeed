import { RNG } from "./domain.js";
import { SimulationRunner } from "./simulation.js";

self.onmessage = function (e) {
    const { config, batchRuns, speed } = e.data;
    
    const runner = new SimulationRunner(config);
    const rng = new RNG(config.seed || 42); // Use passed seed for batch reproducibility

    const strategiesToRun = [
        "shortest_time_oracle",
        "shortest_distance",
        "beeline_staircase",
        "follow_current_green",
        "axis_first_xy",
        "axis_first_yx",
        "fixed_staircase_xy",
        "fixed_staircase_yx"
    ];

    const results = {};
    strategiesToRun.forEach(s => {
        results[s] = {
            totalTravelTimeSec: 0,
            walkingTimeSec: 0,
            waitingTimeSec: 0,
            distanceM: 0,
            numCrossings: 0,
            numStops: 0,
            successes: 0,
            wins: 0
        };
    });

    for (let i = 0; i < batchRuns; i++) {
        let A, B;
        do {
            A = runner.geometry.getRandomEndpoint(rng);
            B = runner.geometry.getRandomEndpoint(rng);
        } while (Math.abs(A.raw.x - B.raw.x) < 200 && Math.abs(A.raw.y - B.raw.y) < 200);

        let bestTime = Infinity;
        let bestStrats = [];

        const runData = {};

        strategiesToRun.forEach(strat => {
            const res = runner.run(strat, A, B, 0, speed);
            runData[strat] = res;
            if (res.success) {
                const r = results[strat];
                r.successes++;
                r.totalTravelTimeSec += res.totalTravelTimeSec;
                r.walkingTimeSec += res.walkingTimeSec;
                r.waitingTimeSec += res.waitingTimeSec;
                r.distanceM += res.distanceM;
                r.numCrossings += res.numCrossings;
                r.numStops += res.numStops;

                if (res.totalTravelTimeSec < bestTime) {
                    bestTime = res.totalTravelTimeSec;
                    bestStrats = [strat];
                } else if (res.totalTravelTimeSec === bestTime) {
                    bestStrats.push(strat);
                }
            }
        });

        // Award wins
        bestStrats.forEach(strat => {
            results[strat].wins++;
        });
    }

    // Averages
    Object.keys(results).forEach(strat => {
        const r = results[strat];
        const s = r.successes || 1; // avoid div 0
        r.avgTotalTravelTimeSec = r.totalTravelTimeSec / s;
        r.avgWalkingTimeSec = r.walkingTimeSec / s;
        r.avgWaitingTimeSec = r.waitingTimeSec / s;
        r.avgDistanceM = r.distanceM / s;
        r.avgNumCrossings = r.numCrossings / s;
        r.avgNumStops = r.numStops / s;
        r.winRate = r.wins / batchRuns;
    });

    self.postMessage(results);
};
