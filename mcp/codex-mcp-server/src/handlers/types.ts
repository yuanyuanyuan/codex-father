export type ToolTextContent = {
  type: 'text';
  text: string;
};

export type ToolResult = {
  content: ToolTextContent[];
  isError?: boolean;
};

export type HandlerContext = {
  jobSh: string;
  startSh: string;
  projectRoot: string;
  jobShExists: boolean;
  startShExists: boolean;
};
