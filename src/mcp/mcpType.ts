export type McpErrorEntry = {
    message: string
    timestamp: number
    level: "error" | "warn" | "info"
}

export type McpServer = {
    name: string
    config: string
    status: "connected" | "connecting" | "disconnected"
    error?: string
    errorHistory?: McpErrorEntry[]
    tools?: McpTool[]
    resources?: McpResource[]
    resourceTemplates?: McpResourceTemplate[]
    disabled?: boolean
    timeout?: number
    source?: "global" | "project"
    projectPath?: string
    instructions?: string
}

export type McpTool = {
    name: string
    description?: string
    inputSchema?: object
    alwaysAllow?: boolean
    enabledForPrompt?: boolean
}

export type McpResource = {
    uri: string
    name: string
    mimeType?: string
    description?: string
}

export type McpResourceTemplate = {
    uriTemplate: string
    name: string
    description?: string
    mimeType?: string
}

export type McpResourceResponse = {
    _meta?: Record<string, any>
    contents: Array<{
        uri: string
        mimeType?: string
        text?: string
        blob?: string
    }>
}

export type McpToolCallResponse = {
    _meta?: Record<string, any>
    content: Array<
        | {
            type: "text"
            text: string
        }
        | {
            type: "image"
            data: string
            mimeType: string
        }
        | {
            type: "audio"
            data: string
            mimeType: string
        }
        | {
            type: "resource"
            resource: {
                uri: string
                mimeType?: string
                text?: string
                blob?: string
            }
        }
    >
    isError?: boolean
}

export interface IMcpServer {
    name: string;
    config: string;
    status: string;
    source: string;
    projectPath: string;
    errorHistory: any[];
    error: string;
    tools: Tool[];
    resources: Resource[];
    resourceTemplates: any[];
    disabled?: boolean
}

export interface Resource {
    name: string;
    uri: string;
}

export interface Tool {
    name: string;
    description: string;
    inputSchema: InputSchema;
    alwaysAllow: boolean;
    disabled: boolean;
    enabledForPrompt: boolean;
}

export interface InputSchema {
    type: string;
    properties: Properties;
    additionalProperties: boolean;
    $schema: string;
    required?: string[];
}

export interface Properties {
    city?: City;
    citys?: City;
    stationNames?: City;
    stationTelecode?: City;
    date?: DateClass;
    fromStation?: City;
    toStation?: City;
    trainFilterFlags?: TrainFilterFlags;
    earliestStartTime?: EarliestStartTime;
    latestStartTime?: EarliestStartTime;
    sortFlag?: MiddleStation;
    sortReverse?: CSVFormat;
    limitedNum?: EarliestStartTime;
    csvFormat?: CSVFormat;
    middleStation?: MiddleStation;
    showWZ?: CSVFormat;
    trainNo?: City;
    fromStationTelecode?: City;
    toStationTelecode?: City;
    departDate?: DateClass;
}

export interface City {
    type: Type;
    description: string;
}

export enum Type {
    String = "string",
}

export interface CSVFormat {
    type: string;
    default: boolean;
    description: string;
}

export interface DateClass {
    type: Type;
    minLength: number;
    maxLength: number;
    description: string;
}

export interface EarliestStartTime {
    type: string;
    minimum: number;
    maximum?: number;
    default: number;
    description: string;
}

export interface MiddleStation {
    type: Type;
    default: string;
    description: string;
}

export interface TrainFilterFlags {
    type: Type;
    pattern: string;
    maxLength: number;
    default: string;
    description: string;
}
