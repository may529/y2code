import * as vscode from "vscode";
import { PageTemplate } from "../types";

// 替换模版中的变量
export function replaceTemplateVariables(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(/\$\{(\w+)\}/g, (_, key) => variables[key] || "");
}

// 创建文件（如果目录不存在则创建）
export async function createFileWithDirectory(
  uri: vscode.Uri,
  content: string
) {
  try {
    const dir = vscode.Uri.joinPath(uri, "..");
    await vscode.workspace.fs.createDirectory(dir);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
  } catch (error) {
    console.error("Failed to create file:", error);
    throw error;
  }
}

// 检查文件是否存在
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

// 读取文件内容
export async function readFile(uri: vscode.Uri): Promise<string> {
  const content = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(content).toString("utf-8");
}

// 格式化变量名
export function formatVariableName(name: string): {
  camelCase: string;
  pascalCase: string;
  kebabCase: string;
} {
  const camelCase = name.replace(/-([a-z])/g, (_, letter) =>
    letter.toUpperCase()
  );
  const pascalCase = camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  const kebabCase = name.replace(/([A-Z])/g, "-$1").toLowerCase();

  return {
    camelCase,
    pascalCase,
    kebabCase,
  };
}

// 获取默认的页面模版
export function getDefaultPageTemplates(): PageTemplate[] {
  return [
    {
      id: "default-page",
      name: "基础页面",
      description: "包含index.tsx和index.less的基础页面模版",
      files: [
        {
          filename: "index.tsx",
          content: `
import React from 'react';
import styles from './index.less';

interface ${"{"}${"{"}className}Props {
  // 在此定义props类型
}

const ${"{"}${"{"}className}: React.FC<${"{"}${"{"}className}Props> = (props) => {
  return (
    <div className={styles.container}>
      ${"{"}${"{"}pageName} Page
    </div>
  );
};

export default ${"{"}${"{"}className};
          `.trim(),
        },
        {
          filename: "index.less",
          content: `
.container {
  // 在此添加样式
}
          `.trim(),
        },
      ],
    },
  ];
}
