import dayjs from "dayjs";
export const JST_DATE = () => dayjs().format("YYYY-MM-DD");
export const roleLabel = (r: "AUDIO" | "LIGHTING" | "VIDEO") =>
  ({
    AUDIO: "音響",
    LIGHTING: "照明",
    VIDEO: "映像",
  }[r]);
