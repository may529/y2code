import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { YAPIParser } from "../utils/yapiParser";
import prettier from "prettier";

interface YAPIConfig {
  domain: string;
  token: string;
  projectId: string;
  requestsrc: string;
}

interface CategoryQuickPickItem extends vscode.QuickPickItem {
  category: any;
}

interface YAPIInterface {
  _id: number;
  title: string;
  path: string;
  method: string;
  req_body_type: string;
  req_params: Array<{
    name: string;
    type: string;
    desc?: string;
    required: boolean;
  }>;
  req_query: Array<{
    name: string;
    type: string;
    desc?: string;
    required: boolean;
  }>;
  req_body_other?: string;
  res_body_type: string;
  res_body: string;
}

interface InterfaceQuickPickItem extends vscode.QuickPickItem {
  interface: any;
}

// 添加 JSON 字符预处理函数
function preprocessJsonString(str: string): any {
  if (!str) return null;

  // 去掉换行和空格，处理转义
  const cleaned = str.replace(/\n/g, "").replace(/\s+/g, "").replace(/\\/g, "");

  return JSON.parse(cleaned);
}

// 改进类型推导函数
function getTypeFromSchema(schema: any): string {
  if (!schema) return "any";

  try {
    switch (schema.type) {
      case "string":
        if (schema.enum) {
          return schema.enum.map((v: any) => `'${v}'`).join(" | ");
        }
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "array":
        return Array.isArray(schema.items)
          ? `(${schema.items.map(getTypeFromSchema).join(" | ")})[]`
          : `${getTypeFromSchema(schema.items)}[]`;
      case "object":
        if (schema.properties) {
          const props = Object.entries(schema.properties)
            .map(([key, value]: [string, any]) => {
              const type = getTypeFromSchema(value);
              const required = schema.required?.includes(key);
              return `${key}${required ? "" : "?"}: ${type}`;
            })
            .join(";\n    ");
          return `{\n    ${props}\n  }`;
        }
        return "Record<string, any>";
      default:
        if (schema.oneOf) {
          return schema.oneOf.map(getTypeFromSchema).join(" | ");
        }
        if (schema.allOf) {
          return schema.allOf.map(getTypeFromSchema).join(" & ");
        }
        return "any";
    }
  } catch (error) {
    console.warn("Error getting type from schema:", error);
    return "any";
  }
}

