// src/types/primitives.ts

export interface Workspace {
    id: string;
    name: string;
    plan: 'free' | 'paid'; // As specified in the prompt
}

export interface Agent {
    id: string;
    workspace_id: string;
    name: string;
    status: 'active' | 'archived' | 'draft';
}
