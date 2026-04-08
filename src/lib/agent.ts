import { complete } from './providers';
import { SearchResult, webSearch } from './search';
import {
  getDb,
  getUnanalyzedItems,
  markItemsAnalyzed,
  insertArticle,
  getRecentArticleMemory,
  FeedItem,
} from './db';
import {
  JEAN_CLAUDE_SYSTEM,
  ANALYSIS_PROMPT,
  ARTICLE_PROMPT,
} from './personality';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

interface AnalysisResult {
  item_ids: number[];
  topic: string;
  angle: string;
  category: string;
  search_queries: string[];
}

interface AnalysisCandidate extends AnalysisResult {
  macro_topic?: string;
  novelty_score?: number;
  urgency_score?: number;
}

interface ArticleDraft {
  title: string;
  subtitle: string | null;
  summary: string | null;
  category: string;
  geo: {
    lat: number;
    lng: number;
    label: string;
  };
  content: Record<string, unknown>[];
}

interface EditorialReview {
  verdict: 'pass' | 'fail';
  factual_issues: string[];
  stale_claims: string[];
  tone_issues: string[];
  required_fixes: string[];
  risk_level: 'low' | 'medium' | 'high';
}

interface ResearchBundle {
  results: SearchResult[];
  context: string;
}

const VALID_CATEGORIES = new Set(['international', 'politics', 'geopolitics', 'business']);
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'between', 'could', 'from', 'have', 'into', 'just',
  'like', 'more', 'most', 'over', 'same', 'than', 'that', 'their', 'there', 'these', 'they',
  'this', 'those', 'through', 'under', 'very', 'were', 'what', 'when', 'where', 'which',
  'while', 'with', 'would', 'your', 'will', 'been',
]);

function extractJson(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1];

  return text.trim();
}

