using System;using System.IO;using System.Linq;using System.Collections.Generic;using System.Diagnostics;using System.Security.Cryptography;using System.Text;using System.Threading.Tasks;using System.Web.Script.Serialization;
namespace TriReviewBridge {
 internal sealed class HermesWatchStartResult {internal string State,ConsentPath;internal int? ProcessId;}
 internal static class HermesWatchConsent {
  const string ProductionRoot=@"D:\TriReviewBridge";
  internal const string FixedArguments="--watch --ack-native-session-access --ack-native-policy-refresh hermes";
  static readonly Dictionary<string,string> Approved=new Dictionary<string,string>{
   {"runtime/node.exe","1C63F1417E2E26D83CA9A9EC1D548524AB1305BC7209D90EBCA56257FF0D84ED"},
   {"tools/hybrid-native-001/worker.mjs","8D5C0176C5495D85F53F3EE9F30B3D3821F83E6E358FE9174BF26ADFDD7E90CE"},
   {"tools/hybrid-native-001/contract.mjs","3DA858D15E5DE3726603BA3760F35196FE29A05B18713983D9E80F021C33B25E"},
   {"tools/hybrid-native-001/hermes-gateway.py","DFD17AD847A9DE9C852D3B927A09FBAB018046E86508A886D74FA756280F9F33"},
   {"tools/hybrid-native-001/hermes_contract.py","982E70E3E92BCA0D8D183C3CE70D03C727DA0E2C106316E143FBEFA2E4CA17C5"},
   {"native/hermes-session.py","62495BBA4919C5B8EA824EAD04EA07BEB9720614EE1A707AB0570F643D1AC6DB"}
  };
#if HERMES_WATCH_TEST
  internal static string TestRoot;
  internal static Func<ProcessStartInfo,int> TestStart;
#endif
  static string RootPath {get{
#if HERMES_WATCH_TEST
   if(!String.IsNullOrEmpty(TestRoot))return Path.GetFullPath(TestRoot);
#endif
   return ProductionRoot;
  }}
  static string FixedPath(string relative){return Path.Combine(RootPath,relative.Replace('/',Path.DirectorySeparatorChar));}
  static Dictionary<string,object> D(params object[] pairs){var d=new Dictionary<string,object>();for(int n=0;n<pairs.Length;n+=2)d[(string)pairs[n]]=pairs[n+1];return d;}
  static void Plain(string path,bool fileRequired){string full=Path.GetFullPath(path);if(fileRequired&&!File.Exists(full))throw new IOException("固定Hermes组件缺失。");var current=new DirectoryInfo(fileRequired?Path.GetDirectoryName(full):full);while(current!=null){if(current.Exists&&(current.Attributes&FileAttributes.ReparsePoint)!=0)throw new IOException("固定Hermes路径不能经过链接。");current=current.Parent;}if(File.Exists(full)&&(File.GetAttributes(full)&FileAttributes.ReparsePoint)!=0)throw new IOException("固定Hermes文件不能是链接。");}
  static string Hash(string file){using(var algorithm=SHA256.Create())using(var input=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.Read))return BitConverter.ToString(algorithm.ComputeHash(input)).Replace("-","");}
  static void WriteNew(string file,object value){Plain(Path.GetDirectoryName(file),false);using(var output=new FileStream(file,FileMode.CreateNew,FileAccess.Write,FileShare.Read)){byte[] bytes=new UTF8Encoding(false).GetBytes(new JavaScriptSerializer().Serialize(value));output.Write(bytes,0,bytes.Length);output.Flush(true);}}
  internal static async Task<HermesWatchStartResult> PrepareAndStart(string config,bool userConfirmed,Func<Task> prepare){
   // The real WPF caller obtains this value only from a default-No local dialog.
   if(!userConfirmed)return new HermesWatchStartResult(){State="CANCELLED_NO_ACTION"};
   string fixedConfig=FixedPath("data/hybrid-native-001/workbench-config.json");if(!String.Equals(Path.GetFullPath(config),fixedConfig,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("本机Hermes启动只允许固定三方profile。");
   Plain(fixedConfig,true);var hashes=new Dictionary<string,string>();foreach(var item in Approved){string path=FixedPath(item.Key);Plain(path,true);string hash=Hash(path);if(hash!=item.Value)throw new IOException("固定Hermes组件与已审摘要不匹配，未启动："+item.Key);hashes[item.Key]=hash;}
   string folder=FixedPath("data/hybrid-native-001/user-consent");Plain(folder,false);Directory.CreateDirectory(folder);Plain(folder,false);
   string id=DateTime.UtcNow.ToString("yyyyMMddTHHmmssfffZ")+"-"+Guid.NewGuid().ToString("N"),consent=Path.Combine(folder,id+".consent.json"),result=Path.Combine(folder,id+".start-result.json");
   string node=FixedPath("runtime/node.exe"),worker=FixedPath("tools/hybrid-native-001/worker.mjs"),arguments="\""+worker+"\" "+FixedArguments;
   string source="WPF_USER_CONFIRMATION";
#if HERMES_WATCH_TEST
   source="FAKE_TEST_ONLY";
#endif
   WriteNew(consent,D("scope","HERMES_FIXED_NATIVE_WATCH_POLICY_REFRESH_SNAPSHOT_AND_OWN_RECEIPT_READ","role","hermes","sessionId","local-6f275933587b3c068cdbe3bea5633785fb8cacfb3a4c298855c66d931b6946d7","sessionTitle","Nagi","profileId","hybrid-native-001","confirmedAt",DateTime.UtcNow.ToString("o"),"source",source,"externalAudit",false,"confirmed",true,"nodePath",node,"workerPath",worker,"arguments",arguments,"approvedLocalComponentHashes",hashes,"fixedConfigPath",fixedConfig,"sdkRuntimeFullyFrozen",false,"independentAuthentication",false,"continuesAfterWindowCloses",true,"roleEnableStillSeparate",true));
   string stage="PREPARE_FAILED";
   try{
    await prepare(); // Existing owner API keeps Hermes paused before a worker can run.
    string lockPath=FixedPath("data/hybrid-native-001/native-worker-hermes.lock");
    if(File.Exists(lockPath)||Directory.Exists(lockPath)){WriteNew(result,D("state","EXISTING_LOCK_NO_START","role","hermes","consentPath",consent,"source",source,"externalAudit",false,"connectionVerified",false,"lockRemoved",false));return new HermesWatchStartResult(){State="EXISTING_LOCK_NO_START",ConsentPath=consent};}
    stage="START_FAILED";
    // Recheck the two executable inputs immediately before the fixed launch.
    foreach(string input in new[]{"runtime/node.exe","tools/hybrid-native-001/worker.mjs"}){Plain(FixedPath(input),true);if(Hash(FixedPath(input))!=Approved[input])throw new IOException("固定启动组件已变化，未启动。");}
    var start=new ProcessStartInfo(){FileName=node,Arguments=arguments,WorkingDirectory=RootPath,UseShellExecute=false,CreateNoWindow=true};
    start.EnvironmentVariables.Remove("NODE_OPTIONS");start.EnvironmentVariables.Remove("NODE_PATH");
    int pid;
#if HERMES_WATCH_TEST
    if(TestStart==null)throw new InvalidOperationException("Fake process starter is required in test builds.");pid=TestStart(start);
#else
    var process=Process.Start(start);if(process==null)throw new IOException("本机Hermes启动未返回进程。");pid=process.Id;
#endif
    stage="START_SIGNAL_RESULT_WRITE_FAILED";
    WriteNew(result,D("state","START_SIGNAL_ONLY","role","hermes","processId",pid,"consentPath",consent,"source",source,"externalAudit",false,"connectionVerified",false,"identityVerified",false,"enableGranted",false));
    return new HermesWatchStartResult(){State="START_SIGNAL_ONLY",ConsentPath=consent,ProcessId=pid};
   }catch(Exception error){try{WriteNew(result,D("state",stage,"role","hermes","consentPath",consent,"source",source,"externalAudit",false,"connectionVerified",false,"errorType",error.GetType().Name));}catch{}throw;}
  }
 }
}
