import { assetUrl } from "./browser-config.ts";
export type RitualAssetId = "incense" | "flower" | "lamp" | "meal" | "fruit" | "tea" | "wine" | "scroll" | "grain";

export type RitualScene = {
  enabled: boolean;
  action?: "offer" | "withdraw";
  assets?: RitualAssetId[];
  label?: string;
  note?: string;
  reason?: string;
};

export type RitualProfileData = {
  id: string;
  label: string;
  steps: Array<{
    id: string;
    label: string;
    display_note: string;
    scene: RitualScene;
  }>;
};

export type RitualStep = {
  id: string;
  label: string;
  note: string;
  action: "offer" | "withdraw";
  assets: RitualAssetId[];
};

export type RitualProfile = { label: string; steps: RitualStep[] };

export const ritualAssetLabels: Record<RitualAssetId, string> = {
  incense: "香炉", flower: "花供", lamp: "供灯", meal: "供馔", fruit: "果盘",
  tea: "茶盏", wine: "酒器", scroll: "祝文卷轴", grain: "谷物供器",
};

export function getRitualAssetPath(asset: RitualAssetId) {
  return assetUrl(`/images/rituals/${asset}.png`);
}

export function getVisibleRitualSteps(profile: RitualProfileData): RitualStep[] {
  return profile.steps.filter((step) => step.scene.enabled).map((step) => ({
    id: step.id,
    label: step.scene.label ?? step.label,
    note: step.scene.note ?? step.display_note,
    action: step.scene.action ?? "offer",
    assets: step.scene.assets ?? [],
  }));
}

// A repeated offering refreshes its illustration, rather than prescribing a cup count.
export function getSceneOfferings(completedSteps: RitualStep[]) {
  const offerings = new Map<RitualAssetId, { asset: RitualAssetId; stepId: string }>();
  for (const step of completedSteps) {
    for (const asset of step.assets) {
      if (step.action === "withdraw") offerings.delete(asset);
      else offerings.set(asset, { asset, stepId: step.id });
    }
  }
  return [...offerings.values()];
}