function currentDateContext(): string {
  return `Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

function normalizeCategory(category: string | undefined): string {
  const cleaned = (category || '').trim().toLowerCase();
  return VALID_CATEGORIES.has(cleaned) ? cleaned : 'international';
}

function uniqueStrings(items: string[], limit = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= limit) break;
  }

  return out;
}

function parseScore(value: unknown, fallback = 6): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.min(10, Math.round(value)));
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return Math.max(1, Math.min(10, Math.round(parsed)));
  return fallback;
}

function extractTopicAnchors(text: string): string[] {
  return uniqueStrings(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length >= 4 && !STOP_WORDS.has(token)),
    12,
  );
}

function scoreCandidateDiversity(
  candidate: AnalysisCandidate,
  recentArticles: ReturnType<typeof getRecentArticleMemory>,
): number {
  const recent = recentArticles.slice(0, 20);
  const categoryCount = recent.filter(article => article.category === candidate.category).length;
  const categoryShare = recent.length > 0 ? categoryCount / recent.length : 0;
  const macroTopic = (candidate.macro_topic || candidate.topic).trim().toLowerCase();
  const anchors = extractTopicAnchors(`${candidate.topic} ${candidate.angle} ${macroTopic}`);

  let exactMacroHits = 0;
  let anchorHits = 0;

  for (const article of recent) {
    const text = `${article.title} ${article.subtitle || ''} ${article.summary || ''}`.toLowerCase();
    if (macroTopic.length >= 5 && text.includes(macroTopic)) exactMacroHits += 1;
    if (anchors.some(anchor => text.includes(anchor))) anchorHits += 1;
  }

  const novelty = parseScore(candidate.novelty_score, 6);
  const urgency = parseScore(candidate.urgency_score, 6);
  let score = novelty * 1.8 + urgency * 1.2;

  if (categoryShare > 0.45) score -= (categoryShare - 0.45) * 12;
  if (categoryShare < 0.2) score += 1.5;

  score -= anchorHits * 2.0;
  score -= exactMacroHits * 3.0;

  if (exactMacroHits >= 2 && urgency < 8) score -= 6;
  if (anchorHits >= 4 && novelty < 8) score -= 4;

  return score;
}

function selectBestCandidate(
  candidates: AnalysisCandidate[],
  recentArticles: ReturnType<typeof getRecentArticleMemory>,
): AnalysisResult | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const ranked = candidates
    .map(candidate => ({
      candidate,
      score: scoreCandidateDiversity(candidate, recentArticles),
    }))
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  if (!winner) return null;

  console.log(`[agent] Candidate ranking: ${ranked.map(r => `${r.candidate.topic}=${r.score.toFixed(1)}`).join(' | ')}`);
  return winner.candidate;
}

function normalizeCandidates(raw: unknown, items: FeedItem[]): AnalysisCandidate[] {
  if (!Array.isArray(raw)) return [];
  const validIds = new Set(items.map(item => item.id));

  const candidates: AnalysisCandidate[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;

    const record = entry as Record<string, unknown>;
    const ids = Array.isArray(record.item_ids)
      ? Array.from(new Set(record.item_ids
        .map(id => Number(id))
        .filter(id => Number.isInteger(id) && validIds.has(id))))
      : [];
    const searchQueries = Array.isArray(record.search_queries)
      ? uniqueStrings(record.search_queries.map(q => String(q)), 4)
      : [];

    const topic = String(record.topic || '').trim();
    const angle = String(record.angle || '').trim();
    if (!topic || !angle || ids.length === 0 || searchQueries.length < 2) continue;

    candidates.push({
      item_ids: ids,
      topic,
      angle,
      category: normalizeCategory(String(record.category || '')),
      search_queries: searchQueries,
      macro_topic: String(record.macro_topic || topic).trim(),
      novelty_score: parseScore(record.novelty_score, 6),
      urgency_score: parseScore(record.urgency_score, 6),
    });
  }

  return candidates;
}

function parseDateMs(value: string | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function renderResearchContext(results: SearchResult[]): string {
  if (results.length === 0) return 'No additional research available.';

  return results
    .map((result, index) => {
      const dateTag = result.published_date ? ` [published: ${result.published_date}]` : ' [published: unknown]';
      return `[R${index + 1}] ${result.title} (${result.url})${dateTag}\n${result.snippet}`;
    })
    .join('\n\n');
}

function renderSourceContext(sourceItems: FeedItem[]): string {
  if (sourceItems.length === 0) {
    return '- No direct RSS source items are attached to this assignment. Use research only.';
  }

  return sourceItems
    .map((item, index) => {
      const pub = item.pub_date || 'unknown';
      return `[F${index + 1}] ${item.title} (${item.feed_title}) [published: ${pub}]\n${(item.description || '').slice(0, 400)}`;
    })
    .join('\n\n');
}

function collectText(value: unknown, out: string[]) {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return;
  }

  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectText(child, out);
  }
}

function articlePlainText(article: ArticleDraft): string {
  const chunks: string[] = [article.title, article.subtitle || '', article.summary || ''];
  collectText(article.content, chunks);
  return chunks.join('\n').trim();
}

function detectHyperbole(text: string): string[] {
  const checks: Array<{ regex: RegExp; label: string }> = [
    { regex: /\b(?:changes?|rewrite|reshapes?)\s+history\b/i, label: 'Avoid declaring that an event "changes history".' },
    { regex: /\bthe world will never be the same\b/i, label: 'Avoid absolute claims about global irreversible change.' },
    { regex: /\bend(?:ing)?\s+of\s+(?:the\s+)?(?:war|conflict)\b/i, label: 'Do not present temporary pauses as the end of a conflict.' },
    { regex: /\bfinally\s+(?:resolved|settled|fixed)\b/i, label: 'Avoid "finally resolved" unless the source confirms a definitive settlement.' },
    { regex: /\bfor years of\b|\bafter years of\b/i, label: 'Do not overstate duration unless the chronology is explicitly sourced.' },
    { regex: /\bturning point in history\b/i, label: 'Avoid grand historical framing unless directly evidenced.' },
    { regex: /\bgame[- ]changer\b/i, label: 'Avoid generic hype phrases like "game-changer".' },
  ];

  const flags: string[] = [];
  for (const check of checks) {
    if (check.regex.test(text)) flags.push(check.label);
  }
  return uniqueStrings(flags, 20);
}

function normalizeReview(raw: unknown): EditorialReview {
  const fallback: EditorialReview = {
    verdict: 'fail',
    factual_issues: ['Editorial review could not be parsed.'],
    stale_claims: [],
    tone_issues: [],
    required_fixes: ['Return valid JSON from editorial review.'],
    risk_level: 'high',
  };

  if (!raw || typeof raw !== 'object') return fallback;
  const record = raw as Record<string, unknown>;

  const verdict = String(record.verdict || '').toLowerCase() === 'pass' ? 'pass' : 'fail';
  const risk = String(record.risk_level || '').toLowerCase();
  const risk_level: EditorialReview['risk_level'] =
    risk === 'low' || risk === 'medium' || risk === 'high' ? risk : 'high';

  const parseList = (key: string): string[] => {
    const value = record[key];
    if (!Array.isArray(value)) return [];
    return uniqueStrings(value.map(v => String(v || '').trim()).filter(Boolean), 20);
  };

  return {
    verdict,
    factual_issues: parseList('factual_issues'),
    stale_claims: parseList('stale_claims'),
    tone_issues: parseList('tone_issues'),
    required_fixes: parseList('required_fixes'),
    risk_level,
  };
}

function normalizeDraft(raw: unknown, fallbackCategory: string): ArticleDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  const title = String(record.title || '').trim();
  if (!title) return null;

  const content = Array.isArray(record.content)
    ? record.content.filter(block => block && typeof block === 'object') as Record<string, unknown>[]
    : [];
  if (content.length === 0) return null;

  const geoRaw = (record.geo && typeof record.geo === 'object')
    ? record.geo as Record<string, unknown>
    : {};

  const lat = Number(geoRaw.lat);
  const lng = Number(geoRaw.lng);
  const label = String(geoRaw.label || '').trim();

  return {
    title,
    subtitle: String(record.subtitle || '').trim() || null,
    summary: String(record.summary || '').trim() || null,
    category: normalizeCategory(String(record.category || fallbackCategory)),
    geo: {
      lat: Number.isFinite(lat) ? lat : 38.9072,
      lng: Number.isFinite(lng) ? lng : -77.0369,
      label: label || 'Washington, DC, United States',
    },
    content,
  };
}

// Step 1: Analyze unanalyzed feed items
export async function analyzeFeeds(): Promise<AnalysisResult[]> {
  const items = getUnanalyzedItems(40);
  if (items.length === 0) return [];

  const itemsSummary = items.map(i => ({
    id: i.id,
    title: i.title,
    source: i.feed_title,
    category: i.category,
    description: i.description?.slice(0, 200),
    date: i.pub_date,
  }));

  const recentArticles = getRecentArticleMemory(60);
  const categoryBreakdown = recentArticles.reduce<Record<string, number>>((acc, article) => {
    acc[article.category] = (acc[article.category] || 0) + 1;
    return acc;
  }, {});

  const memoryBlock = recentArticles.length > 0
    ? `\n\n## Your Recent Publications (editorial memory — use this to enforce variety)\n\n${recentArticles.map(a => `- [${a.category}] "${a.title}"${a.subtitle ? ` — ${a.subtitle}` : ''} (${a.published_at.slice(0, 10)})`).join('\n')}\n\n## Category distribution in recent coverage\n${Object.entries(categoryBreakdown).map(([category, count]) => `- ${category}: ${count}`).join('\n')}\n\nIf one category or one conflict dominates this memory, bias your selection toward a different subject unless there is a major, verifiable breakthrough.`
    : '';

  const response = await complete({
    messages: [
      { role: 'system', content: JEAN_CLAUDE_SYSTEM + '\n\n' + ANALYSIS_PROMPT + memoryBlock },
      {
        role: 'user',
        content: `${currentDateContext()}\n\nHere are the latest feed items to review:\n\n${JSON.stringify(itemsSummary, null, 2)}`,
      },
    ],
    maxTokens: 2500,
    temperature: 0.5,
  });

  markItemsAnalyzed(items.map(i => i.id));

  try {
    const parsed = JSON.parse(extractJson(response));
    const candidates = normalizeCandidates(parsed, items);
    const selected = selectBestCandidate(candidates, recentArticles);
    return selected ? [selected] : [];
  } catch {
    console.error('[agent] Failed to parse analysis response');
    return [];
  }
}

