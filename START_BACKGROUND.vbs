Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir
WshShell.Run "cmd.exe /c npm run share", 0, False
WScript.Sleep 5000
WshShell.Run "cmd.exe /c start MOBILE_ACCESS.html", 0, False
