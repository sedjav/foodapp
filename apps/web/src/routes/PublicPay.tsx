import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useParams } from "react-router-dom";

import { useApi, useAuth } from "../auth";
import PublicLogin from "./PublicLogin";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Link,
  Stack,
  Typography
} from "@mui/material";

type PaymentLinkDetail = {
  event_id: string;
  event_name: string;
  status: string;
  locked_amount_irr: number | null;
};

export default function PublicPay() {
  const { t } = useTranslation();
  const api = useApi();
  const { me, loading } = useAuth();
  const { token } = useParams();

  const [data, setData] = useState<PaymentLinkDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoadingData(true);
    setError(null);

    try {
      const res = await api.fetch(`/api/v1/payment-links/${token}`, { method: "GET" });
      setData((await res.json()) as PaymentLinkDetail);
    } catch (err: any) {
      setError(err?.message ?? "Error");
      setData(null);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const payWithWallet = async () => {
    if (!token) return;
    setError(null);
    try {
      await api.fetch(`/api/v1/payment-links/${token}/pay-with-wallet`, { method: "POST" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const voidLink = async () => {
    if (!token) return;
    setError(null);
    try {
      await api.fetch(`/api/v1/payment-links/${token}/void`, { method: "POST" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{t("public.pay.title")}</Typography>
        <Link component={RouterLink} to="/" underline="hover">{t("public.pay.home")}</Link>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loadingData ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : !data ? (
        <Alert severity="warning">{t("public.pay.notFound")}</Alert>
      ) : (
        <Card>
          <CardHeader
            title={data.event_name}
            action={
              <Chip
                label={data.status}
                color={data.status === "PAID" ? "success" : data.status === "VOID" ? "error" : "warning"}
              />
            }
          />
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="body1">
                <strong>{t("public.pay.amount")}:</strong> {(data.locked_amount_irr ?? 0).toLocaleString()} IRR
              </Typography>

              {data.status === "PAID" && (
                <Alert severity="success">{t("public.pay.statusPaid")}</Alert>
              )}
              {data.status === "VOID" && (
                <Alert severity="error">{t("public.pay.statusVoid")}</Alert>
              )}

              {data.status === "OPEN" && (
                <Box>
                  {!me ? (
                    <>
                      <Typography color="text.secondary" sx={{ mb: 2 }}>{t("public.pay.loginToPay")}</Typography>
                      <PublicLogin />
                    </>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" onClick={payWithWallet}>{t("public.pay.payWithWallet")}</Button>
                      <Button variant="outlined" color="error" onClick={voidLink}>{t("public.pay.voidLink")}</Button>
                    </Stack>
                  )}
                </Box>
              )}

              {me && (
                <Link component={RouterLink} to="/payor" underline="hover">
                  {t("public.pay.goToPayor")}
                </Link>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
