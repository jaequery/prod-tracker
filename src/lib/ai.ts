interface Dimension {
  label: string;
  grade: string;
  comment: string;
}

export interface AiReview {
  summary: string;
  score: number;
  targetAudience: string;
  dimensions: Dimension[];
}

const VALID_GRADES = ["A", "B", "C", "D", "F"];

export async function reviewPost(
  title: string,
  url: string,
): Promise<AiReview | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are reviewing a Show HN project. Be concise and honest.

Project title: ${title}
Project URL: ${url}

Evaluate:
1. Who is this for? (specific target audience)
2. Usefulness — how useful is it for that audience? Grade A-F.
3. Competition — how crowded is this space? Grade A-F (A = wide open, F = saturated).
4. Money — revenue potential? Grade A-F.
5. Overall score 0-100: how interesting is this idea to the mass HN audience, considering novelty, usefulness, and potential impact? Be unbiased. Use the FULL range — boring/derivative projects get 20-40, decent ones 40-60, good ones 60-80, exceptional ones 80+. Do NOT default to 72.

Respond in this exact JSON format (no markdown, no code fences):
{
  "summary": "1-2 sentence summary of what this does and why it matters.",
  "targetAudience": "specific audience in a few words",
  "score": 72,
  "dimensions": [
    {"label": "Usefulness", "grade": "B", "comment": "one sentence"},
    {"label": "Competition", "grade": "C", "comment": "one sentence"},
    {"label": "Money", "grade": "B", "comment": "one sentence"}
  ]
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

    const parsed = JSON.parse(content);

    // Validate score
    if (typeof parsed.score !== "number" || parsed.score < 0 || parsed.score > 100) return null;

    // Validate dimensions
    for (const d of parsed.dimensions) {
      if (!VALID_GRADES.includes(d.grade)) return null;
    }

    return {
      summary: parsed.summary,
      score: parsed.score,
      targetAudience: parsed.targetAudience,
      dimensions: parsed.dimensions,
    };
  } catch (err) {
    console.error("AI review failed:", err);
    return null;
  }
}
