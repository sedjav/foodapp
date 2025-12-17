import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, Route, Routes, useLocation } from "react-router-dom";
import LanguageSwitcher from "./components/LanguageSwitcher";
import AdminLayout from "./routes/AdminLayout";
import PublicHome from "./routes/PublicHome";
import PublicEvents from "./routes/PublicEvents";
import PublicEventDetail from "./routes/PublicEventDetail";
import PublicPayor from "./routes/PublicPayor";
import PublicPay from "./routes/PublicPay";

import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";
import { prefixer } from "stylis";
import { CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { green } from "@mui/material/colors";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { AdapterDateFnsJalali } from "@mui/x-date-pickers/AdapterDateFnsJalali";

import { enUS } from "date-fns/locale/en-US";
import { faIR } from "date-fns-jalali/locale/fa-IR";

export default function App() {
  const { t, i18n } = useTranslation();
  const [health, setHealth] = useState("loading");
  const location = useLocation();

  const lang = (i18n.language as "fa" | "en") ?? "fa";
  const direction = lang === "fa" ? "rtl" : "ltr";
  const isAdminRoute = location.pathname.startsWith("/admin");

  const cache = createCache({
    key: direction === "rtl" ? "mui-rtl" : "mui",
    stylisPlugins: direction === "rtl" ? [prefixer, rtlPlugin] : [prefixer]
  });

  const theme = createTheme({
    direction,
    palette: {
      primary: {
        main: green[700]
      }
    },
    typography: {
      fontFamily: "Vazirmatn, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [i18n.language]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/v1/health")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setHealth(data?.ok ? "ok" : "bad");
      })
      .catch(() => {
        if (!cancelled) setHealth("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider
          dateAdapter={lang === "fa" ? AdapterDateFnsJalali : AdapterDateFns}
          adapterLocale={lang === "fa" ? faIR : enUS}
        >
          <CssBaseline />

        {!isAdminRoute && (
          <>
            <AppBar position="static" color="transparent" elevation={0}>
              <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  {t("appTitle")}
                </Typography>
                <LanguageSwitcher />
              </Toolbar>
            </AppBar>

            <Container sx={{ py: 2 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button component={RouterLink} to="/" variant="text">
                  {t("nav.public")}
                </Button>
                <Button component={RouterLink} to="/admin" variant="text">
                  {t("nav.admin")}
                </Button>
              </Stack>

              <Box sx={{ mb: 2, color: "text.secondary" }}>
                {t("health.label")}: <code>{health}</code>
              </Box>
            </Container>
          </>
        )}

          <Box sx={{ width: "100%", p: isAdminRoute ? 0 : 0 }}>
            <Routes>
              <Route path="/" element={<PublicHome />} />
              <Route path="/events" element={<PublicEvents />} />
              <Route path="/events/:eventId" element={<PublicEventDetail />} />
              <Route path="/payor" element={<PublicPayor />} />
              <Route path="/pay/:token" element={<PublicPay />} />
              <Route path="/admin/*" element={<AdminLayout />} />
            </Routes>
          </Box>
        </LocalizationProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
