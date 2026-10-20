# 改版前备份（2026-10-20）

这份备份对应「顶部导航 + 石墨黑/橙色」UI 改版之前的版本。

## 备份内容

| 类型 | 位置 |
| --- | --- |
| Git 提交 | `5ac424c` chore: 备份当前版本（UI 改版前） |
| Git 分支 | `backup/pre-ui-refresh` |
| Git 标签 | `backup/pre-ui-refresh-2026-10-20` |
| 源码压缩包 | `backups/EcoLink-pre-ui-refresh-2026-10-20.zip` |

压缩包排除了 `node_modules`、`dist`、`release`、`.git`、`backups` 和 `electron/server.cjs`。
恢复后如需运行，执行 `npm install` 再 `npm run dev` / `npm run build`。

## 如何整体回退

### 方式一：Git（推荐）

查看备份：

```powershell
git tag --list "backup/*"
git branch --list "backup/*"
```

把工作区整体恢复到备份版本（**会丢弃备份之后的所有改动，请先确认**）：

```powershell
git reset --hard backup/pre-ui-refresh-2026-10-20
```

如果只想恢复文件、保留之后的提交记录：

```powershell
git checkout backup/pre-ui-refresh-2026-10-20 -- .
```

### 方式二：源码 zip

```powershell
Expand-Archive -Path "backups\EcoLink-pre-ui-refresh-2026-10-20.zip" -DestinationPath "restore" -Force
```

把 `restore` 里的内容覆盖回项目目录即可；`node_modules` 不需要覆盖。

## 注意

- `data/` 里的业务数据（JSON、图片）不进 Git，也不在 zip 里，回退界面不会影响数据。
- 回退前建议先 `git status` 看一下当前改动。
