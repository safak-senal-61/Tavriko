const path = require('path');
const fs = require('fs');
const Module = require('module');
require('dotenv/config');

function findSharedPath() {
  const candidates = [
    path.join(__dirname, '..', 'shared', 'dist', 'index.js'),
    path.join(__dirname, 'shared', 'dist', 'index.js'),
    path.join(process.cwd(), 'shared', 'dist', 'index.js'),
    path.join(process.cwd(), '..', 'shared', 'dist', 'index.js'),
    path.join(__dirname, 'node_modules', '@trivia', 'shared', 'dist', 'index.js'),
    path.join(process.cwd(), 'node_modules', '@trivia', 'shared', 'dist', 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const resolvedShared = findSharedPath();

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === '@trivia/shared') {
    return resolvedShared;
  }
  return origResolve.call(this, request, parent, isMain, options);
};

let mainApp;
let jokerApp;
function loadApp(fast) {
  const filename = fast ? 'jokerApp' : 'server';
  // Keep the normal requires literal so Vercel traces their dependencies.
  if (fs.existsSync(path.join(__dirname, '..', 'server', 'dist', `${filename}.js`))) {
    return fast ? require('../server/dist/jokerApp').createJokerApp() : require('../server/dist/server').createApp().app;
  }
  if (fs.existsSync(path.join(__dirname, 'server', 'dist', `${filename}.js`))) {
    return fast ? require('./server/dist/jokerApp').createJokerApp() : require('./server/dist/server').createApp().app;
  }
  const entry = require(path.join(process.cwd(), 'server', 'dist', filename));
  return fast ? entry.createJokerApp() : entry.createApp().app;
}

module.exports = (req, res) => {
  const fast = /^\/api\/(?:questions\/practice\/joker|internal\/room-joker)\/?(?:\?|$)/i.test(req.url);
  if (fast) return (jokerApp ??= loadApp(true))(req, res);
  return (mainApp ??= loadApp(false))(req, res);
};
