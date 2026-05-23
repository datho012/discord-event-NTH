
const { translate } = require('@vitalets/google-translate-api');

async function scrapeSwordOfJustice() {
    try {
      const axios = require('axios');
      const cheerio = require('cheerio');
      const res = await axios.get('https://www.swordofjustice.com/sea/news/');
      const $ = cheerio.load(res.data);
      const items = [];
      
      $('.news-list li').each((i, li) => {
        const a = $(li).find('a');
        if (!a.length) return;
        
        const title = a.attr('title') || a.find('h2').text().trim() || '';
        const url = a.attr('href');
        const img = a.find('img').attr('src') || '';
        
        const timeElem = a.find('.time');
        const category = timeElem.find('span').text().trim() || 'news';
        
        let dateStr = timeElem.text().replace(category, '').trim();
        // dateStr is usually like "2026-05-22"
        
        items.push({
          title,
          description: a.find('p').text().trim() || '',
          url,
          imageUrl: img,
          category,
          date: dateStr,
          game: 'Sword of Justice'
        });
      });
      return items;
    } catch (error) {
      console.error('[Axios Error] Sword of Justice:', error.message);
      return [];
    }
}

async function scrapeNghichThuyHan() {
    try {
      const axios = require('axios');
      const cheerio = require('cheerio');
      const res = await axios.get('https://nghichthuyhan.vnggames.com/news/danh-sach.1.html');
      const $ = cheerio.load(res.data);
      const items = [];
      
      $('ul li').each((i, li) => {
        const a = $(li).find('a');
        if (!a.length) return;
        
        const title = a.attr('title') || a.find('.news-title').text().trim() || '';
        let url = a.attr('href');
        if (url && url.startsWith('//')) {
          url = 'https:' + url;
        } else if (url && url.startsWith('/')) {
          url = 'https://nghichthuyhan.vnggames.com' + url;
        }
        
        const img = a.find('.img-container img').attr('src') || '';
        const category = $(li).find('.news-cate .text').text().trim() || 'Tin Tức';
        
        const timeText = $(li).find('.news-cate .time').text().trim() || '';
        let date = '';
        if (timeText) {
          // format: DD/MM/YYYY
          const parts = timeText.split('/');
          if (parts.length === 3) {
            date = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        
        if (date) {
            items.push({
              title,
              description: '',
              url,
              imageUrl: img,
              category,
              date,
              game: 'Nghịch Thủy Hàn'
            });
        }
      });
      return items;
    } catch (error) {
      console.error('[Axios Error] Nghich Thuy Han:', error.message);
      return [];
    }
}

/**
 * Fetches and parses news from both games
 */
async function fetchNews() {
  try {
    const extractedArticles = [];
    
    // Scrape Sword of Justice
    try {
        const sojArticles = await scrapeSwordOfJustice();
        extractedArticles.push(...sojArticles);
    } catch (e) {
        console.error('[Scraper Error]: Sword of Justice failed', e.message);
    }
    
    // Scrape Nghich Thuy Han
    try {
        const nthArticles = await scrapeNghichThuyHan();
        extractedArticles.push(...nthArticles);
    } catch (e) {
        console.error('[Scraper Error]: Nghich Thuy Han failed', e.message);
    }

    // We want all articles from the 5 most recent days, 
    // including multiple articles posted on the same day.
    const uniqueDates = [...new Set(extractedArticles.map(a => a.date).filter(Boolean))];
    uniqueDates.sort((a, b) => b.localeCompare(a));
    const top5Dates = uniqueDates.slice(0, 5);
    
    let filteredArticles = extractedArticles.filter(a => top5Dates.includes(a.date));
    filteredArticles.sort((a, b) => b.date.localeCompare(a.date)); // Newest first

    // Translate to Vietnamese (only for Sword of Justice)
    for (const article of filteredArticles) {
      if (article.game === 'Sword of Justice') {
          try {
            const translatedTitle = await translate(article.title, { to: 'vi' });
            article.title = translatedTitle.text;
            
            if (article.category.toLowerCase().includes('announcement')) {
              article.category = 'Thông báo';
            } else {
              article.category = 'Tin tức';
            }
          } catch (err) {
            console.error('[Translation Error]:', err.message);
          }
      }
    }

    return filteredArticles;
  } catch (error) {
    console.error('[Scraper Error]: Failed to fetch news:', error.message);
    throw error;
  }
}

module.exports = {
  fetchNews
};
