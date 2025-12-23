; Gate 1 Agent NSIS Installer Script
; Professional wizard-style installer

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Application Info
!define PRODUCT_NAME "Gate 1 Agent"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "Gate 1 System"
!define PRODUCT_WEB_SITE "https://gate1system.org"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; General Settings
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "installer\Gate1Agent-${PRODUCT_VERSION}-Setup.exe"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "Software\Gate1Agent" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show
ShowUnInstDetails show

; Compression
SetCompressor /SOLID lzma

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING

; Header image (optional - uses default if not present)
; !define MUI_HEADERIMAGE
; !define MUI_HEADERIMAGE_BITMAP "assets\header.bmp"

; Welcome page settings
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${PRODUCT_NAME} ${PRODUCT_VERSION}.$\r$\n$\r$\n${PRODUCT_NAME} is the desktop component of the Gate 1 System for managing and syncing media files from SD cards.$\r$\n$\r$\nFeatures:$\r$\n  - Automatic SD card detection$\r$\n  - Secure file synchronization$\r$\n  - Real-time progress tracking$\r$\n  - Background operation$\r$\n$\r$\nClick Next to continue."

; License page settings
!define MUI_LICENSEPAGE_TEXT_TOP "Please review the license terms before installing ${PRODUCT_NAME}."
!define MUI_LICENSEPAGE_TEXT_BOTTOM "If you accept the terms of the agreement, click I Agree to continue. You must accept the agreement to install ${PRODUCT_NAME}."

; Directory page settings
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install ${PRODUCT_NAME} in the following folder.$\r$\n$\r$\nTo install in a different folder, click Browse and select another folder. Click Install to start the installation."

; Install page settings
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "Installation Complete"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "${PRODUCT_NAME} has been installed on your computer."

; Finish page settings
!define MUI_FINISHPAGE_TITLE "Completing ${PRODUCT_NAME} Setup"
!define MUI_FINISHPAGE_TEXT "${PRODUCT_NAME} ${PRODUCT_VERSION} has been installed on your computer.$\r$\n$\r$\nClick Finish to close this wizard."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Gate 1 Agent.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCT_NAME}"
!define MUI_FINISHPAGE_RUN_CHECKED
!define MUI_FINISHPAGE_NOREBOOTSUPPORT

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!define MUI_WELCOMEPAGE_TITLE "Uninstall ${PRODUCT_NAME}"
!define MUI_WELCOMEPAGE_TEXT "This wizard will uninstall ${PRODUCT_NAME} from your computer.$\r$\n$\r$\nBefore starting the uninstallation, make sure ${PRODUCT_NAME} is not running.$\r$\n$\r$\nClick Next to continue."
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Language
!insertmacro MUI_LANGUAGE "English"

; Version Info
VIProductVersion "${PRODUCT_VERSION}.0"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "Copyright 2024 ${PRODUCT_PUBLISHER}"
VIAddVersionKey "FileDescription" "${PRODUCT_NAME} Installer"
VIAddVersionKey "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"

; Installer Section
Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite on
    
    ; Show installation progress
    DetailPrint "Installing ${PRODUCT_NAME}..."
    
    ; Copy all application files
    File /r "release\Gate 1 Agent-win32-x64\*.*"
    
    DetailPrint "Creating shortcuts..."
    
    ; Create Start Menu folder and shortcuts
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\Gate 1 Agent.exe" "" "$INSTDIR\Gate 1 Agent.exe" 0
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
    
    ; Create Desktop shortcut
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\Gate 1 Agent.exe" "" "$INSTDIR\Gate 1 Agent.exe" 0
    
    DetailPrint "Writing registry entries..."
    
    ; Write uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Write registry keys for Add/Remove Programs
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\Gate 1 Agent.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
    
    ; Calculate and write install size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
    
    ; Store install directory
    WriteRegStr HKLM "Software\Gate1Agent" "InstallDir" "$INSTDIR"
    WriteRegStr HKLM "Software\Gate1Agent" "Version" "${PRODUCT_VERSION}"
    
    DetailPrint "Installation completed successfully!"
SectionEnd

; Uninstaller Section
Section "Uninstall"
    ; Kill running process if any
    DetailPrint "Checking for running instances..."
    nsExec::ExecToLog 'taskkill /F /IM "Gate 1 Agent.exe"'
    Sleep 1000
    
    DetailPrint "Removing application files..."
    
    ; Remove all files
    RMDir /r "$INSTDIR"
    
    DetailPrint "Removing shortcuts..."
    
    ; Remove shortcuts
    Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
    RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"
    
    DetailPrint "Cleaning up registry..."
    
    ; Remove registry keys
    DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "Software\Gate1Agent"
    
    DetailPrint "Uninstallation completed!"
SectionEnd

; Functions
Function .onInit
    ; Check if already installed
    ReadRegStr $R0 HKLM "Software\Gate1Agent" "InstallDir"
    StrCmp $R0 "" done
    
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
        "${PRODUCT_NAME} is already installed.$\r$\n$\r$\nClick OK to remove the previous version or Cancel to cancel this installation." \
        IDOK uninst
    Abort
    
uninst:
    ; Run uninstaller silently
    ExecWait '"$R0\Uninstall.exe" /S _?=$R0'
    
done:
FunctionEnd

Function un.onInit
    MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove ${PRODUCT_NAME} and all of its components?" IDYES +2
    Abort
FunctionEnd

Function un.onUninstSuccess
    HideWindow
    MessageBox MB_ICONINFORMATION|MB_OK "${PRODUCT_NAME} was successfully removed from your computer."
FunctionEnd