// Step 2: Research a topic via web search
async function researchTopic(queries: string[]): Promise<ResearchBundle> {
  const dedupedQueries = uniqueStrings(queries, 8);
  const byUrl = new Map<string, SearchResult>();

  if (dedupedQueries.length === 0) {
    return { results: [], context: 'No additional research available.' };
  }

  for (const query of dedupedQueries) {
    const results = await webSearch(query, 6);
    for (const result of results) {
      if (!result.url) continue;
      const existing = byUrl.get(result.url);
      if (!existing) {
        byUrl.set(result.url, result);
        continue;
      }

      const existingDate = parseDateMs(existing.published_date);
      const incomingDate = parseDateMs(result.published_date);
      if (incomingDate > existingDate || (incomingDate === existingDate && result.snippet.length > existing.snippet.length)) {
        byUrl.set(result.url, result);
      }
    }
  }

  const sorted = [...byUrl.values()]
    .sort((a, b) => parseDateMs(b.published_date) - parseDateMs(a.published_date))
    .slice(0, 20);

  return {
    results: sorted,
    context: renderResearchContext(sorted),
  };
}

async function generateArticleDraft(
  topic: string,
  angle: string,
  category: string,
  sourceItems: FeedItem[],
  researchContext: string,
  revisionNotes: string[] = [],
): Promise<ArticleDraft | null> {
  const sourcesContext = renderSourceContext(sourceItems);

  const revisionBlock = revisionNotes.length > 0
    ? `\n\n## Mandatory Revision Notes\n\n${revisionNotes.map(note => `- ${note}`).join('\n')}\n\nYou must resolve every point above while keeping the article coherent.`
    : '';

  const response = await complete({
    messages: [
      { role: 'system', content: JEAN_CLAUDE_SYSTEM + '\n\n' + ARTICLE_PROMPT },
      {
        role: 'user',
        content: `${currentDateContext()}

CRITICAL ACCURACY REMINDER: You are writing in ${new Date().getFullYear()}. All facts, statistics, names of officials, policy statuses, and ongoing situations in your article MUST come exclusively from the source material and research provided below. Do not supplement with your training knowledge — it is outdated. If the research is insufficient to make a factual claim, omit the claim or frame it as uncertainty.

## Assignment

**Topic**: ${topic}
**Your Angle**: ${angle}
**Category**: ${category}

## Source Material

${sourcesContext}

## Additional Research (check [published: ...] dates — prefer the most recent)

${researchContext}${revisionBlock}

Now write your article.`,
      },
    ],
    maxTokens: 16000,
    temperature: 0.65,
  });

  try {
    const parsed = JSON.parse(extractJson(response));
    return normalizeDraft(parsed, category);
  } catch (err) {
    console.error('[agent] Failed to parse article draft JSON:', (err as Error).message);
    return null;
  }
}

