"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const session = await authClient.getSession();
      setUser(session.data?.user);
      setLoading(false);
    };
    getUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Creem Better-Auth Test App</h1>
          <p className="text-lg text-gray-600">
            Test the Creem integration with Better-Auth locally
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          {user ? (
            <>
              <div className="border-b pb-4">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Welcome, {user.name || user.email}!
                </h2>
                <p className="text-gray-600 mt-2">You&apos;re successfully authenticated.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  href="/dashboard"
                  className="block p-6 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                >
                  <h3 className="font-semibold text-blue-900 mb-2">Dashboard</h3>
                  <p className="text-sm text-blue-700">View your account and subscription status</p>
                </Link>

                <Link
                  href="/pricing"
                  className="block p-6 bg-green-50 rounded-lg hover:bg-green-100 transition"
                >
                  <h3 className="font-semibold text-green-900 mb-2">Pricing</h3>
                  <p className="text-sm text-green-700">Subscribe to a plan using Creem</p>
                </Link>

                <Link
                  href="/portal"
                  className="block p-6 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                >
                  <h3 className="font-semibold text-purple-900 mb-2">Customer Portal</h3>
                  <p className="text-sm text-purple-700">Manage your subscription</p>
                </Link>

                <Link
                  href="/transactions"
                  className="block p-6 bg-orange-50 rounded-lg hover:bg-orange-100 transition"
                >
                  <h3 className="font-semibold text-orange-900 mb-2">Transactions</h3>
                  <p className="text-sm text-orange-700">View your transaction history</p>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-center space-y-4">
                <p className="text-gray-600">Please sign in to test the Creem integration</p>
                <div className="space-x-4">
                  <Link
                    href="/auth/signin"
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">Testing Features</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✅ Better-Auth authentication (email/password)</li>
            <li>✅ Creem plugin integration (local import)</li>
            <li>✅ Checkout creation</li>
            <li>✅ Customer portal access</li>
            <li>✅ Subscription management</li>
            <li>✅ Transaction history</li>
            <li>✅ Webhook handling</li>
            <li>✅ Access control (onGrantAccess/onRevokeAccess)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
