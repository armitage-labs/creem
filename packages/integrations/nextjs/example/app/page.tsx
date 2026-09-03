"use client";

import { CreemCheckout, CreemPortal } from "@creem_io/nextjs";

export default function Home() {
  const handleCreateCheckout = () => {
    console.log("Create Checkout");
  };
  return (
    <div className="p-[15vw]">
      {/* Checkout component - automatically redirects to /checkout route handler */}
      <div className="mb-4">
        <CreemCheckout
          productId="prod_7CIbZEZnRC5DWibmoOboOu"
          units={2}
          // discountCode="TEST"
          // customer={{
          //   email: "test@test.com",
          //   name: "Test User",
          // }}
          successUrl="/success"
          metadata={{
            orderId: "1234567890",
            source: "web",
          }}
          referenceId="user_1234567890"
        >
          <button onClick={handleCreateCheckout} className="bg-amber-400">
            Buy Now - Checkout
          </button>
        </CreemCheckout>
      </div>

      {/* Portal component - automatically redirects to /portal route handler */}
      <div className="mb-4">
        <CreemPortal
          customerId="cust_cZsJG3rvrBeWqEGVwXHLv"
          className="bg-green-900 text-white p-2 rounded-md hover:bg-green-800"
        >
          Customer Portal
        </CreemPortal>
      </div>
    </div>
  );
}