async function reviewArticleDraft(
  draft: ArticleDraft,
  sourceItems: FeedItem[],
  researchResults: SearchResult[],
): Promise<EditorialReview> {
  const localToneFlags = detectHyperbole(articlePlainText(draft));
  const response = await complete({
    messages: [
      {
        role: 'system',
        content: `You are the standards editor for The Claude Times.
Return ONLY JSON with this shape:
{
  "verdict": "pass" | "fail",
  "factual_issues": ["..."],
  "stale_claims": ["..."],
  "tone_issues": ["..."],
  "required_fixes": ["..."],
  "risk_level": "low" | "medium" | "high"
}

Rules:
- Mark "fail" if any concrete claim is unsupported by provided evidence.
- Mark "fail" if current-office claims are not confirmed by very recent sources.
- Mark "fail" if the draft treats old facts as current without date framing.
- Mark "fail" if tone contains dramatic overstatement or deterministic claims not supported by evidence.
- Be strict and specific in required_fixes.`,
      },
      {
        role: 'user',
        content: `${currentDateContext()}

## Draft to review
${JSON.stringify(draft, null, 2)}

## RSS source material
${renderSourceContext(sourceItems)}

## Web research
${renderResearchContext(researchResults)}

## Local tone warnings from static checks
${localToneFlags.length > 0 ? localToneFlags.map(flag => `- ${flag}`).join('\n') : '- none'}

Evaluate this draft now.`,
      },
    ],
    maxTokens: 2000,
    temperature: 0,
  });

  let review: EditorialReview;
  try {
    review = normalizeReview(JSON.parse(extractJson(response)));
  } catch {
    review = normalizeReview(null);
  }

  if (localToneFlags.length > 0) {
    review.tone_issues = uniqueStrings([...review.tone_issues, ...localToneFlags], 30);
    review.required_fixes = uniqueStrings([...review.required_fixes, ...localToneFlags], 30);
    review.verdict = 'fail';
    if (review.risk_level === 'low') review.risk_level = 'medium';
  }

  return review;
}

