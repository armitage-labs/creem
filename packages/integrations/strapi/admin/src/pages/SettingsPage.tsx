import { Alert, Box, Button, Flex, TextInput, Typography } from "@strapi/design-system";
import { useFetchClient } from "@strapi/strapi/admin";
import { useEffect, useState } from "react";
import { ui } from "../styles";

type SettingsData = {
  environment: "test" | "production";
  defaultCurrency: string;
  checkout: { successUrl: string };
  webhook: { forwardUrl: string };
};

type SettingsResponse = SettingsData & {
  availableEnvironments?: { test?: boolean; production?: boolean };
};

const SettingsPage = () => {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { get, put } = useFetchClient();

  useEffect(() => {
    const load = async () => {
      const res = await get("/strapi5-plugin-for-creem/settings");
      const d = (res.data || {}) as SettingsResponse;
      setData({
        environment: d.environment ?? "test",
        defaultCurrency: (d.defaultCurrency ?? "USD").toUpperCase(),
        checkout: {
          successUrl: d.checkout?.successUrl ?? "",
        },
        webhook: { forwardUrl: d.webhook?.forwardUrl ?? "" },
      });
    };
    load();
  }, [get]);

  const save = async () => {
    setError("");
    setSuccess("");
    if (!data) return;
    setLoading(true);
    try {
      await put("/strapi5-plugin-for-creem/settings", {
        ...data,
      });
      setSuccess("Settings saved.");
      setTimeout(() => {
        setSuccess("");
      }, 2000);
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setError(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.message ||
          "An unexpected error occurred.",
      );
    }
    setLoading(false);
  };
  if (!data) return null;
  return (
    <Box padding={8}>
      <Box
        width="100%"
        maxWidth="1000px"
        margin="0 auto"
        background="neutral0"
        borderRadius="8px"
        shadow="tableShadow"
        padding={7}
      >
        <Flex {...ui.settingsHeader}>
          <Typography {...ui.settingsTitle}>Settings</Typography>
          <Typography {...ui.settingsSubtitle}>
            Configure your Creem environment, checkout redirects and webhook forwarding.
          </Typography>
        </Flex>
        <Box marginTop={7} {...ui.settingsStack}>
          <Box>
            <Typography variant="pi" fontWeight="bold">
              Environment
            </Typography>
            <Flex gap={2} marginTop={3} wrap="wrap">
              <Button
                variant={data.environment === "test" ? "default" : "secondary"}
                onClick={() => setData({ ...data, environment: "test" })}
              >
                Test mode
              </Button>
              <Button
                variant={data.environment === "production" ? "default" : "secondary"}
                onClick={() => setData({ ...data, environment: "production" })}
              >
                Production
              </Button>
            </Flex>
          </Box>
          <Box>
            <Typography variant="pi" fontWeight="bold">
              Checkout success URL
            </Typography>
            <br />
            <Typography {...ui.helpText}>
              Optional. Customers are redirected here after a successful checkout.
            </Typography>
            <Box marginTop={2}>
              <TextInput
                placeholder="https://your-site.com/success"
                value={data.checkout.successUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setData({
                    ...data,
                    checkout: {
                      ...data.checkout,
                      successUrl: e.target.value,
                    },
                  })
                }
              />
            </Box>
          </Box>
          <Box>
            <Typography variant="pi" fontWeight="bold">
              Webhook forward URL (optional)
            </Typography>
            <br />
            <Typography {...ui.helpText}>
              If set, the plugin will verify Creem&apos;s signature and then POST the parsed event
              JSON to this URL.
            </Typography>
            <Box marginTop={2}>
              <TextInput
                placeholder="https://example.com/creem/webhook"
                value={data.webhook.forwardUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setData({
                    ...data,
                    webhook: { forwardUrl: e.target.value },
                  })
                }
              />
            </Box>
          </Box>
          <Box>
            <Typography variant="pi" fontWeight="bold">
              Webhook secret
            </Typography>
            <br />
            <Typography {...ui.helpText}>
              Must match <code>STRAPI_CREEM_WEBHOOK_SECRET</code> on your server (from Creem
              Developers → Webhook).
            </Typography>
          </Box>
        </Box>
        <Flex justifyContent="flex-end" marginTop={7}>
          <Button loading={loading} onClick={save}>
            Save
          </Button>
        </Flex>
        <Box paddingTop={6}>
          {error && (
            <Box paddingBottom={4}>
              <Alert variant="danger" title="Save failed" closeLabel="Close">
                {error}
              </Alert>
            </Box>
          )}
          {success && (
            <Box paddingBottom={4}>
              <Alert variant="success" title="Success" closeLabel="Close">
                {success}
              </Alert>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default SettingsPage;
