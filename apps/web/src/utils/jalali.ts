import { toGregorian, toJalaali } from "jalaali-js";

export const jalaliToUtcIso = (jalaliDate: string, timeHHmm: string) => {
  const [jy, jm, jd] = jalaliDate.split("/").map((x) => Number(x));
  const [hh, mm] = timeHHmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(jy) || !Number.isFinite(jm) || !Number.isFinite(jd) || !Number.isFinite(hh) || !Number.isFinite(mm)) {
    throw new Error("invalid date/time");
  }

  const g = toGregorian(jy, jm, jd);
  const d = new Date(g.gy, g.gm - 1, g.gd, hh, mm, 0, 0);
  return d.toISOString();
};

export const utcIsoToJalaliDate = (iso: string) => {
  const d = new Date(iso);
  const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
};
