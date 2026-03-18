import { SimulationRunner } from "./simulation.js";
import { RNG, STRATEGIES } from "./domain.js";

// Main application logic

const config = {
    grid: {
        gridWidthBlocks: 10,
        gridHeightBlocks: 10,
        blockSize: 113.3,
        streetWidth: 20,
        chamferLength: 20
    },
    signals: {
        cycleLengthSec: 90,
        greenXSec: 35,
        greenYSec: 35,
        clearanceSec: 10,
        offsetMode: "uniform_with_corridor_offsets"
    }
};

let runner = null;
let currentA = null;
let currentB = null;
let rng = null;

const canvas = document.getElementById("map-canvas");
const ctx = canvas.getContext("2d");

function init() {
    updateConfigFromUI();
    rng = new RNG(parseInt(document.getElementById("sim-seed").value || 42));
    runner = new SimulationRunner(config);
    resizeCanvas();
    generateEndpoints();
    drawGrid();
    setupListeners();
}

function updateConfigFromUI() {
    config.grid.gridWidthBlocks = parseInt(document.getElementById("grid-width").value);
    config.grid.gridHeightBlocks = parseInt(document.getElementById("grid-height").value);
    config.signals.cycleLengthSec = parseInt(document.getElementById("sig-cycle").value);
    config.signals.clearanceSec = parseInt(document.getElementById("sig-clearance").value);
    config.signals.greenXSec = parseInt(document.getElementById("sig-green-x").value);
    config.signals.greenYSec = parseInt(document.getElementById("sig-green-y").value);
    config.signals.offsetMode = document.getElementById("sig-offset-mode").value;
}

