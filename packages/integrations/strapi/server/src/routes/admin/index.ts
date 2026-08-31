export default () => ({
  type: "admin" as const,
  routes: [
    {
      method: "GET",
      path: "/settings",
      handler: "creemController.getSettings",
      config: {
        auth: {
          admin: true,
        },
      },
    },
    {
      method: "PUT",
      path: "/settings",
      handler: "creemController.updateSettings",
      config: {
        auth: {
          admin: true,
        },
      },
    },
    {
      method: "GET",
      path: "/products",
      handler: "creemController.listProducts",
      config: {
        auth: {
          admin: true,
        },
      },
    },
    {
      method: "GET",
      path: "/products/:id",
      handler: "creemController.getProduct",
      config: {
        auth: {
          admin: true,
        },
      },
    },
    {
      method: "POST",
      path: "/products",
      handler: "creemController.createProduct",
      config: {
        auth: {
          admin: true,
        },
      },
    },
    {
      method: "PATCH",
      path: "/products/:id",
      handler: "creemController.updateProduct",
      config: {
        auth: {
          admin: true,
        },
      },
    },
    {
      method: "PUT",
      path: "/products/:id",
      handler: "creemController.updateProduct",
      config: {
        auth: {
          admin: true,
        },
      },
    },
  ],
});
