interface YAPIQueryParam {
  name: string;
  example: string;
  required: string | boolean;
  desc: string;
  type?: string;
}

interface YAPIInterface {
  title: string;
  path: string;
  req_body_other?: string;
  req_query?: YAPIQueryParam[];
  req_params?: YAPIQueryParam[];
  req_body_form?: YAPIQueryParam[];
  res_body?: string;
  res_body_type?: string;
  method: string;
}

export class YAPIParser {
  /**
   * 处理 JSON 字符串
   */
  private preprocessJsonString(str: string): string {
    if (!str) return "";

    try {
      console.log("Original string:", str);

      // 1. 标准化换行符
      str = str.replace(/\r\n/g, "\n");
      str = str.replace(/\r/g, "\n");

      // 2. 移除注释
      str = str.replace(/\/\/.*?(?=\n|$)/g, "");
      str = str.replace(/\/\*[\s\S]*?\*\//g, "");

      // 3. 处理字符串中的mock语法
      // 先将整个JSON解析为对象
      const jsonObj = Function(`return ${str}`)();

      // 递归处理对象中的所有值
      const processMockValue = (value: any): any => {
        if (typeof value !== "string") return value;

        // 处理各种mock语法
        if (value.includes("@natural")) return 0;
        if (value.includes("@integer")) return 0;
        if (value.includes("@float")) return 0.0;
        if (value.includes("@boolean")) return false;

        // 处理字符串类型的mock
        if (value.startsWith("1@string")) return '"10000000000"'; // 特殊处理phone字段
        if (value.includes("@string")) return '""';
        if (value.includes("@word")) return '""';
        if (value.includes("@cname")) return '""';
        if (value.includes("@name")) return '""';

        // 处理pick类型
        if (value.includes("@pick")) {
          const matches = value.match(/'([^']+)'/g);
          if (matches && matches.length > 0) {
            return `"${matches[0].replace(/'/g, "")}"`;
          }
          return '""';
        }

        return value.replace(/@\w+\([^)]*\)/g, '""').replace(/@\w+/g, '""');
      };

      // 递归处理对象
      const processObject = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map((item) => processObject(item));
        }
        if (typeof obj === "object" && obj !== null) {
          const result: any = {};
          for (const key in obj) {
            result[key] = processObject(obj[key]);
          }
          return result;
        }
        return processMockValue(obj);
      };

      const processedObj = processObject(jsonObj);
      const result = JSON.stringify(processedObj, null, 2);

      console.log("Processed result:", result);
      return result;
    } catch (error) {
      console.error("预处理 JSON 失败:", error);
      console.error("问题字符串:", str);

      // 如果上面的方法失败，尝试简单的替换方案
      try {
        // 移除所有注释
        str = str.replace(/\/\/.*?(?=\n|$)/g, "");

        // 简单替换所有mock语法
        str = str.replace(/"[^"]*@\w+\([^)]*\)[^"]*"/g, '""');
        str = str.replace(/"[^"]*@\w+[^"]*"/g, '""');

        // 清理格式
        str = str.replace(/^\s+|\s+$/gm, "");
        str = str.replace(/"\s*:\s*/g, '": ');
        str = str.replace(/,(\s*[}\]])/g, "$1");

        return str;
      } catch (finalError) {
        console.error("最终处理失败:", finalError);
        throw finalError;
      }
    }
  }

  /**
   * 解析YAPI接口详情响应
   */
  parseApiDetail(response: string): YAPIInterface {
    try {
      // 1. 解析外层响应
      const apiDetail = JSON.parse(response);

      // 2. 获取接口数据
      const interfaceData = apiDetail.data;

      // 3. 处理res_body (如果存在)
      if (interfaceData.res_body) {
        try {
          interfaceData.res_body = this.preprocessJsonString(
            interfaceData.res_body
          );
        } catch (error) {
          console.error("处理res_body失败，将使用原始值:", error);
        }
      }

      return interfaceData;
    } catch (error) {
      console.error("解析接口详情失败:", error);
      throw error;
    }
  }

  private usedMethodNames = new Set<string>();

  generateMethodName = (path: string, method: string): string => {
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
    if (this.usedMethodNames.has(baseName)) {
      // 确保 HTTP 方法首字母大写
      const capitalizedMethod =
        method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
      finalName = `${baseName}${capitalizedMethod}`;
    }

    // 将使用过的名称添加到集合中
    this.usedMethodNames.add(finalName);

    return finalName;
  };
  /**
   * 生成请求参数类型
   */
  generateRequestType(int: YAPIInterface): string {
    let code = "";
    const interfaceName = this.generateMethodName(int.path, int.method);
    const hasPagination = int.req_query?.some(
      (param) => param.name === "pageNum" || param.name === "numPerPage"
    );

    // 添加Set来跟踪字段
    const processedFields = new Set<string>();

    try {
      code += `interface ${interfaceName}Params {\n`;

      // 处理form表单参数
      if (int.req_body_form?.length) {
        int.req_body_form.forEach((param) => {
          if (processedFields.has(param.name)) return;

          if (param.desc) {
            code += `  /** ${param.desc} */\n`;
          }
          const type = param.type === "file" ? "File" : "string";
          code += `  ${param.name}${param.required === "1" ? "" : "?"}: ${type};\n`;
          processedFields.add(param.name);
        });
      }

      // 处理请求体参数
      if (int.req_body_other) {
        const descriptions = this.extractDescriptions(int.req_body_other);
        const processedJson = this.preprocessJsonString(int.req_body_other);
        const bodySchema = JSON.parse(processedJson);

        if (bodySchema.title !== "empty object") {
          const processObjectProperties = (obj: any) => {
            Object.entries(obj).forEach(([key, value]) => {
              if (processedFields.has(key)) return;

              if (descriptions[key]) {
                code += `  /** ${descriptions[key]} */\n`;
              }

              if (value && typeof value === "object" && !Array.isArray(value)) {
                code += `  ${key}: {\n`;
                processObjectProperties(value);
                code += `  };\n`;
              } else {
                let type;
                if (value === null) {
                  type = "string";
                } else {
                  type = this.getSchemaType(value, key);
                }

                if (key === "reports") {
                  type = "Array<{ url: string; name: string }>";
                }

                code += `  ${key}: ${type};\n`;
              }
              processedFields.add(key);
            });
          };

          processObjectProperties(bodySchema);
        }
      }

      // 添加路径参数处理
      if (int.req_params && int.req_params?.length > 0) {
        int.req_params.forEach((param) => {
          if (processedFields.has(param.name)) return;

          const desc = param.desc ? ` // ${param.desc}` : "";
          code += `  ${param.name}: string;${desc}\n`;
          processedFields.add(param.name);
        });
      }

      // 处理查询参数
      if (int.req_query?.length) {
        int.req_query.forEach((param) => {
          if (processedFields.has(param.name)) return;

          if (param.desc) {
            code += `  /** ${param.desc} */\n`;
          }
          const isPageParam =
            param.name === "pageNum" || param.name === "numPerPage";
          const type = isPageParam ? "number" : "string";
          code += `  ${param.name}${param.required === "1" ? "" : "?"}: ${type};\n`;
          processedFields.add(param.name);
        });
      }

      // 如果有分页参数，确保它们的类型是 number
      if (hasPagination) {
        code = code.replace(/pageNum\??: string;/g, "pageNum: number;");
        code = code.replace(/numPerPage\??: string;/g, "numPerPage: number;");
      }

      code += `}\n\n`;
      return code;
    } catch (error) {
      console.error("生成请求类型失败:", error);
      console.error("原始数据:", int.req_body_other);
      return `interface ${interfaceName}Params {\n  [key: string]: any;\n}\n\n`;
    }
  }

  /**
   * 生成响应参数类型
   */
  generateResponseType(int: YAPIInterface): string {
    try {
      if (!int.res_body) return "any";

      // 预处理并解析res_body
      const cleanJson = this.preprocessJsonString(int.res_body);
      const resBody = JSON.parse(cleanJson);

      // 检查是否是标准响应格式
      const hasStandardWrapper =
        typeof resBody === "object" &&
        resBody !== null &&
        "code" in resBody &&
        "data" in resBody;

      // 确定要处理的数据对象
      const targetData = hasStandardWrapper ? resBody.data : resBody;

      // 检查是否是分页结构
      const isPageResponse = targetData?.recordList !== undefined;

      if (isPageResponse) {
        // 处理分页响应
        const recordItem = targetData.recordList[0];
        if (!recordItem) return "ListApiResponseData<any>";

        // 生成记录项的类型定义
        const itemType = this.generateItemType(recordItem);
        return `ListApiResponseData<${itemType}>`;
      } else {
        // 生成数据类型
        const dataType = this.generateItemType(targetData);
        // 如果有标准包装则使用 ApiResponse
        return `ApiResponse<${dataType}>`;
      }
    } catch (error) {
      console.error("解析响应参数失败:", error);
      return "any";
    }
  }

  /**
   * 生成数据项的类型定义
   */
  private generateItemType(item: any, rawJson?: string): string {
    if (!item || typeof item !== "object") return "any";

    // 提取字段描述信息
    const descriptions = rawJson ? this.extractDescriptions(rawJson) : {};

    let type = "{\n";
    Object.entries(item).forEach(([key, value]) => {
      // 添加字段注释
      if (descriptions[key]) {
        type += `  /** ${descriptions[key]} */\n`;
      }

      // 获取字段类型,处理mock语法
      let fieldType = this.inferTypeFromValue(value);
      if (typeof value === "string" && value.startsWith("@")) {
        fieldType = this.getMockType(value);
      }

      // 添加字段定义
      type += `  ${key}: ${fieldType};\n`;
    });
    type += "}";

    return type;
  }

  /**
   * 从值推断类型
   */
  private inferTypeFromValue(value: any): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return `${this.inferTypeFromValue(value[0])}[]`;

    switch (typeof value) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "object":
        return this.generateItemType(value);
      default:
        return "any";
    }
  }

  /**
   * 从 schema 生成类型定义
   */
  private generateTypeFromSchema(schema: any, wrapper?: string): string {
    let code = "";

    if (schema.type === "object" && schema.properties) {
      code += "interface DataType {\n";

      Object.entries(schema.properties).forEach(
        ([key, value]: [string, any]) => {
          // 添加注释
          if (value.description) {
            code += `  /** ${value.description} */\n`;
          }

          // 获取类型
          const type = this.getSchemaType(value);
          const required = schema.required?.includes(key);

          // 添加字段定义
          code += `  ${key}${required ? "" : "?"}: ${type};\n`;
        }
      );

      code += "}\n";

      // 添加包装类型
      if (wrapper) {
        code = code.replace(
          "interface DataType",
          `type ${wrapper}Type = ${wrapper}<DataType>`
        );
      }
    }

    return code;
  }

  /**
   * 获取 schema 的类型
   */
  private getSchemaType(
    schema: any,
    fieldName?: string,
    mockValue?: string
  ): string {
    // 如果有 mock 值，优先使用 mock 值推断类型
    if (mockValue) {
      return this.getMockType(mockValue);
    }

    // 添加调试日志
    console.log("Schema for type inference:", schema, "Field name:", fieldName);

    // 1. 如果 schema 有明确的 type，优先使用
    if (schema.type) {
      switch (schema.type) {
        case "string":
          return schema.enum
            ? schema.enum.map((v: string) => `'${v}'`).join(" | ")
            : "string";
        case "number":
        case "integer":
          return "number";
        case "boolean":
          return "boolean";
        case "array":
          return `${this.getSchemaType(schema.items)}[]`;
        case "object":
          if (schema.properties) {
            return this.generateTypeFromSchema(schema);
          }
          return "Record<string, any>";
      }
    }

    // 2. 从字段名推断类型
    if (fieldName) {
      // 分页相关字段
      if (
        /^(page|pageNum|pageSize|numPerPage|limit|offset)$/i.test(fieldName)
      ) {
        return "number";
      }
      // 时间相关字段
      if (/(time|date|at)$/i.test(fieldName)) {
        return "string";
      }
      // ID相关字段
      if (/(Id|Code)$/i.test(fieldName)) {
        return "string";
      }
      // 名称相关字段
      if (/(name|title|desc|description|remark|account)$/i.test(fieldName)) {
        return "string";
      }
    }

    // 3. 从示例值或默认值推断
    if (schema.example !== undefined) {
      const type = typeof schema.example;
      if (type !== "object") return type;
    }

    if (schema.default !== undefined) {
      const type = typeof schema.default;
      if (type !== "object") return type;
    }

    // 4. 从格式说明推断
    if (schema.format) {
      switch (schema.format.toLowerCase()) {
        case "date":
        case "date-time":
        case "time":
        case "email":
        case "hostname":
        case "ipv4":
        case "ipv6":
        case "uri":
          return "string";
        case "int32":
        case "int64":
        case "float":
        case "double":
          return "number";
      }
    }

    // 5. 从描述信息推断
    if (schema.description) {
      if (
        schema.description.includes("时间格式") ||
        schema.description.includes("yyyy-MM-dd")
      ) {
        return "string";
      }
      if (
        schema.description.includes("数字") ||
        schema.description.includes("数值")
      ) {
        return "number";
      }
    }

    console.warn("Unable to determine type for schema:", schema);
    return "string";
  }

  private sanitizeIdentifier(str: string): string {
    return str.replace(/[^a-zA-Z0-9]/g, "").replace(/^(\d)/, "_$1");
  }

  private isListResponse(schema: any): boolean {
    return !!(
      schema?.properties?.data?.properties?.recordList?.type === "array"
    );
  }

  // 添加一个辅助方法来处理 mock 数据的类型推断
  private getMockType(mockValue: string): string {
    if (mockValue.includes("@natural") || mockValue.includes("@integer")) {
      return "number";
    }
    if (mockValue.includes("@boolean")) {
      return "boolean";
    }
    if (mockValue.includes("@pick")) {
      // 从 @pick 选项中提取可能的值
      const matches = mockValue.match(/'([^']+)'/g);
      if (matches) {
        return matches.map((m) => m.replace(/'/g, "")).join(" | ");
      }
    }
    return "string";
  }

  private extractDescriptions(reqBody: string): Record<string, string> {
    const descriptions: Record<string, string> = {};

    // 使用正则表达式提取字段名和描述
    const regex = /"([^"]+)":.*?\/\/\s*(.*?)(?=\n|$)/g;
    let match;

    while ((match = regex.exec(reqBody)) !== null) {
      const fieldName = match[1].trim();
      const description = match[2].trim();
      descriptions[fieldName] = description;
    }

    return descriptions;
  }
}
