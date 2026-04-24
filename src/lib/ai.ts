export const CATEGORIES = [
  "startup",
  "open-source",
  "dev-tool",
  "ai-ml",
  "video-game",
  "hardware",
  "educational",
  "informational",
  "research",
  "content",
  "demo",
  "hobby",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface AiReview {
  summary: string;
  score: number;
  whyItMatters: string;
  targetAudience: string;
  vibe: string;
  techStack: string;
  category: Category;
}

export type Exemplar = {
  title: string;
  value: 1 | -1;
  reason: string;
};

function isValidScore(n: unknown): n is number {
  return typeof n === "number" && n >= 0 && n <= 100;
}

function renderExemplars(exemplars: Exemplar[]): string {
  if (exemplars.length === 0) return "";
  const liked = exemplars.filter((e) => e.value === 1);
  const disliked = exemplars.filter((e) => e.value === -1);
  const fmt = (e: Exemplar) => `- "${e.title}" — ${e.reason}`;
  const lines: string[] = [
    "",
    "THE USER'S TASTE (calibrate against these labeled examples — weight them heavily):",
  ];
  if (liked.length) {
    lines.push("");
    lines.push("Projects the user rated as GOOD Show HN:");
    lines.push(...liked.map(fmt));
  }
  if (disliked.length) {
    lines.push("");
    lines.push("Projects the user rated as BAD Show HN:");
    lines.push(...disliked.map(fmt));
  }
  lines.push("");
  return lines.join("\n");
}

export async function reviewPost(
  title: string,
  url: string,
  exemplars: Exemplar[] = [],
): Promise<AiReview | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt = `You're reviewing a Show HN project for an audience of developers, designers, and startup founders who browse HN daily. They want to know: is this cool? is this useful? should I care?

You lean toward projects with real ambition — things built for users, with a shot at becoming a product, business, or broadly-used library. Small hobby projects and weekend hacks meant only as free OSS with no clear audience or ambition should be scored LOWER — cap them around 40-55 unless the craft is genuinely exceptional. Reserve high scores (75+) for projects that look like they could actually matter: shippable products, startups, serious dev tools, libraries people would depend on, or hobby projects with extraordinary execution.

Evaluate through a Paul Graham / YC lens. Reward projects that show:
- "Make something people want" — solves a real, felt problem, not a solution looking for a problem.
- Founders scratching their own itch with authentic domain insight.
- A small but intensely-interested initial audience (better to be loved by a few than liked by many).
- A plausible path to becoming a large business, or a "schlep" others won't do.
- Signs of rapid iteration, taste, and technical depth — "live in the future, then build what's missing."
- Non-obvious or counterintuitive ideas that sound almost-bad-but-actually-good ("a frighteningly ambitious idea").

Penalize: derivative SaaS clones, thin LLM wrappers with no moat, "solution in search of a problem" demos, vague vision with no user, tarpit ideas (social networks for X, marketplaces with no liquidity story).

AUDIENCE BREADTH — heavily weight how many people would actually care:
- BOOST projects with broad/mass appeal — tools or products a large population of developers, creators, consumers, or businesses could genuinely use.
- PENALIZE narrow-interest curiosities that only a tiny niche would care about. Examples of things to score LOW (cap around 35-50 unless extraordinary):
  * Archival / historical compilations with no practical use (e.g. "Historical Python source documentation from 1.0.1 through 2.0c1") — interesting to a handful of historians, meaningless to most.
  * Hyper-specific personal scripts, single-use data dumps, one-off visualizations of obscure data.
  * "I scraped/mirrored/archived X" posts where the artifact has no ongoing utility.
  * Tools built for a problem only the author has.
- A project doesn't need to be for literally everyone, but ask: "Would a meaningful slice of the HN audience actually use or revisit this, or just nod and scroll past?" If the honest answer is the latter, score it low regardless of craft.
${renderExemplars(exemplars)}
Project title: ${title}
Project URL: ${url}

SCORING — use the FULL 0-100 range with HIGH VARIANCE:
- 90-100: "Drop everything and look at this." Genuinely novel, beautifully executed, or solves a massive pain point. ~5%.
- 75-89: Really impressive. Great craft, clear value, makes you want to star/bookmark it. ~10%.
- 55-74: Solid work. Useful or interesting but not exceptional. ~25%.
- 35-54: Meh. Another todo app, thin wrapper, or solution seeking a problem. ~30%.
- 15-34: Weak. Unclear purpose, poor execution, or deeply crowded space. ~20%.
- 0-14: Why was this posted? ~10%.

Also provide:
- "whyItMatters": 1 sentence — the single most compelling reason someone should click through and try this. What makes it stand out? Be specific. If nothing stands out, say so honestly.
- "vibe": A 2-4 word vibe check (e.g., "weekend hack energy", "VC-ready polish", "niche but brilliant", "overengineered todo app", "actually useful CLI", "beautiful and pointless", "scratching own itch")
- "techStack": Key technologies detected or inferred (e.g., "Rust, WASM", "Next.js, Supabase", "Python CLI")
- "category": Pick EXACTLY ONE from this list — no other values:
   - "startup": commercial product, SaaS, paid service, anything pursuing revenue
   - "open-source": library, framework, SDK, OSS package meant to be imported by other devs
   - "dev-tool": CLI, IDE plugin, dev workflow utility (not a library)
   - "ai-ml": AI/ML/LLM-focused product or model release (overrides startup/oss when AI is the headline)
   - "video-game": a game, playable interactive entertainment
   - "hardware": physical product, IoT, robotics, electronics
   - "educational": tutorial, course, interactive lesson, teaching tool
   - "informational": data viz, dataset, reference site, directory, dashboard about something
   - "research": academic paper, novel technique writeup, research preview
   - "content": blog post, newsletter, essay, podcast, video
   - "demo": showcase/experiment/art piece with no clear utility goal
   - "hobby": weekend hack, personal side project not aiming for users
   - "other": none of the above clearly fits

Respond in this exact JSON format (no markdown, no code fences):
{
  "summary": "1-2 sentence take. Be opinionated. Be specific. Be entertaining. What would you say about this to a friend over coffee?",
  "whyItMatters": "One compelling sentence about why this is worth your time — or why it isn't.",
  "targetAudience": "specific audience in a few words",
  "vibe": "2-4 word vibe check",
  "techStack": "key tech",
  "category": "startup",
  "score": 38
}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      console.error(`OpenRouter error: ${res.status} ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    // Strip control characters that break JSON.parse (tabs/newlines inside strings)
    content = content.replace(/[\x00-\x1f]/g, (ch: string) =>
      ch === "\n" || ch === "\r" || ch === "\t" ? " " : ""
    );

    const parsed = JSON.parse(content);

    // Validate score
    if (!isValidScore(parsed.score)) return null;

    const rawCat = typeof parsed.category === "string" ? parsed.category.toLowerCase().trim() : "";
    const category: Category = (CATEGORIES as readonly string[]).includes(rawCat)
      ? (rawCat as Category)
      : "other";

    return {
      summary: parsed.summary,
      score: parsed.score,
      whyItMatters: parsed.whyItMatters || "",
      targetAudience: parsed.targetAudience,
      vibe: parsed.vibe || "",
      techStack: parsed.techStack || "",
      category,
    };
  } catch (err) {
    console.error("AI review failed:", err);
    return null;
  }
}
