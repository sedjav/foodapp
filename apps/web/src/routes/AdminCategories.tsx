import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useApi } from "../auth";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";

type CategoryRow = {
  id: string;
  code: string;
  name_en: string;
  name_fa: string;
  sort_order: number;
  is_active: number;
  created_at: string;
};

export default function AdminCategories() {
  const { t } = useTranslation();
  const api = useApi();

  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameFa, setNameFa] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.fetch("/api/v1/admin/menu-item-categories", { method: "GET" });
      setRows((await res.json()) as CategoryRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await api.fetch("/api/v1/admin/menu-item-categories", {
        method: "POST",
        body: JSON.stringify({
          code,
          nameEn,
          nameFa,
          sortOrder
        })
      });

      setCode("");
      setNameEn("");
      setNameFa("");
      setSortOrder(0);

      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error");
    }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Card sx={{ flex: 1, maxWidth: 480 }}>
          <CardHeader title={t("admin.categories.title")} subheader="Create a new category" />
          <CardContent>
            <Box component="form" onSubmit={create}>
              <Stack spacing={2}>
                <TextField
                  label={t("admin.categories.code")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="main"
                  fullWidth
                  size="small"
                />
                <TextField
                  label={t("admin.categories.nameEn")}
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Main"
                  fullWidth
                  size="small"
                />
                <TextField
                  label={t("admin.categories.nameFa")}
                  value={nameFa}
                  onChange={(e) => setNameFa(e.target.value)}
                  placeholder="غذای اصلی"
                  fullWidth
                  size="small"
                />
                <TextField
                  label={t("admin.categories.sortOrder")}
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  fullWidth
                  size="small"
                />
                <Button type="submit" variant="contained">{t("admin.categories.create")}</Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 2 }}>
          <CardHeader title="Categories List" />
          <CardContent>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.categories.code")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.categories.nameEn")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.categories.nameFa")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t("admin.categories.sortOrder")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>{r.code}</TableCell>
                        <TableCell>{r.name_en}</TableCell>
                        <TableCell>{r.name_fa}</TableCell>
                        <TableCell>{r.sort_order}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
