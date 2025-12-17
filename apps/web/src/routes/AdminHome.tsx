import { useTranslation } from "react-i18next";

export default function AdminHome() {
  const { t } = useTranslation();

  return (
    <div>
      <h2>{t("admin.title")}</h2>
      <p>{t("admin.description")}</p>
    </div>
  );
}
