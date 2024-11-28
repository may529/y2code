import * as vscode from "vscode";
import { ExtensionConfig, YapiConfig, PageTemplate } from "../types";

// 默认配置
const DEFAULT_CONFIG: ExtensionConfig = {
  yapi: {
    token: "",
    url: "",
    projectId: "",
    requestsrc: `
import { request } from '@/utils/request';

export function \${functionName}(\${params}) {
  return request<\${responseType}>({
    url: '\${path}',
    method: '\${method}',
    \${dataKey}: \${dataValue},
  });
}
    `.trim(),
  },
  pageTemplates: [],
};

// 读取配置
export async function getConfig(
  context: vscode.ExtensionContext
): Promise<ExtensionConfig> {
  const config = context.globalState.get<ExtensionConfig>("K2C.config");
  return config || DEFAULT_CONFIG;
}

// 保存配置
export async function saveConfig(
  context: vscode.ExtensionContext,
  config: ExtensionConfig
) {
  await context.globalState.update("K2C.config", config);
}

// 更新Yapi配置
export async function updateYapiConfig(
  context: vscode.ExtensionContext,
  config: { token: string; projectId: string }
) {
  const currentConfig = await getConfig(context);
  currentConfig.yapi = currentConfig.yapi || { ...DEFAULT_CONFIG.yapi }; // 使用默认配置作为基础
  currentConfig.yapi.token = config.token;
  currentConfig.yapi.projectId = config.projectId;
  await saveConfig(context, currentConfig);
}

// 更新页面模版
export async function updatePageTemplates(
  context: vscode.ExtensionContext,
  templates: PageTemplate[]
) {
  const config = await getConfig(context);
  config.pageTemplates = templates;
  await saveConfig(context, config);
}
