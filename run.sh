#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Windscribe VPN Tester — Easy Setup & Run Script (macOS/Linux)
# ─────────────────────────────────────────────────────────────

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

print_header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Windscribe VPN Tester — Setup & Run${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
  echo ""
}

check_ok() {
  echo -e "  ${GREEN}✔${NC} $1"
}

check_fail() {
  echo -e "  ${RED}✘${NC} $1"
}

check_warn() {
  echo -e "  ${YELLOW}!${NC} $1"
}

# ─── Check Node.js ──────────────────────────────────────────
check_node() {
  if ! command -v node &>/dev/null; then
    check_fail "Node.js is not installed."
    echo ""
    echo -e "  ${YELLOW}Please install Node.js (version 18 or higher):${NC}"
    echo "    → https://nodejs.org/"
    echo ""
    if command -v brew &>/dev/null; then
      echo -e "  Or install via Homebrew:"
      echo "    brew install node"
      echo ""
    fi
    exit 1
  fi

  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    check_fail "Node.js version is too old (v$(node -v)). Version 18+ is required."
    echo ""
    echo -e "  ${YELLOW}Please update Node.js:${NC}"
    echo "    → https://nodejs.org/"
    exit 1
  fi

  check_ok "Node.js $(node -v)"
}

# ─── Check Windscribe CLI ──────────────────────────────────
check_windscribe() {
  if ! command -v windscribe-cli &>/dev/null; then
    check_fail "windscribe-cli not found."
    echo ""
    echo -e "  ${YELLOW}Please install Windscribe:${NC}"
    echo "    → https://windscribe.com/download"
    echo ""
    echo "  After installing, you may need to add it to your PATH:"
    echo '    export PATH="/Applications/Windscribe.app/Contents/Helpers:$PATH"'
    echo ""
    echo "  Or create a symlink:"
    echo "    sudo ln -s /Applications/Windscribe.app/Contents/Helpers/windscribe-cli /usr/local/bin/windscribe-cli"
    echo ""
    exit 1
  fi

  if ! windscribe-cli status &>/dev/null; then
    check_fail "Windscribe app is not running."
    echo ""
    echo -e "  ${YELLOW}Please open the Windscribe app and log in, then try again.${NC}"
    echo ""
    exit 1
  fi

  check_ok "Windscribe CLI"
}

# ─── Install dependencies ──────────────────────────────────
install_deps() {
  if [ ! -d "node_modules" ]; then
    check_warn "Installing dependencies..."
    npm install --silent
    check_ok "Dependencies installed"
  else
    check_ok "Dependencies already installed"
  fi
}

# ─── Show menu ──────────────────────────────────────────────
show_menu() {
  echo ""
  echo -e "${BOLD}  How would you like to run the tests?${NC}"
  echo ""
  echo "  1) Run all tests (every location, every protocol)"
  echo "  2) Quick test — WireGuard only, port 443"
  echo "  3) Test a specific continent"
  echo "  4) Test a specific protocol"
  echo "  5) Custom options"
  echo "  6) Show help"
  echo "  0) Exit"
  echo ""
  echo -ne "  ${CYAN}Enter your choice [0-6]:${NC} "
  read -r choice
  echo ""
}

# ─── Continent picker ──────────────────────────────────────
pick_continent() {
  echo -e "  ${BOLD}Select a continent:${NC}"
  echo ""
  echo "  1) Asia"
  echo "  2) Europe"
  echo "  3) North America"
  echo "  4) South America"
  echo "  5) Oceania"
  echo "  6) Africa"
  echo ""
  echo -ne "  ${CYAN}Enter your choice [1-6]:${NC} "
  read -r c
  case $c in
    1) CONTINENT="asia" ;;
    2) CONTINENT="europe" ;;
    3) CONTINENT="north america" ;;
    4) CONTINENT="south america" ;;
    5) CONTINENT="oceania" ;;
    6) CONTINENT="africa" ;;
    *) echo -e "  ${RED}Invalid choice.${NC}"; exit 1 ;;
  esac
}

# ─── Protocol picker ──────────────────────────────────────
pick_protocol() {
  echo -e "  ${BOLD}Select a protocol:${NC}"
  echo ""
  echo "  1) WireGuard"
  echo "  2) UDP (OpenVPN)"
  echo "  3) TCP (OpenVPN)"
  echo "  4) Stealth"
  echo "  5) WStunnel"
  echo "  6) IKEv2"
  echo ""
  echo -ne "  ${CYAN}Enter your choice [1-6]:${NC} "
  read -r p
  case $p in
    1) PROTOCOL="wireguard" ;;
    2) PROTOCOL="udp" ;;
    3) PROTOCOL="tcp" ;;
    4) PROTOCOL="stealth" ;;
    5) PROTOCOL="wstunnel" ;;
    6) PROTOCOL="ikev2" ;;
    *) echo -e "  ${RED}Invalid choice.${NC}"; exit 1 ;;
  esac
}

# ─── Run tester ────────────────────────────────────────────
run_tester() {
  echo -e "${CYAN}─────────────────────────────────────────────────────────${NC}"
  echo -e "  ${BOLD}Running:${NC} node windscribe-tester.mjs $*"
  echo -e "${CYAN}─────────────────────────────────────────────────────────${NC}"
  echo ""
  node windscribe-tester.mjs "$@"
}

# ─── Main ──────────────────────────────────────────────────
print_header

echo -e "  ${BOLD}Checking prerequisites...${NC}"
echo ""
check_node
check_windscribe
install_deps

show_menu

case $choice in
  1)
    run_tester
    ;;
  2)
    run_tester --protocols wireguard --ports 443
    ;;
  3)
    pick_continent
    run_tester --continents "$CONTINENT"
    ;;
  4)
    pick_protocol
    run_tester --protocols "$PROTOCOL"
    ;;
  5)
    echo -ne "  ${CYAN}Enter custom options (e.g. --protocols wireguard --ports 80,443):${NC} "
    read -r custom_opts
    run_tester $custom_opts
    ;;
  6)
    run_tester --help
    ;;
  0)
    echo "  Bye!"
    exit 0
    ;;
  *)
    echo -e "  ${RED}Invalid choice.${NC}"
    exit 1
    ;;
esac
