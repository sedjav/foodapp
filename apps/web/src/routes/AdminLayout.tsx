import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, Route, Routes, useNavigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth";
import LanguageSwitcher from "../components/LanguageSwitcher";
import AdminLogin from "./AdminLogin";
import AdminUsers from "./AdminUsers";
import AdminTemplates from "./AdminTemplates";
import AdminTemplateDetail from "./AdminTemplateDetail";
import AdminEvents from "./AdminEvents";
import AdminParticipants from "./AdminParticipants";
import AdminEventDetail from "./AdminEventDetail";
import AdminMenu from "./AdminMenu";
import AdminCategories from "./AdminCategories";
import AdminSelections from "./AdminSelections";

import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  SvgIcon,
  Toolbar,
  Typography,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

const DRAWER_WIDTH = 240;

export default function AdminLayout() {
  const { t } = useTranslation();
  const { loading, me, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!me) return;
    if (me.role !== "ADMIN") return;

    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      navigate("/admin/users", { replace: true });
    }
  }, [loading, location.pathname]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!me) {
    return <AdminLogin />;
  }

  if (me.role !== "ADMIN") {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{t("admin.forbidden")}</Typography>
      </Box>
    );
  }

  const navItems = [
    { path: "/admin/users", label: t("admin.nav.users") },
    { path: "/admin/templates", label: t("admin.nav.templates") },
    { path: "/admin/events", label: t("admin.nav.events") },
    { path: "/admin/participants", label: t("admin.nav.participants") },
    { path: "/admin/categories", label: t("admin.nav.categories") }
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const drawerContent = (
    <>
      <Toolbar>
        <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: "primary.main" }}>
          {t("admin.title")}
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1 }}>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={isActive(item.path)}
              onClick={() => go(item.path)}
              sx={{
                "&.Mui-selected": {
                  backgroundColor: "primary.light",
                  color: "primary.contrastText",
                  "&:hover": {
                    backgroundColor: "primary.main"
                  }
                }
              }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
          {me.displayName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {me.email}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          onClick={() => {
            logout();
            setMobileOpen(false);
            navigate("/admin", { replace: true });
          }}
        >
          {t("admin.logout")}
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider"
          }
        }}
      >
        {drawerContent}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider"
          }
        }}
        open
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <AppBar
          position="static"
          color="default"
          elevation={0}
          sx={{ borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Toolbar>
            {!isDesktop && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
                <SvgIcon>
                  <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
                </SvgIcon>
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {navItems.find((item) => isActive(item.path))?.label ?? t("admin.title")}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center">
              <Button component={RouterLink} to="/" variant="outlined" size="small">
                {t("public.pay.home")}
              </Button>
              <LanguageSwitcher />
            </Stack>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, p: 3, backgroundColor: "grey.50", overflow: "auto" }}>
          <Routes>
            <Route path="/users" element={<AdminUsers />} />
            <Route path="/templates" element={<AdminTemplates />} />
            <Route path="/templates/:templateId" element={<AdminTemplateDetail />} />
            <Route path="/events" element={<AdminEvents />} />
            <Route path="/events/:eventId" element={<AdminEventDetail />} />
            <Route path="/events/:eventId/selections" element={<AdminSelections />} />
            <Route path="/menus/:menuId" element={<AdminMenu />} />
            <Route path="/participants" element={<AdminParticipants />} />
            <Route path="/categories" element={<AdminCategories />} />
            <Route path="*" element={<AdminUsers />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}
