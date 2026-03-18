import { distance } from "./utils.js";

export class GeometryEngine {
    /**
     * @param {import("./domain.js").GridConfig} config
     */
    constructor(config) {
        this.config = config;
        this.nodes = new Map(); // id -> Node
        this.edges = new Map(); // id -> Edge
        this.adjacency = new Map(); // nodeId -> Edge[]
        this.generateGrid();
    }

    generateGrid() {
        const { gridWidthBlocks, gridHeightBlocks, blockSize, streetWidth, chamferLength } = this.config;
        const C = chamferLength / Math.sqrt(2);
        const S = streetWidth;
        const pitch = blockSize + S;

        // Create Nodes
        // i: column, j: row. Number of streets = blocks + 1
        for (let i = 0; i <= gridWidthBlocks; i++) {
            for (let j = 0; j <= gridHeightBlocks; j++) {
                const cx = i * pitch;
                const cy = j * pitch;
                const intId = `${i},${j}`;

                // Only add nodes for quadrants that actually fall within the grid
                const addNode = (idSuffix, dx, dy) => {
                    const id = `${intId}_${idSuffix}`;
                    const node = { id, x: cx + dx, y: cy + dy, isIntersection: true, intersectionId: intId };
                    this.nodes.set(id, node);
                    this.adjacency.set(id, []);
                };

                if (i > 0 && j > 0) { // TL quadrant
                    addNode("TL_E", -S/2, -S/2 - C);
                    addNode("TL_S", -S/2 - C, -S/2);
                }
                if (i < gridWidthBlocks && j > 0) { // TR quadrant
                    addNode("TR_W", S/2, -S/2 - C);
                    addNode("TR_S", S/2 + C, -S/2);
                }
                if (i > 0 && j < gridHeightBlocks) { // BL quadrant
                    addNode("BL_E", -S/2, S/2 + C);
                    addNode("BL_N", -S/2 - C, S/2);
                }
                if (i < gridWidthBlocks && j < gridHeightBlocks) { // BR quadrant
                    addNode("BR_W", S/2, S/2 + C);
                    addNode("BR_N", S/2 + C, S/2);
                }
            }
        }

        // Create Edges
        const addEdge = (id, from, to, type, extra = {}) => {
            if (!this.nodes.has(from) || !this.nodes.has(to)) return;
            const p1 = this.nodes.get(from);
            const p2 = this.nodes.get(to);
            const len = distance(p1, p2);
            const edge1 = { id: `${id}_fwd`, from, to, length: len, type, ...extra };
            const edge2 = { id: `${id}_rev`, from: to, to: from, length: len, type, ...extra };
            this.edges.set(edge1.id, edge1);
            this.edges.set(edge2.id, edge2);
            this.adjacency.get(from).push(edge1);
            this.adjacency.get(to).push(edge2);
        };

        for (let i = 0; i <= gridWidthBlocks; i++) {
            for (let j = 0; j <= gridHeightBlocks; j++) {
                const intId = `${i},${j}`;
                
                // Chamfers
                addEdge(`${intId}_ch_TL`, `${intId}_TL_E`, `${intId}_TL_S`, "chamfer");
                addEdge(`${intId}_ch_TR`, `${intId}_TR_W`, `${intId}_TR_S`, "chamfer");
                addEdge(`${intId}_ch_BL`, `${intId}_BL_E`, `${intId}_BL_N`, "chamfer");
                addEdge(`${intId}_ch_BR`, `${intId}_BR_W`, `${intId}_BR_N`, "chamfer");

                // Crossings
                // North crossing (moving X axis)
                addEdge(`${intId}_cr_N`, `${intId}_TL_E`, `${intId}_TR_W`, "crossing", { direction: "X", intersectionId: intId });
                // South crossing (moving X axis)
                addEdge(`${intId}_cr_S`, `${intId}_BL_E`, `${intId}_BR_W`, "crossing", { direction: "X", intersectionId: intId });
                // West crossing (moving Y axis)
                addEdge(`${intId}_cr_W`, `${intId}_TL_S`, `${intId}_BL_N`, "crossing", { direction: "Y", intersectionId: intId });
                // East crossing (moving Y axis)
                addEdge(`${intId}_cr_E`, `${intId}_TR_S`, `${intId}_BR_N`, "crossing", { direction: "Y", intersectionId: intId });

                // Sidewalks between intersections
                if (i < gridWidthBlocks) {
                    const nextId = `${i+1},${j}`;
                    // North sidewalk of the block
                    addEdge(`${intId}_sw_N`, `${intId}_TR_S`, `${nextId}_TL_S`, "sidewalk");
                    // South sidewalk of the block
                    addEdge(`${intId}_sw_S`, `${intId}_BR_N`, `${nextId}_BL_N`, "sidewalk");
                }
                
                if (j < gridHeightBlocks) {
                    const nextId = `${i},${j+1}`;
                    // West sidewalk of the block
                    addEdge(`${intId}_sw_W`, `${intId}_BL_E`, `${nextId}_TL_E`, "sidewalk");
                    // East sidewalk of the block
                    addEdge(`${intId}_sw_E`, `${intId}_BR_W`, `${nextId}_TR_W`, "sidewalk");
                }
            }
        }
    }

    getRandomEndpoint(rng) {
        // Pick a random edge (sidewalk or chamfer, let's avoid spawning inside a crossing)
        const validEdges = Array.from(this.edges.values()).filter(e => e.type !== "crossing" && !e.id.endsWith("_rev"));
        const edge = validEdges[rng.nextInt(0, validEdges.length - 1)];
        const offset = rng.nextFloat() * edge.length;
        
        const n1 = this.nodes.get(edge.from);
        const n2 = this.nodes.get(edge.to);
        const t = offset / edge.length;
        
        const raw = {
            x: n1.x + t * (n2.x - n1.x),
            y: n1.y + t * (n2.y - n1.y)
        };

        return {
            raw,
            snappedEdgeId: edge.id,
            snappedOffset: offset,
            snappedNode1: edge.from,
            snappedNode2: edge.to
        };
    }
}
