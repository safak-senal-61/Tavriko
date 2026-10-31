const path = require('path');
const fs = require('fs');
const Module = require('module');

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

let createApp;
try {
  createApp = require('../server/dist/server').createApp;
} catch (e) {
  try {
    createApp = require('./server/dist/server').createApp;
  } catch (e2) {
    createApp = require(path.join(__dirname, '..', 'server', 'dist', 'server')).createApp;
  }
}

const { app } = createApp();

module.exports = app;
