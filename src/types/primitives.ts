// src/types/primitives.ts

export interface Workspace {
    id: string;
    name: string;
    plan: 'free' | 'paid'; // As specified in the prompt
}
