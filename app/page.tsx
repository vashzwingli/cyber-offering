"use client";

import {
  Apple,
  BookOpenText,
  ChevronDown,
  CircleAlert,
  Droplets,
  Flower2,
  History,
  LampDesk,
  LibraryBig,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import mappingsJson from "@/data/action-mappings.json";
import deitiesJson from "@/data/deities.json";
import { findRuleMappingId } from "@/lib/intent-router";

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
};

const mappings = mappingsJson as Mapping[];
const deities = deitiesJson as Deity[];

const relationLabels: Record<string, string> = {
  direct_traditional: "传统职掌直配",
  contextual_direct: "传统语境匹配",
  contextual_match: "语境匹配",
  functional_analogy: "功能类比",
  symbolic_only: "象征关联",
  playful: "玩梗路由",
  no_match: "无传统直配",
};

const examplePrompts = [
  "想谈恋爱",
  "准备研究生考试",
  "周末去拍野生鸟类",
  "第一次坐船出海",
  "新房刚刚入住",
];

const offeringIcons = [Flower2, LampDesk, Droplets, Apple, Sparkles];

function similarity(query: string, mapping: Mapping) {
  const normalized = query.replace(/[，。！？、\s]/g, "").toLowerCase();
  const corpus = [
    ...mapping.input_examples,
    mapping.normalized_intent,
    mapping.life_domain,
  ]
    .join("")
    .replace(/[，。！？、\s]/g, "")
    .toLowerCase();

  if (mapping.input_examples.some((item) => normalized.includes(item) || item.includes(normalized))) {
    return 100;
  }

  const removeFillers = (value: string) => value.replace(/我|想|要|准备|近期|第一次|去|做|制作|希望|参与|开始|进行/g, "");
  const semanticQuery = removeFillers(normalized) || normalized;
  const semanticCorpus = removeFillers(corpus);
  let score = 0;
  for (let index = 0; index < semanticQuery.length - 1; index += 1) {
    const pair = semanticQuery.slice(index, index + 2);
    if (semanticCorpus.includes(pair)) score += 8;
  }
  for (const character of new Set(semanticQuery)) {
    if (semanticCorpus.includes(character)) score += 1;
  }
  return score;
}

