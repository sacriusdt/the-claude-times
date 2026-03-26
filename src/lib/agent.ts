import { complete } from './providers';
import { webSearch } from './search';
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
  SOPHIA_SYSTEM,
  SOPHIA_ANALYSIS_PROMPT,
  SOPHIA_ARTICLE_PROMPT,
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

function extractJson(text: string): string {
  // Try to find JSON in the response (handles markdown code blocks)
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();

  // Try to find array or object
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1];

  return text.trim();
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

  const recentArticles = getRecentArticleMemory(20);
  const memoryBlock = recentArticles.length > 0
    ? `\n\n## Your Recent Publications (avoid repetition)\n\n${recentArticles.map(a => `- [${a.category}] "${a.title}"${a.subtitle ? ` — ${a.subtitle}` : ''} (${a.published_at.slice(0, 10)})`).join('\n')}`
    : '';

  const response = await complete({
    messages: [
      { role: 'system', content: JEAN_CLAUDE_SYSTEM + '\n\n' + ANALYSIS_PROMPT + memoryBlock },
      {
        role: 'user',
        content: `Here are the latest feed items to review:\n\n${JSON.stringify(itemsSummary, null, 2)}`,
      },
    ],
    maxTokens: 2048,
    temperature: 0.6,
  });

  // Mark all items as analyzed regardless
  markItemsAnalyzed(items.map(i => i.id));

  try {
    const parsed = JSON.parse(extractJson(response));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error('[agent] Failed to parse analysis response');
    return [];
  }
}

// Step 2: Research a topic via web search
async function researchTopic(queries: string[]): Promise<string> {
  const allResults = [];
  for (const query of queries) {
    const results = await webSearch(query, 4);
    allResults.push(...results);
  }

  if (allResults.length === 0) return 'No additional research available.';

  return allResults
    .map(r => `[${r.title}](${r.url})\n${r.snippet}`)
    .join('\n\n');
}

// Step 3: Write an article
export async function writeArticle(
  topic: string,
  angle: string,
  category: string,
  sourceItems: FeedItem[],
  research: string,
): Promise<{ slug: string; title: string } | null> {
  const sourcesContext = sourceItems
    .map(i => `- ${i.title} (${i.feed_title}): ${i.description?.slice(0, 300)}`)
    .join('\n');

  const response = await complete({
    messages: [
      { role: 'system', content: JEAN_CLAUDE_SYSTEM + '\n\n' + ARTICLE_PROMPT },
      {
        role: 'user',
        content: `## Assignment

**Topic**: ${topic}
**Your Angle**: ${angle}
**Category**: ${category}

## Source Material

${sourcesContext}

## Additional Research

${research}

Now write your article. Remember: this is a Jean-Claude piece. Have a point of view. Make it worth reading.`,
      },
    ],
    maxTokens: 16000,
    temperature: 0.75,
  });

  try {
    const article = JSON.parse(extractJson(response));
    const slug = slugify(article.title) + '-' + Date.now().toString(36);

    insertArticle({
      slug,
      title: article.title,
      subtitle: article.subtitle || null,
      category: article.category || category,
      content: JSON.stringify(article.content),
      summary: article.summary || undefined,
      source_items: JSON.stringify(sourceItems.map(i => i.id)),
      image_url: undefined,
      image_query: undefined,
      geo_lat: article.geo?.lat ?? null,
      geo_lng: article.geo?.lng ?? null,
      geo_label: article.geo?.label ?? null,
    });

    console.log(`[agent] Published: "${article.title}" → /article/${slug}`);
    return { slug, title: article.title };
  } catch (err) {
    console.error('[agent] Failed to parse article JSON:', (err as Error).message);
    return null;
  }
}

