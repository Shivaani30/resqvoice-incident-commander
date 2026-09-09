export type Severity = 'SEV-1' | 'SEV-2' | 'SEV-3'
export type IncidentStatus = 'Investigating' | 'Mitigating' | 'Monitoring' | 'Resolved'
export interface Incident { id:string; severity:Severity; title:string; service:string; team:string; status:IncidentStatus; startedAt:string }
export interface CommandTurn { id:string; role:'commander'|'copilot'; text:string; timestamp:string; generation:number }
export type ToolName = 'createIncident'|'updateSeverity'|'notifyTeam'|'getIncidentStatus'|'cancelNotification'
export type ToolStatus = 'pending'|'completed'|'cancelled'|'stale-discarded'|'failed'
export interface ToolExecution { id:string; tool:ToolName; status:ToolStatus; summary:string; timestamp:string; sessionId:string; turnId:string; generationId:number }
export interface EventLog { id:string; kind:'voice'|'tool'|'system'; message:string; timestamp:string; generation:number }
