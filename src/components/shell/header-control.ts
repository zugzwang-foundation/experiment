/**
 * The header's 34×34 icon-button register (values-log §3 item 3) — rest
 * `--btn-fill` + hairline, hover border → `--ring` with the fill unchanged,
 * pressed `--state-pressed-fill`, focus the 2px light ring, icon 15px ink.
 *
 * ⛔ IT LIVES IN A MODULE OF ITS OWN BECAUSE TWO CONTROLS NOW WEAR IT, AND A
 * SECOND COPY IS THE DRIFT `FieldSeparator` WAS LIFTED TO END (SEP-1). It was
 * private to `HeaderNav.tsx`, which was correct while Home and Back were the
 * only buttons shaped like this. MOBILE-2n · R-5 adds the phone's GitHub
 * control and rules it "the same box as the home control (same size, radius,
 * border, ground)" — a requirement that is either enforced by one string or
 * re-checked by hand forever. One string is what makes "the same box" a fact
 * rather than a coincidence of two literals that agree today.
 *
 * ⛔ A PLAIN `.ts` MODULE, NOT AN EXPORT FROM `HeaderNav.tsx`. That file is
 * `"use client"`, and importing a value out of a client module into a Server
 * Component turns it into a client reference rather than inlining the string —
 * so the constant has to live somewhere neither half owns. Nothing here is a
 * component and nothing imports React, so both sides can read it.
 *
 * ⚠ THE STRING IS BYTE-FOR-BYTE THE ONE `HeaderNav` DECLARED. Moving a literal
 * is not the moment to improve it: the desktop header is a pixel wall this
 * round, and a single changed token here would move Back and Home at 1440.
 */
export const HEADER_ICON_BUTTON =
	"inline-flex size-[34px] shrink-0 items-center justify-center rounded-(--r) bg-(--btn-fill) text-ink outline-none select-none [border:var(--hairline)] [transition:all_var(--dur-hover)] hover:[border:1px_solid_var(--ring)] active:bg-(--state-pressed-fill) focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) [&_svg]:size-[15px]";
