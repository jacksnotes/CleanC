                           !macro customUnInstall
  ; 首先关闭正在运行的应用程序
  nsExec::ExecToLog 'taskkill /F /IM CleanC.exe /T'
  
  ; 等待进程完全退出
  Sleep 1000
  
  ; 强制删除安装目录及其所有内容
  RMDir /r "$INSTDIR"
  
  ; 删除开始菜单快捷方式
  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
  
  ; 删除桌面快捷方式
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$DESKTOP\CleanC.lnk"
  
  ; 清理注册表
  DeleteRegKey HKCU "Software\${PRODUCT_NAME}"
  DeleteRegKey HKLM "Software\${PRODUCT_NAME}"
  DeleteRegKey HKCU "Software\CleanC"
  DeleteRegKey HKLM "Software\CleanC"
!macroend
