import * as vscode from "vscode";

interface FileInfo {
  relativePath: string;
  content: string;
}

export async function readDirectoryContents(
  dirUri: vscode.Uri,
  relativePath: string = ""
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  const entries = await vscode.workspace.fs.readDirectory(dirUri);

  for (const [name, type] of entries) {
    const uri = vscode.Uri.joinPath(dirUri, name);
    const currentPath = relativePath ? `${relativePath}/${name}` : name;

    if (type === vscode.FileType.Directory) {
      const subFiles = await readDirectoryContents(uri, currentPath);
      files.push(...subFiles);
    } else {
      const content = await vscode.workspace.fs.readFile(uri);
      files.push({
        relativePath: currentPath,
        content: Buffer.from(content).toString("utf-8"),
      });
    }
  }

  return files;
}
