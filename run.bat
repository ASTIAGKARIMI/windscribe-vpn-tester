@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: ─────────────────────────────────────────────────────────────
::  Windscribe VPN Tester — Easy Setup & Run Script (Windows)
:: ─────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo ═══════════════════════════════════════════════════════
echo   Windscribe VPN Tester — Setup ^& Run
echo ═══════════════════════════════════════════════════════
echo.
echo   Checking prerequisites...
echo.

:: ─── Check Node.js ──────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [X] Node.js is not installed.
    echo.
    echo   Please install Node.js ^(version 18 or higher^):
    echo     https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
for /f "tokens=2 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
node -e "process.exit(parseInt(process.version.slice(1)) < 18 ? 1 : 0)"
if %ERRORLEVEL% neq 0 (
    echo   [X] Node.js version is too old. Version 18+ is required.
    echo.
    echo   Please update Node.js:
    echo     https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do echo   [OK] Node.js %%v

:: ─── Check Windscribe CLI ──────────────────────────────────
where windscribe-cli.exe >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [X] windscribe-cli.exe not found.
    echo.
    echo   Please install Windscribe:
    echo     https://windscribe.com/download
    echo.
    echo   If already installed, add it to your PATH:
    echo     Default location: C:\Program Files\Windscribe\
    echo.
    pause
    exit /b 1
)

windscribe-cli.exe status >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [X] Windscribe app is not running.
    echo.
    echo   Please open the Windscribe app and log in, then try again.
    echo.
    pause
    exit /b 1
)

echo   [OK] Windscribe CLI

:: ─── Install dependencies ──────────────────────────────────
if not exist "node_modules" (
    echo   [..] Installing dependencies...
    npm install --silent
    echo   [OK] Dependencies installed
) else (
    echo   [OK] Dependencies already installed
)

:: ─── Show menu ──────────────────────────────────────────────
echo.
echo   How would you like to run the tests?
echo.
echo   1^) Run all tests ^(every location, every protocol^)
echo   2^) Quick test — WireGuard only, port 443
echo   3^) Test a specific continent
echo   4^) Test a specific protocol
echo   5^) Custom options
echo   6^) Show help
echo   0^) Exit
echo.
set /p CHOICE="  Enter your choice [0-6]: "
echo.

if "%CHOICE%"=="1" goto RUN_ALL
if "%CHOICE%"=="2" goto RUN_QUICK
if "%CHOICE%"=="3" goto PICK_CONTINENT
if "%CHOICE%"=="4" goto PICK_PROTOCOL
if "%CHOICE%"=="5" goto CUSTOM
if "%CHOICE%"=="6" goto SHOW_HELP
if "%CHOICE%"=="0" goto EXIT
echo   Invalid choice.
pause
exit /b 1

:RUN_ALL
echo ─────────────────────────────────────────────────────────
echo   Running: node windscribe-tester.mjs
echo ─────────────────────────────────────────────────────────
echo.
node windscribe-tester.mjs
goto DONE

:RUN_QUICK
echo ─────────────────────────────────────────────────────────
echo   Running: node windscribe-tester.mjs --protocols wireguard --ports 443
echo ─────────────────────────────────────────────────────────
echo.
node windscribe-tester.mjs --protocols wireguard --ports 443
goto DONE

:PICK_CONTINENT
echo   Select a continent:
echo.
echo   1^) Asia
echo   2^) Europe
echo   3^) North America
echo   4^) South America
echo   5^) Oceania
echo   6^) Africa
echo.
set /p CONT="  Enter your choice [1-6]: "
if "%CONT%"=="1" set CONTINENT=asia
if "%CONT%"=="2" set CONTINENT=europe
if "%CONT%"=="3" set CONTINENT="north america"
if "%CONT%"=="4" set CONTINENT="south america"
if "%CONT%"=="5" set CONTINENT=oceania
if "%CONT%"=="6" set CONTINENT=africa
echo.
echo ─────────────────────────────────────────────────────────
echo   Running: node windscribe-tester.mjs --continents %CONTINENT%
echo ─────────────────────────────────────────────────────────
echo.
node windscribe-tester.mjs --continents %CONTINENT%
goto DONE

:PICK_PROTOCOL
echo   Select a protocol:
echo.
echo   1^) WireGuard
echo   2^) UDP ^(OpenVPN^)
echo   3^) TCP ^(OpenVPN^)
echo   4^) Stealth
echo   5^) WStunnel
echo   6^) IKEv2
echo.
set /p PROTO="  Enter your choice [1-6]: "
if "%PROTO%"=="1" set PROTOCOL=wireguard
if "%PROTO%"=="2" set PROTOCOL=udp
if "%PROTO%"=="3" set PROTOCOL=tcp
if "%PROTO%"=="4" set PROTOCOL=stealth
if "%PROTO%"=="5" set PROTOCOL=wstunnel
if "%PROTO%"=="6" set PROTOCOL=ikev2
echo.
echo ─────────────────────────────────────────────────────────
echo   Running: node windscribe-tester.mjs --protocols %PROTOCOL%
echo ─────────────────────────────────────────────────────────
echo.
node windscribe-tester.mjs --protocols %PROTOCOL%
goto DONE

:CUSTOM
set /p CUSTOM_OPTS="  Enter custom options (e.g. --protocols wireguard --ports 80,443): "
echo.
echo ─────────────────────────────────────────────────────────
echo   Running: node windscribe-tester.mjs %CUSTOM_OPTS%
echo ─────────────────────────────────────────────────────────
echo.
node windscribe-tester.mjs %CUSTOM_OPTS%
goto DONE

:SHOW_HELP
node windscribe-tester.mjs --help
goto DONE

:EXIT
echo   Bye!
exit /b 0

:DONE
echo.
pause
