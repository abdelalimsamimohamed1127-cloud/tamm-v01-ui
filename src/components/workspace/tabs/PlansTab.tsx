type PlanDisplay = Plan & {
  isCurrent: boolean;
  isPopular?: boolean;
  currentProvider?: string; // Add currentProvider for display
};

// Represents the state of an InstaPay request made by the user
type InstaPayRequestState = {
  planKey: string;
  status: 'pending' | 'error';
  timestamp: Date;
} | null;

export default function PlansTab() {
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly'); // Currently only monthly is supported by backend
  const [availablePlans, setAvailablePlans] = useState<PlanDisplay[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [upgradingPlanKey, setUpgradingPlanKey] = useState<string | null>(null);
  const [currentWorkspaceProvider, setCurrentWorkspaceProvider] = useState<string | undefined>(undefined);

  // InstaPay Modal states
  const [showInstaPayModal, setShowInstaPayModal] = useState(false);
  const [selectedPlanForInstaPay, setSelectedPlanForInstaPay] = useState<PlanDisplay | null>(null);
  const [instapayConfig, setInstapayConfig] = useState<InstaPayConfig | null>(null);
  const [instapayRequestState, setInstapayRequestState] = useState<InstaPayRequestState>(null);


  const fetchPlans = useCallback(async () => {
    if (!workspace?.id) return;

    setLoadingPlans(true);
    try {
      const { plans: fetchedPlans, instapay_config } = await getAllPlans();
      const currentWorkspacePlan = await getCurrentPlan(workspace.id);
      setCurrentWorkspaceProvider(currentWorkspacePlan.provider); // Set the current provider

      const plansWithDisplayInfo: PlanDisplay[] = fetchedPlans.map(plan => ({
        ...plan,
        isCurrent: plan.plan_key === currentWorkspacePlan.plan_key,
        // Add popular flag if needed based on backend data or local config
        // isPopular: plan.plan_key === "pro",
      }));
      setAvailablePlans(plansWithDisplayInfo);
      setInstapayConfig(instapay_config);
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      toast({
        title: "Error fetching plans",
        description: "Could not load available plans. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlans(false);
    }
  }, [workspace?.id, toast]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const onUpgradeClick = useCallback(async (planKey: string) => {
    if (!workspace?.id) {
      toast({
        title: "Error",
        description: "Workspace not found.",
        variant: "destructive",
      });
      return;
    }

    setUpgradingPlanKey(planKey);
    try {
      const response = await startUpgrade(workspace.id, planKey);
      if (response.payment_url) {
        window.location.href = response.payment_url;
      } else {
        toast({
          title: "Upgrade Failed",
          description: "Could not get payment URL. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error(`Failed to initiate upgrade for ${planKey}:`, error);
      toast({
        title: "Upgrade Failed",
        description: error.message || "An unexpected error occurred during upgrade.",
        variant: "destructive",
      });
    } finally {
      setUpgradingPlanKey(null);
    }
  }, [workspace?.id, toast]);

  const onInstaPayClick = useCallback((plan: PlanDisplay) => {
    if (!instapayConfig) {
      toast({
        title: "Error",
        description: "InstaPay configuration not loaded.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPlanForInstaPay(plan);
    setShowInstaPayModal(true);
  }, [instapayConfig, toast]);

  const handleInstaPayRequestCreated = useCallback((status: 'pending' | 'error', planKey: string) => {
    setInstapayRequestState({ planKey, status, timestamp: new Date() });
    // Refetch plans to potentially update UI based on backend payment_request status
    // For now, we rely on the local state to show 'under review'
    // fetchPlans();
  }, []);

  const getInstaPayStatusMessage = (planKey: string) => {
    if (instapayRequestState && instapayRequestState.planKey === planKey) {
      if (instapayRequestState.status === 'pending') {
        return "Payment under review...";
      } else if (instapayRequestState.status === 'error') {
        return "Payment request failed.";
      }
    }
    return null;
  }


  if (loadingPlans) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">Choose the plan that's right for you.</p>
        </div>
        {/* Billing cycle switch is commented out as backend currently only supports monthly */}
        {/* <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <span>Monthly</span>
          <Switch
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
          />
          <span>Yearly (Save 20%)</span>
        </div> */}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {availablePlans.map(plan => {
          const isPaidPlan = plan.price_monthly_cents > 0;
          const instaPayStatusMessage = getInstaPayStatusMessage(plan.plan_key);

          return (
            <Card key={plan.plan_key} className={cn("flex flex-col", plan.isPopular ? "border-primary" : "")}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <div className="text-4xl font-bold">
                  {plan.price_monthly_cents === 0 ? "Free" : `${(plan.price_monthly_cents / 100).toFixed(0)}`}
                  {plan.price_monthly_cents > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                </div>
                {plan.isCurrent && currentWorkspaceProvider !== 'none' && (
                    <p className="text-sm text-muted-foreground">
                        via {currentWorkspaceProvider === 'paymob' ? 'Paymob' : currentWorkspaceProvider}
                    </p>
                )}
                <ul className="space-y-2 text-sm">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  disabled={plan.isCurrent || upgradingPlanKey === plan.plan_key || !!instaPayStatusMessage}
                  onClick={() => onUpgradeClick(plan.plan_key)}
                >
                  {plan.isCurrent ? (
                    'Current Plan'
                  ) : (
                    upgradingPlanKey === plan.plan_key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Choose Plan'
                  )}
                </Button>
                {isPaidPlan && !plan.isCurrent && !instaPayStatusMessage && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => onInstaPayClick(plan)}
                    disabled={upgradingPlanKey === plan.plan_key}
                  >
                    Pay via InstaPay
                  </Button>
                )}
                {instaPayStatusMessage && (
                  <p className="text-sm text-center text-orange-500">
                    {instaPayStatusMessage}
                  </p>
                )}
              </CardFooter>
            </Card>
          );
        })}
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
                <Switch />
            </div>
             <div className="rounded-lg border p-4 flex justify-between items-center">
                <div>
                    <p className="font-medium">Advanced Analytics</p>
                    <p className="text-sm text-muted-foreground">$50/mo</p>
                </div>
                <Switch />
            </div>
        </CardContent>
      </Card>

      {/* InstaPay Modal */}
      {showInstaPayModal && selectedPlanForInstaPay && instapayConfig && workspace?.id && (
        <InstaPayModal
          isOpen={showInstaPayModal}
          onClose={() => setShowInstaPayModal(false)}
          workspaceId={workspace.id}
          planKey={selectedPlanForInstaPay.plan_key}
          amountEGP={selectedPlanForInstaPay.price_monthly_cents / 100}
          instapayConfig={instapayConfig}
          onPaymentRequestCreated={(status) => handleInstaPayRequestCreated(status, selectedPlanForInstaPay.plan_key)}
        />
      )}
    </div>
  );
}