function resizeCanvas() {
    const container = document.getElementById("map-container");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

window.addEventListener("resize", () => {
    resizeCanvas();
    drawGrid();
});

function setupListeners() {
    document.getElementById("btn-run-single").addEventListener("click", () => {
        updateConfigFromUI();
        rng = new RNG(parseInt(document.getElementById("sim-seed").value || 42));
        runner = new SimulationRunner(config);
        generateEndpoints();
        runSingle();
    });

    document.getElementById("btn-run-batch").addEventListener("click", () => {
        updateConfigFromUI();
        // Pack config with seed
        const wConfig = JSON.parse(JSON.stringify(config));
        wConfig.seed = parseInt(document.getElementById("sim-seed").value || 42);
        
        const batchRuns = parseInt(document.getElementById("sim-batch-runs").value || 10);
        const speed = parseFloat(document.getElementById("sim-speed").value);
        
        const btn = document.getElementById("btn-run-batch");
        btn.disabled = true;
        btn.innerText = "Running...";
        
        const worker = new Worker("js/worker.js", { type: "module" });
        worker.postMessage({ config: wConfig, batchRuns, speed });
        
        worker.onmessage = (e) => {
            displayBatchResults(e.data);
            btn.disabled = false;
            btn.innerText = `Run Batch (${batchRuns}x)`;
        };
    });
}

function generateEndpoints() {
    currentA = runner.geometry.getRandomEndpoint(rng);
    currentB = runner.geometry.getRandomEndpoint(rng);
    
    // Ensure A and B are somewhat apart
    while (Math.abs(currentA.raw.x - currentB.raw.x) < 200 && Math.abs(currentA.raw.y - currentB.raw.y) < 200) {
       currentB = runner.geometry.getRandomEndpoint(rng);
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Transform to center grid
    const totalW = config.grid.gridWidthBlocks * (config.grid.blockSize + config.grid.streetWidth);
    const totalH = config.grid.gridHeightBlocks * (config.grid.blockSize + config.grid.streetWidth);
    
    const scale = Math.min(canvas.width / (totalW + 100), canvas.height / (totalH + 100));
    const offsetX = (canvas.width - totalW * scale) / 2;
    const offsetY = (canvas.height - totalH * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw background
    ctx.fillStyle = "#1e293b"; // Blocks background
    ctx.fillRect(-50, -50, totalW + 100, totalH + 100);

    // Draw edges
    ctx.lineWidth = 2;
    for (const [id, edge] of runner.geometry.edges.entries()) {
        if (id.endsWith("_rev")) continue; // Avoid drawing twice
        const p1 = runner.geometry.nodes.get(edge.from);
        const p2 = runner.geometry.nodes.get(edge.to);
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        
        if (edge.type === "crossing") {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.setLineDash([2, 2]);
        } else if (edge.type === "chamfer") {
            ctx.strokeStyle = "#475569";
            ctx.setLineDash([]);
        } else {
            ctx.strokeStyle = "#475569";
            ctx.setLineDash([]);
        }
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw Points A & B
    if (currentA && currentB) {
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        ctx.arc(currentA.raw.x, currentA.raw.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(currentB.raw.x, currentB.raw.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

let activeTraces = [];
let animationTime = 0;
let animationReq;

function runSingle() {
    const speed = parseFloat(document.getElementById("sim-speed").value);
    activeTraces = [];
    
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

    const tbody = document.getElementById("results-body");
    tbody.innerHTML = "";

    strategiesToRun.forEach((strat, idx) => {
        const result = runner.run(strat, currentA, currentB, 0, speed);
        if (result.success) {
            const colors = ["#f1c40f", "#3498db", "#e74c3c", "#9b59b6", "#1abc9c", "#e67e22", "#34495e", "#7f8c8d"];
            const color = colors[idx % colors.length];
            activeTraces.push({
                strategy: strat,
                trace: result.trace,
                color: color
            });
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span style="display:inline-block;width:10px;height:10px;background:${color};margin-right:5px;border-radius:50%"></span>${strat.replace(/_/g, " ")}</td>
                <td>${result.totalTravelTimeSec.toFixed(1)}</td>
                <td>${result.walkingTimeSec.toFixed(1)}</td>
                <td>${result.waitingTimeSec.toFixed(1)}</td>
                <td>${result.distanceM.toFixed(1)}</td>
                <td>${result.numStops}</td>
            `;
            tbody.appendChild(tr);
        } else {
             const tr = document.createElement("tr");
            tr.innerHTML = `<td>${strat.replace(/_/g, " ")}</td><td colspan="5" style="color:red">Failed to find path</td>`;
            tbody.appendChild(tr);
        }
    });

    animationTime = 0;
    if (animationReq) cancelAnimationFrame(animationReq);
    animate();
}

function displayBatchResults(results) {
    const tbody = document.getElementById("results-body");
    tbody.innerHTML = "";
    
    Object.keys(results).forEach(strat => {
        const r = results[strat];
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${strat.replace(/_/g, " ")}<br><small style="color:var(--success)">Win rate: ${(r.winRate*100).toFixed(1)}%</small></td>
            <td>${r.avgTotalTravelTimeSec.toFixed(1)}</td>
            <td>${r.avgWalkingTimeSec.toFixed(1)}</td>
            <td>${r.avgWaitingTimeSec.toFixed(1)}</td>
            <td>${r.avgDistanceM.toFixed(1)}</td>
            <td>${r.avgNumStops.toFixed(1)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function animate() {
    drawGrid(); // Redraw base grid
    
    const playSpeed = parseInt(document.getElementById("speed-select").value);
    animationTime += 0.3 * playSpeed; // Advance time
    
    // Rendering over grid
    const totalW = config.grid.gridWidthBlocks * (config.grid.blockSize + config.grid.streetWidth);
    const totalH = config.grid.gridHeightBlocks * (config.grid.blockSize + config.grid.streetWidth);
    const scale = Math.min(canvas.width / (totalW + 100), canvas.height / (totalH + 100));
    const offsetX = (canvas.width - totalW * scale) / 2;
    const offsetY = (canvas.height - totalH * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    let maxEndTime = 0;

    activeTraces.forEach((t) => {
        let currentPos = null;
        let isWaiting = false;

        // Draw traces line path
        ctx.beginPath();
        for (const segment of t.trace) {
            if (segment.type !== "wait") {
               ctx.lineTo(segment.from.x, segment.from.y);
               ctx.lineTo(segment.to.x, segment.to.y);
            }
        }
        ctx.strokeStyle = t.color + "40"; // 25% opacity path
        ctx.lineWidth = 4;
        ctx.stroke();
        
        for (const segment of t.trace) {
            maxEndTime = Math.max(maxEndTime, segment.endSec);
            if (animationTime >= segment.startSec && animationTime <= segment.endSec) {
                // Interpolate
                const progress = (animationTime - segment.startSec) / (segment.endSec - segment.startSec || 1);
                currentPos = {
                    x: segment.from.x + (segment.to.x - segment.from.x) * progress,
                    y: segment.from.y + (segment.to.y - segment.from.y) * progress
                };
                if (segment.type === "wait") isWaiting = true;
                break;
            } else if (animationTime > segment.endSec) {
                currentPos = segment.to;
            }
        }

        if (currentPos) {
            ctx.fillStyle = isWaiting ? "#ef4444" : t.color;
            ctx.beginPath();
            ctx.arc(currentPos.x, currentPos.y, 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Halo effect for active pedestrians
            ctx.strokeStyle = t.color;
            ctx.beginPath();
            ctx.arc(currentPos.x, currentPos.y, 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    });

    ctx.restore();

    if (animationTime < maxEndTime + 5) {
        animationReq = requestAnimationFrame(animate);
    }
}

// Start app
window.onload = init;
