import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const members = [
  { email: 'owner@workspace.com', joined: 'Jan 1, 2023', role: 'Owner' },
  { email: 'agent1@workspace.com', joined: 'Feb 15, 2023', role: 'Member' },
  { email: 'long-email-address-for-testing-purpose@workspace.com', joined: 'Mar 20, 2023', role: 'Member' },
];

export default function MembersTab() {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <CardTitle>Members</CardTitle>
          <CardDescription>Manage who has access to this workspace.</CardDescription>
        </div>
        <Button className="w-full mt-4 sm:w-auto sm:mt-0">Invite Members</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Member Since</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.email}>
                  <TableCell className="font-medium" style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}>{member.email}</TableCell>
                  <TableCell>{member.joined}</TableCell>
                  <TableCell>{member.role}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>Edit Role</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
