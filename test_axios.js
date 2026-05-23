const axios = require('axios');
const cheerio = require('cheerio');
axios.get('https://www.swordofjustice.com/sea/news/').then(res => {
  const $ = cheerio.load(res.data);
  console.log($('.news-list li').first().html());
});
