// src/components/landing/PricingSection.tsx

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingPricingPlan } from '@/services/landing'; // Import the interface

interface PricingSectionProps {
  pricingPlans: LandingPricingPlan[];
  content: { // jsonb content for the section itself
    title?: string;
    description?: string;
    cta_text?: string;
  };
}

const PricingSection: React.FC<PricingSectionProps> = ({ pricingPlans, content }) => {
  return (
    <section id="pricing" className="py-20 bg-muted">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-6 text-foreground">{content.title || 'Flexible Pricing Plans'}</h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          {content.description || 'Choose the plan that best fits your business needs.'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingPlans.map((plan) => (
            <div key={plan.id} className="bg-card text-card-foreground rounded-lg shadow-lg p-8 flex flex-col justify-between border border-primary/20">
              <div>
                <h3 className="text-2xl font-bold mb-4">{plan.name}</h3>
                <p className="text-5xl font-extrabold mb-6">
                  {plan.currency} {plan.price_monthly}
                  <span className="text-lg font-medium text-muted-foreground">/month</span>
                </p>
                <ul className="text-left space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-muted-foreground">
                      <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Button size="lg" className="w-full">
                {plan.cta_label || 'Get Started'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
