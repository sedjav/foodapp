import { useTranslation } from "react-i18next";

import { FormControl, MenuItem, Select } from "@mui/material";

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const setLang = (lang: "fa" | "en") => {
    i18n.changeLanguage(lang);
    globalThis.localStorage?.setItem("foodapp.lang", lang);
    const dir = lang === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  };

  return (
    <FormControl size="small">
      <Select
        value={(i18n.language as "fa" | "en") ?? "fa"}
        onChange={(e) => setLang(e.target.value as "fa" | "en")}
      >
        <MenuItem value="fa">{t("language.farsi")}</MenuItem>
        <MenuItem value="en">{t("language.english")}</MenuItem>
      </Select>
    </FormControl>
  );
}
