import type {
  DesignStyle,
  RenovationIntensity,
  RoomType,
} from "../types";

export interface DesignOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export const ROOM_TYPE_OPTIONS: readonly DesignOption<RoomType>[] = [
  { value: "auto", label: "AI 识别" },
  { value: "living-room", label: "客厅" },
  { value: "bedroom", label: "卧室" },
  { value: "dining-room", label: "餐厅" },
  { value: "kitchen", label: "厨房" },
  { value: "bathroom", label: "卫生间" },
  { value: "study", label: "书房" },
  { value: "other", label: "其他" },
];

export const DESIGN_STYLE_OPTIONS: readonly DesignOption<DesignStyle>[] = [
  { value: "smart", label: "智能推荐" },
  { value: "modern-minimal", label: "现代简约" },
  { value: "natural-wood", label: "原木自然" },
  { value: "cream", label: "奶油温馨" },
  { value: "italian-minimal", label: "意式极简" },
  { value: "light-luxury", label: "轻奢质感" },
  { value: "wabi-sabi", label: "侘寂东方" },
];

export const RENOVATION_INTENSITY_OPTIONS: readonly DesignOption<RenovationIntensity>[] = [
  {
    value: "conservative",
    label: "保守",
    description: "材质、颜色与基础家具",
  },
  {
    value: "standard",
    label: "标准",
    description: "完整家具、灯光与软装",
  },
  {
    value: "bold",
    label: "大胆",
    description: "更鲜明的材质与装饰表现",
  },
];
