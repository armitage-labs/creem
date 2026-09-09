/* eslint-disable react/no-unescaped-entities */
"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Pricing() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const session = await authClient.getSession();
      setUser(session.data?.user);
    };
    getUser();
  }, []);

  const handleSubscribe = async (productId: string, planName: string) => {
    if (!user) {
      router.push("/auth/signin");
      return;
    }

    setLoading(true);
    setSelectedPlan(productId);

    try {
      // Create a checkout session using the Creem plugin
      const result = await authClient.creem.createCheckout({
        productId,
        successUrl: `${window.location.origin}/success`,
        customer: {
          email: user.email,
        },
      });

      if (result.data?.url) {
        // Redirect to Creem checkout page
        window.location.href = result.data.url;
      } else if (result.error) {
        alert(`Error: ${result.error.message}`);
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      alert(`Error creating checkout: ${error.message}`);
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  const plans = [
    {
      id: "add-your-product-id-here",
      name: "Starter",
      price: "$9",
      period: "month",
      features: ["Basic features", "Up to 10 users", "Email support", "1GB storage"],
    },
    {
      id: "add-your-product-id-here",
      name: "Pro",
      price: "$29",
      period: "month",
      features: [
        "All Starter features",
        "Up to 50 users",
        "Priority support",
        "10GB storage",
        "Advanced analytics",
      ],
      popular: true,
    },
    {
      id: "add-your-product-id-here",
      name: "Enterprise",
      price: "$99",
      period: "month",
      features: [
        "All Pro features",
        "Unlimited users",
        "24/7 phone support",
        "100GB storage",
        "Custom integrations",
        "Dedicated account manager",
      ],
    },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
          <p className="text-lg text-gray-600">Select a plan that works best for you</p>
        </div>

        {!user && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-blue-800">
              Please{" "}
              <Link href="/auth/signin" className="font-semibold underline">
                sign in
              </Link>{" "}
              to subscribe to a plan
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-lg p-8 relative ${
                plan.popular ? "ring-2 ring-blue-500" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1 rounded-bl-lg rounded-tr-lg text-sm font-semibold">
                  Popular
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-600">/{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id, plan.name)}
                disabled={loading || !user}
                className={`w-full py-3 rounded-lg font-medium transition ${
                  plan.popular
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading && selectedPlan === plan.id ? "Processing..." : "Subscribe"}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-gray-100 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-3">💡 Testing Instructions</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>
              1. Make sure you have set up your Creem API key in{" "}
              <code className="bg-white px-2 py-1 rounded">.env.local</code>
            </li>
            <li>
              2. Replace the <code className="bg-white px-2 py-1 rounded">productId</code> values
              above with actual product IDs from your Creem dashboard
            </li>
            <li>3. Click "Subscribe" to create a checkout session</li>
            <li>4. Complete the checkout on Creem's hosted page</li>
            <li>
              5. The webhook will trigger the{" "}
              <code className="bg-white px-2 py-1 rounded">onGrantAccess</code> callback
            </li>
          </ul>
        </div>

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
