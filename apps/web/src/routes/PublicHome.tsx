import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export default function PublicHome() {
  const { t } = useTranslation();

  return (
    <div>
      <h2>{t("public.title")}</h2>
      <p>{t("public.description")}</p>
      <div style={{ marginTop: 12 }}>
        <Link to="/events">{t("public.events.go")}</Link>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link to="/payor">{t("public.payor.go")}</Link>
      </div>
    </div>
  );
}
