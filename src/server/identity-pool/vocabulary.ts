// The colour and animal vocabulary the PFP render library was actually built in, measured on spark-3100 at ~/comfy/ComfyUI/output/pfp (2026-08-25).
//
// `~/pfp_recolor/recolor_batch.py` takes one red source render per animal and recolours it into twelve targets via the ComfyUI API, which makes Red the thirteenth colour rather than an absence of colour. On disk the red originals sit loose in each animal directory instead of in a `Red/` subdirectory; `asset-pipeline/convert_and_upload_pfp.py` normalises that when it converts.
//
// This module is the single source for both seed scripts and their tests. Before PFP-1 the lists were duplicated in five places and described renders that had never been made.
//
// ⚠ ADR-0011 sized the namespace at 50 colours x 100 animals x 10 numbers = 50,000. The render run covers 13 x 67 = 871 pairs. See the ADR-0011 patch record.

export const COLOURS = [
	"Red",
	"Orange",
	"Gold",
	"Olive",
	"Green",
	"Jade",
	"Teal",
	"Cerulean",
	"Indigo",
	"Violet",
	"Magenta",
	"Rose",
	"Silver",
] as const;

export const ANIMALS = [
	"Alpaca",
	"Armadillo",
	"Badger",
	"Beaver",
	"Bison",
	"Butterfly",
	"Camel",
	"Capybara",
	"Cat",
	"Chameleon",
	"Cheetah",
	"Chinchilla",
	"Clownfish",
	"Crocodile",
	"Dog",
	"Dolphin",
	"Dragon",
	"Elephant",
	"Ferret",
	"Flamingo",
	"Fox",
	"Giraffe",
	"Goldfinch",
	"Gorilla",
	"Hamster",
	"Hedgehog",
	"Hippo",
	"Horse",
	"Hummingbird",
	"Iguana",
	"Koala",
	"Ladybug",
	"Lemur",
	"Leopard",
	"Lion",
	"Llama",
	"Lobster",
	"Lynx",
	"Macaw",
	"Meerkat",
	"Mouse",
	"Orangutan",
	"Ostrich",
	"Owl",
	"Pangolin",
	"Parrot",
	"Peacock",
	"Pelican",
	"Penguin",
	"Pig",
	"Porcupine",
	"Pufferfish",
	"Rabbit",
	"Raccoon",
	"Rhino",
	"Seahorse",
	"Seal",
	"Snake",
	"Squirrel",
	"Starfish",
	"Swan",
	"Tortoise",
	"Toucan",
	"Walrus",
	"Whale",
	"Wolf",
	"Zebra",
] as const;

export type Colour = (typeof COLOURS)[number];
export type Animal = (typeof ANIMALS)[number];

// Cat and Dog were rendered from nine source poses each, so every colour arm holds nine images for them and one for everybody else.
const VARIANT_OVERRIDES: Partial<Record<Animal, number>> = {
	Cat: 9,
	Dog: 9,
};

/** How many distinct renders exist for each animal, in every colour. */
export const PFP_VARIANTS: Readonly<Record<Animal, number>> =
	Object.fromEntries(
		ANIMALS.map((animal) => [animal, VARIANT_OVERRIDES[animal] ?? 1]),
	) as Record<Animal, number>;
