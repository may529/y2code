import * as vscode from "vscode";
import { SettingsWebviewProvider } from "./webviews/SettingsWebviewProvider";
import { createPage } from "./commands/createPage";
import { createApis } from "./commands/createApis";
import * as fs from "fs";
import * as path from "path";

// 添加消息类型定义
interface YapiConfigMessage {
  command: string;
  config: Record<string, any>;
  name?: string;
  sourceDirectory?: string;
}

const cleanCompiledFiles = (dir: string) => {
  console.log(`Cleaning compiled files in directory: ${dir}`);
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      cleanCompiledFiles(filePath);
    } else {
      // 删除.js和.js.map文件
      if (file.endsWith(".js") || file.endsWith(".js.map")) {
        console.log(`Removing compiled file: ${filePath}`);
        fs.unlinkSync(filePath);
      }
    }
  });
};

const copyFile = (src: string, dest: string) => {
  console.log(`Copying from ${src} to ${dest}`);
  const files = fs.readdirSync(src);

  files.forEach((file) => {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);
    const stat = fs.statSync(srcFile);

    if (stat.isDirectory()) {
      const skipDirs = [
        "dist",
        "build",
        "node_modules",
        ".git",
        ".vscode",
        ".idea",
        "lib",
        "es",
        "umd",
        "cjs",
        "compiled",
        "release",
      ];

      if (!skipDirs.includes(file) && !file.startsWith(".")) {
        console.log(`Processing directory: ${file}`);
        fs.mkdirSync(destFile, { recursive: true });
        copyFile(srcFile, destFile);
      } else {
        console.log(`Skipping directory: ${file}`);
      }
    } else {
      // 复制所有文件,不再过滤文件类型
      console.log(`Copying file: ${file}`);
      fs.copyFileSync(srcFile, destFile);
    }
  });
};

export function activate(context: vscode.ExtensionContext) {
  // 确保模板目录存在
  const templatesDir = path.join(context.extensionPath, "templates");
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }

  // 注册设置面板
  const provider = new SettingsWebviewProvider(context.extensionUri, context);

  // 注册 webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SettingsWebviewProvider.viewType,
      provider
    )
  );

  // 注册消息处理器
  const originalHandleMessage = provider.handleMessage;
  provider.handleMessage = async (message: YapiConfigMessage) => {
    console.log("Received message:", message);

    switch (message.command) {
      case "selectDirectory": {
        console.log("Handling selectDirectory message");
        const result = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: "选择模板目录",
        });

        if (result && result[0]) {
          console.log("Selected directory:", result[0].fsPath);
          provider.postMessage({
            command: "updateSelectedDirectory",
            path: result[0].fsPath,
          });
        }
        break;
      }
      case "saveYapiConfig": {
        try {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          console.log("workspaceFolders:", workspaceFolders); // 添加日志
          if (!workspaceFolders) {
            vscode.window.showErrorMessage("请先打开一个项目文件夹！");
            return;
          }

          const rootPath = workspaceFolders[0].uri.fsPath;
          const configPath = path.join(rootPath, "K2C.config");
          const config = message.config;

          console.log("Saving config:", config); // 添加日志

          // 检查文件是否存在
          let existingConfig = {};
          if (fs.existsSync(configPath)) {
            const fileContent = fs.readFileSync(configPath, "utf8");
            existingConfig = JSON.parse(fileContent);
          }

          // 合并配置
          const newConfig = { ...existingConfig, ...config };

          // 写入文件
          fs.writeFileSync(
            configPath,
            JSON.stringify(newConfig, null, 2),
            "utf8"
          );

          // 显示成功消息
          vscode.window.showInformationMessage("YAPI配置保存成功！");

          // 发送成功消息回前端
          provider.postMessage({
            command: "saveSuccess",
          });

          console.log("Config saved successfully"); // 添加日志
        } catch (error: unknown) {
          console.error("Save failed:", error); // 添加错误日志
          if (error instanceof Error) {
            vscode.window.showErrorMessage(
              "保存配置文件失败：" + error.message
            );
          } else {
            vscode.window.showErrorMessage("保存配置文件失败：未知错误");
          }
        }
        break;
      }
      case "createTemplate": {
        const templateName = message.name;
        const sourceDir = message.sourceDirectory;

        try {
          if (!templateName || !sourceDir) {
            throw new Error("需要模版名和选择的目录");
          }

          const templateDir = path.join(
            context.extensionPath,
            "templates",
            templateName
          );

          // 如果目录已存在,先完全删除
          if (fs.existsSync(templateDir)) {
            console.log(`Removing existing template directory: ${templateDir}`);
            fs.rmSync(templateDir, { recursive: true, force: true });
          }

          // 创建新的模板目录
          console.log(`Creating template directory: ${templateDir}`);
          fs.mkdirSync(templateDir, { recursive: true });

          // 复制文件
          console.log(`Copying files from ${sourceDir} to ${templateDir}`);
          copyFile(sourceDir, templateDir);

          // 添加延迟确保文件写入完成
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // 清理编译文件
          console.log("Starting cleanup...");
          cleanCompiledFiles(templateDir);

          // 再次添加延迟确保清理完成
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // 获取更新后的模板列表
          const updatedTemplateList = provider.getTemplateList();

          provider.postMessage({
            command: "templateCreated",
            success: true,
            templateList: updatedTemplateList,
          });

          console.log("Template creation completed successfully");
        } catch (error: any) {
          console.error("Template creation failed:", error);
          provider.postMessage({
            command: "templateCreated",
            success: false,
            error: error.message,
          });
        }
        break;
      }
      case "getTemplateList": {
        const templateList = provider.getTemplateList();
        provider.postMessage({
          command: "updateTemplateList",
          templateList: templateList,
        });
        break;
      }

      default:
        // 如果不是特殊处理的消息,交给原来的handleMessage处理
        await originalHandleMessage(message);
    }
  };

  // 注册右键菜单命令
  context.subscriptions.push(
    vscode.commands.registerCommand("K2C.createPage", (uri: vscode.Uri) => {
      return createPage(uri, context);
    }),
    vscode.commands.registerCommand("K2C.createApis", (uri: vscode.Uri) => {
      return createApis(uri, context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("K2C.reloadSettings", () => {
      if (provider._view) {
        provider._loadAndSendConfig(provider._view.webview);
      }
    })
  );
}

export function deactivate() {}
