const { parseString } = require('xml2js');
const cheerio = require('cheerio');
const util = require('util');

const parseStringPromise = util.promisify(parseString);

const GoodreadsModel = require('../models/goodreads-model');
const appConfig = require('./app-config');
const api = require('./api');

exports.save = (userId) => {
  return appConfig
    .get(userId)
    .then(booksRead)
    .then(getTopBooks)
    .then((data) => {
      const doc = new GoodreadsModel({ ...data, userId });
      return doc.save();
    });
};

function booksRead(config) {
  const id = config && config.goodreads && config.goodreads.id;
  const key = config && config.goodreads && config.goodreads.key;

  if (!id || !key) {
    return Promise.reject('Missing goodreads config');
  }

  const url = `https://www.goodreads.com/review/list/${id}?format=xml&key=${key}&sort=shelves&v=2&shelf=read&sort=date_read&per_page=200`;

  return api
    .get({ url })
    .then(parseStringPromise)
    .then((result) => {
      const promises = [];
      const books = result.GoodreadsResponse.reviews[0].review;

      for (let i = 0; i < books.length; i += 1) {
        const book = books[i].book[0];
        // Replace m with l to view large photo
        // ex. 1405392994m --> 1405392994l
        // http://d2arxad8u2l0g7.cloudfront.net/books/1405392994m/18595312.jpg
        let img = book.image_url[0];
        const imgSplit = img.split('/');

        if (imgSplit.length === 6) {
          imgSplit[4] = imgSplit[4].replace('m', 'l');
          img = imgSplit.join('/');
        }

        const ret = {
          img,
          title: book.title[0],
          pages: book.num_pages[0],
          link: book.link[0],
          dateRead: books[i].read_at && new Date(books[i].read_at[0]),
          rating: books[i].rating && parseInt(books[i].rating[0], 10),
          // NOTE: Currently not being used, but could be useful in the future
          readCount: books[i].read_count && parseInt(books[i].read_count[0], 10),
        };

        promises.push(getPhoto(ret));
      }

      return Promise.all(promises);
    })
    .then((data) => {
      return {
        booksRead: data,
        config,
      };
    });
}

/* If image not returned from Goodreads API, get the image from the webpage */
function getPhoto(data) {
  // Need to get the image from Goodreads url
  if (data.img.indexOf('nophoto') > 0) {
    const config = {
      url: data.link,
      headers: {
        ACCEPT: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      },
    };

    return api.get(config).then((html) => {
      const $ = cheerio.load(html);
      const src = $('#coverImage').attr('src');
      // eslint-disable-next-line no-param-reassign
      if (src) data.img = src;
      return data;
    });
  }

  Promise.resolve(data); // Image url from API is fine, do nothing
}

function getTopBooks(params) {
  const id = params && params.config && params.config.goodreads && params.config.goodreads.id;
  const key = params && params.config && params.config.goodreads && params.config.goodreads.key;

  if (!id || !key) {
    return Promise.reject('Missing goodreads config');
  }

  const url = `https://www.goodreads.com/review/list/${id}?format=xml&key=${key}&sort=shelves&v=2&shelf=read&sort=date_read&per_page=200`;

  return api
    .get({ url })
    .then(parseStringPromise)
    .then((result) => {
      const topBooks = [];
      const books = result.GoodreadsResponse.reviews[0].review;

      for (let i = 0; i < books.length; i += 1) {
        // Save 6 of the most recently read books rated 5 stars
        if (topBooks.length < 6 && books[i].rating[0] === 5) {
          // Replace m with l to view large photo
          // ex. 1405392994m --> 1405392994l
          // http://d2arxad8u2l0g7.cloudfront.net/books/1405392994m/18595312.jpg
          let img = books[i].book[0].image_url[0];
          const imgSplit = img.split('/');
          if (imgSplit.length === 6) {
            imgSplit[4] = imgSplit[4].replace('m', 'l');
            img = imgSplit.join('/');
          }

          topBooks.push({
            title: books[i].book[0].title[0],
            link: books[i].book[0].link[0],
            img,
          });
        }
      }

      const saveData = {
        booksRead: params.booksRead,
        topBooks,
      };

      return saveData;
    });
}
