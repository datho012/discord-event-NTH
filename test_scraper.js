const axios = require('axios');
const cheerio = require('cheerio');

axios.get('https://www.swordofjustice.com/sea/news/').then(r => {
  const $ = cheerio.load(r.data);
  $('.news-list li').each((i, el) => {
    const a = $(el).find('a');
    console.log(a.attr('href'));
  });
}).catch(e => console.log(e.message));
