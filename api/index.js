const path = require('path');
const fs = require('fs');
const Module = require('module');

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres.rjvbgofzsfescnfohzgu:Patr10.senal61@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = "postgresql://postgres.rjvbgofzsfescnfohzgu:Patr10.senal61@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";
}
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = "https://rjvbgofzsfescnfohzgu.supabase.co";
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "super_secret_jwt_key_trivia_2026_production";
}

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
