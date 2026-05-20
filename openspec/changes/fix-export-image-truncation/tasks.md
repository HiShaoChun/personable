## 1. 修改 exportImage

- [x] 1.1 在 [src/app/page.tsx](src/app/page.tsx) 的 `exportImage` 中：进入 `toPng` 前先 `await document.fonts?.ready` 兜底（可选链防老浏览器），再 `await new Promise((r) => requestAnimationFrame(r))` 等一帧布局
- [x] 1.2 用 `cardRef.current.getBoundingClientRect()` 取 width/height，并与 `scrollWidth`/`scrollHeight` 取 max、Math.ceil 后作为显式 `width`/`height` 传给 `toPng`
- [x] 1.3 给 `toPng` 配上 `backgroundColor: "#121420"`，保留现有的 `pixelRatio: 2`
- [x] 1.4 用一句注释解释「为何要等 fonts.ready + RAF + 显式尺寸」，指回本 change 的 design.md（避免后续被当成冗余代码删掉）

## 2. 验证

- [ ] 2.1 在 dev 服务器跑一次完整流程：拖书签 → 等卡片定稿 → 等入场动画走完 → 点「保存为图片」，下载 PNG 用图片查看器打开，检查顶部无透明条带、底部 evolution 末行完整
- [ ] 2.2 切换至少 1 个 vibe 重新生成，再次「保存为图片」，确认 reveal-quick 路径同样不裁切
- [ ] 2.3 把下载的 PNG 拖进白底图片查看器，确认圆角外是实色 #121420 而非透明
