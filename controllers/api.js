var moment = require('moment');

var lastFM = require('../models/last-fm-schema');
var goodreads = require('../models/goodreads-schema');
var github = require('../models/github-schema');
var trakt = require('../models/trakt-schema');
var states = require('../nodejs/states');
var fuelly = require('../models/fuelly-schema');

exports.getLastFM = function(req, res, next) {
  lastFM.findOne({}, {}, { sort: { '_id' : -1 } }, function(err, data) {
    if (err) return next(err);
    res.json(data);
  });
};

exports.getGoodreads = function(req, res, next) {
  goodreads.findOne({}, {}, { sort: { '_id' : -1 } }, function(err, data) {
    if (err) return next(err);
    res.json(data);
  });
};

exports.getGithub = function(req, res, next) {
  github.findOne({}, {}, { sort: { '_id' : -1 } }, function(err, data) {
    if (err) return next(err);
    res.json(data);
  });
};

exports.getTrakt = function(req, res, next) {
  trakt.findOne({}, {}, { sort: { '_id' : -1 } }).lean().exec(function (err, data){
    if (err) return next(err);
    if(!data) return next("No data");

    var startDate = moment('2016-10-02');
    var now = moment();
    var totalDays = now.diff(startDate, 'days');
    data.totalDays = totalDays;

    res.json(data);
  });
};

exports.getStates = function(req, res) {
  states.get().then(function(data){
    res.json(data);
  }).catch(function(err){
    console.log("Get states error", err);
    res.sendStatus(500);
  });
};

exports.getFuelly = function(req, res, next) {
  if(!req.query.start || !req.query.end) return next('Start and end time parameters required');
  if(!req.query.name) return next('Vehicle name required');

  var by = {
    "name": req.query.name,
    "fillTime" : { "$gte": req.query.start, "$lte": req.query.end }
  };

  fuelly.find(by, {}, { sort: { '_id' : -1 } }).lean().exec(function (err, data){
    if (err) return next(err);
    res.json(data);
  });
};

exports.getFuellyAvg = function(req, res, next) {
  if(!req.query.name) return next('Vehicle name required');

  // Get all data from the current year
  var year = moment().year();
  var start = moment('01/01/' + year, 'MM-DD-YYYY');
  var end = moment('01/01/' + (year + 1), 'MM-DD-YYYY');

  var by = {
    "name": req.query.name,
    "fillTime" : { "$gte": start, "$lte": end }
  };

  fuelly.find(by, {}, { sort: { '_id' : -1 } }).lean().exec(function (err, data){
    if (err) return next(err);

    var retData = {
      totalGallons: 0,
      totalMiles: 0,
      totalPrice: 0,
      totalDays: moment().diff('01/01/' + year, 'days')
    };

    for(var i=0, x=data.length; i<x; i++){
      retData.totalGallons += data[i].gallons;
      retData.totalMiles += data[i].miles;
      retData.totalPrice += (data[i].price * data[i].gallons);
    }

    retData.daysPerBarrel = parseInt(1 / ( (retData.totalGallons / 42) / retData.totalDays ));
    retData.totalPrice = retData.totalPrice.toFixed(2);
    res.json(retData);
  });
};
