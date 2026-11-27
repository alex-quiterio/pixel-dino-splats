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
import { buildMobius, MOBIUS_PALETTES, MOBIUS_VIEW, poseMobius } from "@domain/mobius";
import { buildEagleCrow, EAGLE_PALETTES, EAGLE_VIEW, poseEagleCrow } from "@domain/eagleCrow";
import { buildTRex } from "@domain/trex";
import { buildVelociraptor, poseVelociraptor, RAPTOR_PALETTES, RAPTOR_VIEW } from "@domain/velociraptor";
import { buildHalloween, HALLOWEEN_PALETTES, HALLOWEEN_VIEW, poseHalloween } from "@domain/halloween";

export const trex: Creature = {
  id: "trex",
  category: "Dinosaurs",
  quote: "I have very strong opinions about hugs, and also very short arms.",
  name: "T-Rex",
  palettes: PALETTES,
  build: buildTRex,
  pose: poseTRex,
  view: { target: [-1.2, 2.1, 0], span: 12.6, pitch: 0.18 },
};

export const squid: Creature = {
  id: "squid",
  category: "Sea",
  quote: "Eight arms, zero umbrellas. It's fine, it's raining on all of us.",
  name: "Squid",
  palettes: SQUID_PALETTES,
  build: buildSquid,
  pose: poseSquid,
  view: SQUID_VIEW,
};

export const stag: Creature = {
  id: "stag",
  category: "Mammals",
  quote: "I didn't choose the mushroom life. The mushrooms chose me, and they pay no rent.",
  name: "Mushroom Stag",
  palettes: STAG_PALETTES,
  build: buildStag,
  pose: poseStag,
  view: STAG_VIEW,
};

export const cats: Creature = {
  id: "cats",
  category: "Mammals",
  quote: "We are not fighting. We are discussing who owns the warm spot, loudly.",
  name: "Cat Duo",
  palettes: CAT_PALETTES,
  build: buildCats,
  pose: poseCats,
  view: CAT_VIEW,
};

export const elephant: Creature = {
  id: "elephant",
  category: "Mammals",
  quote: "I never forget. Especially who ate my snacks.",
  name: "Elephant",
  palettes: ELEPHANT_PALETTES,
  build: buildElephant,
  pose: poseElephant,
  view: ELEPHANT_VIEW,
};

export const stegosaurus: Creature = {
  id: "stegosaurus",
  category: "Dinosaurs",
  quote: "My brain is the size of a walnut, but my back looks incredible.",
  name: "Stegosaurus",
  palettes: STEGO_PALETTES,
  build: buildStegosaurus,
  pose: poseStegosaurus,
  view: STEGO_VIEW,
};

export const dragon: Creature = {
  id: "dragon",
  category: "Dinosaurs",
  quote: "I'm not hoarding gold. I'm just very committed to my collection.",
  name: "Black Dragon",
  palettes: DRAGON_PALETTES,
  build: buildDragon,
  pose: poseDragon,
  view: DRAGON_VIEW,
};

export const velociraptor: Creature = {
  id: "velociraptor",
  category: "Dinosaurs",
  quote: "Clever girl? Please. Clever, fluffy, and extremely good at knocking things off tables.",
  name: "Velociraptor",
  palettes: RAPTOR_PALETTES,
  build: buildVelociraptor,
  pose: poseVelociraptor,
  view: RAPTOR_VIEW,
};

export const halloween: Creature = {
  id: "halloween",
  category: "Spooky",
  quote: "Don't be scared. Be a little scared. Okay, run, but gracefully.",
  name: "Haunted Graveyard",
  palettes: HALLOWEEN_PALETTES,
  build: buildHalloween,
  pose: poseHalloween,
  view: HALLOWEEN_VIEW,
};

export const penrose: Creature = {
  id: "penrose",
  category: "Impossible",
  quote: "This way up! ...or is it? Honestly, I stopped checking.",
  name: "Impossible Triangle",
  palettes: PENROSE_PALETTES,
  build: buildPenrose,
  pose: posePenrose,
  view: PENROSE_VIEW,
};

export const torus: Creature = {
  id: "torus",
  category: "Impossible",
  quote: "Go around in circles long enough and something nice will grow in the middle.",
  name: "Tree of Life Torus",
  palettes: TORUS_PALETTES,
  build: buildTorus,
  pose: poseTorus,
  view: TORUS_VIEW,
};

export const mobius: Creature = {
  id: "mobius",
  category: "Impossible",
  name: "Möbius Strip",
  quote: "Which side am I on? Yes.",
  palettes: MOBIUS_PALETTES,
  build: buildMobius,
  pose: poseMobius,
  view: MOBIUS_VIEW,
};

export const eagle: Creature = {
  id: "eagle",
  category: "Birds",
  name: "Eagle & Crow",
  quote: "I rule the skies. He rules the bin behind the diner. We are both thriving.",
  palettes: EAGLE_PALETTES,
  build: buildEagleCrow,
  pose: poseEagleCrow,
  view: EAGLE_VIEW,
};

export const CREATURES: readonly Creature[] = [trex, squid, stag, cats, elephant, stegosaurus, dragon, velociraptor, halloween, penrose, torus, mobius, eagle];
export const creatureById = (id: string): Creature => CREATURES.find((c) => c.id === id) ?? trex;
