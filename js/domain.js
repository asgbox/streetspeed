/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} GridConfig
 * @property {number} gridWidthBlocks
 * @property {number} gridHeightBlocks
 * @property {number} blockSize
 * @property {number} streetWidth
 * @property {number} chamferLength
 */

/**
 * @typedef {Object} SignalProgram
 * @property {number} cycleLengthSec
 * @property {number} greenXSec
 * @property {number} greenYSec
 * @property {number} clearanceSec
 * @property {"uniform_no_offset" | "uniform_with_corridor_offsets" | "custom_offsets"} offsetMode
 */

/**
 * @typedef {Object} Node
 * @property {string} id - Node ID (e.g. "ix,iy_TR_S")
 * @property {number} x
 * @property {number} y
 * @property {boolean} isIntersection
 * @property {string} [intersectionId] - e.g. "ix,iy"
 */

/**
 * @typedef {Object} Edge
 * @property {string} id
 * @property {string} from - Node ID
 * @property {string} to - Node ID
 * @property {number} length
 * @property {"sidewalk" | "crossing" | "chamfer"} type
 * @property {"X" | "Y"} [direction] - For crossings, the axis they move along. "X" means crossing a N-S street (moving East/West).
 * @property {string} [intersectionId] - The intersection handling this crossing.
 */

/**
 * @typedef {Object} RandomEndpoint
 * @property {Point} raw
 * @property {string} snappedEdgeId
 * @property {number} snappedOffset - Distance from the 'from' node of the edge
 * @property {string} snappedNode1 - The 'from' node of the edge
 * @property {string} snappedNode2 - The 'to' node of the edge
 */

/**
 * @typedef {Object} SegmentTrace
 * @property {"sidewalk" | "crossing" | "wait"} type
 * @property {Point} from
 * @property {Point} to
 * @property {number} startSec
 * @property {number} endSec
 * @property {string} [intersectionId]
 */

export const STRATEGIES = [
    "beeline_staircase",
    "fixed_staircase_xy",
    "fixed_staircase_yx",
    "axis_first_xy",
    "axis_first_yx",
    "follow_current_green",
    "shortest_distance",
    "shortest_time_oracle"
];
