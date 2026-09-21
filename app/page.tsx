"use client";

import {
  Apple,
  Check,
  CircleAlert,
  CupSoda,
  Droplets,
  Flame,
  Flower2,
  Hand,
  LampDesk,
  Leaf,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { type CSSProperties, type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import mappingsJson from "@/data/action-mappings.json";
import deitiesJson from "@/data/deities.json";
import { findRuleMappingId } from "@/lib/intent-router";

type Stage = "asking" | "seeking" | "ritual";
type OfferingKind = "water" | "flower" | "lamp" | "fruit" | "incense" | "tea" | "vegetable" | "reverence";

type Route = {
  target_id: string | null;
  relation_level: string;
  score: number;
};

type Mapping = {
  id: string;
  life_domain: string;
  input_examples: string[];
  normalized_intent: string;
  routes: Route[];
  clarifying_questions: string[];
  exclusions: string[];
  source_ids: string[];
  review_status: string;
};

type Deity = {
  id: string;
  canonical_name: string;
  tradition: string;
  entity_type: string;
  honorific_names: string[];
  aliases: string[];
  domains: string[];
  matching_tags: string[];
  iconography: string;
  iconography_variation: string;
  source_ids: string[];
  review_status: string;
};

type MatchResult = {
  query: string;
  mapping: Mapping;
  deity: Deity | null;
  engine: "local" | "llm";
  message: string;
};

type RitualStep = {
  id: string;
  label: string;
  note: string;
  kind: OfferingKind;
  icon: LucideIcon;
};

type RitualProfile = {
  label: string;
  note: string;
  steps: RitualStep[];
};

const mappings = mappingsJson as Mapping[];
const deities = deitiesJson as Deity[];
const deityImages: Record<string, string> = {
  "DAO-008": "/images/zhao-gongming-transparent.png",
};

function similarity(query: string, mapping: Mapping) {
  const normalized = query.replace(/[，。！？、\s]/g, "").toLowerCase();
  const corpus = [...mapping.input_examples, mapping.normalized_intent, mapping.life_domain]
    .join("")
    .replace(/[，。！？、\s]/g, "")
    .toLowerCase();
  if (mapping.input_examples.some((item) => normalized.includes(item) || item.includes(normalized))) return 100;
  const strip = (value: string) => value.replace(/我|想|要|准备|近期|第一次|去|做|制作|希望|参与|开始|进行/g, "");
  const subject = strip(normalized) || normalized;
  const evidence = strip(corpus);
  let score = 0;
  for (let index = 0; index < subject.length - 1; index += 1) {
    if (evidence.includes(subject.slice(index, index + 2))) score += 8;
  }
  for (const character of new Set(subject)) {
    if (evidence.includes(character)) score += 1;
  }
  return score;
}

function localMatch(query: string): MatchResult {
  const ranked = [...mappings].sort((a, b) => similarity(query, b) - similarity(query, a));
  const ruleId = findRuleMappingId(query);
  const mapping = mappings.find((item) => item.id === ruleId) ??
    (similarity(query, ranked[0]) >= 16 ? ranked[0] : {
      id: "NO-MATCH",
      life_domain: "未分类",
      input_examples: [],
      normalized_intent: "未在当前行为映射库中找到可靠对应",
      routes: [{ target_id: null, relation_level: "no_match", score: 0 }],
      clarifying_questions: ["可以补充具体行为、场景和希望获得的帮助吗？"],
      exclusions: ["不根据谐音、动物名、法器或单一造像元素猜测神职"],
      source_ids: [],
      review_status: "verified",
    });
  const deity = mapping.routes[0]?.target_id
    ? deities.find((item) => item.id === mapping.routes[0].target_id) ?? null
    : null;
  const message = deity
    ? `所求关乎“${mapping.normalized_intent}”。愿你先尽人事、守住分寸，再以此礼整理心意。`
    : "此事在现有资料中没有可信的传统直配。不妄指神职，也是一种敬慎。";
  return { query, mapping, deity, engine: "local", message };
}

function getRitualProfile(deity: Deity | null): RitualProfile {
  if (!deity) return { label: "不生成仪轨", note: "没有可靠直配时，不自动拼接供奉步骤。", steps: [] };

  if (/^(佛教|汉传佛教|藏传佛教)/.test(deity.tradition)) {
    return {
      label: "清净供养次序",
      note: "仅呈现资料支持的清净供养类别；正式法会由寺院依本宗仪轨主持。",
      steps: [
        { id: "water", label: "奉净水", note: "使用洁净清水，不设固定数量。", kind: "water", icon: Droplets },
        { id: "flower", label: "献鲜花", note: "选择清洁、无损坏的鲜花。", kind: "flower", icon: Flower2 },
        { id: "lamp", label: "供灯", note: "页面模拟供灯；现实场所须遵守明火规定。", kind: "lamp", icon: LampDesk },
        { id: "tea", label: "奉茶", note: "使用清洁茶水，不代拟正式斋供。", kind: "tea", icon: CupSoda },
        { id: "fruit", label: "摆果蔬", note: "选择新鲜洁净的果物或菜蔬。", kind: "vegetable", icon: Leaf },
        { id: "reverence", label: "合掌致意", note: "静心片刻，不许诺现实结果。", kind: "reverence", icon: Hand },
      ],
    };
  }

  if (deity.tradition.includes("道教")) {
    return {
      label: "五类清供次序",
      note: "依据“香、花、灯、水、果”类别编排；数量与摆位依当地宫观。",
      steps: [
        { id: "incense", label: "奉香", note: "仅在场所允许且有人看管时进行。", kind: "incense", icon: Flame },
        { id: "flower", label: "献鲜花", note: "以天然、洁净、节俭为原则。", kind: "flower", icon: Flower2 },
        { id: "lamp", label: "供灯", note: "页面模拟供灯；现实中避免无人看管明火。", kind: "lamp", icon: LampDesk },
        { id: "water", label: "奉净水", note: "使用洁净清水，不补造杯数。", kind: "water", icon: Droplets },
        { id: "fruit", label: "摆净果", note: "使用新鲜时令果物，不规定单双数。", kind: "fruit", icon: Apple },
        { id: "reverence", label: "拱手致礼", note: "以敬意收束，不把仪式当作结果保证。", kind: "reverence", icon: Hand },
      ],
    };
  }

  return {
    label: "清洁供品候选",
    note: "该民间信仰尚无已核验的专属规格；以下不是地方仪轨，实际请依庙宇传统。",
    steps: [
      { id: "water", label: "奉净水", note: "以清洁、安全为原则。", kind: "water", icon: Droplets },
      { id: "flower", label: "献鲜花", note: "不替代地方庙宇的正式规定。", kind: "flower", icon: Flower2 },
      { id: "fruit", label: "摆净果", note: "不规定品种、数量与左右位置。", kind: "fruit", icon: Apple },
      { id: "reverence", label: "静心致意", note: "表达心意，不承诺改变现实结果。", kind: "reverence", icon: Hand },
    ],
  };
}

function TempleScene({
  deity,
  completedSteps,
  illumination,
  blurred,
}: {
  deity: Deity | null;
  completedSteps: RitualStep[];
  illumination: number;
  blurred: boolean;
}) {
  const deityImage = deity ? deityImages[deity.id] : undefined;

  return (
    <div
      className={`temple-scene ${blurred ? "is-blurred" : ""}`}
      style={{ "--illumination": illumination } as CSSProperties}
      aria-hidden="true"
    >
      <div className="temple-ceiling"><span /><span /><span /><span /><span /></div>
      <div className="temple-pillar pillar-left" />
      <div className="temple-pillar pillar-right" />
      <div className="side-lantern lantern-left" />
      <div className="side-lantern lantern-right" />
      <div className="shrine-halo" />
      <div className="deity-placeholder">
        <div className="placeholder-aureole" />
        {deityImage ? (
          <img
            className="deity-figure-image"
            src={deityImage}
            alt={`${deity.canonical_name}极简形象`}
          />
        ) : (
          <div className="placeholder-figure">
            <span>{deity ? "神明形象" : "形象占位"}</span>
          </div>
        )}
      </div>
      <div className="altar">
        <div className="altar-top">
          <div className="offering-row">
            {completedSteps.filter((step) => step.kind !== "reverence").map((step) => {
              const Icon = step.icon;
              return (
                <div className={`scene-offering offering-${step.kind}`} key={step.id}>
                  <Icon />
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="altar-front"><span>敬</span></div>
      </div>
      <div className="floor-light" />
      <div className="scene-vignette" />
    </div>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("asking");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const ritual = useMemo(() => getRitualProfile(result?.deity ?? null), [result]);
  const isComplete = ritual.steps.length > 0 && completedCount === ritual.steps.length;
  const illumination = stage === "ritual"
    ? Math.min(1, 0.16 + (completedCount / Math.max(ritual.steps.length, 1)) * 0.84)
    : 0;

  async function ask(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setStage("seeking");
    setCompletedCount(0);
    try {
      const [response] = await Promise.all([
        fetch("/api/match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        }),
        new Promise((resolve) => setTimeout(resolve, 1400)),
      ]);
      if (!response.ok) throw new Error("match failed");
      setResult(await response.json() as MatchResult);
    } catch {
      setResult(localMatch(trimmed));
    } finally {
      setStage("ritual");
    }
  }

  function restart() {
    setStage("asking");
    setQuery("");
    setResult(null);
    setCompletedCount(0);
    setDialogOpen(false);
  }

  return (
    <main className={`experience stage-${stage}`}>
      <TempleScene
        deity={result?.deity ?? null}
        completedSteps={ritual.steps.slice(0, completedCount)}
        illumination={illumination}
        blurred={stage !== "ritual"}
      />

      {stage === "asking" && (
        <section className="petition-layer">
          <form className="petition-form" onSubmit={ask}>
            <p className="brand-whisper">赛博供奉</p>
            <h1>所求何事</h1>
            <div className="petition-input-wrap">
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="说清要做的事、所在场景与心中所求"
                aria-label="所求何事"
              />
              <span className="input-glow" />
            </div>
            <Button type="submit" disabled={!query.trim()} className="divination-button">
              问卜
            </Button>
            <p className="petition-footnote">系统只在现有名录与证据中寻找对应，不凭谐音臆造神职</p>
          </form>
        </section>
      )}

      {stage === "seeking" && (
        <section className="seeking-layer" aria-live="polite">
          <div className="seeking-orbit">
            <span /><span /><span />
            <LoaderCircle />
          </div>
          <p>正在寻找对应神明</p>
          <small>辨行为 · 察场景 · 明所求</small>
        </section>
      )}

      {stage === "ritual" && result && (
        <section className="ritual-interface">
          <header className="ritual-header">
            <div>
              <span className="tiny-seal">功</span>
              <p>赛博供奉</p>
            </div>
            <button type="button" onClick={restart} className="restart-button">
              <RotateCcw /> 另问一事
            </button>
          </header>

          {result.deity ? (
            <>
              <div className="deity-caption">
                <span>{result.deity.tradition}</span>
                <h2>{result.deity.canonical_name}</h2>
                <p>{result.mapping.normalized_intent}</p>
              </div>

              <aside className="ritual-controls">
                <div className="ritual-control-head">
                  <span>{result.engine === "llm" ? "LLM 路由" : "证据路由"} · 研究草案</span>
                  <h3>{ritual.label}</h3>
                  <p>{ritual.note}</p>
                </div>
                <div className="ritual-progress" aria-label={`供奉进度 ${completedCount}/${ritual.steps.length}`}>
                  <span style={{ width: `${(completedCount / ritual.steps.length) * 100}%` }} />
                </div>
                <div className="ritual-step-list">
                  {ritual.steps.map((step, index) => {
                    const Icon = step.icon;
                    const done = index < completedCount;
                    const active = index === completedCount;
                    return (
                      <button
                        type="button"
                        key={step.id}
                        disabled={!active}
                        className={`ritual-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
                        onClick={() => setCompletedCount((count) => Math.min(count + 1, ritual.steps.length))}
                      >
                        <span className="step-index">{done ? <Check /> : String(index + 1).padStart(2, "0")}</span>
                        <Icon className="step-icon" />
                        <span className="step-copy"><strong>{step.label}</strong><small>{step.note}</small></span>
                      </button>
                    );
                  })}
                </div>
                {isComplete && (
                  <Button className="bow-button" onClick={() => setDialogOpen(true)}>
                    <Sparkles /> 叩拜
                  </Button>
                )}
                <p className="ritual-safety">三牲、纸钱、酒供及具体数量未进入默认流程；请依当地寺观规定。</p>
              </aside>
            </>
          ) : (
            <aside className="no-match-card">
              <CircleAlert />
              <span>无传统直配</span>
              <h2>未找到可信对应</h2>
              <p>{result.mapping.normalized_intent}</p>
              <small>{result.mapping.exclusions[0]}</small>
              <Button onClick={restart}>换个说法</Button>
            </aside>
          )}
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="revelation-dialog">
          <DialogHeader>
            <span className="dialog-kicker">礼成 · 尊号</span>
            <DialogTitle>{result?.deity?.honorific_names[0] || result?.deity?.canonical_name}</DialogTitle>
            <DialogDescription>{result?.deity?.tradition} · {result?.deity?.entity_type}</DialogDescription>
          </DialogHeader>
          <div className="revelation-section">
            <span>原典形象</span>
            <p>{result?.deity?.iconography}</p>
            {result?.deity?.iconography_variation && <small>{result.deity.iconography_variation}</small>}
          </div>
          <div className="message-scroll">
            <span>寄语</span>
            <blockquote>{result?.message}</blockquote>
            <small>现代生成寄语 · 非签文、非神谕、不承诺结果</small>
          </div>
          <div className="dialog-evidence">
            数据状态：{result?.deity?.review_status === "verified" ? "已核验" : "研究草案"} ·
            来源编号 {result?.deity?.source_ids.join("、")}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
