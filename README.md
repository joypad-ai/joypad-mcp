# joypad-mcp

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for **[Joypad AI](https://joypad.ai)** — query controller compatibility, find adapters, look up controllers, and search build guides.

Use any controller on any console. 🎮

## What It Does

This MCP server gives AI assistants access to Joypad's controller and adapter compatibility data:

- **48 controllers** — Nintendo, Sony, Microsoft, 8BitDo, Sega, and more
- **21 adapter types** — USB, Bluetooth, and native adapters for retro and modern consoles
- **Compatibility checking** — find out if your controller works with a target platform
- **Build guides** — search for DIY adapter build instructions

## Installation

### npx (no install needed)

```bash
npx joypad-mcp
```

### Global install

```bash
npm install -g joypad-mcp
joypad-mcp
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "joypad": {
      "command": "npx",
      "args": ["-y", "joypad-mcp"]
    }
  }
}
```

### Other MCP Clients

Any MCP client that supports stdio transport can connect:

```json
{
  "command": "npx",
  "args": ["-y", "joypad-mcp"]
}
```

Or if installed globally:

```json
{
  "command": "joypad-mcp"
}
```

## Tools

### `compatibility_check`

Check if a specific controller works with a target platform.

```
Input: { controller: "DualSense", platform: "GameCube" }
→ Returns compatible adapters, difficulty, and guide links
```

### `find_adapter`

Find adapters by input type and target platform.

```
Input: { inputType: "USB", outputPlatform: "N64" }
→ Returns matching adapters with cost, difficulty, and required hardware
```

### `controller_info`

Look up detailed info about a controller (fuzzy search).

```
Input: { query: "xbox elite" }
→ Returns full controller details including protocol, era, supported apps
```

### `list_controllers`

List and filter controllers by manufacturer, platform, era, or connection type.

```
Input: { manufacturer: "Nintendo", era: "retro" }
→ Returns filtered list of controllers
```

### `search_guides`

Search adapter build guides by keyword.

```
Input: { query: "genesis" }
→ Returns matching guides with difficulty and board requirements
```

## Resources

### `joypad://about`

Overview of Joypad AI — what it does, supported platforms, and links.

### `joypad://compatibility-matrix`

Full controller × platform compatibility matrix showing which controllers work with which consoles.

## Development

```bash
git clone https://github.com/joypad-ai/joypad-mcp.git
cd joypad-mcp
npm install
npm run build
npm start
```

## Links

- 🌐 [joypad.ai](https://joypad.ai)
- 🐙 [GitHub](https://github.com/joypad-ai)
- 💬 [Discord](https://discord.gg/joypad)
- 🔧 [Firmware (Joypad OS)](https://github.com/joypad-ai/joypad-os)

## License

MIT
