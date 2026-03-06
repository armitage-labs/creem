"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isPending) return <p>Loading...</p>;

  if (!session) {
    return (
      <div>
        <h1>Creem + Better-Auth Example</h1>
        <h2>{isSignUp ? "Sign Up" : "Sign In"}</h2>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setLoading(true);
            try {
              if (isSignUp) {
                const { error } = await authClient.signUp.email({
                  email,
                  password,
                  name,
                });
                if (error) setError(error.message ?? "Sign up failed");
              } else {
                const { error } = await authClient.signIn.email({
                  email,
                  password,
                });
                if (error) setError(error.message ?? "Sign in failed");
              }
            } finally {
              setLoading(false);
            }
          }}
        >
          {isSignUp && (
            <div style={{ marginBottom: 8 }}>
              <label>
                Name
                <br />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ width: "100%", padding: 8 }}
                />
              </label>
            </div>
          )}
          <div style={{ marginBottom: 8 }}>
            <label>
              Email
              <br />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>
              Password
              <br />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: "100%", padding: 8 }}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "8px 16px", marginRight: 8 }}
          >
            {loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
          <button type="button" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Have an account? Sign In" : "Need an account? Sign Up"}
          </button>
        </form>
      </div>
    );
  }

  return <Dashboard />;
}

function Dashboard() {
  const { data: session } = authClient.useSession();
  const [accessStatus, setAccessStatus] = useState<{
    hasAccessGranted: boolean | undefined;
    message?: string;
  } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<
    { id: string; amount: number; currency: string; type: string }[] | null
  >(null);

  const checkAccess = async () => {
    const { data } = await authClient.creem.hasAccessGranted();
    if (data) setAccessStatus(data);
  };

  const handleCheckout = async (productId: string, label: string) => {
    setCheckoutLoading(label);
    try {
      const { data, error } = await authClient.creem.createCheckout({
        productId,
        successUrl: `${window.location.origin}/success`,
      });
      if (error) {
        alert(error.message ?? "Checkout failed");
        return;
      }
      if (data && "url" in data && data.url) {
        window.location.href = data.url;
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    const { data, error } = await authClient.creem.createPortal();
    if (error) {
      alert(error.message ?? "Portal failed");
      return;
    }
    if (data && "url" in data && data.url) {
      window.location.href = data.url;
    } else if (data && "error" in data) {
      alert((data as { error: string }).error);
    }
  };

  const handleTransactions = async () => {
    const { data, error } = await authClient.creem.searchTransactions();
    if (error) {
      console.error("Error fetching transactions:", error);
      alert(error.message ?? "Failed to load transactions");
      return;
    }
    if (data && "items" in data) {
      setTransactions(
        (data.items as { id: string; amount: number; currency: string; type: string }[]) ?? [],
      );
    }
  };

  const onetimeProductId = process.env.NEXT_PUBLIC_CREEM_ONETIME_PRODUCT_ID;
  const subscriptionProductId =
    process.env.NEXT_PUBLIC_CREEM_SUBSCRIPTION_PRODUCT_ID;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>
        Signed in as <strong>{session?.user?.email}</strong>
      </p>

      <hr />
      <h2>Products</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onetimeProductId && (
          <button
            onClick={() => handleCheckout(onetimeProductId, "onetime")}
            disabled={checkoutLoading !== null}
            style={{ padding: "8px 16px" }}
          >
            {checkoutLoading === "onetime"
              ? "..."
              : "Buy One-Time Product"}
          </button>
        )}
        {subscriptionProductId && (
          <button
            onClick={() =>
              handleCheckout(subscriptionProductId, "subscription")
            }
            disabled={checkoutLoading !== null}
            style={{ padding: "8px 16px" }}
          >
            {checkoutLoading === "subscription"
              ? "..."
              : "Subscribe"}
          </button>
        )}
        {!onetimeProductId && !subscriptionProductId && (
          <p style={{ color: "#888" }}>
            Set NEXT_PUBLIC_CREEM_ONETIME_PRODUCT_ID or
            NEXT_PUBLIC_CREEM_SUBSCRIPTION_PRODUCT_ID in .env.local
          </p>
        )}
      </div>

      <hr />
      <h2>Subscription Status</h2>
      <button onClick={checkAccess} style={{ padding: "8px 16px" }}>
        Check Access
      </button>
      {accessStatus && (
        <p>
          Access:{" "}
          <strong>
            {accessStatus.hasAccessGranted ? "Granted" : "Not granted"}
          </strong>
          {accessStatus.message && (
            <span style={{ color: "#888" }}> — {accessStatus.message}</span>
          )}
        </p>
      )}

      <hr />
      <h2>Account</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={handlePortal} style={{ padding: "8px 16px" }}>
          Customer Portal
        </button>
        <button onClick={handleTransactions} style={{ padding: "8px 16px" }}>
          View Transactions
        </button>
        <button
          onClick={() => authClient.signOut()}
          style={{ padding: "8px 16px" }}
        >
          Sign Out
        </button>
      </div>

      {transactions !== null && (
        <div style={{ marginTop: 16 }}>
          <h3>Transactions</h3>
          {transactions.length === 0 ? (
            <p style={{ color: "#888" }}>No transactions found.</p>
          ) : (
            <ul>
              {transactions.map((tx) => (
                <li key={tx.id}>
                  {tx.type} — {tx.amount / 100} {tx.currency}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
