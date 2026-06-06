# PUBG 豆子局结算台

一个纯静态的 PUBG 豆子局结算页面，支持桌面和手机浏览器直接使用。

线上地址：[https://linvon.github.io/pubg-bean-calculator/](https://linvon.github.io/pubg-bean-calculator/)

## 功能

- 四名玩家全局配置
- 多局连续统计
- 每局可选 2v2 豆子局或除三害
- 除三害支持逐个对照、三人均摊、三人各摊一次总和
- 支持吃鸡倍率、自定义倍率
- 支持救人和杀队友修正
- 每局展示明确公式口径
- 历史对局可编辑、删除、展开查看详情

## 本地使用

直接打开 `index.html` 即可。

## 部署到 GitHub Pages

这是当前项目最便宜、最简单的公网部署方式。使用 `github.io` 地址时不需要购买服务器，也不需要构建步骤。

1. 在 GitHub 创建一个公开仓库，例如 `pubg-douzi-calculator`。
2. 上传本目录里的全部文件。
3. 进入仓库 `Settings -> Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub Pages 生成访问地址。

当前项目访问地址：

```text
https://linvon.github.io/pubg-bean-calculator/
```

默认访问地址通常是：

```text
https://你的用户名.github.io/仓库名/
```

如果需要独立域名，只需要额外购买域名，并在 GitHub Pages 里绑定 Custom domain。
