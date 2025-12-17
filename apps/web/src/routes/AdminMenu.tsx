import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

import { useApi } from "../auth";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Autocomplete,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";

type MenuItemRow = {
  id: string;
  menu_id: string;
  name: string;
  price_irr: number;
  category_id: string | null;
  tags: string[];
  is_active: number;
  created_at: string;
};

type CategoryRow = {
  id: string;
  code: string;
  name_en: string;
  name_fa: string;
  sort_order: number;
  is_active: number;
  created_at: string;
};

export default function AdminMenu() {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const { menuId } = useParams();

  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [priceIrr, setPriceIrr] = useState(0);
  const [categoryId, setCategoryId] = useState<string>("uncategorized");
  const [tags, setTags] = useState<string[]>([]);

  const load = async () => {
    if (!menuId) return;
    setLoading(true);
    setError(null);

    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        api.fetch(`/api/v1/admin/menus/${menuId}/items`, { method: "GET" }),
        api.fetch(`/api/v1/admin/menu-item-categories`, { method: "GET" })
      ]);
      setItems((await itemsRes.json()) as MenuItemRow[]);
      setCategories((await categoriesRes.json()) as CategoryRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [menuId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuId) return;

    setError(null);
    try {
      await api.fetch(`/api/v1/admin/menus/${menuId}/items`, {
        method: "POST",
        body: JSON.stringify({
          name,
          priceIrr,
          categoryId,
          tags
        })
      });
      setName("");
      setPriceIrr(0);
      setCategoryId("uncategorized");
      setTags([]);
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
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Card sx={{ flex: 1, maxWidth: 400 }}>
          <CardHeader title={t("admin.menu.title")} subheader="Add a new menu item" />
          <CardContent>
            <Box component="form" onSubmit={create}>
              <Stack spacing={2}>
                <TextField
                  label={t("admin.menu.itemName")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label={t("admin.menu.priceIrr")}
                  type="number"
                  value={priceIrr}
                  onChange={(e) => setPriceIrr(Number(e.target.value))}
                  fullWidth
                  size="small"
                />
                <FormControl fullWidth size="small">
                  <InputLabel>{t("admin.menu.category")}</InputLabel>
                  <Select
                    value={categoryId}
                    label={t("admin.menu.category")}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {i18n.language === "fa" ? c.name_fa : c.name_en}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={tags}
                  onChange={(_e, v) => setTags(v.map((x) => x.trim()).filter((x) => x))}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" size="small" label={option} {...getTagProps({ index })} key={`${option}-${index}`} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("admin.menu.tags") ?? "Tags"}
                      placeholder={t("admin.menu.tagsPlaceholder") ?? "kids, spicy"}
                      size="small"
                    />
                  )}
                />
                <Button type="submit" variant="contained">{t("admin.menu.create")}</Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 2 }}>
          <CardHeader title="Menu Items" />
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.menu.itemName")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.menu.priceIrr")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.menu.category")}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{t("admin.menu.tags") ?? "Tags"}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id} hover>
                      <TableCell>{it.name}</TableCell>
                      <TableCell>{it.price_irr.toLocaleString()}</TableCell>
                      <TableCell>
                        {(() => {
                          const c = categories.find((x) => x.id === it.category_id);
                          if (!c) return it.category_id ?? "";
                          return i18n.language === "fa" ? c.name_fa : c.name_en;
                        })()}
                      </TableCell>
                      <TableCell>
                        {it.tags?.length ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {it.tags.map((tg) => (
                              <Chip key={tg} size="small" label={tg} />
                            ))}
                          </Stack>
                        ) : (
                          ""
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
