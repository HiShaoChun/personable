// 首页 idle 态预制示例画像。同一组虚构 clusters，三种 vibe 各一份成品，
// 让访客一眼看到「换风格」会带来哪些差异。纯前端静态数据，不进任何
// LLM/抓取/持久化路径。
import type { PersonaProfile } from "@/lib/agent/schema";

// 共享的虚构兴趣簇：跨三份示例完全一致，差异只体现在 headline / traits /
// evolution 的措辞上，避免「内容不同所以差异这么大」的错觉。
const SHARED_CLUSTERS = [
  {
    name: "AI 工具与论文",
    size: 78,
    domains: ["github.com", "arxiv.org", "huggingface.co"],
  },
  {
    name: "独立游戏与游戏设计",
    size: 52,
    domains: ["store.steampowered.com", "itch.io", "gdcvault.com"],
  },
  {
    name: "日系动画与漫画",
    size: 41,
    domains: ["bilibili.com", "myanimelist.net", "pixiv.net"],
  },
  {
    name: "机械键盘与数码周边",
    size: 33,
    domains: ["keychron.com", "reddit.com", "jd.com"],
  },
  {
    name: "居家美学与极简生活",
    size: 22,
    domains: ["muji.com", "xiaohongshu.com", "ikea.com"],
  },
];

const SHARED_OTHER_INTERESTS = ["豆瓣电影", "播客节目", "咖啡器具"];

export const SAMPLE_EARNEST: PersonaProfile = {
  vibe: "earnest",
  headline: "在代码与游戏之间，认真过日子的人",
  traits: ["技术好奇", "审美在线", "节制消费", "独处自在"],
  clusters: SHARED_CLUSTERS,
  otherInterests: SHARED_OTHER_INTERESTS,
  evolution: [
    { period: "2021 ~ 2022", summary: "围绕 ML 论文和开发工具建立专业地图" },
    {
      period: "2023 ~ 2024",
      summary: "兴趣开始向独立游戏和动画延展，工作之外有了稳定停靠点",
    },
    { period: "2025 ~ 至今", summary: "把目光投向居家美学，开始打理生活的细节" },
  ],
  disclaimer: "",
};

export const SAMPLE_ROAST: PersonaProfile = {
  vibe: "roast",
  headline: "白天 push 代码，晚上 push 蒸汽存档的工位人类",
  traits: ["代码上瘾", "库存焦虑", "周边剁手", "宅家硬撑"],
  clusters: SHARED_CLUSTERS,
  otherInterests: SHARED_OTHER_INTERESTS,
  evolution: [
    { period: "2021 ~ 2022", summary: "立志做点东西，先 star 了三百个仓库" },
    {
      period: "2023 ~ 2024",
      summary: "现实和愿望之间塞了一台 Switch、一柜子手办",
    },
    {
      period: "2025 ~ 至今",
      summary: "终于发现没有 MUJI 香薰救不了的加班夜",
    },
  ],
  disclaimer: "",
};

export const SAMPLE_POETIC: PersonaProfile = {
  vibe: "poetic",
  headline: "把代码、星空与午后光斑一并收藏的人",
  traits: ["静水深流", "夜读者", "拾光人", "纸与电"],
  clusters: SHARED_CLUSTERS,
  otherInterests: SHARED_OTHER_INTERESTS,
  evolution: [
    {
      period: "2021 ~ 2022",
      summary: "在 arXiv 的海里捡贝壳，把每一篇都视若珍宝",
    },
    {
      period: "2023 ~ 2024",
      summary: "屏幕里多了像素的雨，纸页间夹进樱花的影",
    },
    {
      period: "2025 ~ 至今",
      summary: "在原木与亚麻之间，安放被加班磨钝的目光",
    },
  ],
  disclaimer: "",
};

// 顺序固定 earnest → roast → poetic，与 VIBES 一致，便于横向对比。
export const SAMPLE_PROFILES: PersonaProfile[] = [
  SAMPLE_EARNEST,
  SAMPLE_ROAST,
  SAMPLE_POETIC,
];
