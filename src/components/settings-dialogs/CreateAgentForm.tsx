import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { ViewState } from './ManageAgentsDialog'; // Import ViewState type

export const CreateAgentForm = ({ setActiveSection }: { setActiveSection: (section: ViewState) => void }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const canCreate = useMemo(() => name.trim() && email.trim(), [name, email]);

  const handleCreateAgent = () => {
    if (!canCreate) return;
    // Simulate agent creation (UI only)
    console.log('Creating agent:', { name: name.trim(), email: email.trim() });
    setName('');
    setEmail('');
    setActiveSection('agents'); // Navigate back to agents list after "creation"
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setActiveSection('agents')} className="text-muted-foreground hover:bg-muted">
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div>
            <CardTitle className="text-foreground">Create New AI Agent</CardTitle>
            <CardDescription className="text-muted-foreground">Add a new AI agent with a name and email. (UI only)</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input 
            placeholder="Agent name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            className="border-border focus-visible:ring-ring bg-input text-foreground"
          />
          <Input 
            placeholder="Agent email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            className="border-border focus-visible:ring-ring bg-input text-foreground"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleCreateAgent} disabled={!canCreate}>
            Create Agent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
