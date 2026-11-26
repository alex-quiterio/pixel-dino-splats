import { poseTRex } from "@domain/animation";
import type { Creature } from "@domain/creature";
import { PALETTES } from "@domain/palette";
import { buildSquid, poseSquid, SQUID_PALETTES, SQUID_VIEW } from "@domain/squid";
import { buildCats, CAT_PALETTES, CAT_VIEW, poseCats } from "@domain/cats";
import { buildStag, poseStag, STAG_PALETTES, STAG_VIEW } from "@domain/stag";
import { buildElephant, ELEPHANT_PALETTES, ELEPHANT_VIEW, poseElephant } from "@domain/elephant";
import { buildDragon, DRAGON_PALETTES, DRAGON_VIEW, poseDragon } from "@domain/dragon";
import { buildStegosaurus, poseStegosaurus, STEGO_PALETTES, STEGO_VIEW } from "@domain/stegosaurus";
import { buildPenrose, PENROSE_PALETTES, PENROSE_VIEW, posePenrose } from "@domain/penrose";
import { buildTorus, poseTorus, TORUS_PALETTES, TORUS_VIEW } from "@domain/torus";
import { buildTRex } from "@domain/trex";
import { buildVelociraptor, poseVelociraptor, RAPTOR_PALETTES, RAPTOR_VIEW } from "@domain/velociraptor";
import { buildHalloween, HALLOWEEN_PALETTES, HALLOWEEN_VIEW, poseHalloween } from "@domain/halloween";

export const trex: Creature = {
  id: "trex",
  quote: "I have very strong opinions about hugs, and also very short arms.",
  name: "T-Rex",
  palettes: PALETTES,
  build: buildTRex,
  pose: poseTRex,
  view: { target: [-1.2, 2.1, 0], span: 12.6, pitch: 0.18 },
};

export const squid: Creature = {
  id: "squid",
  quote: "Eight arms, zero umbrellas. It's fine, it's raining on all of us.",
  name: "Squid",
  palettes: SQUID_PALETTES,
  build: buildSquid,
  pose: poseSquid,
  view: SQUID_VIEW,
};

export const stag: Creature = {
  id: "stag",
  quote: "I didn't choose the mushroom life. The mushrooms chose me, and they pay no rent.",
  name: "Mushroom Stag",
  palettes: STAG_PALETTES,
  build: buildStag,
  pose: poseStag,
  view: STAG_VIEW,
};

export const cats: Creature = {
  id: "cats",
  quote: "We are not fighting. We are discussing who owns the warm spot, loudly.",
  name: "Cat Duo",
  palettes: CAT_PALETTES,
  build: buildCats,
  pose: poseCats,
  view: CAT_VIEW,
};

export const elephant: Creature = {
  id: "elephant",
  quote: "I never forget. Especially who ate my snacks.",
  name: "Elephant",
  palettes: ELEPHANT_PALETTES,
  build: buildElephant,
  pose: poseElephant,
  view: ELEPHANT_VIEW,
};

export const stegosaurus: Creature = {
  id: "stegosaurus",
  quote: "My brain is the size of a walnut, but my back looks incredible.",
  name: "Stegosaurus",
  palettes: STEGO_PALETTES,
  build: buildStegosaurus,
  pose: poseStegosaurus,
  view: STEGO_VIEW,
};

export const dragon: Creature = {
  id: "dragon",
  quote: "I'm not hoarding gold. I'm just very committed to my collection.",
  name: "Black Dragon",
  palettes: DRAGON_PALETTES,
  build: buildDragon,
  pose: poseDragon,
  view: DRAGON_VIEW,
};

export const velociraptor: Creature = {
  id: "velociraptor",
  quote: "Clever girl? Please. Clever, fluffy, and extremely good at knocking things off tables.",
  name: "Velociraptor",
  palettes: RAPTOR_PALETTES,
  build: buildVelociraptor,
  pose: poseVelociraptor,
  view: RAPTOR_VIEW,
};

export const halloween: Creature = {
  id: "halloween",
  quote: "Don't be scared. Be a little scared. Okay, run, but gracefully.",
  name: "Haunted Graveyard",
  palettes: HALLOWEEN_PALETTES,
  build: buildHalloween,
  pose: poseHalloween,
  view: HALLOWEEN_VIEW,
};

export const penrose: Creature = {
  id: "penrose",
  quote: "This way up! ...or is it? Honestly, I stopped checking.",
  name: "Impossible Triangle",
  palettes: PENROSE_PALETTES,
  build: buildPenrose,
  pose: posePenrose,
  view: PENROSE_VIEW,
};

export const torus: Creature = {
  id: "torus",
  quote: "Go around in circles long enough and something nice will grow in the middle.",
  name: "Tree of Life Torus",
  palettes: TORUS_PALETTES,
  build: buildTorus,
  pose: poseTorus,
  view: TORUS_VIEW,
};

export const CREATURES: readonly Creature[] = [trex, squid, stag, cats, elephant, stegosaurus, dragon, velociraptor, halloween, penrose, torus];
export const creatureById = (id: string): Creature => CREATURES.find((c) => c.id === id) ?? trex;
