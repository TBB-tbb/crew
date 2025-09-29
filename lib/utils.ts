import dayjs from "dayjs";
export const JST_DATE = () => dayjs().format("YYYY-MM-DD");
export const roleLabel = (r: "AUDIO" | "LIGHTING" | "VIDEO") =>
  ({
    AUDIO: "音響",
    LIGHTING: "照明",
    VIDEO: "映像",
  }[r]);


  export const getShiftDate = (clockInTime: Date) => {
  const d = dayjs(clockInTime);
  if (d.hour() >= 22) {
    return d.add(1, "day").format("YYYY-MM-DD");
  }
  return d.format("YYYY-MM-DD");
};