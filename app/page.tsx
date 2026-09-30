"use client";

import {
  Check,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";


import ritualProfilesJson from "@/data/ritual-profiles.json";
import { type MatchResult, type Deity } from "@/lib/match";
import { resolveExperienceMatch } from "@/lib/experience-match";
import { assetUrl, matchApiUrl } from "@/lib/browser-config";
import { getRitualAssetPath, getSceneOfferings, getVisibleRitualSteps, ritualAssetLabels, type RitualProfile, type RitualProfileData, type RitualStep } from "@/lib/ritual";

type Stage = "asking" | "seeking" | "ritual";
const ritualProfiles = ritualProfilesJson as RitualProfileData[];

function getDeityImagePath(deity: Deity | null) {
  return deity ? assetUrl(`/images/deities/${deity.id}.png`) : undefined;
}

function DeityImage({ deity, className }: { deity: Deity; className?: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className="image-unavailable">图像暂不可用</div> : (
    // Local transparent concept assets are deliberately served without image transformation.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={getDeityImagePath(deity)} alt={deity.canonical_name} onError={() => setFailed(true)} />
  );
}

function getRitualProfile(deity: Deity | null): RitualProfile {
  const empty = { label: "寄语", steps: [] };
  if (!deity) return empty;
  const profileId = /佛教/.test(deity.tradition) ? "buddhist-scriptural" : /道教/.test(deity.tradition) ? "dao-jiao-classical" : null;
  const profile = ritualProfiles.find((item) => item.id === profileId);
  if (!profile) return empty;
  return {
    label: "供奉仪轨",
    steps: getVisibleRitualSteps(profile),
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
  const deityImage = getDeityImagePath(deity);
  const offerings = getSceneOfferings(completedSteps);

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
        {deityImage && deity ? (
          <DeityImage key={deity.id} deity={deity} className="deity-figure-image" />
        ) : (
          <div className="placeholder-figure">
            <span />
          </div>
        )}
      </div>
      <div className="altar">
        <div className="altar-top">
          <div className="offering-row">
            {offerings.map(({ asset, stepId }) => (
              <div className={`scene-offering offering-${asset}`} key={`${asset}-${stepId}`}>
                {/* Transparent original artwork is placed directly on the altar. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getRitualAssetPath(asset)} alt={ritualAssetLabels[asset]} draggable={false} />
              </div>
            ))}
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
  const [offline, setOffline] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const stepListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const ritual = useMemo(() => getRitualProfile(result?.deity ?? null), [result]);
  const isComplete = ritual.steps.length > 0 && completedCount === ritual.steps.length;
  const illumination = stage === "ritual"
    ? Math.min(0.7, 0.12 + (completedCount / Math.max(ritual.steps.length, 1)) * 0.58)
    : 0;

  async function ask(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || stage === "seeking") return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setOffline(false);
    setStage("seeking");
    setCompletedCount(0);
    try {
      const [response] = await Promise.all([
        fetch(matchApiUrl(), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: trimmed, mode: "experience", request_id: crypto.randomUUID() }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        }),
        new Promise((resolve) => setTimeout(resolve, 1400)),
      ]);
      if (!response.ok) throw new Error("match failed");
      const nextResult = await response.json() as MatchResult;
      if (!controller.signal.aborted) setResult(nextResult);
    } catch {
      if (controller.signal.aborted) return;
      setOffline(true);
      setResult(resolveExperienceMatch(trimmed));
    } finally {
      if (!controller.signal.aborted) setStage("ritual");
    }
  }

  function restart(clearQuery = true) {
    requestRef.current?.abort();
    setStage("asking");
    if (clearQuery) setQuery("");
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
                maxLength={240}
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="说说你要做的事与心愿"
                aria-label="所求何事"
              />
              <span className="input-glow" />
            </div>
            <Button type="submit" disabled={!query.trim()} className="divination-button">
              问卜
            </Button>
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
          <button type="button" className="restart-button cancel-request" onClick={() => restart(false)}>返回修改</button>
        </section>
      )}

      {stage === "ritual" && result && (
        <section className="ritual-interface">
          <header className="ritual-header">
            <div>
              <span className="tiny-seal">功</span>
              <p>赛博供奉</p>
            </div>
            <button type="button" onClick={() => restart()} className="restart-button">
              <RotateCcw /> 另问一事
            </button>
          </header>

          {result.deity ? (
            <>
              <div className="deity-caption">
                <span>{result.deity.tradition}</span>
                <h2>{result.deity.canonical_name}</h2>
                <p className="petition-summary" title={result.query}>{result.query}</p>
                {result.reason && <p className="match-reason">{result.reason}</p>}
              </div>

              <aside className="ritual-controls">
                <div className="ritual-control-head">
                  <h3>{ritual.label}</h3>
                </div>
                {ritual.steps.length > 0 && <p className="progress-caption" aria-live="polite">{isComplete ? "礼成" : `已完成 ${completedCount} / ${ritual.steps.length}`}</p>}
                {ritual.steps.length > 0 && (
                <div className="ritual-progress" role="progressbar" aria-valuemin={0} aria-valuemax={ritual.steps.length || 1} aria-valuenow={completedCount} aria-label="供奉进度">
                  <span style={{ width: `${(completedCount / Math.max(ritual.steps.length, 1)) * 100}%` }} />
                </div>
                )}
                <div className="ritual-step-list" ref={stepListRef}>
                  {ritual.steps.map((step, index) => {
                    const done = index < completedCount;
                    const active = index === completedCount;
                    return (
                      <button
                        type="button"
                        key={step.id}
                        disabled={!active}
                        className={`ritual-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
                        onClick={() => {
                          setCompletedCount((count) => count === index ? count + 1 : count);
                          const nextStep = stepListRef.current?.children[index + 1];
                          if (nextStep instanceof HTMLElement) nextStep.scrollIntoView({ block: "nearest", behavior: "auto" });
                        }}
                      >
                        <span className="step-index">{done ? <Check /> : String(index + 1).padStart(2, "0")}</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="step-art" src={getRitualAssetPath(step.assets[0])} alt="" draggable={false} />
                        <span className="step-copy"><strong>{step.label}</strong><small>{step.note}</small></span>
                      </button>
                    );
                  })}
                </div>
                {(isComplete || !ritual.steps.length) && (
                  <Button className="bow-button" onClick={() => setDialogOpen(true)}>
                    <Sparkles /> {isComplete ? "叩拜 · 查看寄语" : "查看寄语"}
                  </Button>
                )}
              </aside>
            </>
          ) : (
            <aside className="no-match-card">
              <CircleAlert />
              <h2>{result.status === "needs_context" ? "再说具体一些" : "暂未找到对应"}</h2>
              <p>{result.status === "needs_context" ? "补充所在地点与具体场景，再来问一问。" : "说清要做的事情，以及心中的所求。"}</p>
              <Button onClick={() => restart(false)}>补充或修改所求</Button>
            </aside>
          )}
        </section>
      )}

      <p className="connection-status" role="status">{offline && "网络暂不可用，已为你继续匹配"}</p>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="revelation-dialog">
          <div className="revelation-layout">
            {result?.deity && (
              <figure className="revelation-image-frame">
                <div className="revelation-aureole" />
                <DeityImage key={result.deity.id} deity={result.deity} />
                <figcaption>{result.deity.canonical_name}</figcaption>
              </figure>
            )}
            <div className="revelation-copy">
              <DialogHeader>
                <span className="dialog-kicker">{ritual.steps.length ? "礼成" : "心意"}</span>
                <DialogTitle>{result?.deity?.honorific_names[0] || result?.deity?.canonical_name}</DialogTitle>
                <DialogDescription>{result?.deity?.tradition} · {result?.deity?.entity_type}</DialogDescription>
              </DialogHeader>
              <div className="message-scroll">
                <span>寄语</span>
                <blockquote>{result?.message}</blockquote>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

