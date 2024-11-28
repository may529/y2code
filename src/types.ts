interface RequestTemplate {
  token?: string;
  projectId?: string;
  url?: string;
  requestsrc?: string;
  requestTemplate?: string;
}

export interface YapiConfig extends RequestTemplate {}

export interface TemplateFile {
  filename: string;
  content: string;
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  files: TemplateFile[];
}

export interface ExtensionConfig {
  yapi?: RequestTemplate;
  pageTemplates: PageTemplate[];
}
