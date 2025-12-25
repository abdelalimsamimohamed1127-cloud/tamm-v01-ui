import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const billingHistory = [
  { date: '2023-05-01', amount: '$99.00', description: 'Standard Plan - Monthly', status: 'Paid' },
  { date: '2023-04-01', amount: '$99.00', description: 'Standard Plan - Monthly', status: 'Paid' },
  { date: '2023-03-01', amount: '$99.00', description: 'Standard Plan - Monthly', status: 'Paid' },
];

const paymentMethods = [
    { type: 'Visa', last4: '4242', expiry: '08/26' },
];

export default function BillingTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Billing Details</CardTitle>
          <CardDescription>Manage your billing contact and information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Billing Email</p>
            <Input type="email" defaultValue="billing@workspace.com" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Tax ID (Optional)</p>
            <Input placeholder="e.g., EU VAT ID, EIN" />
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button>Save Billing Details</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Add and manage your payment methods.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {paymentMethods.map(method => (
                <div key={method.last4} className="rounded-lg border p-4 flex justify-between items-center">
                    <div>
                        <p className="font-medium">{method.type} ending in {method.last4}</p>
                        <p className="text-sm text-muted-foreground">Expires {method.expiry}</p>
                    </div>
                    <Button variant="outline" size="sm">Remove</Button>
                </div>
            ))}
        </CardContent>
        <CardFooter className="border-t pt-6">
            <Button variant="outline">Add Payment Method</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View and download your past invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingHistory.map((invoice, index) => (
                  <TableRow key={index}>
                    <TableCell>{invoice.date}</TableCell>
                    <TableCell>{invoice.description}</TableCell>
                    <TableCell>{invoice.amount}</TableCell>
                    <TableCell>{invoice.status}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">Download</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
