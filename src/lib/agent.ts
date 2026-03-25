import { complete } from './providers';
import { webSearch } from './search';
import {
  getDb,
  getUnanalyzedItems,
  markItemsAnalyzed,
  insertArticle,
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

  const response = await complete({
    messages: [
      { role: 'system', content: JEAN_CLAUDE_SYSTEM + '\n\n' + ANALYSIS_PROMPT },
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
    maxTokens: 8192,
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
      image_query: article.image_query || undefined,
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
  console.log(`[agent] Selected ${selections.length} story(ies) to cover`);

  for (const sel of selections) {
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
