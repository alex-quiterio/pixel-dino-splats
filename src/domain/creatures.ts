import { poseTRex } from "@domain/animation";
import type { Creature } from "@domain/creature";
import { PALETTES } from "@domain/palette";
import { buildSquid, poseSquid, SQUID_PALETTES, SQUID_VIEW } from "@domain/squid";
import { buildCats, CAT_PALETTES, CAT_VIEW, poseCats } from "@domain/cats";
import { buildStag, poseStag, STAG_PALETTES, STAG_VIEW } from "@domain/stag";
import { buildElephant, ELEPHANT_PALETTES, ELEPHANT_VIEW, poseElephant } from "@domain/elephant";
import { buildDragon, DRAGON_PALETTES, DRAGON_VIEW, poseDragon } from "@domain/dragon";
import { buildStegosaurus, poseStegosaurus, STEGO_PALETTES, STEGO_VIEW } from "@domain/stegosaurus";
import { buildTRex } from "@domain/trex";
import { buildVelociraptor, poseVelociraptor, RAPTOR_PALETTES, RAPTOR_VIEW } from "@domain/velociraptor";
import { buildHalloween, HALLOWEEN_PALETTES, HALLOWEEN_VIEW, poseHalloween } from "@domain/halloween";

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

export const elephant: Creature = {
  id: "elephant",
  name: "Elephant",
  palettes: ELEPHANT_PALETTES,
  build: buildElephant,
  pose: poseElephant,
  view: ELEPHANT_VIEW,
};

export const stegosaurus: Creature = {
  id: "stegosaurus",
  name: "Stegosaurus",
  palettes: STEGO_PALETTES,
  build: buildStegosaurus,
  pose: poseStegosaurus,
  view: STEGO_VIEW,
};

export const dragon: Creature = {
  id: "dragon",
  name: "Black Dragon",
  palettes: DRAGON_PALETTES,
  build: buildDragon,
  pose: poseDragon,
  view: DRAGON_VIEW,
};

export const velociraptor: Creature = {
  id: "velociraptor",
  name: "Velociraptor",
  palettes: RAPTOR_PALETTES,
  build: buildVelociraptor,
  pose: poseVelociraptor,
  view: RAPTOR_VIEW,
};

export const halloween: Creature = {
  id: "halloween",
  name: "Halloween Eve",
  palettes: HALLOWEEN_PALETTES,
  build: buildHalloween,
  pose: poseHalloween,
  view: HALLOWEEN_VIEW,
};

export const CREATURES: readonly Creature[] = [trex, squid, stag, cats, elephant, stegosaurus, dragon, velociraptor, halloween];
export const creatureById = (id: string): Creature => CREATURES.find((c) => c.id === id) ?? trex;
