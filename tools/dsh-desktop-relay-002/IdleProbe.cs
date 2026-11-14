using System;using System.Collections.Generic;using System.Diagnostics;using System.Runtime.InteropServices;using System.Text;using System.Web.Script.Serialization;
public static class IdleProbe {
 [StructLayout(LayoutKind.Sequential)]struct LASTINPUTINFO{public uint cbSize,dwTime;}
 [DllImport("user32.dll")]static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
 [DllImport("kernel32.dll")]static extern ulong GetTickCount64();
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr window,StringBuilder text,int limit);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint processId);
 [DllImport("user32.dll",SetLastError=true)]static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool GetUserObjectInformation(IntPtr handle,int index,StringBuilder value,uint length,out uint needed);
 [DllImport("user32.dll")]static extern bool CloseDesktop(IntPtr handle);
 public static int Main(string[] args){var result=new Dictionary<string,object>{{"source","WIN32_READ_ONLY_ACTIVITY"},{"observedAt",DateTime.UtcNow.ToString("o")},{"lastInputTick",null},{"idleMs",-1},{"interactiveDesktop",false},{"lockedOrUnknown",true},{"foregroundIsExpectedDsh",false},{"allowActivate",false}};
  try{if(args.Length!=0)throw new Exception();var input=new LASTINPUTINFO{cbSize=(uint)Marshal.SizeOf(typeof(LASTINPUTINFO))};if(!GetLastInputInfo(ref input))throw new Exception();uint idle=unchecked((uint)GetTickCount64()-input.dwTime);result["lastInputTick"]=input.dwTime;result["idleMs"]=idle;
   bool desktop=false;var handle=OpenInputDesktop(0,false,1);if(handle!=IntPtr.Zero){try{uint required;var name=new StringBuilder(128);desktop=GetUserObjectInformation(handle,2,name,256,out required)&&String.Equals(name.ToString(),"Default",StringComparison.OrdinalIgnoreCase);}finally{CloseDesktop(handle);}}
   var foreground=GetForegroundWindow();uint pid;GetWindowThreadProcessId(foreground,out pid);bool target=false,locked=true;
   if(desktop&&foreground!=IntPtr.Zero&&pid>0){using(var process=Process.GetProcessById((int)pid)){locked=String.Equals(process.ProcessName,"LockApp",StringComparison.OrdinalIgnoreCase);if(!locked){var title=new StringBuilder(512);GetWindowText(foreground,title,title.Capacity);target=String.Equals(process.MainModule.FileName,@"C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe",StringComparison.OrdinalIgnoreCase)&&title.ToString()=="主进度 — DeepSeek Harness";}}}
   result["interactiveDesktop"]=desktop;result["lockedOrUnknown"]=locked||!desktop;result["foregroundIsExpectedDsh"]=target&&!locked&&desktop;result["allowActivate"]=desktop&&!locked&&idle>=15000;
  }catch{}
  Console.WriteLine(new JavaScriptSerializer().Serialize(result));return 0;
 }
}