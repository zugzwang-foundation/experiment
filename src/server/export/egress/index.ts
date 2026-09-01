/**
 * DATASET.1 — the shared egress guard layer (brief §4 Slice 1).
 *
 * Built BEFORE either exporter, so that neither the per-table CSV pipeline
 * nor the per-market debate `.md` artifact can be written against a guard
 * authored to accommodate it.
 *
 * Everything the two artifacts share lives behind this barrel; nothing
 * downstream should reach past it into the individual modules.
 */

// ⚠ Re-exported from its new home (ruling I, DATASET.3): `STRIPPED_COLUMNS` is
// now DERIVED from `COLUMN_TREATMENTS` rather than hand-written beside it.
// The barrel keeps the old import path working.
export { STRIPPED_COLUMNS } from "../dataset/treatments";
export {
	assertTableClean,
	assertTextArtifactClean,
	EgressGuard,
	type EgressSecrets,
	emptySecrets,
} from "./assertions";
export {
	EgressContractGapError,
	type EgressViolation,
	EgressViolationError,
} from "./errors";
export {
	FORBIDDEN_VALUE_CLASSES,
	type ForbiddenValueClass,
	GLOBALLY_FORBIDDEN_PAYLOAD_KEYS,
	METADATA_SHIP_SPEC,
	PAYLOAD_SHIP_KEYS,
	SHIPPED_METADATA_KEYS,
	type ShipNode,
	type ShipSpec,
	STRIPPED_METADATA_KEYS,
} from "./forbidden-keys";
export {
	findKeys,
	findValues,
	scanText,
	UUID_RE,
	UUID_RE_GLOBAL,
	type WalkEntry,
	walk,
} from "./scan";
