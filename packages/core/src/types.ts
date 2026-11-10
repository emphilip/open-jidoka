export type JsonSchema = Record<string, unknown>;

export type NodeType =
  | 'startEvent'
  | 'endEvent'
  | 'serviceTask'
  | 'userTask'
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'timerEvent';

export const TASK_TYPES = [
  'openjev.prompt',
  'openjev.extract',
  'openjev.decide',
  'connector',
  'transform',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const AI_TASK_TYPES: readonly TaskType[] = ['openjev.prompt', 'openjev.extract', 'openjev.decide'];

export interface FlowNode {
  id: string;
  type: NodeType;
  name?: string;
  incoming: string[];
  outgoing: string[];
  /** Only set on serviceTask nodes. */
  taskType?: TaskType;
  /** Variable name under `vars` that receives the node's result. */
  resultVariable?: string;
  config: Record<string, unknown>;
  /** Exclusive gateway default flow id. */
  defaultFlow?: string;
  /** Timer events: duration in milliseconds. */
  timerMs?: number;
}

export interface SequenceFlow {
  id: string;
  name?: string;
  source: string;
  target: string;
  /** JSONata expression evaluated against the run context. */
  condition?: string;
}

/** Executable intermediate representation of a published BPMN process. */
export interface WorkflowIR {
  key: string;
  name: string;
  processId: string;
  startNodeIds: string[];
  nodes: Record<string, FlowNode>;
  flows: Record<string, SequenceFlow>;
}

export interface ParseIssue {
  elementId?: string;
  message: string;
}

export interface ParseResult {
  ir?: WorkflowIR;
  errors: ParseIssue[];
  warnings: ParseIssue[];
}

export interface RetryConfig {
  maximumAttempts?: number;
  initialInterval?: string;
  backoffCoefficient?: number;
  maximumInterval?: string;
  startToCloseTimeout?: string;
}

export interface ValidationRule {
  /** JSONata expression evaluated against `{ output, reasoning, context }`; must be truthy to pass. */
  expr: string;
  message: string;
}

export interface JudgeConfig {
  /** What a reviewer model should check the output and reasoning against. */
  criteria?: string;
  /** 0..1, judge confidence below this fails validation. */
  minConfidence?: number;
}

export type ValidationFailurePolicy = 'fail' | 'humanReview' | 'continue';

export interface ValidationConfig {
  schema?: JsonSchema;
  rules?: ValidationRule[];
  judge?: JudgeConfig;
  /** Total OpenJEV attempts, each retry receives the previous validation issues as feedback. */
  maxAttempts?: number;
  onFailure?: ValidationFailurePolicy;
  /** Assignee for the review task when onFailure is humanReview. */
  reviewAssignee?: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  confidence?: number;
  judgeReasoning?: string;
}

export interface DocumentRef {
  url?: string;
  base64?: string;
  text?: string;
  mimeType?: string;
  filename?: string;
  sharepoint?: { connection: string; itemId?: string; path?: string; driveId?: string };
}

export interface PromptTaskConfig {
  system?: string;
  prompt: string;
  outputSchema?: JsonSchema;
  model?: string;
  temperature?: number;
  validation?: ValidationConfig;
  retry?: RetryConfig;
}

export interface ExtractTaskConfig {
  document: DocumentRef;
  instructions?: string;
  schema: JsonSchema;
  model?: string;
  validation?: ValidationConfig;
  retry?: RetryConfig;
}

export interface DecideTaskConfig {
  question: string;
  options: string[];
  context?: unknown;
  model?: string;
  validation?: ValidationConfig;
  retry?: RetryConfig;
}

export interface ConnectorTaskConfig {
  connection: string;
  action: string;
  params?: Record<string, unknown>;
  retry?: RetryConfig;
}

export interface TransformTaskConfig {
  expression: string;
}

export interface UserTaskConfig {
  assignee?: string;
  candidateGroups?: string[];
  instructions?: string;
  /** Field definitions rendered by the admin task inbox. */
  form?: Array<{ name: string; label?: string; type?: 'text' | 'number' | 'boolean' | 'json' }>;
  /** Expression or template resolved into the task's context payload. */
  context?: unknown;
}

export interface AiTaskResult {
  output: unknown;
  reasoning?: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface UserTaskCompletion {
  taskId: string;
  actor: string;
  approved?: boolean;
  result: Record<string, unknown>;
}

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'terminated';

export type StepStatus = 'completed' | 'failed' | 'validation_failed' | 'waiting';

export interface RunState {
  activeNodeIds: string[];
  completedNodeIds: string[];
  failedNodeIds: string[];
  vars: Record<string, unknown>;
}

export interface ProcessInput {
  runId: string;
  ir: WorkflowIR;
  input: Record<string, unknown>;
}
