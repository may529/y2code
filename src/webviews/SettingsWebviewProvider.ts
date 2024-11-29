import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../utils/config";

export class SettingsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "yapiSettings";
  public _view?: vscode.WebviewView;
  private _visible = false;
  public get visible(): boolean {
    return this._visible;
  }
  // 定义消息处理器属性
  public handleMessage: (message: any) => Promise<void> = async () => {};

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    // 在constructor中初始化handleMessage
    this.handleMessage = async (message) => {
      switch (message.command) {
        case "selectDirectory":
          const result = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: "选择模板目录",
          });

          if (result && result[0]) {
            this.postMessage({
              command: "updateSelectedDirectory",
              path: result[0].fsPath,
            });
          }
          break;

        case "deleteTemplate":
          // 添加确认对话框
          const answer = await vscode.window.showWarningMessage(
            `确定要删除模板 "${message.name}" 吗?`,
            "是",
            "否"
          );

          if (answer === "是") {
            try {
              const templateDir = path.join(
                this.context.extensionPath,
                "templates",
                message.name
              );

              // 删除模板目录
              if (fs.existsSync(templateDir)) {
                fs.rmSync(templateDir, { recursive: true, force: true });
              }

              // 重新获取模板列表并更新UI
              const templateList = this.getTemplateList();
              this._view?.webview.postMessage({
                command: "updateTemplateList",
                templateList: templateList,
              });

              vscode.window.showInformationMessage(
                `模板 "${message.name}" 已删除`
              );
            } catch (error: any) {
              vscode.window.showErrorMessage(`删除模板失败: ${error.message}`);
            }
          }
          break;
      }
    };
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    // 设置webview配置
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // 加载HTML
    webviewView.webview.html = await this.getSettingsHtml(webviewView.webview);

    // 加载并发送配置
    this._loadAndSendConfig(webviewView.webview);

    // 加载模板列表
    const templateList = this.getTemplateList();
    webviewView.webview.postMessage({
      command: "updateTemplateList",
      templateList: templateList,
    });

    // 处理来自webview的消息
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        if (this.handleMessage) {
          await this.handleMessage(message);
        }
      },
      undefined,
      this.context.subscriptions
    );

    // 添加可见性变化监听
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._loadAndSendConfig(webviewView.webview);
      }
    });
  }

  public async refresh() {
    console.log("refresh called");
    if (this._view) {
      const html = await this.getSettingsHtml(this._view.webview);
      this._view.webview.html = html;
    }
  }

  private async getSettingsHtml(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "style.css")
    );

    const nonce = this.getNonce();
    const config = await getConfig(this.context);
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; 
            style-src ${webview.cspSource} 'unsafe-inline'; 
            script-src ${webview.cspSource} 'nonce-${nonce}';
            img-src ${webview.cspSource} https:;">
          <link href="${styleUri}" rel="stylesheet">
          <title>K2C助手</title>
        </head>
        <body>
          <div id="root">
            <h1>K2C设置</h1>
            
            <div class="tab-container">
              <div class="tab-header">
                <button class="tab-btn active" data-tab="yapi">YAPI设置</button>
                <button class="tab-btn" data-tab="templates">页面模版设置</button>
              </div>
              
              <div class="tab-content active" id="yapi-content">
                <form id="yapi-form">
                  <div class="form-group">
                    <label>request方法的文件路径:</label>
                    <input type="text" id="yapi-requestsrc" value="${
                      config?.yapi?.requestsrc || ""
                    }">
                  </div>
                  <div class="form-group">
                    <label>YAPI域名:</label>
                    <input type="text" id="yapi-url" value="${
                      config.yapi?.url || ""
                    }">
                  </div>
                  <div class="form-group">
                    <label>Token:</label>
                    <input type="text" id="yapi-token" value="${
                      config.yapi?.token || ""
                    }">
                  </div>
                  <div class="form-group">
                    <label>项目ID:</label>
                    <input type="text" id="yapi-projectId" value="${
                      config.yapi?.projectId || ""
                    }">
                  </div>
                  <button type="submit" class="btn" id="save-yapi">保存YAPI设置</button>
                </form>
              </div>

              <div class="tab-content" id="templates-content">
                <div class="template-header">
                  <button class="btn" id="add-template">新建模版</button>
                </div>
                <table class="template-table">
                  <thead>
                    <tr>
                      <th>模版名称</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    
                  </tbody>
                </table>
              </div>
            </div>
            <div id="template-modal" class="modal">
              <div class="modal-content">
                <h2>新建模版</h2>
                <form id="template-form">
                  <div class="form-group">
                    <label>模版名称:</label>
                    <input type="text" id="template-name" required>
                  </div>
                  <div class="form-group">
                    <label>选择模版目录:</label>
                    <div class="directory-select">
                      <input type="text" id="template-directory" readonly>
                      <button type="button" class="btn" id="select-directory">选择目录</button>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn" id="cancel-template">取消</button>
                    <button type="submit" class="btn primary">确定</button>
                  </div>
                </form>
              </div>
          </div>
          </div>
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const config = ${JSON.stringify(config)};
            
            vscode.postMessage({ command: 'webviewLoaded' });
          </script>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
  public postMessage(message: any) {
    if (this._view) {
      console.log("Posting message to webview:", message); // 添加日志
      this._view.webview.postMessage(message);
    } else {
      console.warn("No webview available to post message"); // 添加警告日志
    }
  }

  private getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  public _loadAndSendConfig(webview: vscode.Webview) {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return;
      }

      const rootPath = workspaceFolders[0].uri.fsPath;
      const configPath = path.join(rootPath, "K2C.config");

      // 检查配置文件是否存在
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, "utf8");
        const config = JSON.parse(configContent);

        // 发送配置到webview
        webview.postMessage({
          command: "loadConfig",
          config: config,
        });
      }
    } catch (error) {
      console.error("读取配置文件失败:", error);
    }
  }

  // 添加getTemplateList方法
  public getTemplateList(): string[] {
    const templatesDir = path.join(this.context.extensionPath, "templates");
    return fs
      .readdirSync(templatesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  }
}
