import { poseTRex } from "@domain/animation";
import type { Creature } from "@domain/creature";
import { PALETTES } from "@domain/palette";
import { buildSquid, poseSquid, SQUID_PALETTES, SQUID_VIEW } from "@domain/squid";
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

export const CREATURES: readonly Creature[] = [trex, squid];
export const creatureById = (id: string): Creature => CREATURES.find((c) => c.id === id) ?? trex;
