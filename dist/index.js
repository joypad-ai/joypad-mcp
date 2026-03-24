#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import controllers from "./data/controllers.json" with { type: "json" };
import adapters from "./data/adapters.json" with { type: "json" };
const allControllers = controllers;
const allAdapters = adapters;
// ── Helpers ──────────────────────────────────────────────────────────
function fuzzyMatch(haystack, needle) {
    const h = haystack.toLowerCase();
    const n = needle.toLowerCase();
    return h.includes(n) || n.includes(h);
}
function findController(query) {
    const q = query.toLowerCase();
    return (allControllers.find((c) => c.slug === q) ||
        allControllers.find((c) => c.name.toLowerCase() === q) ||
        allControllers.find((c) => c.name.toLowerCase().includes(q) ||
            c.slug.includes(q) ||
            c.manufacturer.toLowerCase().includes(q)));
}
function controllerMatchesAdapter(controller, adapter) {
    // Check if controller's connection type maps to adapter's input type
    const conn = controller.connectionType.toLowerCase();
    const inputType = adapter.inputType.toLowerCase();
    if (inputType === "usb" && (conn === "usb" || conn === "wireless"))
        return true;
    if (inputType === "bt" && conn === "bluetooth")
        return true;
    if (inputType === "native" && conn === "proprietary")
        return true;
    // Also check protocol match
    const proto = controller.protocol.toLowerCase();
    if (adapter.inputProtocols.some((p) => p.toLowerCase() === proto))
        return true;
    // Check supportedApps for direct adapter slug match
    if (controller.supportedApps.split(",").includes(adapter.slug))
        return true;
    return false;
}
function platformNormalize(platform) {
    const p = platform.toLowerCase().trim();
    const map = {
        pc: "PC",
        computer: "PC",
        windows: "PC",
        mac: "PC",
        linux: "PC",
        gamecube: "GameCube",
        gc: "GameCube",
        n64: "N64",
        "nintendo 64": "N64",
        snes: "SNES",
        "super nintendo": "SNES",
        nes: "NES",
        "nintendo entertainment system": "NES",
        genesis: "Genesis",
        "mega drive": "Genesis",
        "sega genesis": "Genesis",
        saturn: "Saturn",
        "sega saturn": "Saturn",
        dreamcast: "Dreamcast",
        "sega dreamcast": "Dreamcast",
        pcengine: "PCEngine",
        "pc engine": "PCEngine",
        "turbografx-16": "PCEngine",
        turbografx: "PCEngine",
        "3do": "3DO",
        nuon: "Nuon",
        neogeo: "NeoGeo",
        "neo geo": "NeoGeo",
    };
    return map[p] || platform;
}
// ── MCP Server ───────────────────────────────────────────────────────
const server = new McpServer({
    name: "joypad-mcp",
    version: "1.0.0",
});
// ── Tool: compatibility_check ────────────────────────────────────────
server.tool("compatibility_check", "Check if a specific controller is compatible with a target platform via Joypad adapters", {
    controller: z.string().describe("Controller name, slug, or search term"),
    platform: z
        .string()
        .describe("Target platform (PC, GameCube, N64, SNES, NES, Genesis, Saturn, Dreamcast, PCEngine, 3DO, Nuon, NeoGeo)"),
}, async ({ controller: query, platform }) => {
    const ctrl = findController(query);
    if (!ctrl) {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        compatible: false,
                        adapters: [],
                        notes: `Controller "${query}" not found. Try a different search term or use list_controllers to browse.`,
                    }),
                },
            ],
        };
    }
    const normalizedPlatform = platformNormalize(platform);
    const matchingAdapters = allAdapters.filter((a) => a.outputPlatform === normalizedPlatform &&
        controllerMatchesAdapter(ctrl, a));
    const compatible = matchingAdapters.length > 0;
    const notes = compatible
        ? `${ctrl.name} (${ctrl.connectionType}, ${ctrl.protocol}) can connect to ${normalizedPlatform} via ${matchingAdapters.length} adapter(s).`
        : `No compatible adapter found for ${ctrl.name} (${ctrl.connectionType}) → ${normalizedPlatform}. The controller's connection type may not match any available adapter input.`;
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    compatible,
                    controller: {
                        name: ctrl.name,
                        manufacturer: ctrl.manufacturer,
                        connectionType: ctrl.connectionType,
                        protocol: ctrl.protocol,
                    },
                    adapters: matchingAdapters.map((a) => ({
                        name: a.name,
                        slug: a.slug,
                        description: a.description,
                        difficulty: a.difficulty,
                        shopUrl: a.shopUrl,
                        guideUrl: a.guideUrl,
                    })),
                    notes,
                }),
            },
        ],
    };
});
// ── Tool: find_adapter ───────────────────────────────────────────────
server.tool("find_adapter", "Find adapters by input type and target output platform", {
    inputType: z
        .string()
        .describe("Input connection type: USB, BT (Bluetooth), or Native"),
    outputPlatform: z
        .string()
        .describe("Target output platform (PC, GameCube, N64, SNES, NES, Genesis, Saturn, Dreamcast, PCEngine, 3DO, Nuon, NeoGeo)"),
}, async ({ inputType, outputPlatform }) => {
    const normalizedPlatform = platformNormalize(outputPlatform);
    const normalizedInput = inputType.toUpperCase().trim();
    const inputMap = {
        USB: "USB",
        BLUETOOTH: "BT",
        BT: "BT",
        NATIVE: "Native",
        PROPRIETARY: "Native",
    };
    const mappedInput = inputMap[normalizedInput] || normalizedInput;
    const matches = allAdapters.filter((a) => a.inputType.toUpperCase() === mappedInput.toUpperCase() &&
        a.outputPlatform === normalizedPlatform);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    query: { inputType: mappedInput, outputPlatform: normalizedPlatform },
                    adapters: matches.map((a) => ({
                        name: a.name,
                        slug: a.slug,
                        description: a.description,
                        difficulty: a.difficulty,
                        diyPartsCost: `~$${a.diyPartsCost}`,
                        shopUrl: a.shopUrl,
                        guideUrl: a.guideUrl,
                        requiredBoard: a.requiredBoard,
                    })),
                    total: matches.length,
                }),
            },
        ],
    };
});
// ── Tool: controller_info ────────────────────────────────────────────
server.tool("controller_info", "Look up detailed information about a specific controller by name, slug, or manufacturer", {
    query: z
        .string()
        .describe("Controller name, slug, or manufacturer to search for"),
}, async ({ query }) => {
    const ctrl = findController(query);
    if (!ctrl) {
        // Try broader fuzzy search
        const matches = allControllers.filter((c) => fuzzyMatch(c.name, query) ||
            fuzzyMatch(c.manufacturer, query) ||
            fuzzyMatch(c.slug, query));
        if (matches.length > 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            exactMatch: false,
                            suggestions: matches.slice(0, 5).map((c) => ({
                                name: c.name,
                                slug: c.slug,
                                manufacturer: c.manufacturer,
                            })),
                            message: `No exact match for "${query}". Did you mean one of these?`,
                        }),
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        error: `No controller found matching "${query}". Use list_controllers to browse all available controllers.`,
                    }),
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    controller: {
                        name: ctrl.name,
                        slug: ctrl.slug,
                        manufacturer: ctrl.manufacturer,
                        year: ctrl.year,
                        description: ctrl.description,
                        connectionType: ctrl.connectionType,
                        protocol: ctrl.protocol,
                        inputSupported: ctrl.inputSupported,
                        outputSupported: ctrl.outputSupported,
                        supportedApps: ctrl.supportedApps.split(","),
                        platform: ctrl.platform,
                        era: ctrl.era,
                    },
                }),
            },
        ],
    };
});
// ── Tool: list_controllers ───────────────────────────────────────────
server.tool("list_controllers", "List and filter controllers by manufacturer, platform, era, or connection type", {
    manufacturer: z
        .string()
        .optional()
        .describe("Filter by manufacturer (Nintendo, Sony, Microsoft, 8BitDo, Sega, etc.)"),
    platform: z
        .string()
        .optional()
        .describe("Filter by platform (Nintendo, PlayStation, Xbox, PC, Multi, Sega)"),
    era: z
        .string()
        .optional()
        .describe("Filter by era: vintage, retro, or modern"),
    connectionType: z
        .string()
        .optional()
        .describe("Filter by connection: USB, Bluetooth, Wireless, Proprietary"),
    limit: z
        .number()
        .optional()
        .describe("Maximum number of results to return (default: 20)"),
}, async ({ manufacturer, platform, era, connectionType, limit }) => {
    let results = [...allControllers];
    if (manufacturer) {
        const m = manufacturer.toLowerCase();
        results = results.filter((c) => c.manufacturer.toLowerCase().includes(m));
    }
    if (platform) {
        const p = platform.toLowerCase();
        results = results.filter((c) => c.platform.toLowerCase().includes(p));
    }
    if (era) {
        const e = era.toLowerCase();
        results = results.filter((c) => c.era.toLowerCase() === e);
    }
    if (connectionType) {
        const ct = connectionType.toLowerCase();
        results = results.filter((c) => c.connectionType.toLowerCase().includes(ct));
    }
    const total = results.length;
    const maxResults = limit ?? 20;
    results = results.slice(0, maxResults);
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    controllers: results.map((c) => ({
                        name: c.name,
                        slug: c.slug,
                        manufacturer: c.manufacturer,
                        year: c.year,
                        connectionType: c.connectionType,
                        protocol: c.protocol,
                        era: c.era,
                        platform: c.platform,
                    })),
                    returned: results.length,
                    total,
                }),
            },
        ],
    };
});
// ── Tool: search_guides ──────────────────────────────────────────────
server.tool("search_guides", "Search adapter build guides by name, description, input/output type, or platform", {
    query: z
        .string()
        .describe("Search term — adapter name, platform, input/output type, etc."),
}, async ({ query }) => {
    const q = query.toLowerCase();
    const matches = allAdapters.filter((a) => a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.inputType.toLowerCase().includes(q) ||
        a.outputType.toLowerCase().includes(q) ||
        a.outputPlatform.toLowerCase().includes(q));
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    guides: matches.map((a) => ({
                        adapterName: a.name,
                        slug: a.slug,
                        description: a.description,
                        difficulty: a.difficulty,
                        requiredBoard: a.requiredBoard,
                        guideUrl: a.guideUrl,
                    })),
                    total: matches.length,
                }),
            },
        ],
    };
});
// ── Resource: joypad://about ─────────────────────────────────────────
server.resource("about", "joypad://about", async (uri) => ({
    contents: [
        {
            uri: uri.href,
            mimeType: "text/plain",
            text: `# Joypad AI

> Use any controller on any console.

Joypad is an open-source project that builds RP2040-based controller adapters,
letting you use modern USB and Bluetooth controllers on retro consoles — and
retro controllers on modern PCs.

## What We Do
- **Controller Adapters**: DIY and pre-built adapters powered by Raspberry Pi Pico
- **Firmware**: Open-source firmware (Joypad OS) for RP2040-based boards
- **Compatibility Database**: Extensive controller and adapter compatibility data
- **Build Guides**: Step-by-step guides for building your own adapters

## Supported Platforms
GameCube, N64, SNES, NES, Sega Genesis, Sega Saturn, PC Engine/TurboGrafx-16,
Dreamcast, 3DO, Nuon, Neo Geo, PlayStation (PS1/PS2), and PC.

## Supported Controllers
48+ controllers from Nintendo, Sony, Microsoft, 8BitDo, Sega, Logitech,
Razer, Hori, GuliKit, and more — plus generic HID and XInput devices.

## Links
- Website: https://joypad.ai
- GitHub: https://github.com/joypad-ai
- Firmware: https://github.com/joypad-ai/joypad-os
- Discord: https://discord.gg/joypad`,
        },
    ],
}));
// ── Resource: joypad://compatibility-matrix ──────────────────────────
server.resource("compatibility-matrix", "joypad://compatibility-matrix", async (uri) => {
    const platforms = [
        ...new Set(allAdapters.map((a) => a.outputPlatform)),
    ].sort();
    let matrix = "# Controller × Platform Compatibility Matrix\n\n";
    matrix += `| Controller | Connection | ${platforms.join(" | ")} |\n`;
    matrix += `|------------|------------|${platforms.map(() => "---").join("|")}|\n`;
    for (const ctrl of allControllers) {
        const row = platforms.map((platform) => {
            const compatible = allAdapters.some((a) => a.outputPlatform === platform &&
                controllerMatchesAdapter(ctrl, a));
            return compatible ? "✅" : "—";
        });
        matrix += `| ${ctrl.name} | ${ctrl.connectionType} | ${row.join(" | ")} |\n`;
    }
    matrix += `\n_${allControllers.length} controllers × ${platforms.length} platforms. ${allAdapters.length} adapter types._\n`;
    return {
        contents: [
            {
                uri: uri.href,
                mimeType: "text/plain",
                text: matrix,
            },
        ],
    };
});
// ── Start Server ─────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map