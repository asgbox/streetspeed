export class SignalEngine {
    /**
     * @param {import("./domain.js").SignalProgram} program
     * @param {import("./geometry.js").GeometryEngine} geometry
     */
    constructor(program, geometry) {
        this.program = program;
        this.geometry = geometry;
        this.offsets = new Map();
        this.computeOffsets();
    }

    computeOffsets() {
        const { offsetMode, cycleLengthSec } = this.program;
        const { gridWidthBlocks, gridHeightBlocks, blockSize, streetWidth } = this.geometry.config;
        const pitch = blockSize + streetWidth;
        // Typical walking speed 1.4m/s for the green wave
        const waveSpeed = 1.4; 
        const waveTime = pitch / waveSpeed;

        for (let i = 0; i <= gridWidthBlocks; i++) {
            for (let j = 0; j <= gridHeightBlocks; j++) {
                const intId = `${i},${j}`;
                let offset = 0;

                if (offsetMode === "uniform_no_offset") {
                    offset = 0;
                } else if (offsetMode === "uniform_with_corridor_offsets") {
                    // Staggering offsets diagonally to create a generalized wave
                    offset = ((i + j) * waveTime) % cycleLengthSec;
                } else if (offsetMode === "custom_offsets") {
                    // Random but deterministic offset for this mode could be seeded, using Math.random for now
                    // In a true reproducible model we'd use the PRNG, but since the sim seed is separate, let's keep it simple
                    offset = Math.floor(Math.random() * cycleLengthSec);
                }

                this.offsets.set(intId, offset);
            }
        }
    }

    /**
     * Checks when the next green light for the given direction will start or if it's currently green.
     * @param {string} intersectionId
     * @param {"X"|"Y"} direction
     * @param {number} currentSec
     * @returns {number} Wait time in seconds (0 if currently green)
     */
    getWaitTime(intersectionId, direction, currentSec) {
        const { cycleLengthSec, greenXSec, greenYSec, clearanceSec } = this.program;
        const offset = this.offsets.get(intersectionId) || 0;
        
        // Local time within the cycle
        const localTime = (currentSec - offset) % cycleLengthSec;
        const t = localTime >= 0 ? localTime : localTime + cycleLengthSec;

        let greenStart, greenEnd;
        if (direction === "X") {
            greenStart = 0;
            greenEnd = greenXSec;
        } else {
            // Y phase starts after X and first clearance
            greenStart = greenXSec + clearanceSec;
            greenEnd = greenStart + greenYSec;
        }

        if (t >= greenStart && t < greenEnd) {
            return 0; // Currently green
        }

        let waitTime = greenStart - t;
        if (waitTime < 0) {
            waitTime += cycleLengthSec;
        }

        return waitTime;
    }
}
