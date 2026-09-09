import {
  Alert,
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  IconButtonGroup,
  Link,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Textarea,
  TextInput,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system";
import { CodeBlock, Cross, Pencil, Trash } from "@strapi/icons";
import { useFetchClient } from "@strapi/strapi/admin";
import { useEffect, useMemo, useState } from "react";

import { CREEM_CURRENCIES, CREEM_MINIMUMS, shimmerCss, styles, ui } from "../styles";
import {
  creemDashboardProductUrl,
  featureCount,
  formatPrice,
  isRecurring,
  subscriptionFrequencyLabel,
  type CreemProduct,
} from "../utils/creemProductFormat";

type ListResponse = { items: CreemProduct[] };
type DashboardAction = "edit" | "archive";

const Shimmer = ({ width = "100%", height = 14 }: { width?: string; height?: number }) => (
  <Box className="creemShimmer" width={width} height={`${height}px`} borderRadius="4px" />
);

const DASHBOARD_MODAL_COPY: Record<
  DashboardAction,
  { title: string; beforeLink: string; linkText: string; afterLink: string }
> = {
  edit: {
    title: "Edit product",
    beforeLink: "The Creem API does not support updating products yet. ",
    linkText: "Open the product in the Creem dashboard",
    afterLink: " to edit it.",
  },
  archive: {
    title: "Archive product",
    beforeLink: "The Creem API does not support archiving products via this plugin yet. ",
    linkText: "Open the product in the Creem dashboard",
    afterLink: " to archive it.",
  },
};

const HomePage = () => {
  const { get, post } = useFetchClient();

  const [list, setList] = useState<CreemProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [settings, setSettings] = useState<{ defaultCurrency?: string }>({});

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [dashboardAction, setDashboardAction] = useState<DashboardAction | null>(null);
  const [dashboardProduct, setDashboardProduct] = useState<CreemProduct | null>(null);

  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const [embedProduct, setEmbedProduct] = useState<CreemProduct | null>(null);

  const [paymentType, setPaymentType] = useState<"oneTime" | "subscription">("oneTime");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [isFreeProduct, setIsFreeProduct] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [paymentInterval, setPaymentInterval] = useState("month");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isSubscription = paymentType === "subscription";

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await get("/strapi5-plugin-for-creem/products");
      const data = res.data as ListResponse;
      setList(data.items ?? []);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadSettings = async () => {
    const res = await get("/strapi5-plugin-for-creem/settings");
    setSettings(res.data || {});
    if (res.data?.defaultCurrency) {
      setCurrency(String(res.data.defaultCurrency).toUpperCase());
    }
  };

  useEffect(() => {
    loadProducts();
    loadSettings();
  }, []);

  const resetForm = () => {
    setPaymentType("oneTime");
    setName("");
    setDescription("");
    setPrice(0);
    setIsFreeProduct(false);
    setCurrency((settings.defaultCurrency || "USD").toUpperCase());
    setPaymentInterval("month");
  };

  const openCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openDashboardModal = (product: CreemProduct, action: DashboardAction) => {
    setDashboardProduct(product);
    setDashboardAction(action);
  };

  const closeDashboardModal = () => {
    setDashboardProduct(null);
    setDashboardAction(null);
  };

  const submitCreate = async () => {
    setError("");
    setSuccess("");
    try {
      await post("/strapi5-plugin-for-creem/products", {
        name,
        description: description || undefined,
        paymentType,
        price,
        currency,
        recurringInterval: paymentInterval,
      });
      setSuccess("Product created.");
      setIsModalOpen(false);
      resetForm();
      loadProducts();
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setError(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.message ||
          "Request failed.",
      );
    }
  };

  const openEmbed = (product: CreemProduct) => {
    setEmbedProduct(product);
    setIsEmbedOpen(true);
  };

  const dashboardUrl = dashboardProduct ? creemDashboardProductUrl(dashboardProduct.id) : "";
  const dashboardCopy = dashboardAction ? DASHBOARD_MODAL_COPY[dashboardAction] : null;

  const embedSnippet = useMemo(() => {
    if (!embedProduct) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `<button
  data-creem-checkout
  data-api-url="${origin}"
  data-product-id="${embedProduct.id}"
  data-email="customer@email.com"
  data-success-url="https://your-site.com/success"
  data-metadata-order-id="ORDER_123"
>
  Buy now
</button>`;
  }, [embedProduct]);

  const embedScript = useMemo(
    () => `window.addEventListener('load', () => {
  document.querySelectorAll('[data-creem-checkout]').forEach((btn) => {
    btn.addEventListener('click', () => checkout(btn));
  });
  const params = new URLSearchParams(location.search);
  const checkoutId = params.get('checkout_id');
  if (checkoutId) console.log('Creem checkout_id', checkoutId);
});

function checkout(btn) {
  const apiUrl = btn.dataset.apiUrl;
  const productId = btn.dataset.productId;
  const email = btn.dataset.email;
  const success_url = btn.dataset.successUrl;
  if (!apiUrl || !productId || !email) return;
  const metadata = {};
  Object.keys(btn.dataset).forEach((k) => {
    if (k.startsWith('metadata')) {
      metadata[k.replace(/^metadata/, '').toLowerCase()] = btn.dataset[k];
    }
  });
  fetch(apiUrl + '/api/strapi5-plugin-for-creem/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metadata,
      productId,
      success_url,
      customer_email: email,
    }),
  })
    .then((r) => r.json())
    .then((r) => r.url && (location.href = r.url));
}`,
    [],
  );

  return (
    <Box padding={8}>
      <style>{shimmerCss}</style>
      <Flex {...ui.justifyBetween} alignItems="center" {...ui.pb6}>
        <Typography {...ui.headingBetaBold}>Products</Typography>
        <Button onClick={openCreate}>+ New Product</Button>
      </Flex>

      <Table colCount={6} rowCount={loadingProducts ? 6 : Math.max(list.length, 1)}>
        <Thead>
          <Tr>
            <Th>
              <Typography variant="sigma">ID</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Name</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Price</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Type</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Features</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Actions</Typography>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {loadingProducts &&
            Array.from({ length: 6 }).map((_, i) => (
              <Tr key={`loading-${i}`}>
                <Td>
                  <Shimmer width="90%" />
                </Td>
                <Td>
                  <Shimmer width="70%" />
                </Td>
                <Td>
                  <Shimmer width="50%" />
                </Td>
                <Td>
                  <Shimmer width="60%" />
                </Td>
                <Td>
                  <Shimmer width="25%" />
                </Td>
                <Td>
                  <Flex {...ui.rowGap2Wrap}>
                    <Shimmer width="28px" height={28} />
                    <Shimmer width="28px" height={28} />
                    <Shimmer width="28px" height={28} />
                  </Flex>
                </Td>
              </Tr>
            ))}
          {!loadingProducts && list.length === 0 && (
            <Tr>
              <Td colSpan={6}>
                <Box height="40px" style={{ display: "flex", alignItems: "center" }}>
                  <Typography textColor="neutral600">No products found.</Typography>
                </Box>
              </Td>
            </Tr>
          )}
          {!loadingProducts &&
            list.map((product) => (
              <Tr key={product.id}>
                <Td>
                  <Typography padding="4px 8px" borderRadius="4px" display="inline-block">
                    {product.id}
                  </Typography>
                </Td>
                <Td>
                  <Typography>{product.name}</Typography>
                </Td>
                <Td>
                  <Typography>{formatPrice(product)}</Typography>
                </Td>
                <Td>
                  <Typography>
                    {isRecurring(product)
                      ? `Subscription (${subscriptionFrequencyLabel(product) || "-"})`
                      : "One-time"}
                  </Typography>
                </Td>
                <Td>
                  <Typography>{featureCount(product)}</Typography>
                </Td>
                <Td>
                  <IconButtonGroup>
                    <IconButton label="Embed snippet" onClick={() => openEmbed(product)}>
                      <CodeBlock />
                    </IconButton>
                    <IconButton
                      label="Edit"
                      variant="secondary"
                      onClick={() => openDashboardModal(product, "edit")}
                    >
                      <Pencil />
                    </IconButton>
                    <IconButton
                      label="Archive"
                      variant="danger"
                      onClick={() => openDashboardModal(product, "archive")}
                    >
                      <Trash />
                    </IconButton>
                  </IconButtonGroup>
                </Td>
              </Tr>
            ))}
        </Tbody>
      </Table>

      {success && (
        <Box {...ui.pt4}>
          <Alert title="Done" variant="success" closeLabel="Close">
            {success}
          </Alert>
        </Box>
      )}

      {dashboardAction && dashboardProduct && dashboardCopy && (
        <>
          <Box {...ui.modalOverlay} onClick={closeDashboardModal} />
          <Box {...ui.modalWrapper}>
            <Box {...ui.modalCard} style={{ maxHeight: "none", overflowY: "visible" }}>
              <Box {...ui.modalHeader}>
                <Flex {...ui.justifyBetween} alignItems="center">
                  <Typography {...ui.headingBetaBold}>{dashboardCopy.title}</Typography>
                  <IconButton label="Close" variant="tertiary" onClick={closeDashboardModal}>
                    <Cross />
                  </IconButton>
                </Flex>
              </Box>

              <Box {...ui.modalBody}>
                <Box padding={4} background="neutral100" hasRadius>
                  <Typography fontWeight="bold" marginBottom={2} variant="sigma">
                    Use the Creem dashboard
                  </Typography>
                  <Typography>
                    {dashboardCopy.beforeLink}
                    <Link href={dashboardUrl} isExternal>
                      {dashboardCopy.linkText}
                    </Link>
                    {dashboardCopy.afterLink}
                  </Typography>
                </Box>
              </Box>

              <Box {...ui.modalFooter}>
                <Flex {...ui.justifyEnd} gap={2}>
                  <Button variant="tertiary" onClick={closeDashboardModal}>
                    Close
                  </Button>
                  <Link href={dashboardUrl} isExternal>
                    <Button>Open Creem dashboard</Button>
                  </Link>
                </Flex>
              </Box>
            </Box>
          </Box>
        </>
      )}

      {isModalOpen && (
        <>
          <Box {...ui.modalOverlay} />
          <Box {...ui.modalWrapper}>
            <Box {...ui.modalCard}>
              <Box {...ui.modalHeader}>
                <Flex {...ui.justifyBetween} alignItems="center">
                  <Typography {...ui.headingBetaBold}>Create product</Typography>
                  <IconButton
                    label="Close"
                    variant="tertiary"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                  >
                    <Cross />
                  </IconButton>
                </Flex>
              </Box>

              <Box {...ui.modalBody}>
                <Flex {...ui.formStack}>
                  <Box {...ui.field}>
                    <Typography {...ui.fieldLabel} {...ui.pb2}>
                      Name
                    </Typography>
                    <Box {...ui.mt2}>
                      <TextInput
                        style={styles.inputFullWidth}
                        value={name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setName(e.target.value)
                        }
                      />
                    </Box>
                  </Box>

                  <Box {...ui.field}>
                    <Typography {...ui.fieldLabel}>Payment type</Typography>
                    <Flex {...ui.buttonRow} {...ui.mt2}>
                      <Button
                        variant={paymentType === "oneTime" ? "default" : "secondary"}
                        onClick={() => setPaymentType("oneTime")}
                      >
                        One-time
                      </Button>
                      <Button
                        variant={paymentType === "subscription" ? "default" : "secondary"}
                        onClick={() => setPaymentType("subscription")}
                      >
                        Subscription
                      </Button>
                    </Flex>

                    {isSubscription && (
                      <Box {...ui.mt4}>
                        <Typography {...ui.fieldLabel}>Billing interval</Typography>
                        <Flex {...ui.buttonRow} {...ui.mt2}>
                          {[
                            { value: "day", label: "Daily" },
                            { value: "month", label: "Monthly" },
                            { value: "3months", label: "3 months" },
                            { value: "6months", label: "6 months" },
                            { value: "year", label: "Yearly" },
                          ].map(({ value, label }) => (
                            <Button
                              key={value}
                              style={{ flex: "1", minWidth: 96 }}
                              variant={paymentInterval === value ? "default" : "secondary"}
                              onClick={() => setPaymentInterval(value)}
                            >
                              {label}
                            </Button>
                          ))}
                        </Flex>
                      </Box>
                    )}
                  </Box>

                  <Box {...ui.field}>
                    <Typography {...ui.fieldLabel} {...ui.pb2}>
                      Description
                    </Typography>
                    <Box {...ui.mt2}>
                      <Textarea
                        style={styles.descriptionTextarea}
                        name="description"
                        value={description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setDescription(e.target.value)
                        }
                      />
                    </Box>
                  </Box>

                  <Box {...ui.field}>
                    <Typography {...ui.fieldLabel} {...ui.pb2}>
                      Price
                    </Typography>
                    <Flex direction="column" alignItems="flex-start" marginTop={2} gap={4}>
                      <Checkbox
                        checked={isFreeProduct}
                        onCheckedChange={(v: boolean) => {
                          setIsFreeProduct(v);
                          if (v) setPrice(0);
                        }}
                      >
                        Free product
                      </Checkbox>
                      <Typography variant="pi" textColor="neutral600">
                        {isFreeProduct
                          ? "Creem accepts a price of 0 for free products."
                          : `Enter 0 for free, or at least ${CREEM_MINIMUMS[currency.toLowerCase()] ?? "1.00"} for paid products.`}
                      </Typography>
                      <NumberInput
                        style={styles.inputFullWidth}
                        disabled={isFreeProduct}
                        value={price}
                        onValueChange={(v: number | undefined) => setPrice(v ?? 0)}
                      />
                    </Flex>
                  </Box>

                  <Box {...ui.field}>
                    <Typography {...ui.fieldLabel} {...ui.pb2}>
                      Currency
                    </Typography>
                    <Box {...ui.mt2}>
                      <SingleSelect
                        value={currency}
                        onChange={(v: string | number) => setCurrency(String(v).toUpperCase())}
                      >
                        {CREEM_CURRENCIES.map((c) => (
                          <SingleSelectOption key={c} value={c.toUpperCase()}>
                            {c.toUpperCase()}
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Box>
                  </Box>
                </Flex>
              </Box>

              {error && (
                <Box paddingLeft={6} paddingRight={6}>
                  <Alert variant="danger" title="Error" closeLabel="Close">
                    {error}
                  </Alert>
                </Box>
              )}

              <Box {...ui.modalFooter}>
                <Flex {...ui.justifyEnd}>
                  <Button disabled={!name.trim()} onClick={submitCreate}>
                    Create
                  </Button>
                </Flex>
              </Box>
            </Box>
          </Box>
        </>
      )}

      {isEmbedOpen && embedProduct && (
        <>
          <Box {...ui.embedOverlay} onClick={() => setIsEmbedOpen(false)} />
          <Box {...ui.embedCard}>
            <Box {...ui.modalHeader}>
              <Typography {...ui.headingBetaBold}>Checkout integration</Typography>
              <Box marginTop={4}>
                <Typography {...ui.fieldLabel}>
                  1. Add the client-side script to your website
                </Typography>
                <Box marginTop={2} padding={3} background="neutral100" borderRadius="4px">
                  <pre
                    style={{ overflow: "auto", fontSize: 12, height: "100px" }}
                  >{`<script>\n${embedScript}\n</script>`}</pre>
                </Box>
              </Box>
              <Box marginTop={4}>
                <Typography {...ui.fieldLabel}>2. Add a checkout button to your website</Typography>
                <Box marginTop={2} padding={3} background="neutral100" borderRadius="4px">
                  <pre style={{ overflow: "auto", fontSize: 12 }}>{embedSnippet}</pre>
                </Box>
              </Box>
            </Box>
            <Box padding={6}>
              <Flex {...ui.justifyEnd}>
                <Button onClick={() => setIsEmbedOpen(false)}>Close</Button>
              </Flex>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export { HomePage };
