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
	PAYLOAD_STRIP_KEYS,
	SHIPPED_METADATA_KEYS,
	STRIPPED_COLUMNS,
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
