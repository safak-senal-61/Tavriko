@echo off
echo ====================================================
echo Running All Test Suites for TriviaVerse Monorepo
echo ====================================================

echo.
echo [1/3] Testing @trivia/shared...
cd shared && call npm test
if %errorlevel% neq 0 (
    echo [ERROR] Shared tests failed!
    exit /b %errorlevel%
)
cd ..

echo.
echo [2/3] Testing @trivia/server (Engine, REST API, Concurrency)...
cd server && call npm test
if %errorlevel% neq 0 (
    echo [ERROR] Server tests failed!
    exit /b %errorlevel%
)
cd ..

echo.
echo [3/3] Testing @trivia/client (Theme, Store, Screen Flow)...
cd client && call npm test
if %errorlevel% neq 0 (
    echo [ERROR] Client tests failed!
    exit /b %errorlevel%
)
cd ..

echo.
echo ====================================================
echo [SUCCESS] ALL MONOREPO TEST SUITES PASSED CLEANLY!
echo ====================================================
