@echo off
rem ���ô��ڱ������ɫ
title ����ʽ�˿��ͷŹ���
color 0A

:main
rem ������Ļ����ʾ��ӭ��Ϣ
cls
echo ==========================================================
echo               Windows �˿�ǿ���ͷŹ���
echo ==========================================================
echo.
echo �˽ű������������Ҳ���ֹռ���ض��˿ڵĽ��̡�
echo ���ڲ���ǰȷ����ֹ�ý����ǰ�ȫ�ģ��������ݶ�ʧ��
echo.

rem --- ��һ��: ��ȡ�û�����Ķ˿ں� ---
set "port="
set /p port="��������Ҫ��ѯ���ͷŵĶ˿ں� (���� 8080): "

rem ��֤�û��Ƿ�����
if not defined port (
    echo.
    echo [����] ��û�������κζ˿ںš������ԡ�
    echo.
    pause
    goto main
)

rem --- �ڶ���: ����ռ�øö˿ڵĽ���PID ---
echo.
echo ���ڲ�ѯ�˿� %port% ��ռ�����...
set "pid="
rem ʹ��FORѭ��������netstat����Ľ��
rem ����ֻ���Ĵ��� "LISTENING" ״̬��TCP���ӣ������ȷ
for /f "tokens=5" %%P in ('netstat -aon ^| findstr ":%port%" ^| findstr "LISTENING"') do (
    set "pid=%%P"
)

rem --- ������: �ж��Ƿ��ҵ����� ---
if not defined pid (
    echo.
    echo [�ɹ�] δ�����κν������ڼ����˿� %port%��
    echo.
    goto end
)

rem --- ���Ĳ�: ����PID��ȡ���̵���ϸ��Ϣ ---
set "imageName=δ֪"
for /f "tokens=1" %%I in ('tasklist /fi "PID eq %pid%" /nh') do (
    set "imageName=%%I"
)

rem --- ���岽: ��ʾ��Ϣ�������û�ȷ�� ---
echo.
echo ------------------------------------------
echo   �������½�������ռ�øö˿�:
echo.
echo   - �˿ں� (Port) : %port%
echo   - ���� ID (PID)  : %pid%
echo   - �������� (Name): %imageName%
echo ------------------------------------------
echo.

set "choice="
set /p choice="���棺��ȷ��Ҫǿ����ֹ�˽�����? [Y/N]: "

rem --- ������: �����û���ѡ��ִ�в��� ---
rem /i ��ʾ�����ִ�Сд�Ƚ�
if /i "%choice%"=="Y" (
    goto killProcess
) else if /i "%choice%"=="N" (
    goto cancelOperation
) else (
    echo.
    echo [��ʾ] ������Ч��Ĭ��ѡ��ȡ��������
    goto end
)

:killProcess
echo.
echo ����ִ����ֹ����...
taskkill /F /PID %pid%
echo.
echo [�ɹ�] ���� %imageName% (PID: %pid%) �ѱ���ֹ���˿� %port% Ӧ���ѱ��ͷš�
goto end

:cancelOperation
echo.
echo [��ʾ] �û�ѡ��ȡ��������δ���κθ��ġ�
goto end

:end
echo.
echo ==========================================================
pause
exit