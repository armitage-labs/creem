"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const session = await authClient.getSession();

      if (!session.data?.user) {
        router.push("/auth/signin");
        return;
      }

      setUser(session.data.user);

      // Check if user has active subscription
      try {
        const accessResult = await authClient.creem.hasAccessGranted();
        setHasAccess(accessResult.data?.hasAccessGranted || false);

        // Try to get subscription details
        if (accessResult.data?.hasAccessGranted) {
          // You would need the subscription ID here
          // const subResult = await creemClient.retrieveSubscription({
          //   subscriptionId: "sub_xxx"
          // });
          // setSubscription(subResult.data);
        }
      } catch (error) {
        console.error("Error checking subscription:", error);
      }

      setLoading(false);
    };

    fetchData();
  }, [router]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* User Info Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-600">Name:</span>
                <p className="font-medium">{user?.name || "Not set"}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Email:</span>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">User ID:</span>
                <p className="font-mono text-sm">{user?.id}</p>
              </div>
            </div>
          </div>

          {/* Subscription Status Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription Status</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${hasAccess ? "bg-green-500" : "bg-gray-300"}`}
                ></div>
                <span className="font-medium">
                  {hasAccess ? "Active Subscription" : "No Active Subscription"}
                </span>
              </div>

              {!hasAccess && (
                <Link
                  href="/pricing"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Subscribe Now
                </Link>
              )}

              {hasAccess && (
                <div className="space-y-2">
                  <Link
                    href="/portal"
                    className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium mr-2"
                  >
                    Manage Subscription
                  </Link>
                  <Link
                    href="/transactions"
                    className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                  >
                    View Transactions
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/pricing"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">View Pricing</h3>
              <p className="text-sm text-gray-600">Explore available subscription plans</p>
            </Link>

            <Link
              href="/portal"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Customer Portal</h3>
              <p className="text-sm text-gray-600">Manage billing and subscriptions</p>
            </Link>

            <Link
              href="/transactions"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition"
            >
              <h3 className="font-semibold text-gray-900 mb-1">Transactions</h3>
              <p className="text-sm text-gray-600">View your payment history</p>
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
