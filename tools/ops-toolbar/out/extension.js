"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const TERMINAL_NAME = "TOT Ops";
class OpsItem extends vscode.TreeItem {
    labelText;
    constructor(labelText, commandId, tooltip) {
        super(labelText, vscode.TreeItemCollapsibleState.None);
        this.labelText = labelText;
        this.contextValue = "totOpsAction";
        this.tooltip = tooltip ?? labelText;
        if (commandId) {
            this.command = {
                title: labelText,
                command: commandId,
            };
        }
    }
}
class OpsTreeProvider {
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        return [
            new OpsItem("Deploy live", "totOps.deployLive", "Run deploy.bat"),
            new OpsItem("Wipe + deploy (all)", "totOps.wipeDeployAll", "Run wipe-live-data.bat <url> all"),
            new OpsItem("Wipe only (leaderboard)", "totOps.wipeLeaderboard", "Run wipe-live-data.bat <url> leaderboard --wipe-only"),
            new OpsItem("Wipe only (all)", "totOps.wipeAll", "Run wipe-live-data.bat <url> all --wipe-only"),
            new OpsItem("Open runbook", "totOps.openRunbook", "Open README runbook"),
        ];
    }
}
function activate(context) {
    const provider = new OpsTreeProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider("totOps.actionsView", provider));
    context.subscriptions.push(vscode.commands.registerCommand("totOps.deployLive", async () => {
        const cfg = readConfig();
        const shouldFast = await pickFastFlag(cfg.fastByDefault, "Deploy live");
        if (shouldFast === undefined) {
            return;
        }
        await runDeploy({ fast: shouldFast });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("totOps.wipeLeaderboard", async () => {
        const cfg = readConfig();
        await runWipe({
            liveUrl: cfg.liveUrl,
            scope: "leaderboard",
            wipeOnly: true,
            confirmDestructive: cfg.confirmDestructive,
            fast: false,
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("totOps.wipeAll", async () => {
        const cfg = readConfig();
        await runWipe({
            liveUrl: cfg.liveUrl,
            scope: "all",
            wipeOnly: true,
            confirmDestructive: cfg.confirmDestructive,
            fast: false,
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("totOps.wipeDeployAll", async () => {
        const cfg = readConfig();
        const shouldFast = await pickFastFlag(cfg.fastByDefault, "Wipe and deploy (all)");
        if (shouldFast === undefined) {
            return;
        }
        await runWipe({
            liveUrl: cfg.liveUrl,
            scope: "all",
            wipeOnly: false,
            confirmDestructive: cfg.confirmDestructive,
            fast: shouldFast,
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand("totOps.openRunbook", async () => {
        const root = workspaceRoot();
        if (!root) {
            void vscode.window.showWarningMessage("Open the Tales of Tileria workspace first.");
            return;
        }
        const readmeUri = vscode.Uri.file(path.join(root.fsPath, "README.md"));
        const doc = await vscode.workspace.openTextDocument(readmeUri);
        await vscode.window.showTextDocument(doc, { preview: false });
    }));
}
function deactivate() { }
function readConfig() {
    const config = vscode.workspace.getConfiguration("totOps");
    const defaultScope = config.get("defaultScope", "leaderboard");
    return {
        liveUrl: config.get("liveUrl", "https://tileria.saucegames.io"),
        defaultScope: defaultScope === "all" ? "all" : "leaderboard",
        confirmDestructive: config.get("confirmDestructive", true),
        fastByDefault: config.get("fastByDefault", false),
    };
}
function workspaceRoot() {
    return vscode.workspace.workspaceFolders?.[0]?.uri;
}
function getTerminal() {
    const existing = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME);
    if (existing) {
        return existing;
    }
    return vscode.window.createTerminal({
        name: TERMINAL_NAME,
        cwd: workspaceRoot(),
    });
}
async function runDeploy(input) {
    const root = workspaceRoot();
    if (!root) {
        void vscode.window.showWarningMessage("Open the Tales of Tileria workspace first.");
        return;
    }
    const deployScriptPath = path.join(root.fsPath, "deploy.bat");
    const fastFlag = input.fast ? " --fast" : "";
    const command = `cmd /c "${deployScriptPath}"${fastFlag}`;
    runTerminalCommand({
        command,
        preface: [
            "echo [tot-ops] Deploy Live",
            `echo [tot-ops] Fast mode: ${input.fast ? "ON" : "OFF"}`,
        ],
    });
}
async function runWipe(input) {
    const root = workspaceRoot();
    if (!root) {
        void vscode.window.showWarningMessage("Open the Tales of Tileria workspace first.");
        return;
    }
    const summary = input.wipeOnly
        ? `Wipe live data only (${input.scope})`
        : `Wipe and deploy (${input.scope})`;
    if (input.confirmDestructive) {
        const approved = await confirmDestructiveAction(summary);
        if (!approved) {
            return;
        }
    }
    if (!process.env.ADMIN_WIPE_TOKEN) {
        void vscode.window.showWarningMessage("ADMIN_WIPE_TOKEN is not set in this app process. Wipe commands may fail unless terminal env sets it.");
    }
    const wipeScriptPath = path.join(root.fsPath, "wipe-live-data.bat");
    const wipeOnlyFlag = input.wipeOnly ? " --wipe-only" : "";
    const fastFlag = !input.wipeOnly && input.fast ? " --fast" : "";
    const command = `cmd /c "${wipeScriptPath}" "${input.liveUrl}" "${input.scope}"${wipeOnlyFlag}${fastFlag}`;
    runTerminalCommand({
        command,
        preface: [
            `echo [tot-ops] ${summary}`,
            `echo [tot-ops] URL: ${input.liveUrl}`,
            `echo [tot-ops] Scope: ${input.scope}`,
            `echo [tot-ops] Fast mode: ${input.fast ? "ON" : "OFF"}`,
            "echo [tot-ops] Requires ADMIN_WIPE_TOKEN in terminal env",
        ],
    });
}
async function pickFastFlag(defaultFast, label) {
    const quickPick = await vscode.window.showQuickPick([
        { label: "Run with checks", value: false },
        { label: "Run --fast (skip checks)", value: true },
    ], {
        title: `${label} mode`,
        placeHolder: defaultFast
            ? "Default is --fast from settings"
            : "Default runs full checks",
    });
    return quickPick?.value;
}
async function confirmDestructiveAction(label) {
    const choice = await vscode.window.showWarningMessage(`${label} will modify live state. Continue?`, { modal: true, detail: "Type/confirm carefully; this action cannot be undone." }, "Continue");
    return choice === "Continue";
}
function runTerminalCommand(input) {
    const terminal = getTerminal();
    terminal.show(true);
    terminal.sendText("echo.");
    for (const line of input.preface) {
        terminal.sendText(line);
    }
    terminal.sendText(input.command, true);
}
//# sourceMappingURL=extension.js.map