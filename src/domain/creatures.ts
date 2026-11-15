import { poseTRex } from "@domain/animation";
import type { Creature } from "@domain/creature";
import { PALETTES } from "@domain/palette";
import { buildSquid, poseSquid, SQUID_PALETTES, SQUID_VIEW } from "@domain/squid";
import { buildCats, CAT_PALETTES, CAT_VIEW, poseCats } from "@domain/cats";
import { buildStag, poseStag, STAG_PALETTES, STAG_VIEW } from "@domain/stag";
import { buildTRex } from "@domain/trex";

export const trex: Creature = {
  id: "trex",
  name: "T-Rex",
  palettes: PALETTES,
  build: buildTRex,
  pose: poseTRex,
  view: { target: [-1.2, 2.1, 0], span: 12.6, pitch: 0.18 },
};

export const squid: Creature = {
  id: "squid",
  name: "Squid",
  palettes: SQUID_PALETTES,
  build: buildSquid,
  pose: poseSquid,
  view: SQUID_VIEW,
};

export const stag: Creature = {
  id: "stag",
  name: "Mushroom Stag",
  palettes: STAG_PALETTES,
  build: buildStag,
  pose: poseStag,
  view: STAG_VIEW,
};

export const cats: Creature = {
  id: "cats",
  name: "Cat Duo",
  palettes: CAT_PALETTES,
  build: buildCats,
  pose: poseCats,
  view: CAT_VIEW,
};

export const CREATURES: readonly Creature[] = [trex, squid, stag, cats];
export const creatureById = (id: string): Creature => CREATURES.find((c) => c.id === id) ?? trex;
