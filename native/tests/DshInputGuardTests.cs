using System;
public static class DshInputGuardTests {
 static int Passed=0;
 const string Text="TRB_CHAT fictional-dsh-guard 中文追加验证";
 static DesktopSession.DshSnapshot S(string text=""){return new DesktopSession.DshSnapshot(){Foreground=true,Focused=true,Busy=false,HumanChanged=false,Anchor=true,Title="主进度",Text=text};}
 static void Equal(bool ok,string message){if(!ok)throw new Exception(message);}
 static void Reject(Action action){bool failed=false;try{action();}catch{failed=true;}Equal(failed,"expected guard rejection");}
 static void Test(string name,Action action){action();Passed++;Console.WriteLine("PASS "+name);}
 static void FinalReject(string name,Action<DesktopSession.DshSnapshot> mutate){Test(name,()=>{var g=new DesktopSession.DshInputGuard();g.Begin(S(),Text);g.Typed(S(Text),Text);var final=S(Text);mutate(final);Reject(()=>g.TakeSubmitPermit(final,Text));Equal(!g.SubmitAttempted,"no submit permit after changed state");Reject(()=>g.TakeSubmitPermit(S(Text),Text));});}
 public static int Main(){try{
  Test("exact BMP single-line allows only one submit permit",()=>{var g=new DesktopSession.DshInputGuard();g.Begin(S(),Text);g.Typed(S(Text),Text);g.TakeSubmitPermit(S(Text),Text);Equal(g.SubmitAttempted,"one permit");Reject(()=>g.TakeSubmitPermit(S(Text),Text));Reject(()=>g.Begin(S(),Text));});
  Test("existing private draft preserved without append",()=>{var g=new DesktopSession.DshInputGuard();var s=S("fictional existing draft");Reject(()=>g.Begin(s,Text));Equal(s.Text=="fictional existing draft"&&!g.SubmitAttempted,"unchanged draft");});
  Test("whitespace draft is not treated as empty",()=>{var g=new DesktopSession.DshInputGuard();Reject(()=>g.Begin(S(" "),Text));});
  Test("human appends g: preserve differing text and never submit",()=>{var g=new DesktopSession.DshInputGuard();g.Begin(S(),Text);var s=S("g"+Text);s.HumanChanged=true;Reject(()=>g.Typed(s,Text));Equal(s.Text=="g"+Text&&!g.SubmitAttempted,"no clearing or overwrite");Reject(()=>g.Typed(S(Text),Text));});
  Test("text mismatch without trace is also rejected",()=>{var g=new DesktopSession.DshInputGuard();g.Begin(S(),Text);Reject(()=>g.Typed(S(Text+"extra"),Text));Equal(!g.SubmitAttempted,"no permit");});
  Test("trailing newline is never trimmed to equality",()=>{var g=new DesktopSession.DshInputGuard();g.Begin(S(),Text);Reject(()=>g.Typed(S(Text+"\r\n"),Text));});
  FinalReject("human activity between typing and final check",s=>s.HumanChanged=true);
  FinalReject("focus changes inside original window",s=>s.Focused=false);
  FinalReject("foreground window changes",s=>s.Foreground=false);
  FinalReject("session title changes",s=>s.Title="虚构其他会话");
  FinalReject("confirmed anchor disappears",s=>s.Anchor=false);
  FinalReject("generation starts before submit",s=>s.Busy=true);
  FinalReject("human clears text before submit",s=>s.Text="");
  Test("own request already visible before typing prevents resend",()=>{var g=new DesktopSession.DshInputGuard();var s=S();s.OwnRequestVisible=true;Reject(()=>g.Begin(s,Text));Equal(g.SubmissionObserved&&!g.SubmitAttempted,"observed but not submitted here");});
  Test("own request appears during typing: do not send again",()=>{var g=new DesktopSession.DshInputGuard();g.Begin(S(),Text);var s=S();s.OwnRequestVisible=true;Reject(()=>g.Typed(s,Text));Equal(g.SubmissionObserved&&!g.SubmitAttempted,"no second action");});
  FinalReject("own request appears at final recheck",s=>s.OwnRequestVisible=true);
  Test("submission outcome UNKNOWN cannot acquire another permit",()=>{var g=new DesktopSession.DshInputGuard();g.Begin(S(),Text);g.Typed(S(Text),Text);g.TakeSubmitPermit(S(Text),Text);Reject(()=>g.TakeSubmitPermit(S(Text),Text));Equal(g.SubmitAttempted,"attempt remains consumed");});
  Test("unsupported Unicode multi-line and controls fail before begin",()=>{foreach(var tail in new[]{"\nline","\rline","\tline","\u0085line","\u2028line","\u2029line","\ud83d\ude00"}){var g=new DesktopSession.DshInputGuard();Reject(()=>g.Begin(S(),Text+tail));Equal(g.State=="NEW"&&!g.SubmitAttempted,"no input phase");}});
  Test("wrong envelope rejected without entering typing",()=>{var g=new DesktopSession.DshInputGuard();Reject(()=>g.Begin(S(),"arbitrary text"));Equal(g.State=="NEW","no input phase");});
  Test("probe newline plan is exactly ShiftDown ReturnDown ReturnUp ShiftUp",()=>{var p=DesktopSession.AppendPlan("TRB_CHAT probe\n第二行",true);int at=Array.FindIndex(p,k=>k.Vk==16);Equal(at>=0,"shift batch exists");Equal(p[at].Vk==16&&p[at].Flags==0&&p[at+1].Vk==13&&p[at+1].Flags==0&&p[at+2].Vk==13&&p[at+2].Flags==2&&p[at+3].Vk==16&&p[at+3].Flags==2,"complete ordered four packet batch");Equal(Array.FindAll(p,k=>k.Vk==13).Length==2,"only shifted Return pair in append plan");});
  Test("default plan still rejects multiline; probe still rejects CR tab and surrogate",()=>{Reject(()=>DesktopSession.AppendPlan(Text+"\nline"));foreach(string t in new[]{Text+"\r\nline",Text+"\tline",Text+"\ud83d\ude00"})Reject(()=>DesktopSession.AppendPlan(t,true));});
  Test("owned keyup cleanup survives interruption after every newline packet prefix",()=>{var plan=new[]{new[]{16,0},new[]{13,0},new[]{13,2},new[]{16,2}};for(int stop=0;stop<=4;stop++){var gate=new DesktopSession.DshPacketGuard();for(int i=0;i<stop;i++)Equal(gate.Allow(plan[i][0],plan[i][1]==2,false,true),"prefix allowed");foreach(int key in gate.Held)Equal(gate.Allow(key,true,true,false),"own keyup cleanup remains allowed despite human/focus veto");Equal(gate.Held.Length==0,"no own stuck key");Equal(!gate.Allow(13,false,true,true),"no new Return down after human activity");}});
  Test("human priority suppresses remaining downs but not owned modifier release",()=>{var gate=new DesktopSession.DshPacketGuard();Equal(gate.Allow(16,false,false,true),"own Shift down");Equal(!gate.Allow(13,false,true,true),"Return down suppressed");Equal(!gate.Allow(13,true,true,true),"cannot release a key we did not press");Equal(gate.Allow(16,true,true,true),"our Shift release allowed");Equal(gate.Held.Length==0,"our modifiers released");});
  Test("newline followed by observed submit never obtains final Enter permit",()=>{string text=Text+"\n第二行";var g=new DesktopSession.DshInputGuard();g.Begin(S(),text,true);var state=S();state.OwnRequestVisible=true;state.Busy=true;Reject(()=>g.Typed(state,text));Equal(g.SubmissionObserved&&!g.SubmitAttempted,"no second submit");Reject(()=>g.TakeSubmitPermit(S(text),text));});
  Test("fixed multiline probe hash rejects arbitrary live material",()=>{const string probe="TRB_CHAT TRB_DSH_APPEND_PROBE_001\n这是用户手动启动的虚构多行输入核验。仅用文字回复“多行收到”；不调用工具、不读写文件、不处理任何真实项目。";DesktopSession.ValidateProbeText(probe);Reject(()=>DesktopSession.ValidateProbeText(probe+" changed"));});
  Test("partial Unicode own key has a tagged keyup cleanup plan",()=>{var gate=new DesktopSession.DshPacketGuard();Equal(gate.Allow(231,false,false,true),"own packet down");var packet=DesktopSession.CleanupPacket(231,'中');Equal(packet.Vk==0&&packet.Scan=='中'&&packet.Flags==6,"Unicode keyup only");Equal(gate.Allow(231,true,true,false)&&gate.Held.Length==0,"own packet released despite human veto");});
  Test("cleanup never creates keydown or another submit",()=>{foreach(int key in new[]{16,160,13}){var p=DesktopSession.CleanupPacket(key,0);Equal(p.Vk==key&&p.Flags==2,"keyup only");}});
  Console.WriteLine("TESTS "+Passed+" PASS "+Passed+" FAIL 0; PURE_GUARD_ONLY; NO_UI_NO_APP_NO_SESSION");return 0;
 }catch(Exception e){Console.Error.WriteLine("FAIL "+e.Message);return 1;}}
}