// Step 4: Full pipeline — analyze → research → write
export async function runPipeline(): Promise<string[]> {
  console.log('[agent] Starting editorial pipeline...');
  const published: string[] = [];

  const selections = await analyzeFeeds();
  // Hard cap: one article per pipeline run, no matter what the model returns
  const toPublish = selections.slice(0, 1);
  console.log(`[agent] Selected ${toPublish.length} story to cover (${selections.length} candidate(s) returned)`);

  for (const sel of toPublish) {
    // Research
    const research = await researchTopic(sel.search_queries);

    // Get source items
    const db = getDb();
    const sourceItems = sel.item_ids
      .map(id => db.prepare('SELECT * FROM feed_items WHERE id = ?').get(id))
      .filter(Boolean) as FeedItem[];

    // Write
    const result = await writeArticle(sel.topic, sel.angle, sel.category, sourceItems, research);
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

  // Research the topic
  const research = await researchTopic([
    topic,
    `${topic} latest news analysis`,
    `${topic} background context`,
  ]);

  // Determine category
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

  // Find an angle
  const angleResponse = await complete({
    messages: [
      { role: 'system', content: JEAN_CLAUDE_SYSTEM },
      {
        role: 'user',
        content: `Based on this research, what's your editorial angle for an article about "${topic}"?${instructions ? `\n\nEditor's notes: ${instructions}` : ''}\n\nResearch:\n${research}\n\nRespond in 1-2 sentences with your angle.`,
      },
    ],
    maxTokens: 200,
    temperature: 0.7,
  });

  return writeArticle(topic, angleResponse, finalCategory, [], research);
}

// ── Sophia's Pipeline ──────────────────────────────────────────────────────

function getSophiaModelOpts() {
  return {
    modelOverride: process.env.SOPHIA_MODEL || undefined,
    providerOverride: (process.env.SOPHIA_PROVIDER as import('./providers').Provider) || undefined,
  };
}

// Step 1: Sophia analyzes feed items (up to 3 picks)
export async function sophiaAnalyzeFeeds(): Promise<AnalysisResult[]> {
  const items = getUnanalyzedItems(60);
  if (items.length === 0) return [];

  const itemsSummary = items.map(i => ({
    id: i.id,
    title: i.title,
    source: i.feed_title,
    category: i.category,
    description: i.description?.slice(0, 200),
    date: i.pub_date,
  }));

  const recentArticles = getRecentArticleMemory(30);
  const memoryBlock = recentArticles.length > 0
    ? `\n\n## Recent Newsroom Publications (avoid repetition)\n\n${recentArticles.map(a => `- [${a.category}] "${a.title}"${a.subtitle ? ` — ${a.subtitle}` : ''} (${a.published_at.slice(0, 10)}) by ${a.author}`).join('\n')}`
    : '';

  const sophiaOpts = getSophiaModelOpts();

  const response = await complete({
    ...sophiaOpts,
    messages: [
      { role: 'system', content: SOPHIA_SYSTEM + '\n\n' + SOPHIA_ANALYSIS_PROMPT + memoryBlock },
      {
        role: 'user',
        content: `Latest feed items to review:\n\n${JSON.stringify(itemsSummary, null, 2)}`,
      },
    ],
    maxTokens: 2048,
    temperature: 0.7,
  });

  // Do NOT mark items analyzed here — Jean-Claude will also see them
  try {
    const parsed = JSON.parse(extractJson(response));
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    console.error('[sophia] Failed to parse analysis response');
    return [];
  }
}

// Step 2: Sophia writes an article
export async function sophiaWriteArticle(
  topic: string,
  angle: string,
  category: string,
  sourceItems: FeedItem[],
  research: string,
): Promise<{ slug: string; title: string } | null> {
  const sourcesContext = sourceItems
    .map(i => `- ${i.title} (${i.feed_title}): ${i.description?.slice(0, 300)}`)
    .join('\n');

  const sophiaOpts = getSophiaModelOpts();

  const response = await complete({
    ...sophiaOpts,
    messages: [
      { role: 'system', content: SOPHIA_SYSTEM + '\n\n' + SOPHIA_ARTICLE_PROMPT },
      {
        role: 'user',
        content: `## Assignment\n\n**Topic**: ${topic}\n**Your Angle**: ${angle}\n**Category**: ${category}\n\n## Source Material\n\n${sourcesContext}\n\n## Additional Research\n\n${research}\n\nWrite the article. Fast, sharp, no padding.`,
      },
    ],
    maxTokens: 4096,
    temperature: 0.8,
  });

  try {
    const article = JSON.parse(extractJson(response));
    const slug = slugify(article.title) + '-s-' + Date.now().toString(36);

    insertArticle({
      slug,
      title: article.title,
      subtitle: article.subtitle || null,
      category: article.category || category,
      content: JSON.stringify(article.content),
      summary: article.summary || undefined,
      source_items: JSON.stringify(sourceItems.map(i => i.id)),
      image_url: undefined,
      image_query: undefined,
      geo_lat: article.geo?.lat ?? null,
      geo_lng: article.geo?.lng ?? null,
      geo_label: article.geo?.label ?? null,
      author: 'Sophia',
    });

    console.log(`[sophia] Published: "${article.title}" → /article/${slug}`);
    return { slug, title: article.title };
  } catch (err) {
    console.error('[sophia] Failed to parse article JSON:', (err as Error).message);
    return null;
  }
}

// Step 3: Sophia full pipeline
export async function runSophiaPipeline(): Promise<string[]> {
  console.log('[sophia] Starting editorial pipeline...');
  const published: string[] = [];

  const selections = await sophiaAnalyzeFeeds();
  console.log(`[sophia] Selected ${selections.length} story(ies) to cover`);

  for (const sel of selections) {
    const research = await researchTopic(sel.search_queries);

    const db = getDb();
    const sourceItems = sel.item_ids
      .map(id => db.prepare('SELECT * FROM feed_items WHERE id = ?').get(id))
      .filter(Boolean) as FeedItem[];

    const result = await sophiaWriteArticle(sel.topic, sel.angle, sel.category, sourceItems, research);
    if (result) published.push(result.title);
  }

  console.log(`[sophia] Pipeline complete. Published ${published.length} article(s).`);
  return published;
}

// On-demand article from Sophia (via chat)
export async function sophiaWriteArticleOnDemand(
  topic: string,
  instructions?: string,
): Promise<{ slug: string; title: string } | null> {
  console.log(`[sophia] On-demand article requested: "${topic}"`);

  const sophiaOpts = getSophiaModelOpts();

  const research = await researchTopic([
    topic,
    `${topic} breaking news`,
    `${topic} latest update`,
  ]);

  const categoryResponse = await complete({
    ...sophiaOpts,
    messages: [
      { role: 'system', content: 'Respond with exactly one word: breaking-news, international, politics, geopolitics, or business.' },
      { role: 'user', content: `Which category best fits: "${topic}"?` },
    ],
    maxTokens: 10,
    temperature: 0,
  });

  const cat = categoryResponse.trim().toLowerCase().replace(/[^a-z-]/g, '');
  const validCats = ['breaking-news', 'international', 'politics', 'geopolitics', 'business'];
  const finalCategory = validCats.includes(cat) ? cat : 'breaking-news';

  const angleResponse = await complete({
    ...sophiaOpts,
    messages: [
      { role: 'system', content: SOPHIA_SYSTEM },
      {
        role: 'user',
        content: `What's your angle on "${topic}"?${instructions ? `\nEditor notes: ${instructions}` : ''}\n\nResearch:\n${research}\n\nRespond in 1-2 sentences.`,
      },
    ],
    maxTokens: 200,
    temperature: 0.8,
  });

  return sophiaWriteArticle(topic, angleResponse, finalCategory, [], research);
}
