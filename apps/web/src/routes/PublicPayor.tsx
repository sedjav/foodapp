import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";

type WalletRow = {
  userId: string;
  balanceIrr: number;
};

type PayorChargeRow = {
  event_id: string;
  event_name: string;
  event_state: string;
  total_irr: number;
  finalized_at_utc: string;
};

type PaymentLinkRow = {
  id: string;
  event_id: string;
  event_name: string;
  payor_user_id: string;
  token: string;
  locked_amount_irr: number | null;
  status: string;
  created_at: string;
};

type WalletTxRow = {
  id: string;
  type: string;
  amount_irr: number;
  event_id: string | null;
  event_name: string | null;
  created_at: string;
};

export default function PublicPayor() {
  const { t } = useTranslation();
  const api = useApi();
  const { me, loading } = useAuth();

  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [charges, setCharges] = useState<PayorChargeRow[]>([]);
  const [links, setLinks] = useState<PaymentLinkRow[]>([]);
  const [txs, setTxs] = useState<WalletTxRow[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const load = async () => {
    setLoadingData(true);
    setError(null);

    try {
      const [wRes, cRes, lRes, txRes] = await Promise.all([
        api.fetch("/api/v1/wallet", { method: "GET" }),
        api.fetch("/api/v1/payor/charges", { method: "GET" }),
        api.fetch("/api/v1/payor/payment-links", { method: "GET" }),
        api.fetch("/api/v1/wallet/transactions", { method: "GET" })
      ]);

      setWallet((await wRes.json()) as WalletRow);
      setCharges((await cRes.json()) as PayorChargeRow[]);
      setLinks((await lRes.json()) as PaymentLinkRow[]);
      setTxs((await txRes.json()) as WalletTxRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!me) return;
    load();
  }, [me?.id]);

  const createPaymentLink = async (eventId: string) => {
    setError(null);
    try {
      await api.fetch(`/api/v1/payor/charges/${eventId}/payment-link`, { method: "POST" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const payWithWallet = async (token: string) => {
    setError(null);
    try {
      await api.fetch(`/api/v1/payment-links/${token}/pay-with-wallet`, { method: "POST" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const voidLink = async (token: string) => {
    setError(null);
    try {
      await api.fetch(`/api/v1/payment-links/${token}/void`, { method: "POST" });
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  const linkUrl = (token: string) => {
    const origin = globalThis.location?.origin ?? "";
    return `${origin}/pay/${token}`;
  };

  const copyLink = async (token: string) => {
    setError(null);
    try {
      await globalThis.navigator?.clipboard?.writeText(linkUrl(token));
      setCopiedToken(token);
      globalThis.setTimeout?.(() => setCopiedToken(null), 1500);
    } catch {
      setError(t("public.payor.copyFailed"));
    }
  };

  const linkForEvent = (eventId: string) => links.find((l) => l.event_id === eventId && l.status === "OPEN");

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!me) return <PublicLogin />;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{t("public.payor.title")}</Typography>
        <Link component={RouterLink} to="/events" underline="hover">{t("public.payor.backToEvents")}</Link>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loadingData ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          <Card>
            <CardHeader title={t("public.payor.walletTitle")} />
            <CardContent>
              <Typography variant="h4" color="primary">
                {(wallet?.balanceIrr ?? 0).toLocaleString()} IRR
              </Typography>
              <Typography variant="body2" color="text.secondary">{t("public.payor.balance")}</Typography>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={t("public.payor.chargesTitle")} />
            <CardContent>
              {charges.length === 0 ? (
                <Typography color="text.secondary">{t("public.payor.noCharges")}</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>{t("public.payor.event")}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{t("public.payor.amount")}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{t("public.payor.eventState")}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{t("public.payor.payment")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {charges.map((c) => {
                        const openLink = linkForEvent(c.event_id);
                        return (
                          <TableRow key={c.event_id} hover>
                            <TableCell>{c.event_name}</TableCell>
                            <TableCell>{c.total_irr.toLocaleString()} IRR</TableCell>
                            <TableCell>
                              <Chip label={c.event_state} size="small" />
                            </TableCell>
                            <TableCell>
                              {openLink ? (
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                  <Chip label={t("public.payor.linkOpen")} color="warning" size="small" />
                                  <Button size="small" variant="contained" onClick={() => payWithWallet(openLink.token)}>
                                    {t("public.payor.payWithWallet")}
                                  </Button>
                                  <Button size="small" variant="outlined" onClick={() => copyLink(openLink.token)}>
                                    {copiedToken === openLink.token ? t("public.payor.copied") : t("public.payor.copyLink")}
                                  </Button>
                                  <Button size="small" color="error" onClick={() => voidLink(openLink.token)}>
                                    {t("public.payor.voidLink")}
                                  </Button>
                                </Stack>
                              ) : (
                                <Button size="small" variant="outlined" onClick={() => createPaymentLink(c.event_id)}>
                                  {t("public.payor.createPaymentLink")}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title={t("public.payor.transactionsTitle")} />
            <CardContent>
              {txs.length === 0 ? (
                <Typography color="text.secondary">{t("public.payor.noTransactions")}</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>{t("public.payor.txType")}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{t("public.payor.txAmount")}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{t("public.payor.txEvent")}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{t("public.payor.txCreatedAt")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {txs.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell>{tx.type}</TableCell>
                          <TableCell>{tx.amount_irr.toLocaleString()} IRR</TableCell>
                          <TableCell>{tx.event_name ?? ""}</TableCell>
                          <TableCell>{tx.created_at}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