function localMatch(query: string): MatchResult {
  const ranked = [...mappings].sort((a, b) => similarity(query, b) - similarity(query, a));
  const ruleId = findRuleMappingId(query);
  const ruleMapping = mappings.find((item) => item.id === ruleId);
  const mapping = ruleMapping ?? (similarity(query, ranked[0]) >= 16 ? ranked[0] : {
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
  const route = mapping.routes[0];
  const deity = route?.target_id
    ? deities.find((item) => item.id === route.target_id) ?? null
    : null;

  return { query, mapping, deity, engine: "local" };
}

function getOfferingProfile(deity: Deity | null) {
  if (!deity) {
    return {
      items: [] as string[],
      note: "没有可靠的传统职掌对应，因此不自动生成传统供品清单。",
    };
  }
  if (deity?.tradition.includes("佛教")) {
    return {
      items: ["鲜花", "净水", "灯", "茶", "果物与菜蔬"],
      note: "按汉传佛教清净供养边界给出类别，不代拟寺院法会。",
    };
  }
  if (deity?.tradition.includes("道教")) {
    return {
      items: ["香", "鲜花", "灯", "净水", "时令鲜果"],
      note: "按当代道教活动场所的清洁、节俭、安全原则给出类别。",
    };
  }
  return {
    items: ["鲜花", "净水", "时令鲜果"],
    note: "此民间信仰条目尚无已核验的专属规格；仅列清洁供品候选，实际依当地庙宇。",
  };
}

function Seal({ deity }: { deity: Deity | null }) {
  const label = deity?.canonical_name ?? "无传统直配";
  const code = deity?.id ?? "NO-MATCH";
  return (
    <div className="seal-stage" aria-label={`${label}的程序生成身份印记，非标准神像`}>
      <div className="seal-orbit seal-orbit-one" />
      <div className="seal-orbit seal-orbit-two" />
      <div className="seal-core">
        <span className="seal-kicker">身份印记</span>
        <strong>{label.slice(0, 4)}</strong>
        <span>{code}</span>
      </div>
      <p>程序生成 · 非标准神像</p>
    </div>
  );
}

export default function Home() {
  const initial = useMemo(() => localMatch("想谈恋爱"), []);
  const [query, setQuery] = useState("想谈恋爱");
  const [result, setResult] = useState<MatchResult>(initial);
  const [strict, setStrict] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [jokeInput, setJokeInput] = useState("");
  const [jokeOfferings, setJokeOfferings] = useState<string[]>([]);

  const route = result.mapping.routes[0];
  const isBlockedByStrict = strict &&
    (result.mapping.review_status !== "verified" || result.deity?.review_status !== "verified");
  const offeringProfile = getOfferingProfile(result.deity);
  const filteredDeities = deities.filter((deity) => {
    const haystack = [
      deity.canonical_name,
      deity.tradition,
      ...deity.aliases,
      ...deity.domains,
      ...deity.matching_tags,
    ].join(" ");
    return haystack.includes(directoryQuery.trim());
  });

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const response = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!response.ok) throw new Error("route unavailable");
      const payload = (await response.json()) as MatchResult;
      setResult(payload);
    } catch {
      setResult(localMatch(trimmed));
    } finally {
      setLoading(false);
    }
  }

  function addJokeOffering() {
    const item = jokeInput.trim();
    if (!item || jokeOfferings.includes(item)) return;
    setJokeOfferings((current) => [...current, item]);
    setJokeInput("");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="relative z-10 border-b border-white/8">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="logo-mark" aria-hidden="true">功</div>
            <div>
              <p className="font-serif text-lg font-semibold tracking-[0.12em] text-[#f3d58c]">赛博供奉</p>
              <p className="text-xs text-white/45">现代诉求 · 传统职掌 · 证据路由</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-white/55 sm:flex">
            <span className="status-dot" />
            <span>100 位神佛</span>
            <span className="text-white/20">/</span>
            <span>36 条行为映射</span>
          </div>
          <Button
            variant="outline"
            className="border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setShowDirectory((value) => !value)}
          >
            <LibraryBig /> 名录库
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-[1480px] px-5 pb-10 pt-6 lg:px-8">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">请述所愿</p>
            <h1 className="font-serif text-2xl font-semibold tracking-wide text-white md:text-3xl">
              你最近准备做什么？
            </h1>
          </div>
          <label className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/70">
            <Switch
              checked={strict}
              onCheckedChange={setStrict}
              aria-label="切换正典模式"
              className="data-[state=checked]:bg-[#49cbbf]"
            />
            正典模式
            <span className="hidden text-xs text-white/35 sm:inline">仅显示已核验数据</span>
          </label>
        </div>

        <form onSubmit={submit} className="query-bar">
          <Search className="size-5 shrink-0 text-[#d7b86b]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 border-0 bg-transparent px-0 text-base text-white shadow-none placeholder:text-white/30 focus-visible:ring-0 md:text-base"
            placeholder="例如：准备拍摄野生动物、想换工作、第一次出海……"
            aria-label="输入要从事的行业或行为"
          />
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-11 rounded-xl bg-[#d6ad54] px-5 text-[#17130b] hover:bg-[#edc86f]"
          >
            {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            识别神职
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {examplePrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="prompt-chip"
              onClick={() => {
                setQuery(prompt);
                setResult(localMatch(prompt));
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {isBlockedByStrict ? (
          <section className="strict-empty mt-7" aria-live="polite">
            <ShieldCheck className="size-7 text-[#49cbbf]" />
            <div>
              <h2 className="font-serif text-xl text-white">暂无可进入正式答案的条目</h2>
              <p className="mt-1 text-sm leading-6 text-white/55">
                本次候选“{result.deity?.canonical_name ?? "无传统直配"}”与对应映射仍处于研究草案；正典模式不会越过审核状态。
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-white/12 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => setStrict(false)}
            >
              查看研究草案
            </Button>
          </section>
        ) : (
          <div className="result-grid mt-7" aria-live="polite">
            <article className="panel deity-panel">
              <div className="panel-label">
                <span>01</span>
                <p>职掌匹配</p>
                <Badge className="ml-auto border-[#49cbbf]/25 bg-[#49cbbf]/10 text-[#78ddd4]">
                  {result.engine === "llm" ? "LLM + 数据库" : "本地语义路由"}
                </Badge>
              </div>
              <Seal deity={result.deity} />
              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-white/15 text-white/65">
                    {result.deity?.tradition ?? "不路由"}
                  </Badge>
                  <Badge variant="outline" className="border-[#d6ad54]/25 text-[#d8bd7d]">
                    {relationLabels[route?.relation_level] ?? route?.relation_level}
                  </Badge>
                  <Badge variant="outline" className="border-white/10 text-white/40">
                    {result.mapping.review_status === "verified" ? "已核验" : "研究草案"}
                  </Badge>
                </div>
                <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[0.08em] text-white">
                  {result.deity?.canonical_name ?? "无传统直配"}
                </h2>
                {result.deity?.honorific_names?.[0] && (
                  <p className="mt-2 text-sm text-[#d7bd80]">{result.deity.honorific_names[0]}</p>
                )}
                <p className="mt-4 text-base leading-7 text-white/65">
                  {result.mapping.normalized_intent}
                </p>
                <div className="mt-5 border-t border-white/8 pt-4">
                  <p className="section-mini-title">传统职掌</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(result.deity?.domains ?? ["未发现可证实的传统对应"]).map((domain) => (
                      <span key={domain} className="domain-tag">{domain}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="panel evidence-panel">
              <div className="panel-label">
                <span>02</span>
                <p>形象与证据</p>
              </div>
              <div className="evidence-block">
                <p className="section-mini-title">标准形象依据</p>
                <p>{result.deity?.iconography ?? "没有传统直配，不生成神像或法号。"}</p>
              </div>
              {result.deity?.iconography_variation && (
                <div className="evidence-block">
                  <p className="section-mini-title">不可忽略的变体</p>
                  <p>{result.deity.iconography_variation}</p>
                </div>
              )}
              {result.mapping.exclusions.length > 0 && (
                <div className="caution-block">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  <p>{result.mapping.exclusions[0]}</p>
                </div>
              )}
              {result.mapping.clarifying_questions.length > 0 && (
                <div className="mt-auto pt-5">
                  <p className="section-mini-title">若要更准确，可继续说明</p>
                  <button
                    type="button"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.025] p-3 text-left text-sm leading-6 text-white/65 transition hover:border-[#49cbbf]/35 hover:bg-[#49cbbf]/5"
                    onClick={() => setQuery(result.mapping.clarifying_questions[0])}
                  >
                    {result.mapping.clarifying_questions[0]}
                  </button>
                </div>
              )}
              <p className="mt-5 flex items-center gap-2 text-xs text-white/30">
                <BookOpenText className="size-3.5" />
                依据 {new Set([...(result.deity?.source_ids ?? []), ...result.mapping.source_ids]).size} 项来源编号
              </p>
            </article>

            <article className="panel offering-panel">
              <div className="panel-label">
                <span>03</span>
                <p>当代安全供品</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/55">{offeringProfile.note}</p>
              {offeringProfile.items.length > 0 ? (
              <div className="offering-tray" aria-label="推荐供品类别">
                {offeringProfile.items.map((item, index) => {
                  const Icon = offeringIcons[index % offeringIcons.length];
                  return (
                    <div className="offering-item" key={item}>
                      <Icon />
                      <span>{item}</span>
                    </div>
                  );
                })}
              </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-white/35">
                  暂不生成传统供品
                </div>
              )}
              <div className="ritual-note">
                <History className="size-4 shrink-0 text-[#d6ad54]" />
                <p>
                  “大三牲／小三牲”具有显著地域差异，不作为全国通用规格；数量、香数与摆位均请依当地寺观。
                </p>
              </div>
              <div className="mt-5 border-t border-white/8 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="section-mini-title">玩梗贡品</p>
                  <span className="text-xs text-white/30">与传统供品分栏</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={jokeInput}
                    onChange={(event) => setJokeInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addJokeOffering();
                      }
                    }}
                    className="border-white/10 bg-white/[0.035] text-white placeholder:text-white/25"
                    placeholder="如：满格电量"
                    aria-label="添加玩梗贡品"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={addJokeOffering}
                    aria-label="添加玩梗贡品"
                  >
                    <Plus />
                  </Button>
                </div>
                {jokeOfferings.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {jokeOfferings.map((item) => (
                      <span className="joke-tag" key={item}>
                        {item}
                        <button
                          type="button"
                          aria-label={`移除${item}`}
                          onClick={() => setJokeOfferings((items) => items.filter((value) => value !== item))}
                        >
                          <X />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs leading-5 text-white/35">
          <p>不承诺消灾、治病、发财、升学或改变他人意愿；低置信度会返回候选或“无传统直配”。</p>
          <p>数据版本：2026-09-21 · 研究草案</p>
        </div>

        {showDirectory && (
          <section className="directory-panel mt-8">
            <div className="flex flex-col justify-between gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">研究名录</p>
                <h2 className="font-serif text-2xl text-white">100 位神佛与传统神职</h2>
              </div>
              <Input
                value={directoryQuery}
                onChange={(event) => setDirectoryQuery(event.target.value)}
                className="max-w-sm border-white/10 bg-white/[0.035] text-white placeholder:text-white/25"
                placeholder="搜索名称、职掌或体系"
                aria-label="搜索神佛名录"
              />
            </div>
            <div className="directory-grid mt-5">
              {filteredDeities.slice(0, 24).map((deity) => (
                <button
                  type="button"
                  key={deity.id}
                  className="directory-card"
                  onClick={() => {
                    const mapping = mappings.find((item) =>
                      item.routes.some((candidate) => candidate.target_id === deity.id),
                    );
                    if (mapping) {
                      setQuery(mapping.input_examples[0]);
                      setResult({ query: mapping.input_examples[0], mapping, deity, engine: "local" });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                  <span>{deity.id}</span>
                  <strong>{deity.canonical_name}</strong>
                  <p>{deity.domains.slice(0, 2).join(" · ")}</p>
                  <ChevronDown className="size-4 -rotate-90" />
                </button>
              ))}
            </div>
            {filteredDeities.length > 24 && (
              <p className="mt-4 text-center text-xs text-white/35">
                已显示前 24 条，请继续缩小搜索范围。
              </p>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
