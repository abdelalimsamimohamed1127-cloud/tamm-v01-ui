import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const plans = [
  { name: 'Hobby', price: { monthly: 0, yearly: 0 }, description: 'For personal projects', features: ['1 agent', '100 messages/mo'], current: false },
  { name: 'Standard', price: { monthly: 99, yearly: 990 }, description: 'For small teams', features: ['5 agents', '2,000 messages/mo', 'Email support'], current: true, popular: true },
  { name: 'Pro', price: { monthly: 249, yearly: 2490 }, description: 'For growing businesses', features: ['10 agents', '10,000 messages/mo', 'Priority support'], current: false },
  { name: 'Enterprise', price: { monthly: 'Custom', yearly: 'Custom' }, description: 'For large organizations', features: ['Unlimited agents', 'Custom message limits', 'Dedicated support'], current: false },
];

export default function PlansTab() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">Choose the plan that's right for you.</p>
        </div>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <span>Monthly</span>
          <Switch
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
          />
          <span>Yearly (Save 20%)</span>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(plan => (
          <Card key={plan.name} className={cn("flex flex-col", plan.popular ? "border-primary" : "")}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
              <div className="text-4xl font-bold">
                {typeof plan.price[billingCycle] === 'number' ? `$${plan.price[billingCycle]}` : plan.price[billingCycle]}
                {typeof plan.price[billingCycle] === 'number' && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </div>
              <ul className="space-y-2 text-sm">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" disabled={plan.current}>
                {plan.current ? 'Current Plan' : 'Choose Plan'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Add-ons</CardTitle>
            <CardDescription>Enhance your plan with powerful add-ons.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 flex justify-between items-center">
                <div>
                    <p className="font-medium">Extra Agents</p>
                    <p className="text-sm text-muted-foreground">$20/agent/mo</p>
                </div>
                <Switch disabled />
            </div>
             <div className="rounded-lg border p-4 flex justify-between items-center">
                <div>
                    <p className="font-medium">Advanced Analytics</p>
                    <p className="text-sm text-muted-foreground">$50/mo</p>
                </div>
                <Switch disabled />
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
