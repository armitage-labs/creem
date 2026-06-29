export default () => ({
  type: "content-api" as const,
  routes: [
    {
      method: "POST",
      path: "/checkout",
      handler: "creemController.checkout",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/webhook",
      handler: "creemController.webhook",
      config: {
        auth: false,
      },
    },
  ],
});
