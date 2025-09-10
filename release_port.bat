@echo off
rem 设置窗口标题和颜色
title 交互式端口释放工具
color 0A

:main
rem 清理屏幕并显示欢迎信息
cls
echo ==========================================================
echo               Windows 端口强制释放工具
echo ==========================================================
echo.
echo 此脚本将帮助您查找并终止占用特定端口的进程。
echo 请在操作前确认终止该进程是安全的，以免数据丢失。
echo.

rem --- 第一步: 获取用户输入的端口号 ---
set "port="
set /p port="请输入您要查询并释放的端口号 (例如 8080): "

rem 验证用户是否输入
if not defined port (
    echo.
    echo [错误] 您没有输入任何端口号。请重试。
    echo.
    pause
    goto main
)

rem --- 第二步: 查找占用该端口的进程PID ---
echo.
echo 正在查询端口 %port% 的占用情况...
set "pid="
rem 使用FOR循环来捕获netstat命令的结果
rem 我们只关心处于 "LISTENING" 状态的TCP连接，这更精确
for /f "tokens=5" %%P in ('netstat -aon ^| findstr ":%port%" ^| findstr "LISTENING"') do (
    set "pid=%%P"
)

rem --- 第三步: 判断是否找到进程 ---
if not defined pid (
    echo.
    echo [成功] 未发现任何进程正在监听端口 %port%。
    echo.
    goto end
)

rem --- 第四步: 根据PID获取进程的详细信息 ---
set "imageName=未知"
for /f "tokens=1" %%I in ('tasklist /fi "PID eq %pid%" /nh') do (
    set "imageName=%%I"
)

rem --- 第五步: 显示信息并请求用户确认 ---
echo.
echo ------------------------------------------
echo   发现以下进程正在占用该端口:
echo.
echo   - 端口号 (Port) : %port%
echo   - 进程 ID (PID)  : %pid%
echo   - 进程名称 (Name): %imageName%
echo ------------------------------------------
echo.

set "choice="
set /p choice="警告：您确定要强制终止此进程吗? [Y/N]: "

rem --- 第六步: 根据用户的选择执行操作 ---
rem /i 表示不区分大小写比较
if /i "%choice%"=="Y" (
    goto killProcess
) else if /i "%choice%"=="N" (
    goto cancelOperation
) else (
    echo.
    echo [提示] 输入无效。默认选择取消操作。
    goto end
)

:killProcess
echo.
echo 正在执行终止命令...
taskkill /F /PID %pid%
echo.
echo [成功] 进程 %imageName% (PID: %pid%) 已被终止。端口 %port% 应该已被释放。
goto end

:cancelOperation
echo.
echo [提示] 用户选择取消操作。未做任何更改。
goto end

:end
echo.
echo ==========================================================
pause
exit