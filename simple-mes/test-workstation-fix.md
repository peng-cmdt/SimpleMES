# 工位刷新问题修复测试

## 问题描述
当用户登录M0、M1工位后，刷新M0工位页面时，页面错误地显示为M1工位。

## 修复内容

### 1. 工位页面 (`/client/workstation/page.tsx`)
- 添加了 `useSearchParams` 来获取URL参数
- 修改会话验证逻辑，优先使用URL参数中的 `workstationId`
- 在自动选择工位时，确保URL参数与选择的工位一致
- 在用户手动选择工位时，更新URL参数

### 2. 登录页面 (`/client/login/page.tsx`)
- 登录成功后跳转时包含工位ID参数：`/client/workstation?workstationId=${workstationId}`

### 3. 工位登录页面 (`/client/workstation/login/page.tsx`)
- 登录成功后跳转时包含工位ID参数

### 4. 工艺执行页面 (`/client/workstation/execute/page.tsx`)
- 完成工艺或取消操作时跳转包含工位ID参数

### 5. 调试页面 (`/client/debug/page.tsx`)
- 跳转到工位页面时使用默认的M0工位ID

## 测试步骤

1. **登录测试**
   - 登录M0工位，检查URL是否包含 `?workstationId=M0`
   - 登录M1工位，检查URL是否包含 `?workstationId=M1`

2. **刷新测试**
   - 在M0工位页面刷新，确认仍显示M0工位
   - 在M1工位页面刷新，确认仍显示M1工位

3. **多工位切换测试**
   - 同时登录M0和M1工位
   - 在工位选择界面选择M0，检查URL和页面内容
   - 刷新页面，确认仍显示M0工位
   - 手动修改URL参数为M1，确认页面切换到M1工位

4. **跨页面导航测试**
   - 从工位页面进入工艺执行页面
   - 完成或取消工艺后返回，确认返回到正确的工位

## 预期结果
- 每个工位都有独立的URL标识
- 刷新页面后保持在正确的工位
- 工位切换时URL参数正确更新
- 所有页面跳转都保持工位上下文