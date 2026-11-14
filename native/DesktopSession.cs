using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Security.Cryptography;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Automation;

public class DesktopSession {
 static JavaScriptSerializer J=new JavaScriptSerializer(){MaxJsonLength=2000000};
 static Mutex DesktopMutex; static bool OwnMutex=false;
 static bool MutationStarted=false; static string Role, Title; static IntPtr Window; static AutomationElement Root;
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd,int nCmdShow);
 [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
 [DllImport("user32.dll")] static extern uint SendInput(uint n,INPUT[] p,int size);
 [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO {public uint cbSize,dwTime;}
 [StructLayout(LayoutKind.Sequential)] struct INPUT {public uint type;public UNION u;}
 [StructLayout(LayoutKind.Explicit)] struct UNION {[FieldOffset(0)]public KEYBOARD ki;[FieldOffset(0)]public MOUSE mi;}
 [StructLayout(LayoutKind.Sequential)] struct KEYBOARD {public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] struct MOUSE {public int dx,dy;public uint data,flags,time;public UIntPtr extra;}
 static Dictionary<string,object> D(params object[] a){var d=new Dictionary<string,object>();for(int i=0;i<a.Length;i+=2)d[(string)a[i]]=a[i+1];return d;}
 static void Require(bool b,string e){if(!b)throw new Exception(e);}
 [DllImport("user32.dll")] static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
 [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern bool GetUserObjectInformation(IntPtr h,int index,StringBuilder name,int length,out int needed);
 static void Interactive(){var h=OpenInputDesktop(0,false,1);Require(h!=IntPtr.Zero,"interactive_desktop_unavailable");try{var n=new StringBuilder(256);int needed;Require(GetUserObjectInformation(h,2,n,512,out needed)&&n.ToString()=="Default","desktop_locked_or_switched");}finally{CloseDesktop(h);}}
 static string Sha(string text){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(text))).Replace("-","").ToLowerInvariant();}
 static long Idle(){LASTINPUTINFO i=new LASTINPUTINFO(){cbSize=(uint)Marshal.SizeOf(typeof(LASTINPUTINFO))};Require(GetLastInputInfo(ref i),"idle_state_unavailable");return unchecked((uint)Environment.TickCount-i.dwTime);}
 static string Name(AutomationElement e){try{return e.Current.Name??"";}catch{return "";}}
 static bool Enabled(AutomationElement e){try{return e.Current.IsEnabled&&!e.Current.IsOffscreen;}catch{return false;}}
 static AutomationElement[] Find(AutomationElement e,ControlType t){return e.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,t)).Cast<AutomationElement>().ToArray();}
 static string Value(AutomationElement e){
  object p;
  if(e.TryGetCurrentPattern(ValuePattern.Pattern,out p))return ((ValuePattern)p).Current.Value??"";
  if(e.TryGetCurrentPattern(TextPattern.Pattern,out p))return ((TextPattern)p).DocumentRange.GetText(-1)??"";
  throw new Exception("editor_value_unavailable");
 }
 static void Refresh(){Root=AutomationElement.FromHandle(Window);}
 static AutomationElement Document(){var docs=Find(Root,ControlType.Document).Where(e=>!e.Current.IsOffscreen).ToArray();Require(docs.Length==1,"document_ambiguous");return docs[0];}
 static string ActualTitle(){
  if(Role=="chatgpt"){
   var bars=Find(Root,ControlType.ToolBar).Where(e=>Name(e)=="聊天工具栏").ToArray();
   if(bars.Length==1){var texts=Find(bars[0],ControlType.Text).Select(Name).Where(s=>s.Length>0).ToArray();if(texts.Length>0)return texts[0];}
   return Name(Document());
  }
  var navs=Root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.NameProperty,"会话层级")).Cast<AutomationElement>().ToArray();
  if(navs.Length==1){var names=Find(navs[0],ControlType.Text).Select(Name).Where(s=>s.Length>0).ToArray();if(names.Length==1)return names[0];}
  var name=Name(Root);return name.EndsWith(" — DeepSeek Harness")?name.Substring(0,name.Length-" — DeepSeek Harness".Length):name;
 }
 static AutomationElement Editor(){
  var edits=Find(Root,ControlType.Edit).Where(Enabled).Where(e=>Role=="deepseek"?Name(e)=="发消息或创建任务, / 调用指令, @ 文件或对话":new[]{"询问 ChatGPT","询问任何问题","向 ChatGPT 提问","使用 ChatGPT","使用 ChatGPT Chat","消息 ChatGPT","Message ChatGPT","Ask anything"}.Contains(Name(e))).ToArray();
  Require(edits.Length==1,"editor_not_calibrated_or_ambiguous");return edits[0];
 }
 static bool Busy(){return Find(Root,ControlType.Button).Any(e=>Enabled(e)&&new[]{"停止","停止生成","停止流式传输","Stop","Stop generating","停止消息生成"}.Contains(Name(e)));}
 static bool Draft(AutomationElement e){var v=Value(e).Trim();return v.Length>0&&v!=Name(e);}
 static string[] Texts(AutomationElement parent){return Find(parent,ControlType.Text).Select(Name).Where(s=>s.Length>0).ToArray();}
 static Dictionary<string,object> Inspect(){
  Refresh();var editors=Find(Root,ControlType.Edit).Where(Enabled).ToArray();
  var o=D("role",Role,"window",Window.ToInt64(),"title",ActualTitle(),"expectedTitle",Title,"document",Name(Document()),"busy",Busy(),"idleMs",Idle(),
   "editors",editors.Select(e=>D("name",Name(e),"automationId",e.Current.AutomationId,"valueLength",Value(e).Length,"valueHash",Sha(Value(e).Trim()),"valueIsPlaceholder",Value(e).Trim()==Name(e))).ToArray(),
   "candidateButtons",Find(Root,ControlType.Button).Where(e=>Name(e)==Title).Select(e=>D("name",Name(e),"invoke",e.GetSupportedPatterns().Any(p=>p.Id==InvokePattern.Pattern.Id))).ToArray());
  return o;
 }
 static void Click(AutomationElement e){
  object p;if(e.TryGetCurrentPattern(InvokePattern.Pattern,out p)){((InvokePattern)p).Invoke();return;}
  if(e.TryGetCurrentPattern(SelectionItemPattern.Pattern,out p)){((SelectionItemPattern)p).Select();return;}
  Require(GetForegroundWindow()==Window,"foreground_mismatch");
  var r=e.Current.BoundingRectangle;Require(!r.IsEmpty&&r.Width>0&&r.Height>0,"click_bounds_unavailable");
  var screen=System.Windows.Forms.SystemInformation.VirtualScreen;
  int x=(int)((r.Left+r.Width/2-screen.Left)*65535/Math.Max(1,screen.Width-1));
  int y=(int)((r.Top+r.Height/2-screen.Top)*65535/Math.Max(1,screen.Height-1));
  var a=new[]{new INPUT(){type=0,u=new UNION(){mi=new MOUSE(){dx=x,dy=y,flags=0xC001}}},
              new INPUT(){type=0,u=new UNION(){mi=new MOUSE(){flags=2}}},
              new INPUT(){type=0,u=new UNION(){mi=new MOUSE(){flags=4}}}};
  Require(SendInput((uint)a.Length,a,Marshal.SizeOf(typeof(INPUT)))==a.Length,"click_incomplete");
 }
 static void Select(){
  Refresh();if(ActualTitle()==Title)return;
  Require(Idle()>=8000,"waiting_for_user_idle");
  var candidates=Role=="chatgpt"?Find(Root,ControlType.Button).Where(e=>Name(e)==Title).ToArray():
   Find(Root,ControlType.TreeItem).Where(e=>Name(e)==Title||Name(e).StartsWith(Title+" ")).ToArray();
  Require(candidates.Length==1,"existing_conversation_selector_ambiguous");
  ShowWindow(Window,9);SetForegroundWindow(Window);
  Refresh();
  // No selector for new chat, reset, fork, branch, model or permissions exists in this driver.
  Click(candidates[0]);
  for(int k=0;k<30;k++){Thread.Sleep(100);Refresh();if(ActualTitle()==Title)return;}
  throw new Exception("existing_conversation_not_selected");
 }
 static string[] ConversationTexts(){
  Refresh();Require(ActualTitle()==Title,"wrong_conversation");
  var matches=Root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.NameProperty,"对话")).Cast<AutomationElement>()
   .Where(e=>e.Current.ControlType!=ControlType.TabItem&&e.Current.ControlType!=ControlType.Button).ToArray();
  return Texts(matches.Length==1?matches[0]:Document());
 }
 static Dictionary<string,object> Read(bool select=true){
  if(select)Select();else {Refresh();Require(ActualTitle()==Title,"original_not_visible");} Thread.Sleep(350);
  var texts=ConversationTexts();
  var segments=new List<Dictionary<string,object>>();
  string speaker="",user="";var body=new List<string>();
  Action finish=()=>{
   if(speaker=="assistant"){
    var kept=body.TakeWhile(x=>x!="最新一条回复"&&!x.StartsWith("ChatGPT 可能会出错")).ToArray();
    string value=String.Join("\n",kept).Trim();if(value.Length>0)segments.Add(D("text",value,"userText",user));
   }else if(speaker=="user")user=String.Join("\n",body).Trim();
   body.Clear();
  };
  foreach(var text in texts){
   if(text=="ChatGPT 说："||text=="ChatGPT said:"||text=="ChatGPT says:"){finish();speaker="assistant";}
   else if(text=="你说："||text=="You said:"){finish();speaker="user";}
   else body.Add(text);
  }
  finish();
  string last=segments.Count>0?(string)segments[segments.Count-1]["text"]:"";
  return D("title",ActualTitle(),"busy",Busy(),"assistantText",last,"hasAssistantBoundary",segments.Count>0,
   "segments",segments.Skip(Math.Max(0,segments.Count-6)).ToArray(),
   "anchorPresent",texts.Any(x=>x.Contains("42252d6f-ac57-48d0-94c7-d453f7dcc2cb")),
   "toolButtons",Find(Root,ControlType.Button).Where(e=>Name(e).StartsWith("已使用 ")||Name(e).StartsWith("已运行 ")).Select(Name).ToArray());
 }

 static void Unicode(string text){
  var a=new List<INPUT>();foreach(char c in text){Require(c>=32,"single_line_message_required");a.Add(new INPUT(){type=1,u=new UNION(){ki=new KEYBOARD(){scan=c,flags=4}}});a.Add(new INPUT(){type=1,u=new UNION(){ki=new KEYBOARD(){scan=c,flags=6}}});}
  Require(a.Count<=40000,"message_too_large");Require(SendInput((uint)a.Count,a.ToArray(),Marshal.SizeOf(typeof(INPUT)))==a.Count,"typing_outcome_unknown");
 }
 static Dictionary<string,object> Send(string text){
  Require((text.StartsWith("TRB_REQUEST ")||text.StartsWith("TRB_CHAT "))&&text.Length<20000,"only_platform_review_envelopes_allowed");
  Interactive();Require(Idle()>=8000,"waiting_for_user_idle");Select();Refresh();
  Require(ActualTitle()==Title&&!Busy(),"wrong_or_busy_conversation");
  var editor=Editor();Require(!Draft(editor),"existing_draft_preserved");
  ShowWindow(Window,9);editor.SetFocus();Thread.Sleep(150);if(GetForegroundWindow()!=Window)SetForegroundWindow(Window);Thread.Sleep(100);Require(GetForegroundWindow()==Window,"foreground_mismatch");Refresh();Require(ActualTitle()==Title&&!Busy()&&Automation.Compare(AutomationElement.FocusedElement,editor)&&!Draft(editor),"focus_or_draft_changed_before_input");Interactive();object writer;Require(editor.TryGetCurrentPattern(ValuePattern.Pattern,out writer)&&!((ValuePattern)writer).Current.IsReadOnly,"atomic_editor_update_not_supported");MutationStarted=true;((ValuePattern)writer).SetValue(text);
  bool matches=false;
  for(int i=0;i<100;i++){Thread.Sleep(100);Refresh();Require(ActualTitle()==Title&&GetForegroundWindow()==Window,"focus_or_conversation_changed");editor=Editor();if(Value(editor).Trim()==text){matches=true;break;}}
  Require(matches,"typed_text_not_verified_no_submit");
  // Submit once. No retry: the supervisor must observe the original user-message record.
  INPUT[] keys={new INPUT(){type=1,u=new UNION(){ki=new KEYBOARD(){vk=13}}},new INPUT(){type=1,u=new UNION(){ki=new KEYBOARD(){vk=13,flags=2}}}};
  Require(SendInput(2,keys,Marshal.SizeOf(typeof(INPUT)))==2,"submit_outcome_unknown");
  return D("submitted",true,"title",Title,"textLength",text.Length);
 }
 [STAThread] public static int Main(string[] args){
  try{
   DesktopMutex=new Mutex(false,"Local\\TriReviewBridge-Desktop-v2");try{OwnMutex=DesktopMutex.WaitOne(0);}catch(AbandonedMutexException){OwnMutex=true;}Require(OwnMutex,"desktop_adapter_busy");Console.InputEncoding=new UTF8Encoding(false);SetProcessDPIAware();Require(args.Length>=2,"role_and_operation_required");Role=args[0];Require(Role=="chatgpt"||Role=="deepseek","unsupported_role");
   Title=Role=="chatgpt"?"Nagi（继承的你1）":"主进度";
   string name=Role=="chatgpt"?"ChatGPT":"DeepSeek Harness";
   var processes=Process.GetProcessesByName(name).Where(p=>p.MainWindowHandle!=IntPtr.Zero).ToArray();
   Require(processes.Length==1,"exactly_one_existing_app_window_required");var process=processes[0];
   var executable=process.MainModule.FileName;
   Require(Role=="chatgpt"?executable.IndexOf("\\OpenAI.Codex_",StringComparison.OrdinalIgnoreCase)>=0:
    executable.Equals(@"C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\DeepSeek Harness.exe",StringComparison.OrdinalIgnoreCase),"app_identity_mismatch");
   Window=process.MainWindowHandle;Refresh();
   object result;
   switch(args[1]){
    case "inspect":result=Inspect();break;
    case "select":Select();result=Inspect();break;
    case "read":result=Read();break;
    case "peek":result=Read(false);break;
    case "calibrate":Select();Thread.Sleep(1500);Refresh();result=Root.FindAll(TreeScope.Descendants,Condition.TrueCondition).Cast<AutomationElement>().Where(e=>Name(e).Contains("TRB")||Name(e)=="ChatGPT 说：").Select(e=>D("type",e.Current.ControlType.ProgrammaticName,"name",Name(e).Substring(0,Math.Min(Name(e).Length,350)),"class",e.Current.ClassName)).ToArray();break;
    case "send":result=Send(Console.In.ReadToEnd());break;
    default:throw new Exception("operation_not_allowed");
   }
   Console.OutputEncoding=new UTF8Encoding(false);Console.WriteLine(J.Serialize(result));return 0;
  }catch(Exception e){Console.OutputEncoding=new UTF8Encoding(false);Console.WriteLine(J.Serialize(D("error",e.Message,"mutationStarted",MutationStarted,"noNewConversation",true)));return 1;}finally{if(OwnMutex)DesktopMutex.ReleaseMutex();if(DesktopMutex!=null)DesktopMutex.Dispose();}
 }
}
