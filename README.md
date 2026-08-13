<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# AI 装修大师

基于 Gemini 图像编辑的毛坯房装修效果生成工具。支持单视角生成，以及由主视角效果图驱动的最多四视角一致装修尝试。

多视角流程：

1. 上传一张主视角毛坯图和最多三张其他毛坯视角。
2. 主视角先根据参考风格生成装修效果。
3. 服务端从主效果图提取统一的材质、家具、灯光和摆放关系。
4. 其他视角逐张使用“当前毛坯图 + 主效果图 + 主设计档案”生成。
5. 成功结果保留，失败视角可在结果页单独重试。

View your app in AI Studio: https://ai.studio/apps/6a2e1272-5d00-45a5-a540-3fa3d236761b

## 本地运行

**环境要求：** Node.js


1. 安装依赖：
   `npm install`
2. 在 `.env.local` 中配置 `GEMINI_API_KEY`
3. 启动项目：
   `npm run dev`
