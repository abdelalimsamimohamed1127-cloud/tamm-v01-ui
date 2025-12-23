export interface BillingSnapshot {
  planName: string;
  pricePerMonth: number;
  billingCycle: "monthly" | "yearly";
  usage: {
    messagesUsed: number;
    messagesLimit: number;
    tokensUsed: number;
    tokensLimit: number;
  };
}

export async function getBillingSnapshot(): Promise<BillingSnapshot> {
  // Mocked billing snapshot for preview purposes
  return Promise.resolve({
    planName: "Pro",
    pricePerMonth: 120,
    billingCycle: "monthly",
    usage: {
      messagesUsed: 6800,
      messagesLimit: 10000,
      tokensUsed: 9200000,
      tokensLimit: 10000000,
    },
  });
}
