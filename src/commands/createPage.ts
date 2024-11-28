import * as vscode from "vscode";
import { getConfig } from "../utils/config";
import {
  replaceTemplateVariables,
  createFileWithDirectory,
  formatVariableName,
} from "../utils/template";
import { PageTemplate } from "../types";
import { readDirectoryContents } from "../utils/fs";

interface CreatePageOptions {
  templateType?: string;
  pageName?: string;
}

export async function createPage(
  uri: vscode.Uri,
  context: vscode.ExtensionContext,
  options?: CreatePageOptions
) {
  // 1. 获取templates目录下的所有模板目录
  const templatesPath = vscode.Uri.joinPath(context.extensionUri, "templates");
  const templateDirs = await vscode.workspace.fs.readDirectory(templatesPath);
  const templates = templateDirs
    .filter(([name, type]) => type === vscode.FileType.Directory)
    .map(([name]) => ({
      label: name,
      description: `Template: ${name}`,
    }));

  // 2. 让用户选择模版
  const template = await vscode.window.showQuickPick(templates);
  if (!template) {
    return;
  }

  // 3. 获取页面名称
  const pageName = await vscode.window.showInputBox({
    prompt: "请输入页面名称",
    placeHolder: "例如: userList",
  });
  if (!pageName) {
    return;
  }

  // 4. 读取模板目录下的所有文件并创建到目标位置
  const templatePath = vscode.Uri.joinPath(templatesPath, template.label);
  const files = await readDirectoryContents(templatePath);

  // 获取目标目录路径
  let targetDir = uri;
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type !== vscode.FileType.Directory) {
      // 如果选中的是文件，则使用其父目录
      targetDir = vscode.Uri.joinPath(uri, "..");
    }
  } catch (error) {
    vscode.window.showErrorMessage("无法访问选中的目录");
    return;
  }

  // 创建以页面名称命名的子目录
  targetDir = vscode.Uri.joinPath(targetDir, pageName);
  try {
    await vscode.workspace.fs.createDirectory(targetDir);
  } catch (error) {
    vscode.window.showErrorMessage(`无法创建目录: ${pageName}`);
    return;
  }

  for (const file of files) {
    const content = replaceTemplateVariables(file.content, {
      pageName,
      className: formatVariableName(pageName).pascalCase,
    });

    const relativePath = file.relativePath.replace(/\${pageName}/g, pageName);
    const targetPath = vscode.Uri.joinPath(targetDir, relativePath);
    await createFileWithDirectory(targetPath, content);
  }

  vscode.window.showInformationMessage(`成功创建页面: ${pageName}`);
}
