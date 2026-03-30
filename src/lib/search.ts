export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published_date?: string;
}

export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn('[search] No TAVILY_API_KEY set — skipping web search');
    return [];
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'advanced',
        include_answer: false,
        days: 30,
      }),
    });

    if (!response.ok) {
      console.error(`[search] Tavily error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.results || []).map((r: { title: string; url: string; content: string; published_date?: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content?.slice(0, 800) || '',
      published_date: r.published_date,
    }));
  } catch (err) {
    console.error('[search] Error:', (err as Error).message);
    return [];
  }
}
