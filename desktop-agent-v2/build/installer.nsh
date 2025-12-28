!macro customWelcomePage
  !insertmacro MUI_HEADER_TEXT "Welcome to Gate 1 Agent" "Operational-first backup assistant. Powered by Nelium Systems."
!macroend

!macro customFinishPage
  !insertmacro MUI_HEADER_TEXT "Setup complete" "Gate 1 Agent is ready. Powered by Nelium Systems."
!macroend

!macro customInstall
  ; Per-machine auto-start on login
  ; Use the installed exe path and pass --autostart so the app starts hidden.
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Gate1Agent" '"$INSTDIR\\${PRODUCT_FILENAME}.exe" --autostart'
!macroend

!macro customUnInstall
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "Gate1Agent"
!macroend
