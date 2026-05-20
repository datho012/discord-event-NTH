const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetches and parses the Sword of Justice news/events page.
 * @returns {Promise<Array<{title: string, description: string, url: string, imageUrl: string, category: string, date: string}>>}
 */
async function fetchNews() {
  try {
    const url = 'https://www.swordofjustice.com/sea/news/';
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000 // 10 seconds timeout
    });

    const $ = cheerio.load(data);
    const articles = [];
    
    $('ul.news-list li').each((i, el) => {
      const a = $(el).find('a');
      const href = a.attr('href');
      if (!href) return;
      
      const title = a.find('h2').text().trim();
      const description = a.find('p').text().trim();
      const img = a.find('img').attr('src');
      const category = a.find('.time span').text().trim();
      
      // Get date text
      const timeText = a.find('.time').text().replace(category, '').trim();
      const dateMatch = timeText.match(/\d{4}-\d{2}-\d{2}/);
      const date = dateMatch ? dateMatch[0] : timeText;
      
      articles.push({
        title,
        description,
        url: href,
        imageUrl: img,
        category: category || 'news',
        date: date || new Date().toISOString().split('T')[0]
      });
    });

    // Sort articles by date ascending (oldest first) so that they are posted in chronological order
    articles.sort((a, b) => a.date.localeCompare(b.date));

    return articles;
  } catch (error) {
    console.error('[Scraper Error]: Failed to fetch news:', error.message);
    throw error;
  }
}

module.exports = {
  fetchNews
};
