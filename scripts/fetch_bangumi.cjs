// source/scripts/fetch_bangumi.cjs
const fs = require("fs");
const path = require("path");

// 必填：你的 B 站 UID（纯数字）
const UID = process.env.BILI_UID || "3546972449409836";
// 选填：追番列表不公开时需要（浏览器 Cookie 中的 SESSDATA 值）
const SESSDATA = process.env.BILI_SESSDATA || "14cdd51b%2C1784599308%2C6b507%2A11CjArwlTx6YwWQzb45dAq4vgwB9QD9JHIT_aZ9rcvEYjQCsigA5Rw46syPR2F62bNBykSVjdWTFlzdERyblc5dW53emFjNFpJREdmWWdqem1zUE5VQkNxbFU3a3NGcHNaUnBwRW82aFhoRXEyaFBqaW1YZE83VkZSLUVVekRDdHJaaDdidW5Vc0tBIIEC";

const API_BASE = "https://api.bilibili.com/x/space/bangumi/follow/list";
const PAGE_SIZE = 30; // B站分页
const TYPE_NUM = 1;   // 1=番剧，2=追剧（当前只抓番剧）

async function requestOnce(status, pn) {
  const url = `${API_BASE}?vmid=${UID}&type=${TYPE_NUM}&follow_status=${status}&ps=${PAGE_SIZE}&pn=${pn}`;
  const headers = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://www.bilibili.com/"
  };
  if (SESSDATA) headers["cookie"] = `SESSDATA=${SESSDATA};`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Bilibili API error: code=${data.code}, message=${data.message}`);
  }
  return data.data || { list: [] };
}

async function fetchAll(status) {
  let pn = 1;
  const out = [];
  while (true) {
    const data = await requestOnce(status, pn);
    const list = data.list || [];
    for (const b of list) {
      let cover = b?.cover || "";
      if (cover.startsWith("http://")) cover = cover.replace("http://", "https://");
      out.push({
        title: b?.title ?? "",
        cover: cover,
        new_ep: b?.new_ep?.title ?? "",
        total_count: b?.total_count ?? -1,
        media_id: b?.media_id ?? 0,
        season_id: b?.season_id ?? 0,   // ← 新增：优先直达播放页
        area: b?.areas?.[0]?.name ?? "",
        type_name: b?.season_type_name ?? "",
        evaluate: b?.evaluate ?? "",
        stat: b?.stat ?? {}
      });
    }
    if (list.length < PAGE_SIZE) break;
    pn += 1;
  }
  return out;
}

(async () => {
  if (!/^\d+$/.test(UID)) {
    throw new Error("请设置环境变量 BILI_UID 为你的 B 站 UID（纯数字）。");
  }

  console.log(`[bangumi] Fetching UID=${UID} ...`);
  const wantWatch = await fetchAll(1); // 想看
  const watching  = await fetchAll(2); // 在看
  const watched   = await fetchAll(3); // 已看

  const outDir = path.resolve(process.cwd(), "source/_data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "bangumis.json");
  fs.writeFileSync(outPath, JSON.stringify({ wantWatch, watching, watched }, null, 2), "utf-8");
  console.log(`[bangumi] Saved ${wantWatch.length + watching.length + watched.length} items -> ${outPath}`);
})().catch(err => {
  console.error("[bangumi] Failed:", err);
  process.exit(1);
});