async function reviseArticleDraft(
  draft: ArticleDraft,
  topic: string,
  angle: string,
  category: string,
  sourceItems: FeedItem[],
  researchResults: SearchResult[],
  review: EditorialReview,
): Promise<ArticleDraft | null> {
  const fixes = uniqueStrings(
    [
      ...review.factual_issues,
      ...review.stale_claims,
      ...review.tone_issues,
      ...review.required_fixes,
    ],
    40,
  );

  return generateArticleDraft(
    topic,
    angle,
    category,
    sourceItems,
    renderResearchContext(researchResults),
    [
      ...fixes,
      'Use cautious wording for uncertainty instead of certainty claims.',
      'Do not assert current office holders without direct, recent support in the research list.',
      'If a source is older, add explicit time framing (for example: "as of [date]").',
      `Preserve the main thesis: ${draft.title}`,
    ],
  );
}

async function generateValidatedDraft(
  topic: string,
  angle: string,
  category: string,
  sourceItems: FeedItem[],
  researchResults: SearchResult[],
): Promise<ArticleDraft | null> {
  let draft = await generateArticleDraft(topic, angle, category, sourceItems, renderResearchContext(researchResults));
  if (!draft) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const review = await reviewArticleDraft(draft, sourceItems, researchResults);
    const hasBlockingIssues =
      review.verdict === 'fail' ||
      review.factual_issues.length > 0 ||
      review.stale_claims.length > 0 ||
      review.tone_issues.length > 0 ||
      review.required_fixes.length > 0;

    if (!hasBlockingIssues) {
      return draft;
    }

    if (attempt === 2) {
      console.error(`[agent] Editorial QA failed after retries (risk=${review.risk_level}).`);
      console.error(`[agent] Blocking issues: ${[...review.factual_issues, ...review.stale_claims, ...review.tone_issues].join(' | ')}`);
      return null;
    }

    const revised = await reviseArticleDraft(
      draft,
      topic,
      angle,
      category,
      sourceItems,
      researchResults,
      review,
    );
    if (!revised) return null;
    draft = revised;
  }

  return null;
}