async function extractExistingApis(filePath: string): Promise<string[]> {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const pathRegex = /path: "([^"]+)"/g;
  const paths: string[] = [];

  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }

  return paths;
}
const processPath = (path: string): string => {
  // 将 {paramName} 转换为 ${params.paramName}
  const processed = path.replace(/\{([^}]+)\}/g, "${params.$1}");
  return `\`${processed}\``;
};
export async function createApis(
  uri: vscode.Uri,
  context: vscode.ExtensionContext
) {
  try {
    // 1. 获取工作区根目录
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
      throw new Error("请先打开工作区");
    }

    // 2. 读取配置文件 (改用.K2C.json)
    const configPath = path.join(workspaceRoot, "K2C.config");
    if (!fs.existsSync(configPath)) {
      throw new Error("未找到配置文件 .K2C.json，请先在设置面板中配置YAPI信息");
    }

    const config: {
      yapi: YAPIConfig;
    } = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    // 3. 验证配置
    if (!config.yapi.domain) {
      throw new Error("YAPI domain 未配置");
    }
    if (!config.yapi.token) {
      throw new Error("YAPI token 未配置");
    }
    if (!config.yapi.projectId) {
      throw new Error("YAPI projectId 未配置");
    }
    if (!config.yapi.requestsrc) {
      throw new Error("项目的 request.ts 文件路径未配置");
    }

    // 4. 确保domain是完整的URL
    const domain = config.yapi.domain.startsWith("http")
      ? config.yapi.domain
      : `http://${config.yapi.domain}`;

    // 5. 获取分类列表
    const categoriesUrl = `${domain}/api/interface/getCatMenu`;
    console.log("Requesting categories from:", categoriesUrl); // 调试用

    const categoriesResponse = await axios.get(categoriesUrl, {
      params: {
        project_id: config.yapi.projectId,
        token: config.yapi.token,
      },
    });

    if (!categoriesResponse.data?.data) {
      throw new Error(
        `获取分类列表失败: ${JSON.stringify(categoriesResponse.data)}`
      );
    }

    const categories = categoriesResponse.data.data;

    // 6. 显示分类选择
    const selectedCategory = (await vscode.window.showQuickPick(
      categories.map((cat: any) => ({
        label: cat.name,
        description: `ID: ${cat._id}`,
        category: cat,
      })) as CategoryQuickPickItem[],
      {
        placeHolder: "选择接口分类",
      }
    )) as CategoryQuickPickItem;

    if (!selectedCategory) {
      return;
    }

    // 7. 获取分类下的接口列表
    const interfacesUrl = `${domain}/api/interface/list`;
    const interfacesResponse = await axios.get(interfacesUrl, {
      params: {
        page: 1,
        limit: 100,
        catid: selectedCategory.category._id,
        token: config.yapi.token,
      },
    });

    if (!interfacesResponse.data?.data?.list) {
      throw new Error("获取接口表失败");
    }

    const interfaces = interfacesResponse.data.data.list;

    // 生成目标文件路径
    const targetPath = path.join(uri.fsPath, "apis.tsx");

    // 获取现有API路径
    const existingPaths = await extractExistingApis(targetPath);

    // 显示接口选择，预选已存在的接口
    const selectedInterfaces =
      await vscode.window.showQuickPick<InterfaceQuickPickItem>(
        interfaces.map((int: any) => ({
          label: int.title,
          description: `${int["method"].toUpperCase()} ${int.path}`,
          interface: int,
          picked: existingPaths.includes(int.path),
        })) as InterfaceQuickPickItem[],
        {
          placeHolder: "选择要生成的接口（可多选）",
          canPickMany: true,
        }
      );

    if (!selectedInterfaces || selectedInterfaces.length === 0) {
      return;
    }
    // 清空已使用的方法名集合
    usedMethodNames.clear();
    // 获取每个接口的详细信息
    const interfaceDetails = await Promise.all(
      selectedInterfaces.map(async (item) => {
        const detailUrl = `${domain}/api/interface/get`;
        const response = await axios.get(detailUrl, {
          params: {
            id: item.interface._id,
            token: config.yapi.token,
          },
        });
        return response.data.data;
      })
    );

    const parser = new YAPIParser();

    let code = `${config.yapi.requestsrc};\n`;
    code += `import createApiHooks from 'create-api-hooks';\n\n`;

    // 添加通用接口类型
    code += `export interface ApiResponse<D> {
      code: number;
      data: D;
      msg: string;
    }\n\n`;

    // 添加分页请求参数类型
    code += `export interface ListApiRequestParams {
      pageNum: number;
      numPerPage: number;
    }\n\n`;

    // 添加分页响应数据类型
    code += `export interface ListApiResponseData<D> {
      beginIndex?: number;
      beginPageIndex?: number;
      endPageIndex?: number;
      pageCount?: number;
      currentPage: number;
      numPerPage: number;
      recordList: D[];
      totalCount: number;
    }\n\n`;

    // 先生成所有类型定义
    interfaceDetails.forEach((int: any) => {
      const requestType = parser.generateRequestType(int);
      if (requestType) {
        code += requestType;
      }
    });

    code += `export default {\n`;

    // 添加判断是否为文件上传接口的辅助函数
    function isFormData(int: any): boolean {
      return int.req_headers?.some(
        (header: any) =>
          header.name === "Content-Type" &&
          header.value === "multipart/form-data"
      );
    }

    // 然后生成方法定义
    interfaceDetails.forEach((int: any) => {
      const methodName = generateMethodName(int.path, int.method);
      code += `  // ${int.title}\n`;

      if (isFormData(int)) {
        // 处理文件上传接口
        code += `  ${methodName}: createApiHooks((params: `;
        if (parser.generateRequestType(int)) {
          code += `${methodName}Params`;
        } else {
          code += `any`;
        }
        code += `) => {\n`;
        code += `    const formData = new FormData();\n`;
        code += `    Object.entries(params).forEach(([key, value]) => {\n`;
        code += `      if (value instanceof File) {\n`;
        code += `        formData.append(key, value);\n`;
        code += `      } else {\n`;
        code += `        formData.append(key, String(value));\n`;
        code += `      }\n`;
        code += `    });\n`;
        code += `    return request.${int.method.toLowerCase()}<`;
        const responseType = parser.generateResponseType(int);
        code += responseType;
        code += `>(\n`;
        code += `      ${processPath(int.path)},\n`;
        code += `      formData\n`;
        code += `    );\n`;
        code += `  }),\n\n`;
      } else {
        // 处理普通接口
        code += `  ${methodName}: createApiHooks((params: `;
        if (parser.generateRequestType(int)) {
          code += `${methodName}Params`;
        } else {
          code += `any`;
        }
        code += `) =>\n`;
        code += `    request.${int.method.toLowerCase()}<`;
        const responseType = parser.generateResponseType(int);
        code += responseType;
        code += `>(\n`;
        code += `      ${processPath(int.path)},\n`;
        code += `      ${int.method.toLowerCase() === "get" ? "{ params }" : "params"}\n`;
        code += `    )\n  ),\n\n`;
      }
    });

    code += `};\n`;

    // 在写入文件前添加格式化
    const formattedCode = await prettier.format(code, {
      parser: "typescript",
      semi: true,
      singleQuote: true,
      trailingComma: "all",
      printWidth: 100,
      tabWidth: 2,
    });

    fs.writeFileSync(targetPath, formattedCode);

    vscode.window.showInformationMessage("接口代码更新成功！");
  } catch (error) {
    console.error("Error in createApis:", error);
    if (error instanceof Error) {
      vscode.window.showErrorMessage(`错误：${error.message}`);
    } else {
      vscode.window.showErrorMessage("发生未知错误");
    }
  }
}
// 添加参数来接收选中的接口列表
export function generateApis(
  selectedInterfaces: YAPIInterface[],
  requestsrc: string
) {
  let code = `import request from '${requestsrc}';\n`;
  code += `import createApiHooks from 'create-api-hooks';\n\n`;

  code += `export interface ApiResponse<D> {
    code: number;
    data: D;
    msg: string;
  }\n\n`;

  code += `export default {\n`;
  // 只处理选中的接口
  selectedInterfaces.forEach((int) => {
    const processedPath = processPath(int.path);
    code += `  // ${int.title}\n`;
    code += `  ${int.title}: createApiHooks((`;

    if (int.req_body_other || int.req_query || int.req_params) {
      code += `params`;
    }

    // 解析响应类型
    let responseType = "any";
    if (int.res_body) {
      try {
        const resBodyObj = preprocessJsonString(int.res_body);
        // 先获取data字段的schema定义
        const dataSchema = resBodyObj.properties?.data;
        if (dataSchema) {
          // 直接将data的schema传给getTypeFromSchema
          responseType = getTypeFromSchema(dataSchema);
        }
      } catch (error) {
        console.warn(`解析res_body失败: ${error}`);
      }
    }

    code += `) => \n    request.${int.method.toLowerCase()}<ApiResponse<${responseType}>>("${
      processedPath
    }"`;

    if (int.req_body_other) {
      code += `, params`;
    } else if (int.req_query) {
      code += `, { params }`;
    }

    code += `)\n  ),\n\n`;
  });

  code += `};\n`;
  return code;
}

// 在文件顶部添加用于跟踪已使用方法名的 Set
const usedMethodNames = new Set<string>();

function generateMethodName(path: string, method: string): string {
  // 移除开头的斜杠并分割路径
  const parts = path.replace(/^\//, "").split("/");

  // 获取最后两个元素，如果不足两个则使用全部
  const nameParts = parts.slice(-2);

  // 转换为驼峰命名
  let baseName = nameParts
    .map((part, index) => {
      // 移除非字母数字字符
      part = part.replace(/[^a-zA-Z0-9]/g, "");
      // 所有部分首字母大写
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");

  // 如果基础名称已存在，则添加 HTTP 方法
  let finalName = baseName;
  if (usedMethodNames.has(baseName)) {
    // 确保 HTTP 方法首字母大写
    const capitalizedMethod =
      method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
    finalName = `${baseName}${capitalizedMethod}`;
  }

  // 将使用过的名称添加到集合中
  usedMethodNames.add(finalName);

  return finalName;
}