// Step 3: Write an article
export async function writeArticle(
  topic: string,
  angle: string,
  category: string,
  sourceItems: FeedItem[],
  researchResults: SearchResult[],
): Promise<{ slug: string; title: string } | null> {
  const draft = await generateValidatedDraft(topic, angle, category, sourceItems, researchResults);
  if (!draft) {
    console.error('[agent] Publication blocked by editorial QA.');
    return null;
  }

  const slug = slugify(draft.title) + '-' + Date.now().toString(36);
  insertArticle({
    slug,
    title: draft.title,
    subtitle: draft.subtitle,
    category: draft.category || category,
    content: JSON.stringify(draft.content),
    summary: draft.summary || undefined,
    source_items: JSON.stringify(sourceItems.map(i => i.id)),
    image_url: undefined,
    image_query: undefined,
    geo_lat: draft.geo.lat ?? null,
    geo_lng: draft.geo.lng ?? null,
    geo_label: draft.geo.label ?? null,
  });

  console.log(`[agent] Published: "${draft.title}" → /article/${slug}`);
  return { slug, title: draft.title };
}

// Step 4: Full pipeline — analyze → research → write
export async function runPipeline(): Promise<string[]> {
  console.log('[agent] Starting editorial pipeline...');
  const published: string[] = [];

  const selections = await analyzeFeeds();
  const toPublish = selections.slice(0, 1);
  console.log(`[agent] Selected ${toPublish.length} story to cover (${selections.length} candidate(s) returned)`);

  for (const sel of toPublish) {
    const research = await researchTopic(sel.search_queries);

    const db = getDb();
    const sourceItems = sel.item_ids
      .map(id => db.prepare('SELECT * FROM feed_items WHERE id = ?').get(id))
      .filter(Boolean) as FeedItem[];

    const result = await writeArticle(sel.topic, sel.angle, sel.category, sourceItems, research.results);
    if (result) published.push(result.title);
  }

  console.log(`[agent] Pipeline complete. Published ${published.length} article(s).`);
  return published;
}

// On-demand article from chat
export async function writeArticleOnDemand(
  topic: string,
  instructions?: string,
): Promise<{ slug: string; title: string } | null> {
  console.log(`[agent] On-demand article requested: "${topic}"`);

  const research = await researchTopic([
    topic,
    `${topic} latest news ${new Date().getFullYear()}`,
    `${topic} official statements ${new Date().getFullYear()}`,
    `${topic} Reuters AP Bloomberg ${new Date().getFullYear()}`,
    `${topic} analysis expert opinion`,
    `${topic} background history context`,
    `${topic} latest developments facts`,
  ]);

  const categoryResponse = await complete({
    messages: [
      {
        role: 'system',
        content: 'Respond with exactly one word: international, politics, geopolitics, or business.',
      },
      {
        role: 'user',
        content: `Which category best fits this topic: "${topic}"?`,
      },
    ],
    maxTokens: 10,
    temperature: 0,
  });

  const category = categoryResponse.trim().toLowerCase().replace(/[^a-z]/g, '') || 'international';
  const validCategories = ['international', 'politics', 'geopolitics', 'business'];
  const finalCategory = validCategories.includes(category) ? category : 'international';

  const angleResponse = await complete({
    messages: [
      { role: 'system', content: JEAN_CLAUDE_SYSTEM },
      {
        role: 'user',
        content: `${currentDateContext()}\n\nBased on this research, what's your editorial angle for an article about "${topic}"?${instructions ? `\n\nEditor's notes: ${instructions}` : ''}\n\nResearch:\n${research.context}\n\nRespond in 1-2 sentences with your angle.`,
      },
    ],
    maxTokens: 200,
    temperature: 0.7,
  });

  return writeArticle(topic, angleResponse, finalCategory, [], research.results);
}

